import { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { colors, fonts, radius } from '../../constants/theme';

const WEEKLY = [
  { rank: 1, name: 'Morgan T.',    score: 892, accuracy: 91 },
  { rank: 2, name: 'Alex R.',      score: 741, accuracy: 87 },
  { rank: 3, name: 'Jordan K.',    score: 698, accuracy: 84 },
  { rank: 4, name: 'Taylor M.',    score: 634, accuracy: 79 },
  { rank: 5, name: 'Sam D.',       score: 601, accuracy: 76 },
  { rank: 6, name: 'Riley P.',     score: 578, accuracy: 75 },
  { rank: 7, name: 'Casey O.',     score: 554, accuracy: 73 },
  { rank: 8, name: 'Quinn B.',     score: 520, accuracy: 71 },
  { rank: 9, name: 'Avery N.',     score: 497, accuracy: 69 },
  { rank: 10, name: 'Drew W.',     score: 463, accuracy: 67 },
];

const ALL_TIME = [
  { rank: 1, name: 'Jordan K.',    score: 12840, accuracy: 88 },
  { rank: 2, name: 'Morgan T.',    score: 11290, accuracy: 85 },
  { rank: 3, name: 'Sam D.',       score: 10740, accuracy: 82 },
  { rank: 4, name: 'Alex R.',      score: 9880,  accuracy: 80 },
  { rank: 5, name: 'Taylor M.',    score: 9210,  accuracy: 78 },
  { rank: 6, name: 'Casey O.',     score: 8760,  accuracy: 76 },
  { rank: 7, name: 'Riley P.',     score: 8100,  accuracy: 74 },
  { rank: 8, name: 'Quinn B.',     score: 7430,  accuracy: 72 },
  { rank: 9, name: 'Avery N.',     score: 6890,  accuracy: 70 },
  { rank: 10, name: 'Drew W.',     score: 6210,  accuracy: 68 },
];

const RANK_COLORS = { 1: '#F59E0B', 2: '#9CA3AF', 3: '#B45309' };

function RankBadge({ rank }) {
  const color = RANK_COLORS[rank];
  if (color) {
    return (
      <View style={[styles.rankCircle, { borderColor: color }]}>
        <Text style={[styles.rankNum, { color }]}>{rank}</Text>
      </View>
    );
  }
  return (
    <View style={styles.rankCircle}>
      <Text style={styles.rankNum}>{rank}</Text>
    </View>
  );
}

function Initial({ name }) {
  return (
    <View style={styles.avatar}>
      <Text style={styles.avatarText}>{name[0]}</Text>
    </View>
  );
}

export default function LeaderboardScreen() {
  const [tab, setTab] = useState('week');
  const data = tab === 'week' ? WEEKLY : ALL_TIME;

  return (
    <SafeAreaView style={styles.safe}>

      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.screenLabel}>RANKINGS</Text>
        <View style={styles.toggle}>
          <TouchableOpacity
            style={[styles.toggleBtn, tab === 'week' && styles.toggleBtnActive]}
            onPress={() => setTab('week')}
            activeOpacity={0.7}
          >
            <Text style={[styles.toggleText, tab === 'week' && styles.toggleTextActive]}>This Week</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.toggleBtn, tab === 'all' && styles.toggleBtnActive]}
            onPress={() => setTab('all')}
            activeOpacity={0.7}
          >
            <Text style={[styles.toggleText, tab === 'all' && styles.toggleTextActive]}>All Time</Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>

        {/* Top 3 podium */}
        <View style={styles.podium}>
          {[data[1], data[0], data[2]].map((entry, i) => {
            const isPrimary = i === 1;
            return (
              <View key={entry.rank} style={[styles.podiumItem, isPrimary && styles.podiumItemPrimary]}>
                <View style={[styles.podiumAvatar, isPrimary && styles.podiumAvatarPrimary]}>
                  <Text style={[styles.podiumInitial, isPrimary && styles.podiumInitialPrimary]}>{entry.name[0]}</Text>
                </View>
                {entry.rank === 1 && <Feather name="award" size={16} color="#F59E0B" style={styles.crownIcon} />}
                <Text style={[styles.podiumName, isPrimary && styles.podiumNamePrimary]} numberOfLines={1}>
                  {entry.name.split(' ')[0]}
                </Text>
                <Text style={[styles.podiumScore, isPrimary && styles.podiumScorePrimary]}>
                  {entry.score.toLocaleString()}
                </Text>
                <View style={[styles.podiumBar, isPrimary ? styles.podiumBarFirst : styles.podiumBarOther]} />
              </View>
            );
          })}
        </View>

        {/* Full list from rank 4 */}
        <View style={styles.list}>
          {data.slice(3).map(entry => (
            <View key={entry.rank} style={styles.row}>
              <RankBadge rank={entry.rank} />
              <Initial name={entry.name} />
              <View style={styles.rowInfo}>
                <Text style={styles.rowName}>{entry.name}</Text>
                <Text style={styles.rowAccuracy}>{entry.accuracy}% accuracy</Text>
              </View>
              <Text style={styles.rowScore}>{entry.score.toLocaleString()}</Text>
            </View>
          ))}
        </View>

      </ScrollView>

      {/* User's position placeholder */}
      <View style={styles.myRow}>
        <View style={styles.myRankCircle}>
          <Text style={styles.myRankNum}>—</Text>
        </View>
        <View style={styles.myAvatar}>
          <Text style={styles.myAvatarText}>Y</Text>
        </View>
        <View style={styles.rowInfo}>
          <Text style={styles.rowName}>You</Text>
          <Text style={styles.rowAccuracy}>Play more to rank</Text>
        </View>
        <Text style={styles.rowScore}>—</Text>
      </View>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: colors.bg },

  header:      { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 20, gap: 16 },
  screenLabel: { fontSize: 11, fontFamily: fonts.semiBold, color: colors.textTertiary, letterSpacing: 2 },
  toggle:      { flexDirection: 'row', backgroundColor: colors.surface, borderRadius: radius.pill, padding: 4 },
  toggleBtn:        { flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: radius.pill },
  toggleBtnActive:  { backgroundColor: '#2E2E2E' },
  toggleText:       { fontSize: 13, fontFamily: fonts.semiBold, color: colors.textTertiary },
  toggleTextActive: { color: colors.textPrimary },

  scroll: { paddingHorizontal: 20, paddingBottom: 16 },

  podium:             { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'center', gap: 8, paddingBottom: 24 },
  podiumItem:         { flex: 1, alignItems: 'center', gap: 6 },
  podiumItemPrimary:  { paddingBottom: 12 },
  podiumAvatar:        { width: 46, height: 46, borderRadius: 23, backgroundColor: colors.surface2, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#333' },
  podiumAvatarPrimary: { width: 56, height: 56, borderRadius: 28, backgroundColor: '#1E1E1E', borderColor: '#F59E0B' },
  podiumInitial:       { fontSize: 18, fontFamily: fonts.bold, color: colors.textSecondary },
  podiumInitialPrimary:{ fontSize: 22, fontFamily: fonts.bold, color: colors.textPrimary },
  crownIcon:          { position: 'absolute', top: -2 },
  podiumName:         { fontSize: 12, fontFamily: fonts.semiBold, color: colors.textSecondary },
  podiumNamePrimary:  { color: colors.textPrimary, fontSize: 13 },
  podiumScore:        { fontSize: 14, fontFamily: fonts.bold, color: colors.textSecondary },
  podiumScorePrimary: { fontSize: 16, color: colors.textPrimary },
  podiumBar:          { width: '100%', borderRadius: 4 },
  podiumBarFirst:     { height: 60, backgroundColor: '#2A2A2A' },
  podiumBarOther:     { height: 36, backgroundColor: '#1E1E1E' },

  list: { gap: 2 },
  row:  { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 13, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#1A1A1A' },

  rankCircle:  { width: 28, alignItems: 'center' },
  rankNum:     { fontSize: 13, fontFamily: fonts.semiBold, color: colors.textTertiary },

  avatar:     { width: 34, height: 34, borderRadius: 17, backgroundColor: colors.surface2, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 14, fontFamily: fonts.bold, color: colors.textSecondary },

  rowInfo:      { flex: 1 },
  rowName:      { fontSize: 15, fontFamily: fonts.semiBold, color: colors.textPrimary },
  rowAccuracy:  { fontSize: 12, fontFamily: fonts.regular, color: colors.textTertiary },
  rowScore:     { fontSize: 15, fontFamily: fonts.bold, color: colors.textPrimary },

  myRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#2A2A2A',
    backgroundColor: '#111111',
  },
  myRankCircle:  { width: 28, alignItems: 'center' },
  myRankNum:     { fontSize: 13, fontFamily: fonts.semiBold, color: colors.textTertiary },
  myAvatar:      { width: 34, height: 34, borderRadius: 17, backgroundColor: '#1E1E1E', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#333' },
  myAvatarText:  { fontSize: 14, fontFamily: fonts.bold, color: colors.textSecondary },
});
