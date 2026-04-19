(function () {
  function readStorage(key) {
    try {
      return localStorage.getItem(key);
    } catch (error) {
      return null;
    }
  }
  var themeMode = readStorage("selenwright-ui.theme-mode") || "system";
  var isDark = false;
  try {
    isDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  } catch (error) {
    isDark = false;
  }
  var resolvedTheme = themeMode === "system" ? (isDark ? "dark" : "light") : themeMode;
  document.documentElement.dataset.themeMode = themeMode;
  document.documentElement.dataset.theme = resolvedTheme;
})();
