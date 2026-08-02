import { useEffect, useRef, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, Animated, Dimensions, Easing, Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Feather } from '@expo/vector-icons';
import { useHaptics } from '../../context/HapticsContext';
import { colors, fonts, radius } from '../../constants/theme';

const SCREEN_WIDTH = Dimensions.get('window').width;
const CARD_W       = 210;
const CARD_GAP     = 12;

const BEAT0_IMAGES = {
  A: require('../../assets/onboarding/beat0_A.jpg'),
  B: require('../../assets/onboarding/beat0_B.jpg'),
};

const TIMELINE_IMAGES = {
  '2021': require('../../assets/onboarding/timeline_2021.png'),
  '2022': require('../../assets/onboarding/timeline_2022.jpg'),
  '2023': require('../../assets/onboarding/timeline_2023.jpg'),
  '2024': require('../../assets/onboarding/timeline_2024.jpg'),
  '2025': require('../../assets/onboarding/timeline_2025.jpg'),
  '2026': require('../../assets/onboarding/timeline_2026.jpg'),
};

const YEARS = [
  { year: '2021', sub: "You'd know instantly"   },
  { year: '2022', sub: 'Something felt off'     },
  { year: '2023', sub: 'Hard to be sure'        },
  { year: '2024', sub: 'Getting harder'         },
  { year: '2025', sub: 'Most people missed it'  },
  { year: '2026', sub: 'Almost no one can tell' },
  { year: '2027', sub: 'What comes next?', isQuestion: true },
];

function easeInOutCubic(t) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

async function markSeen() {
  await AsyncStorage.setItem('hasSeenThesis', 'true');
}

// ─── Pulsing tap circle (shared across all beats) ────────────────────────────

function PulseCircle({ onPress, icon = 'arrow-right', danger = false }) {
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 1900, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 1900, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ])
    ).start();
  }, []);

  const scale   = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.97, 1.03] });
  const opacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1.0]  });

  return (
    <Animated.View style={{ transform: [{ scale }], opacity }}>
      <TouchableOpacity
        style={[styles.pulseCircle, danger && styles.pulseCircleDanger]}
        onPress={onPress}
        activeOpacity={0.7}
      >
        <Feather name={icon} size={22} color={danger ? colors.incorrect : colors.textPrimary} />
      </TouchableOpacity>
    </Animated.View>
  );
}

// ─── Root screen ─────────────────────────────────────────────────────────────

export default function ThesisScreen({ navigation }) {
  const { medium } = useHaptics();
  const [beat, setBeat] = useState(0);
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const redFlash = useRef(new Animated.Value(0)).current;

  function triggerFlash() {
    redFlash.setValue(0);
    Animated.sequence([
      Animated.timing(redFlash, { toValue: 0.38, duration: 140,  easing: Easing.out(Easing.ease), useNativeDriver: true }),
      Animated.timing(redFlash, { toValue: 0,    duration: 1100, easing: Easing.out(Easing.ease), useNativeDriver: true }),
    ]).start();
  }

  function advanceBeat() {
    medium();
    redFlash.stopAnimation();
    redFlash.setValue(0);
    Animated.timing(fadeAnim, {
      toValue: 0, duration: 180, easing: Easing.out(Easing.ease), useNativeDriver: true,
    }).start(() => {
      setBeat(b => b + 1);
      // Wait one frame for React to commit the new beat before fading in,
      // otherwise the old beat briefly fades back in on the native thread.
      requestAnimationFrame(() => {
        Animated.timing(fadeAnim, {
          toValue: 1, duration: 300, easing: Easing.out(Easing.ease), useNativeDriver: true,
        }).start();
      });
    });
  }

  async function finish() {
    medium();
    await markSeen();
    navigation.replace('Onboarding');
  }

  async function skip() {
    redFlash.stopAnimation();
    redFlash.setValue(0);
    await markSeen();
    navigation.replace('Onboarding');
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.topBar}>
        <View style={styles.topBarSpacer} />
        <View style={styles.dotsRow}>
          {[0, 1, 2, 3].map(i => (
            <View key={i} style={[styles.dot, i === beat && styles.dotActive]} />
          ))}
        </View>
        <TouchableOpacity style={styles.skipBtn} onPress={skip}>
          <Text style={styles.skipText}>Skip</Text>
        </TouchableOpacity>
      </View>

      <Animated.View style={[styles.content, { opacity: fadeAnim }]}>
        {beat === 0 && <Beat0 onFlash={triggerFlash} onNext={advanceBeat} />}
        {beat === 1 && <Beat1 onNext={advanceBeat} />}
        {beat === 2 && <Beat2 onNext={advanceBeat} />}
        {beat === 3 && <Beat3 onFinish={finish} />}
      </Animated.View>

      <Animated.View
        pointerEvents="none"
        style={[StyleSheet.absoluteFillObject, { backgroundColor: colors.incorrect, opacity: redFlash }]}
      />
    </SafeAreaView>
  );
}

