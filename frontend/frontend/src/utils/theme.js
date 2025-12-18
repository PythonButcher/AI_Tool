export const getCssVariable = (propertyName, fallback = "") => {
  if (typeof window === "undefined" || !propertyName) return fallback;
  const value = getComputedStyle(document.documentElement).getPropertyValue(propertyName);
  return value ? value.trim() || fallback : fallback;
};
