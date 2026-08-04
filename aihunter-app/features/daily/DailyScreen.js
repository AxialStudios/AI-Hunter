import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { colors, fonts, radius } from '../../constants/theme';

const TODAY = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

const PAST_DAYS = [
  { date: 'Yesterday',   pairs: 5, correct: 4, streak: true  },
  { date: 'Thursday',    pairs: 5, correct: 5, streak: true  },
  { date: 'Wednesday',   pairs: 5, correct: 3, streak: false },
  { date: 'Tuesday',     pairs: 5, correct: 5, streak: true  },
];

export default function DailyScreen() {
  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.screenLabel}>DAILY CHALLENGE</Text>
          <Text style={styles.date}>{TODAY}</Text>
        </View>

        {/* Today's card */}
        <View style={styles.todayCard}>
          <View style={styles.todayTop}>
            <View style={styles.pairsRow}>
              {Array.from({ length: 5 }).map((_, i) => (
                <View key={i} style={styles.pairDot} />
              ))}
            </View>
            <Text style={styles.todayLabel}>5 pairs · one attempt</Text>
          </View>
          <View style={styles.divider} />
          <Text style={styles.todayDescription}>
            One set of pairs. No retries. Your score is locked in when you finish.
          </Text>
          <TouchableOpacity style={styles.playBtn} activeOpacity={0.85}>
            <Text style={styles.playBtnText}>Play Today's Challenge</Text>
          </TouchableOpacity>
          <Text style={styles.resets}>Resets at midnight  ·  UTC</Text>
        </View>

        {/* Streak row */}
        <View style={styles.streakRow}>
          <View style={styles.streakItem}>
            <Text style={styles.streakNum}>4</Text>
            <Text style={styles.streakMeta}>day streak</Text>
          </View>
          <View style={styles.streakDivider} />
          <View style={styles.streakItem}>
            <Text style={styles.streakNum}>12</Text>
            <Text style={styles.streakMeta}>days played</Text>
          </View>
          <View style={styles.streakDivider} />
          <View style={styles.streakItem}>
            <Text style={styles.streakNum}>74%</Text>
            <Text style={styles.streakMeta}>daily accuracy</Text>
          </View>
        </View>

        {/* Past days */}
        <Text style={styles.sectionLabel}>RECENT</Text>
        {PAST_DAYS.map((day, i) => (
          <View key={i} style={styles.pastRow}>
            <View style={styles.pastLeft}>
              <Text style={styles.pastDate}>{day.date}</Text>
              <Text style={styles.pastScore}>{day.correct}/{day.pairs} correct</Text>
            </View>
            <View style={styles.pastRight}>
              {day.streak && (
                <Feather name="zap" size={13} color="#F59E0B" style={{ marginRight: 6 }} />
              )}
              <View style={[styles.pastBadge, day.correct === day.pairs && styles.pastBadgePerfect]}>
                <Text style={[styles.pastBadgeText, day.correct === day.pairs && styles.pastBadgeTextPerfect]}>
                  {day.correct === day.pairs ? 'Perfect' : `${day.correct}/${day.pairs}`}
                </Text>
              </View>
            </View>
          </View>
        ))}

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: colors.bg },
  scroll: { paddingHorizontal: 20, paddingBottom: 32 },

  header:      { paddingTop: 20, paddingBottom: 28 },
  screenLabel: { fontSize: 11, fontFamily: fonts.semiBold, color: colors.textTertiary, letterSpacing: 2, marginBottom: 6 },
  date:        { fontSize: 28, fontFamily: fonts.bold, color: colors.textPrimary },

  todayCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: '#2A2A2A',
    padding: 22,
    gap: 16,
    marginBottom: 16,
  },
  todayTop:       { gap: 8 },
  pairsRow:       { flexDirection: 'row', gap: 6 },
  pairDot:        { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.textPrimary },
  todayLabel:     { fontSize: 13, fontFamily: fonts.medium, color: colors.textSecondary },
  divider:        { height: StyleSheet.hairlineWidth, backgroundColor: '#2A2A2A' },
  todayDescription: { fontSize: 15, fontFamily: fonts.regular, color: '#AAAAAA', lineHeight: 22 },
  playBtn:        { backgroundColor: colors.textPrimary, paddingVertical: 16, borderRadius: radius.pill, alignItems: 'center' },
  playBtnText:    { fontSize: 16, fontFamily: fonts.bold, color: colors.bg },
  resets:         { fontSize: 12, fontFamily: fonts.regular, color: colors.textTertiary, textAlign: 'center' },

  streakRow:     { flexDirection: 'row', backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: '#2A2A2A', marginBottom: 28 },
  streakItem:    { flex: 1, alignItems: 'center', paddingVertical: 18, gap: 4 },
  streakDivider: { width: StyleSheet.hairlineWidth, backgroundColor: '#2A2A2A', marginVertical: 14 },
  streakNum:     { fontSize: 22, fontFamily: fonts.bold, color: colors.textPrimary },
  streakMeta:    { fontSize: 11, fontFamily: fonts.regular, color: colors.textSecondary },

  sectionLabel: { fontSize: 11, fontFamily: fonts.semiBold, color: colors.textTertiary, letterSpacing: 2, marginBottom: 12 },

  pastRow:      { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#1E1E1E' },
  pastLeft:     { flex: 1, gap: 3 },
  pastDate:     { fontSize: 15, fontFamily: fonts.semiBold, color: colors.textPrimary },
  pastScore:    { fontSize: 13, fontFamily: fonts.regular, color: colors.textSecondary },
  pastRight:    { flexDirection: 'row', alignItems: 'center' },
  pastBadge:    { backgroundColor: colors.surface2, paddingVertical: 4, paddingHorizontal: 10, borderRadius: radius.pill },
  pastBadgeText:         { fontSize: 12, fontFamily: fonts.semiBold, color: colors.textSecondary },
  pastBadgePerfect:      { backgroundColor: 'rgba(34,197,94,0.12)' },
  pastBadgeTextPerfect:  { color: colors.correct },
});
