import { useState, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../../context/AuthContext';
import { useProStatus } from '../../context/ProContext';
import { supabase } from '../../lib/supabase';
import { colors, fonts, radius } from '../../constants/theme';
import PaywallScreen from '../paywall/PaywallScreen';

const { width: SW } = Dimensions.get('window');
const CHART_W = SW - 64;

// ── Simple bar chart ────────────────────────────────────────────────────────
function BarChart({ bars, colorFn }) {
  const max = Math.max(...bars.map(b => b.value), 1);
  return (
    <View style={chart.wrap}>
      {bars.map((b, i) => (
        <View key={i} style={chart.barCol}>
          <Text style={chart.barPct}>{b.value > 0 ? `${b.value}%` : '—'}</Text>
          <View style={chart.barTrack}>
            <View style={[chart.barFill, { height: `${(b.value / max) * 100}%`, backgroundColor: colorFn ? colorFn(b) : colors.correct }]} />
          </View>
          <Text style={chart.barLabel}>{b.label}</Text>
          <Text style={chart.barSub}>{b.sub ?? ''}</Text>
        </View>
      ))}
    </View>
  );
}

const chart = StyleSheet.create({
  wrap:     { flexDirection: 'row', alignItems: 'flex-end', gap: 10, height: 140, justifyContent: 'space-around' },
  barCol:   { flex: 1, alignItems: 'center', gap: 4 },
  barPct:   { fontSize: 11, fontFamily: fonts.semiBold, color: colors.textSecondary },
  barTrack: { flex: 1, width: '60%', backgroundColor: '#1C1C1C', borderRadius: 4, overflow: 'hidden', justifyContent: 'flex-end' },
  barFill:  { width: '100%', borderRadius: 4 },
  barLabel: { fontSize: 11, fontFamily: fonts.medium, color: colors.textPrimary, textAlign: 'center' },
  barSub:   { fontSize: 9,  fontFamily: fonts.regular, color: colors.textTertiary, textAlign: 'center' },
});

// ── Simple line chart ────────────────────────────────────────────────────────
function LineChart({ points }) {
  if (!points.length) return null;
  const vals  = points.map(p => p.value);
  const max   = Math.max(...vals, 1);
  const min   = Math.min(...vals, 0);
  const range = max - min || 1;
  const H = 100, W = CHART_W - 32;
  const xs = points.map((_, i) => (i / Math.max(points.length - 1, 1)) * W);
  const ys = vals.map(v => H - ((v - min) / range) * H);

  const d = xs.map((x, i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${ys[i].toFixed(1)}`).join(' ');
  const areaPts = [
    ...xs.map((x, i) => `${x.toFixed(1)},${ys[i].toFixed(1)}`),
    `${xs[xs.length - 1].toFixed(1)},${H}`,
    `0,${H}`,
  ].join(' ');

  return (
    <View style={{ height: H + 24, marginVertical: 8 }}>
      <View style={{ height: H, position: 'relative' }}>
        {/* Y-axis guides */}
        {[0, 0.5, 1].map((f, i) => (
          <View key={i} style={{ position: 'absolute', left: 0, right: 0, top: H - f * H - 0.5, height: 1, backgroundColor: '#1C1C1C' }} />
        ))}
        {/* SVG line + area */}
        <View style={StyleSheet.absoluteFillObject}>
          {xs.slice(0, -1).map((x1, i) => {
            const x2 = xs[i + 1], y1 = ys[i], y2 = ys[i + 1];
            const len = Math.hypot(x2 - x1, y2 - y1);
            const ang = Math.atan2(y2 - y1, x2 - x1) * (180 / Math.PI);
            return (
              <View key={i} style={{
                position: 'absolute', left: x1, top: y1,
                width: len, height: 2, backgroundColor: colors.correct,
                transformOrigin: '0 50%',
                transform: [{ rotate: `${ang}deg` }],
              }} />
            );
          })}
          {/* Dots */}
          {xs.map((x, i) => (
            <View key={i} style={{ position: 'absolute', left: x - 4, top: ys[i] - 4, width: 8, height: 8, borderRadius: 4, backgroundColor: colors.correct, borderWidth: 2, borderColor: colors.bg }} />
          ))}
        </View>
      </View>
      {/* X-axis labels */}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 }}>
        {points.map((p, i) => (
          <Text key={i} style={{ fontSize: 9, fontFamily: fonts.regular, color: colors.textTertiary, textAlign: 'center', width: W / points.length }}>
            {p.label}
          </Text>
        ))}
      </View>
    </View>
  );
}

function SectionCard({ title, children }) {
  return (
    <View style={s.card}>
      <Text style={s.cardTitle}>{title}</Text>
      {children}
    </View>
  );
}

// ── Helpers ────────────────────────────────────────────────────────────────
function weekLabel(dateStr) {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function groupByWeek(votes) {
  const weeks = {};
  for (const v of votes) {
    const d   = new Date(v.created_at);
    const mon = new Date(d); mon.setDate(d.getDate() - d.getDay() + 1);
    const key = mon.toISOString().slice(0, 10);
    if (!weeks[key]) weeks[key] = { correct: 0, total: 0 };
    weeks[key].total++;
    if (v.was_correct) weeks[key].correct++;
  }
  const sorted = Object.entries(weeks).sort(([a], [b]) => a.localeCompare(b)).slice(-8);
  return sorted.map(([k, v]) => ({ label: weekLabel(k), value: v.total > 0 ? Math.round((v.correct / v.total) * 100) : 0 }));
}

function groupByDifficulty(votes) {
  const tiers = { easy: { correct: 0, total: 0 }, medium: { correct: 0, total: 0 }, hard: { correct: 0, total: 0 } };
  for (const v of votes) {
    const t = v.tasks?.difficulty_tier;
    if (!t || !tiers[t]) continue;
    tiers[t].total++;
    if (v.was_correct) tiers[t].correct++;
  }
  return [
    { label: 'Easy',   value: tiers.easy.total   > 0 ? Math.round((tiers.easy.correct   / tiers.easy.total)   * 100) : 0, color: colors.correct,   sub: `${tiers.easy.total} played`   },
    { label: 'Medium', value: tiers.medium.total > 0 ? Math.round((tiers.medium.correct / tiers.medium.total) * 100) : 0, color: '#f59e0b', sub: `${tiers.medium.total} played` },
    { label: 'Hard',   value: tiers.hard.total   > 0 ? Math.round((tiers.hard.correct   / tiers.hard.total)   * 100) : 0, color: colors.incorrect, sub: `${tiers.hard.total} played`   },
  ];
}

function groupByModel(votes) {
  const models = {};
  for (const v of votes) {
    const m = v.tasks?.generation_model_engine;
    if (!m) continue;
    if (!models[m]) models[m] = { correct: 0, total: 0 };
    models[m].total++;
    if (v.was_correct) models[m].correct++;
  }
  return Object.entries(models)
    .sort(([, a], [, b]) => b.total - a.total)
    .slice(0, 5)
    .map(([m, v]) => ({ label: m.length > 12 ? m.slice(0, 12) + '…' : m, value: v.total > 0 ? Math.round((v.correct / v.total) * 100) : 0, sub: `${v.total} played` }));
}

function findWeakSpot(votes) {
  const tally = {};
  for (const v of votes) {
    if (v.was_correct) continue;
    const tells = v.tasks?.tell_annotations;
    if (!Array.isArray(tells)) continue;
    for (const t of tells) {
      const key = t.title || t.label || 'Unknown';
      tally[key] = (tally[key] || 0) + 1;
    }
  }
  const entries = Object.entries(tally).sort(([, a], [, b]) => b - a);
  if (!entries.length) return null;
  const total   = votes.filter(v => !v.was_correct).length;
  const [label, count] = entries[0];
  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
  return { label, pct };
}

// ── Main screen ────────────────────────────────────────────────────────────
export default function AnalyticsScreen() {
  const { user }     = useAuth();
  const { isPro }    = useProStatus();
  const [votes,   setVotes]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [paywallOpen, setPaywallOpen] = useState(false);

  useFocusEffect(useCallback(() => {
    if (!user || !isPro) { setLoading(false); return; }
    setLoading(true);
    supabase
      .from('votes')
      .select('was_correct, created_at, tasks(difficulty_tier, generation_model_engine, tell_annotations)')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(500)
      .then(({ data }) => {
        setVotes(data ?? []);
        setLoading(false);
      });
  }, [user?.id, isPro]));

  if (!isPro) {
    return (
      <SafeAreaView style={s.safe}>
        <View style={s.lockedWrap}>
          <Feather name="lock" size={36} color="#a78bfa" style={{ marginBottom: 16 }} />
          <Text style={s.lockedTitle}>Personal Analytics</Text>
          <Text style={s.lockedSub}>Track your accuracy by difficulty, AI model, and week. Discover your weak spots.</Text>
          <TouchableOpacity style={s.lockedBtn} onPress={() => setPaywallOpen(true)} activeOpacity={0.85}>
            <Text style={s.lockedBtnText}>Upgrade to Pro</Text>
          </TouchableOpacity>
        </View>
        <PaywallScreen visible={paywallOpen} onClose={() => setPaywallOpen(false)} />
      </SafeAreaView>
    );
  }

  const weekPoints   = groupByWeek(votes);
  const diffBars     = groupByDifficulty(votes);
  const modelBars    = groupByModel(votes);
  const weakSpot     = findWeakSpot(votes);
  const hasData      = votes.length >= 20;

  return (
    <SafeAreaView style={s.safe}>
      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        <Text style={s.heading}>Your Analytics</Text>

        {loading ? (
          <ActivityIndicator color={colors.textSecondary} style={{ marginTop: 60 }} />
        ) : (
          <>
            <SectionCard title="Accuracy over time">
              {weekPoints.length < 2
                ? <Text style={s.emptyChart}>Play more rounds to see your trend.</Text>
                : <LineChart points={weekPoints} />
              }
            </SectionCard>

            <SectionCard title="By difficulty">
              <BarChart bars={diffBars} colorFn={b => b.color} />
            </SectionCard>

            {modelBars.length > 0 && (
              <SectionCard title="By AI model">
                <BarChart bars={modelBars} />
              </SectionCard>
            )}

            <SectionCard title="Your weak spot">
              {!hasData ? (
                <Text style={s.weakSpotText}>Play more rounds to unlock your personal insights.</Text>
              ) : weakSpot ? (
                <>
                  <Text style={s.weakSpotLabel}>{weakSpot.label}</Text>
                  <Text style={s.weakSpotText}>{weakSpot.pct}% of your misses involve this tell. Focus on spotting it in your next rounds.</Text>
                </>
              ) : (
                <Text style={s.weakSpotText}>No consistent weak spot found — you're performing well across the board.</Text>
              )}
            </SectionCard>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: colors.bg },
  scroll: { paddingHorizontal: 20, paddingBottom: 40 },
  heading: { fontSize: 26, fontFamily: fonts.bold, color: colors.textPrimary, marginTop: 20, marginBottom: 16 },

  card:      { backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: '#2A2A2A', padding: 18, marginBottom: 14 },
  cardTitle: { fontSize: 14, fontFamily: fonts.semiBold, color: colors.textSecondary, marginBottom: 14, letterSpacing: 0.5 },

  emptyChart:    { fontSize: 13, fontFamily: fonts.regular, color: colors.textTertiary, textAlign: 'center', paddingVertical: 20 },
  weakSpotLabel: { fontSize: 17, fontFamily: fonts.bold, color: colors.textPrimary, marginBottom: 6 },
  weakSpotText:  { fontSize: 13, fontFamily: fonts.regular, color: colors.textSecondary, lineHeight: 20 },

  lockedWrap:    { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 36 },
  lockedTitle:   { fontSize: 22, fontFamily: fonts.bold, color: colors.textPrimary, textAlign: 'center', marginBottom: 10 },
  lockedSub:     { fontSize: 14, fontFamily: fonts.regular, color: colors.textSecondary, textAlign: 'center', lineHeight: 22, marginBottom: 28 },
  lockedBtn:     { backgroundColor: '#7c3aed', paddingVertical: 14, paddingHorizontal: 36, borderRadius: radius.pill },
  lockedBtnText: { fontSize: 15, fontFamily: fonts.bold, color: '#fff' },
});
