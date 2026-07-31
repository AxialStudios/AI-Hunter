import { useState, useRef, useCallback, useEffect } from 'react';
import {
  View, Text, Image, Animated, TouchableOpacity,
  ScrollView, StyleSheet, Dimensions, ActivityIndicator,
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
  const leftScrollRef  = useRef(null);
  const rightScrollRef = useRef(null);
  const [aiLayout,      setAiLayout]      = useState({ width: 0, height: 0 });
  const [aiNaturalSize, setAiNaturalSize] = useState({ width: 0, height: 0 });

  // Increment on every fetchTask so images always remount even if task.id repeats
  const cardKey        = useRef(0);
  const loadCount      = useRef(0);
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
    if (loadCount.current >= 2) {
      Animated.timing(fadeAnim, { toValue: 1, duration: 200, useNativeDriver: true }).start();
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
    prefetchNextTask(supabase);

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

  function closeInspect() {
    const ref = inspectSide === 'left' ? leftScrollRef : rightScrollRef;
    setInspectSide(null);
    // Reset zoom+scroll after the overlay is hidden (opacity:0.001 is instant)
    requestAnimationFrame(() => {
      ref.current?.scrollTo({ x: 0, y: 0, animated: false });
      ref.current?.getScrollResponder()?.scrollResponderZoomTo({
        x: 0, y: 0, width: SW, height: SH, animated: false,
      });
    });
  }

  function handleNextCard() {
    light();
    setShowTells(false);
    setZoomTell(null);
    setSelectedSide(null);
    setInspectSide(null);
    setAiNaturalSize({ width: 0, height: 0 });
    // Only fade out the results layer; playing layer is already at 0
    Animated.timing(resultsOpacity, { toValue: 0, duration: 150, useNativeDriver: true })
      .start(() => fetchTask());
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
                    onPress={() => { light(); setInspectSide('left'); }}
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
                    onPress={() => { light(); setInspectSide('right'); }}
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
                        const r  = Math.max(26, (tell.radius ?? 0.09) * aiNaturalSize.width * scale);
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
                        style={styles.tellCard}
                        onPress={() => tell.x != null && (light(), zoomTellRef.current = tell, setZoomTell(tell))}
                        activeOpacity={tell.x != null ? 0.72 : 1}
                      >
                        <View style={styles.tellCardHeader}>
                          <View style={styles.tellBadge}><Text style={styles.tellBadgeNum}>{i + 1}</Text></View>
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
              transform: [
                { translateX: -((zoomTellRef.current?.x ?? 0.5) - 0.5) * SW * MODAL_ZOOM },
                { translateY: -((zoomTellRef.current?.y ?? 0.5) - 0.5) * MODAL_IMG_H * MODAL_ZOOM },
                { scale: MODAL_ZOOM },
              ],
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

      {/* ── INSPECT OVERLAYS ─ always mounted so images stay GPU-composited (no open flash).
           Zoom/scroll resets imperatively via ref when the overlay is hidden. ── */}
      {(['left', 'right']).map(side => (
        <View
          key={side}
          style={[StyleSheet.absoluteFillObject, { backgroundColor: colors.bg, opacity: inspectSide === side ? 1 : 0.001 }]}
          pointerEvents={inspectSide === side ? 'auto' : 'none'}
        >
          <View style={[styles.modalHeader, { paddingTop: insets.top + 8 }]}>
            <TouchableOpacity onPress={closeInspect} style={styles.modalCloseBtn}>
              <Feather name="x" size={22} color={colors.textPrimary} />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Inspect</Text>
            <View style={{ width: 44 }} />
          </View>
          <ScrollView
            ref={side === 'left' ? leftScrollRef : rightScrollRef}
            style={{ flex: 1 }}
            minimumZoomScale={1}
            maximumZoomScale={4}
            bouncesZoom
            centerContent
            showsHorizontalScrollIndicator={false}
            showsVerticalScrollIndicator={false}
          >
            <Image
              source={{ uri: side === 'left' ? leftUrl : rightUrl }}
              style={{ width: SW, height: SH - insets.top - 56 - insets.bottom - 72 }}
              resizeMode="contain"
            />
          </ScrollView>
          <View style={[styles.inspectFooter, { paddingBottom: insets.bottom + 16 }]}>
            <TouchableOpacity style={styles.modalDoneBtn} onPress={closeInspect}>
              <Text style={styles.modalDoneText}>Done</Text>
            </TouchableOpacity>
          </View>
        </View>
      ))}

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
  tellsSection:    { gap: 12 },
  tellsHeading:    { fontSize: 18, fontFamily: fonts.bold, color: colors.textPrimary, textAlign: 'center' },
  aiImageWrapper:  { width: '100%', aspectRatio: 0.9, borderRadius: radius.lg, overflow: 'hidden' },
  aiImage:         { width: '100%', height: '100%' },
  highlight:       { position: 'absolute', alignItems: 'center', justifyContent: 'center' },
  highlightFill:   { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(255,255,255,0.18)' },
  highlightRing:   { ...StyleSheet.absoluteFillObject, borderWidth: 2, borderColor: 'rgba(255,255,255,0.85)' },
  highlightNum:    { fontSize: 13, fontFamily: fonts.bold, color: '#FFF', textShadowColor: 'rgba(0,0,0,0.7)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 4 },
  tellsSubheading: { fontSize: 13, fontFamily: fonts.bold, color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: 1.5 },
  tellCard:        { backgroundColor: colors.surface, borderRadius: radius.md, padding: 16 },
  tellCardHeader:  { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 6 },
  tellBadge:       { width: 22, height: 22, borderRadius: 11, backgroundColor: colors.surface2, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  tellBadgeNum:    { fontSize: 11, fontFamily: fonts.bold, color: colors.textPrimary },
  tellLabel:       { fontSize: 16, fontFamily: fonts.bold, color: colors.textPrimary, flex: 1 },
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