// ─── Beat 0: The gut punch ────────────────────────────────────────────────────

function Beat0({ onFlash, onNext }) {
  const { heavy, medium, error } = useHaptics();
  const BOX_W = (SCREEN_WIDTH - 48 - 12) / 2;
  const BOX_H = BOX_W * 1.55;

  const [stage, setStage] = useState(0);

  const promptAlpha  = useRef(new Animated.Value(0)).current;
  const promptY      = useRef(new Animated.Value(12)).current;
  const neitherAlpha = useRef(new Animated.Value(0)).current;
  const neitherScale = useRef(new Animated.Value(0.88)).current;
  const subAlpha     = useRef(new Animated.Value(0)).current;
  const circleAlpha  = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(promptAlpha, { toValue: 1, duration: 750, easing: Easing.out(Easing.ease),  useNativeDriver: true }),
      Animated.timing(promptY,     { toValue: 0, duration: 750, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
    ]).start();
  }, []);

  function handleTap() {
    if (stage > 0) return;
    heavy();
    onFlash();
    setTimeout(() => error(), 150);

    setStage(1);
    Animated.parallel([
      Animated.timing(neitherAlpha, { toValue: 1, duration: 480, easing: Easing.out(Easing.ease),  useNativeDriver: true }),
      Animated.timing(neitherScale, { toValue: 1, duration: 480, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
    ]).start();

    // Sub text + image reveal after a beat
    setTimeout(() => {
      medium();
      setStage(2);
      Animated.timing(subAlpha, {
        toValue: 1, duration: 600, easing: Easing.out(Easing.ease), useNativeDriver: true,
      }).start(() => {
        // Extra beat after everything settles before circle appears
        setTimeout(() => {
          Animated.timing(circleAlpha, {
            toValue: 1, duration: 420, easing: Easing.out(Easing.ease), useNativeDriver: true,
          }).start();
        }, 1400);
      });
    }, 1100);
  }

  return (
    <View style={styles.beat}>
      <View style={styles.beat0Middle}>
        {stage === 0 && (
          <Animated.View style={{ opacity: promptAlpha, transform: [{ translateY: promptY }] }}>
            <Text style={styles.headline}>Tap the photo{'\n'}you think is real.</Text>
          </Animated.View>
        )}

        {stage > 0 && (
          <View>
            <Animated.Text
              style={[styles.neitherText, { opacity: neitherAlpha, transform: [{ scale: neitherScale }] }]}
            >
              Neither.
            </Animated.Text>
            <Animated.Text style={[styles.subSpaced, { opacity: subAlpha }]}>
              Both images were generated by AI.
            </Animated.Text>
          </View>
        )}

        <View style={styles.imageRow}>
          {['A', 'B'].map(label => (
            <TouchableOpacity
              key={label}
              onPress={handleTap}
              activeOpacity={stage > 0 ? 1 : 0.75}
              style={[
                styles.imagePlaceholder,
                { width: BOX_W, height: BOX_H },
                stage >= 2 && styles.imagePlaceholderRevealed,
              ]}
            >
              <Image
                source={BEAT0_IMAGES[label]}
                style={StyleSheet.absoluteFillObject}
                resizeMode="cover"
              />
              {stage >= 2 && (
                <Animated.View style={[styles.beat0Overlay, { opacity: subAlpha }]}>
                  <Text style={styles.beat0OverlayText}>AI generated</Text>
                </Animated.View>
              )}
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <Animated.View style={[styles.circleBottom, { opacity: circleAlpha }]}>
        <PulseCircle onPress={onNext} />
      </Animated.View>
    </View>
  );
}

// ─── Beat 1: The timeline ─────────────────────────────────────────────────────

function Beat1({ onNext }) {
  const { light } = useHaptics();
  const scrollRef     = useRef(null);
  const headlineAlpha = useRef(new Animated.Value(0)).current;
  const headlineY     = useRef(new Animated.Value(12)).current;
  const footerAlpha   = useRef(new Animated.Value(0)).current;
  const footerY       = useRef(new Animated.Value(10)).current;
  const circleAlpha   = useRef(new Animated.Value(0)).current;
  const cardAnims     = useRef(YEARS.map(() => ({
    opacity:    new Animated.Value(0),
    translateX: new Animated.Value(30),
  }))).current;

  useEffect(() => {
    // 1. Headline fades up
    Animated.parallel([
      Animated.timing(headlineAlpha, { toValue: 1, duration: 520, easing: Easing.out(Easing.ease),  useNativeDriver: true }),
      Animated.timing(headlineY,     { toValue: 0, duration: 520, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
    ]).start();

    // 2. Timeline starts after headline settles + a deliberate pause
    const BASE_DELAY = 1300;

    YEARS.forEach((_, i) => {
      setTimeout(() => {
        light();
        Animated.parallel([
          Animated.timing(cardAnims[i].opacity, {
            toValue: 1, duration: 400, easing: Easing.out(Easing.ease), useNativeDriver: true,
          }),
          Animated.timing(cardAnims[i].translateX, {
            toValue: 0, duration: 400, easing: Easing.out(Easing.cubic), useNativeDriver: true,
          }),
        ]).start();

        const targetX = Math.max(0, i * (CARD_W + CARD_GAP) - 60);
        setTimeout(() => scrollRef.current?.scrollTo({ x: targetX, animated: true }), 80);

        // 3. After last card: beat, then footer fades in, then circle
        if (i === YEARS.length - 1) {
          setTimeout(() => {
            Animated.parallel([
              Animated.timing(footerAlpha, { toValue: 1, duration: 480, easing: Easing.out(Easing.ease),  useNativeDriver: true }),
              Animated.timing(footerY,     { toValue: 0, duration: 480, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
            ]).start(() => {
              setTimeout(() => {
                Animated.timing(circleAlpha, {
                  toValue: 1, duration: 360, easing: Easing.out(Easing.ease), useNativeDriver: true,
                }).start();
              }, 1800);
            });
          }, 1400);
        }
      }, BASE_DELAY + i * 1150);
    });
  }, []);

  return (
    <View style={[styles.beat, { paddingBottom: 36 }]}>
      <Animated.Text style={[styles.headline, { marginTop: 28, opacity: headlineAlpha, transform: [{ translateY: headlineY }] }]}>
        AI is advancing fast.
      </Animated.Text>

      <ScrollView
        ref={scrollRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.timelineScroll}
        contentContainerStyle={styles.timelineContent}
      >
        {YEARS.map(({ year, isQuestion }, i) => (
          <Animated.View
            key={year}
            style={[
              styles.yearCard,
              {
                opacity:   cardAnims[i].opacity,
                transform: [{ translateX: cardAnims[i].translateX }],
              },
            ]}
          >
            <View style={[styles.yearBox, isQuestion && styles.yearBoxQuestion]}>
              {isQuestion
                ? <Text style={styles.questionMark}>?</Text>
                : <Image
                    source={TIMELINE_IMAGES[year]}
                    style={styles.yearBoxImage}
                    resizeMode="cover"
                  />
              }
            </View>
            <Text style={[styles.yearLabel, isQuestion && styles.yearLabelDim]}>{year}</Text>
          </Animated.View>
        ))}
      </ScrollView>

      <Animated.Text style={[styles.beat1Closer, { opacity: footerAlpha, transform: [{ translateY: footerY }] }]}>
        What looked fake years ago is almost undetectable today.
      </Animated.Text>

      <Animated.View style={[styles.circleBottom, { opacity: circleAlpha }]}>
        <PulseCircle onPress={onNext} />
      </Animated.View>
    </View>
  );
}

// ─── Beat 2: The statistic ────────────────────────────────────────────────────

// Stat sourced from Microsoft/LinkedIn AI research (2024).
const STAT_TARGET = 62;

const PHASE_CONFIG = {
  1: { prefix: '',  target: 216,  unit: 'million',  isDecimal: false, label: "Americans can't tell.",     sub: null,              danger: false },
  2: { prefix: '',  target: 5.15, unit: 'billion',  isDecimal: true,  label: 'people across the globe.',  sub: null,              danger: false },
  3: { prefix: '$', target: 893,  unit: 'million',  isDecimal: false, label: 'lost to AI scams.',         sub: 'Just last year.', danger: true  },
};

function Beat2({ onNext }) {
  const { light, medium, heavy } = useHaptics();
  const [statNum, setStatNum]     = useState(0);
  const [phase, setPhase]         = useState(0);
  const [impactVal, setImpactVal] = useState(0);

  const scaleAnim   = useRef(new Animated.Value(0.78)).current;
  const alphaAnim   = useRef(new Animated.Value(0)).current;
  const circleAlpha = useRef(new Animated.Value(0)).current;
  const hapticTimer = useRef(null);
  const impactTimer = useRef(null);

  // Phase 0 exit
  const phase0Y     = useRef(new Animated.Value(0)).current;
  const phase0Alpha = useRef(new Animated.Value(1)).current;

  // Phase 1-3 entry / exit (reused)
  const contentY     = useRef(new Animated.Value(60)).current;
  const contentAlpha = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(scaleAnim, { toValue: 1, duration: 420, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.timing(alphaAnim, { toValue: 1, duration: 420, easing: Easing.out(Easing.ease),  useNativeDriver: true }),
    ]).start(() => setTimeout(startStatCountUp, 250));
    return () => {
      clearInterval(hapticTimer.current);
      clearInterval(impactTimer.current);
    };
  }, []);

  function startStatCountUp() {
    const duration  = 1600;
    const startTime = Date.now();
    hapticTimer.current = setInterval(() => medium(), 90);

    const tick = () => {
      const elapsed  = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      setStatNum(Math.round(easeInOutCubic(progress) * STAT_TARGET));

      if (progress < 1) {
        requestAnimationFrame(tick);
      } else {
        clearInterval(hapticTimer.current);
        setStatNum(STAT_TARGET);
        heavy();
        setTimeout(() => {
          Animated.timing(circleAlpha, {
            toValue: 1, duration: 360, easing: Easing.out(Easing.ease), useNativeDriver: true,
          }).start();
        }, 600);
      }
    };
    requestAnimationFrame(tick);
  }

  function startImpactCountUp(targetPhase) {
    const cfg      = PHASE_CONFIG[targetPhase];
    const duration = 1000;
    const startTime = Date.now();
    setImpactVal(0);
    impactTimer.current = setInterval(() => light(), 65);

    const tick = () => {
      const elapsed  = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const val = easeInOutCubic(progress) * cfg.target;
      setImpactVal(cfg.isDecimal ? val : Math.round(val));

      if (progress < 1) {
        requestAnimationFrame(tick);
      } else {
        clearInterval(impactTimer.current);
        setImpactVal(cfg.target);
        heavy();
        setTimeout(() => {
          Animated.timing(circleAlpha, {
            toValue: 1, duration: 360, easing: Easing.out(Easing.ease), useNativeDriver: true,
          }).start();
        }, 600);
      }
    };
    requestAnimationFrame(tick);
  }

  function advancePhase() {
    medium();
    clearInterval(impactTimer.current);
    const isLast = phase === 3;

    Animated.timing(circleAlpha, {
      toValue: 0, duration: 180, easing: Easing.in(Easing.ease), useNativeDriver: true,
    }).start();

    const slideOut = phase === 0
      ? Animated.parallel([
          Animated.timing(phase0Y,     { toValue: -110, duration: 340, easing: Easing.in(Easing.ease), useNativeDriver: true }),
          Animated.timing(phase0Alpha, { toValue: 0,    duration: 280, easing: Easing.in(Easing.ease), useNativeDriver: true }),
        ])
      : Animated.parallel([
          Animated.timing(contentY,     { toValue: -110, duration: 340, easing: Easing.in(Easing.ease), useNativeDriver: true }),
          Animated.timing(contentAlpha, { toValue: 0,    duration: 280, easing: Easing.in(Easing.ease), useNativeDriver: true }),
        ]);

    slideOut.start(() => {
      if (isLast) { onNext(); return; }

      const newPhase = phase + 1;
      contentY.setValue(60);
      contentAlpha.setValue(0);
      circleAlpha.setValue(0);
      setImpactVal(0);   // must be set before setPhase so both batch into one render
      setPhase(newPhase);

      Animated.parallel([
        Animated.timing(contentY,     { toValue: 0, duration: 420, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
        Animated.timing(contentAlpha, { toValue: 1, duration: 420, easing: Easing.out(Easing.ease),  useNativeDriver: true }),
      ]).start(() => startImpactCountUp(newPhase));
    });
  }

  function renderImpact() {
    if (phase === 0) return null;
    const cfg    = PHASE_CONFIG[phase];
    const numStr = cfg.isDecimal ? Number(impactVal).toFixed(2) : String(impactVal);
    const accent = cfg.danger && styles.impactNumberDanger;
    return (
      <Animated.View style={[styles.impactBlock, { opacity: contentAlpha, transform: [{ translateY: contentY }] }]}>
        <Text style={[styles.impactNumber, accent]}>{cfg.prefix}{numStr}</Text>
        <Text style={[styles.impactUnit, accent]}>{cfg.unit}</Text>
        <Text style={styles.impactLabel}>{cfg.label}</Text>
        {cfg.sub && <Text style={styles.impactSub}>{cfg.sub}</Text>}
      </Animated.View>
    );
  }

  return (
    <View style={[styles.beat, styles.beatCentered]}>
      {phase === 0 && (
        <Animated.View style={{ opacity: phase0Alpha, transform: [{ translateY: phase0Y }] }}>
          <Animated.Text style={[styles.statNumber, { opacity: alphaAnim, transform: [{ scale: scaleAnim }] }]}>
            {statNum}%
          </Animated.Text>
          <Animated.Text style={[styles.statLabel, { opacity: alphaAnim }]}>
            of people can't reliably identify AI-generated images.
          </Animated.Text>
        </Animated.View>
      )}

      {renderImpact()}

      <Animated.View style={[styles.circleWrap, { opacity: circleAlpha }]}>
        <PulseCircle onPress={advancePhase} icon="arrow-down" danger={phase === 3} />
      </Animated.View>
    </View>
  );
}

// ─── Beat 3: The mission (automatic sequence) ────────────────────────────────

function Beat3({ onFinish }) {
  const headlineAlpha = useRef(new Animated.Value(0)).current;
  const headlineY     = useRef(new Animated.Value(14)).current;
  const subAlpha      = useRef(new Animated.Value(0)).current;
  const finalBtnAlpha = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.parallel([
        Animated.timing(headlineAlpha, { toValue: 1, duration: 560, easing: Easing.out(Easing.ease),  useNativeDriver: true }),
        Animated.timing(headlineY,     { toValue: 0, duration: 560, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      ]),
      Animated.delay(2000),
      Animated.timing(subAlpha,      { toValue: 1, duration: 480, easing: Easing.out(Easing.ease), useNativeDriver: true }),
      Animated.delay(900),
      Animated.timing(finalBtnAlpha, { toValue: 1, duration: 360, easing: Easing.out(Easing.ease), useNativeDriver: true }),
    ]).start();
  }, []);

  return (
    <View style={[styles.beat, styles.beatCentered]}>
      <Animated.Text
        style={[styles.missionHeadline, { opacity: headlineAlpha, transform: [{ translateY: headlineY }] }]}
      >
        {'Your perception\nis a skill.'}
      </Animated.Text>

      <Animated.Text style={[styles.missionSecondary, { opacity: subAlpha }]}>
        Let's train it.
      </Animated.Text>

      <Animated.View style={[styles.btnStretched, { opacity: finalBtnAlpha }]}>
        <TouchableOpacity style={styles.btn} onPress={onFinish}>
          <Text style={styles.btnText}>I'm ready</Text>
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },

  topBar:       { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8 },
  topBarSpacer: { width: 52 },
  dotsRow:      { flex: 1, flexDirection: 'row', justifyContent: 'center', gap: 6 },
  dot:          { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.surface2 },
  dotActive:    { width: 18, backgroundColor: colors.textPrimary },
  skipBtn:      { width: 52, alignItems: 'flex-end', padding: 4 },
  skipText:     { fontSize: 15, fontFamily: fonts.medium, color: colors.textSecondary },

  content:      { flex: 1 },

  beat:         { flex: 1, paddingHorizontal: 24, paddingBottom: 32, justifyContent: 'space-between' },
  beatCentered: { alignItems: 'center', justifyContent: 'center' },

  beat0Middle:  { flex: 1, justifyContent: 'center', gap: 36 },

  headline:   { fontSize: 38, fontFamily: fonts.bold, color: colors.textPrimary, lineHeight: 46, textAlign: 'center' },
  neitherText:{ fontSize: 54, fontFamily: fonts.bold, color: colors.textPrimary, lineHeight: 64, textAlign: 'center' },
  sub:        { fontSize: 17, fontFamily: fonts.regular, color: '#B0B0B0', lineHeight: 26, textAlign: 'center', marginTop: 14 },
  subSpaced:  { fontSize: 20, fontFamily: fonts.regular, color: colors.textPrimary, lineHeight: 28, textAlign: 'center', marginTop: 20 },

  imageRow:                 { flexDirection: 'row', gap: 12, justifyContent: 'center' },
  imagePlaceholder:         { backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1.5, borderColor: colors.border, overflow: 'hidden' },
  imagePlaceholderRevealed: { borderColor: colors.incorrect },
  beat0Overlay:             { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'flex-end', paddingBottom: 14 },
  beat0OverlayText:         { fontSize: 13, fontFamily: fonts.semiBold, color: colors.incorrect, letterSpacing: 0.5 },

  timelineScroll:  { flexGrow: 0, marginVertical: 16 },
  timelineContent: { paddingHorizontal: 24, gap: CARD_GAP },
  yearCard:        { alignItems: 'center', gap: 8, width: CARD_W },
  yearBox:         { width: CARD_W, height: 284, backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1.5, borderColor: colors.border, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  yearBoxQuestion: { borderColor: colors.textTertiary },
  yearBoxImage:    { width: '100%', height: '100%' },
  questionMark:    { fontSize: 52, color: colors.textSecondary },
  yearLabel:       { fontSize: 22, fontFamily: fonts.bold, color: colors.textPrimary },
  yearLabelDim:    { color: colors.textSecondary },
  yearSub:         { fontSize: 14, fontFamily: fonts.regular, color: colors.textSecondary, textAlign: 'center' },

  statNumber: { fontSize: 128, fontFamily: fonts.bold, color: colors.textPrimary, lineHeight: 136, textAlign: 'center' },
  statLabel:  { fontSize: 28, fontFamily: fonts.semiBold, color: colors.textPrimary, textAlign: 'center', lineHeight: 36, marginTop: 10, paddingHorizontal: 8 },
  impactBlock:        { alignItems: 'center' },
  impactNumber:       { fontSize: 80, fontFamily: fonts.bold, color: colors.textPrimary, lineHeight: 86, textAlign: 'center' },
  impactUnit:         { fontSize: 80, fontFamily: fonts.bold, color: colors.textPrimary, lineHeight: 86, textAlign: 'center' },
  impactNumberDanger: { color: colors.incorrect },
  impactLabel:        { fontSize: 33, fontFamily: fonts.semiBold, color: colors.textPrimary, textAlign: 'center', lineHeight: 41, marginTop: 12 },
  impactSub:          { fontSize: 26, fontFamily: fonts.semiBold, color: colors.textPrimary, textAlign: 'center', marginTop: 8 },

  beat1Closer: { fontSize: 26, fontFamily: fonts.semiBold, color: colors.textPrimary, lineHeight: 34, textAlign: 'center' },

  missionHeadline: { fontSize: 42, fontFamily: fonts.bold, color: colors.textPrimary, textAlign: 'center', lineHeight: 52, marginBottom: 36 },
  missionSub:      { fontSize: 18, fontFamily: fonts.regular, color: '#B0B0B0', textAlign: 'center', lineHeight: 28, paddingHorizontal: 8 },
  missionSecondary:{ fontSize: 42, fontFamily: fonts.bold, color: colors.textPrimary, textAlign: 'center', lineHeight: 52 },

  pulseCircle:       { width: 64, height: 64, borderRadius: 32, borderWidth: 1.5, borderColor: colors.textPrimary, alignItems: 'center', justifyContent: 'center' },
  pulseCircleDanger: { borderColor: colors.incorrect },
  circleBottom: { alignItems: 'center', marginBottom: 8 },
  circleWrap:   { marginTop: 52, alignItems: 'center', height: 64 },
  circleSpacer: { height: 64 },

  btn:         { backgroundColor: colors.textPrimary, paddingVertical: 18, borderRadius: radius.pill, alignItems: 'center' },
  btnStretched:{ marginTop: 48, alignSelf: 'stretch' },
  btnText:     { color: colors.bg, fontSize: 17, fontFamily: fonts.bold },
});
