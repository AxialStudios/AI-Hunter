import { useState, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabase';
import { colors, fonts, radius } from '../../constants/theme';

function formatMs(ms) {
  if (!ms) return '—';
  return ms >= 1000 ? `${(ms / 1000).toFixed(1)}s` : `${ms}ms`;
}

function timeAgo(iso) {
  const diff = Date.now() - new Date(iso).getTime();
  const min  = Math.floor(diff / 60000);
  const hr   = Math.floor(diff / 3600000);
  const day  = Math.floor(diff / 86400000);
  if (min < 1)   return 'just now';
  if (min < 60)  return `${min}m ago`;
  if (hr  < 24)  return `${hr}h ago`;
  if (day === 1) return 'Yesterday';
  if (day <  7)  return `${day}d ago`;
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

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

export default function ProfileScreen() {
  const { user, signOut } = useAuth();
  const [votes,   setVotes]   = useState([]);
  const [loading, setLoading] = useState(true);

  const isAnon  = !user?.email;
  const initial = user?.email?.[0]?.toUpperCase() ?? '?';
  const handle  = user?.email?.split('@')[0] ?? 'Player';

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

  const total    = votes.length;
  const correct  = votes.filter(v => v.was_correct).length;
  const accuracy = total > 0 ? Math.round((correct / total) * 100) : null;
  const streak   = computeStreak(votes);
  const recent   = votes.slice(0, 15);

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

        {/* Identity */}
        <View style={styles.identityBlock}>
          <View style={styles.avatarCircle}>
            <Text style={styles.avatarInitial}>{initial}</Text>
          </View>
          <Text style={styles.handle}>{handle}</Text>
          {isAnon
            ? <View style={styles.anonPill}><Text style={styles.anonPillText}>Guest account</Text></View>
            : <Text style={styles.email}>{user.email}</Text>
          }
        </View>

        {/* Stats */}
        <View style={styles.statsRow}>
          {loading ? (
            <View style={styles.loadingCenter}>
              <ActivityIndicator color={colors.textSecondary} />
            </View>
          ) : (
            <>
              <View style={styles.statItem}>
                <Text style={styles.statNum}>{total > 0 ? total : '—'}</Text>
                <Text style={styles.statLabel}>Played</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statItem}>
                <Text style={[styles.statNum, accuracy !== null && accuracy >= 60 && styles.statGood]}>
                  {accuracy !== null ? `${accuracy}%` : '—'}
                </Text>
                <Text style={styles.statLabel}>Accuracy</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statItem}>
                <Text style={styles.statNum}>{streak > 0 ? streak : '—'}</Text>
                <Text style={styles.statLabel}>Streak</Text>
              </View>
            </>
          )}
        </View>

        {/* Recent games */}
        <Text style={styles.sectionLabel}>RECENT GAMES</Text>
        {loading ? (
          <View style={styles.loadingCenter}>
            <ActivityIndicator color={colors.textSecondary} />
          </View>
        ) : recent.length === 0 ? (
          <View style={styles.emptyState}>
            <Feather name="eye-off" size={28} color={colors.textTertiary} style={{ marginBottom: 10 }} />
            <Text style={styles.emptyText}>No games yet.{'\n'}Head to Play to get started.</Text>
          </View>
        ) : (
          <View style={styles.recentList}>
            {recent.map((v, i) => (
              <View key={i} style={[styles.recentRow, i === recent.length - 1 && styles.recentRowLast]}>
                <View style={[styles.resultDot, v.was_correct ? styles.dotCorrect : styles.dotIncorrect]} />
                <Text style={[styles.recentVerdict, v.was_correct ? styles.verdictCorrect : styles.verdictFooled]}>
                  {v.was_correct ? 'Correct' : 'Fooled'}
                </Text>
                <Text style={styles.recentAgo}>{timeAgo(v.created_at)}</Text>
                <Text style={styles.recentMs}>{formatMs(v.response_time_ms)}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Settings */}
        <Text style={styles.sectionLabel}>SETTINGS</Text>
        <View style={styles.settingsBlock}>
          {[
            { icon: 'bell',        label: 'Notifications' },
            { icon: 'zap',         label: 'Haptics'       },
            { icon: 'shield',      label: 'Privacy'       },
            { icon: 'help-circle', label: 'How it works'  },
          ].map((item, i, arr) => (
            <TouchableOpacity
              key={i}
              style={[styles.settingRow, i === arr.length - 1 && styles.settingRowLast]}
              activeOpacity={0.6}
            >
              <Feather name={item.icon} size={18} color={colors.textSecondary} />
              <Text style={styles.settingLabel}>{item.label}</Text>
              <Feather name="chevron-right" size={16} color={colors.textTertiary} />
            </TouchableOpacity>
          ))}
        </View>

        <TouchableOpacity style={styles.signOutBtn} onPress={signOut} activeOpacity={0.7}>
          <Feather name="log-out" size={16} color={colors.incorrect} />
          <Text style={styles.signOutText}>Sign out</Text>
        </TouchableOpacity>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: colors.bg },
  scroll: { paddingHorizontal: 20, paddingBottom: 40 },

  identityBlock: { alignItems: 'center', paddingTop: 36, paddingBottom: 28, gap: 6 },
  avatarCircle:  { width: 72, height: 72, borderRadius: 36, backgroundColor: colors.surface2, alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
  avatarInitial: { fontSize: 30, fontFamily: fonts.bold, color: colors.textPrimary },
  handle:        { fontSize: 20, fontFamily: fonts.bold, color: colors.textPrimary },
  email:         { fontSize: 13, fontFamily: fonts.regular, color: colors.textSecondary },
  anonPill:      { borderWidth: 1, borderColor: colors.textTertiary, borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 3, marginTop: 2 },
  anonPillText:  { fontSize: 11, fontFamily: fonts.regular, color: colors.textTertiary },

  statsRow:    { flexDirection: 'row', backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: '#2A2A2A', marginBottom: 32 },
  statItem:    { flex: 1, alignItems: 'center', paddingVertical: 20, gap: 5 },
  statDivider: { width: StyleSheet.hairlineWidth, backgroundColor: '#2A2A2A', marginVertical: 14 },
  statNum:     { fontSize: 24, fontFamily: fonts.bold, color: colors.textPrimary },
  statGood:    { color: colors.correct },
  statLabel:   { fontSize: 11, fontFamily: fonts.regular, color: colors.textSecondary },

  loadingCenter: { paddingVertical: 20, alignItems: 'center', flex: 1 },

  sectionLabel: { fontSize: 11, fontFamily: fonts.semiBold, color: colors.textTertiary, letterSpacing: 2, marginBottom: 12 },

  emptyState: { paddingVertical: 32, alignItems: 'center', marginBottom: 28 },
  emptyText:  { fontSize: 14, fontFamily: fonts.regular, color: colors.textSecondary, textAlign: 'center', lineHeight: 22 },

  recentList:     { marginBottom: 28 },
  recentRow:      { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 13, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#1A1A1A' },
  recentRowLast:  { borderBottomWidth: 0 },
  resultDot:      { width: 8, height: 8, borderRadius: 4, flexShrink: 0 },
  dotCorrect:     { backgroundColor: colors.correct },
  dotIncorrect:   { backgroundColor: colors.incorrect },
  recentVerdict:  { fontSize: 15, fontFamily: fonts.medium, width: 64 },
  verdictCorrect: { color: colors.textPrimary },
  verdictFooled:  { color: colors.textSecondary },
  recentAgo:      { flex: 1, fontSize: 13, fontFamily: fonts.regular, color: colors.textSecondary },
  recentMs:       { fontSize: 13, fontFamily: fonts.regular, color: colors.textTertiary },

  settingsBlock:  { backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: '#2A2A2A', marginBottom: 20, overflow: 'hidden' },
  settingRow:     { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 16, paddingHorizontal: 18, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#222' },
  settingRowLast: { borderBottomWidth: 0 },
  settingLabel:   { flex: 1, fontSize: 15, fontFamily: fonts.medium, color: colors.textPrimary },

  signOutBtn:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 16 },
  signOutText: { fontSize: 15, fontFamily: fonts.semiBold, color: colors.incorrect },
});
