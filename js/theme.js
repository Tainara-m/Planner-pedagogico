// js/theme.js
(() => {
  const KEY = "planner_theme";
  const root = document.documentElement;

  const saved = localStorage.getItem(KEY);
  const prefersLight = window.matchMedia?.("(prefers-color-scheme: light)").matches;

  root.dataset.theme =
    (saved === "light" || saved === "dark")
      ? saved
      : (prefersLight ? "light" : "dark");

  // Se existir botão com id=themeToggle nesta página, ativa o click
  const btn = document.getElementById("themeToggle");
  btn?.addEventListener("click", () => {
    const next = root.dataset.theme === "light" ? "dark" : "light";
    root.dataset.theme = next;
    localStorage.setItem(KEY, next);
  });
})();
