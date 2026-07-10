import { View, Text, Button, StyleSheet } from 'react-native';

export default function OnboardingScreen({ navigation }) {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Onboarding</Text>
      <Button title="Start Playing" onPress={() => navigation.navigate('Gameplay')} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 24, marginBottom: 24 },
});
