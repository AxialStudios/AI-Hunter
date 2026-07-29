import { useState, useEffect, useRef } from 'react';
import {
  View, Text, Image, TouchableOpacity,
  StyleSheet, ActivityIndicator, Dimensions,
} from 'react-native';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';

const { width } = Dimensions.get('window');
const IMAGE_WIDTH  = (width - 48) / 2;
const IMAGE_HEIGHT = IMAGE_WIDTH * 1.35;

export default function GameplayScreen({ navigation }) {
  const { user } = useAuth();
  const [task, setTask]             = useState(null);
  const [leftIsReal, setLeftIsReal] = useState(true);
  const [loading, setLoading]       = useState(true);
  const [voting, setVoting]         = useState(false);
  const [error, setError]           = useState(null);
  const startTime = useRef(Date.now());

  useEffect(() => { fetchTask(); }, []);

  async function fetchTask() {
    setLoading(true);
    setError(null);
    setVoting(false);

    const { count, error: countErr } = await supabase
      .from('tasks')
      .select('*', { count: 'exact', head: true })
      .eq('approval_status', 'active');

    if (countErr || !count) {
      setError('Could not load a card.');
      setLoading(false);
      return;
    }

    const randomIndex = Math.floor(Math.random() * count);
    const { data, error: fetchErr } = await supabase
      .from('tasks')
      .select('*')
      .eq('approval_status', 'active')
      .range(randomIndex, randomIndex)
      .single();

    if (fetchErr || !data) {
      setError('Could not load a card.');
      setLoading(false);
      return;
    }

    setTask(data);
    setLeftIsReal(Math.random() > 0.5);
    startTime.current = Date.now();
    setLoading(false);
  }

  async function handleTap(tappedLeft) {
    if (voting) return;
    setVoting(true);

    // tappedLeft===leftIsReal means they tapped the real image → correct
    const tappedReal       = tappedLeft === leftIsReal;
    const chose_ai         = tappedReal; // true = correctly identified AI by picking real
    const response_time_ms = Date.now() - startTime.current;

    const { data, error: voteErr } = await supabase.rpc('record_vote', {
      p_task_id:          task.id,
      p_user_id:          user.id,
      p_chose_ai:         chose_ai,
      p_response_time_ms: response_time_ms,
    });

    if (voteErr) {
      console.error('Vote error:', voteErr.message);
      setVoting(false);
      return;
    }

    navigation.navigate('Results', { result: data, task, leftIsReal });
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.center}>
        <Text style={styles.error}>{error}</Text>
      </View>
    );
  }

  const leftUrl  = leftIsReal ? task.real_image_url : task.ai_image_url;
  const rightUrl = leftIsReal ? task.ai_image_url   : task.real_image_url;

  return (
    <View style={styles.container}>
      <Text style={styles.prompt}>Tap the real image</Text>

      <View style={styles.imageRow}>
        <TouchableOpacity
          style={styles.imageWrapper}
          activeOpacity={0.85}
          onPress={() => handleTap(true)}
          disabled={voting}
        >
          <Image source={{ uri: leftUrl }} style={styles.image} resizeMode="cover" />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.imageWrapper}
          activeOpacity={0.85}
          onPress={() => handleTap(false)}
          disabled={voting}
        >
          <Image source={{ uri: rightUrl }} style={styles.image} resizeMode="cover" />
        </TouchableOpacity>
      </View>

      {voting && <ActivityIndicator style={styles.spinner} />}
    </View>
  );
}

const styles = StyleSheet.create({
  center:       { flex: 1, alignItems: 'center', justifyContent: 'center' },
  container:    { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 16 },
  prompt:       { fontSize: 22, fontWeight: '700', marginBottom: 24, textAlign: 'center' },
  imageRow:     { flexDirection: 'row', gap: 16 },
  imageWrapper: { borderRadius: 12, overflow: 'hidden' },
  image:        { width: IMAGE_WIDTH, height: IMAGE_HEIGHT },
  spinner:      { marginTop: 24 },
  error:        { color: 'red', fontSize: 16 },
});
