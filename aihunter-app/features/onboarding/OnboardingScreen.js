import { useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, ActivityIndicator,
} from 'react-native';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';

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
          ? <ActivityIndicator color="#fff" />
          : <Text style={styles.buttonText}>Agree &amp; play</Text>}
      </TouchableOpacity>
    </ScrollView>
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
  container:        { padding: 24, paddingBottom: 48 },
  title:            { fontSize: 26, fontWeight: '700', marginBottom: 28, marginTop: 16 },
  section:          { marginBottom: 24 },
  sectionLabel:     { fontSize: 15, fontWeight: '600', marginBottom: 10, color: '#333' },
  chips:            { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip:             { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1.5, borderColor: '#ccc', backgroundColor: '#f5f5f5' },
  chipWide:         { width: '100%', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 10, borderWidth: 1.5, borderColor: '#ccc', backgroundColor: '#f5f5f5', marginBottom: 4 },
  chipSelected:     { borderColor: '#4A90E2', backgroundColor: '#EBF3FB' },
  chipText:         { fontSize: 14, color: '#444' },
  chipTextSelected: { color: '#1a6bb5', fontWeight: '600' },
  chipSub:          { fontSize: 12, color: '#777', marginTop: 2 },
  chipSubSelected:  { color: '#4A90E2' },
  ageGate:          { color: '#c0392b', marginBottom: 16, fontWeight: '600' },
  consent:          { fontSize: 12, color: '#666', lineHeight: 18, marginBottom: 24, marginTop: 4 },
  error:            { color: '#c0392b', marginBottom: 12 },
  button:           { backgroundColor: '#4A90E2', paddingVertical: 16, borderRadius: 12, alignItems: 'center' },
  buttonDisabled:   { backgroundColor: '#aac8ee' },
  buttonText:       { color: '#fff', fontSize: 17, fontWeight: '700' },
});
