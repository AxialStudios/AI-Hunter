import { useState, useRef, useEffect } from 'react';
import {
  View, Text, Image, Animated, TouchableOpacity,
  ScrollView, StyleSheet, Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useHaptics } from '../../context/HapticsContext';
import { supabase } from '../../lib/supabase';
import { prefetchNextTask } from '../../lib/taskCache';
import { colors, fonts, radius } from '../../constants/theme';

const { width: SW } = Dimensions.get('window');
const CARD_W = Math.floor((SW - 32 - 10) / 2);
const CARD_H = Math.floor(CARD_W / 0.5); // match GameplayScreen aspectRatio

const CORRECT_FILL   = 'rgba(34,197,94,0.72)';
const INCORRECT_FILL = 'rgba(239,68,68,0.72)';

export default function ResultsScreen({ route, navigation }) {
  const { result, task, leftIsReal } = route.params;
  const { was_correct, real_pct, ai_pct, total_votes } = result;
  const { light } = useHaptics();
  const [showTells, setShowTells] = useState(false);

  const leftPct   = leftIsReal ? real_pct : ai_pct;
  const rightPct  = leftIsReal ? ai_pct   : real_pct;
  const leftFill  = leftIsReal  ? CORRECT_FILL   : INCORRECT_FILL;
  const rightFill = !leftIsReal ? CORRECT_FILL   : INCORRECT_FILL;
  const leftColor  = leftIsReal  ? colors.correct   : colors.incorrect;
  const rightColor = !leftIsReal ? colors.correct   : colors.incorrect;
  const leftSymbol  = leftIsReal  ? '✓' : '✗';
  const rightSymbol = !leftIsReal ? '✓' : '✗';

  const leftUrl  = leftIsReal ? task.real_image_url : task.ai_image_url;
  const rightUrl = leftIsReal ? task.ai_image_url   : task.real_image_url;

  const leftAnim  = useRef(new Animated.Value(0)).current;
  const rightAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Kick off next-card prefetch while user reads their result
    prefetchNextTask(supabase);

    // Animate fills after a short pause
    const t = setTimeout(() => {
      Animated.parallel([
        Animated.timing(leftAnim, {
          toValue: CARD_H * leftPct / 100,
          duration: 700,
          useNativeDriver: false,
        }),
        Animated.timing(rightAnim, {
          toValue: CARD_H * rightPct / 100,
          duration: 700,
          useNativeDriver: false,
        }),
      ]).start();
    }, 250);
    return () => clearTimeout(t);
  }, []);

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>

        {/* Verdict */}
        <Text style={[styles.verdict, was_correct ? styles.verdictCorrect : styles.verdictIncorrect]}>
          {was_correct ? 'Correct!' : 'Fooled!'}
        </Text>
        <Text style={styles.subtitle}>
          {was_correct ? 'You spotted the real image.' : 'You picked the AI image.'}
        </Text>

        {/* Percentage labels above images */}
        <View style={styles.pctRow}>
          <View style={styles.pctSide}>
            <Text style={[styles.pctSymbol, { color: leftColor }]}>{leftSymbol}</Text>
            <Text style={[styles.pctNumber, { color: leftColor }]}>{leftPct}%</Text>
            <Text style={styles.pctTag}>{leftIsReal ? 'REAL' : 'AI'}</Text>
          </View>
          <View style={styles.pctSide}>
            <Text style={[styles.pctSymbol, { color: rightColor }]}>{rightSymbol}</Text>
            <Text style={[styles.pctNumber, { color: rightColor }]}>{rightPct}%</Text>
            <Text style={styles.pctTag}>{!leftIsReal ? 'REAL' : 'AI'}</Text>
          </View>
        </View>

        {/* Images with animated fill from bottom */}
        <View style={styles.imageRow}>
          <View style={styles.imageWrapper}>
            <Image source={{ uri: leftUrl }} style={styles.image} resizeMode="cover" />
            <Animated.View style={[styles.fill, { height: leftAnim, backgroundColor: leftFill }]} />
          </View>

          <View style={styles.imageWrapper}>
            <Image source={{ uri: rightUrl }} style={styles.image} resizeMode="cover" />
            <Animated.View style={[styles.fill, { height: rightAnim, backgroundColor: rightFill }]} />
          </View>
        </View>

        <Text style={styles.totalVotes}>{total_votes.toLocaleString()} total votes</Text>

        {/* Tells */}
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
            <Image
              source={{ uri: task.ai_image_url }}
              style={styles.aiImage}
              resizeMode="cover"
            />
            <Text style={styles.tellsSubheading}>What to look for</Text>
            {task.tell_annotations.map((tell, i) => (
              <View key={i} style={styles.tellCard}>
                <Text style={styles.tellLabel}>{tell.label}</Text>
                <Text style={styles.tellDescription}>{tell.description}</Text>
              </View>
            ))}
          </View>
        )}

        <TouchableOpacity
          style={styles.nextBtn}
          onPress={() => { light(); navigation.navigate('Gameplay'); }}
        >
          <Text style={styles.nextBtnText}>Next Card  →</Text>
        </TouchableOpacity>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:             { flex: 1, backgroundColor: colors.bg },
  container:        { alignItems: 'center', padding: 24, paddingBottom: 48, gap: 16 },

  verdict:          { fontSize: 44, fontFamily: fonts.bold, textAlign: 'center' },
  verdictCorrect:   { color: colors.correct },
  verdictIncorrect: { color: colors.incorrect },
  subtitle:         { fontSize: 15, fontFamily: fonts.medium, color: colors.textSecondary, textAlign: 'center', marginTop: -8 },

  pctRow:    { flexDirection: 'row', width: '100%', gap: 10 },
  pctSide:   { flex: 1, alignItems: 'center', gap: 2 },
  pctSymbol: { fontSize: 28, fontFamily: fonts.bold },
  pctNumber: { fontSize: 22, fontFamily: fonts.bold, marginTop: -4 },
  pctTag:    { fontSize: 10, fontFamily: fonts.semiBold, color: colors.textTertiary, letterSpacing: 1.5 },

  imageRow:    { flexDirection: 'row', width: '100%', gap: 10 },
  imageWrapper: { flex: 1, aspectRatio: 0.5, borderRadius: radius.lg, overflow: 'hidden', backgroundColor: colors.surface },
  image:        { width: '100%', height: '100%' },
  fill:         { position: 'absolute', bottom: 0, left: 0, right: 0 },

  totalVotes: { fontSize: 12, fontFamily: fonts.regular, color: colors.textTertiary, marginTop: -4 },

  tellsBtn:     { paddingVertical: 12, paddingHorizontal: 28, borderWidth: 1.5, borderColor: colors.border, borderRadius: radius.pill },
  tellsBtnText: { fontSize: 14, fontFamily: fonts.semiBold, color: colors.textSecondary },

  tellsSection:    { width: '100%', gap: 12 },
  tellsHeading:    { fontSize: 16, fontFamily: fonts.bold, color: colors.textPrimary },
  aiImage:         { width: '100%', aspectRatio: 0.9, borderRadius: radius.lg },
  tellsSubheading: { fontSize: 11, fontFamily: fonts.semiBold, color: colors.textTertiary, textTransform: 'uppercase', letterSpacing: 1.2 },
  tellCard:        { backgroundColor: colors.surface, borderRadius: radius.md, padding: 14, gap: 4 },
  tellLabel:       { fontSize: 14, fontFamily: fonts.semiBold, color: colors.textPrimary },
  tellDescription: { fontSize: 14, fontFamily: fonts.regular, color: colors.textSecondary, lineHeight: 20 },

  nextBtn:     { backgroundColor: colors.textPrimary, paddingVertical: 18, paddingHorizontal: 48, borderRadius: radius.pill },
  nextBtnText: { color: colors.bg, fontSize: 17, fontFamily: fonts.bold },
});
