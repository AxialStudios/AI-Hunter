import { useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { colors, fonts, radius } from '../../constants/theme';

const AGE_OPTIONS = ['Under 13', '13–17', '18–24', '25–34', '35–44', '45–54', '55+'];

const REGION_OPTIONS = [
  'North America', 'Latin America', 'Europe', 'Africa',
  'Middle East', 'South Asia', 'East Asia / Pacific', 'Other',
];

const FLUENCY_OPTIONS = [
  { value: 'novice',       label: 'Novice',       sub: 'New to AI-generated images' },
  { value: 'intermediate', label: 'Intermediate', sub: 'Seen a fair amount' },
  { value: 'expert',       label: 'Expert',       sub: 'Work with or study AI images' },
];

const STEPS = [
  {
    key: 'age',
    emoji: '📅',
    accentBg: '#1C1200',
    question: 'How old are you?',
    type: 'grid',
  },
  {
    key: 'region',
    emoji: '🌍',
    accentBg: '#001419',
    question: 'Where are you from?',
    type: 'grid',
  },
  {
    key: 'fluency',
    emoji: '🤖',
    accentBg: '#130019',
    question: 'How familiar are you\nwith AI-generated images?',
    type: 'list',
  },
];

export default function OnboardingScreen({ navigation }) {
  const { user } = useAuth();
  const [step, setStep]       = useState(0);
  const [ageRange, setAgeRange] = useState(null);
  const [region, setRegion]   = useState(null);
  const [fluency, setFluency] = useState(null);
  const [saving, setSaving]   = useState(false);
  const [error, setError]     = useState(null);

  const under13 = ageRange === 'Under 13';
  const stepValue = [ageRange, region, fluency][step];
  const canContinue = !!stepValue && !under13;

  function handleSelect(value) {
    if (step === 0) setAgeRange(value);
    if (step === 1) setRegion(value);
    if (step === 2) setFluency(value);
  }

  async function handleContinue() {
    if (!canContinue || saving) return;
    if (step < STEPS.length - 1) {
      setStep(s => s + 1);
      return;
    }
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
    if (upsertError) { setError(upsertError.message); return; }
    navigation.navigate('Gameplay');
  }

  const current = STEPS[step];
  const currentValue = stepValue;

  const gridOptions = step === 0 ? AGE_OPTIONS : REGION_OPTIONS;

  return (
    <SafeAreaView style={styles.safe}>

      {/* Header */}
      <View style={styles.header}>
        {step > 0 ? (
          <TouchableOpacity style={styles.backBtn} onPress={() => setStep(s => s - 1)}>
            <Text style={styles.backArrow}>←</Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.backBtn} />
        )}
        <View style={styles.progressRow}>
          {STEPS.map((_, i) => (
            <View
              key={i}
              style={[styles.progressSegment, i <= step && styles.progressSegmentActive]}
            />
          ))}
        </View>
        <View style={styles.backBtn} />
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Illustration placeholder */}
        <View style={[styles.illustration, { backgroundColor: current.accentBg }]}>
          <Text style={styles.illustrationEmoji}>{current.emoji}</Text>
        </View>

        <Text style={styles.question}>{current.question}</Text>

        {/* Options */}
        {current.type === 'grid' ? (
          <View style={styles.grid}>
            {gridOptions.map(opt => (
              <TouchableOpacity
                key={opt}
                style={[styles.gridOption, currentValue === opt && styles.optionSelected]}
                onPress={() => handleSelect(opt)}
                activeOpacity={0.75}
              >
                <Text style={[styles.gridOptionText, currentValue === opt && styles.optionTextSelected]}>
                  {opt}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        ) : (
          <View style={styles.list}>
            {FLUENCY_OPTIONS.map(opt => (
              <TouchableOpacity
                key={opt.value}
                style={[styles.listOption, currentValue === opt.value && styles.optionSelected]}
                onPress={() => handleSelect(opt.value)}
                activeOpacity={0.75}
              >
                <View style={{ flex: 1 }}>
                  <Text style={[styles.listOptionLabel, currentValue === opt.value && styles.optionTextSelected]}>
                    {opt.label}
                  </Text>
                  <Text style={styles.listOptionSub}>{opt.sub}</Text>
                </View>
                {currentValue === opt.value && (
                  <Text style={styles.checkmark}>✓</Text>
                )}
              </TouchableOpacity>
            ))}
          </View>
        )}

        {under13 && (
          <Text style={styles.ageGate}>This app is for users 13 and older.</Text>
        )}

        {step === STEPS.length - 1 && (
          <Text style={styles.consent}>
            By continuing you agree to our collection of anonymous gameplay data and survey
            answers to study AI image perception. No personal info is linked to your account.
          </Text>
        )}

        {error ? <Text style={styles.errorText}>{error}</Text> : null}
      </ScrollView>

      {/* Fixed footer */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.btn, !canContinue && styles.btnDisabled]}
          onPress={handleContinue}
          disabled={!canContinue || saving}
          activeOpacity={0.85}
        >
          {saving
            ? <ActivityIndicator color={colors.bg} />
            : <Text style={[styles.btnText, !canContinue && styles.btnTextDisabled]}>
                {step === STEPS.length - 1 ? 'Agree & play' : 'Continue'}
              </Text>
          }
        </TouchableOpacity>
      </View>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:                  { flex: 1, backgroundColor: colors.bg },

  header:                { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingTop: 12, paddingBottom: 16, gap: 12 },
  backBtn:               { width: 36, alignItems: 'flex-start' },
  backArrow:             { fontSize: 22, color: colors.textPrimary },
  progressRow:           { flex: 1, flexDirection: 'row', gap: 6 },
  progressSegment:       { flex: 1, height: 4, borderRadius: 2, backgroundColor: colors.surface2 },
  progressSegmentActive: { backgroundColor: colors.textPrimary },

  content:               { paddingHorizontal: 24, paddingBottom: 24, gap: 24 },

  illustration:          { width: '100%', height: 180, borderRadius: radius.xl, alignItems: 'center', justifyContent: 'center' },
  illustrationEmoji:     { fontSize: 72 },

  question:              { fontSize: 26, fontFamily: fonts.bold, color: colors.textPrimary, lineHeight: 34 },

  grid:                  { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  gridOption:            { width: '47%', paddingVertical: 16, paddingHorizontal: 12, borderRadius: radius.md, borderWidth: 1.5, borderColor: colors.border, backgroundColor: colors.surface, alignItems: 'center' },
  gridOptionText:        { fontSize: 15, fontFamily: fonts.medium, color: colors.textSecondary, textAlign: 'center' },

  list:                  { gap: 10 },
  listOption:            { flexDirection: 'row', alignItems: 'center', paddingVertical: 18, paddingHorizontal: 18, borderRadius: radius.lg, borderWidth: 1.5, borderColor: colors.border, backgroundColor: colors.surface },
  listOptionLabel:       { fontSize: 16, fontFamily: fonts.semiBold, color: colors.textSecondary, marginBottom: 3 },
  listOptionSub:         { fontSize: 13, fontFamily: fonts.regular, color: colors.textTertiary },
  checkmark:             { fontSize: 18, color: colors.textPrimary, fontFamily: fonts.bold },

  optionSelected:        { borderColor: colors.textPrimary, backgroundColor: colors.surface },
  optionTextSelected:    { color: colors.textPrimary },

  ageGate:               { color: colors.incorrect, fontFamily: fonts.semiBold, fontSize: 14 },
  consent:               { fontSize: 12, fontFamily: fonts.regular, color: colors.textTertiary, lineHeight: 19 },
  errorText:             { color: colors.incorrect, fontFamily: fonts.medium, fontSize: 13 },

  footer:                { padding: 24, paddingBottom: 16 },
  btn:                   { backgroundColor: colors.textPrimary, paddingVertical: 18, borderRadius: radius.pill, alignItems: 'center' },
  btnDisabled:           { backgroundColor: colors.surface2 },
  btnText:               { color: colors.bg, fontSize: 17, fontFamily: fonts.bold },
  btnTextDisabled:       { color: colors.textTertiary },
});
