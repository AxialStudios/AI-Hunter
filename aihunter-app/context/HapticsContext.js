import { createContext, useContext, useCallback } from 'react';

const HapticsContext = createContext(null);

export function HapticsProvider({ children }) {
  // Stubs — real expo-haptics calls wired in during gameplay polish pass
  const light = useCallback(() => {}, []);
  const medium = useCallback(() => {}, []);
  const heavy = useCallback(() => {}, []);
  const success = useCallback(() => {}, []);
  const error = useCallback(() => {}, []);

  return (
    <HapticsContext.Provider value={{ light, medium, heavy, success, error }}>
      {children}
    </HapticsContext.Provider>
  );
}

export function useHaptics() {
  return useContext(HapticsContext);
}
