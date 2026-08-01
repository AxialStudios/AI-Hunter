import { useState, useRef, useCallback, useEffect } from 'react';
import {
  View, Text, Image, Animated, TouchableOpacity,
  ScrollView, StyleSheet, Dimensions, ActivityIndicator, PanResponder,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { supabase } from '../../lib/supabase';
import { consumeCachedTask, prefetchNextTask } from '../../lib/taskCache';
import { useAuth } from '../../context/AuthContext';
import { useHaptics } from '../../context/HapticsContext';
import { colors, fonts, radius } from '../../constants/theme';

const { width: SW, height: SH } = Dimensions.get('window');
const CARD_W = Math.floor((SW - 32 - 10) / 2);
const CARD_H = Math.floor(CARD_W / 0.5);

const MODAL_ZOOM  = 2.5;
const MODAL_IMG_H = Math.floor(SW / 0.9);

const CORRECT_FILL   = 'rgba(34,197,94,0.72)';
const INCORRECT_FILL = 'rgba(239,68,68,0.72)';

export default function GameplayScreen() {
  const { user }                                        = useAuth();
  const { medium, success, error: hapticError, light } = useHaptics();
  const insets = useSafeAreaInsets();

  const [phase, setPhase]           = useState('loading');
  const [task, setTask]             = useState(null);
  const [leftIsReal, setLeftIsReal] = useState(true);
  const [voting, setVoting]         = useState(false);
  const [tappedSide, setTappedSide] = useState(null);
  const [result, setResult]         = useState(null);
  const [loadError, setLoadError]   = useState(null);
  const startTime                   = useRef(Date.now());

  const [showTells, setShowTells] = useState(false);
  const [zoomTell,    setZoomTell]    = useState(null);
  const zoomTellRef   = useRef(null);
  const [selectedSide, setSelectedSide] = useState(null); // 'left' | 'right' — pre-confirm pick
  const [inspectSide,  setInspectSide]  = useState(null); // 'left' | 'right' — full-screen zoom
  const [aiLayout,      setAiLayout]      = useState({ width: 0, height: 0 });
  const [aiNaturalSize, setAiNaturalSize] = useState({ width: 0, height: 0 });

  // Inspect pinch-to-zoom: Animated values driven directly by PanResponder.
  // Reset via .setValue() on close — no iOS UIScrollView state to fight.
  const inspectScale  = useRef(new Animated.Value(1)).current;
  const inspectTransX = useRef(new Animated.Value(0)).current;
  const inspectTransY = useRef(new Animated.Value(0)).current;
  const _iBaseScale      = useRef(1);
  const _iBaseTX         = useRef(0);
  const _iBaseTY         = useRef(0);
  const _iPinchStartDist = useRef(1);
  const _iPinchBaseSc    = useRef(1);
  const _iPanStartX      = useRef(0);
  const _iPanStartY      = useRef(0);
  const _iNumTouches     = useRef(0);
  const _iAreaH          = useRef(SH); // updated by onLayout; used for Y-axis clamp

  const inspectPanResponder = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder:  () => true,

    onPanResponderGrant: (e) => {
      // Stop any running spring so we anchor from the actual current position
      inspectScale.stopAnimation();
      inspectTransX.stopAnimation();
      inspectTransY.stopAnimation();
      _iBaseScale.current = inspectScale.__getValue();
      _iBaseTX.current    = inspectTransX.__getValue();
      _iBaseTY.current    = inspectTransY.__getValue();

      const t = e.nativeEvent.touches;
      _iNumTouches.current = t.length;
      if (t.length >= 2) {
        const dx = t[0].pageX - t[1].pageX;
        const dy = t[0].pageY - t[1].pageY;
        _iPinchStartDist.current = Math.sqrt(dx * dx + dy * dy) || 1;
        _iPinchBaseSc.current    = _iBaseScale.current;
        _iPanStartX.current = (t[0].pageX + t[1].pageX) / 2;
        _iPanStartY.current = (t[0].pageY + t[1].pageY) / 2;
      } else {
        _iPanStartX.current = t[0].pageX;
        _iPanStartY.current = t[0].pageY;
      }
    },

    onPanResponderMove: (e) => {
      const t = e.nativeEvent.touches;

      if (t.length >= 2) {
        // Re-anchor when finger count changes mid-gesture
        if (_iNumTouches.current !== t.length) {
          const dx = t[0].pageX - t[1].pageX;
          const dy = t[0].pageY - t[1].pageY;
          _iPinchStartDist.current = Math.sqrt(dx * dx + dy * dy) || 1;
          const cur = inspectScale.__getValue();
          _iPinchBaseSc.current = cur;
          _iBaseScale.current   = cur;
          _iBaseTX.current      = inspectTransX.__getValue();
          _iBaseTY.current      = inspectTransY.__getValue();
          _iPanStartX.current = (t[0].pageX + t[1].pageX) / 2;
          _iPanStartY.current = (t[0].pageY + t[1].pageY) / 2;
          _iNumTouches.current = t.length;
          return;
        }

        const dx   = t[0].pageX - t[1].pageX;
        const dy   = t[0].pageY - t[1].pageY;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        const newS = Math.max(1, Math.min(4, _iPinchBaseSc.current * (dist / _iPinchStartDist.current)));
        inspectScale.setValue(newS);

        // translateX/Y are in pre-scale space; screen-space delta / newS → 1:1 apparent movement.
        // Formula: newTX = (baseTX * baseSc + screenDelta) / newS
        const midX = (t[0].pageX + t[1].pageX) / 2;
        const midY = (t[0].pageY + t[1].pageY) / 2;
        const rawTX = (_iBaseTX.current * _iPinchBaseSc.current + midX - _iPanStartX.current) / newS;
        const rawTY = (_iBaseTY.current * _iPinchBaseSc.current + midY - _iPanStartY.current) / newS;
        // Clamp: keep image covering the view at all zoom levels.
        // At newS=1 this collapses to ±0, forcing centre; at newS=4 allows ±3/8 of dim.
        const maxTX = SW / 2 * (1 - 1 / newS);
        const maxTY = _iAreaH.current / 2 * (1 - 1 / newS);
        inspectTransX.setValue(Math.max(-maxTX, Math.min(maxTX, rawTX)));
        inspectTransY.setValue(Math.max(-maxTY, Math.min(maxTY, rawTY)));

      } else if (t.length === 1) {
        if (_iNumTouches.current !== 1) {
          const cur = inspectScale.__getValue();
          _iBaseScale.current = cur;
          _iBaseTX.current    = inspectTransX.__getValue();
          _iBaseTY.current    = inspectTransY.__getValue();
          _iPanStartX.current = t[0].pageX;
          _iPanStartY.current = t[0].pageY;
          _iNumTouches.current = 1;
          return;
        }
        // Divide screen-space delta by scale so 1px of finger = 1px apparent movement.
        const s    = _iBaseScale.current;
        const rawTX = _iBaseTX.current + (t[0].pageX - _iPanStartX.current) / s;
        const rawTY = _iBaseTY.current + (t[0].pageY - _iPanStartY.current) / s;
        const maxTX = SW / 2 * (1 - 1 / s);
        const maxTY = _iAreaH.current / 2 * (1 - 1 / s);
        inspectTransX.setValue(Math.max(-maxTX, Math.min(maxTX, rawTX)));
        inspectTransY.setValue(Math.max(-maxTY, Math.min(maxTY, rawTY)));
      }

      _iNumTouches.current = t.length;
    },

    onPanResponderRelease: () => {
      _iBaseScale.current = inspectScale.__getValue();
      _iBaseTX.current    = inspectTransX.__getValue();
      _iBaseTY.current    = inspectTransY.__getValue();
      _iNumTouches.current = 0;

      // Snap back to neutral if scale drifted below 1
      if (_iBaseScale.current < 1.05) {
        _iBaseScale.current = 1;
        _iBaseTX.current    = 0;
        _iBaseTY.current    = 0;
        Animated.parallel([
          Animated.spring(inspectScale,  { toValue: 1, useNativeDriver: false }),
          Animated.spring(inspectTransX, { toValue: 0, useNativeDriver: false }),
          Animated.spring(inspectTransY, { toValue: 0, useNativeDriver: false }),
        ]).start();
      }
    },

    onPanResponderTerminate: () => { _iNumTouches.current = 0; },
  })).current;
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
  const shimmerAnims   = useRef(Array.from({ length: 5 }, () => new Animated.Value(0))).current;

  useFocusEffect(useCallback(() => { fetchTask(); }, []));

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

  function revealResults(data) {
    const leftPct  = leftIsReal ? data.real_pct : data.ai_pct;
    const rightPct = leftIsReal ? data.ai_pct   : data.real_pct;

    setPhase('results');
    // Prefetch already started in handleImageLoad (when both playing images loaded).
    // Call again here as a fallback for the rare case the user voted before both
    // images finished loading — taskCache deduplicates concurrent calls.
    prefetchNextTask(supabase).then(t => {
      if (t && !nextTask) { nextLeftIsReal.current = Math.random() > 0.5; setNextTask(t); }
    });

    // Delay the native opacity swap by one JS tick so React has time to commit
    // the result state and lay out the results layer correctly before it becomes
    // visible. Without this, resultsOpacity.setValue(1) fires before result is
    // committed — results shows with no content, then jumps when React renders.
    setTimeout(() => {
      playingOpacity.setValue(0);
      resultsOpacity.setValue(1);

      // Fills paint onto the results cards. Native driver — no JS/native sync conflict.
      Animated.parallel([
        Animated.timing(leftFillAnim,  { toValue: leftPct  / 100, duration: 600, useNativeDriver: true }),
        Animated.timing(rightFillAnim, { toValue: rightPct / 100, duration: 600, useNativeDriver: true }),
      ]).start();
    }, 50);
  }

  function openInspect(side) {
    // Reset transforms while the overlay is still invisible (opacity:0.001).
    // Resetting here (not on close) means the overlay hides without any
    // transform snap — closing is just an opacity change, nothing moves.
    inspectScale.setValue(1);
    inspectTransX.setValue(0);
    inspectTransY.setValue(0);
    _iBaseScale.current  = 1;
    _iBaseTX.current     = 0;
    _iBaseTY.current     = 0;
    _iNumTouches.current = 0;
    setInspectSide(side);
  }

  function closeInspect() {
    // Just hide the overlay. Transforms stay wherever they are — the overlay
    // is invisible at opacity:0.001, so no snap/squish flash on close.
    // openInspect() resets them on the next open before anything is visible.
    _iNumTouches.current = 0;
    setInspectSide(null);
  }

  function handleNextCard() {
    light();
    setShowTells(false);
    setZoomTell(null);
    setSelectedSide(null);
    setInspectSide(null);
    setAiNaturalSize({ width: 0, height: 0 });

    Animated.timing(resultsOpacity, { toValue: 0, duration: 150, useNativeDriver: true })
      .start(() => {
        if (nextTask) {
          // Images hidden while source props update in-place (no cardKey change).
          // The pre-render above keeps decoded textures in GPU memory, so
          // onLoadEnd fires in <1 frame and fastTransition snaps fadeAnim to 1.
          fadeAnim.setValue(0);
          leftFillAnim.setValue(0);
          rightFillAnim.setValue(0);
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
        Animated.timing(v, { toValue: 1,   duration: 950, useNativeDriver: true }),
        Animated.timing(v, { toValue: 0.2, duration: 950, useNativeDriver: true }),
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
  const leftPct        = result ? (leftIsReal  ? result.real_pct : result.ai_pct) : 0;
  const rightPct       = result ? (!leftIsReal ? result.real_pct : result.ai_pct) : 0;
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
              {phase === 'loading' && !task ? (
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
                  style={[styles.confirmBtn, (!selectedSide || phase !== 'playing') && { opacity: 0 }]}
                  onPress={handleConfirm}
                  activeOpacity={0.85}
                  disabled={!selectedSide || phase !== 'playing'}
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
                <View style={styles.verdictBlock}>
                  <Text style={[styles.verdict, result.was_correct ? styles.verdictCorrect : styles.verdictIncorrect]}>
                    {result.was_correct ? 'Correct!' : 'Fooled!'}
                  </Text>
                  <Text style={styles.subtitle}>
                    {result.was_correct ? 'You spotted the real image.' : 'You picked the AI image.'}
                  </Text>
                </View>
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
                  <View style={styles.cardLabel}>
                    <View style={[styles.cardBadge, { backgroundColor: leftColor }]}>
                      <Feather name={leftIsReal ? 'check' : 'x'} size={13} color="#FFF" />
                    </View>
                    <Text style={[styles.cardPct, { color: leftColor }]}>{leftPct}%</Text>
                    <Text style={styles.cardTag}>{leftIsReal ? 'REAL' : 'AI'}</Text>
                  </View>
                )}
              </View>

              <View style={styles.imageCardCol}>
                <View style={[styles.imageWrapper, tappedSide === 'right' && { borderColor: result?.was_correct ? colors.correct : colors.incorrect }]}>
                  {task && <Image source={{ uri: rightUrl }} style={styles.image} resizeMode="cover" />}
                  <Animated.View style={[StyleSheet.absoluteFillObject, { backgroundColor: rightFillColor, transform: [{ translateY: rightFillTranslateY }, { scaleY: rightFillAnim }] }]} />
                </View>
                {result && (
                  <View style={styles.cardLabel}>
                    <View style={[styles.cardBadge, { backgroundColor: rightColor }]}>
                      <Feather name={!leftIsReal ? 'check' : 'x'} size={13} color="#FFF" />
                    </View>
                    <Text style={[styles.cardPct, { color: rightColor }]}>{rightPct}%</Text>
                    <Text style={styles.cardTag}>{!leftIsReal ? 'REAL' : 'AI'}</Text>
                  </View>
                )}
              </View>
            </View>

            {result && (
              <Text style={[styles.totalVotes, { marginTop: 14 }]}>{result.total_votes.toLocaleString()} total votes</Text>
            )}

            {/* Tells + next pair */}
            {result && (
              <View style={[styles.bottomContent, { marginTop: 14 }]}>
                {/* Side-by-side action row */}
                <View style={styles.actionRow}>
                  <TouchableOpacity style={styles.tellsBtn} onPress={() => { light(); setShowTells(v => !v); }}>
                    <Text style={styles.tellsBtnText}>{showTells ? '▲  Hide tells' : '▼  See the tells'}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.nextBtn} onPress={handleNextCard}>
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
                        const opacity      = shimmerAnims[i].interpolate({ inputRange: [0, 1], outputRange: [0.3, 0.9] });
                        const shimmerScale = shimmerAnims[i].interpolate({ inputRange: [0, 1], outputRange: [0.88, 1.10] });
                        return (
                          <TouchableOpacity
                            key={i}
                            style={[styles.highlight, { left: cx - r, top: cy - r, width: r * 2, height: r * 2, borderRadius: r }]}
                            onPress={() => { light(); zoomTellRef.current = tell; setZoomTell(tell); }}
                            activeOpacity={0.75}
                          >
                            <Animated.View style={[styles.highlightFill, { borderRadius: r, opacity, transform: [{ scale: shimmerScale }] }]} />
                            <Animated.View style={[styles.highlightRing, { borderRadius: r, opacity }]} />
                            <Text style={styles.highlightNum}>{i + 1}</Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>

                    {showTells && <Text style={styles.tellsSubheading}>What to look for</Text>}
                    {showTells && tells.map((tell, i) => (
                      <TouchableOpacity
                        key={i}
                        style={styles.tellItem}
                        onPress={() => tell.x != null && (light(), zoomTellRef.current = tell, setZoomTell(tell))}
                        activeOpacity={tell.x != null ? 0.72 : 1}
                      >
                        <View style={styles.tellItemHeader}>
                          <Text style={styles.tellNum}>{i + 1}</Text>
                          <Text style={styles.tellLabel}>{tell.label}</Text>
                        </View>
                        <Text style={styles.tellDescription}>{tell.description}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
              </View>
            )}
          </ScrollView>
        </Animated.View>

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

        <View style={styles.modalImageArea}>
          <Image
            source={{ uri: task?.ai_image_url }}
            style={[styles.modalImage, {
              transform: (() => {
                const tx = zoomTellRef.current?.x ?? 0.5;
                const ty = zoomTellRef.current?.y ?? 0.5;
                // Convert natural image fractions → display pixel position in
                // the SW×MODAL_IMG_H container, then shift so that pixel lands
                // at screen centre after the MODAL_ZOOM scale.
                if (aiNaturalSize.width > 0) {
                  const ms = Math.max(SW / aiNaturalSize.width, MODAL_IMG_H / aiNaturalSize.height);
                  const ox = (aiNaturalSize.width  * ms - SW) / 2;
                  const oy = (aiNaturalSize.height * ms - MODAL_IMG_H) / 2;
                  const px = tx * aiNaturalSize.width  * ms - ox;
                  const py = ty * aiNaturalSize.height * ms - oy;
                  return [
                    { translateX: -(px - SW / 2) * MODAL_ZOOM },
                    { translateY: -(py - MODAL_IMG_H / 2) * MODAL_ZOOM },
                    { scale: MODAL_ZOOM },
                  ];
                }
                // Fallback before natural size loads
                return [
                  { translateX: -(tx - 0.5) * SW * MODAL_ZOOM },
                  { translateY: -(ty - 0.5) * MODAL_IMG_H * MODAL_ZOOM },
                  { scale: MODAL_ZOOM },
                ];
              })(),
            }]}
            resizeMode="cover"
          />
        </View>

        <View style={[styles.modalFooter, { paddingBottom: insets.bottom + 72 }]}>
          <Text style={styles.modalDescription}>{zoomTellRef.current?.description}</Text>
          <TouchableOpacity style={styles.modalDoneBtn} onPress={() => { light(); setZoomTell(null); }}>
            <Text style={styles.modalDoneText}>Done</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* ── INSPECT OVERLAY ── PanResponder-based pinch-to-zoom.
           Both images always mounted (source never changes = no flash on open).
           Gesture state in Animated.Values + refs; reset via .setValue() on close. ── */}
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

        <View
          style={{ flex: 1, overflow: 'hidden' }}
          onLayout={e => { const h = e.nativeEvent.layout.height; if (h > 0) _iAreaH.current = h; }}
          {...inspectPanResponder.panHandlers}
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
                  transform: [{ scale: inspectScale }, { translateX: inspectTransX }, { translateY: inspectTransY }],
                },
              ]}
              resizeMode="contain"
            />
          ))}
        </View>

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
  tellsSection:    { gap: 20 },
  tellsHeading:    { fontSize: 18, fontFamily: fonts.bold, color: colors.textPrimary, textAlign: 'center' },
  aiImageWrapper:  { width: '100%', aspectRatio: 0.9, borderRadius: radius.lg, overflow: 'hidden' },
  aiImage:         { width: '100%', height: '100%' },
  highlight:       { position: 'absolute', alignItems: 'center', justifyContent: 'center' },
  highlightFill:   { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(255,255,255,0.18)' },
  highlightRing:   { ...StyleSheet.absoluteFillObject, borderWidth: 2, borderColor: 'rgba(255,255,255,0.85)' },
  highlightNum:    { fontSize: 13, fontFamily: fonts.bold, color: '#FFF', textShadowColor: 'rgba(0,0,0,0.7)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 4 },
  tellsSubheading: { fontSize: 14, fontFamily: fonts.bold, color: colors.textPrimary, textTransform: 'uppercase', letterSpacing: 1.5, textAlign: 'center' },
  tellItem:        { gap: 5 },
  tellItemHeader:  { flexDirection: 'row', alignItems: 'center', gap: 10 },
  tellNum:         { fontSize: 13, fontFamily: fonts.semiBold, color: colors.textSecondary, width: 16, textAlign: 'right' },
  tellLabel:       { fontSize: 17, fontFamily: fonts.bold, color: colors.textPrimary, flex: 1 },
  tellDescription: { fontSize: 14, fontFamily: fonts.regular, color: colors.textSecondary, lineHeight: 21 },

  nextBtn:     { flex: 1, backgroundColor: colors.textPrimary, paddingVertical: 18, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  nextBtnText: { color: colors.bg, fontSize: 17, fontFamily: fonts.bold },

  // ── Zoom modal ────────────────────────────────────────────────
  modalContainer:   { flex: 1, backgroundColor: '#000' },
  modalHeader:      { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 8, gap: 8 },
  modalCloseBtn:    { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  modalTitle:       { flex: 1, fontSize: 17, fontFamily: fonts.bold, color: colors.textPrimary, textAlign: 'center' },
  modalImageArea:   { width: SW, height: MODAL_IMG_H, overflow: 'hidden', alignSelf: 'center' },
  modalImage:       { width: SW, height: MODAL_IMG_H },
  modalFooter:      { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 32, gap: 20 },
  modalDescription: { fontSize: 17, fontFamily: fonts.regular, color: colors.textPrimary, lineHeight: 25, textAlign: 'center' },
  modalDoneBtn:     { backgroundColor: colors.surface, paddingVertical: 14, paddingHorizontal: 40, borderRadius: radius.pill },
  modalDoneText:    { fontSize: 15, fontFamily: fonts.semiBold, color: colors.textPrimary },
});
