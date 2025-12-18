import React, { createContext, useState, useEffect } from 'react';

export const ThemeContext = createContext();

export const ThemeProvider = ({ children }) => {
  const themeOrder = ["light", "dark", "startrek"];

  const [theme, setTheme] = useState(() => {
    const storedTheme = localStorage.getItem("theme");
    return themeOrder.includes(storedTheme) ? storedTheme : "dark";
  });

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("theme", theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prev) => {
      const currentIndex = themeOrder.indexOf(prev);
      const nextIndex = currentIndex === -1 ? 1 : (currentIndex + 1) % themeOrder.length;
      return themeOrder[nextIndex];
    });
  };

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};
