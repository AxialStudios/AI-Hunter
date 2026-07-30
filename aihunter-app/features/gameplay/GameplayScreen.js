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

const { width: SW } = Dimensions.get('window');
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
  const [zoomTell,  setZoomTell]  = useState(null);
  const zoomTellRef = useRef(null); // locked coords — never null while modal is visible
  const [aiLayout,  setAiLayout]  = useState({ width: 0, height: 0 });

  // Increment on every fetchTask so images always remount even if task.id repeats
  const cardKey        = useRef(0);
  const loadCount      = useRef(0);
  const playingOpacity = useRef(new Animated.Value(1)).current;
  const resultsOpacity = useRef(new Animated.Value(0)).current;
  const fadeAnim       = useRef(new Animated.Value(0)).current;
  const leftFillAnim   = useRef(new Animated.Value(0)).current;
  const rightFillAnim  = useRef(new Animated.Value(0)).current;
  const shimmerAnims   = useRef(Array.from({ length: 5 }, () => new Animated.Value(0))).current;

  useFocusEffect(useCallback(() => { fetchTask(); }, []));

  async function fetchTask() {
    setPhase('loading');
    setLoadError(null);
    setResult(null);
    setVoting(false);
    setTappedSide(null);
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

  async function handleTap(tappedLeft) {
    if (voting || phase !== 'playing') return;
    medium();
    setTappedSide(tappedLeft ? 'left' : 'right');
    setVoting(true);

    const tappedReal       = tappedLeft === leftIsReal;
    const chose_ai         = tappedReal;
    const response_time_ms = Date.now() - startTime.current;

    const { data, error: voteErr } = await supabase.rpc('record_vote', {
      p_task_id: task.id, p_user_id: user.id,
      p_chose_ai: chose_ai, p_response_time_ms: response_time_ms,
    });

    if (voteErr) { console.error('Vote error:', voteErr.message); setVoting(false); setTappedSide(null); return; }

    data.was_correct ? success() : hapticError();
    setResult(data);
    revealResults(data);
  }

  function revealResults(data) {
    const leftPct  = leftIsReal ? data.real_pct : data.ai_pct;
    const rightPct = leftIsReal ? data.ai_pct   : data.real_pct;

    setPhase('results');
    prefetchNextTask(supabase);

    Animated.timing(playingOpacity, { toValue: 0, duration: 150, useNativeDriver: true }).start();
    Animated.timing(resultsOpacity, { toValue: 1, duration: 150, useNativeDriver: true }).start();

    setTimeout(() => {
      Animated.parallel([
        Animated.timing(leftFillAnim,  { toValue: CARD_H * leftPct  / 100, duration: 700, useNativeDriver: false }),
        Animated.timing(rightFillAnim, { toValue: CARD_H * rightPct / 100, duration: 700, useNativeDriver: false }),
      ]).start();
    }, 200);
  }

  function handleNextCard() {
    light();
    setShowTells(false);
    setZoomTell(null);
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
          <View style={[styles.layer, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
            {/* Prompt + images centered together as one unit */}
            <View style={styles.playingBody}>
              {phase === 'loading' && !task ? (
                <ActivityIndicator color={colors.textPrimary} />
              ) : loadError ? (
                <Text style={styles.errorText}>{loadError}</Text>
              ) : (
                <Text style={styles.prompt}>Tap the real image</Text>
              )}
              <View style={styles.imageRow}>
                <TouchableOpacity
                  style={styles.imageWrapper}
                  onPress={() => handleTap(true)}
                  disabled={voting}
                  activeOpacity={0.9}
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

                <TouchableOpacity
                  style={styles.imageWrapper}
                  onPress={() => handleTap(false)}
                  disabled={voting}
                  activeOpacity={0.9}
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
            {/* Verdict */}
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

            {/* Images + fill bars */}
            <View style={styles.imageRow}>
              <View style={[styles.imageWrapper, tappedSide === 'left' && styles.imageWrapperSelected]}>
                {task && (
                  <Image source={{ uri: leftUrl }} style={styles.image} resizeMode="cover" />
                )}
                <Animated.View style={[styles.fill, { height: leftFillAnim, backgroundColor: leftFillColor }]} />
              </View>

              <View style={[styles.imageWrapper, tappedSide === 'right' && styles.imageWrapperSelected]}>
                {task && (
                  <Image source={{ uri: rightUrl }} style={styles.image} resizeMode="cover" />
                )}
                <Animated.View style={[styles.fill, { height: rightFillAnim, backgroundColor: rightFillColor }]} />
              </View>
            </View>

            {/* Total votes label + pct badges */}
            {result && (
              <Text style={styles.totalVotes}>{result.total_votes.toLocaleString()} total votes</Text>
            )}
            {result && (
              <View style={styles.pctRow}>
                <View style={styles.pctSide}>
                  <View style={[styles.symbolBadge, { backgroundColor: leftColor }]}>
                    <Feather name={leftIsReal ? 'check' : 'x'} size={16} color="#FFF" />
                  </View>
                  <Text style={[styles.pctNumber, { color: leftColor }]}>{leftPct}%</Text>
                  <Text style={styles.pctTag}>{leftIsReal ? 'REAL' : 'AI'}</Text>
                </View>
                <View style={styles.pctSide}>
                  <View style={[styles.symbolBadge, { backgroundColor: rightColor }]}>
                    <Feather name={!leftIsReal ? 'check' : 'x'} size={16} color="#FFF" />
                  </View>
                  <Text style={[styles.pctNumber, { color: rightColor }]}>{rightPct}%</Text>
                  <Text style={styles.pctTag}>{!leftIsReal ? 'REAL' : 'AI'}</Text>
                </View>
              </View>
            )}

            {/* Tells + next pair */}
            {result && (
              <View style={styles.bottomContent}>
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
                    <Image source={{ uri: task?.ai_image_url }} style={styles.aiImage} resizeMode="cover" />
                    {showTells && aiLayout.width > 0 && aiLayout.height > 0 && tells.map((tell, i) => {
                        if (tell.x == null || tell.y == null) return null;
                        const r  = Math.max(26, (tell.radius ?? 0.09) * aiLayout.width);
                        const cx = tell.x * aiLayout.width;
                        const cy = tell.y * aiLayout.height;
                        const opacity = shimmerAnims[i].interpolate({ inputRange: [0, 1], outputRange: [0.3, 0.9] });
                        const scale   = shimmerAnims[i].interpolate({ inputRange: [0, 1], outputRange: [0.88, 1.10] });
                        return (
                          <TouchableOpacity
                            key={i}
                            style={[styles.highlight, { left: cx - r, top: cy - r, width: r * 2, height: r * 2, borderRadius: r }]}
                            onPress={() => { light(); zoomTellRef.current = tell; setZoomTell(tell); }}
                            activeOpacity={0.75}
                          >
                            <Animated.View style={[styles.highlightFill, { borderRadius: r, opacity, transform: [{ scale }] }]} />
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

    </View>
  );

}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },

  // ── Shared layer base ─────────────────────────────────────────
  layer:        { flex: 1 },
  resultsLayer: { backgroundColor: colors.bg },

  // ── Playing layer ─────────────────────────────────────────────
  playingBody:   { flex: 1, justifyContent: 'center', gap: 28 },
  prompt:        { fontSize: 23, fontFamily: fonts.semiBold, color: colors.textPrimary, textAlign: 'center', paddingHorizontal: 16 },
  errorText:     { color: colors.incorrect, fontSize: 16, fontFamily: fonts.medium, textAlign: 'center', paddingHorizontal: 16 },

  // ── Results layer ─────────────────────────────────────────────
  // Single ScrollView wrapping all results content.
  // flexGrow:1 + justifyContent:'center' = centered when short, scrollable when tells expand.
  resultsScrollContent: { flexGrow: 1, justifyContent: 'center', gap: 14 },
  verdictBlock:         { alignItems: 'center' },
  verdict:              { fontSize: 40, fontFamily: fonts.bold, textAlign: 'center' },
  verdictCorrect:       { color: colors.correct },
  verdictIncorrect:     { color: colors.incorrect },
  subtitle:             { fontSize: 14, fontFamily: fonts.medium, color: colors.textPrimary, textAlign: 'center', marginTop: 4 },
  bottomContent:        { gap: 12, paddingHorizontal: 16 },

  // ── Image row (same structure both layers) ────────────────────
  imageRow:             { flexDirection: 'row', gap: 10, paddingHorizontal: 16 },
  imageWrapper:         { width: CARD_W, height: CARD_H, borderRadius: radius.lg, overflow: 'hidden', backgroundColor: colors.surface, borderWidth: 3, borderColor: 'transparent' },
  imageWrapperSelected: { borderColor: colors.textPrimary },
  image:                { width: '100%', height: '100%' },
  fill:                 { position: 'absolute', bottom: 0, left: 0, right: 0 },

  // ── Pct badges ────────────────────────────────────────────────
  pctRow:      { flexDirection: 'row', paddingHorizontal: 16, marginTop: -5 },
  pctSide:     { flex: 1, alignItems: 'center', gap: 2 },
  symbolBadge: { width: 30, height: 30, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center' },
  pctNumber:   { fontSize: 20, fontFamily: fonts.bold, marginTop: 2 },
  pctTag:      { fontSize: 11, fontFamily: fonts.semiBold, color: colors.textPrimary, letterSpacing: 1.5 },

  // ── Bottom content (inside results ScrollView) ────────────────
  totalVotes:    { fontSize: 12, fontFamily: fonts.regular, color: colors.textSecondary, textAlign: 'center' },
  actionRow:     { flexDirection: 'row', gap: 10 },
  tellsBtn:      { flex: 1, paddingVertical: 15, borderWidth: 1.5, borderColor: colors.border, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  tellsBtnText:  { fontSize: 14, fontFamily: fonts.semiBold, color: colors.textSecondary },

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
