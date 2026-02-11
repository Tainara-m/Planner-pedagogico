// js/app.js
(() => {
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  const supabase = window.getSupabase();

  async function bootstrap() {
    const { data: { session }, error } = await supabase.auth.getSession();
    if (error) console.warn("getSession error:", error);

    if (!session) {
      window.location.href = "auth.html";
      return;
    }

    // Buscar username no profiles
    const { data: profile, error: pErr } = await supabase
      .from("profiles")
      .select("username, role, name")
      .eq("id", session.user.id)
      .single();

    if (pErr) {
      console.warn("profiles select error:", pErr);
      $("#userBadge").textContent = session.user.email || "Logada";
    } else {
      const username = profile?.username ? `@${profile.username}` : (session.user.email || "Logada");
      $("#userBadge").textContent = username;
      window.currentUser = { ...profile, id: session.user.id, email: session.user.email };
      // Aqui depois você faz “controle de abas por role” se quiser.
    }

    // Logout
    $("#logoutBtn")?.addEventListener("click", async () => {
      await supabase.auth.signOut();
      window.location.href = "auth.html";
    });

    // Tabs (troca de views)
    initTabs();
  }

  function initTabs() {
    const tabs = $$(".tab");
    const views = $$(".view");

    function setActive(viewName) {
      tabs.forEach(t => {
        const active = t.dataset.view === viewName;
        t.classList.toggle("is-active", active);
        t.setAttribute("aria-selected", String(active));
      });

      views.forEach(v => {
        const active = v.dataset.view === viewName;
        v.classList.toggle("is-active", active);
        v.hidden = !active;
      });
    }

    tabs.forEach(t => t.addEventListener("click", () => setActive(t.dataset.view)));
  }

  bootstrap();
})();   