import { useState } from 'react';
import {
  View, Text, Image, TouchableOpacity,
  ScrollView, StyleSheet, Dimensions,
} from 'react-native';

const { width } = Dimensions.get('window');
const TRACK_WIDTH = width - 120;

export default function ResultsScreen({ route, navigation }) {
  const { result, task } = route.params;
  const { was_correct, real_pct, ai_pct, total_votes } = result;
  const [showTells, setShowTells] = useState(false);

  return (
    <ScrollView contentContainerStyle={styles.container}>
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

      <TouchableOpacity
        style={styles.tellsToggle}
        onPress={() => setShowTells(v => !v)}
      >
        <Text style={styles.tellsToggleText}>
          {showTells ? 'Hide tells ▲' : 'See the tells ▼'}
        </Text>
      </TouchableOpacity>

      {showTells && (
        <View style={styles.tellsSection}>
          <Text style={styles.tellsHeading}>The AI image</Text>
          <Image
            source={{ uri: task.ai_image_url }}
            style={styles.aiImage}
            resizeMode="cover"
          />
          <Text style={styles.tellsSubheading}>What to look for</Text>
          {task.tell_annotations.map((tell, i) => (
            <View key={i} style={styles.tellRow}>
              <Text style={styles.tellLabel}>{tell.label}</Text>
              <Text style={styles.tellDescription}>{tell.description}</Text>
            </View>
          ))}
        </View>
      )}

      <TouchableOpacity
        style={styles.button}
        onPress={() => navigation.navigate('Gameplay')}
      >
        <Text style={styles.buttonText}>Next Card →</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container:       { alignItems: 'center', padding: 32, paddingBottom: 48 },
  verdict:         { fontSize: 42, fontWeight: '800', marginBottom: 8, marginTop: 16 },
  correct:         { color: '#27ae60' },
  incorrect:       { color: '#e74c3c' },
  subtitle:        { fontSize: 16, color: '#555', marginBottom: 40 },

  barsSection:     { width: '100%', marginBottom: 24 },
  barsTitle:       { fontSize: 14, fontWeight: '600', color: '#888', marginBottom: 16, textAlign: 'center', textTransform: 'uppercase', letterSpacing: 1 },
  barRow:          { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  barLabel:        { width: 36, fontSize: 13, fontWeight: '600', color: '#444' },
  barTrack:        { width: TRACK_WIDTH, height: 18, backgroundColor: '#eee', borderRadius: 9, overflow: 'hidden' },
  barFill:         { height: '100%', borderRadius: 9 },
  barReal:         { backgroundColor: '#27ae60' },
  barAI:           { backgroundColor: '#e74c3c' },
  barPct:          { width: 40, fontSize: 13, fontWeight: '700', color: '#444', textAlign: 'right' },
  totalVotes:      { textAlign: 'center', fontSize: 12, color: '#aaa', marginTop: 12 },

  tellsToggle:     { paddingVertical: 12, paddingHorizontal: 24, borderWidth: 1.5, borderColor: '#ccc', borderRadius: 20, marginBottom: 24 },
  tellsToggleText: { fontSize: 14, fontWeight: '600', color: '#444' },

  tellsSection:    { width: '100%', marginBottom: 32 },
  tellsHeading:    { fontSize: 16, fontWeight: '700', marginBottom: 12, color: '#222' },
  aiImage:         { width: '100%', height: (width - 64) * 1.1, borderRadius: 12, marginBottom: 20 },
  tellsSubheading: { fontSize: 13, fontWeight: '700', color: '#888', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12 },
  tellRow:         { marginBottom: 14, paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  tellLabel:       { fontSize: 14, fontWeight: '700', color: '#222', marginBottom: 4 },
  tellDescription: { fontSize: 14, color: '#555', lineHeight: 20 },

  button:          { backgroundColor: '#333', paddingVertical: 16, paddingHorizontal: 48, borderRadius: 12 },
  buttonText:      { color: '#fff', fontSize: 17, fontWeight: '700' },
});
