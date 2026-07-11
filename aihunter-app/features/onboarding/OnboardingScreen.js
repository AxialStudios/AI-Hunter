import { View, Text, Button, StyleSheet } from 'react-native';
import { useAuth } from '../../context/AuthContext';

export default function OnboardingScreen({ navigation }) {
  const { user } = useAuth();

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Onboarding</Text>
      <Text style={styles.uid}>uid: {user?.id ?? 'none'}</Text>
      <Button title="Start Playing" onPress={() => navigation.navigate('Gameplay')} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 24, marginBottom: 12 },
  uid: { fontSize: 11, color: '#888', marginBottom: 24 },
});
