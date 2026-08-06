import { useState, useRef, useCallback, useEffect } from 'react';
import {
  View, Text, Image, Animated, Easing, TouchableOpacity,
  ScrollView, StyleSheet, Dimensions, ActivityIndicator,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Feather } from '@expo/vector-icons';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { supabase } from '../../lib/supabase';
import { consumeCachedTask, prefetchNextTask } from '../../lib/taskCache';
import { useAuth } from '../../context/AuthContext';
import { useHaptics } from '../../context/HapticsContext';
import { colors, fonts, radius } from '../../constants/theme';
import TutorialOverlay from './TutorialOverlay';
import { useTutorial } from '../../context/TutorialContext';

const { width: SW, height: SH } = Dimensions.get('window');
const CARD_W = Math.floor((SW - 32 - 10) / 2);
const CARD_H = Math.floor(CARD_W / 0.5);

const MODAL_ZOOM  = 2.5;
const MODAL_IMG_H = Math.floor(SW / 0.9);
const TELL_MIN_ZOOM = 1;
const TELL_MAX_ZOOM = 6;
const INSPECT_MIN_ZOOM        = 1;
const INSPECT_MAX_ZOOM        = 4;
const INSPECT_DOUBLE_TAP_ZOOM = 2.5;

const CORRECT_FILL   = 'rgba(34,197,94,0.72)';
const INCORRECT_FILL = 'rgba(239,68,68,0.72)';

