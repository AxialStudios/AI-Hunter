import { useState } from 'react';
import {
  View, Text, Image, TouchableOpacity,
  ScrollView, StyleSheet, Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, fonts, radius } from '../../constants/theme';

const { width } = Dimensions.get('window');

export default function ResultsScreen({ route, navigation }) {
  const { result, task } = route.params;
  const { was_correct, real_pct, ai_pct, total_votes } = result;
  const [showTells, setShowTells] = useState(false);

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>

        <Text style={[styles.verdict, was_correct ? styles.verdictCorrect : styles.verdictIncorrect]}>
          {was_correct ? 'Correct!' : 'Fooled!'}
        </Text>
        <Text style={styles.subtitle}>
          {was_correct ? 'You spotted the real image.' : 'You picked the AI image.'}
        </Text>

        <View style={styles.voteSection}>
          <Text style={styles.voteSectionTitle}>How everyone voted</Text>

          <View style={styles.splitBarWrapper}>
            <View style={styles.splitBarSide}>
              <Text style={[styles.splitPct, { color: colors.correct }]}>{real_pct}%</Text>
              <Text style={styles.splitLabel}>Real</Text>
            </View>
            <View style={styles.splitBar}>
              <View style={[styles.splitLeft,  { flex: real_pct }]} />
              <View style={styles.splitDivider} />
              <View style={[styles.splitRight, { flex: ai_pct }]} />
            </View>
            <View style={styles.splitBarSide}>
              <Text style={[styles.splitPct, { color: colors.incorrect }]}>{ai_pct}%</Text>
              <Text style={styles.splitLabel}>AI</Text>
            </View>
          </View>

          <Text style={styles.totalVotes}>{total_votes.toLocaleString()} votes</Text>
        </View>

        <TouchableOpacity
          style={styles.tellsBtn}
          onPress={() => setShowTells(v => !v)}
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
          onPress={() => navigation.navigate('Gameplay')}
        >
          <Text style={styles.nextBtnText}>Next Card  →</Text>
        </TouchableOpacity>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:             { flex: 1, backgroundColor: colors.bg },
  container:        { alignItems: 'center', padding: 24, paddingBottom: 48 },

  verdict:          { fontSize: 52, fontFamily: fonts.bold, marginTop: 16, marginBottom: 6 },
  verdictCorrect:   { color: colors.correct },
  verdictIncorrect: { color: colors.incorrect },
  subtitle:         { fontSize: 15, fontFamily: fonts.medium, color: colors.textSecondary, marginBottom: 40 },

  voteSection:      { width: '100%', marginBottom: 32 },
  voteSectionTitle: { fontSize: 11, fontFamily: fonts.semiBold, color: colors.textTertiary, textTransform: 'uppercase', letterSpacing: 1.2, textAlign: 'center', marginBottom: 20 },

  splitBarWrapper:  { flexDirection: 'row', alignItems: 'center', gap: 12 },
  splitBarSide:     { width: 52, alignItems: 'center' },
  splitPct:         { fontSize: 20, fontFamily: fonts.bold },
  splitLabel:       { fontSize: 11, fontFamily: fonts.medium, color: colors.textSecondary, marginTop: 2 },
  splitBar:         { flex: 1, height: 36, flexDirection: 'row', borderRadius: radius.md, overflow: 'hidden' },
  splitLeft:        { backgroundColor: colors.correct },
  splitDivider:     { width: 2, backgroundColor: colors.bg },
  splitRight:       { backgroundColor: colors.incorrect },
  totalVotes:       { textAlign: 'center', fontSize: 12, fontFamily: fonts.regular, color: colors.textTertiary, marginTop: 16 },

  tellsBtn:         { paddingVertical: 12, paddingHorizontal: 28, borderWidth: 1.5, borderColor: colors.border, borderRadius: radius.pill, marginBottom: 24 },
  tellsBtnText:     { fontSize: 14, fontFamily: fonts.semiBold, color: colors.textSecondary },

  tellsSection:     { width: '100%', marginBottom: 32 },
  tellsHeading:     { fontSize: 16, fontFamily: fonts.bold, color: colors.textPrimary, marginBottom: 14 },
  aiImage:          { width: '100%', aspectRatio: 0.9, borderRadius: radius.lg, marginBottom: 24 },
  tellsSubheading:  { fontSize: 11, fontFamily: fonts.semiBold, color: colors.textTertiary, textTransform: 'uppercase', letterSpacing: 1.2, marginBottom: 12 },
  tellCard:         { backgroundColor: colors.surface, borderRadius: radius.md, padding: 14, marginBottom: 10 },
  tellLabel:        { fontSize: 14, fontFamily: fonts.semiBold, color: colors.textPrimary, marginBottom: 4 },
  tellDescription:  { fontSize: 14, fontFamily: fonts.regular, color: colors.textSecondary, lineHeight: 20 },

  nextBtn:          { backgroundColor: colors.textPrimary, paddingVertical: 18, paddingHorizontal: 48, borderRadius: radius.pill },
  nextBtnText:      { color: colors.bg, fontSize: 17, fontFamily: fonts.bold },
});
