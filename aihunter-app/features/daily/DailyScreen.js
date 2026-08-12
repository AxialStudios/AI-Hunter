import { useState, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabase';
import { colors, fonts, radius } from '../../constants/theme';

function computeStreak(votes) {
  if (!votes.length) return 0;
  const days  = [...new Set(votes.map(v => v.created_at.slice(0, 10)))].sort().reverse();
  const today = new Date().toISOString().slice(0, 10);
  const yest  = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  if (days[0] !== today && days[0] !== yest) return 0;
  let streak = 0, check = days[0];
  for (const d of days) {
    if (d !== check) break;
    streak++;
    const dt = new Date(check + 'T12:00:00Z');
    dt.setUTCDate(dt.getUTCDate() - 1);
    check = dt.toISOString().slice(0, 10);
  }
  return streak;
}

function groupByDay(votes) {
  const map = {};
  for (const v of votes) {
    const day = v.created_at.slice(0, 10);
    if (!map[day]) map[day] = [];
    map[day].push(v);
  }
  return map;
}

function formatDay(dateStr) {
  const today = new Date().toISOString().slice(0, 10);
  const yest  = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  if (dateStr === today) return 'Today';
  if (dateStr === yest)  return 'Yesterday';
  return new Date(dateStr + 'T12:00:00Z').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

export default function DailyScreen() {
  const navigation = useNavigation();
  const { user }   = useAuth();
  const [votes,   setVotes]   = useState([]);
  const [loading, setLoading] = useState(true);

  useFocusEffect(useCallback(() => {
    if (!user) return;
    setLoading(true);
    supabase
      .from('votes')
      .select('was_correct, response_time_ms, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(200)
      .then(({ data }) => {
        setVotes(data ?? []);
        setLoading(false);
      });
  }, [user?.id]));

  const today       = new Date().toISOString().slice(0, 10);
  const byDay       = groupByDay(votes);
  const todayVotes  = byDay[today] ?? [];
  const todayRight  = todayVotes.filter(v => v.was_correct).length;
  const todayAcc    = todayVotes.length > 0 ? Math.round((todayRight / todayVotes.length) * 100) : null;

  const total        = votes.length;
  const totalCorrect = votes.filter(v => v.was_correct).length;
  const allAccuracy  = total > 0 ? Math.round((totalCorrect / total) * 100) : null;
  const streak       = computeStreak(votes);
  const daysPlayed   = Object.keys(byDay).length;

  const recentDays = Object.keys(byDay).sort().reverse().slice(0, 14);

  const TODAY_LABEL = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.date}>{TODAY_LABEL}</Text>
        </View>

        {/* Today card */}
        <View style={styles.todayCard}>
          {loading ? (
            <ActivityIndicator color={colors.textSecondary} style={{ paddingVertical: 20 }} />
          ) : todayVotes.length === 0 ? (
            <>
              <View style={styles.todayEmpty}>
                <Feather name="eye" size={22} color={colors.textTertiary} />
                <Text style={styles.todayEmptyTitle}>No games yet today</Text>
                <Text style={styles.todayEmptyMeta}>Train your eye. Each pair counts.</Text>
              </View>
              <TouchableOpacity style={styles.playBtn} onPress={() => navigation.navigate('Play')} activeOpacity={0.85}>
                <Text style={styles.playBtnText}>Start Playing</Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              {/* Mini result strip */}
              <View style={styles.resultStrip}>
                {todayVotes.map((v, i) => (
                  <View key={i} style={[styles.stripDot, v.was_correct ? styles.stripDotCorrect : styles.stripDotWrong]} />
                ))}
              </View>

              <View style={styles.todayStats}>
                <View style={styles.todayStat}>
                  <Text style={styles.todayStatNum}>{todayVotes.length}</Text>
                  <Text style={styles.todayStatLabel}>Games</Text>
                </View>
                <View style={styles.todayStatDivider} />
                <View style={styles.todayStat}>
                  <Text style={[styles.todayStatNum, todayAcc >= 60 && styles.statGood]}>
                    {todayAcc}%
                  </Text>
                  <Text style={styles.todayStatLabel}>Accuracy</Text>
                </View>
                <View style={styles.todayStatDivider} />
                <View style={styles.todayStat}>
                  <Text style={styles.todayStatNum}>{todayRight}</Text>
                  <Text style={styles.todayStatLabel}>Correct</Text>
                </View>
              </View>

              <View style={styles.hairline} />
              <TouchableOpacity style={styles.playBtn} onPress={() => navigation.navigate('Play')} activeOpacity={0.85}>
                <Text style={styles.playBtnText}>Keep Playing</Text>
              </TouchableOpacity>
            </>
          )}
        </View>

        {/* Streak stats */}
        {!loading && (
          <View style={styles.streakRow}>
            <View style={styles.streakItem}>
              <Text style={styles.streakNum}>{streak > 0 ? streak : '—'}</Text>
              <Text style={styles.streakMeta}>day streak</Text>
            </View>
            <View style={styles.streakDivider} />
            <View style={styles.streakItem}>
              <Text style={styles.streakNum}>{daysPlayed > 0 ? daysPlayed : '—'}</Text>
              <Text style={styles.streakMeta}>days played</Text>
            </View>
            <View style={styles.streakDivider} />
            <View style={styles.streakItem}>
              <Text style={[styles.streakNum, allAccuracy !== null && allAccuracy >= 60 && styles.statGood]}>
                {allAccuracy !== null ? `${allAccuracy}%` : '—'}
              </Text>
              <Text style={styles.streakMeta}>all-time accuracy</Text>
            </View>
          </View>
        )}

        {/* History */}
        {!loading && recentDays.length > 0 && (
          <>
            <Text style={styles.sectionLabel}>HISTORY</Text>
            {recentDays.map((day, i) => {
              const dayVotes   = byDay[day];
              const dayCorrect = dayVotes.filter(v => v.was_correct).length;
              const dayAcc     = Math.round((dayCorrect / dayVotes.length) * 100);
              const isPerfect  = dayCorrect === dayVotes.length;
              return (
                <View key={day} style={[styles.historyRow, i === recentDays.length - 1 && styles.historyRowLast]}>
                  <View style={styles.historyLeft}>
                    <Text style={styles.historyDay}>{formatDay(day)}</Text>
                    <Text style={styles.historyMeta}>
                      {dayVotes.length} game{dayVotes.length !== 1 ? 's' : ''}  ·  {dayAcc}% correct
                    </Text>
                  </View>
                  <View style={[styles.historyBadge, isPerfect && styles.historyBadgePerfect]}>
                    <Text style={[styles.historyBadgeText, isPerfect && styles.historyBadgeTextPerfect]}>
                      {isPerfect ? 'Perfect' : `${dayCorrect}/${dayVotes.length}`}
                    </Text>
                  </View>
                </View>
              );
            })}
          </>
        )}

        {!loading && votes.length === 0 && (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>Your game history will appear here after your first round.</Text>
          </View>
        )}

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: colors.bg },
  scroll: { paddingHorizontal: 20, paddingBottom: 32 },

  header:      { paddingTop: 20, paddingBottom: 24 },
  screenLabel: { fontSize: 11, fontFamily: fonts.semiBold, color: colors.textTertiary, letterSpacing: 2, marginBottom: 6 },
  date:        { fontSize: 28, fontFamily: fonts.bold, color: colors.textPrimary },

  todayCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: '#2A2A2A',
    padding: 22,
    gap: 16,
    marginBottom: 12,
  },

  todayEmpty:      { alignItems: 'center', gap: 8, paddingVertical: 8 },
  todayEmptyTitle: { fontSize: 17, fontFamily: fonts.semiBold, color: colors.textPrimary },
  todayEmptyMeta:  { fontSize: 14, fontFamily: fonts.regular, color: colors.textSecondary },

  resultStrip:       { flexDirection: 'row', flexWrap: 'wrap', gap: 5 },
  stripDot:          { width: 10, height: 10, borderRadius: 5 },
  stripDotCorrect:   { backgroundColor: colors.correct },
  stripDotWrong:     { backgroundColor: colors.incorrect },

  todayStats:        { flexDirection: 'row', alignItems: 'stretch' },
  todayStat:         { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 4, paddingVertical: 8 },
  todayStatDivider:  { width: StyleSheet.hairlineWidth, backgroundColor: '#2A2A2A' },
  todayStatNum:      { fontSize: 28, fontFamily: fonts.bold, color: colors.textPrimary },
  todayStatLabel:    { fontSize: 12, fontFamily: fonts.regular, color: colors.textSecondary },

  hairline: { height: StyleSheet.hairlineWidth, backgroundColor: '#2A2A2A' },

  playBtn:     { backgroundColor: colors.textPrimary, paddingVertical: 16, borderRadius: radius.pill, alignItems: 'center' },
  playBtnText: { fontSize: 16, fontFamily: fonts.bold, color: colors.bg },

  statGood: { color: colors.correct },

  streakRow:     { flexDirection: 'row', backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: '#2A2A2A', marginBottom: 28 },
  streakItem:    { flex: 1, alignItems: 'center', paddingVertical: 18, gap: 4 },
  streakDivider: { width: StyleSheet.hairlineWidth, backgroundColor: '#2A2A2A', marginVertical: 14 },
  streakNum:     { fontSize: 22, fontFamily: fonts.bold, color: colors.textPrimary },
  streakMeta:    { fontSize: 11, fontFamily: fonts.regular, color: colors.textSecondary },

  sectionLabel: { fontSize: 11, fontFamily: fonts.semiBold, color: colors.textTertiary, letterSpacing: 2, marginBottom: 12 },

  historyRow:              { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#1E1E1E' },
  historyRowLast:          { borderBottomWidth: 0 },
  historyLeft:             { flex: 1, gap: 3 },
  historyDay:              { fontSize: 15, fontFamily: fonts.semiBold, color: colors.textPrimary },
  historyMeta:             { fontSize: 13, fontFamily: fonts.regular, color: colors.textSecondary },
  historyBadge:            { backgroundColor: colors.surface2, paddingVertical: 4, paddingHorizontal: 10, borderRadius: radius.pill },
  historyBadgeText:        { fontSize: 12, fontFamily: fonts.semiBold, color: colors.textSecondary },
  historyBadgePerfect:     { backgroundColor: 'rgba(34,197,94,0.12)' },
  historyBadgeTextPerfect: { color: colors.correct },

  emptyState: { paddingVertical: 32, alignItems: 'center' },
  emptyText:  { fontSize: 14, fontFamily: fonts.regular, color: colors.textSecondary, textAlign: 'center', lineHeight: 22 },
});
