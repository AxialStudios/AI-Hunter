import { useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated, Dimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { colors, fonts, radius } from '../../constants/theme';

const { width: SW } = Dimensions.get('window');
const CARD_W = Math.floor((SW - 32 - 10) / 2);
const CARD_H = Math.floor(CARD_W / 0.5);
const GHOST_H = Math.floor(CARD_H * 0.52);

// Distance from screen top (excluding insets.top) to the image row:
// playing layer paddingTop = 16; playingTop height = 164
const IMAGE_TOP_BASE = 16 + 164;

export default function TutorialOverlay({ step, onAdvance, selectedSide }) {
  const insets = useSafeAreaInsets();

  if (!step || step === 0) return null;
  if (step === 'cinematic') return <CinematicScreen onAdvance={onAdvance} insets={insets} />;
  if (step === 'pick')      return <PickOverlay insets={insets} />;
  if (step === 'zoom')      return <ZoomOverlay insets={insets} selectedSide={selectedSide} />;
  return null;
}

function CinematicScreen({ onAdvance, insets }) {
  const opacity = useRef(new Animated.Value(0)).current;
  const cardTY  = useRef(new Animated.Value(40)).current;
  const textTY  = useRef(new Animated.Value(20)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.timing(opacity, { toValue: 1, duration: 240, useNativeDriver: true }),
      Animated.parallel([
        Animated.spring(textTY, { toValue: 0, tension: 65, friction: 13, useNativeDriver: true }),
        Animated.spring(cardTY, { toValue: 0, tension: 60, friction: 14, useNativeDriver: true }),
      ]),
    ]).start();
  }, []);

  return (
    <View style={[StyleSheet.absoluteFillObject, styles.cinematicBg]}>
      <Animated.View
        style={[styles.cinematicInner, { opacity, paddingTop: insets.top + 52, paddingBottom: insets.bottom + 44 }]}
      >
        {/* Main copy — at the top, mirroring where the game prompt lives */}
        <Animated.View style={[styles.copyBlock, { transform: [{ translateY: textTY }] }]}>
          <Text style={styles.cinHeading}>One is real.{'\n'}One is AI.</Text>
          <Text style={styles.cinSub}>
            Each round you'll see a pair of images.{'\n'}Tap the one you think is real.
          </Text>
        </Animated.View>

        {/* Ghost card pair — with REAL / AI labels below, matching game results UI */}
        <Animated.View style={[styles.ghostRow, { transform: [{ translateY: cardTY }] }]}>
          <View style={styles.ghostCardCol}>
            <View style={[styles.ghostCard, styles.ghostCardReal]} />
            <Text style={styles.ghostCardTag}>REAL</Text>
          </View>
          <View style={styles.ghostCardCol}>
            <View style={[styles.ghostCard, styles.ghostCardAI]} />
            <Text style={styles.ghostCardTag}>AI</Text>
          </View>
        </Animated.View>

        {/* CTA */}
        <TouchableOpacity style={styles.cinBtn} onPress={onAdvance} activeOpacity={0.85}>
          <Text style={styles.cinBtnText}>I'm ready</Text>
          <Feather name="arrow-right" size={18} color={colors.bg} style={{ marginLeft: 8 }} />
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
}

function PickOverlay({ insets }) {
  const imageTop    = insets.top + IMAGE_TOP_BASE;
  const imageBottom = imageTop + CARD_H;
  const DIM = 'rgba(0,0,0,0.82)';

  // The instruction text lives in GameplayScreen's playingTop (above images),
  // so we leave that area undimmed and only dim the sides + bottom.
  return (
    <View style={StyleSheet.absoluteFillObject} pointerEvents="box-none">
      <View style={{ position: 'absolute', top: imageTop,    left: 0,  width: 16, height: CARD_H, backgroundColor: DIM }} pointerEvents="none" />
      <View style={{ position: 'absolute', top: imageTop,    right: 0, width: 16, height: CARD_H, backgroundColor: DIM }} pointerEvents="none" />
      <View style={{ position: 'absolute', top: imageBottom, left: 0,  right: 0,  bottom: 0,      backgroundColor: DIM }} pointerEvents="none" />
    </View>
  );
}

function ZoomOverlay({ insets, selectedSide }) {
  const pulseScale   = useRef(new Animated.Value(1)).current;
  const pulseOpacity = useRef(new Animated.Value(0.9)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.parallel([
        Animated.sequence([
          Animated.timing(pulseScale,   { toValue: 1.5, duration: 700, useNativeDriver: true }),
          Animated.timing(pulseScale,   { toValue: 1.0, duration: 700, useNativeDriver: true }),
        ]),
        Animated.sequence([
          Animated.timing(pulseOpacity, { toValue: 0.0, duration: 700, useNativeDriver: true }),
          Animated.timing(pulseOpacity, { toValue: 0.9, duration: 700, useNativeDriver: true }),
        ]),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, []);

  const imageTop = insets.top + IMAGE_TOP_BASE;

  // Zoom button: `position:'absolute', top:8, right:8` inside imageWrapper.
  // Button size: icon(13) + padding(6×2) = 25pt. Half = 12.5pt (using 13 to round up).
  const cardLeft = selectedSide === 'left' ? 16 : 16 + CARD_W + 10;
  const btnCX    = cardLeft + CARD_W - 8 - 13;  // centre x of button
  const btnCY    = imageTop + 8 + 13;            // centre y of button
  const RING_R   = 17;                           // snug around 25pt button; stays inside card top

  return (
    <View style={StyleSheet.absoluteFillObject} pointerEvents="box-none">
      {/* Dim only from the image row downward — playingTop stays clear for instruction text */}
      <View
        style={{ position: 'absolute', top: imageTop, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.72)' }}
        pointerEvents="none"
      />

      {/* Pulsing ring — starts snug on button and radiates outward */}
      <Animated.View
        style={{
          position: 'absolute',
          top:    btnCY - RING_R,
          left:   btnCX - RING_R,
          width:  RING_R * 2,
          height: RING_R * 2,
          borderRadius: RING_R,
          borderWidth: 2,
          borderColor: '#FFFFFF',
          transform:  [{ scale: pulseScale }],
          opacity: pulseOpacity,
        }}
        pointerEvents="none"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  cinematicBg: { backgroundColor: colors.bg },
  cinematicInner: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
  },

  copyBlock: { alignItems: 'center', gap: 16 },
  cinHeading: {
    fontSize: 40,
    fontFamily: fonts.bold,
    color: colors.textPrimary,
    textAlign: 'center',
    lineHeight: 48,
  },
  cinSub: {
    fontSize: 21,
    fontFamily: fonts.regular,
    color: colors.textPrimary,
    textAlign: 'center',
    lineHeight: 30,
  },

  ghostRow: { flexDirection: 'row', gap: 10 },
  ghostCardCol: { alignItems: 'center', gap: 10 },
  ghostCard: {
    width: CARD_W,
    height: GHOST_H,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: '#1E1E1E',
  },
  ghostCardReal: { backgroundColor: '#131313' },
  ghostCardAI:   { backgroundColor: '#101010' },
  ghostCardTag: {
    fontSize: 11,
    fontFamily: fonts.semiBold,
    color: '#333',
    letterSpacing: 2.5,
  },

  cinBtn: {
    backgroundColor: colors.textPrimary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 18,
    borderRadius: radius.pill,
    alignSelf: 'stretch',
  },
  cinBtnText: {
    color: colors.bg,
    fontSize: 17,
    fontFamily: fonts.bold,
  },
});
