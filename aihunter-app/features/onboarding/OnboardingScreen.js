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

const AGE_OPTIONS = [
  { value: 'Under 13', label: 'Under 13', emoji: '🧒' },
  { value: '13–17',    label: '13–17',    emoji: '🎒' },
  { value: '18–24',    label: '18–24',    emoji: '🎓' },
  { value: '25–34',    label: '25–34',    emoji: '💼' },
  { value: '35–44',    label: '35–44',    emoji: '🏠' },
  { value: '45–54',    label: '45–54',    emoji: '⭐' },
  { value: '55+',      label: '55+',      emoji: '🌟' },
];

const REGION_OPTIONS = [
  { value: 'North America',       label: 'North America',       emoji: '🌎' },
  { value: 'Latin America',       label: 'Latin America',       emoji: '🌮' },
  { value: 'Europe',              label: 'Europe',              emoji: '🏰' },
  { value: 'Africa',              label: 'Africa',              emoji: '🌍' },
  { value: 'Middle East',         label: 'Middle East',         emoji: '🌙' },
  { value: 'South Asia',          label: 'South Asia',          emoji: '🕌' },
  { value: 'East Asia / Pacific', label: 'East Asia / Pacific', emoji: '🌏' },
  { value: 'Other',               label: 'Other',               emoji: '🌐' },
];

const FLUENCY_OPTIONS = [
  { value: 'novice',       label: 'Novice',       sub: 'New to AI-generated images',     emoji: '👀' },
  { value: 'intermediate', label: 'Intermediate', sub: 'Seen a fair amount',              emoji: '🔍' },
  { value: 'expert',       label: 'Expert',       sub: 'Work with or study AI images',   emoji: '🧠' },
];

const STEPS = [
  { key: 'age',     emoji: '📅', accentBg: '#1C1200', question: 'How old are you?',                        options: AGE_OPTIONS },
  { key: 'region',  emoji: '🌍', accentBg: '#001419', question: 'Where are you from?',                     options: REGION_OPTIONS },
  { key: 'fluency', emoji: '🤖', accentBg: '#130019', question: 'How familiar are you\nwith AI images?',   options: FLUENCY_OPTIONS },
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
    navigation.navigate('Gameplay');
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
        <View style={styles.backBtn} />
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

        {/* Illustration */}
        <View style={[styles.illustration, { backgroundColor: current.accentBg }]}>
          <Text style={styles.illustrationEmoji}>{current.emoji}</Text>
        </View>

        <Text style={styles.question}>{current.question}</Text>

        {/* Option pills */}
        <View style={styles.optionList}>
          {current.options.map(opt => (
            <OptionRow
              key={opt.value}
              emoji={opt.emoji}
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

        {step === STEPS.length - 1 && (
          <Text style={styles.consent}>
            By continuing you agree to our collection of anonymous gameplay data and survey
            answers to study AI image perception. No personal info is linked to your account.
          </Text>
        )}

        {error ? <Text style={styles.errorText}>{error}</Text> : null}

      </ScrollView>

      {/* Footer */}
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

function OptionRow({ emoji, label, sub, selected, onPress }) {
  return (
    <TouchableOpacity
      style={[styles.optionRow, selected && styles.optionRowSelected]}
      onPress={onPress}
      activeOpacity={0.75}
    >
      <Text style={styles.optionEmoji}>{emoji}</Text>
      <View style={{ flex: 1 }}>
        <Text style={[styles.optionLabel, selected && styles.optionLabelSelected]}>{label}</Text>
        {sub ? <Text style={styles.optionSub}>{sub}</Text> : null}
      </View>
      {selected && <Text style={styles.checkmark}>✓</Text>}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  safe:               { flex: 1, backgroundColor: colors.bg },

  header:             { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingTop: 12, paddingBottom: 16, gap: 12 },
  backBtn:            { width: 36, alignItems: 'flex-start' },
  backArrow:          { fontSize: 22, color: colors.textPrimary },
  progressRow:        { flex: 1, flexDirection: 'row', gap: 6 },
  progressSegment:    { flex: 1, height: 4, borderRadius: 2, backgroundColor: colors.surface2 },
  progressActive:     { backgroundColor: colors.textPrimary },

  content:            { paddingHorizontal: 20, paddingBottom: 24 },

  illustration:       { width: '100%', height: 120, borderRadius: radius.xl, alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  illustrationEmoji:  { fontSize: 64 },

  question:           { fontSize: 30, fontFamily: fonts.bold, color: colors.textPrimary, lineHeight: 38, textAlign: 'center', marginBottom: 24 },

  optionList:         { gap: 10, marginBottom: 16 },
  optionRow:          { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 16, paddingHorizontal: 18, borderRadius: radius.pill, borderWidth: 2, borderColor: colors.border, backgroundColor: colors.surface },
  optionRowSelected:  { borderColor: colors.textPrimary },
  optionEmoji:        { fontSize: 24, width: 32, textAlign: 'center' },
  optionLabel:        { fontSize: 16, fontFamily: fonts.semiBold, color: colors.textSecondary },
  optionLabelSelected:{ color: colors.textPrimary },
  optionSub:          { fontSize: 13, fontFamily: fonts.regular, color: colors.textTertiary, marginTop: 2 },
  checkmark:          { fontSize: 16, color: colors.textPrimary, fontFamily: fonts.bold },

  ageGate:            { color: colors.incorrect, fontFamily: fonts.semiBold, fontSize: 14, textAlign: 'center' },
  consent:            { fontSize: 12, fontFamily: fonts.regular, color: colors.textTertiary, lineHeight: 19, textAlign: 'center' },
  errorText:          { color: colors.incorrect, fontFamily: fonts.medium, fontSize: 13, textAlign: 'center' },

  footer:             { padding: 20, paddingBottom: 16 },
  btn:                { backgroundColor: colors.textPrimary, paddingVertical: 18, borderRadius: radius.pill, alignItems: 'center' },
  btnDisabled:        { backgroundColor: colors.surface2 },
  btnText:            { color: colors.bg, fontSize: 17, fontFamily: fonts.bold },
  btnTextDisabled:    { color: colors.textTertiary },
});
