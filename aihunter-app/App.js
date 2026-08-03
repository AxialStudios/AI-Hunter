import { useEffect, useState } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { NavigationContainer, DarkTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import {
  useFonts,
  SpaceGrotesk_400Regular,
  SpaceGrotesk_500Medium,
  SpaceGrotesk_600SemiBold,
  SpaceGrotesk_700Bold,
} from '@expo-google-fonts/space-grotesk';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { ThemeProvider } from './context/ThemeContext';
import { HapticsProvider } from './context/HapticsContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import ThesisScreen from './features/onboarding/ThesisScreen';
import OnboardingScreen from './features/onboarding/OnboardingScreen';
import GameplayScreen from './features/gameplay/GameplayScreen';

const Stack = createNativeStackNavigator();

const NavTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    background: '#0F0F0F',
    card:       '#0F0F0F',
    border:     '#333333',
  },
};

function AppNavigator() {
  const { loading } = useAuth();
  const [initialRoute, setInitialRoute] = useState(null);

  useEffect(() => {
    // DEV RESET — remove this line before shipping
    AsyncStorage.removeItem('hasSeenThesis').then(() =>
      AsyncStorage.getItem('hasSeenThesis').then(val => {
        setInitialRoute(val ? 'Onboarding' : 'Thesis');
      })
    );
  }, []);

  if (loading || !initialRoute) {
    return (
      <View style={{ flex: 1, backgroundColor: '#0F0F0F', alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color="#fff" />
      </View>
    );
  }

  return (
    <NavigationContainer theme={NavTheme}>
      <Stack.Navigator
        initialRouteName={initialRoute}
        screenOptions={{ headerShown: false, contentStyle: { backgroundColor: '#0F0F0F' } }}
      >
        <Stack.Screen name="Thesis"     component={ThesisScreen} />
        <Stack.Screen name="Onboarding" component={OnboardingScreen} />
        <Stack.Screen name="Gameplay"   component={GameplayScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

export default function App() {
  const [fontsLoaded] = useFonts({
    SpaceGrotesk_400Regular,
    SpaceGrotesk_500Medium,
    SpaceGrotesk_600SemiBold,
    SpaceGrotesk_700Bold,
  });

  if (!fontsLoaded) {
    return <View style={{ flex: 1, backgroundColor: '#0F0F0F' }} />;
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ThemeProvider>
        <HapticsProvider>
          <AuthProvider>
            <AppNavigator />
          </AuthProvider>
        </HapticsProvider>
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}
