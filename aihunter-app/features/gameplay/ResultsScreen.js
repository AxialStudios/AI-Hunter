import { View, Text, TouchableOpacity, StyleSheet, Dimensions } from 'react-native';

const { width } = Dimensions.get('window');
const TRACK_WIDTH = width - 120;

export default function ResultsScreen({ route, navigation }) {
  const { result } = route.params;
  const { was_correct, real_pct, ai_pct, total_votes } = result;

  return (
    <View style={styles.container}>
      <Text style={[styles.verdict, was_correct ? styles.correct : styles.incorrect]}>
        {was_correct ? 'Correct!' : 'Fooled!'}
      </Text>

      <Text style={styles.subtitle}>
        {was_correct ? 'You spotted the real image.' : 'You picked the AI image.'}
      </Text>

      <View style={styles.barsSection}>
        <Text style={styles.barsTitle}>How everyone voted</Text>

        <View style={styles.barRow}>
          <Text style={styles.barLabel}>Real</Text>
          <View style={styles.barTrack}>
            <View style={[styles.barFill, styles.barReal, { width: `${real_pct}%` }]} />
          </View>
          <Text style={styles.barPct}>{real_pct}%</Text>
        </View>

        <View style={styles.barRow}>
          <Text style={styles.barLabel}>AI</Text>
          <View style={styles.barTrack}>
            <View style={[styles.barFill, styles.barAI, { width: `${ai_pct}%` }]} />
          </View>
          <Text style={styles.barPct}>{ai_pct}%</Text>
        </View>

        <Text style={styles.totalVotes}>{total_votes.toLocaleString()} votes total</Text>
      </View>

      <TouchableOpacity style={styles.button} onPress={() => navigation.navigate('Gameplay')}>
        <Text style={styles.buttonText}>Next Card →</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container:    { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  verdict:      { fontSize: 42, fontWeight: '800', marginBottom: 8 },
  correct:      { color: '#27ae60' },
  incorrect:    { color: '#e74c3c' },
  subtitle:     { fontSize: 16, color: '#555', marginBottom: 40 },

  barsSection:  { width: '100%', marginBottom: 40 },
  barsTitle:    { fontSize: 14, fontWeight: '600', color: '#888', marginBottom: 16, textAlign: 'center', textTransform: 'uppercase', letterSpacing: 1 },

  barRow:       { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  barLabel:     { width: 36, fontSize: 13, fontWeight: '600', color: '#444' },
  barTrack:     { width: TRACK_WIDTH, height: 18, backgroundColor: '#eee', borderRadius: 9, overflow: 'hidden' },
  barFill:      { height: '100%', borderRadius: 9 },
  barReal:      { backgroundColor: '#27ae60' },
  barAI:        { backgroundColor: '#e74c3c' },
  barPct:       { width: 40, fontSize: 13, fontWeight: '700', color: '#444', textAlign: 'right' },

  totalVotes:   { textAlign: 'center', fontSize: 12, color: '#aaa', marginTop: 12 },

  button:       { backgroundColor: '#333', paddingVertical: 16, paddingHorizontal: 48, borderRadius: 12 },
  buttonText:   { color: '#fff', fontSize: 17, fontWeight: '700' },
});
