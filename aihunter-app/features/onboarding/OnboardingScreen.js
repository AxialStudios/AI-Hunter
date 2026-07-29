import { useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { colors, fonts, radius } from '../../constants/theme';

const AGE_RANGES = ['Under 13', '13–17', '18–24', '25–34', '35–44', '45–54', '55+'];

const REGIONS = [
  'North America', 'Latin America', 'Europe',
  'Africa', 'Middle East', 'South Asia', 'East Asia / Pacific', 'Other',
];

const FLUENCY_OPTIONS = [
  { value: 'novice',        label: 'Novice',        sub: 'New to AI-generated images' },
  { value: 'intermediate',  label: 'Intermediate',  sub: 'Seen a fair amount' },
  { value: 'expert',        label: 'Expert',        sub: 'Work with or study AI images' },
];

export default function OnboardingScreen({ navigation }) {
  const { user } = useAuth();
  const [ageRange, setAgeRange] = useState(null);
  const [region, setRegion]     = useState(null);
  const [fluency, setFluency]   = useState(null);
  const [saving, setSaving]     = useState(false);
  const [error, setError]       = useState(null);

  const under13    = ageRange === 'Under 13';
  const canProceed = ageRange && region && fluency && !under13;

  async function handleAgreeAndPlay() {
    if (!canProceed || saving) return;
    setSaving(true);
    setError(null);

    const { error: upsertError } = await supabase.from('profiles').upsert({
      id:                 user.id,
      age_range:          ageRange,
      region,
      self_rated_fluency: fluency,
      consent_version:    '1.0',
      consented_at:       new Date().toISOString(),
    });

    setSaving(false);
    if (upsertError) {
      setError(upsertError.message);
      return;
    }
    navigation.navigate('Gameplay');
  }

  return (
    <SafeAreaView style={styles.safe}>
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Before you play</Text>

      <Section label="How old are you?">
        {AGE_RANGES.map(r => (
          <Chip key={r} label={r} selected={ageRange === r} onPress={() => setAgeRange(r)} />
        ))}
      </Section>

      {under13 && (
        <Text style={styles.ageGate}>This app is for users 13 and older.</Text>
      )}

      <Section label="Where are you from?">
        {REGIONS.map(r => (
          <Chip key={r} label={r} selected={region === r} onPress={() => setRegion(r)} />
        ))}
      </Section>

      <Section label="How familiar are you with AI-generated images?">
        {FLUENCY_OPTIONS.map(f => (
          <ChipWide
            key={f.value}
            label={f.label}
            sub={f.sub}
            selected={fluency === f.value}
            onPress={() => setFluency(f.value)}
          />
        ))}
      </Section>

      <Text style={styles.consent}>
        We collect anonymous gameplay data and your survey answers to study how people
        perceive AI-generated images. No personal information is linked to your account.
      </Text>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <TouchableOpacity
        style={[styles.button, !canProceed && styles.buttonDisabled]}
        onPress={handleAgreeAndPlay}
        disabled={!canProceed || saving}
      >
        {saving
          ? <ActivityIndicator color={colors.bg} />
          : <Text style={[styles.buttonText, !canProceed && styles.buttonTextDisabled]}>Agree &amp; play</Text>}
      </TouchableOpacity>
    </ScrollView>
    </SafeAreaView>
  );
}

function Section({ label, children }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionLabel}>{label}</Text>
      <View style={styles.chips}>{children}</View>
    </View>
  );
}

function Chip({ label, selected, onPress }) {
  return (
    <TouchableOpacity
      style={[styles.chip, selected && styles.chipSelected]}
      onPress={onPress}
    >
      <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{label}</Text>
    </TouchableOpacity>
  );
}

function ChipWide({ label, sub, selected, onPress }) {
  return (
    <TouchableOpacity
      style={[styles.chipWide, selected && styles.chipSelected]}
      onPress={onPress}
    >
      <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{label}</Text>
      <Text style={[styles.chipSub, selected && styles.chipSubSelected]}>{sub}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  safe:              { flex: 1, backgroundColor: colors.bg },
  container:         { padding: 24, paddingBottom: 48 },
  title:             { fontSize: 28, fontFamily: fonts.bold, color: colors.textPrimary, marginBottom: 32, marginTop: 8 },

  section:           { marginBottom: 28 },
  sectionLabel:      { fontSize: 13, fontFamily: fonts.semiBold, color: colors.textSecondary, marginBottom: 12, textTransform: 'uppercase', letterSpacing: 0.8 },
  chips:             { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },

  chip:              { paddingHorizontal: 16, paddingVertical: 10, borderRadius: radius.pill, borderWidth: 1.5, borderColor: colors.border, backgroundColor: colors.surface },
  chipSelected:      { borderColor: colors.textPrimary, backgroundColor: colors.surface },
  chipText:          { fontSize: 14, fontFamily: fonts.medium, color: colors.textSecondary },
  chipTextSelected:  { color: colors.textPrimary },

  chipWide:          { width: '100%', paddingHorizontal: 16, paddingVertical: 14, borderRadius: radius.lg, borderWidth: 1.5, borderColor: colors.border, backgroundColor: colors.surface, marginBottom: 8 },
  chipSub:           { fontSize: 12, fontFamily: fonts.regular, color: colors.textTertiary, marginTop: 3 },
  chipSubSelected:   { color: colors.textSecondary },

  ageGate:           { color: colors.incorrect, marginBottom: 16, fontFamily: fonts.semiBold, fontSize: 13 },
  consent:           { fontSize: 12, fontFamily: fonts.regular, color: colors.textTertiary, lineHeight: 18, marginBottom: 28, marginTop: 4 },
  error:             { color: colors.incorrect, marginBottom: 12, fontFamily: fonts.medium, fontSize: 13 },

  button:            { backgroundColor: colors.textPrimary, paddingVertical: 18, borderRadius: radius.pill, alignItems: 'center' },
  buttonDisabled:    { backgroundColor: colors.surface2 },
  buttonText:        { color: colors.bg, fontSize: 17, fontFamily: fonts.bold },
  buttonTextDisabled:{ color: colors.textTertiary },
});
