import { useState, useRef, useEffect } from 'react';
import {
  View, Text, Image, Animated, TouchableOpacity, Modal,
  ScrollView, StyleSheet, Dimensions,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useHaptics } from '../../context/HapticsContext';
import { supabase } from '../../lib/supabase';
import { prefetchNextTask } from '../../lib/taskCache';
import { colors, fonts, radius } from '../../constants/theme';

const { width: SW } = Dimensions.get('window');
const CARD_W = Math.floor((SW - 32 - 10) / 2);
const CARD_H = Math.floor(CARD_W / 0.5);

// Zoom modal constants
const MODAL_ZOOM  = 2.5;
const MODAL_IMG_H = Math.floor(SW / 0.9); // aiImage aspect ratio

const CORRECT_FILL   = 'rgba(34,197,94,0.72)';
const INCORRECT_FILL = 'rgba(239,68,68,0.72)';

export default function ResultsScreen({ route, navigation }) {
  const { result, task, leftIsReal } = route.params;
  const { was_correct, real_pct, ai_pct, total_votes } = result;
  const { light } = useHaptics();
  const [showTells, setShowTells] = useState(false);
  const [zoomTell,  setZoomTell]  = useState(null);
  const [aiLayout,  setAiLayout]  = useState({ width: 0, height: 0 });

  const leftPct   = leftIsReal ? real_pct : ai_pct;
  const rightPct  = leftIsReal ? ai_pct   : real_pct;
  const leftFill  = leftIsReal  ? CORRECT_FILL   : INCORRECT_FILL;
  const rightFill = !leftIsReal ? CORRECT_FILL   : INCORRECT_FILL;
  const leftColor  = leftIsReal  ? colors.correct   : colors.incorrect;
  const rightColor = !leftIsReal ? colors.correct   : colors.incorrect;

  const leftUrl  = leftIsReal ? task.real_image_url : task.ai_image_url;
  const rightUrl = leftIsReal ? task.ai_image_url   : task.real_image_url;

  const leftAnim      = useRef(new Animated.Value(0)).current;
  const rightAnim     = useRef(new Animated.Value(0)).current;
  const imageFadeAnim = useRef(new Animated.Value(0)).current;
  const loadCount     = useRef(0);

  // One Animated.Value per annotation drives its shimmer
  const tells = task.tell_annotations || [];
  const shimmerAnims = useRef(tells.map(() => new Animated.Value(0))).current;

  useEffect(() => { prefetchNextTask(supabase); }, []);

  // Start/stop shimmer loops when tells section opens
  useEffect(() => {
    if (!showTells) {
      shimmerAnims.forEach(v => v.setValue(0));
      return;
    }
    const loops = shimmerAnims.map(v =>
      Animated.loop(
        Animated.sequence([
          Animated.timing(v, { toValue: 1,   duration: 950, useNativeDriver: true }),
          Animated.timing(v, { toValue: 0.2, duration: 950, useNativeDriver: true }),
        ])
      )
    );
    // Stagger each highlight's start by 320ms so they pulse out of sync
    const timers = loops.map((l, i) => setTimeout(() => l.start(), i * 320));
    return () => {
      loops.forEach(l => l.stop());
      timers.forEach(clearTimeout);
      shimmerAnims.forEach(v => v.setValue(0));
    };
  }, [showTells]);

  function handleImageLoad() {
    loadCount.current += 1;
    if (loadCount.current === 2) {
      const leftH  = CARD_H * leftPct  / 100;
      const rightH = CARD_H * rightPct / 100;
      Animated.sequence([
        Animated.timing(imageFadeAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
        Animated.delay(100),
        Animated.parallel([
          Animated.timing(leftAnim,  { toValue: leftH,  duration: 700, useNativeDriver: false }),
          Animated.timing(rightAnim, { toValue: rightH, duration: 700, useNativeDriver: false }),
        ]),
      ]).start();
    }
  }

  function openZoom(tell) {
    light();
    setZoomTell(tell);
  }

  return (
    <>
      <SafeAreaView style={styles.safe}>
        <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>

          {/* Verdict */}
          <Text style={[styles.verdict, was_correct ? styles.verdictCorrect : styles.verdictIncorrect]}>
            {was_correct ? 'Correct!' : 'Fooled!'}
          </Text>
          <Text style={styles.subtitle}>
            {was_correct ? 'You spotted the real image.' : 'You picked the AI image.'}
          </Text>

          {/* Percentage labels */}
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

          {/* Images with animated fill */}
          <View style={styles.imageRow}>
            <View style={styles.imageWrapper}>
              <Animated.Image
                source={{ uri: leftUrl }}
                style={[styles.image, { opacity: imageFadeAnim }]}
                resizeMode="cover"
                onLoadEnd={handleImageLoad}
              />
              <Animated.View style={[styles.fill, { height: leftAnim, backgroundColor: leftFill }]} />
            </View>
            <View style={styles.imageWrapper}>
              <Animated.Image
                source={{ uri: rightUrl }}
                style={[styles.image, { opacity: imageFadeAnim }]}
                resizeMode="cover"
                onLoadEnd={handleImageLoad}
              />
              <Animated.View style={[styles.fill, { height: rightAnim, backgroundColor: rightFill }]} />
            </View>
          </View>

          <Text style={styles.totalVotes}>{total_votes.toLocaleString()} total votes</Text>

          {/* See the tells toggle */}
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

              {/* AI image with shimmer annotation spots */}
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
                      onPress={() => openZoom(tell)}
                      activeOpacity={0.75}
                    >
                      {/* Pulsing fill */}
                      <Animated.View
                        style={[styles.highlightFill, { borderRadius: r, opacity, transform: [{ scale }] }]}
                      />
                      {/* Pulsing border ring */}
                      <Animated.View
                        style={[styles.highlightRing, { borderRadius: r, opacity }]}
                      />
                      {/* Number */}
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
                  onPress={() => tell.x != null && openZoom(tell)}
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

          <TouchableOpacity
            style={styles.nextBtn}
            onPress={() => { light(); navigation.navigate('Gameplay'); }}
          >
            <Text style={styles.nextBtnText}>Next Pair  →</Text>
          </TouchableOpacity>

        </ScrollView>
      </SafeAreaView>

      {/* Annotation zoom modal */}
      <Modal
        visible={!!zoomTell}
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() => setZoomTell(null)}
      >
        <View style={styles.modalContainer}>
          {/* Header */}
          <SafeAreaView>
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={() => { light(); setZoomTell(null); }} style={styles.modalCloseBtn}>
                <Feather name="x" size={22} color={colors.textPrimary} />
              </TouchableOpacity>
              <Text style={styles.modalTitle} numberOfLines={1}>{zoomTell?.label}</Text>
              <View style={{ width: 44 }} />
            </View>
          </SafeAreaView>

          {/* Zoomed image — transform centers the annotation on screen */}
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

          {/* Description */}
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
  safe:      { flex: 1, backgroundColor: colors.bg },
  container: { alignItems: 'center', padding: 24, paddingBottom: 48, gap: 16 },

  verdict:          { fontSize: 44, fontFamily: fonts.bold, textAlign: 'center' },
  verdictCorrect:   { color: colors.correct },
  verdictIncorrect: { color: colors.incorrect },
  subtitle:         { fontSize: 15, fontFamily: fonts.medium, color: colors.textPrimary, textAlign: 'center', marginTop: -8 },

  pctRow:      { flexDirection: 'row', width: '100%', gap: 10 },
  pctSide:     { flex: 1, alignItems: 'center', gap: 2 },
  symbolBadge: { width: 34, height: 34, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center' },
  pctNumber:   { fontSize: 22, fontFamily: fonts.bold, marginTop: 2 },
  pctTag:      { fontSize: 10, fontFamily: fonts.semiBold, color: colors.textTertiary, letterSpacing: 1.5 },

  imageRow:    { flexDirection: 'row', width: '100%', gap: 10 },
  imageWrapper: { flex: 1, aspectRatio: 0.5, borderRadius: radius.lg, overflow: 'hidden', backgroundColor: colors.surface },
  image:        { width: '100%', height: '100%' },
  fill:         { position: 'absolute', bottom: 0, left: 0, right: 0 },

  totalVotes: { fontSize: 12, fontFamily: fonts.regular, color: colors.textSecondary, marginTop: -4 },

  tellsBtn:     { paddingVertical: 12, paddingHorizontal: 28, borderWidth: 1.5, borderColor: colors.border, borderRadius: radius.pill },
  tellsBtnText: { fontSize: 14, fontFamily: fonts.semiBold, color: colors.textSecondary },

  tellsSection:    { width: '100%', gap: 12 },
  tellsHeading:    { fontSize: 20, fontFamily: fonts.bold, color: colors.textPrimary, textAlign: 'center' },

  // AI image container — highlights are absolutely positioned siblings of the Image
  aiImageWrapper:  { width: '100%', aspectRatio: 0.9, borderRadius: radius.lg, overflow: 'hidden' },
  aiImage:         { width: '100%', height: '100%' },

  // Shimmer highlight spots
  highlight:       { position: 'absolute', alignItems: 'center', justifyContent: 'center' },
  highlightFill:   { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(255,255,255,0.18)' },
  highlightRing:   { ...StyleSheet.absoluteFillObject, borderWidth: 2, borderColor: 'rgba(255,255,255,0.85)' },
  highlightNum:    { fontSize: 13, fontFamily: fonts.bold, color: '#FFFFFF', textShadowColor: 'rgba(0,0,0,0.7)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 4 },

  tellsSubheading: { fontSize: 13, fontFamily: fonts.bold, color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: 1.5 },

  // Tell cards — tappable, numbered to match image spots
  tellCard:        { backgroundColor: colors.surface, borderRadius: radius.md, padding: 16 },
  tellCardHeader:  { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 6 },
  tellBadge:       { width: 22, height: 22, borderRadius: 11, backgroundColor: colors.surface2, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  tellBadgeNum:    { fontSize: 11, fontFamily: fonts.bold, color: colors.textSecondary },
  tellLabel:       { fontSize: 16, fontFamily: fonts.bold, color: colors.textPrimary, flex: 1 },
  tellDescription: { fontSize: 14, fontFamily: fonts.regular, color: colors.textSecondary, lineHeight: 21 },

  nextBtn:     { backgroundColor: colors.textPrimary, paddingVertical: 18, paddingHorizontal: 48, borderRadius: radius.pill },
  nextBtnText: { color: colors.bg, fontSize: 17, fontFamily: fonts.bold },

  // Zoom modal
  modalContainer:  { flex: 1, backgroundColor: '#000' },
  modalHeader:     { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 8, gap: 8 },
  modalCloseBtn:   { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  modalTitle:      { flex: 1, fontSize: 17, fontFamily: fonts.bold, color: colors.textPrimary, textAlign: 'center' },

  // Image area clips the 2.5× transform to a clean viewport
  modalImageArea:  { width: SW, height: MODAL_IMG_H, overflow: 'hidden', alignSelf: 'center' },
  modalImage:      { width: SW, height: MODAL_IMG_H },

  modalFooter:     { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 32, gap: 20 },
  modalDescription:{ fontSize: 15, fontFamily: fonts.regular, color: colors.textSecondary, lineHeight: 23, textAlign: 'center' },
  modalDoneBtn:    { backgroundColor: colors.surface, paddingVertical: 14, paddingHorizontal: 40, borderRadius: radius.pill },
  modalDoneText:   { fontSize: 15, fontFamily: fonts.semiBold, color: colors.textPrimary },
});
