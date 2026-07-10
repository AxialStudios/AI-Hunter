import { View, Text, Button, StyleSheet } from 'react-native';

export default function GameplayScreen({ navigation }) {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Gameplay</Text>
      <Button title="Submit Vote" onPress={() => navigation.navigate('Results')} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 24, marginBottom: 24 },
});
