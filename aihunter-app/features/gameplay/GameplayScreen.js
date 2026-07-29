import { useState, useRef, useCallback } from 'react';
import {
  View, Text, Animated, TouchableOpacity,
  StyleSheet, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { supabase } from '../../lib/supabase';
import { consumeCachedTask } from '../../lib/taskCache';
import { useAuth } from '../../context/AuthContext';
import { useHaptics } from '../../context/HapticsContext';
import { colors, fonts, radius } from '../../constants/theme';

export default function GameplayScreen({ navigation }) {
  const { user } = useAuth();
  const { medium, success, error: hapticError } = useHaptics();
  const [task, setTask]             = useState(null);
  const [leftIsReal, setLeftIsReal] = useState(true);
  const [loading, setLoading]       = useState(true);
  const [voting, setVoting]         = useState(false);
  const [tappedSide, setTappedSide] = useState(null);
  const [error, setError]           = useState(null);
  const loadCount = useRef(0);
  const fadeAnim  = useRef(new Animated.Value(0)).current;
  const startTime = useRef(Date.now());

  useFocusEffect(useCallback(() => { fetchTask(); }, []));

  async function fetchTask() {
    setLoading(true);
    setError(null);
    setVoting(false);
    setTappedSide(null);
    loadCount.current = 0;
    fadeAnim.setValue(0);

    // Use pre-fetched task if available (no network wait)
    const cached = consumeCachedTask();
    if (cached) {
      setTask(cached);
      setLeftIsReal(Math.random() > 0.5);
      startTime.current = Date.now();
      setLoading(false);
      return;
    }

    // Live fetch fallback
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

  function handleImageLoad() {
    loadCount.current += 1;
    if (loadCount.current >= 2) {
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }).start();
    }
  }

  async function handleTap(tappedLeft) {
    if (voting) return;
    medium();
    setTappedSide(tappedLeft ? 'left' : 'right');
    setVoting(true);

    const tappedReal       = tappedLeft === leftIsReal;
    const chose_ai         = tappedReal;
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

    data.was_correct ? success() : hapticError();
    navigation.navigate('Results', { result: data, task, leftIsReal });
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.textPrimary} />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>{error}</Text>
      </View>
    );
  }

  const leftUrl  = leftIsReal ? task.real_image_url : task.ai_image_url;
  const rightUrl = leftIsReal ? task.ai_image_url   : task.real_image_url;

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.prompt}>Tap the real image</Text>

      <View style={styles.imageRow}>
        <TouchableOpacity
          style={[styles.imageWrapper, tappedSide === 'left' && styles.imageWrapperSelected]}
          activeOpacity={voting ? 1 : 0.9}
          onPress={() => handleTap(true)}
          disabled={voting}
        >
          <Animated.Image
            source={{ uri: leftUrl }}
            style={[styles.image, { opacity: fadeAnim }]}
            resizeMode="cover"
            onLoadEnd={handleImageLoad}
          />
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.imageWrapper, tappedSide === 'right' && styles.imageWrapperSelected]}
          activeOpacity={voting ? 1 : 0.9}
          onPress={() => handleTap(false)}
          disabled={voting}
        >
          <Animated.Image
            source={{ uri: rightUrl }}
            style={[styles.image, { opacity: fadeAnim }]}
            resizeMode="cover"
            onLoadEnd={handleImageLoad}
          />
        </TouchableOpacity>
      </View>

      {voting && (
        <View style={styles.votingOverlay}>
          <ActivityIndicator color={colors.textPrimary} />
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  center:               { flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' },
  errorText:            { color: colors.incorrect, fontSize: 16, fontFamily: fonts.medium },
  container:            { flex: 1, backgroundColor: colors.bg, padding: 16, gap: 20, justifyContent: 'center' },
  prompt:               { fontSize: 20, fontFamily: fonts.semiBold, color: colors.textPrimary, textAlign: 'center' },
  imageRow:             { flexDirection: 'row', gap: 10 },
  imageWrapper:         { flex: 1, aspectRatio: 0.5, borderRadius: radius.lg, overflow: 'hidden', backgroundColor: colors.surface, borderWidth: 3, borderColor: 'transparent' },
  imageWrapperSelected: { borderColor: colors.textPrimary },
  image:                { width: '100%', height: '100%' },
  votingOverlay:        { position: 'absolute', bottom: 32, left: 0, right: 0, alignItems: 'center' },
});
