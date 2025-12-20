```javascript
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
          // NEUTRAL DARK THEME PALETTE
          background: {
            default: '#0e0e10', // --bg-primary
            paper: '#18191c',   // --bg-secondary
          },
          primary: {
            main: '#3b82f6',    // --accent-blue
            contrastText: '#ffffff',
          },
          secondary: {
            main: '#a1a1aa',    // --text-secondary
          },
          text: {
            primary: '#e4e4e7', // --text-primary
            secondary: '#a1a1aa',
          },
          divider: '#27272a',   // --border-color
        } : {
           // LIGHT THEME PALETTE (Standard Defaults with brand accent)
           primary: {
             main: '#3b82f6',
           },
           background: {
             default: '#ffffff',
             paper: '#f9fafb',
           },
           text: {
             primary: '#111827',
             secondary: '#374151',
           },
           divider: '#d1d5db',
        }),
      },
      typography: {
        fontFamily: '"Segoe UI", "Tahoma", "Geneva", "Verdana", "sans-serif"',
        allVariants: {
          color: isDark ? '#e4e4e7' : '#111827',
        },
      },
      components: {
        MuiPaper: {
          styleOverrides: {
            root: {
              backgroundImage: 'none',
              backgroundColor: isDark ? '#18191c' : '#ffffff',
              color: isDark ? '#e4e4e7' : '#111827',
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
                  borderColor: isDark ? '#27272a' : '#d1d5db',
                },
                '&:hover fieldset': {
                  borderColor: '#3b82f6',
                },
                '&.Mui-focused fieldset': {
                  borderColor: '#3b82f6',
                },
              },
              '& .MuiInputLabel-root': {
                 color: isDark ? '#a1a1aa' : '#374151',
              },
              '& .MuiInputBase-input': {
                 color: isDark ? '#e4e4e7' : '#111827',
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
```
