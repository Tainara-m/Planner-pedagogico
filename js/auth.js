// js/auth.js
(() => {
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  const supabase = window.getSupabase();

  // UI: telas (login / cadastro)
  const switchBtns = $$(".switch__btn");
  const screens = $$(".screen");

  function setScreen(name) {
    switchBtns.forEach(btn => {
      const active = btn.dataset.screen === name;
      btn.classList.toggle("is-active", active);
      btn.setAttribute("aria-selected", String(active));
    });

    screens.forEach(sc => {
      const active = sc.dataset.screen === name;
      sc.classList.toggle("is-active", active);
      sc.hidden = !active;
    });
  }

  switchBtns.forEach(btn => btn.addEventListener("click", () => setScreen(btn.dataset.screen)));
  $$("[data-goto]").forEach(btn => btn.addEventListener("click", () => setScreen(btn.dataset.goto)));

  // Mostrar/ocultar senha (se existir botão no HTML)
  $$("[data-toggle-pass]").forEach(btn => {
    btn.addEventListener("click", () => {
      const input = $(btn.dataset.togglePass);
      if (!input) return;
      input.type = input.type === "password" ? "text" : "password";
      btn.textContent = input.type === "password" ? "👁" : "🙈";
    });
  });

  // Toast
  const toast = $("#toast");
  let toastTimer = null;

  function showToast(message, type = "ok") {
    if (!toast) return;
    toast.hidden = false;
    toast.classList.remove("is-ok", "is-bad");
    toast.classList.add(type === "ok" ? "is-ok" : "is-bad");
    toast.textContent = message;

    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      toast.hidden = true;
      toast.textContent = "";
    }, 4500);
  }

  // Se abriu via file://, o Supabase geralmente vai falhar por CORS
  if (window.location.protocol === "file:") {
    showToast("Abra pelo Live Server/localhost (não file://). Senão o Supabase bloqueia a conexão.", "bad");
  }

  // Se já estiver logada, manda direto pro app
  (async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) window.location.href = "index.html";
    } catch (e) {
      console.warn("getSession falhou:", e);
    }
  })();

  // Helper: traduz erro de rede (fetch)
  function asNiceError(err) {
    const msg = (err?.message || String(err || "")).toLowerCase();

    // Erro típico quando CORS / preflight falha / origin bloqueado
    if (msg.includes("failed to fetch") || msg.includes("networkerror") || msg.includes("load failed")) {
      return "Falha de rede (CORS/Origin). Rode em http://localhost e adicione o origin no Supabase (Settings → API → Allowed Origins).";
    }

    return err?.message || "Erro inesperado.";
  }

  // LOGIN (e-mail + senha)
  const loginForm = $("#loginForm");
  loginForm?.addEventListener("submit", async (e) => {
    e.preventDefault();

    const email = ($("#loginUser")?.value.trim() || "").toLowerCase();
    const pass = $("#loginPass")?.value || "";

    if (!email || !email.includes("@")) return showToast("Informe um e-mail válido.", "bad");
    if (pass.length < 8) return showToast("A senha deve ter no mínimo 8 caracteres.", "bad");

    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password: pass });
      if (error) return showToast("E-mail ou senha inválidos.", "bad");

      showToast("Login realizado! Entrando…", "ok");
      setTimeout(() => window.location.href = "index.html", 250);
    } catch (err) {
      console.error("LOGIN EXCEPTION:", err);
      showToast(asNiceError(err), "bad");
    }
  });

  // CADASTRO (Auth + metadata pro trigger)
  const registerForm = $("#registerForm");
  registerForm?.addEventListener("submit", async (e) => {
    e.preventDefault();

    const role = ($("#role")?.value || "").trim();
    const name = ($("#name")?.value.trim() || "");
    const email = ($("#email")?.value.trim() || "").toLowerCase();
    const username = ($("#username")?.value.trim() || "");
    const pass = $("#pass")?.value || "";
    const pass2 = $("#pass2")?.value || "";

    if (!role) return showToast("Selecione seu status.", "bad");
    if (!name) return showToast("Informe seu nome.", "bad");
    if (!email || !email.includes("@")) return showToast("Informe um e-mail válido.", "bad");
    if (!username) return showToast("Crie um username.", "bad");
    if (!/^[a-zA-Z0-9_]{3,20}$/.test(username)) return showToast("Username inválido (3–20, letras/números/_).", "bad");
    if (pass.length < 8) return showToast("A senha deve ter no mínimo 8 caracteres.", "bad");
    if (pass !== pass2) return showToast("As senhas não conferem.", "bad");

    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password: pass,
        options: {
          data: { name, username, role }
        }
      });

      if (error) {
        console.error("SIGNUP ERROR:", error);
        return showToast(error.message, "bad");
      }

      // Se exigir confirmação de e-mail, pode não ter session.
      registerForm.reset();
      showToast("Cadastro criado! Faça login (ou confirme o e-mail, se exigido).", "ok");
      setScreen("login");

      // Log mínimo para debug
      console.log("signup ok:", { userId: data?.user?.id, email });
    } catch (err) {
      console.error("SIGNUP EXCEPTION:", err);
      showToast(asNiceError(err), "bad");
    }
  });

  // RECUPERAR SENHA
  const modal = $("#recoverModal");
  const openRecover = $("#openRecover");
  const recoverForm = $("#recoverForm");

  function openModal() {
    if (!modal) return;
    modal.hidden = false;
    modal.setAttribute("aria-hidden", "false");
    setTimeout(() => $("#recoverEmail")?.focus(), 0);
  }
  function closeModal() {
    if (!modal) return;
    modal.hidden = true;
    modal.setAttribute("aria-hidden", "true");
  }

  openRecover?.addEventListener("click", openModal);
  $$("[data-close]", modal).forEach(el => el.addEventListener("click", closeModal));
  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && modal && !modal.hidden) closeModal();
  });

  recoverForm?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const email = ($("#recoverEmail")?.value.trim() || "").toLowerCase();
    if (!email || !email.includes("@")) return showToast("Informe um e-mail válido.", "bad");

    const redirectTo = `${window.location.origin}${window.location.pathname.replace(/\/[^/]*$/, "/")}auth.html`;

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });
      if (error) console.warn("resetPasswordForEmail:", error);

      closeModal();
      showToast("Se o e-mail existir, enviaremos o link de recuperação.", "ok");
    } catch (err) {
      console.error("RESET EXCEPTION:", err);
      showToast(asNiceError(err), "bad");
    }
  });

  setScreen("login");
})();
