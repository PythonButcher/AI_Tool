// src/utils/ChartStyles.js

export const getDynamicColors = (length) => {
    const randomRGBA = () => {
      const r = Math.floor(Math.random() * 256);
      const g = Math.floor(Math.random() * 256);
      const b = Math.floor(Math.random() * 256);
      return {
        backgroundColor: `rgba(${r}, ${g}, ${b}, 0.6)`,
        borderColor: `rgba(${r}, ${g}, ${b}, 1)`
      };
    };
  
    return Array.from({ length }, randomRGBA);
  };
  