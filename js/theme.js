/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🎨 THEME.JS — Gerenciador de Tema Escuro/Claro
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * Este módulo gerencia o tema visual da aplicação:
 * - Permite alternar entre modo claro (light) e escuro (dark)
 * - Salva a preferência do usuário no localStorage
 * - Respeita a preferência do sistema operacional se não houver preferência salva
 * 
 * PADRÃO: IIFE (Immediately Invoked Function Expression)
 * - Função anônima que se executa imediatamente
 * - Cria um escopo privado para não poluir o escopo global
 */

(() => {
  // Chave do localStorage onde a preferência é salva
  const KEY = "planner_theme";
  
  // Referência ao elemento raiz HTML para aplicar atributo data-theme
  const root = document.documentElement;

  /**
   * Aplica o tema atual e atualiza o localStorage e icone
   * @param {string} theme - Tema a aplicar: "light" ou "dark"
   */
  function apply(theme) {
    // Define o atributo data-theme no <html> para CSS ler
    root.dataset.theme = theme;
    
    // Salva a preferência no localStorage
    localStorage.setItem(KEY, theme);

    // Atualiza o ícone do botão de toggle
    const btn = document.getElementById("themeToggle");
    if (btn) {
      // Mostra sol (☀️) para tema claro, lua (🌙) para tema escuro
      btn.textContent = theme === "light" ? "🌞" : "🌙";
    }
  }

  /**
   * Inicializa o tema da aplicação
   * Ordem de prioridade:
   * 1. Preferência salva no localStorage
   * 2. Preferência do sistema operacional
   * 3. Padrão: modo escuro
   */
  function initTheme() {
    // Tenta carregar a preferência salva
    const saved = localStorage.getItem(KEY);
    
    if (saved === "light" || saved === "dark") {
      // Usa a preferência salva
      apply(saved);
    } else {
      // Verifica a preferência do sistema (SO)
      // matchMedia retorna se o SO tem preferência por modo claro
      const prefersLight = !!window.matchMedia?.("(prefers-color-scheme: light)")?.matches;
      apply(prefersLight ? "light" : "dark");
    }

    // Configura o listener do botão de toggle
    // Aguarda o DOM estar pronto antes de anexar
    const btn = document.getElementById("themeToggle");
    btn?.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      
      // Alterna entre light e dark
      const next = root.dataset.theme === "light" ? "dark" : "light";
      apply(next);
    });
  }

  /**
   * Executa a inicialização quando o DOM estiver pronto
   * Se o script for carregado antes do DOMContentLoaded, aguarda
   * Se for carregado depois, executa imediatamente
   */
  if (document.readyState === "loading") {
    // Document ainda está carregando: aguarda o evento
    document.addEventListener("DOMContentLoaded", initTheme, { once: true });
  } else {
    // Document já foi carregado: executa direto
    initTheme();
  }
})();

