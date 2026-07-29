import { createContext, useContext } from 'react';
import { colors, fonts, radius } from '../constants/theme';

const theme = { colors, fonts, radius };

const ThemeContext = createContext(theme);

export function ThemeProvider({ children }) {
  return <ThemeContext.Provider value={theme}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  return useContext(ThemeContext);
}
