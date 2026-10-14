import React, { useContext, useMemo } from 'react';
import { createTheme, ThemeProvider as MuiThemeProvider } from '@mui/material/styles';
import { CssBaseline } from '@mui/material';
import { ThemeContext } from './ThemeContext';

export const MuiThemeContext = ({ children }) => {
  const { theme: currentTheme } = useContext(ThemeContext);

  const theme = useMemo(() => {
    // Default to dark if undefined, but context should provide it
    const isDark = currentTheme === 'dark';

    return createTheme({
      palette: {
        mode: isDark ? 'dark' : 'light',
        ...(isDark ? {
          // Keep canvas-rendered and MUI colors aligned with index.css tokens.
          background: {
            default: '#111922',
            paper: '#171f29',
          },
          primary: {
            main: '#89adff',
            contrastText: '#122030',
          },
          secondary: {
            main: '#76c8c4',
            contrastText: '#122030',
          },
          text: {
            primary: '#e5edf2',
            secondary: '#acbdc9',
          },
          divider: '#364855',
          success: { main: '#70d3aa', contrastText: '#122030' },
          error: { main: '#ff91a2', contrastText: '#122030' },
          warning: { main: '#edc477', contrastText: '#122030' },
          info: { main: '#89adff', contrastText: '#122030' },
        } : {
          primary: {
            main: '#315fc4',
            contrastText: '#ffffff',
          },
          secondary: { main: '#197a7b' },
          background: {
            default: '#edf2f3',
            paper: '#fdfefd',
          },
          text: {
            primary: '#20333e',
            secondary: '#506774',
          },
          divider: '#ccdadd',
          success: { main: '#187954' },
          error: { main: '#bb394c' },
          warning: { main: '#896018' },
          info: { main: '#315fc4' },
        }),
      },
      typography: {
        fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      },
      shape: { borderRadius: 10 },
      components: {
        MuiPaper: {
          styleOverrides: {
            root: {
              backgroundImage: 'none',
            },
          },
        },
        MuiButton: {
          styleOverrides: {
            root: {
              textTransform: 'none',
              borderRadius: '8px',
            },
          },
        },
        MuiTextField: {
          styleOverrides: {
            root: {
              '& .MuiOutlinedInput-root': {
                '& fieldset': {
                  borderColor: 'var(--border-color)',
                },
                '&:hover fieldset': {
                  borderColor: 'var(--accent-blue)',
                },
                '&.Mui-focused fieldset': {
                  borderColor: 'var(--accent-blue)',
                },
              },
              '& .MuiInputLabel-root': {
                color: 'var(--text-secondary)',
              },
              '& .MuiInputBase-input': {
                color: 'var(--text-primary)',
              },
            },
          },
        },
      },
    });
  }, [currentTheme]);

  return (
    <MuiThemeProvider theme={theme}>
      <CssBaseline />
      {children}
    </MuiThemeProvider>
  );
};
