import { useState, useRef, useCallback, useEffect } from 'react';
import {
  View, Text, Image, Animated, TouchableOpacity, Modal,
  ScrollView, StyleSheet, Dimensions, ActivityIndicator,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
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
  const { user }                            = useAuth();
  const { medium, success, error: hapticError, light } = useHaptics();
  const insets = useSafeAreaInsets();

  // ── Core state ──────────────────────────────────────────────
  const [phase, setPhase]         = useState('loading'); // 'loading'|'playing'|'results'
  const [task, setTask]           = useState(null);
  const [leftIsReal, setLeftIsReal] = useState(true);
  const [voting, setVoting]       = useState(false);
  const [tappedSide, setTappedSide] = useState(null);  // 'left'|'right'
  const [result, setResult]       = useState(null);
  const [loadError, setLoadError] = useState(null);
  const startTime                 = useRef(Date.now());

  // ── Tells state ─────────────────────────────────────────────
  const [showTells, setShowTells] = useState(false);
  const [zoomTell,  setZoomTell]  = useState(null);
  const [aiLayout,  setAiLayout]  = useState({ width: 0, height: 0 });

  // ── Animations ───────────────────────────────────────────────
  const loadCount      = useRef(0);
  const fadeAnim       = useRef(new Animated.Value(0)).current; // images fade in
  const playingOpacity = useRef(new Animated.Value(1)).current; // playing layer
  const resultsOpacity = useRef(new Animated.Value(0)).current; // results layer
  const leftFillAnim   = useRef(new Animated.Value(0)).current;
  const rightFillAnim  = useRef(new Animated.Value(0)).current;
  // Up to 5 shimmer anims (one per tell annotation)
  const shimmerAnims   = useRef(Array.from({ length: 5 }, () => new Animated.Value(0))).current;

  // ── Fetch ────────────────────────────────────────────────────
  useFocusEffect(useCallback(() => { fetchTask(); }, []));

  async function fetchTask() {
    setPhase('loading');
    setLoadError(null);
    setResult(null);
    setVoting(false);
    setTappedSide(null);
    setShowTells(false);
    loadCount.current = 0;

    // Reset all animations
    fadeAnim.setValue(0);
    playingOpacity.setValue(1);
    resultsOpacity.setValue(0);
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

    if (countErr || !count) {
      setLoadError('Could not load a card.');
      setPhase('playing'); // show error state
      return;
    }

    const randomIndex = Math.floor(Math.random() * count);
    const { data, error: fetchErr } = await supabase
      .from('tasks')
      .select('*')
      .eq('approval_status', 'active')
      .range(randomIndex, randomIndex)
      .single();

    if (fetchErr || !data) {
      setLoadError('Could not load a card.');
      setPhase('playing');
      return;
    }

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

  // ── Vote ─────────────────────────────────────────────────────
  async function handleTap(tappedLeft) {
    if (voting || phase !== 'playing') return;
    medium();
    setTappedSide(tappedLeft ? 'left' : 'right');
    setVoting(true);

    const tappedReal = tappedLeft === leftIsReal;
    const chose_ai   = tappedReal; // RPC: true = correctly identified AI (tapped real)
    const response_time_ms = Date.now() - startTime.current;

    const { data, error: voteErr } = await supabase.rpc('record_vote', {
      p_task_id:          task.id,
      p_user_id:          user.id,
      p_chose_ai:         chose_ai,
      p_response_time_ms: response_time_ms,
    });

    if (voteErr) {
      console.error('Vote error:', voteErr.message);
      setVoting(false);
      setTappedSide(null);
      return;
    }

    data.was_correct ? success() : hapticError();
    setResult(data);
    revealResults(data);
  }

  // ── Results reveal ───────────────────────────────────────────
  function revealResults(data) {
    const { real_pct, ai_pct } = data;
    const leftPct  = leftIsReal ? real_pct : ai_pct;
    const rightPct = leftIsReal ? ai_pct   : real_pct;

    setPhase('results');
    prefetchNextTask(supabase);

    // Crossfade: playing → results
    Animated.parallel([
      Animated.timing(playingOpacity, { toValue: 0, duration: 300, useNativeDriver: true }),
      Animated.timing(resultsOpacity, { toValue: 1, duration: 300, useNativeDriver: true }),
    ]).start(() => {
      // Fills animate after crossfade settles
      Animated.parallel([
        Animated.timing(leftFillAnim,  { toValue: CARD_H * leftPct  / 100, duration: 700, useNativeDriver: false }),
        Animated.timing(rightFillAnim, { toValue: CARD_H * rightPct / 100, duration: 700, useNativeDriver: false }),
      ]).start();
    });
  }

  // ── Next card ────────────────────────────────────────────────
  function handleNextCard() {
    light();
    setShowTells(false);
    setZoomTell(null);
    // Fade out results layer, then reload
    Animated.timing(resultsOpacity, { toValue: 0, duration: 200, useNativeDriver: true })
      .start(() => fetchTask());
  }

  // ── Shimmer for tells ────────────────────────────────────────
  useEffect(() => {
    if (!showTells || !task) {
      shimmerAnims.forEach(v => v.setValue(0));
      return;
    }
    const tells = task.tell_annotations || [];
    const loops = shimmerAnims.slice(0, tells.length).map(v =>
      Animated.loop(
        Animated.sequence([
          Animated.timing(v, { toValue: 1,   duration: 950, useNativeDriver: true }),
          Animated.timing(v, { toValue: 0.2, duration: 950, useNativeDriver: true }),
        ])
      )
    );
    const timers = loops.map((l, i) => setTimeout(() => l.start(), i * 320));
    return () => {
      loops.forEach(l => l.stop());
      timers.forEach(clearTimeout);
      shimmerAnims.forEach(v => v.setValue(0));
    };
  }, [showTells, task]);

  // ── Loading / error ──────────────────────────────────────────
  if (phase === 'loading') {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.textPrimary} />
      </View>
    );
  }

  if (loadError) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>{loadError}</Text>
      </View>
    );
  }

  // ── Derived values ───────────────────────────────────────────
  const leftUrl  = leftIsReal ? task.real_image_url : task.ai_image_url;
  const rightUrl = leftIsReal ? task.ai_image_url   : task.real_image_url;

  const leftFillColor  = leftIsReal  ? CORRECT_FILL   : INCORRECT_FILL;
  const rightFillColor = !leftIsReal ? CORRECT_FILL   : INCORRECT_FILL;
  const leftColor      = leftIsReal  ? colors.correct   : colors.incorrect;
  const rightColor     = !leftIsReal ? colors.correct   : colors.incorrect;

  const leftPct  = result ? (leftIsReal  ? result.real_pct : result.ai_pct) : 0;
  const rightPct = result ? (!leftIsReal ? result.real_pct : result.ai_pct) : 0;

  const tells = task.tell_annotations || [];

  return (
    <>
      <SafeAreaView style={styles.safe}>

        {/* ── PLAYING LAYER (fades out on reveal) ───────────── */}
        <Animated.View
          style={[StyleSheet.absoluteFill, { top: insets.top, bottom: insets.bottom, opacity: playingOpacity }]}
          pointerEvents={phase === 'playing' ? 'box-none' : 'none'}
        >
          <View style={styles.playingLayout}>
            <Text style={styles.prompt}>Tap the real image</Text>

            <View style={styles.imageRow}>
              <TouchableOpacity
                style={[styles.imageWrapper, tappedSide === 'left' && styles.imageWrapperSelected]}
                activeOpacity={voting ? 1 : 0.9}
                onPress={() => handleTap(true)}
                disabled={voting}
              >
                <Animated.Image
                  key={task.id + '-left'}
                  source={{ uri: leftUrl }}
                  style={[styles.image, { opacity: fadeAnim }]}
                  resizeMode="cover"
                  onLoadEnd={handleImageLoad}
                />
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.imageWrapper, tappedSide === 'right' && styles.imageWrapperSelected]}
                activeOpacity={voting ? 1 : 0.9}
                onPress={() => handleTap(false)}
                disabled={voting}
              >
                <Animated.Image
                  key={task.id + '-right'}
                  source={{ uri: rightUrl }}
                  style={[styles.image, { opacity: fadeAnim }]}
                  resizeMode="cover"
                  onLoadEnd={handleImageLoad}
                />
              </TouchableOpacity>
            </View>
          </View>
        </Animated.View>

        {/* ── RESULTS LAYER (fades in on reveal) ────────────── */}
        <Animated.View
          style={[StyleSheet.absoluteFill, { top: insets.top, bottom: insets.bottom, opacity: resultsOpacity }]}
          pointerEvents={phase === 'results' ? 'box-none' : 'none'}
        >
          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={styles.resultsContent}
            showsVerticalScrollIndicator={false}
          >
            {/* Verdict */}
            {result && (
              <>
                <Text style={[styles.verdict, result.was_correct ? styles.verdictCorrect : styles.verdictIncorrect]}>
                  {result.was_correct ? 'Correct!' : 'Fooled!'}
                </Text>
                <Text style={styles.subtitle}>
                  {result.was_correct ? 'You spotted the real image.' : 'You picked the AI image.'}
                </Text>
              </>
            )}

            {/* Pct badges */}
            <View style={styles.pctRow}>
              <View style={styles.pctSide}>
                <View style={[styles.symbolBadge, { backgroundColor: leftColor }]}>
                  <Feather name={leftIsReal ? 'check' : 'x'} size={18} color="#FFFFFF" />
                </View>
                <Text style={[styles.pctNumber, { color: leftColor }]}>{leftPct}%</Text>
                <Text style={styles.pctTag}>{leftIsReal ? 'REAL' : 'AI'}</Text>
              </View>
              <View style={styles.pctSide}>
                <View style={[styles.symbolBadge, { backgroundColor: rightColor }]}>
                  <Feather name={!leftIsReal ? 'check' : 'x'} size={18} color="#FFFFFF" />
                </View>
                <Text style={[styles.pctNumber, { color: rightColor }]}>{rightPct}%</Text>
                <Text style={styles.pctTag}>{!leftIsReal ? 'REAL' : 'AI'}</Text>
              </View>
            </View>

            {/* Images with fill bars (images load from cache instantly) */}
            <View style={styles.imageRow}>
              <View style={[styles.imageWrapper, tappedSide === 'left' && styles.imageWrapperSelected]}>
                <Image source={{ uri: leftUrl }} style={styles.image} resizeMode="cover" />
                <Animated.View style={[styles.fill, { height: leftFillAnim, backgroundColor: leftFillColor }]} />
              </View>
              <View style={[styles.imageWrapper, tappedSide === 'right' && styles.imageWrapperSelected]}>
                <Image source={{ uri: rightUrl }} style={styles.image} resizeMode="cover" />
                <Animated.View style={[styles.fill, { height: rightFillAnim, backgroundColor: rightFillColor }]} />
              </View>
            </View>

            {result && (
              <>
                <Text style={styles.totalVotes}>{result.total_votes.toLocaleString()} total votes</Text>

                {/* Tells toggle */}
                <TouchableOpacity
                  style={styles.tellsBtn}
                  onPress={() => { light(); setShowTells(v => !v); }}
                >
                  <Text style={styles.tellsBtnText}>
                    {showTells ? '▲  Hide tells' : '▼  See the tells'}
                  </Text>
                </TouchableOpacity>

                {showTells && (
                  <View style={styles.tellsSection}>
                    <Text style={styles.tellsHeading}>The AI image</Text>

                    {/* AI image with shimmer highlights */}
                    <View
                      style={styles.aiImageWrapper}
                      onLayout={e => setAiLayout(e.nativeEvent.layout)}
                    >
                      <Image
                        source={{ uri: task.ai_image_url }}
                        style={styles.aiImage}
                        resizeMode="cover"
                      />
                      {aiLayout.width > 0 && tells.map((tell, i) => {
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
                            onPress={() => { light(); setZoomTell(tell); }}
                            activeOpacity={0.75}
                          >
                            <Animated.View style={[styles.highlightFill,   { borderRadius: r, opacity, transform: [{ scale }] }]} />
                            <Animated.View style={[styles.highlightRing,   { borderRadius: r, opacity }]} />
                            <Text style={styles.highlightNum}>{i + 1}</Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>

                    <Text style={styles.tellsSubheading}>What to look for</Text>
                    {tells.map((tell, i) => (
                      <TouchableOpacity
                        key={i}
                        style={styles.tellCard}
                        onPress={() => tell.x != null && (light(), setZoomTell(tell))}
                        activeOpacity={tell.x != null ? 0.72 : 1}
                      >
                        <View style={styles.tellCardHeader}>
                          <View style={styles.tellBadge}>
                            <Text style={styles.tellBadgeNum}>{i + 1}</Text>
                          </View>
                          <Text style={styles.tellLabel}>{tell.label}</Text>
                        </View>
                        <Text style={styles.tellDescription}>{tell.description}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}

                <TouchableOpacity style={styles.nextBtn} onPress={handleNextCard}>
                  <Text style={styles.nextBtnText}>Next Card  →</Text>
                </TouchableOpacity>
              </>
            )}
          </ScrollView>
        </Animated.View>

      </SafeAreaView>

      {/* ── ZOOM MODAL ──────────────────────────────────────── */}
      <Modal
        visible={!!zoomTell}
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() => setZoomTell(null)}
      >
        <View style={styles.modalContainer}>
          <SafeAreaView>
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={() => { light(); setZoomTell(null); }} style={styles.modalCloseBtn}>
                <Feather name="x" size={22} color={colors.textPrimary} />
              </TouchableOpacity>
              <Text style={styles.modalTitle} numberOfLines={1}>{zoomTell?.label}</Text>
              <View style={{ width: 44 }} />
            </View>
          </SafeAreaView>

          {zoomTell && (
            <View style={styles.modalImageArea}>
              <Image
                source={{ uri: task.ai_image_url }}
                style={[styles.modalImage, {
                  transform: [
                    { translateX: -(zoomTell.x - 0.5) * SW * MODAL_ZOOM },
                    { translateY: -(zoomTell.y - 0.5) * MODAL_IMG_H * MODAL_ZOOM },
                    { scale: MODAL_ZOOM },
                  ],
                }]}
                resizeMode="cover"
              />
            </View>
          )}

          <SafeAreaView style={styles.modalFooter}>
            <Text style={styles.modalDescription}>{zoomTell?.description}</Text>
            <TouchableOpacity style={styles.modalDoneBtn} onPress={() => { light(); setZoomTell(null); }}>
              <Text style={styles.modalDoneText}>Done</Text>
            </TouchableOpacity>
          </SafeAreaView>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' },
  errorText: { color: colors.incorrect, fontSize: 16, fontFamily: fonts.medium },

  // Playing layer: vertically centered
  playingLayout: { flex: 1, justifyContent: 'center', padding: 16, gap: 20 },
  prompt: { fontSize: 20, fontFamily: fonts.semiBold, color: colors.textPrimary, textAlign: 'center' },

  // Shared image row
  imageRow:             { flexDirection: 'row', gap: 10 },
  imageWrapper:         { flex: 1, height: CARD_H, borderRadius: radius.lg, overflow: 'hidden', backgroundColor: colors.surface, borderWidth: 3, borderColor: 'transparent' },
  imageWrapperSelected: { borderColor: colors.textPrimary },
  image:                { width: '100%', height: '100%' },
  fill:                 { position: 'absolute', bottom: 0, left: 0, right: 0 },

  // Results layer ScrollView content
  resultsContent: { alignItems: 'center', padding: 24, paddingBottom: 48, gap: 16 },
  verdict:          { fontSize: 44, fontFamily: fonts.bold, textAlign: 'center' },
  verdictCorrect:   { color: colors.correct },
  verdictIncorrect: { color: colors.incorrect },
  subtitle:         { fontSize: 15, fontFamily: fonts.medium, color: colors.textPrimary, textAlign: 'center', marginTop: -8 },

  pctRow:      { flexDirection: 'row', width: '100%', gap: 10 },
  pctSide:     { flex: 1, alignItems: 'center', gap: 2 },
  symbolBadge: { width: 34, height: 34, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center' },
  pctNumber:   { fontSize: 22, fontFamily: fonts.bold, marginTop: 2 },
  pctTag:      { fontSize: 10, fontFamily: fonts.semiBold, color: colors.textTertiary, letterSpacing: 1.5 },

  totalVotes: { fontSize: 12, fontFamily: fonts.regular, color: colors.textSecondary, marginTop: -4 },

  tellsBtn:     { paddingVertical: 12, paddingHorizontal: 28, borderWidth: 1.5, borderColor: colors.border, borderRadius: radius.pill },
  tellsBtnText: { fontSize: 14, fontFamily: fonts.semiBold, color: colors.textSecondary },

  // Tells section
  tellsSection:    { width: '100%', gap: 12 },
  tellsHeading:    { fontSize: 20, fontFamily: fonts.bold, color: colors.textPrimary, textAlign: 'center' },
  aiImageWrapper:  { width: '100%', aspectRatio: 0.9, borderRadius: radius.lg, overflow: 'hidden' },
  aiImage:         { width: '100%', height: '100%' },

  highlight:       { position: 'absolute', alignItems: 'center', justifyContent: 'center' },
  highlightFill:   { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(255,255,255,0.18)' },
  highlightRing:   { ...StyleSheet.absoluteFillObject, borderWidth: 2, borderColor: 'rgba(255,255,255,0.85)' },
  highlightNum:    { fontSize: 13, fontFamily: fonts.bold, color: '#FFFFFF', textShadowColor: 'rgba(0,0,0,0.7)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 4 },

  tellsSubheading: { fontSize: 13, fontFamily: fonts.bold, color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: 1.5 },
  tellCard:        { backgroundColor: colors.surface, borderRadius: radius.md, padding: 16 },
  tellCardHeader:  { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 6 },
  tellBadge:       { width: 22, height: 22, borderRadius: 11, backgroundColor: colors.surface2, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  tellBadgeNum:    { fontSize: 11, fontFamily: fonts.bold, color: colors.textSecondary },
  tellLabel:       { fontSize: 16, fontFamily: fonts.bold, color: colors.textPrimary, flex: 1 },
  tellDescription: { fontSize: 14, fontFamily: fonts.regular, color: colors.textSecondary, lineHeight: 21 },

  nextBtn:     { backgroundColor: colors.textPrimary, paddingVertical: 18, paddingHorizontal: 48, borderRadius: radius.pill },
  nextBtnText: { color: colors.bg, fontSize: 17, fontFamily: fonts.bold },

  // Zoom modal
  modalContainer:   { flex: 1, backgroundColor: '#000' },
  modalHeader:      { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 8, gap: 8 },
  modalCloseBtn:    { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  modalTitle:       { flex: 1, fontSize: 17, fontFamily: fonts.bold, color: colors.textPrimary, textAlign: 'center' },
  modalImageArea:   { width: SW, height: MODAL_IMG_H, overflow: 'hidden', alignSelf: 'center' },
  modalImage:       { width: SW, height: MODAL_IMG_H },
  modalFooter:      { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 32, gap: 20 },
  modalDescription: { fontSize: 15, fontFamily: fonts.regular, color: colors.textSecondary, lineHeight: 23, textAlign: 'center' },
  modalDoneBtn:     { backgroundColor: colors.surface, paddingVertical: 14, paddingHorizontal: 40, borderRadius: radius.pill },
  modalDoneText:    { fontSize: 15, fontFamily: fonts.semiBold, color: colors.textPrimary },
});
