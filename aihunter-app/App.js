import { View, ActivityIndicator } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { ThemeProvider } from './context/ThemeContext';
import { HapticsProvider } from './context/HapticsContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import OnboardingScreen from './features/onboarding/OnboardingScreen';
import GameplayScreen from './features/gameplay/GameplayScreen';
import ResultsScreen from './features/gameplay/ResultsScreen';

const Stack = createNativeStackNavigator();

function AppNavigator() {
  const { loading } = useAuth();

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <NavigationContainer>
      <Stack.Navigator initialRouteName="Onboarding">
        <Stack.Screen name="Onboarding" component={OnboardingScreen} />
        <Stack.Screen name="Gameplay" component={GameplayScreen} />
        <Stack.Screen name="Results" component={ResultsScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <HapticsProvider>
        <AuthProvider>
          <AppNavigator />
        </AuthProvider>
      </HapticsProvider>
    </ThemeProvider>
  );
}
