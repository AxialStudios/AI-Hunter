import { createContext, useContext, useCallback } from 'react';
import * as Haptics from 'expo-haptics';

const HapticsContext = createContext(null);

export function HapticsProvider({ children }) {
  const light   = useCallback(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light),   []);
  const medium  = useCallback(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium),  []);
  const heavy   = useCallback(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy),   []);
  const success = useCallback(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success), []);
  const error   = useCallback(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error),   []);

  return (
    <HapticsContext.Provider value={{ light, medium, heavy, success, error }}>
      {children}
    </HapticsContext.Provider>
  );
}

export function useHaptics() {
  return useContext(HapticsContext);
}
