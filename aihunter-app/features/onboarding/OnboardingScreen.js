import { useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { useHaptics } from '../../context/HapticsContext';
import { colors, fonts, radius } from '../../constants/theme';
import { Feather } from '@expo/vector-icons';

const AGE_OPTIONS = [
  { value: 'Under 13', label: 'Under 13' },
  { value: '13–17',    label: '13–17'    },
  { value: '18–24',    label: '18–24'    },
  { value: '25–34',    label: '25–34'    },
  { value: '35–44',    label: '35–44'    },
  { value: '45–54',    label: '45–54'    },
  { value: '55+',      label: '55+'      },
];

const REGION_OPTIONS = [
  { value: 'North America',       label: 'North America'       },
  { value: 'Latin America',       label: 'Latin America'       },
  { value: 'Europe',              label: 'Europe'              },
  { value: 'Africa',              label: 'Africa'              },
  { value: 'Middle East',         label: 'Middle East'         },
  { value: 'South Asia',          label: 'South Asia'          },
  { value: 'East Asia / Pacific', label: 'East Asia / Pacific' },
  { value: 'Other',               label: 'Other'               },
];

const FLUENCY_OPTIONS = [
  { value: 'novice',       label: 'Beginner',     sub: 'New to AI-generated images'   },
  { value: 'intermediate', label: 'Intermediate', sub: 'Seen a fair amount'            },
  { value: 'expert',       label: 'Expert',       sub: 'Work with or study AI images' },
];

const STEPS = [
  { key: 'age',     emoji: '📅', question: 'How old are you?',                      options: AGE_OPTIONS },
  { key: 'region',  emoji: '🌍', question: 'Where are you from?',                   options: REGION_OPTIONS },
  { key: 'fluency', emoji: '🤖', question: 'How familiar are you\nwith AI images?', options: FLUENCY_OPTIONS },
];

export default function OnboardingScreen({ navigation }) {
  const { user } = useAuth();
  const { light, medium } = useHaptics();
  const [step, setStep]         = useState(0);
  const [ageRange, setAgeRange] = useState(null);
  const [region, setRegion]     = useState(null);
  const [fluency, setFluency]   = useState(null);
  const [saving, setSaving]     = useState(false);
  const [error, setError]       = useState(null);

  const under13 = ageRange === 'Under 13';
  const stepValue = [ageRange, region, fluency][step];
  const canContinue = !!stepValue && !under13;

  function handleSkip() {
    navigation.reset({ index: 0, routes: [{ name: 'Main' }] });
  }

  function handleSelect(value) {
    light();
    if (step === 0) setAgeRange(value);
    if (step === 1) setRegion(value);
    if (step === 2) setFluency(value);
  }

  async function handleContinue() {
    if (!canContinue || saving) return;
    medium();
    if (step < STEPS.length - 1) { setStep(s => s + 1); return; }
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
    navigation.reset({ index: 0, routes: [{ name: 'Main' }] });
  }

  const current = STEPS[step];

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
            <View key={i} style={[styles.progressSegment, i <= step && styles.progressActive]} />
          ))}
        </View>
        <TouchableOpacity style={styles.skipBtn} onPress={handleSkip} activeOpacity={0.6}>
          <Text style={styles.skipText}>Skip</Text>
        </TouchableOpacity>
      </View>

      {/* Illustration + Question: fixed above pills so spacing is always consistent */}
      <View style={styles.topSection}>
        <Text style={styles.illustrationEmoji}>{current.emoji}</Text>
        <Text style={styles.question}>{current.question}</Text>
      </View>

      {/* Pills scroll independently beneath the fixed header block */}
      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.pillsContent} showsVerticalScrollIndicator={false}>
        <View style={styles.optionList}>
          {current.options.map(opt => (
            <OptionRow
              key={opt.value}
              label={opt.label}
              sub={opt.sub}
              selected={stepValue === opt.value}
              onPress={() => handleSelect(opt.value)}
            />
          ))}
        </View>

        {under13 && (
          <Text style={styles.ageGate}>This app is for users 13 and older.</Text>
        )}

        {error ? <Text style={styles.errorText}>{error}</Text> : null}
      </ScrollView>

      {/* Footer */}
      <View style={styles.footer}>
        {step === STEPS.length - 1 && (
          <Text style={styles.consent}>
            By continuing you agree to our collection of anonymous gameplay data and survey
            answers to study AI image perception. No personal info is linked to your account.
          </Text>
        )}
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

