document.addEventListener('DOMContentLoaded', function() {
    const els = {
      turma: document.getElementById('turma'),
      trimestre: document.getElementById('trimestre'),
      materia: document.getElementById('materia'),
      professor: document.getElementById('professor'),
      anoLetivo: document.getElementById('anoLetivo'),
      numSemanas: document.getElementById('numSemanas'),
      aulasPorSemana: document.getElementById('aulasPorSemana'),
      btnGerar: document.getElementById('btnGerar'),
      weeksContainer: document.getElementById('weeksContainer'),
      resSemanas: document.getElementById('resSemanas'),
      resAulasSemana: document.getElementById('resAulasSemana'),
      resTotalAulas: document.getElementById('resTotalAulas'),
      btnPDF: document.getElementById('btnPDF'),
      btnExpandir: document.getElementById('btnExpandir'),
      btnRecolher: document.getElementById('btnRecolher'),
      btnSalvar: document.getElementById('btnSalvar'),
      btnLimpar: document.getElementById('btnLimpar'),
      autosaveStatus: document.getElementById('autosaveStatus'),
    };

    const STORAGE_KEY = 'planoDeAula@v1';

    // ============================
    // Supabase (salvar plano online)
    // ============================
    const supabase =
      window.getSupabase?.() ||
      (window.parent && window.parent !== window ? window.parent.getSupabase?.() : null) ||
      null;

    const REMOTE_TABLE = 'lesson_plans';
    let remoteEnabled = !!supabase;
    let remoteLastSavedAt = null;
    let remoteSaveTimer = null;

    function slugify(text){
      return String(text || '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '')
        .slice(0, 80);
    }

    function deriveStartDate(state){
      const dates = [];
      state.weeks?.forEach(w => w.lessons?.forEach(l => {
        if (l.dataAula) dates.push(l.dataAula);
      }));
      dates.sort();
      return dates[0] || new Date().toISOString().slice(0,10);
    }

    function derivePlanKey(state){
      const base = [
        state.anoLetivo,
        state.trimestre,
        state.turma,
        state.materia
      ].filter(Boolean).join(' ');
      const start = deriveStartDate(state);
      return `${slugify(base) || 'plano'}__${start}`;
    }

    async function getSession(){
      if (!supabase) return null;
      const { data } = await supabase.auth.getSession();
      return data?.session || null;
    }

    function setRemoteStatus(text, color){
      if (!els.autosaveStatus) return;
      els.autosaveStatus.textContent = text;
      if (color) els.autosaveStatus.style.color = color;
    }

    async function remoteUpsertPlan(state){
      if (!remoteEnabled || !supabase) return { ok:false, reason:'no-client' };

      const session = await getSession();
      if (!session) {
        // dentro do iframe, você precisa estar logada no Planner
        return { ok:false, reason:'no-session' };
      }

      const user_id = session.user.id;
      const start_date = deriveStartDate(state);
      const plan_key = derivePlanKey(state);

      const payload = {
        ...state,
        _meta: {
          saved_at: new Date().toISOString(),
          start_date,
          plan_key,
        }
      };

      const row = {
        user_id,
        plan_key,
        title: [state.materia, state.turma, state.trimestre].filter(Boolean).join(' • ') || 'Plano de Aula',
        turma: state.turma || null,
        materia: state.materia || null,
        trimestre: state.trimestre || null,
        ano_letivo: state.anoLetivo || null,
        start_date,
        payload,
      };

      const { error } = await supabase
        .from(REMOTE_TABLE)
        .upsert(row, { onConflict: 'user_id,plan_key' });

      if (error) return { ok:false, reason:'db', error };

      remoteLastSavedAt = new Date();
      const time = remoteLastSavedAt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
      setRemoteStatus(`Salvo no Supabase • ${time}`, '#27ae60');
      return { ok:true };
    }

    function queueRemoteSave(){
      clearTimeout(remoteSaveTimer);
      remoteSaveTimer = setTimeout(async () => {
        try{
          const state = stateFromUI();
          const res = await remoteUpsertPlan(state);
          if (!res.ok){
            if (res.reason === 'no-session'){
              setRemoteStatus('Entre no Planner para salvar no Supabase', '#f39c12');
            } else if (res.reason === 'db'){
              console.error('Supabase save error:', res.error);
              setRemoteStatus('Erro ao salvar no Supabase', '#e74c3c');
            }
          }
        }catch(err){
          console.error('remote save unexpected:', err);
          setRemoteStatus('Erro ao salvar no Supabase', '#e74c3c');
        }
      }, 1200);
    }

    async function remoteLoadLatestPlan(){
      if (!remoteEnabled || !supabase) return { ok:false, reason:'no-client' };

      const session = await getSession();
      if (!session) return { ok:false, reason:'no-session' };

      const { data, error } = await supabase
        .from(REMOTE_TABLE)
        .select('plan_key, payload, updated_at')
        .eq('user_id', session.user.id)
        .order('updated_at', { ascending: false })
        .limit(1);

      if (error) return { ok:false, reason:'db', error };
      const row = data?.[0];
      if (!row?.payload) return { ok:false, reason:'empty' };
      return { ok:true, payload: row.payload };
    }

    function stateFromUI(){
      const weeks = [...els.weeksContainer.querySelectorAll('.week')].map((w, wi)=>({
        conteudoSemana: w.querySelector('.conteudoSemana').value,
        lessons: [...w.querySelectorAll('.lesson')].map((l, li)=>({
          titulo: l.querySelector('h3').textContent.trim(),
          dataAula: l.querySelector('.dataAula').value,
          conteudoAula: l.querySelector('.conteudoAula').value,
          metodo: l.querySelector('.metodo').value,
          recursos: l.querySelector('.recursos').value,
          objetivos: l.querySelector('.objetivos').value,
        }))
      }));
      return {
        turma: els.turma.value,
        trimestre: els.trimestre.value,
        materia: els.materia.value,
        professor: els.professor.value,
        anoLetivo: els.anoLetivo.value,
        numSemanas: +els.numSemanas.value || 0,
        aulasPorSemana: +els.aulasPorSemana.value || 0,
        weeks,
      };
    }

    function applyState(state){
      els.turma.value = state.turma || '';
      els.trimestre.value = state.trimestre || '';
      els.materia.value = state.materia || '';
      els.professor.value = state.professor || '';
      els.anoLetivo.value = state.anoLetivo || '';
      els.numSemanas.value = state.numSemanas || 1;
      els.aulasPorSemana.value = state.aulasPorSemana || 2;
      renderWeeks(state.numSemanas, state.aulasPorSemana, state.weeks);
      updateResumo();
    }

    function save(){
      try {
        const data = stateFromUI();
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
        pingSaved();
        // ✅ também salva no Supabase (se logada)
        queueRemoteSave();
        return true;
      } catch (error) {
        console.error('Erro ao salvar:', error);
        showSaveError();
        return false;
      }
    }

    let saveTimer;
    let lastSavedData = '';
    let hasUnsavedChanges = false;
    
    function autoSave(){
      clearTimeout(saveTimer);
      hasUnsavedChanges = true;
      
      saveTimer = setTimeout(() => {
        // Só salva se houve mudanças
        const currentData = JSON.stringify(stateFromUI());
        if (currentData !== lastSavedData) {
          if (save()) {
            lastSavedData = currentData;
            hasUnsavedChanges = false;
          }
        } else {
          hasUnsavedChanges = false;
          els.autosaveStatus.textContent = 'Nenhuma alteração';
          els.autosaveStatus.style.color = '#7f8c8d';
        }
      }, 300);
      setSaving();
    }

    function checkForUnsavedChanges() {
      const currentData = JSON.stringify(stateFromUI());
      hasUnsavedChanges = currentData !== lastSavedData;
      
      if (hasUnsavedChanges) {
        els.autosaveStatus.textContent = 'Alterações pendentes...';
        els.autosaveStatus.style.color = '#f39c12';
      }
      
      return hasUnsavedChanges;
    }

    function forceSave() {
      clearTimeout(saveTimer);
      return save();
    }

    function setSaving(){
      els.autosaveStatus.textContent = 'Salvando…';
      els.autosaveStatus.style.color = '#f39c12';
    }
    
    function pingSaved(){
      const now = new Date();
      const time = now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
      els.autosaveStatus.textContent = `Auto-salvo ${time}`;
      els.autosaveStatus.style.color = '#27ae60';
      els.autosaveStatus.title = `Última alteração salva em ${time}`;
      setTimeout(() => {
        if (els.autosaveStatus.textContent.includes('Auto-salvo')) {
          els.autosaveStatus.style.color = '#7f8c8d';
        }
      }, 3000);
    }

    function showSaveError(){
      els.autosaveStatus.textContent = 'Erro ao salvar';
      els.autosaveStatus.style.color = '#e74c3c';
    }

    function renderWeeks(qtd, aulas, previousWeeks){
      els.weeksContainer.innerHTML = '';
      const wtpl = document.getElementById('weekTemplate');
      const ltpl = document.getElementById('lessonTemplate');

      for(let i=0;i<qtd;i++){
        const w = wtpl.content.cloneNode(true);
        const wEl = w.querySelector('.week');
        wEl.querySelector('.wIndex').textContent = i+1;
        const lessonsEl = wEl.querySelector('.lessons');

        for(let j=0;j<aulas;j++){
          const l = ltpl.content.cloneNode(true);
          const lessonEl = l.querySelector('.lesson');
          const h3 = l.querySelector('h3');
          h3.textContent = `Aula ${j+1}`;
          
          // Adicionar funcionalidade de clique para expandir/recolher
          h3.style.cursor = 'pointer';
          h3.addEventListener('click', () => {
            const grids = lessonEl.querySelectorAll('.grid');
            const objetivosTextarea = lessonEl.querySelector('.objetivos');
            const objetivosDiv = objetivosTextarea ? objetivosTextarea.parentElement : null;
            const isCollapsed = lessonEl.classList.contains('collapsed');
            
            if (isCollapsed) {
              // Expandir
              grids.forEach(grid => grid.style.display = 'grid');
              
              // Restaurar layout da segunda linha
              const secondGrid = grids[1];
              if (secondGrid) {
                const conteudoDiv = secondGrid.children[0];
                const recursosDiv = secondGrid.children[1];
                if (conteudoDiv) conteudoDiv.style.gridColumn = '';
                if (recursosDiv) recursosDiv.style.display = '';
              }
              
              if (objetivosDiv) objetivosDiv.style.display = 'block';
              lessonEl.classList.remove('collapsed');
            } else {
              // Recolher - mostrar apenas conteúdo da aula
              const firstGrid = grids[0];
              if (firstGrid) firstGrid.style.display = 'none';
              
              const secondGrid = grids[1];
              if (secondGrid) {
                const recursosDiv = secondGrid.children[1];
                const conteudoDiv = secondGrid.children[0];
                if (recursosDiv) recursosDiv.style.display = 'none';
                if (conteudoDiv) conteudoDiv.style.gridColumn = '1 / -1';
              }
              
              if (objetivosDiv) objetivosDiv.style.display = 'none';
              lessonEl.classList.add('collapsed');
            }
          });
          
          lessonsEl.appendChild(l);
        }

        // restaurar dados, se houver
        const prev = previousWeeks && previousWeeks[i];
        if(prev){
          wEl.querySelector('.conteudoSemana').value = prev.conteudoSemana || '';
          prev.lessons?.forEach((ldata, idx)=>{
            const lEl = lessonsEl.children[idx];
            if(!lEl) return;
            lEl.querySelector('.dataAula').value = ldata.dataAula || '';
            lEl.querySelector('.conteudoAula').value = ldata.conteudoAula || '';
            lEl.querySelector('.metodo').value = ldata.metodo || '';
            lEl.querySelector('.recursos').value = ldata.recursos || '';
            lEl.querySelector('.objetivos').value = ldata.objetivos || '';
          });
        }

        // ações da semana
        wEl.querySelector('.btnRemover').addEventListener('click', ()=>{
          wEl.remove();
          renumerarSemanas();
          updateResumo();
          autoSave();
        });
        wEl.querySelector('.btnDuplicar').addEventListener('click', ()=>{
          const snapshot = snapshotWeek(wEl);
          const qtdAtual = els.weeksContainer.children.length;
          const cloneState = [...collectWeeksState(), snapshot];
          renderWeeks(qtdAtual+1, aulas, cloneState);
          autoSave();
        });

        els.weeksContainer.appendChild(w);
      }

      bindInputsForAutosave();
    }

    function collectWeeksState(){
      return [...els.weeksContainer.querySelectorAll('.week')].map(w=>({
        conteudoSemana: w.querySelector('.conteudoSemana').value,
        lessons: [...w.querySelectorAll('.lesson')].map(l=>({
          dataAula: l.querySelector('.dataAula').value,
          conteudoAula: l.querySelector('.conteudoAula').value,
          metodo: l.querySelector('.metodo').value,
          recursos: l.querySelector('.recursos').value,
          objetivos: l.querySelector('.objetivos').value,
        }))
      }));
    }

    function snapshotWeek(wEl){
      return {
        conteudoSemana: wEl.querySelector('.conteudoSemana').value,
        lessons: [...wEl.querySelectorAll('.lesson')].map(l=>({
          dataAula: l.querySelector('.dataAula').value,
          conteudoAula: l.querySelector('.conteudoAula').value,
          metodo: l.querySelector('.metodo').value,
          recursos: l.querySelector('.recursos').value,
          objetivos: l.querySelector('.objetivos').value,
        }))
      };
    }

    function renumerarSemanas(){
      [...els.weeksContainer.querySelectorAll('.wIndex')].forEach((el,i)=>el.textContent=i+1);
    }

    function bindInputsForAutosave(){
      els.weeksContainer.querySelectorAll('input,select,textarea').forEach(el=>{
        // Eventos de entrada de texto
        el.addEventListener('input', autoSave);
        el.addEventListener('change', autoSave);
        el.addEventListener('blur', autoSave);
        
        // Eventos de teclado específicos
        el.addEventListener('keydown', (e) => {
          // Salva imediatamente em algumas teclas importantes
          if (e.key === 'Tab' || e.key === 'Enter') {
            setTimeout(autoSave, 100);
          }
        });
        
        // Para textareas, salva quando para de digitar por um tempo
        if (el.tagName === 'TEXTAREA') {
          let textTimer;
          el.addEventListener('input', () => {
            clearTimeout(textTimer);
            textTimer = setTimeout(autoSave, 1000); // Salva após 1s sem digitar
          });
        }
      });
    }

    function updateResumo(){
      const semanas = els.weeksContainer.children.length;
      const aulas = +els.aulasPorSemana.value || 0;
      els.resSemanas.textContent = semanas;
      els.resAulasSemana.textContent = aulas;
      els.resTotalAulas.textContent = semanas * aulas;
    }

    // Botões principais
    els.btnGerar.addEventListener('click', ()=>{
      const weeksState = collectWeeksState();
      renderWeeks(+els.numSemanas.value || 0, +els.aulasPorSemana.value || 0, weeksState);
      updateResumo();
      autoSave();
    });

    els.btnPDF.addEventListener('click', ()=>{
      generateCleanPDF();
    });

    els.btnSalvar.addEventListener('click', async ()=> {
      els.btnSalvar.textContent = '💾 Salvando...';
      els.btnSalvar.disabled = true;

      const localOk = forceSave();

      let remoteOk = true;
      if (remoteEnabled && supabase) {
        const res = await remoteUpsertPlan(stateFromUI());
        remoteOk = !!res.ok;
      }

      if (localOk && remoteOk) {
        els.btnSalvar.textContent = '✅ Salvo!';
        els.btnSalvar.style.background = '#27ae60';
        els.btnSalvar.style.color = 'white';
      } else if (localOk && !remoteOk) {
        els.btnSalvar.textContent = '✅ Local • ⚠ Supabase';
        els.btnSalvar.style.background = '#f39c12';
        els.btnSalvar.style.color = 'white';
      } else {
        els.btnSalvar.textContent = '❌ Erro';
        els.btnSalvar.style.background = '#e74c3c';
        els.btnSalvar.style.color = 'white';
      }

      setTimeout(() => {
        els.btnSalvar.textContent = '💾 Salvar';
        els.btnSalvar.style.background = '';
        els.btnSalvar.style.color = '';
        els.btnSalvar.disabled = false;
      }, 2200);
    });

    els.btnExpandir.addEventListener('click', ()=>{
      document.querySelectorAll('.lesson').forEach(lesson => {
        // Mostrar todas as grids
        const grids = lesson.querySelectorAll('.grid');
        grids.forEach(grid => grid.style.display = 'grid');
        
        // Restaurar layout da segunda linha
        const secondGrid = lesson.querySelectorAll('.grid')[1];
        if (secondGrid) {
          const conteudoDiv = secondGrid.children[0];
          const recursosDiv = secondGrid.children[1];
          if (conteudoDiv) conteudoDiv.style.gridColumn = ''; // Restaurar layout normal
          if (recursosDiv) recursosDiv.style.display = ''; // Mostrar recursos novamente
        }
        
        // Mostrar objetivos - busca mais específica
        const objetivosTextarea = lesson.querySelector('.objetivos');
        if (objetivosTextarea) {
          const objetivosDiv = objetivosTextarea.parentElement;
          if (objetivosDiv) objetivosDiv.style.display = 'block';
        }
        
        lesson.classList.remove('collapsed');
      });
    });
    els.btnRecolher.addEventListener('click', ()=>{
      document.querySelectorAll('.lesson').forEach(lesson => {
        // Ocultar primeira linha (data + forma de ensinar)
        const firstGrid = lesson.querySelector('.grid');
        if (firstGrid) firstGrid.style.display = 'none';
        
        // Ocultar apenas o campo recursos da segunda linha, manter conteúdo visível
        const secondGrid = lesson.querySelectorAll('.grid')[1];
        if (secondGrid) {
          const recursosDiv = secondGrid.children[1]; // Segunda div (recursos)
          if (recursosDiv) recursosDiv.style.display = 'none';
          // Fazer o conteúdo ocupar toda a linha
          const conteudoDiv = secondGrid.children[0]; // Primeira div (conteúdo)
          if (conteudoDiv) {
            conteudoDiv.style.gridColumn = '1 / -1'; // Ocupar toda a linha
          }
        }
        
        // Ocultar objetivos quando recolhido - busca mais específica
        const objetivosTextarea = lesson.querySelector('.objetivos');
        if (objetivosTextarea) {
          const objetivosDiv = objetivosTextarea.parentElement;
          if (objetivosDiv) objetivosDiv.style.display = 'none';
        }
        
        lesson.classList.add('collapsed');
      });
    });

    els.btnLimpar.addEventListener('click', ()=>{
      if(confirm('Limpar todos os campos do plano?')){
        localStorage.removeItem(STORAGE_KEY);
        applyState({ turma:'', trimestre:'', materia:'', professor:'', anoLetivo:'', numSemanas:1, aulasPorSemana:2, weeks:[] });
      }
    });

    // Aviso ao tentar sair com alterações pendentes
    window.addEventListener('beforeunload', (e) => {
      if (checkForUnsavedChanges()) {
        e.preventDefault();
        e.returnValue = '';
      }
    });

    // Auto-save quando a página perde o foco
    window.addEventListener('blur', () => {
      setTimeout(forceSave, 100);
    });

    // Atalhos de teclado para salvamento
    document.addEventListener('keydown', (e) => {
      // Ctrl+S para salvar
      if (e.ctrlKey && e.key === 's') {
        e.preventDefault();
        els.btnSalvar.click();
      }
    });

    // Inicialização
    (async function init(){
      // 1) tenta carregar do Supabase (se logada)
      if (remoteEnabled && supabase) {
        try{
          const res = await remoteLoadLatestPlan();
          if (res.ok && res.payload) {
            applyState(res.payload);
            lastSavedData = JSON.stringify(stateFromUI());
            const now = new Date();
            const time = now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
            els.autosaveStatus.textContent = `Carregado do Supabase • ${time}`;
            els.autosaveStatus.style.color = '#27ae60';
            return;
          }
        }catch(err){
          console.error('remote load error:', err);
        }
      }

      // 2) fallback: localStorage
      const raw = localStorage.getItem(STORAGE_KEY);
      if(raw){
        try{ 
          const savedData = JSON.parse(raw);
          applyState(savedData); 
          lastSavedData = JSON.stringify(savedData);
          els.autosaveStatus.textContent = 'Dados carregados';
          els.autosaveStatus.style.color = '#27ae60';
          return;
        }
        catch{ 
          /* fallback */ 
        }
      }

      // 3) default
      renderWeeks(1,2);
      updateResumo();
      els.autosaveStatus.textContent = remoteEnabled ? 'Novo plano (Supabase disponível)' : 'Novo plano';
      els.autosaveStatus.style.color = '#7f8c8d';
    })();

    // ========= PDF (mantido como estava) =========
    function generateCleanPDF() {
      const printWindow = window.open('', '_blank');
      const state = stateFromUI();
      
      let content = `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <title>Plano de Aula - ${escapeHtml(state.materia || 'Disciplina')} - ${escapeHtml(state.turma || 'Turma')}</title>
  <style>
    body { 
      font-family: Arial, sans-serif; 
      font-size: 12px;
      max-width: 800px; 
      margin: 15px auto; 
      padding: 15px; 
      line-height: 1.4;
      color: #333;
    }
    h1 { 
      text-align: center; 
      color: #2c3e50; 
      font-size: 18px;
      margin-bottom: 20px;
      border-bottom: 1px solid #ddd;
      padding-bottom: 8px;
    }
    h2 { 
      color: #34495e; 
      font-size: 14px;
      margin: 20px 0 10px 0;
      border-left: 3px solid #3498db;
      padding-left: 10px;
    }
    h3 { 
      color: #2980b9; 
      font-size: 13px;
      margin: 15px 0 8px 0;
    }
    .info-header { 
      border: 1px solid #ddd;
      padding: 12px; 
      margin-bottom: 20px;
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 8px;
      font-size: 12px;
    }
    .info-item { 
      margin-bottom: 3px; 
    }
    .info-item strong { 
      color: #2c3e50; 
    }
    .week-content { 
      border: 1px solid #ddd; 
      padding: 10px; 
      margin: 12px 0;
      font-size: 12px;
    }
    .lesson { 
      border: 1px solid #ddd; 
      padding: 12px; 
      margin: 10px 0;
      page-break-inside: avoid;
    }
    .lesson-header {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 15px;
      margin-bottom: 8px;
      font-size: 12px;
    }
    .lesson-content {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 15px;
      margin-bottom: 8px;
      font-size: 12px;
    }
    .lesson-field { 
      margin-bottom: 6px; 
      font-size: 12px;
    }
    .lesson-field strong { 
      color: #2c3e50;
      font-weight: bold;
    }
    .full-width {
      grid-column: 1 / -1;
    }
    @media print {
      body { margin: 0; padding: 10px; font-size: 12px; }
      .week-content { page-break-inside: avoid; }
      .lesson { page-break-inside: avoid; }
    }
  </style>
</head>
<body>
  <h1>PLANO DE AULA</h1>
  
  <div class="info-header">`;

      if (state.materia) content += `<div class="info-item"><strong>Matéria:</strong> ${escapeHtml(state.materia)}</div>`;
      if (state.turma) content += `<div class="info-item"><strong>Turma:</strong> ${escapeHtml(state.turma)}</div>`;
      if (state.trimestre) content += `<div class="info-item"><strong>Bimestre:</strong> ${escapeHtml(state.trimestre)}</div>`;
      if (state.professor) content += `<div class="info-item"><strong>Professor(a):</strong> ${escapeHtml(state.professor)}</div>`;
      if (state.anoLetivo) content += `<div class="info-item"><strong>Ano Letivo:</strong> ${escapeHtml(state.anoLetivo)}</div>`;
      if (state.aulasPorSemana) content += `<div class="info-item"><strong>Aulas por Semana:</strong> ${state.aulasPorSemana}</div>`;

      content += `</div>`;

      state.weeks.forEach((week, weekIndex) => {
        const hasWeekContent = week.conteudoSemana && week.conteudoSemana.trim();
        const hasLessonsWithContent = week.lessons.some(lesson => 
          (lesson.dataAula && lesson.dataAula.trim()) ||
          (lesson.conteudoAula && lesson.conteudoAula.trim()) ||
          (lesson.metodo && lesson.metodo.trim()) ||
          (lesson.recursos && lesson.recursos.trim()) ||
          (lesson.objetivos && lesson.objetivos.trim())
        );

        if (!hasWeekContent && !hasLessonsWithContent) return;

        content += `<h2>Semana ${weekIndex + 1}</h2>`;

        if (hasWeekContent) {
          content += `<div class="week-content"><strong>Conteúdo da semana:</strong><br>${escapeHtml(week.conteudoSemana).replace(/\n/g, '<br>')}</div>`;
        }

        week.lessons.forEach((lesson, lessonIndex) => {
          const hasLessonContent = 
            (lesson.dataAula && lesson.dataAula.trim()) ||
            (lesson.conteudoAula && lesson.conteudoAula.trim()) ||
            (lesson.metodo && lesson.metodo.trim()) ||
            (lesson.recursos && lesson.recursos.trim()) ||
            (lesson.objetivos && lesson.objetivos.trim());

          if (!hasLessonContent) return;

          content += `<div class="lesson">`;
          content += `<h3>Aula ${lessonIndex + 1}</h3>`;

          content += `<div class="lesson-header">`;
          if (lesson.dataAula) content += `<div class="lesson-field"><strong>Data:</strong> ${escapeHtml(lesson.dataAula)}</div>`;
          if (lesson.metodo) content += `<div class="lesson-field"><strong>Método:</strong> ${escapeHtml(lesson.metodo)}</div>`;
          content += `</div>`;

          content += `<div class="lesson-content">`;
          if (lesson.conteudoAula) content += `<div class="lesson-field"><strong>Conteúdo:</strong><br>${escapeHtml(lesson.conteudoAula).replace(/\n/g, '<br>')}</div>`;
          if (lesson.recursos) content += `<div class="lesson-field"><strong>Recursos:</strong><br>${escapeHtml(lesson.recursos).replace(/\n/g, '<br>')}</div>`;
          content += `</div>`;

          if (lesson.objetivos) {
            content += `<div class="lesson-field full-width"><strong>Objetivos:</strong><br>${escapeHtml(lesson.objetivos).replace(/\n/g, '<br>')}</div>`;
          }

          content += `</div>`;
        });
      });

      content += `
</body>
</html>`;

      printWindow.document.write(content);
      printWindow.document.close();

      setTimeout(() => {
        printWindow.print();
      }, 500);
    }

    function escapeHtml(text) {
      if (!text) return '';
      return text
        .toString()
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
    }
});
