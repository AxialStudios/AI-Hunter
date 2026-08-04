import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import { colors, fonts, radius } from '../../constants/theme';

const RECENT_GAMES = [
  { label: 'Wildlife photography',  result: 'correct',   ms: 4200  },
  { label: 'Portrait studio',       result: 'incorrect', ms: 7800  },
  { label: 'Architecture',          result: 'correct',   ms: 2900  },
  { label: 'Landscape',             result: 'correct',   ms: 11400 },
  { label: 'Product photography',   result: 'correct',   ms: 5600  },
];

function formatMs(ms) {
  return ms >= 1000 ? `${(ms / 1000).toFixed(1)}s` : `${ms}ms`;
}

export default function ProfileScreen() {
  const { user, signOut } = useAuth();
  const email   = user?.email ?? '';
  const initial = email[0]?.toUpperCase() ?? '?';
  const handle  = email.split('@')[0];

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

        {/* Avatar + identity */}
        <View style={styles.identityBlock}>
          <View style={styles.avatarCircle}>
            <Text style={styles.avatarInitial}>{initial}</Text>
          </View>
          <Text style={styles.handle}>{handle}</Text>
          <Text style={styles.email}>{email}</Text>
        </View>

        {/* Stats */}
        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Text style={styles.statNum}>247</Text>
            <Text style={styles.statLabel}>Played</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statNum}>68%</Text>
            <Text style={styles.statLabel}>Accuracy</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statNum}>4</Text>
            <Text style={styles.statLabel}>Streak</Text>
          </View>
        </View>

        {/* Recent games */}
        <Text style={styles.sectionLabel}>RECENT GAMES</Text>
        <View style={styles.recentList}>
          {RECENT_GAMES.map((g, i) => (
            <View key={i} style={styles.recentRow}>
              <View style={[styles.resultDot, g.result === 'correct' ? styles.dotCorrect : styles.dotIncorrect]} />
              <Text style={styles.recentLabel} numberOfLines={1}>{g.label}</Text>
              <Text style={styles.recentMs}>{formatMs(g.ms)}</Text>
            </View>
          ))}
        </View>

        {/* Settings stubs */}
        <Text style={styles.sectionLabel}>SETTINGS</Text>
        <View style={styles.settingsBlock}>
          {[
            { icon: 'bell',      label: 'Notifications'   },
            { icon: 'zap',       label: 'Haptics'         },
            { icon: 'shield',    label: 'Privacy'         },
            { icon: 'help-circle', label: 'How it works'  },
          ].map((item, i) => (
            <TouchableOpacity key={i} style={styles.settingRow} activeOpacity={0.6}>
              <Feather name={item.icon} size={18} color={colors.textSecondary} />
              <Text style={styles.settingLabel}>{item.label}</Text>
              <Feather name="chevron-right" size={16} color={colors.textTertiary} />
            </TouchableOpacity>
          ))}
        </View>

        {/* Sign out */}
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

  identityBlock: { alignItems: 'center', paddingTop: 36, paddingBottom: 28, gap: 8 },
  avatarCircle:  { width: 72, height: 72, borderRadius: 36, backgroundColor: colors.surface2, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  avatarInitial: { fontSize: 30, fontFamily: fonts.bold, color: colors.textPrimary },
  handle:        { fontSize: 20, fontFamily: fonts.bold, color: colors.textPrimary },
  email:         { fontSize: 13, fontFamily: fonts.regular, color: colors.textSecondary },

  statsRow:     { flexDirection: 'row', backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: '#2A2A2A', marginBottom: 32 },
  statItem:     { flex: 1, alignItems: 'center', paddingVertical: 20, gap: 4 },
  statDivider:  { width: StyleSheet.hairlineWidth, backgroundColor: '#2A2A2A', marginVertical: 14 },
  statNum:      { fontSize: 24, fontFamily: fonts.bold, color: colors.textPrimary },
  statLabel:    { fontSize: 11, fontFamily: fonts.regular, color: colors.textSecondary },

  sectionLabel: { fontSize: 11, fontFamily: fonts.semiBold, color: colors.textTertiary, letterSpacing: 2, marginBottom: 12 },

  recentList: { gap: 0, marginBottom: 28 },
  recentRow:  { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 13, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#1A1A1A' },
  resultDot:  { width: 8, height: 8, borderRadius: 4 },
  dotCorrect:   { backgroundColor: colors.correct },
  dotIncorrect: { backgroundColor: colors.incorrect },
  recentLabel:  { flex: 1, fontSize: 15, fontFamily: fonts.medium, color: colors.textPrimary },
  recentMs:     { fontSize: 13, fontFamily: fonts.regular, color: colors.textTertiary },

  settingsBlock: { backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: '#2A2A2A', marginBottom: 20, overflow: 'hidden' },
  settingRow:    { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 16, paddingHorizontal: 18, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#222' },
  settingLabel:  { flex: 1, fontSize: 15, fontFamily: fonts.medium, color: colors.textPrimary },

  signOutBtn:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 16 },
  signOutText: { fontSize: 15, fontFamily: fonts.semiBold, color: colors.incorrect },
});
