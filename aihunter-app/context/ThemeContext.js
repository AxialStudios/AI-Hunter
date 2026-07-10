import { createContext, useContext } from 'react';

const theme = {
  colors: {
    background: '#000000',
    surface: '#1a1a1a',
    primary: '#ffffff',
    secondary: '#888888',
    correct: '#4caf50',
    incorrect: '#f44336',
  },
};

const ThemeContext = createContext(theme);

export function ThemeProvider({ children }) {
  return <ThemeContext.Provider value={theme}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  return useContext(ThemeContext);
}
