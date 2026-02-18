// js/supabaseClient.js
(() => {
  // Evita conflito se esse arquivo for carregado 2x
  if (window.__PLANNER_SUPABASE__) {
    window.getSupabase = () => window.__PLANNER_SUPABASE__;
    return;
  }

  const SUPABASE_URL = "https://peeglwlineicjkbzmjbk.supabase.co";
  const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBlZWdsd2xpbmVpY2prYnptamJrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEyMTcyMzcsImV4cCI6MjA4Njc5MzIzN30.6RxMOox4YIsNJbngVxO5Ta7xrP-TZOV7CTA9j4YWx-o";

  if (!SUPABASE_URL.startsWith("https://") || !SUPABASE_URL.includes(".supabase.co")) {
    console.warn("SUPABASE_URL parece inválida:", SUPABASE_URL);
  }
  if (!SUPABASE_ANON_KEY || SUPABASE_ANON_KEY.length < 20) {
    console.warn("SUPABASE_ANON_KEY parece inválida.");
  }

  if (!window.supabase || typeof window.supabase.createClient !== "function") {
    throw new Error("supabase-js não carregou. Verifique o script do CDN no auth.html.");
  }

  window.__PLANNER_SUPABASE__ = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  window.getSupabase = () => window.__PLANNER_SUPABASE__;
})();
