// js/theme.js
(() => {
  const KEY = "planner_theme";
  const root = document.documentElement;
  const btn = document.getElementById("themeToggle");

  function apply(theme) {
    root.dataset.theme = theme;
    localStorage.setItem(KEY, theme);
    if (btn) btn.textContent = theme === "light" ? "🌞" : "🌙";
  }

  const saved = localStorage.getItem(KEY);
  if (saved === "light" || saved === "dark") {
    apply(saved);
  } else {
    const prefersLight = window.matchMedia?.("(prefers-color-scheme: light)").matches;
    apply(prefersLight ? "light" : "dark");
  }

  // IMPORTANTE: garante que não tem onclick inline atrapalhando
  btn?.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    const next = root.dataset.theme === "light" ? "dark" : "light";
    apply(next);
  });
})();