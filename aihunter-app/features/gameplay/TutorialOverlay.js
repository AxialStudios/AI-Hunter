import { useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated, Dimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { colors, fonts, radius } from '../../constants/theme';

const { width: SW } = Dimensions.get('window');
const CARD_W = Math.floor((SW - 32 - 10) / 2);
const CARD_H = Math.floor(CARD_W / 0.5);
const GHOST_H = Math.floor(CARD_H * 0.52);

// Distance from top of screen (excluding insets.top) to top of imageRow:
// playing layer adds 16px padding; playingTop height is 164
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
  const cardTY  = useRef(new Animated.Value(36)).current;
  const textTY  = useRef(new Animated.Value(24)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.timing(opacity, { toValue: 1, duration: 240, useNativeDriver: true }),
      Animated.parallel([
        Animated.spring(cardTY, { toValue: 0, tension: 65, friction: 13, useNativeDriver: true }),
        Animated.spring(textTY, { toValue: 0, tension: 65, friction: 13, useNativeDriver: true }),
      ]),
    ]).start();
  }, []);

  return (
    <View style={[StyleSheet.absoluteFillObject, styles.cinematicBg]}>
      <Animated.View
        style={[styles.cinematicInner, { opacity, paddingTop: insets.top + 52, paddingBottom: insets.bottom + 44 }]}
      >
        {/* Ghost card pair — visual preview of the mechanic */}
        <Animated.View style={[styles.ghostRow, { transform: [{ translateY: cardTY }] }]}>
          <View style={[styles.ghostCard, styles.ghostCardReal]}>
            <Feather name="camera" size={30} color="#282828" />
            <Text style={styles.ghostCardTag}>REAL</Text>
          </View>
          <View style={[styles.ghostCard, styles.ghostCardAI]}>
            <Feather name="cpu" size={30} color="#282828" />
            <Text style={styles.ghostCardTag}>AI</Text>
          </View>
        </Animated.View>

        {/* Main copy */}
        <Animated.View style={[styles.copyBlock, { transform: [{ translateY: textTY }] }]}>
          <Text style={styles.cinHeading}>One is real.{'\n'}One is AI.</Text>
          <Text style={styles.cinSub}>
            Each round you'll see a pair.{'\n'}Tap the one you think is real.
          </Text>
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

  return (
    <View style={StyleSheet.absoluteFillObject} pointerEvents="box-none">
      {/* Four dim panels create a spotlight around the image pair */}
      <View style={{ position: 'absolute', top: 0,          left: 0,  right: 0,  height: imageTop,     backgroundColor: DIM }} pointerEvents="none" />
      <View style={{ position: 'absolute', top: imageTop,   left: 0,  width: 16, height: CARD_H,       backgroundColor: DIM }} pointerEvents="none" />
      <View style={{ position: 'absolute', top: imageTop,   right: 0, width: 16, height: CARD_H,       backgroundColor: DIM }} pointerEvents="none" />
      <View style={{ position: 'absolute', top: imageBottom, left: 0, right: 0,  bottom: 0,            backgroundColor: DIM }} pointerEvents="none" />

      {/* Instruction floats just below the image spotlight */}
      <View style={[styles.instruction, { top: imageBottom + 32 }]} pointerEvents="none">
        <Text style={styles.instructionText}>Tap the image{'\n'}you think is real</Text>
      </View>
    </View>
  );
}

function ZoomOverlay({ insets, selectedSide }) {
  const pulseScale   = useRef(new Animated.Value(1)).current;
  const pulseOpacity = useRef(new Animated.Value(0.85)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.parallel([
        Animated.sequence([
          Animated.timing(pulseScale,   { toValue: 1.7, duration: 760, useNativeDriver: true }),
          Animated.timing(pulseScale,   { toValue: 1.0, duration: 760, useNativeDriver: true }),
        ]),
        Animated.sequence([
          Animated.timing(pulseOpacity, { toValue: 0.0, duration: 760, useNativeDriver: true }),
          Animated.timing(pulseOpacity, { toValue: 0.85, duration: 760, useNativeDriver: true }),
        ]),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, []);

  const imageTop = insets.top + IMAGE_TOP_BASE;

  // zoom button: `position: 'absolute', top: 8, right: 8` inside imageWrapper
  // button is ~25×25px (icon:13 + padding:6 each side)
  const cardLeft = selectedSide === 'left' ? 16 : 16 + CARD_W + 10;
  const btnCX    = cardLeft + CARD_W - 8 - 12; // 12 ≈ half button width
  const btnCY    = imageTop + 8 + 12;
  const RING_R   = 27;

  return (
    <View style={StyleSheet.absoluteFillObject} pointerEvents="box-none">
      {/* Uniform dim — pointerEvents:"none" so zoom button stays tappable */}
      <View style={[StyleSheet.absoluteFillObject, { backgroundColor: 'rgba(0,0,0,0.68)' }]} pointerEvents="none" />

      {/* Pulsing ring centred on the zoom button */}
      <Animated.View
        style={{
          position: 'absolute',
          top:  btnCY - RING_R,
          left: btnCX - RING_R,
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

      {/* Instruction pinned above the home indicator */}
      <View style={[styles.instruction, { bottom: insets.bottom + 80 }]} pointerEvents="none">
        <Text style={styles.instructionText}>Zoom in to inspect it</Text>
      </View>
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

  ghostRow: { flexDirection: 'row', gap: 10 },
  ghostCard: {
    width: CARD_W,
    height: GHOST_H,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: '#1E1E1E',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 14,
  },
  ghostCardReal: { backgroundColor: '#131313' },
  ghostCardAI:   { backgroundColor: '#101010' },
  ghostCardTag: {
    fontSize: 10,
    fontFamily: fonts.semiBold,
    color: '#2C2C2C',
    letterSpacing: 2.5,
  },

  copyBlock: { alignItems: 'center', gap: 14 },
  cinHeading: {
    fontSize: 36,
    fontFamily: fonts.bold,
    color: colors.textPrimary,
    textAlign: 'center',
    lineHeight: 44,
  },
  cinSub: {
    fontSize: 19,
    fontFamily: fonts.regular,
    color: colors.textPrimary,
    textAlign: 'center',
    lineHeight: 28,
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

  instruction: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  instructionText: {
    fontSize: 24,
    fontFamily: fonts.bold,
    color: colors.textPrimary,
    textAlign: 'center',
    lineHeight: 30,
  },
});
