import { View, Text, Button, StyleSheet } from 'react-native';

export default function ResultsScreen({ navigation }) {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Results</Text>
      <Button title="Next Card" onPress={() => navigation.navigate('Gameplay')} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 24, marginBottom: 24 },
});
