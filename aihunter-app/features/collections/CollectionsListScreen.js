import { useState, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  FlatList, Image, ActivityIndicator, Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../../context/AuthContext';
import { useProStatus } from '../../context/ProContext';
import { supabase } from '../../lib/supabase';
import { colors, fonts, radius } from '../../constants/theme';
import PaywallScreen from '../paywall/PaywallScreen';

function ProgressBar({ played, total }) {
  const pct = total > 0 ? played / total : 0;
  const done = played >= total && total > 0;
  return (
    <View style={s.barTrack}>
      <View style={[s.barFill, { width: `${pct * 100}%`, backgroundColor: done ? colors.correct : colors.textPrimary }]} />
    </View>
  );
}

function CollectionCard({ item, onPress, locked }) {
  const done = item.played >= item.total && item.total > 0;
  return (
    <TouchableOpacity style={s.card} onPress={() => onPress(item)} activeOpacity={0.82}>
      {/* Thumbnail */}
      <View style={s.thumbWrap}>
        {item.thumbnail
          ? <Image source={{ uri: item.thumbnail }} style={s.thumb} resizeMode="cover" />
          : <View style={[s.thumb, { backgroundColor: colors.surface2 }]} />
        }
        {/* Dark scrim */}
        <View style={s.scrim} />
        {/* Completion badge */}
        {done && (
          <View style={s.completeBadge}>
            <Feather name="check-circle" size={18} color={colors.correct} />
            <Text style={s.completeText}>Complete</Text>
          </View>
        )}
        {locked && (
          <View style={s.lockOverlay}>
            <Feather name="lock" size={20} color="rgba(255,255,255,0.8)" />
          </View>
        )}
      </View>

      {/* Info */}
      <View style={s.cardBody}>
        <Text style={s.cardName} numberOfLines={1}>{item.category}</Text>
        <Text style={[s.cardCount, done && { color: colors.correct }]}>
          {item.played} / {item.total}
        </Text>
        <ProgressBar played={item.played} total={item.total} />
      </View>
    </TouchableOpacity>
  );
}

export default function CollectionsListScreen({ navigation }) {
  const { user }      = useAuth();
  const { isPro }     = useProStatus();
  const [collections, setCollections] = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [paywallOpen, setPaywallOpen] = useState(false);

  useFocusEffect(useCallback(() => {
    if (!user) return;
    loadCollections();
  }, [user?.id]));

  async function loadCollections() {
    setLoading(true);
    try {
      // Fetch all active tasks (id, category, thumbnail candidate)
      const { data: tasks } = await supabase
        .from('tasks')
        .select('id, category, real_image_url')
        .eq('approval_status', 'active')
        .order('category', { ascending: true });

      // Fetch all task_ids this user has voted on
      const { data: voteRows } = await supabase
        .from('votes')
        .select('task_id')
        .eq('user_id', user.id);

      const playedSet = new Set((voteRows || []).map(v => v.task_id));

      // Group by category client-side
      const catMap = {};
      for (const t of (tasks || [])) {
        if (!t.category) continue;
        if (!catMap[t.category]) {
          catMap[t.category] = { category: t.category, total: 0, played: 0, thumbnail: t.real_image_url };
        }
        catMap[t.category].total++;
        if (playedSet.has(t.id)) catMap[t.category].played++;
      }

      const sorted = Object.values(catMap)
        .filter(c => c.total > 0)
        .sort((a, b) => a.category.localeCompare(b.category));

      setCollections(sorted);
    } finally {
      setLoading(false);
    }
  }

  function handleCardPress(item) {
    if (!isPro) { setPaywallOpen(true); return; }
    navigation.navigate('CollectionPlay', { category: item.category, total: item.total });
  }

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.header}>
        <Text style={s.heading}>Collections</Text>
        {!isPro && (
          <TouchableOpacity onPress={() => setPaywallOpen(true)} activeOpacity={0.8}>
            <Text style={s.proChip}>PRO</Text>
          </TouchableOpacity>
        )}
      </View>

      {!isPro && (
        <TouchableOpacity style={s.proBanner} onPress={() => setPaywallOpen(true)} activeOpacity={0.85}>
          <Feather name="lock" size={14} color="#a78bfa" />
          <Text style={s.proBannerText}>Collections are a Pro feature — Upgrade to unlock</Text>
          <Feather name="chevron-right" size={14} color="#a78bfa" />
        </TouchableOpacity>
      )}

      {loading ? (
        <ActivityIndicator color={colors.textSecondary} style={{ marginTop: 60 }} />
      ) : collections.length === 0 ? (
        <View style={s.empty}>
          <Feather name="grid" size={32} color={colors.textTertiary} style={{ marginBottom: 12 }} />
          <Text style={s.emptyText}>Collections coming soon</Text>
        </View>
      ) : (
        <FlatList
          data={collections}
          keyExtractor={item => item.category}
          numColumns={2}
          columnWrapperStyle={s.row}
          contentContainerStyle={s.list}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => (
            <CollectionCard
              item={item}
              onPress={handleCardPress}
              locked={!isPro}
            />
          )}
          onRefresh={loadCollections}
          refreshing={loading}
        />
      )}

      <PaywallScreen visible={paywallOpen} onClose={() => setPaywallOpen(false)} />
    </SafeAreaView>
  );
}

const CARD_W = '47%';

const s = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: colors.bg },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingTop: 16, paddingBottom: 12 },
  heading: { fontSize: 26, fontFamily: fonts.bold, color: colors.textPrimary, flex: 1 },
  proChip: { fontSize: 10, fontFamily: fonts.bold, color: '#a78bfa', borderWidth: 1, borderColor: '#a78bfa', borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2, letterSpacing: 1 },

  proBanner:     { flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: 16, marginBottom: 12, backgroundColor: 'rgba(124,58,237,0.1)', borderWidth: 1, borderColor: 'rgba(124,58,237,0.3)', borderRadius: radius.md, padding: 12 },
  proBannerText: { flex: 1, fontSize: 12, fontFamily: fonts.medium, color: '#a78bfa' },

  list: { paddingHorizontal: 16, paddingBottom: 32 },
  row:  { justifyContent: 'space-between', marginBottom: 14 },

  card:     { width: CARD_W, borderRadius: radius.lg, overflow: 'hidden', backgroundColor: colors.surface },
  thumbWrap: { width: '100%', aspectRatio: 1, position: 'relative' },
  thumb:    { width: '100%', height: '100%' },
  scrim:    { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.28)' },

  completeBadge: { position: 'absolute', bottom: 8, left: 8, flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 12, paddingHorizontal: 8, paddingVertical: 3 },
  completeText:  { fontSize: 10, fontFamily: fonts.semiBold, color: colors.correct },
  lockOverlay:   { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center' },

  cardBody:  { padding: 10, gap: 5 },
  cardName:  { fontSize: 13, fontFamily: fonts.semiBold, color: colors.textPrimary },
  cardCount: { fontSize: 11, fontFamily: fonts.regular, color: colors.textSecondary },
  barTrack:  { height: 4, backgroundColor: '#2A2A2A', borderRadius: 2, overflow: 'hidden' },
  barFill:   { height: '100%', borderRadius: 2 },

  empty:     { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyText: { fontSize: 15, fontFamily: fonts.regular, color: colors.textTertiary },
});
