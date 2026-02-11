// js/supabaseClient.js
window.SUPABASE_URL = "https://acxyicyurfhwwqhlvtft.supabase.co";
window.SUPABASE_ANON_KEY = "sb_publishable_mDPh0ZSH7dtKXSi2WKpvRw_fWHvME9I";

window.getSupabase = function getSupabase() {
  if (!window.supabase) {
    throw new Error("supabase-js não carregou. Verifique o CDN no HTML.");
  }
  return window.supabase.createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY);
};
