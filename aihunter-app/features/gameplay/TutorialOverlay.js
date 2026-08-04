import { useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated } from 'react-native';
import { colors, fonts, radius } from '../../constants/theme';

// Handles step 1 (how to play) and step 3 (tells) as full-screen overlay cards.
// Step 2 (zoom hint) is rendered inline in GameplayScreen.
export default function TutorialOverlay({ step, onDismiss }) {
  const opacity  = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(24)).current;

  const visible = step === 1 || step === 3;

  useEffect(() => {
    if (visible) {
      opacity.setValue(0);
      translateY.setValue(24);
      Animated.parallel([
        Animated.timing(opacity,     { toValue: 1, duration: 260, useNativeDriver: true }),
        Animated.spring(translateY,  { toValue: 0, tension: 80, friction: 12, useNativeDriver: true }),
      ]).start();
    } else {
      opacity.setValue(0);
    }
  }, [step]);

  if (!visible) return null;

  return (
    <Animated.View style={[StyleSheet.absoluteFillObject, styles.backdrop, { opacity }]}>
      <Animated.View style={[styles.card, { transform: [{ translateY }] }]}>

        {step === 1 && (
          <>
            <Text style={styles.label}>HOW TO PLAY</Text>
            <Text style={styles.heading}>One is real.{'\n'}One is AI.</Text>
            <Text style={styles.body}>
              Tap the image you think is real, then confirm your pick.
            </Text>
            <Text style={styles.body}>
              After each round you'll see how others voted — and the tells,
              the specific places where the AI slipped up.
            </Text>
            <TouchableOpacity style={styles.btn} onPress={onDismiss} activeOpacity={0.85}>
              <Text style={styles.btnText}>Let's play</Text>
            </TouchableOpacity>
          </>
        )}

        {step === 3 && (
          <>
            <Text style={styles.label}>THE TELLS</Text>
            <Text style={styles.heading}>Where the AI{'\n'}slipped up.</Text>
            <Text style={styles.body}>
              Numbered highlights mark the giveaways — distorted details,
              impossible textures, unnatural patterns.
            </Text>
            <Text style={styles.body}>
              Tap any highlight on the image to zoom in and see exactly what to look for.
            </Text>
            <TouchableOpacity style={styles.btn} onPress={onDismiss} activeOpacity={0.85}>
              <Text style={styles.btnText}>Got it</Text>
            </TouchableOpacity>
          </>
        )}

      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    backgroundColor: 'rgba(0,0,0,0.82)',
    justifyContent: 'flex-end',
    paddingHorizontal: 16,
    paddingBottom: 40,
  },
  card: {
    backgroundColor: '#161616',
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: '#2A2A2A',
    padding: 28,
    gap: 16,
  },
  label: {
    fontSize: 11,
    fontFamily: fonts.semiBold,
    color: colors.textTertiary,
    letterSpacing: 2,
  },
  heading: {
    fontSize: 34,
    fontFamily: fonts.bold,
    color: colors.textPrimary,
    lineHeight: 40,
  },
  body: {
    fontSize: 15,
    fontFamily: fonts.regular,
    color: '#AAAAAA',
    lineHeight: 23,
  },
  btn: {
    marginTop: 8,
    backgroundColor: colors.textPrimary,
    paddingVertical: 18,
    borderRadius: radius.pill,
    alignItems: 'center',
  },
  btnText: {
    color: colors.bg,
    fontSize: 17,
    fontFamily: fonts.bold,
  },
});
