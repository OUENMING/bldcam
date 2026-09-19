/**
 * Theme constants shared by the blocking script in the root layout and
 * ThemeProvider. The two have to agree on the storage key, the class name and both
 * colours, and they used to repeat every one of them in separate string literals —
 * changing one and missing the other is a first-paint flash or a browser-chrome
 * colour that disagrees with the page.
 */
export const THEME_STORAGE_KEY = "bldcam-theme";
export const THEME_DARK_CLASS = "dark";

export const THEME_COLORS = {
  dark: "#0c0a08",
  light: "#faf8f5",
} as const;