function OptionRow({ label, sub, selected, onPress }) {
  return (
    <TouchableOpacity
      style={[styles.optionRow, selected && styles.optionRowSelected]}
      onPress={onPress}
      activeOpacity={0.75}
    >
      <View style={styles.optionTextBlock}>
        <Text style={[styles.optionLabel, selected && styles.optionLabelSelected]}>{label}</Text>
        {sub ? <Text style={styles.optionSub}>{sub}</Text> : null}
      </View>
      {selected && <Feather name="check" size={19} color={colors.textPrimary} style={styles.optionCheck} />}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  safe:               { flex: 1, backgroundColor: colors.bg },

  header:             { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingTop: 12, paddingBottom: 16, gap: 12 },
  backBtn:            { width: 36, alignItems: 'flex-start' },
  skipBtn:            { width: 36, alignItems: 'flex-end' },
  skipText:           { fontSize: 14, fontFamily: fonts.medium, color: colors.textSecondary },
  backArrow:          { fontSize: 22, color: colors.textPrimary },
  progressRow:        { flex: 1, flexDirection: 'row', gap: 6 },
  progressSegment:    { flex: 1, height: 4, borderRadius: 2, backgroundColor: colors.surface2 },
  progressActive:     { backgroundColor: colors.textPrimary },

  // Illustration + question live outside the ScrollView so their
  // vertical position is fixed relative to the screen, not the scroll content.
  topSection:         { paddingHorizontal: 20 },
  illustrationEmoji:  { fontSize: 72, textAlign: 'center', marginBottom: 16 },
  question:           { fontSize: 30, fontFamily: fonts.bold, color: colors.textPrimary, lineHeight: 38, textAlign: 'center', marginBottom: 28 },

  pillsContent:       { paddingHorizontal: 20, paddingBottom: 24 },
  optionList:         { gap: 10, marginBottom: 16 },
  optionRow:          { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12, paddingVertical: 16, paddingHorizontal: 18, borderRadius: radius.pill, borderWidth: 2, borderColor: colors.border, backgroundColor: colors.surface },
  optionRowSelected:  { borderColor: colors.textPrimary },
  optionTextBlock:    { alignItems: 'center' },
  optionLabel:        { fontSize: 17, fontFamily: fonts.semiBold, color: '#EBEBEB', textAlign: 'center' },
  optionLabelSelected:{ color: colors.textPrimary },
  optionSub:          { fontSize: 14, fontFamily: fonts.regular, color: '#AAAAAA', marginTop: 2, textAlign: 'center' },
  optionCheck:        { position: 'absolute', right: 18 },

  ageGate:            { color: colors.incorrect, fontFamily: fonts.semiBold, fontSize: 14, textAlign: 'center' },
  consent:            { fontSize: 11, fontFamily: fonts.regular, color: colors.textSecondary, lineHeight: 17, textAlign: 'center' },
  errorText:          { color: colors.incorrect, fontFamily: fonts.medium, fontSize: 13, textAlign: 'center' },

  footer:             { padding: 20, paddingBottom: 16, gap: 12 },
  btn:                { backgroundColor: colors.textPrimary, paddingVertical: 18, borderRadius: radius.pill, alignItems: 'center' },
  btnDisabled:        { backgroundColor: colors.surface2 },
  btnText:            { color: colors.bg, fontSize: 17, fontFamily: fonts.bold },
  btnTextDisabled:    { color: colors.textTertiary },
});