export default function GameplayScreen() {
  const { user }                                        = useAuth();
  const { medium, success, error: hapticError, light } = useHaptics();
  const insets = useSafeAreaInsets();
  const { startTutorial, revealTabBar } = useTutorial();
  const wasTutorial = useRef(false);

  const [phase, setPhase]           = useState('loading');
  const [task, setTask]             = useState(null);
  const [leftIsReal, setLeftIsReal] = useState(true);
  const [voting, setVoting]         = useState(false);
  const [tappedSide, setTappedSide] = useState(null);
  const [result, setResult]         = useState(null);
  const [loadError, setLoadError]   = useState(null);
  const [leftPctDisplay,  setLeftPctDisplay]  = useState(0);
  const [rightPctDisplay, setRightPctDisplay] = useState(0);
  const startTime                   = useRef(Date.now());

  // null = loading from storage; 0 = complete; string = active step
  const [tutorialStep, setTutorialStep] = useState(null);

  const [showTells, setShowTells] = useState(false);
  const [zoomTell,    setZoomTell]    = useState(null);
  const zoomTellRef   = useRef(null);
  const [selectedSide, setSelectedSide] = useState(null); // 'left' | 'right' — pre-confirm pick
  const [inspectSide,  setInspectSide]  = useState(null); // 'left' | 'right' — full-screen zoom
  const [aiLayout,      setAiLayout]      = useState({ width: 0, height: 0 });
  const [aiNaturalSize, setAiNaturalSize] = useState({ width: 0, height: 0 });

  // ── Inspect pinch/pan/double-tap ── same RNGH approach as the tell overlay
  // below, so both overlays share one set of gesture semantics. Transform order
  // is [translateX, translateY, scale] → translation is in post-scale screen px,
  // giving 1:1 finger tracking with no divide-by-scale.
  const inspectScale  = useRef(new Animated.Value(1)).current;
  const inspectTransX = useRef(new Animated.Value(0)).current;
  const inspectTransY = useRef(new Animated.Value(0)).current;
  const _iAreaH = useRef(SH); // set by onLayout — this frame is full-bleed, so height varies
  // Per-frame gesture deltas; see the tell overlay for why this is incremental.
  const _iPrevPinch    = useRef(1);
  const _iPrevFX       = useRef(0);
  const _iPrevFY       = useRef(0);
  const _iPrevPointers = useRef(0);
  const _iPrevPanX     = useRef(0);
  const _iPrevPanY     = useRef(0);

  function clampInspectPan(s, tx, ty) {
    const maxX = Math.max(0, (s - 1) * SW / 2);
    const maxY = Math.max(0, (s - 1) * _iAreaH.current / 2);
    return {
      tx: Math.max(-maxX, Math.min(maxX, tx)),
      ty: Math.max(-maxY, Math.min(maxY, ty)),
    };
  }

  // Confined to the frame: zoom-about-focal gain scales with |focal|, so a focal
  // allowed to wander onto the header/footer bars makes a tiny pinch whip the image.
  function inspectFocalFromCentre(x, y) {
    const h = _iAreaH.current;
    return {
      fx: Math.max(0, Math.min(SW, x)) - SW / 2,
      fy: Math.max(0, Math.min(h, y)) - h / 2,
    };
  }

  const inspectGesture = useRef(
    Gesture.Simultaneous(
      Gesture.Pinch()
        .runOnJS(true)
        .onStart(e => {
          inspectScale.stopAnimation(); inspectTransX.stopAnimation(); inspectTransY.stopAnimation();
          const { fx, fy } = inspectFocalFromCentre(e.focalX, e.focalY);
          _iPrevPinch.current    = 1; // e.scale is 1 at gesture start
          _iPrevFX.current       = fx;
          _iPrevFY.current       = fy;
          _iPrevPointers.current = e.numberOfPointers;
        })
        .onUpdate(e => {
          const { fx, fy } = inspectFocalFromCentre(e.focalX, e.focalY);
          const curS  = inspectScale.__getValue();
          const curTX = inspectTransX.__getValue();
          const curTY = inspectTransY.__getValue();

          // Incremental scale factor, guarded against the spike e.scale produces
          // when a finger lifts or lands.
          let k = e.scale / (_iPrevPinch.current || 1);
          if (!isFinite(k) || k <= 0) k = 1;
          k = Math.max(0.8, Math.min(1.25, k));
          const newS = Math.max(INSPECT_MIN_ZOOM, Math.min(INSPECT_MAX_ZOOM, curS * k));
          const kEff = newS / curS;

          // A change in finger count teleports the focal — re-anchor rather than
          // read that teleport as a drag.
          const reanchor = e.numberOfPointers !== _iPrevPointers.current;
          const f0x = reanchor ? fx : _iPrevFX.current;
          const f0y = reanchor ? fy : _iPrevFY.current;

          // T' = f1 - k*(f0 - T) — pins the content under the focal, and with
          // f1 != f0 also carries the two-finger drag.
          const c = clampInspectPan(newS, fx - kEff * (f0x - curTX), fy - kEff * (f0y - curTY));
          inspectScale.setValue(newS);
          inspectTransX.setValue(c.tx);
          inspectTransY.setValue(c.ty);

          _iPrevPinch.current    = e.scale;
          _iPrevFX.current       = fx;
          _iPrevFY.current       = fy;
          _iPrevPointers.current = e.numberOfPointers;
        }),

      // maxPointers(1) keeps pan off during a pinch, so the focal math above owns
      // two-finger drag and the two never double-count translation.
      Gesture.Pan()
        .runOnJS(true)
        .maxPointers(1)
        .onStart(() => {
          inspectTransX.stopAnimation(); inspectTransY.stopAnimation();
          _iPrevPanX.current = 0;
          _iPrevPanY.current = 0;
        })
        .onUpdate(e => {
          const dx = e.translationX - _iPrevPanX.current;
          const dy = e.translationY - _iPrevPanY.current;
          _iPrevPanX.current = e.translationX;
          _iPrevPanY.current = e.translationY;
          const c = clampInspectPan(
            inspectScale.__getValue(),
            inspectTransX.__getValue() + dx,
            inspectTransY.__getValue() + dy,
          );
          inspectTransX.setValue(c.tx);
          inspectTransY.setValue(c.ty);
        }),

      // Double-tap toggles fit ⇄ INSPECT_DOUBLE_TAP_ZOOM about the tapped point.
      Gesture.Tap()
        .runOnJS(true)
        .numberOfTaps(2)
        .maxDuration(260)
        .onEnd(e => {
          const curS  = inspectScale.__getValue();
          const curTX = inspectTransX.__getValue();
          const curTY = inspectTransY.__getValue();
          const to = curS > (INSPECT_MIN_ZOOM + INSPECT_DOUBLE_TAP_ZOOM) / 2
            ? INSPECT_MIN_ZOOM
            : INSPECT_DOUBLE_TAP_ZOOM;
          const k = to / curS;
          const { fx, fy } = inspectFocalFromCentre(e.x, e.y);
          const c = clampInspectPan(to, fx - k * (fx - curTX), fy - k * (fy - curTY));
          Animated.parallel([
            Animated.spring(inspectScale,  { toValue: to,   useNativeDriver: false, bounciness: 0 }),
            Animated.spring(inspectTransX, { toValue: c.tx, useNativeDriver: false, bounciness: 0 }),
            Animated.spring(inspectTransY, { toValue: c.ty, useNativeDriver: false, bounciness: 0 }),
          ]).start();
        }),
    )
  ).current;

  // ── Tell zoom: RNGH pinch + pan driving RN Animated values. ──
  // Transform order is [translateX, translateY, scale] → the translation is applied
  // AFTER the scale, i.e. in screen px, so a finger delta maps 1:1 with no
  // division by scale (unlike the inspect overlay above, which scales first).
  const tellScale = useRef(new Animated.Value(MODAL_ZOOM)).current;
  const tellTX    = useRef(new Animated.Value(0)).current;
  const tellTY    = useRef(new Animated.Value(0)).current;
  const _tFocus = useRef({ s: MODAL_ZOOM, tx: 0, ty: 0 });
  // Per-frame gesture deltas. Every update is applied relative to the PREVIOUS
  // frame rather than to the gesture-start baseline, so a value that hits the
  // pan clamp does not build up an invisible backlog that snaps back later.
  const _tPrevPinch    = useRef(1);
  const _tPrevFX       = useRef(0);
  const _tPrevFY       = useRef(0);
  const _tPrevPointers = useRef(0);
  const _tPrevPanX     = useRef(0);
  const _tPrevPanY     = useRef(0);

  // Keep the frame covered: at scale s the image overhangs by (s-1)/2 per side.
  // At s=1 this collapses to 0, forcing dead centre.
  function clampTellPan(s, tx, ty) {
    const maxX = Math.max(0, (s - 1) * SW / 2);
    const maxY = Math.max(0, (s - 1) * MODAL_IMG_H / 2);
    return {
      tx: Math.max(-maxX, Math.min(maxX, tx)),
      ty: Math.max(-maxY, Math.min(maxY, ty)),
    };
  }

  // Focal point relative to frame centre, confined to the image frame.
  // Sensitivity of the zoom-about-focal math scales with |focal|, so letting the
  // focal wander onto the header/footer bars makes a tiny pinch swing the image
  // wildly. Pinning it to the frame edge bounds that gain.
  function tellFocalFromCentre(x, y) {
    return {
      fx: Math.max(0, Math.min(SW, x)) - SW / 2,
      fy: Math.max(0, Math.min(MODAL_IMG_H, y)) - MODAL_IMG_H / 2,
    };
  }

  // Framing that lands the tell dead centre at MODAL_ZOOM.
  function tellFocus(tell) {
    const fx = tell?.x ?? 0.5;
    const fy = tell?.y ?? 0.5;
    const { width: nw, height: nh } = aiNaturalSize;
    if (nw > 0 && nh > 0) {
      // natural fraction → display px inside the SW×MODAL_IMG_H cover-fit frame
      const ms = Math.max(SW / nw, MODAL_IMG_H / nh);
      const px = fx * nw * ms - (nw * ms - SW) / 2;
      const py = fy * nh * ms - (nh * ms - MODAL_IMG_H) / 2;
      return { s: MODAL_ZOOM, tx: -(px - SW / 2) * MODAL_ZOOM, ty: -(py - MODAL_IMG_H / 2) * MODAL_ZOOM };
    }
    // Fallback before natural size loads
    return { s: MODAL_ZOOM, tx: -(fx - 0.5) * SW * MODAL_ZOOM, ty: -(fy - 0.5) * MODAL_IMG_H * MODAL_ZOOM };
  }

  function openTell(tell) {
    light();
    zoomTellRef.current = tell;
    const f = tellFocus(tell);
    const c = clampTellPan(f.s, f.tx, f.ty);
    _tFocus.current = { s: f.s, tx: c.tx, ty: c.ty };
    tellScale.setValue(f.s);
    tellTX.setValue(c.tx);
    tellTY.setValue(c.ty);
    setZoomTell(tell);
  }

  // runOnJS(true) is required: these callbacks drive RN Animated, not Reanimated
  // worklets. Reanimated 4 is installed but needs the New Architecture, which is
  // off in app.json — so this path deliberately avoids it.
  const tellGesture = useRef(
    Gesture.Simultaneous(
      Gesture.Pinch()
        .runOnJS(true)
        .onStart(e => {
          tellScale.stopAnimation(); tellTX.stopAnimation(); tellTY.stopAnimation();
          const { fx, fy } = tellFocalFromCentre(e.focalX, e.focalY);
          _tPrevPinch.current    = 1; // e.scale is 1 at gesture start
          _tPrevFX.current       = fx;
          _tPrevFY.current       = fy;
          _tPrevPointers.current = e.numberOfPointers;
        })
        .onUpdate(e => {
          const { fx, fy } = tellFocalFromCentre(e.focalX, e.focalY);
          const curS  = tellScale.__getValue();
          const curTX = tellTX.__getValue();
          const curTY = tellTY.__getValue();

          // Incremental scale factor since the last frame, guarded against the
          // spike that e.scale produces when a finger lifts or lands.
          let k = e.scale / (_tPrevPinch.current || 1);
          if (!isFinite(k) || k <= 0) k = 1;
          k = Math.max(0.8, Math.min(1.25, k));
          const newS = Math.max(TELL_MIN_ZOOM, Math.min(TELL_MAX_ZOOM, curS * k));
          const kEff = newS / curS;

          // A change in finger count teleports the focal. Re-anchor on the new
          // focal instead of interpreting that teleport as a drag.
          const reanchor = e.numberOfPointers !== _tPrevPointers.current;
          const f0x = reanchor ? fx : _tPrevFX.current;
          const f0y = reanchor ? fy : _tPrevFY.current;

          // T' = f1 - k*(f0 - T) — holds the content under the focal in place,
          // and with f1 != f0 also carries the two-finger drag.
          const c = clampTellPan(newS, fx - kEff * (f0x - curTX), fy - kEff * (f0y - curTY));
          tellScale.setValue(newS);
          tellTX.setValue(c.tx);
          tellTY.setValue(c.ty);

          _tPrevPinch.current    = e.scale;
          _tPrevFX.current       = fx;
          _tPrevFY.current       = fy;
          _tPrevPointers.current = e.numberOfPointers;
        }),

      // maxPointers(1) keeps pan off during a pinch, so the focal math above owns
      // two-finger drag and the two gestures never double-count translation.
      Gesture.Pan()
        .runOnJS(true)
        .maxPointers(1)
        .onStart(() => {
          tellTX.stopAnimation(); tellTY.stopAnimation();
          _tPrevPanX.current = 0;
          _tPrevPanY.current = 0;
        })
        .onUpdate(e => {
          const dx = e.translationX - _tPrevPanX.current;
          const dy = e.translationY - _tPrevPanY.current;
          _tPrevPanX.current = e.translationX;
          _tPrevPanY.current = e.translationY;
          const c = clampTellPan(
            tellScale.__getValue(),
            tellTX.__getValue() + dx,
            tellTY.__getValue() + dy,
          );
          tellTX.setValue(c.tx);
          tellTY.setValue(c.ty);
        }),

      // Double-tap toggles between the tell framing and the whole image.
      Gesture.Tap()
        .runOnJS(true)
        .numberOfTaps(2)
        .maxDuration(260)
        .onEnd(() => {
          const f        = _tFocus.current;
          const zoomedIn = tellScale.__getValue() > (f.s + TELL_MIN_ZOOM) / 2;
          const to       = zoomedIn ? { s: TELL_MIN_ZOOM, tx: 0, ty: 0 } : f;
          const c        = clampTellPan(to.s, to.tx, to.ty);
          Animated.parallel([
            Animated.spring(tellScale, { toValue: to.s,  useNativeDriver: false, bounciness: 0 }),
            Animated.spring(tellTX,    { toValue: c.tx,  useNativeDriver: false, bounciness: 0 }),
            Animated.spring(tellTY,    { toValue: c.ty,  useNativeDriver: false, bounciness: 0 }),
          ]).start();
        }),
    )
  ).current;

  const [nextTask,      setNextTask]      = useState(null);
  const nextLeftIsReal  = useRef(false);

  // Increment on every fetchTask so images always remount even if task.id repeats
  const cardKey        = useRef(0);
  const loadCount      = useRef(0);
  const fastTransition = useRef(false);
  const playingOpacity = useRef(new Animated.Value(1)).current;
  const resultsOpacity = useRef(new Animated.Value(0)).current;
  const fadeAnim       = useRef(new Animated.Value(0)).current;
  // Fill scale: 0 = no fill, 1 = full card. Uses scaleY + translateY so useNativeDriver:true
  // works (height animation requires JS thread and causes sync flicker with native opacity).
  const leftFillAnim   = useRef(new Animated.Value(0)).current;
  const rightFillAnim  = useRef(new Animated.Value(0)).current;
  const leftFillTranslateY  = useRef(leftFillAnim.interpolate({ inputRange: [0, 1], outputRange: [CARD_H / 2, 0] })).current;
  const rightFillTranslateY = useRef(rightFillAnim.interpolate({ inputRange: [0, 1], outputRange: [CARD_H / 2, 0] })).current;
  const verdictTranslateY = useRef(new Animated.Value(10)).current;
  const verdictOpacity = useRef(new Animated.Value(0)).current;
  const labelsOpacity  = useRef(new Animated.Value(0)).current;
  const bottomOpacity  = useRef(new Animated.Value(0)).current;
  const shimmerAnims        = useRef(Array.from({ length: 5 }, () => new Animated.Value(0))).current;
  const tellsPulse          = useRef(new Animated.Value(0)).current;
  const tutorialPromptAnim  = useRef(new Animated.Value(0)).current;

  useFocusEffect(useCallback(() => { fetchTask(); }, []));

  useEffect(() => {
    AsyncStorage.getItem('ai_hunter_tutorial_done').then(val => {
      setTutorialStep(val ? 0 : 'cinematic');
    });
  }, []);

  // Hide tab bar when tutorial starts; reveal is deferred to handleNextCard
  useEffect(() => {
    if (tutorialStep === 'cinematic') startTutorial();
  }, [tutorialStep]);

  // 'pick' → 'zoom': user selected an image
  useEffect(() => {
    if (tutorialStep === 'pick' && selectedSide) setTutorialStep('zoom');
  }, [selectedSide]);

  // 'confirm' → 'tells': result arrived
  useEffect(() => {
    if (tutorialStep === 'confirm' && result) setTutorialStep('tells');
  }, [result]);

  // Fade in tutorial prompt text when step becomes 'pick' or 'zoom' (avoids flash)
  useEffect(() => {
    if (tutorialStep === 'pick' || tutorialStep === 'zoom') {
      tutorialPromptAnim.setValue(0);
      Animated.timing(tutorialPromptAnim, { toValue: 1, duration: 220, delay: 60, useNativeDriver: true }).start();
    }
  }, [tutorialStep]);

  // 'tells': auto-expand the tells section + pulse ring
  useEffect(() => {
    if (tutorialStep !== 'tells') return;
    setShowTells(true);
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(tellsPulse, { toValue: 1,   duration: 900, useNativeDriver: true }),
      Animated.timing(tellsPulse, { toValue: 0.15, duration: 900, useNativeDriver: true }),
    ]));
    loop.start();
    return () => { loop.stop(); tellsPulse.setValue(0); };
  }, [tutorialStep]);

  async function advanceTutorial() {
    if (tutorialStep === 'cinematic') {
      setTutorialStep('pick');
    } else if (tutorialStep === 'tells') {
      await AsyncStorage.setItem('ai_hunter_tutorial_done', '1');
      setTutorialStep(0);
      wasTutorial.current = true; // tab bar reveal deferred to Next Pair
    }
  }

  async function fetchTask() {
    fastTransition.current = false;
    setNextTask(null);
    setPhase('loading');
    setLoadError(null);
    setResult(null);
    setVoting(false);
    setTappedSide(null);
    setSelectedSide(null);
    setInspectSide(null);
    setShowTells(false);

    cardKey.current += 1;
    loadCount.current = 0;

    playingOpacity.setValue(1);
    resultsOpacity.setValue(0);
    fadeAnim.setValue(0);
    leftFillAnim.setValue(0);
    rightFillAnim.setValue(0);
    verdictTranslateY.setValue(10);
    verdictOpacity.setValue(0);
    labelsOpacity.setValue(0);
    bottomOpacity.setValue(0);
    setLeftPctDisplay(0);
    setRightPctDisplay(0);
    shimmerAnims.forEach(v => v.setValue(0));

    const cached = consumeCachedTask();
    if (cached) {
      setTask(cached);
      setLeftIsReal(Math.random() > 0.5);
      startTime.current = Date.now();
      setPhase('playing');
      return;
    }

    const { count, error: countErr } = await supabase
      .from('tasks')
      .select('*', { count: 'exact', head: true })
      .eq('approval_status', 'active');

    if (countErr || !count) { setLoadError('Could not load a card.'); setPhase('playing'); return; }

    const randomIndex = Math.floor(Math.random() * count);
    const { data, error: fetchErr } = await supabase
      .from('tasks')
      .select('*')
      .eq('approval_status', 'active')
      .range(randomIndex, randomIndex)
      .single();

    if (fetchErr || !data) { setLoadError('Could not load a card.'); setPhase('playing'); return; }

    setTask(data);
    setLeftIsReal(Math.random() > 0.5);
    startTime.current = Date.now();
    setPhase('playing');
  }

  function handleImageLoad() {
    loadCount.current += 1;
    if (loadCount.current === 2) {
      // Both images rendered — start prefetching the next card immediately so
      // the full gameplay duration (typically 3–20 s) is available for download
      // and decode before the user taps Next Pair.
      prefetchNextTask(supabase).then(t => {
        if (t) { nextLeftIsReal.current = Math.random() > 0.5; setNextTask(t); }
      });

      if (fastTransition.current) {
        fastTransition.current = false;
        Animated.timing(fadeAnim, { toValue: 1, duration: 130, useNativeDriver: true }).start();
      } else {
        Animated.timing(fadeAnim, { toValue: 1, duration: 200, useNativeDriver: true }).start();
      }
    } else if (loadCount.current > 2) {
      // Extra onLoadEnd fires (e.g. source prop update) — just ensure image is visible.
      fadeAnim.setValue(1);
    }
  }

  function handleSelect(side) {
    if (voting || phase !== 'playing') return;
    light();
    setSelectedSide(side);
  }

  async function handleConfirm() {
    if (!selectedSide || voting || phase !== 'playing') return;
    medium();
    const tappedLeft = selectedSide === 'left';
    setTappedSide(selectedSide);
    setVoting(true);

    const tappedReal       = tappedLeft === leftIsReal;
    const chose_ai         = tappedReal;
    const response_time_ms = Date.now() - startTime.current;

    const { data, error: voteErr } = await supabase.rpc('record_vote', {
      p_task_id: task.id, p_user_id: user.id,
      p_chose_ai: chose_ai, p_response_time_ms: response_time_ms,
    });

    if (voteErr) { console.error('Vote error:', voteErr.message); setVoting(false); setTappedSide(null); setSelectedSide(null); return; }

    data.was_correct ? success() : hapticError();
    setResult(data);
    revealResults(data);
  }

  function countUp(setter, target, duration) {
    const start = Date.now();
    const tick = () => {
      const p = Math.min((Date.now() - start) / duration, 1);
      const eased = 1 - Math.pow(1 - p, 3); // out-cubic matches bar fill
      setter(Math.round(eased * target));
      if (p < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }

  function revealResults(data) {
    const leftPct  = leftIsReal ? data.real_pct : data.ai_pct;
    const rightPct = leftIsReal ? data.ai_pct   : data.real_pct;

    setPhase('results');
    prefetchNextTask(supabase).then(t => {
      if (t && !nextTask) { nextLeftIsReal.current = Math.random() > 0.5; setNextTask(t); }
    });

    setTimeout(() => {
      playingOpacity.setValue(0);
      resultsOpacity.setValue(1);
      verdictTranslateY.setValue(10);
      verdictOpacity.setValue(0);
      labelsOpacity.setValue(0);
      bottomOpacity.setValue(0);
      setLeftPctDisplay(0);
      setRightPctDisplay(0);

      // Beat 1: bars fill immediately — bars are the drama
      leftFillAnim.setValue(0);
      rightFillAnim.setValue(0);
      Animated.parallel([
        Animated.timing(leftFillAnim,  { toValue: leftPct  / 100, duration: 900, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
        Animated.timing(rightFillAnim, { toValue: rightPct / 100, duration: 900, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      ]).start();
      countUp(setLeftPctDisplay,  leftPct,  900);
      countUp(setRightPctDisplay, rightPct, 900);

      // Beat 2: verdict + labels + bottom all land together as bars finish
      setTimeout(() => {
        Animated.parallel([
          Animated.timing(verdictOpacity, { toValue: 1, duration: 90, easing: Easing.out(Easing.ease), useNativeDriver: true }),
          Animated.timing(labelsOpacity,  { toValue: 1, duration: 90, easing: Easing.out(Easing.ease), useNativeDriver: true }),
          Animated.timing(bottomOpacity,  { toValue: 1, duration: 90, easing: Easing.out(Easing.ease), useNativeDriver: true }),
        ]).start();
        setTimeout(() => medium(), 86);
      }, 875);
    }, 50);
  }

  function openInspect(side) {
    // Reset transforms while the overlay is still invisible (opacity:0.001).
    // Resetting here (not on close) means the overlay hides without any
    // transform snap — closing is just an opacity change, nothing moves.
    inspectScale.setValue(1);
    inspectTransX.setValue(0);
    inspectTransY.setValue(0);
    setInspectSide(side);
  }

  function closeInspect() {
    setInspectSide(null);
    if (tutorialStep === 'zoom') setTutorialStep('confirm');
  }

  function handleNextCard() {
    light();
    const afterTutorial = wasTutorial.current;
    wasTutorial.current = false;
    setShowTells(false);
    setZoomTell(null);
    setSelectedSide(null);
    setInspectSide(null);
    setAiNaturalSize({ width: 0, height: 0 });

    Animated.timing(resultsOpacity, { toValue: 0, duration: 150, useNativeDriver: true })
      .start(() => {
        if (afterTutorial) revealTabBar();
        if (nextTask) {
          // Images hidden while source props update in-place (no cardKey change).
          // The pre-render above keeps decoded textures in GPU memory, so
          // onLoadEnd fires in <1 frame and fastTransition snaps fadeAnim to 1.
          fadeAnim.setValue(0);
          leftFillAnim.setValue(0);
          rightFillAnim.setValue(0);
          verdictTranslateY.setValue(10);
          verdictOpacity.setValue(0);
          labelsOpacity.setValue(0);
          bottomOpacity.setValue(0);
          setLeftPctDisplay(0);
          setRightPctDisplay(0);
          shimmerAnims.forEach(v => v.setValue(0));

          consumeCachedTask(); // clear module-level cache
          loadCount.current = 0;
          fastTransition.current = true;
          setTask(nextTask);
          setLeftIsReal(nextLeftIsReal.current);
          setNextTask(null);
          setResult(null);
          setVoting(false);
          setTappedSide(null);
          setLoadError(null);
          startTime.current = Date.now();
          playingOpacity.setValue(1);
          setPhase('playing');

          // Kick off prefetch for the card after next
          prefetchNextTask(supabase).then(t => {
            if (t) { nextLeftIsReal.current = Math.random() > 0.5; setNextTask(t); }
          });
        } else {
          fetchTask();
        }
      });
  }

  useEffect(() => {
    if (!showTells || !task) { shimmerAnims.forEach(v => v.setValue(0)); return; }
    const tells = task.tell_annotations || [];
    const loops = shimmerAnims.slice(0, tells.length).map(v =>
      Animated.loop(Animated.sequence([
        Animated.timing(v, { toValue: 1, duration: 1100, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(v, { toValue: 0, duration: 1100, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ]))
    );
    const timers = loops.map((l, i) => setTimeout(() => l.start(), i * 320));
    return () => { loops.forEach(l => l.stop()); timers.forEach(clearTimeout); shimmerAnims.forEach(v => v.setValue(0)); };
  }, [showTells, task]);

  const leftUrl  = task ? (leftIsReal ? task.real_image_url : task.ai_image_url) : '';
  const rightUrl = task ? (leftIsReal ? task.ai_image_url   : task.real_image_url) : '';

  const leftFillColor  = leftIsReal  ? CORRECT_FILL : INCORRECT_FILL;
  const rightFillColor = !leftIsReal ? CORRECT_FILL : INCORRECT_FILL;
  const leftColor      = leftIsReal  ? colors.correct : colors.incorrect;
  const rightColor     = !leftIsReal ? colors.correct : colors.incorrect;
  const tells          = task ? (task.tell_annotations || []) : [];

  return (
    <View style={styles.root}>

        {/* Always-opaque dark backstop: shows when both animated layers are at opacity 0 */}
        <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.bg }]} />

        {/* ── PLAYING LAYER ───────────────────────────────────── */}
        <Animated.View
          style={[StyleSheet.absoluteFill, { opacity: playingOpacity }]}
          pointerEvents={phase === 'playing' ? 'box-none' : 'none'}
        >
          <View style={[styles.layer, { paddingTop: insets.top + 16, paddingBottom: insets.bottom }]}>
            {/* Top section: fixed height matching results verdict block + gap
                so the imageRow sits at the same Y in both playing and results */}
            <View style={styles.playingTop}>
              {tutorialStep === 'pick' ? (
                <Animated.Text style={[styles.tutorialPrompt, { opacity: tutorialPromptAnim }]}>
                  Tap the image you think is real
                </Animated.Text>
              ) : tutorialStep === 'zoom' ? (
                <Animated.View style={[{ alignItems: 'center', gap: 6 }, { opacity: tutorialPromptAnim }]}>
                  <Text style={styles.tutorialPrompt}>Zoom in to inspect it</Text>
                  <Text style={styles.tutorialHint}>Tap the icon — or pinch to zoom</Text>
                </Animated.View>
              ) : phase === 'loading' && !task ? (
                <ActivityIndicator color={colors.textPrimary} />
              ) : loadError ? (
                <Text style={styles.errorText}>{loadError}</Text>
              ) : (
                <Text style={styles.prompt}>
                  {selectedSide ? 'Is this the real one?' : 'Tap the real image'}
                </Text>
              )}
            </View>

            {/* Image row — same position as results layer */}
            <View style={styles.imageRow}>
              {/* Left image */}
              <View style={[styles.imageWrapper, selectedSide === 'left' && styles.imageWrapperChosen]}>
                <TouchableOpacity
                  style={StyleSheet.absoluteFillObject}
                  onPress={() => handleSelect('left')}
                  disabled={voting}
                  activeOpacity={0.88}
                >
                  {task && (
                    <Animated.Image
                      key={cardKey.current + '-left'}
                      source={{ uri: leftUrl }}
                      style={[styles.image, { opacity: fadeAnim }]}
                      resizeMode="cover"
                      onLoadEnd={handleImageLoad}
                    />
                  )}
                </TouchableOpacity>
                {selectedSide === 'left' && (
                  <TouchableOpacity
                    style={styles.zoomIconBtn}
                    hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                    onPress={() => { light(); openInspect('left'); }}
                  >
                    <Feather name="maximize-2" size={13} color="#fff" />
                  </TouchableOpacity>
                )}
              </View>

              {/* Right image */}
              <View style={[styles.imageWrapper, selectedSide === 'right' && styles.imageWrapperChosen]}>
                <TouchableOpacity
                  style={StyleSheet.absoluteFillObject}
                  onPress={() => handleSelect('right')}
                  disabled={voting}
                  activeOpacity={0.88}
                >
                  {task && (
                    <Animated.Image
                      key={cardKey.current + '-right'}
                      source={{ uri: rightUrl }}
                      style={[styles.image, { opacity: fadeAnim }]}
                      resizeMode="cover"
                      onLoadEnd={handleImageLoad}
                    />
                  )}
                </TouchableOpacity>
                {selectedSide === 'right' && (
                  <TouchableOpacity
                    style={styles.zoomIconBtn}
                    hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                    onPress={() => { light(); openInspect('right'); }}
                  >
                    <Feather name="maximize-2" size={13} color="#fff" />
                  </TouchableOpacity>
                )}
              </View>
            </View>

            {/* Bottom section: flex fills rest, confirm button at bottom */}
            <View style={styles.playingBottom}>
              <View style={styles.confirmContainer}>
                <TouchableOpacity
                  style={[
                    styles.confirmBtn,
                    (!selectedSide || phase !== 'playing') && { opacity: 0 },
                    tutorialStep === 'zoom' && { opacity: 0.28 },
                  ]}
                  onPress={handleConfirm}
                  activeOpacity={0.85}
                  disabled={!selectedSide || phase !== 'playing' || tutorialStep === 'zoom'}
                >
                  <Text style={styles.confirmBtnText}>Confirm  →</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Animated.View>

        {/* ── RESULTS LAYER ───────────────────────────────────── */}
        <Animated.View
          style={[StyleSheet.absoluteFill, styles.resultsLayer, { opacity: resultsOpacity }]}
          pointerEvents={phase === 'results' ? 'box-none' : 'none'}
        >

          {/* Single full-screen ScrollView — everything scrolls together */}
          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={[
              styles.resultsScrollContent,
              { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 20 },
            ]}
            showsVerticalScrollIndicator={false}
          >
            {/* Verdict — fixed-height container matching playingTop so images
                always sit at the exact same Y as the playing layer. */}
            <View style={styles.resultsVerdictTop}>
              {result && (
                <Animated.View style={[styles.verdictBlock, { opacity: verdictOpacity }]}>
                  <Text style={[styles.verdict, result.was_correct ? styles.verdictCorrect : styles.verdictIncorrect]}>
                    {result.was_correct ? 'Correct!' : 'Fooled!'}
                  </Text>
                  <Text style={styles.subtitle}>
                    {result.was_correct ? 'You spotted the real image.' : 'You picked the AI image.'}
                  </Text>
                </Animated.View>
              )}
            </View>

            {/* Images + fill bars + per-card labels */}
            <View style={styles.imageRow}>
              <View style={styles.imageCardCol}>
                <View style={[styles.imageWrapper, tappedSide === 'left' && { borderColor: result?.was_correct ? colors.correct : colors.incorrect }]}>
                  {task && <Image source={{ uri: leftUrl }} style={styles.image} resizeMode="cover" />}
                  <Animated.View style={[StyleSheet.absoluteFillObject, { backgroundColor: leftFillColor, transform: [{ translateY: leftFillTranslateY }, { scaleY: leftFillAnim }] }]} />
                </View>
                {result && (
                  <Animated.View style={[styles.cardLabel, { opacity: labelsOpacity }]}>
                    <View style={[styles.cardBadge, { backgroundColor: leftColor }]}>
                      <Feather name={leftIsReal ? 'check' : 'x'} size={13} color="#FFF" />
                    </View>
                    <Text style={[styles.cardPct, { color: leftColor }]}>{leftPctDisplay}%</Text>
                    <Text style={styles.cardTag}>{leftIsReal ? 'REAL' : 'AI'}</Text>
                  </Animated.View>
                )}
              </View>

              <View style={styles.imageCardCol}>
                <View style={[styles.imageWrapper, tappedSide === 'right' && { borderColor: result?.was_correct ? colors.correct : colors.incorrect }]}>
                  {task && <Image source={{ uri: rightUrl }} style={styles.image} resizeMode="cover" />}
                  <Animated.View style={[StyleSheet.absoluteFillObject, { backgroundColor: rightFillColor, transform: [{ translateY: rightFillTranslateY }, { scaleY: rightFillAnim }] }]} />
                </View>
                {result && (
                  <Animated.View style={[styles.cardLabel, { opacity: labelsOpacity }]}>
                    <View style={[styles.cardBadge, { backgroundColor: rightColor }]}>
                      <Feather name={!leftIsReal ? 'check' : 'x'} size={13} color="#FFF" />
                    </View>
                    <Text style={[styles.cardPct, { color: rightColor }]}>{rightPctDisplay}%</Text>
                    <Text style={styles.cardTag}>{!leftIsReal ? 'REAL' : 'AI'}</Text>
                  </Animated.View>
                )}
              </View>
            </View>

            {result && (
              tutorialStep === 'tells' ? (
                <Animated.View style={[styles.tutorialVotesBox, { marginTop: 14, opacity: bottomOpacity }]}>
                  <Animated.View style={[StyleSheet.absoluteFillObject, styles.tutorialVotesBorder, { opacity: tellsPulse }]} pointerEvents="none" />
                  <Text style={styles.totalVotes}>{result.total_votes.toLocaleString()} total votes</Text>
                  <Text style={styles.tutorialVotesHint}>This shows how all players voted</Text>
                </Animated.View>
              ) : (
                <Animated.Text style={[styles.totalVotes, { marginTop: 14, opacity: bottomOpacity }]}>
                  {result.total_votes.toLocaleString()} total votes
                </Animated.Text>
              )
            )}

            {/* Tells + next pair */}
            {result && (
              <Animated.View style={[styles.bottomContent, { marginTop: 14, opacity: bottomOpacity }]}>
                {tutorialStep === 'tells' && (
                  <Text style={styles.tutorialTellsPrompt}>Tap any tell below to explore it</Text>
                )}

                {/* Side-by-side action row */}
                <View style={styles.actionRow}>
                  <TouchableOpacity style={styles.tellsBtn} onPress={() => { light(); setShowTells(v => !v); }}>
                    <Text style={styles.tellsBtnText}>{showTells ? '▲  Hide tells' : '▼  See the tells'}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.nextBtn, tutorialStep === 'tells' && { opacity: 0.3 }]}
                    onPress={handleNextCard}
                    disabled={tutorialStep === 'tells'}
                  >
                    <Text style={styles.nextBtnText}>Next Pair  →</Text>
                  </TouchableOpacity>
                </View>

                {/* Tells section: outer collapses to height 0 (not unmounted) so the
                    Image stays mounted and fully decoded — no flash when opening. */}
                <View style={[styles.tellsSection, !showTells && styles.collapsedTells]}>
                  {showTells && <Text style={styles.tellsHeading}>The AI image</Text>}

                  <View
                    style={styles.aiImageWrapper}
                    onLayout={e => { const l = e.nativeEvent.layout; if (l.width > 0) setAiLayout(l); }}
                  >
                    <Image
                      source={{ uri: task?.ai_image_url }}
                      style={styles.aiImage}
                      resizeMode="cover"
                      onLoad={e => {
                        const { width, height } = e.nativeEvent.source;
                        setAiNaturalSize({ width, height });
                      }}
                    />
                    {showTells && aiLayout.width > 0 && aiLayout.height > 0 && aiNaturalSize.width > 0 && tells.map((tell, i) => {
                        if (tell.x == null || tell.y == null) return null;
                        // tell.x/y are fractions of the natural image. Convert to display
                        // coordinates by accounting for resizeMode="cover" crop/scale.
                        const scale   = Math.max(aiLayout.width / aiNaturalSize.width, aiLayout.height / aiNaturalSize.height);
                        const offsetX = (aiNaturalSize.width  * scale - aiLayout.width)  / 2;
                        const offsetY = (aiNaturalSize.height * scale - aiLayout.height) / 2;
                        const r  = Math.max(26, (tell.radius ?? 0.09) * aiLayout.width);
                        const cx = tell.x * aiNaturalSize.width  * scale - offsetX;
                        const cy = tell.y * aiNaturalSize.height * scale - offsetY;
                        const opacity      = shimmerAnims[i].interpolate({ inputRange: [0, 1], outputRange: [0.45, 1.0] });
                        const shimmerScale = shimmerAnims[i].interpolate({ inputRange: [0, 1], outputRange: [0.93, 1.07] });
                        return (
                          <TouchableOpacity
                            key={i}
                            style={[styles.highlight, { left: cx - r, top: cy - r, width: r * 2, height: r * 2, borderRadius: r }]}
                            onPress={() => openTell(tell)}
                            activeOpacity={0.75}
                          >
                            <Animated.View style={[styles.highlightFill, { borderRadius: r, opacity, transform: [{ scale: shimmerScale }] }]} />
                            <Animated.View style={[styles.highlightRing, { borderRadius: r, opacity }]} />
                            <Text style={styles.highlightNum}>{i + 1}</Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>

                    {showTells && <Text style={styles.tellsSubheading}>The Tells</Text>}
                    {showTells && tells.map((tell, i) => (
                      <TouchableOpacity
                        key={i}
                        style={styles.tellItem}
                        onPress={() => {
                          if (tutorialStep === 'tells') advanceTutorial();
                          if (tell.x != null) openTell(tell);
                        }}
                        activeOpacity={0.72}
                      >
                        {tutorialStep === 'tells' && (
                          <Animated.View
                            pointerEvents="none"
                            style={{
                              ...StyleSheet.absoluteFillObject,
                              borderRadius: radius.md,
                              borderWidth: 1.5,
                              borderColor: '#fff',
                              opacity: tellsPulse,
                            }}
                          />
                        )}
                        <View style={styles.tellItemHeader}>
                          <View style={styles.tellBadge}>
                            <Text style={styles.tellBadgeNum}>{i + 1}</Text>
                          </View>
                          <Text style={styles.tellLabel}>{tell.label}</Text>
                        </View>
                        <Text style={styles.tellDescription}>{tell.description}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
              </Animated.View>
            )}
          </ScrollView>
        </Animated.View>

      {/* ── TUTORIAL OVERLAY ── above game layers, below inspect/zoom modals ── */}
      <TutorialOverlay
        step={
          tutorialStep === 'cinematic' ? 'cinematic' :
          tutorialStep === 'pick' && phase === 'playing' ? 'pick' :
          tutorialStep === 'zoom' ? 'zoom' :
          null
        }
        onAdvance={advanceTutorial}
        selectedSide={selectedSide}
      />

      {/* ── ZOOM OVERLAY ─ always in native layer so image stays GPU-composited ── */}
      <View
        style={[StyleSheet.absoluteFillObject, styles.modalContainer, { paddingTop: insets.top, opacity: zoomTell ? 1 : 0.001 }]}
        pointerEvents={zoomTell ? 'auto' : 'none'}
      >
        <View style={styles.modalHeader}>
          <TouchableOpacity onPress={() => { light(); setZoomTell(null); }} style={styles.modalCloseBtn}>
            <Feather name="x" size={22} color={colors.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.modalTitle} numberOfLines={1}>{zoomTellRef.current?.label}</Text>
          <View style={{ width: 44 }} />
        </View>

        {/* Pinch/pan/double-tap. openTell() seeds the transform on the tell before
            this becomes visible, so it opens already framed on the highlight. */}
        <GestureDetector gesture={tellGesture}>
          <View style={styles.modalImageArea} collapsable={false}>
            <Animated.Image
              source={{ uri: task?.ai_image_url }}
              style={[styles.modalImage, {
                transform: [
                  { translateX: tellTX },
                  { translateY: tellTY },
                  { scale: tellScale },
                ],
              }]}
              resizeMode="cover"
            />
          </View>
        </GestureDetector>

        <View style={[styles.modalFooter, { paddingBottom: insets.bottom + 32 }]}>
          <Text style={styles.modalDescription}>{zoomTellRef.current?.description}</Text>
          <TouchableOpacity style={styles.modalDoneBtn} onPress={() => { light(); setZoomTell(null); }}>
            <Text style={styles.modalDoneText}>Done</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* ── INSPECT OVERLAY ── RNGH pinch/pan/double-tap.
           Both images always mounted (source never changes = no flash on open).
           Gesture state in Animated.Values + refs; reset via .setValue() on open. ── */}
      <View
        style={[StyleSheet.absoluteFillObject, { backgroundColor: colors.bg, opacity: inspectSide ? 1 : 0.001 }]}
        pointerEvents={inspectSide ? 'auto' : 'none'}
      >
        <View style={[styles.modalHeader, { paddingTop: insets.top + 8 }]}>
          <TouchableOpacity onPress={closeInspect} style={styles.modalCloseBtn}>
            <Feather name="x" size={22} color={colors.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.modalTitle}>Inspect</Text>
          <View style={{ width: 44 }} />
        </View>

        <GestureDetector gesture={inspectGesture}>
          <View
            style={{ flex: 1, overflow: 'hidden' }}
            collapsable={false}
            onLayout={e => { const h = e.nativeEvent.layout.height; if (h > 0) _iAreaH.current = h; }}
          >
            {/* Two always-mounted images — source never changes, so no flash when
                switching sides. Only opacity toggles (0/1) per active side. */}
            {(['left', 'right']).map(side => (
              <Animated.Image
                key={side}
                source={{ uri: side === 'left' ? leftUrl : rightUrl }}
                style={[
                  StyleSheet.absoluteFillObject,
                  {
                    opacity: inspectSide === side ? 1 : 0,
                    transform: [{ translateX: inspectTransX }, { translateY: inspectTransY }, { scale: inspectScale }],
                  },
                ]}
                resizeMode="contain"
              />
            ))}
          </View>
        </GestureDetector>

        <View style={[styles.inspectFooter, { paddingBottom: insets.bottom + 16 }]}>
          <TouchableOpacity style={styles.modalDoneBtn} onPress={closeInspect}>
            <Text style={styles.modalDoneText}>Done</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* ── NEXT CARD PRE-RENDER ─ topmost layer so iOS always composites it
           (never occluded) → textures decoded in GPU memory before transition.
           opacity:0.001 keeps it invisible while still forcing compositing. ── */}
      {nextTask && (
        <View
          style={{ position: 'absolute', width: CARD_W, height: CARD_H, opacity: 0.001 }}
          pointerEvents="none"
        >
          <Image
            source={{ uri: nextLeftIsReal.current ? nextTask.real_image_url : nextTask.ai_image_url }}
            style={StyleSheet.absoluteFillObject}
            resizeMode="cover"
          />
          <Image
            source={{ uri: nextLeftIsReal.current ? nextTask.ai_image_url : nextTask.real_image_url }}
            style={StyleSheet.absoluteFillObject}
            resizeMode="cover"
          />
        </View>
      )}

    </View>
  );

}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },

  // ── Shared layer base ─────────────────────────────────────────
  layer:        { flex: 1 },
  resultsLayer: { backgroundColor: colors.bg },

  // ── Playing layer ─────────────────────────────────────────────
  playingTop:    { height: 164, justifyContent: 'flex-end', paddingBottom: 14 },
  playingBottom: { flex: 1, justifyContent: 'flex-end' },
  prompt:        { fontSize: 23, fontFamily: fonts.semiBold, color: colors.textPrimary, textAlign: 'center', paddingHorizontal: 16 },
  tutorialPrompt: { fontSize: 27, fontFamily: fonts.bold, color: colors.textPrimary, textAlign: 'center', paddingHorizontal: 16 },
  tutorialHint:   { fontSize: 14, fontFamily: fonts.regular, color: 'rgba(255,255,255,0.55)', textAlign: 'center' },
  errorText:     { color: colors.incorrect, fontSize: 16, fontFamily: fonts.medium, textAlign: 'center', paddingHorizontal: 16 },

  // ── Results layer ─────────────────────────────────────────────
  // resultsVerdictTop matches playingTop exactly so imageRow lands at
  // the same Y on both layers — no floating-point centering offset.
  resultsScrollContent: { flexGrow: 1 },
  resultsVerdictTop:    { height: 164, justifyContent: 'flex-end', paddingBottom: 14 },
  verdictBlock:         { alignItems: 'center' },
  verdict:              { fontSize: 54, fontFamily: fonts.bold, textAlign: 'center' },
  verdictCorrect:       { color: colors.correct },
  verdictIncorrect:     { color: colors.incorrect },
  subtitle:             { fontSize: 17, fontFamily: fonts.medium, color: colors.textPrimary, textAlign: 'center', marginTop: 4 },
  bottomContent:        { gap: 12, paddingHorizontal: 16 },

  // ── Image row (same structure both layers) ────────────────────
  imageRow:             { flexDirection: 'row', gap: 10, paddingHorizontal: 16 },
  imageWrapper:         { width: CARD_W, height: CARD_H, borderRadius: radius.lg, overflow: 'hidden', backgroundColor: colors.surface, borderWidth: 3, borderColor: colors.border },
  imageWrapperSelected: { borderColor: colors.textPrimary },
  imageWrapperChosen:   { borderColor: colors.textPrimary },
  image:                { width: '100%', height: '100%' },
  fill:                 { position: 'absolute', bottom: 0, left: 0, right: 0 },
  zoomIconBtn:          { position: 'absolute', top: 8, right: 8, backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 14, padding: 6 },
  confirmContainer:     { paddingHorizontal: 16, paddingBottom: 12 },
  confirmBtn:           { backgroundColor: colors.textPrimary, paddingVertical: 18, borderRadius: radius.pill, alignItems: 'center' },
  confirmBtnText:       { color: colors.bg, fontSize: 17, fontFamily: fonts.bold },
  inspectFooter:        { alignItems: 'center', paddingTop: 16 },

  // ── Per-card labels (anchored below each image) ───────────────
  imageCardCol: { alignItems: 'center', gap: 10 },
  cardLabel:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 },
  cardBadge:    { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  cardPct:      { fontSize: 22, fontFamily: fonts.bold },
  cardTag:      { fontSize: 15, fontFamily: fonts.semiBold, color: colors.textPrimary, letterSpacing: 1.5 },

  // ── Bottom content (inside results ScrollView) ────────────────
  totalVotes:    { fontSize: 12, fontFamily: fonts.regular, color: colors.textSecondary, textAlign: 'center' },
  actionRow:     { flexDirection: 'row', gap: 10 },
  tellsBtn:      { flex: 1, paddingVertical: 15, borderWidth: 2, borderColor: '#555', borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  tellsBtnText:  { fontSize: 14, fontFamily: fonts.semiBold, color: colors.textPrimary },

  // ── Tells section ─────────────────────────────────────────────
  collapsedTells:  { height: 0, overflow: 'hidden' },
  tellsSection:    { gap: 12 },
  tellsHeading:    { fontSize: 18, fontFamily: fonts.bold, color: colors.textPrimary, textAlign: 'center' },
  aiImageWrapper:  { width: '100%', aspectRatio: 0.9, borderRadius: radius.lg, overflow: 'hidden' },
  aiImage:         { width: '100%', height: '100%' },
  highlight:       { position: 'absolute', alignItems: 'center', justifyContent: 'center' },
  highlightFill:   { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(255,255,255,0.18)' },
  highlightRing:   { ...StyleSheet.absoluteFillObject, borderWidth: 2, borderColor: 'rgba(255,255,255,0.85)' },
  highlightNum:    { fontSize: 13, fontFamily: fonts.bold, color: '#FFF', textShadowColor: 'rgba(0,0,0,0.7)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 4 },
  tellsSubheading: { fontSize: 18, fontFamily: fonts.bold, color: colors.textPrimary, textAlign: 'center' },
  tellItem:        { backgroundColor: colors.surface, borderRadius: radius.md, padding: 16, gap: 5 },
  tellItemHeader:  { flexDirection: 'row', alignItems: 'center', gap: 10 },
  tellBadge:       { width: 24, height: 24, borderRadius: 12, backgroundColor: colors.surface2, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  tellBadgeNum:    { fontSize: 12, fontFamily: fonts.bold, color: colors.textSecondary },
  tellLabel:       { fontSize: 17, fontFamily: fonts.bold, color: colors.textPrimary, flex: 1 },
  tellDescription: { fontSize: 13, fontFamily: fonts.regular, color: colors.textSecondary, lineHeight: 20, paddingLeft: 34 },

  nextBtn:     { flex: 1, backgroundColor: colors.textPrimary, paddingVertical: 18, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  nextBtnText: { color: colors.bg, fontSize: 17, fontFamily: fonts.bold },

  tutorialTellsPrompt: { fontSize: 14, fontFamily: fonts.medium, color: 'rgba(255,255,255,0.55)', textAlign: 'center' },
  tutorialVotesBox:    { alignSelf: 'center', paddingVertical: 10, paddingHorizontal: 22, borderRadius: 20, alignItems: 'center', gap: 2 },
  tutorialVotesBorder: { borderRadius: 20, borderWidth: 1.5, borderColor: '#fff' },
  tutorialVotesHint:   { fontSize: 11, fontFamily: fonts.regular, color: 'rgba(255,255,255,0.45)', textAlign: 'center', marginTop: 2 },

  // ── Zoom modal ────────────────────────────────────────────────
  modalContainer:   { flex: 1, backgroundColor: '#000' },
  modalHeader:      { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 8, gap: 8 },
  modalCloseBtn:    { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  modalTitle:       { flex: 1, fontSize: 17, fontFamily: fonts.bold, color: colors.textPrimary, textAlign: 'center' },
  modalImageArea:   { width: SW, height: MODAL_IMG_H, overflow: 'hidden', alignSelf: 'center' },
  modalImage:       { width: SW, height: MODAL_IMG_H },
  modalFooter:      { flex: 1, justifyContent: 'flex-end', alignItems: 'center', paddingHorizontal: 32, gap: 20 },
  modalDescription: { fontSize: 18, fontFamily: fonts.regular, color: colors.textPrimary, lineHeight: 27, textAlign: 'center' },
  modalDoneBtn:     { backgroundColor: colors.surface, paddingVertical: 14, paddingHorizontal: 40, borderRadius: radius.pill },
  modalDoneText:    { fontSize: 15, fontFamily: fonts.semiBold, color: colors.textPrimary },
});
