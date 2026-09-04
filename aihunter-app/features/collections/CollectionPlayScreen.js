import { useState, useRef, useCallback, useEffect } from 'react';
import {
  View, Text, Image, Animated, Easing, TouchableOpacity,
  ScrollView, StyleSheet, Dimensions, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import { useHaptics } from '../../context/HapticsContext';
import { useProStatus } from '../../context/ProContext';
import { supabase } from '../../lib/supabase';
import { colors, fonts, radius } from '../../constants/theme';
import PaywallScreen from '../paywall/PaywallScreen';

const { width: SW } = Dimensions.get('window');
const CARD_W = Math.floor((SW - 32 - 10) / 2);
const CARD_H = Math.floor(CARD_W / 0.5);

const CORRECT_FILL   = 'rgba(34,197,94,0.72)';
const INCORRECT_FILL = 'rgba(239,68,68,0.72)';
const WHITE_FILL     = 'rgba(255,255,255,0.55)';

// Returns the index of the tell closest to center (0.5, 0.5).
// The most centered tell is most likely visible in the portrait card crop.
function freeTellIdx(tells) {
  if (!tells.length) return 0;
  return tells.reduce((best, t, i) => {
    const dx = (t.x ?? 0.5) - 0.5, dy = (t.y ?? 0.5) - 0.5;
    const bx = (tells[best].x ?? 0.5) - 0.5, by = (tells[best].y ?? 0.5) - 0.5;
    return dx*dx+dy*dy < bx*bx+by*by ? i : best;
  }, 0);
}

// ── Completion screen ────────────────────────────────────────────────────────
function CompletionScreen({ category, accuracy, onBack }) {
  const scale = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.spring(scale, { toValue: 1, tension: 80, friction: 6, useNativeDriver: true }).start();
  }, []);
  return (
    <View style={cs.root}>
      <Animated.View style={[cs.check, { transform: [{ scale }] }]}>
        <Feather name="check-circle" size={80} color={colors.correct} />
      </Animated.View>
      <Text style={cs.title}>Collection Complete!</Text>
      <Text style={cs.cat}>{category}</Text>
      {accuracy !== null && (
        <Text style={cs.acc}>Your accuracy: {accuracy}%</Text>
      )}
      <TouchableOpacity style={cs.btn} onPress={onBack} activeOpacity={0.85}>
        <Text style={cs.btnText}>Back to Collections</Text>
      </TouchableOpacity>
    </View>
  );
}

const cs = StyleSheet.create({
  root:  { flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 },
  check: { marginBottom: 28 },
  title: { fontSize: 32, fontFamily: fonts.bold, color: colors.textPrimary, textAlign: 'center', marginBottom: 8 },
  cat:   { fontSize: 18, fontFamily: fonts.medium, color: colors.textSecondary, textAlign: 'center', marginBottom: 16 },
  acc:   { fontSize: 15, fontFamily: fonts.regular, color: colors.correct, marginBottom: 36 },
  btn:   { backgroundColor: colors.textPrimary, paddingVertical: 16, paddingHorizontal: 48, borderRadius: radius.pill },
  btnText: { fontSize: 16, fontFamily: fonts.bold, color: colors.bg },
});

