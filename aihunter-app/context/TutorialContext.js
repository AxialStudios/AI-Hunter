import { createContext, useContext, useRef, useState } from 'react';
import { Animated } from 'react-native';

const TutorialContext = createContext({});

export function TutorialProvider({ children }) {
  const [tutorialActive, setTutorialActive] = useState(false);
  // Starts at 1 so non-tutorial sessions see the tab bar immediately.
  // hiddenForTutorial() sets it to 0; revealTabBar() animates it back to 1.
  const tabBarOpacity = useRef(new Animated.Value(1)).current;

  function startTutorial() {
    tabBarOpacity.setValue(0);
    setTutorialActive(true);
  }

  function revealTabBar() {
    setTutorialActive(false);
    // One frame delay so the tab bar mounts at opacity:0 before the animation starts.
    setTimeout(() => {
      Animated.timing(tabBarOpacity, { toValue: 1, duration: 600, useNativeDriver: true }).start();
    }, 16);
  }

  return (
    <TutorialContext.Provider value={{ tutorialActive, tabBarOpacity, startTutorial, revealTabBar }}>
      {children}
    </TutorialContext.Provider>
  );
}

export function useTutorial() {
  return useContext(TutorialContext);
}