// ── Main play screen ─────────────────────────────────────────────────────────
export default function CollectionPlayScreen({ route, navigation }) {
  const { category, total } = route.params;
  const { user }            = useAuth();
  const { isPro }           = useProStatus();
  const { light, medium, success, error: hapticError } = useHaptics();

  const [phase,         setPhase]         = useState('loading');
  const [task,          setTask]          = useState(null);
  const [leftIsReal,    setLeftIsReal]    = useState(true);
  const [selectedSide,  setSelectedSide]  = useState(null);
  const [voting,        setVoting]        = useState(false);
  const [result,        setResult]        = useState(null);
  const [colorRevealed, setColorRevealed] = useState(false);
  const [showTells,     setShowTells]     = useState(false);
  const [paywallOpen,   setPaywallOpen]   = useState(false);
  const [completed,     setCompleted]     = useState(false);
  const [sessionCorrect, setSessionCorrect] = useState(0);
  const [sessionTotal,   setSessionTotal]   = useState(0);
  const [playedIds,     setPlayedIds]     = useState(null); // null = loading

  const [leftPctDisplay,  setLeftPctDisplay]  = useState(0);
  const [rightPctDisplay, setRightPctDisplay] = useState(0);

  const leftFillAnim        = useRef(new Animated.Value(0)).current;
  const rightFillAnim       = useRef(new Animated.Value(0)).current;
  const leftFillTranslateY  = useRef(leftFillAnim.interpolate({ inputRange: [0, 1], outputRange: [CARD_H / 2, 0] })).current;
  const rightFillTranslateY = useRef(rightFillAnim.interpolate({ inputRange: [0, 1], outputRange: [CARD_H / 2, 0] })).current;
  const verdictOpacity      = useRef(new Animated.Value(0)).current;
  const bottomOpacity       = useRef(new Animated.Value(0)).current;
  const startTime           = useRef(Date.now());

  const leftFillColor  = colorRevealed ? (leftIsReal  ? CORRECT_FILL : INCORRECT_FILL) : WHITE_FILL;
  const rightFillColor = colorRevealed ? (!leftIsReal ? CORRECT_FILL : INCORRECT_FILL) : WHITE_FILL;
  const leftColor      = leftIsReal  ? colors.correct : colors.incorrect;
  const rightColor     = !leftIsReal ? colors.correct : colors.incorrect;
  const tells          = task?.tell_annotations || [];
  const freeIdx        = freeTellIdx(tells);

  // Load played IDs once on mount
  useEffect(() => {
    if (!user) return;
    supabase
      .from('votes')
      .select('task_id')
      .eq('user_id', user.id)
      .then(({ data }) => {
        setPlayedIds(new Set((data || []).map(v => v.task_id)));
      });
  }, [user?.id]);

  useEffect(() => {
    if (playedIds !== null) fetchTask(playedIds);
  }, [playedIds]);

  async function fetchTask(ids) {
    setPhase('loading');
    setResult(null);
    setSelectedSide(null);
    setShowTells(false);
    setColorRevealed(false);
    leftFillAnim.setValue(0);
    rightFillAnim.setValue(0);
    verdictOpacity.setValue(0);
    bottomOpacity.setValue(0);
    setLeftPctDisplay(0);
    setRightPctDisplay(0);

    const played = ids ?? playedIds ?? new Set();

    // Fetch tasks in this category that haven't been played yet
    let query = supabase
      .from('tasks')
      .select('*')
      .eq('approval_status', 'active')
      .eq('category', category);

    // Exclude already-played IDs (Supabase allows .not with 'in' for arrays)
    const playedArr = [...played];
    if (playedArr.length > 0) {
      // Supabase REST: .not('id', 'in', `(${playedArr.map(id => `"${id}"`).join(',')})`)
      // Use filter string directly for UUID arrays
      query = query.not('id', 'in', `(${playedArr.join(',')})`);
    }

    // Get count of remaining first
    const { count } = await supabase
      .from('tasks')
      .select('*', { count: 'exact', head: true })
      .eq('approval_status', 'active')
      .eq('category', category)
      .not('id', playedArr.length > 0 ? 'in' : 'is', playedArr.length > 0 ? `(${playedArr.join(',')})` : null);

    if (!count || count === 0) {
      setCompleted(true);
      setPhase('complete');
      return;
    }

    // Fetch random one
    const randomIndex = Math.floor(Math.random() * count);
    const { data, error } = await query.range(randomIndex, randomIndex).single();

    if (error || !data) {
      // Possibly all done
      setCompleted(true);
      setPhase('complete');
      return;
    }

    setTask(data);
    setLeftIsReal(Math.random() > 0.5);
    startTime.current = Date.now();
    setPhase('playing');
  }

  function handleSelect(side) {
    if (voting || phase !== 'playing') return;
    light();
    setSelectedSide(side);
  }

  async function handleConfirm() {
    if (!selectedSide || voting) return;
    medium();
    setVoting(true);

    const tappedLeft     = selectedSide === 'left';
    const chose_ai       = tappedLeft === leftIsReal;
    const response_time_ms = Date.now() - startTime.current;

    const { data, error } = await supabase.rpc('record_vote', {
      p_task_id: task.id, p_user_id: user.id,
      p_chose_ai: chose_ai, p_response_time_ms: response_time_ms,
    });

    if (error) { console.error('Vote error:', error.message); setVoting(false); setSelectedSide(null); return; }

    // Mark this task as played locally
    setPlayedIds(prev => { const next = new Set(prev); next.add(task.id); return next; });
    setSessionTotal(t => t + 1);
    if (data.was_correct) setSessionCorrect(c => c + 1);
    setResult(data);
    revealResults(data);
  }

  function countUp(setter, target, duration) {
    const start = Date.now();
    const tick = () => {
      const p = Math.min((Date.now() - start) / duration, 1);
      setter(Math.round((1 - Math.pow(1 - p, 3)) * target));
      if (p < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }

  function revealResults(data) {
    const leftPct  = leftIsReal ? data.real_pct : data.ai_pct;
    const rightPct = leftIsReal ? data.ai_pct   : data.real_pct;

    setPhase('results');
    verdictOpacity.setValue(0);
    bottomOpacity.setValue(0);
    leftFillAnim.setValue(0);
    rightFillAnim.setValue(0);

    Animated.parallel([
      Animated.timing(leftFillAnim,  { toValue: leftPct  / 100, duration: 1100, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.timing(rightFillAnim, { toValue: rightPct / 100, duration: 1100, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
    ]).start();
    countUp(setLeftPctDisplay,  leftPct,  1100);
    countUp(setRightPctDisplay, rightPct, 1100);

    setTimeout(() => {
      setColorRevealed(true);
      Animated.parallel([
        Animated.timing(verdictOpacity, { toValue: 1, duration: 90, useNativeDriver: true }),
        Animated.timing(bottomOpacity,  { toValue: 1, duration: 90, useNativeDriver: true }),
      ]).start();
      setTimeout(() => data.was_correct ? success() : hapticError(), 86);
    }, 1075);
  }

  function handleNext() {
    light();
    fetchTask(playedIds);
  }

  const accuracy = sessionTotal > 0 ? Math.round((sessionCorrect / sessionTotal) * 100) : null;
  const leftUrl  = task ? (leftIsReal ? task.real_image_url : task.ai_image_url)   : '';
  const rightUrl = task ? (leftIsReal ? task.ai_image_url   : task.real_image_url) : '';

  if (phase === 'complete' || completed) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
        <CompletionScreen
          category={category}
          accuracy={accuracy}
          onBack={() => navigation.goBack()}
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={p.safe}>
      {/* Header */}
      <View style={p.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={p.backBtn} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
          <Feather name="arrow-left" size={22} color={colors.textPrimary} />
        </TouchableOpacity>
        <View style={p.headerCenter}>
          <Text style={p.headerTitle} numberOfLines={1}>{category}</Text>
          <Text style={p.headerSub}>{sessionTotal} played this session</Text>
        </View>
        <View style={{ width: 44 }} />
      </View>

      {/* Thin progress bar */}
      <View style={p.progressTrack}>
        <View style={[p.progressFill, { width: total > 0 ? `${Math.min((((playedIds?.size ?? 0)) / total) * 100, 100)}%` : '0%' }]} />
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={p.scroll} showsVerticalScrollIndicator={false}>
        {phase === 'loading' ? (
          <View style={p.loadingWrap}>
            <ActivityIndicator color={colors.textSecondary} />
          </View>
        ) : (
          <>
            {/* Prompt */}
            <View style={p.promptWrap}>
              {phase === 'playing' ? (
                <Text style={p.prompt}>{selectedSide ? 'Is this the real one?' : 'Tap the real image'}</Text>
              ) : result ? (
                <Animated.Text style={[p.verdict, result.was_correct ? p.verdictCorrect : p.verdictIncorrect, { opacity: verdictOpacity }]}>
                  {result.was_correct ? 'Correct!' : 'Fooled!'}
                </Animated.Text>
              ) : null}
            </View>

            {/* Image row */}
            <View style={p.imageRow}>
              {/* Left */}
              <View style={[p.imageWrap, selectedSide === 'left' && p.imageWrapChosen]}>
                <TouchableOpacity
                  style={StyleSheet.absoluteFillObject}
                  onPress={() => handleSelect('left')}
                  disabled={voting || phase === 'results'}
                  activeOpacity={0.88}
                >
                  <Image source={{ uri: leftUrl }} style={p.image} resizeMode="cover" />
                </TouchableOpacity>
                {/* Fill overlay */}
                {phase === 'results' && (
                  <Animated.View style={[StyleSheet.absoluteFillObject, { backgroundColor: leftFillColor, transform: [{ translateY: leftFillTranslateY }, { scaleY: leftFillAnim }] }]} />
                )}
              </View>

              {/* Right */}
              <View style={[p.imageWrap, selectedSide === 'right' && p.imageWrapChosen]}>
                <TouchableOpacity
                  style={StyleSheet.absoluteFillObject}
                  onPress={() => handleSelect('right')}
                  disabled={voting || phase === 'results'}
                  activeOpacity={0.88}
                >
                  <Image source={{ uri: rightUrl }} style={p.image} resizeMode="cover" />
                </TouchableOpacity>
                {phase === 'results' && (
                  <Animated.View style={[StyleSheet.absoluteFillObject, { backgroundColor: rightFillColor, transform: [{ translateY: rightFillTranslateY }, { scaleY: rightFillAnim }] }]} />
                )}
              </View>
            </View>

            {/* Per-card labels after vote */}
            {phase === 'results' && result && (
              <Animated.View style={[p.labelsRow, { opacity: verdictOpacity }]}>
                <View style={p.labelCol}>
                  <View style={[p.badge, { backgroundColor: leftColor }]}>
                    <Feather name={leftIsReal ? 'check' : 'x'} size={12} color="#fff" />
                  </View>
                  <Text style={[p.pct, { color: leftColor }]}>{leftPctDisplay}%</Text>
                  <Text style={p.tag}>{leftIsReal ? 'REAL' : 'AI'}</Text>
                </View>
                <View style={p.labelCol}>
                  <View style={[p.badge, { backgroundColor: rightColor }]}>
                    <Feather name={!leftIsReal ? 'check' : 'x'} size={12} color="#fff" />
                  </View>
                  <Text style={[p.pct, { color: rightColor }]}>{rightPctDisplay}%</Text>
                  <Text style={p.tag}>{!leftIsReal ? 'REAL' : 'AI'}</Text>
                </View>
              </Animated.View>
            )}

            {/* Confirm / action row */}
            {phase === 'playing' && (
              <View style={p.confirmWrap}>
                <TouchableOpacity
                  style={[p.confirmBtn, !selectedSide && { opacity: 0 }]}
                  onPress={handleConfirm}
                  disabled={!selectedSide}
                  activeOpacity={0.85}
                >
                  <Text style={p.confirmBtnText}>Confirm  →</Text>
                </TouchableOpacity>
              </View>
            )}

            {phase === 'results' && (
              <Animated.View style={[p.actionRow, { opacity: bottomOpacity }]}>
                <TouchableOpacity style={p.tellsBtn} onPress={() => setShowTells(v => !v)}>
                  <Text style={p.tellsBtnText}>{showTells ? '▲  Hide tells' : '▼  See the tells'}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={p.nextBtn} onPress={handleNext}>
                  <Text style={p.nextBtnText}>Next  →</Text>
                </TouchableOpacity>
              </Animated.View>
            )}

            {/* Tells section */}
            {phase === 'results' && showTells && task && (
              <View style={p.tellsSection}>
                <Text style={p.tellsHeading}>The Tells</Text>
                {tells.map((tell, i) => {
                  const isFree  = i === freeIdx;
                  const isGated = !isPro && !isFree;
                  const name    = tell.title || tell.label || '';
                  return (
                    <TouchableOpacity
                      key={i}
                      style={p.tellItem}
                      onPress={() => isGated && setPaywallOpen(true)}
                      activeOpacity={isGated ? 0.7 : 1}
                    >
                      <View style={p.tellHeader}>
                        <View style={p.tellBadge}>
                          <Text style={p.tellBadgeNum}>{i + 1}</Text>
                        </View>
                        {isGated
                          ? <Text style={[p.tellLabel, { color: colors.textTertiary, fontStyle: 'italic' }]}>🔒 Pro Tell</Text>
                          : <Text style={p.tellLabel}>{name}</Text>
                        }
                      </View>
                      {isGated ? (
                        <View style={{ paddingLeft: 34, overflow: 'hidden' }}>
                          <Text style={[p.tellDesc, { opacity: 0.18 }]} numberOfLines={2}>{tell.description}</Text>
                          <View style={StyleSheet.absoluteFillObject} />
                        </View>
                      ) : (
                        <Text style={p.tellDesc}>{tell.description}</Text>
                      )}
                    </TouchableOpacity>
                  );
                })}
                {!isPro && tells.length > 1 && (
                  <TouchableOpacity style={p.upgradePrompt} onPress={() => setPaywallOpen(true)}>
                    <Feather name="lock" size={13} color="#a78bfa" />
                    <Text style={p.upgradeText}>See all {tells.length} tells — Upgrade to Pro</Text>
                    <Feather name="chevron-right" size={13} color="#a78bfa" />
                  </TouchableOpacity>
                )}
              </View>
            )}
          </>
        )}
      </ScrollView>

      <PaywallScreen visible={paywallOpen} onClose={() => setPaywallOpen(false)} />
    </SafeAreaView>
  );
}

const p = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: colors.bg },
  scroll: { paddingBottom: 40 },

  header:       { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 8 },
  backBtn:      { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  headerCenter: { flex: 1, alignItems: 'center' },
  headerTitle:  { fontSize: 16, fontFamily: fonts.bold, color: colors.textPrimary },
  headerSub:    { fontSize: 11, fontFamily: fonts.regular, color: colors.textTertiary },

  progressTrack: { height: 3, backgroundColor: '#1C1C1C', marginHorizontal: 0 },
  progressFill:  { height: '100%', backgroundColor: colors.correct, borderRadius: 2 },

  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 80 },

  promptWrap:     { height: 72, justifyContent: 'flex-end', paddingBottom: 12, paddingHorizontal: 16 },
  prompt:         { fontSize: 22, fontFamily: fonts.semiBold, color: colors.textPrimary, textAlign: 'center' },
  verdict:        { fontSize: 44, fontFamily: fonts.bold, textAlign: 'center' },
  verdictCorrect: { color: colors.correct },
  verdictIncorrect: { color: colors.incorrect },

  imageRow:      { flexDirection: 'row', gap: 10, paddingHorizontal: 16 },
  imageWrap:     { width: CARD_W, height: CARD_H, borderRadius: radius.lg, overflow: 'hidden', backgroundColor: colors.surface, borderWidth: 3, borderColor: colors.border },
  imageWrapChosen: { borderColor: colors.textPrimary },
  image:         { width: '100%', height: '100%' },

  labelsRow: { flexDirection: 'row', paddingHorizontal: 16, marginTop: 10 },
  labelCol:  { width: CARD_W, flexDirection: 'row', alignItems: 'center', gap: 6, marginRight: 10 },
  badge:     { width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  pct:       { fontSize: 20, fontFamily: fonts.bold },
  tag:       { fontSize: 13, fontFamily: fonts.semiBold, color: colors.textPrimary, letterSpacing: 1.5 },

  confirmWrap:    { paddingHorizontal: 16, paddingTop: 12 },
  confirmBtn:     { backgroundColor: colors.textPrimary, paddingVertical: 18, borderRadius: radius.pill, alignItems: 'center' },
  confirmBtnText: { color: colors.bg, fontSize: 17, fontFamily: fonts.bold },

  actionRow: { flexDirection: 'row', gap: 10, paddingHorizontal: 16, marginTop: 12 },
  tellsBtn:  { flex: 1, paddingVertical: 15, borderWidth: 2, borderColor: '#555', borderRadius: radius.pill, alignItems: 'center' },
  tellsBtnText: { fontSize: 14, fontFamily: fonts.semiBold, color: colors.textPrimary },
  nextBtn:   { flex: 1, backgroundColor: colors.textPrimary, paddingVertical: 15, borderRadius: radius.pill, alignItems: 'center' },
  nextBtnText: { fontSize: 14, fontFamily: fonts.bold, color: colors.bg },

  tellsSection: { marginTop: 16, paddingHorizontal: 16, gap: 10 },
  tellsHeading: { fontSize: 17, fontFamily: fonts.bold, color: colors.textPrimary },
  tellItem:     { backgroundColor: colors.surface, borderRadius: radius.md, padding: 14, gap: 5 },
  tellHeader:   { flexDirection: 'row', alignItems: 'center', gap: 10 },
  tellBadge:    { width: 24, height: 24, borderRadius: 12, backgroundColor: colors.surface2, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  tellBadgeNum: { fontSize: 12, fontFamily: fonts.bold, color: colors.textSecondary },
  tellLabel:    { fontSize: 16, fontFamily: fonts.bold, color: colors.textPrimary, flex: 1 },
  tellDesc:     { fontSize: 13, fontFamily: fonts.regular, color: colors.textSecondary, lineHeight: 20, paddingLeft: 34 },
  upgradePrompt: { flexDirection: 'row', alignItems: 'center', gap: 7, paddingVertical: 12, paddingHorizontal: 16, backgroundColor: 'rgba(124,58,237,0.1)', borderRadius: radius.md, borderWidth: 1, borderColor: 'rgba(124,58,237,0.3)', justifyContent: 'center' },
  upgradeText:   { fontSize: 13, fontFamily: fonts.semiBold, color: '#a78bfa', flex: 1, textAlign: 'center' },
});
