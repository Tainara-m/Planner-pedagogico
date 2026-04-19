/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🎯 APP.JS — Aplicação Principal do Planner Pedagógico
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * Este é o arquivo principal da aplicação. Contém:
 * - Funções auxiliares (helpers) para manipular o DOM
 * - Gerenciador de abas (tabs)
 * - CRUD de disciplinas, turmas, horários, alunos
 * - Gerenciador de chamada (attendance)
 * - Consulta de horários
 * - Planejamento de aulas
 * - Gestão de avaliações e notas
 * - Geração de relatórios em PDF
 * 
 * PADRÃO: Tudo dentro de um DOMContentLoaded para garantir que o DOM existe
 */

document.addEventListener('DOMContentLoaded', () => {

  // ═══════════════════════════════════════════════════════════════════════════
  // 🔧 FUNÇÕES AUXILIARES GLOBAIS (HELPERS)
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Atalho para document.querySelector
   * @param {string} sel - Seletor CSS
   * @param {Element} root - Elemento raiz para busca (padrão: document)
   * @returns {Element|null} Elemento encontrado ou null
   */
  const $ = (sel, root = document) => root.querySelector(sel);

  /**
   * Atalho para document.querySelectorAll (retorna Array, não NodeList)
   * @param {string} sel - Seletor CSS
   * @param {Element} root - Elemento raiz para busca (padrão: document)
   * @returns {Array} Array de elementos
   */
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  /**
   * Escapa caracteres especiais HTML para evitar injeção XSS
   * Substitui: & < > " '
   * @param {string} str - String a escapar
   * @returns {string} String escapada
   */
  function esc(str) {
    return String(str || '')
      .replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;').replaceAll("'", '&#039;');
  }

  /**
   * Formata hora HH:mm (remove segundos e milissegundos)
   * @param {string} t - Hora no formato HH:mm:ss ou HH:mm
   * @returns {string} Hora formatada HH:mm
   */
  function fmtTime(t) {
    const s = String(t || '');
    return s.length >= 5 ? s.slice(0, 5) : s;
  }

  /**
   * Formata data YYYY-MM-DD para DD/MM/YYYY
   * @param {string} dateStr - Data no formato YYYY-MM-DD
   * @returns {string} Data formatada DD/MM/YYYY ou "—" se vazia
   */
  function fmtDate(dateStr) {
    if (!dateStr) return '—';
    const [y, m, d] = dateStr.split('-');
    return `${d}/${m}/${y}`;
  }

  /**
   * Converte hora HH:mm para minutos (útil para comparações)
   * @param {string} t - Hora no formato HH:mm
   * @returns {number} Minutos desde 00:00
   */
  function timeToMinutes(t) {
    const [hh, mm] = fmtTime(t).split(':').map(Number);
    return (isNaN(hh) || isNaN(mm)) ? 0 : hh * 60 + mm;
  }

  /**
   * Retorna a data de hoje no formato YYYY-MM-DD
   * Útil para definir datas padrão em formulários
   * @returns {string} Data de hoje em formato ISO
   */
  function todayISO() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  }

  /**
   * Preenche um <select> com opções
   * @param {Element} sel - Elemento select a preencher
   * @param {Array} items - Itens para criar opções
   * @param {Function} textFn - Função que retorna o texto exibido para cada item
   * @param {string} placeholder - Texto se lista vazia
   */
  function fillSelect(sel, items, textFn, placeholder) {
    if (!sel) return;
    sel.innerHTML = '';
    if (!items || !items.length) {
      // Se vazio, mostra placeholder e desabilita
      const opt = document.createElement('option');
      opt.value = '';
      opt.textContent = placeholder;
      sel.appendChild(opt);
      sel.disabled = true;
      return;
    }
    sel.disabled = false;
    // Cria uma opção para cada item
    for (const it of items) {
      const opt = document.createElement('option');
      opt.value = it.id;
      opt.textContent = textFn(it);
      sel.appendChild(opt);
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 🪟 FUNÇÕES DE MODAL
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Abre um modal
   * @param {string} id - ID do modal (elemento com classe modal-backdrop)
   */
  function openModal(id) {
    const m = document.getElementById(id);
    if (!m) return;
    m.classList.add('is-open');
    m.setAttribute('aria-hidden', 'false');
  }

  /**
   * Fecha um modal
   * @param {string} id - ID do modal
   */
  function closeModal(id) {
    const m = document.getElementById(id);
    if (!m) return;
    m.classList.remove('is-open');
    m.setAttribute('aria-hidden', 'true');
  }

  // Fechar modal clicando no backdrop (fundo transparente)
  document.querySelectorAll('.modal-backdrop').forEach(m => {
    m.addEventListener('click', e => {
      // Só fecha se clicar fora do conteúdo (no backdrop)
      if (e.target === m) closeModal(m.id);
    });
  });

  // Fechar modal com tecla ESC
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      document.querySelectorAll('.modal-backdrop.is-open').forEach(m => closeModal(m.id));
    }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 📑 ABAS (TABS)
  // ═══════════════════════════════════════════════════════════════════════════

  // Mapeamento dos dias da semana
  const DOW = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];

  /**
   * Inicializa o sistema de abas
   * Quando clica em uma aba, mostra a view correspondente
   */
  function initTabs() {
    const tabs  = $$('.tab');
    const views = $$('.view');

    /**
     * Ativa uma aba e sua view correspondente
     * Também dispara ações específicas (ex: renderizar dados quando abrir aba)
     */
    function setActive(name) {
      // Atualiza classe e atributo aria de todas as abas
      tabs.forEach(t => {
        const on = t.dataset.view === name;
        t.classList.toggle('is-active', on);
        t.setAttribute('aria-selected', String(on));
      });
      // Mostra/esconde views
      views.forEach(v => {
        const on = v.dataset.view === name;
        v.classList.toggle('is-active', on);
        v.hidden = !on;
      });
      // Dispara ações ao trocar de aba
      if (name === 'classes')    refreshConsultation();
      if (name === 'attendance') { populateAttendanceClassSelect(); setAttendanceDateToday(); }
      if (name === 'dailyPlan')  renderPlans();
      if (name === 'assessments') renderAssessments();
    }

    // Quando clica em uma aba, ativa ela
    tabs.forEach(t => t.addEventListener('click', () => setActive(t.dataset.view)));
  }

  // ════════════════════════════════════════════════
  // DISCIPLINAS
  // ════════════════════════════════════════════════
  function loadSubjects() {
    const data = DB.getSubjects();
    const list = $('#subjectsList');
    if (list) {
      list.innerHTML = '';
      if (!data.length) {
        list.innerHTML = `<div class="item"><div>Nenhuma disciplina cadastrada ainda.</div></div>`;
      } else {
        for (const s of data) {
          const el = document.createElement('div');
          el.className = 'item';
          el.innerHTML = `
            <div><strong>${esc(s.name)}</strong></div>
            <div style="display:flex;gap:8px;">
              <button class="btn-ghost" type="button" data-del-subject="${s.id}">Excluir</button>
            </div>`;
          list.appendChild(el);
        }
        list.querySelectorAll('[data-del-subject]').forEach(btn => {
          btn.addEventListener('click', () => {
            if (!confirm('Excluir esta disciplina?')) return;
            DB.deleteSubject(btn.dataset.delSubject);
            loadSubjects();
            if (selectedClassId) { loadClassSubjects(selectedClassId); loadClassSchedule(selectedClassId); }
            refreshConsultation();
          });
        });
      }
    }
    syncSubjectSelects(data);
  }

  function syncSubjectSelects(data) {
    const items = data || DB.getSubjects();
    fillSelect($('#subjectSelect'),    items, s => s.name, 'Crie uma disciplina primeiro.');
    fillSelect($('#scheduleSubject'),  items, s => s.name, 'Crie uma disciplina primeiro.');
  }

  $('#subjectCreateForm')?.addEventListener('submit', e => {
    e.preventDefault();
    const name = $('#subjectName')?.value.trim();
    if (!name) return;
    DB.addSubject(name);
    $('#subjectCreateForm').reset();
    loadSubjects();
  });

  // ════════════════════════════════════════════════
  // TURMAS
  // ════════════════════════════════════════════════
  let selectedClassId = null;

  function loadClasses() {
    const data = DB.getClasses();
    const wrap = $('#classesList');
    if (!wrap) return;
    wrap.innerHTML = '';
    if (!data.length) {
      wrap.innerHTML = `<div class="item"><div>Nenhuma turma criada ainda.</div></div>`;
      return;
    }
    for (const c of data) {
      const el = document.createElement('div');
      el.className = 'item';
      el.innerHTML = `
        <div>
          <strong>${esc(c.name)}</strong>
          <div class="meta">${c.year}${c.shift ? ' • ' + esc(c.shift) : ''}</div>
        </div>
        <button class="btn-ghost" type="button" data-open="${c.id}">Abrir</button>`;
      wrap.appendChild(el);
    }
    wrap.querySelectorAll('[data-open]').forEach(btn => {
      btn.addEventListener('click', () => openClass(btn.dataset.open));
    });
  }

  function openClass(classId) {
    selectedClassId = classId;
    const cls = DB.getClass(classId);
    if (!cls) return;
    $('#classDetail').hidden = false;
    $('#classTitle').textContent = `${cls.name} • ${cls.year}${cls.shift ? ' • ' + cls.shift : ''}`;
    $('#deleteClassBtn').onclick = () => {
      if (!confirm('Excluir esta turma?')) return;
      DB.deleteClass(classId);
      closeClassDetail();
      loadClasses();
      populateAttendanceClassSelect();
      refreshConsultation();
    };
    syncSubjectSelects();
    loadClassSubjects(classId);
    loadClassSchedule(classId);
    loadClassStudents(classId);
  }

  function closeClassDetail() {
    selectedClassId = null;
    $('#classDetail').hidden = true;
    ['#classSubjectsList','#scheduleList','#classStudentsList'].forEach(id => {
      const el = $(id);
      if (el) el.innerHTML = '';
    });
  }

  $('#classCreateForm')?.addEventListener('submit', e => {
    e.preventDefault();
    const name  = $('#className').value.trim();
    const year  = Number($('#classYear').value);
    const shift = $('#classShift').value.trim();
    if (!name) return alert('Informe o nome da turma.');
    if (!year || year < 2000) return alert('Informe um ano válido.');
    DB.addClass({ name, year, shift });
    $('#classCreateForm').reset();
    loadClasses();
    populateAttendanceClassSelect();
    refreshConsultation();
  });

  // ════════════════════════════════════════════════
  // CLASS_SUBJECTS
  // ════════════════════════════════════════════════
  function loadClassSubjects(classId) {
    const data = DB.getClassSubjects(classId);
    const wrap = $('#classSubjectsList');
    if (!wrap) return;
    wrap.innerHTML = '';
    if (!data.length) {
      wrap.innerHTML = `<div class="item"><div>Nenhuma disciplina adicionada ainda.</div></div>`;
      return;
    }
    for (const row of data) {
      const el = document.createElement('div');
      el.className = 'item';
      el.innerHTML = `
        <div>
          <strong>${esc(row.subjects?.name || 'Disciplina')}</strong>
          <div class="meta">${row.weekly_classes != null ? `Aulas/semana: ${row.weekly_classes}` : 'Sem carga definida'}</div>
        </div>
        <button class="btn-ghost" type="button" data-unlink="${row.id}">Remover</button>`;
      wrap.appendChild(el);
    }
    wrap.querySelectorAll('[data-unlink]').forEach(btn => {
      btn.addEventListener('click', () => {
        if (!confirm('Remover disciplina desta turma?')) return;
        DB.unlinkSubject(btn.dataset.unlink);
        loadClassSubjects(classId);
      });
    });
  }

  $('#linkSubjectForm')?.addEventListener('submit', e => {
    e.preventDefault();
    if (!selectedClassId) return;
    const subject_id     = $('#subjectSelect').value;
    const wcRaw          = $('#weeklyClasses').value;
    const weekly_classes = wcRaw === '' ? null : Number(wcRaw);
    if (!subject_id) return;
    try {
      DB.linkSubject({ class_id: selectedClassId, subject_id, weekly_classes });
      $('#weeklyClasses').value = '';
      loadClassSubjects(selectedClassId);
    } catch(err) { alert(err.message); }
  });

  // ════════════════════════════════════════════════
  // HORÁRIOS
  // ════════════════════════════════════════════════
  function loadClassSchedule(classId) {
    const data = DB.getClassSchedule(classId);
    const wrap = $('#scheduleList');
    if (!wrap) return;
    wrap.innerHTML = '';
    if (!data.length) {
      wrap.innerHTML = `<div class="item"><div>Nenhum horário cadastrado ainda.</div></div>`;
      return;
    }
    for (const row of data) {
      const el = document.createElement('div');
      el.className = 'item';
      el.innerHTML = `
        <div>
          <strong>${esc(row.subjects?.name || 'Disciplina')}</strong>
          <div class="meta">${DOW[row.day_of_week]} • ${fmtTime(row.start_time)}–${fmtTime(row.end_time)}</div>
        </div>
        <button class="btn-ghost" type="button" data-del-schedule="${row.id}">Excluir</button>`;
      wrap.appendChild(el);
    }
    wrap.querySelectorAll('[data-del-schedule]').forEach(btn => {
      btn.addEventListener('click', () => {
        if (!confirm('Excluir este horário?')) return;
        DB.deleteSchedule(btn.dataset.delSchedule);
        loadClassSchedule(classId);
        refreshConsultation();
      });
    });
  }

  $('#scheduleCreateForm')?.addEventListener('submit', e => {
    e.preventDefault();
    if (!selectedClassId) return;
    const day_of_week = Number($('#scheduleDay').value);
    const subject_id  = $('#scheduleSubject').value;
    const start_time  = $('#scheduleStart').value;
    const end_time    = $('#scheduleEnd').value;
    if (!subject_id) return alert('Selecione uma disciplina.');
    if (!start_time || !end_time) return alert('Informe início e fim.');
    if (end_time <= start_time) return alert('O horário final deve ser maior que o inicial.');
    DB.addSchedule({ class_id: selectedClassId, subject_id, day_of_week, start_time, end_time });
    $('#scheduleCreateForm').reset();
    loadClassSchedule(selectedClassId);
    refreshConsultation();
  });

  // ════════════════════════════════════════════════
  // ALUNOS
  // ════════════════════════════════════════════════
  function loadClassStudents(classId) {
    const data = DB.getClassStudents(classId);
    const wrap = $('#classStudentsList');
    if (!wrap) return;
    wrap.innerHTML = '';
    if (!data.length) {
      wrap.innerHTML = `<div class="item"><div>Nenhum aluno nesta turma ainda.</div></div>`;
      return;
    }
    for (const row of data) {
      const el = document.createElement('div');
      el.className = 'item';
      el.innerHTML = `
        <div>
          <strong>${esc(row.students?.name || 'Aluno')}</strong>
          <div class="meta">Aluno</div>
        </div>
        <button class="btn-ghost" type="button" data-unlink-student="${row.id}">Remover</button>`;
      wrap.appendChild(el);
    }
    wrap.querySelectorAll('[data-unlink-student]').forEach(btn => {
      btn.addEventListener('click', () => {
        if (!confirm('Remover aluno desta turma?')) return;
        DB.removeStudentFromClass(btn.dataset.unlinkStudent);
        loadClassStudents(classId);
      });
    });
  }

  $('#studentCreateForm')?.addEventListener('submit', e => {
    e.preventDefault();
    if (!selectedClassId) return;
    const name = $('#studentName')?.value.trim();
    if (!name) return;
    DB.addStudent(selectedClassId, name);
    $('#studentCreateForm').reset();
    loadClassStudents(selectedClassId);
  });

  // ════════════════════════════════════════════════
  // CHAMADA
  // ════════════════════════════════════════════════
  function populateAttendanceClassSelect() {
    const sel  = $('#attendanceClassSelect');
    const data = DB.getClasses();
    fillSelect(sel, data,
      c => `${c.name} • ${c.year}${c.shift ? ' • ' + c.shift : ''}`,
      'Crie uma turma primeiro'
    );
  }

  function setAttendanceDateToday() {
    const el = $('#attendanceDate');
    if (el && !el.value) el.value = todayISO();
  }

  function setStatus(msg) {
    const el = $('#attendanceStatus');
    if (el) el.textContent = msg;
  }

  $('#loadAttendanceBtn')?.addEventListener('click', loadAttendanceScreen);
  $('#saveAttendanceBtn')?.addEventListener('click', saveAttendance);

  function loadAttendanceScreen() {
    const list    = $('#attendanceList');
    if (!list) return;
    const classId = $('#attendanceClassSelect')?.value;
    const date    = $('#attendanceDate')?.value;
    if (!classId) return alert('Selecione uma turma.');
    if (!date)    return alert('Selecione uma data.');

    setStatus('Carregando…');
    list.innerHTML = '';

    const roster = DB.getClassStudents(classId);
    if (!roster.length) {
      setStatus('Nenhum aluno cadastrado nesta turma.');
      list.innerHTML = `<div class="item"><div>Nenhum aluno cadastrado nesta turma.</div></div>`;
      return;
    }

    const todayMap = new Map(DB.getAttendanceForDay(classId, date).map(r => [r.student_id, r.is_absent]));
    const totals   = new Map();
    for (const r of DB.getAllAttendanceForClass(classId)) {
      if (!r.is_absent) continue;
      totals.set(r.student_id, (totals.get(r.student_id) || 0) + 1);
    }

    for (const row of roster) {
      const st      = row.students;
      const checked = todayMap.get(st.id) ? 'checked' : '';
      const el = document.createElement('div');
      el.className = 'item';
      el.innerHTML = `
        <div>
          <strong>${esc(st.name)}</strong>
          <div class="meta">Total de faltas: ${totals.get(st.id) || 0}</div>
        </div>
        <label class="meta" style="display:flex;align-items:center;gap:10px;cursor:pointer;user-select:none;">
          <input type="checkbox" data-att-student="${st.id}" ${checked} /> Faltou
        </label>`;
      list.appendChild(el);
    }
    setStatus(`Carregado: ${roster.length} aluno(s).`);
  }

  function saveAttendance() {
    const classId = $('#attendanceClassSelect')?.value;
    const date    = $('#attendanceDate')?.value;
    if (!classId) return alert('Selecione uma turma.');
    if (!date)    return alert('Selecione uma data.');
    const checks = $$('[data-att-student]');
    if (!checks.length) return alert('Carregue a chamada antes de salvar.');
    DB.saveAttendance(classId, date, checks.map(cb => ({
      student_id: cb.getAttribute('data-att-student'),
      is_absent:  cb.checked,
    })));
    setStatus('Chamada salva ✅');
    loadAttendanceScreen();
  }

  // ════════════════════════════════════════════════
  // CONSULTA SEMANAL
  // ════════════════════════════════════════════════
  let lastScheduleRows = [];

  function refreshConsultation() {
    const now = new Date();
    const dow = now.getDay();
    const todayTitle = $('#todayTitle');
    if (todayTitle) todayTitle.textContent = `Hoje • ${DOW[dow]}`;

    lastScheduleRows = DB.getAllSchedule();
    const filtered = applyShiftFilter(lastScheduleRows);
    renderNextClass(filtered, now);
    renderToday(filtered, dow);
    renderWeek(filtered);
  }

  function applyShiftFilter(rows) {
    const v = ($('#shiftFilter')?.value || 'all').toLowerCase();
    if (v === 'all') return rows;
    return rows.filter(r => {
      const shift = (r?.classes?.shift || '').trim().toLowerCase();
      if (v === 'none') return !shift;
      return norm(shift) === norm(v);
    });
  }

  function norm(s) {
    return (s||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim();
  }

  function renderNextClass(rows, now) {
    const wrap = $('#nextClassCard');
    if (!wrap) return;
    const dow    = now.getDay();
    const nowMin = now.getHours() * 60 + now.getMinutes();
    const upcoming = rows
      .filter(r => r.day_of_week === dow)
      .map(r => ({ r, startMin: timeToMinutes(r.start_time) }))
      .filter(x => x.startMin > nowMin)
      .sort((a, b) => a.startMin - b.startMin);
    wrap.innerHTML = '';
    if (!upcoming.length) {
      wrap.innerHTML = `<div class="item is-highlight"><div>Sem próximas aulas hoje.</div></div>`;
      return;
    }
    const next = upcoming[0].r;
    const el = document.createElement('div');
    el.className = 'item is-highlight';
    el.innerHTML = `
      <div>
        <strong>${esc(next.subjects?.name || 'Disciplina')}</strong>
        <div class="meta">${esc(next.classes?.name || 'Turma')} • ${fmtTime(next.start_time)}–${fmtTime(next.end_time)}${next.classes?.shift ? ' • ' + esc(next.classes.shift) : ''}</div>
      </div>
      <div class="pill">próxima</div>`;
    wrap.appendChild(el);
  }

  function renderToday(rows, dow) {
    const wrap = $('#todayScheduleList');
    if (!wrap) return;
    const today = rows.filter(r => r.day_of_week === dow);
    wrap.innerHTML = '';
    if (!today.length) {
      wrap.innerHTML = `<div class="item"><div>Nenhuma aula para hoje.</div></div>`;
      return;
    }
    for (const r of today) {
      const el = document.createElement('div');
      el.className = 'item';
      el.innerHTML = `
        <div>
          <strong>${esc(r.subjects?.name || 'Disciplina')}</strong>
          <div class="meta">${esc(r.classes?.name || 'Turma')} • ${fmtTime(r.start_time)}–${fmtTime(r.end_time)}</div>
        </div>
        <div class="meta">${r.classes?.shift ? esc(r.classes.shift) : ''}</div>`;
      wrap.appendChild(el);
    }
  }

  function renderWeek(rows) {
    const wrap = $('#weekSchedule');
    if (!wrap) return;
    wrap.innerHTML = '';
    const byDay = new Map();
    for (const r of rows) {
      if (!byDay.has(r.day_of_week)) byDay.set(r.day_of_week, []);
      byDay.get(r.day_of_week).push(r);
    }
    let hasAny = false;
    for (const day of [1,2,3,4,5,6,0]) {
      const dayRows = byDay.get(day) || [];
      if (!dayRows.length) continue;
      hasAny = true;
      const block = document.createElement('div');
      block.className = 'item';
      block.style.cssText = 'flex-direction:column;align-items:stretch;';
      block.innerHTML = `<div style="font-weight:650;margin-bottom:8px;">${DOW[day]}</div>`;
      const inner = document.createElement('div');
      inner.className = 'list';
      inner.style.marginTop = '0';
      for (const r of dayRows) {
        const item = document.createElement('div');
        item.className = 'item';
        item.innerHTML = `
          <div>
            <strong>${esc(r.subjects?.name || 'Disciplina')}</strong>
            <div class="meta">${esc(r.classes?.name || 'Turma')} • ${fmtTime(r.start_time)}–${fmtTime(r.end_time)}</div>
          </div>
          <div class="meta">${r.classes?.shift ? esc(r.classes.shift) : ''}</div>`;
        inner.appendChild(item);
      }
      block.appendChild(inner);
      wrap.appendChild(block);
    }
    if (!hasAny) {
      wrap.innerHTML = `<div class="item"><div>Cadastre horários em Configuração para ver sua semana aqui.</div></div>`;
    }
  }

  $('#refreshScheduleBtn')?.addEventListener('click', refreshConsultation);
  $('#shiftFilter')       ?.addEventListener('change', refreshConsultation);
  $('#printWeekBtn')      ?.addEventListener('click', () => window.print?.());

  // ════════════════════════════════════════════════
  // PLANEJAMENTO
  // ════════════════════════════════════════════════
  // ── planejamento atual sendo visualizado ─────────
  let viewingPlan = null;

  function renderPlans() {
    const wrap = $('#plansList');
    if (!wrap) return;
    const data = DB.getLessonPlans();
    wrap.innerHTML = '';
    if (!data.length) {
      wrap.innerHTML = `<div class="item"><div>Nenhum planejamento cadastrado ainda.</div></div>`;
      return;
    }
    for (const p of data) {
      const preview = p.content ? p.content.slice(0, 80) + (p.content.length > 80 ? '…' : '') : '';
      const el = document.createElement('div');
      el.className = 'item plan-item plan-card';
      el.setAttribute('title', 'Clique para ver o planejamento completo');
      el.innerHTML = `
        <div class="plan-info">
          <strong>${esc(preview || 'Sem conteúdo')}</strong>
          <div class="plan-meta">
            <span>${p.classes  ? esc(p.classes.name)  : '—'}</span>
            <span>·</span>
            <span>${p.subjects ? esc(p.subjects.name) : '—'}</span>
            <span>·</span>
            <span>${fmtDate(p.date)}</span>
            ${p.bncc ? `<span>·</span><span class="pill pill-bncc">BNCC: ${esc(p.bncc)}</span>` : ''}
          </div>
        </div>
        <div class="plan-actions">
          <button class="btn-ghost btn-icon" type="button" data-view-plan="${p.id}" title="Ver planejamento">👁</button>
          <button class="btn-ghost btn-danger btn-icon" type="button" data-del-plan="${p.id}" title="Excluir">🗑</button>
        </div>`;
      wrap.appendChild(el);
    }

    // clique no card abre visualização
    wrap.querySelectorAll('.plan-card').forEach(card => {
      card.addEventListener('click', e => {
        // ignora clique nos botões de ação
        if (e.target.closest('[data-view-plan],[data-del-plan]')) return;
        const btn = card.querySelector('[data-view-plan]');
        if (btn) openViewPlanModal(btn.dataset.viewPlan);
      });
    });

    wrap.querySelectorAll('[data-view-plan]').forEach(btn => {
      btn.addEventListener('click', e => {
        e.stopPropagation();
        openViewPlanModal(btn.dataset.viewPlan);
      });
    });

    wrap.querySelectorAll('[data-del-plan]').forEach(btn => {
      btn.addEventListener('click', e => {
        e.stopPropagation();
        if (!confirm('Excluir este planejamento?')) return;
        DB.deleteLessonPlan(btn.dataset.delPlan);
        renderPlans();
      });
    });
  }

  // ── modal de visualização ────────────────────────
  function openViewPlanModal(planId) {
    const all  = DB.getLessonPlans();
    const plan = all.find(p => String(p.id) === String(planId));
    if (!plan) return;
    viewingPlan = plan;

    $('#viewPlanTitle').textContent = plan.subjects?.name
      ? `Planejamento — ${plan.subjects.name}`
      : 'Planejamento';

    $('#viewPlanClass').textContent   = plan.classes?.name
      ? `🏫 ${plan.classes.name}${plan.classes.year ? ' • ' + plan.classes.year : ''}${plan.classes.shift ? ' • ' + plan.classes.shift : ''}`
      : '—';
    $('#viewPlanSubject').textContent = plan.subjects?.name ? `📚 ${plan.subjects.name}` : '—';
    $('#viewPlanDate').textContent    = `📅 ${fmtDate(plan.date)}`;

    const bnccEl = $('#viewPlanBncc');
    if (plan.bncc) {
      bnccEl.textContent = `BNCC: ${plan.bncc}`;
      bnccEl.style.display = '';
    } else {
      bnccEl.style.display = 'none';
    }

    // preserva quebras de linha
    $('#viewPlanContent').innerHTML = esc(plan.content || '—').replace(/\n/g, '<br>');

    openModal('viewPlanModal');
  }

  $('#closeViewPlanModal')  ?.addEventListener('click', () => { closeModal('viewPlanModal'); viewingPlan = null; });
  $('#closeViewPlanModal2') ?.addEventListener('click', () => { closeModal('viewPlanModal'); viewingPlan = null; });

  // ── exportar PDF ─────────────────────────────────
  $('#exportPlanPdfBtn')?.addEventListener('click', () => {
    if (!viewingPlan) return;
    exportPlanToPdf(viewingPlan);
  });

  function exportPlanToPdf(plan) {
    const jsPDF = window.jsPDF;
    const doc    = new jsPDF('p', 'mm', 'a4');
    const pageW  = 210, pageH = 297;
    const margin = 20, usable = pageW - margin * 2;
    const lineH  = 5.5;
    const footerY = pageH - 12;

    const INK    = [30,  30,  30];
    const MUTED  = [110, 110, 110];
    const ACCENT = [60,  90,  140];
    const LINE   = [200, 200, 200];

    let y = margin;
    let page = 1;

    function addFooter() {
      doc.setDrawColor(LINE[0], LINE[1], LINE[2]);
      doc.setLineWidth(0.3);
      doc.line(margin, footerY - 3, pageW - margin, footerY - 3);
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(7.5);
      doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
      const now = new Date();
      doc.text('Planner Pedagogico', margin, footerY);
      doc.text('Pagina ' + page, pageW / 2, footerY);
      doc.text(now.toLocaleDateString('pt-BR'), pageW - margin, footerY);
    }

    function checkPage(needed) {
      needed = needed || 10;
      if (y + needed > footerY - 6) {
        addFooter();
        doc.addPage();
        page++;
        y = margin;
      }
    }

    // cabecalho
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.setTextColor(ACCENT[0], ACCENT[1], ACCENT[2]);
    doc.text('Planejamento de Aula', margin, y);
    y += 7;

    doc.setDrawColor(ACCENT[0], ACCENT[1], ACCENT[2]);
    doc.setLineWidth(0.6);
    doc.line(margin, y, pageW - margin, y);
    y += 7;

    // metadados
    const turma = plan.classes
      ? (plan.classes.name + (plan.classes.year ? ' - ' + plan.classes.year : '') + (plan.classes.shift ? ' - ' + plan.classes.shift : ''))
      : '-';

    const metas = [
      ['Turma',      turma],
      ['Disciplina', plan.subjects ? plan.subjects.name : '-'],
      ['Data',       fmtDate(plan.date)],
    ];
    if (plan.bncc) metas.push(['BNCC', plan.bncc]);

    for (const pair of metas) {
      const label = pair[0], val = pair[1];
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
      doc.text(label.toUpperCase(), margin, y);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      doc.setTextColor(INK[0], INK[1], INK[2]);
      doc.text(val, margin + 28, y);
      y += 6;
    }

    y += 4;
    doc.setDrawColor(LINE[0], LINE[1], LINE[2]);
    doc.setLineWidth(0.3);
    doc.line(margin, y, pageW - margin, y);
    y += 8;

    // conteudo
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(ACCENT[0], ACCENT[1], ACCENT[2]);
    doc.text('Conteudo da Aula', margin, y);
    y += 6;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(INK[0], INK[1], INK[2]);

    const allLines = doc.splitTextToSize(plan.content || '-', usable);
    for (const line of allLines) {
      checkPage(lineH);
      doc.text(line, margin, y);
      y += lineH;
    }

    addFooter();

    const safeName = (plan.subjects ? plan.subjects.name : 'planejamento').replace(/[^a-zA-Z0-9]/g, '_');
    const safeDate = (plan.date || '').replace(/-/g, '');
    doc.save('planejamento_' + safeName + '_' + safeDate + '.pdf');
  }


  // Botão abrir modal planejamento
  $('#openPlanModalBtn')?.addEventListener('click', () => {
    fillSelect($('#planClass'),   DB.getClasses(),   c => `${c.name} • ${c.year}${c.shift?' • '+c.shift:''}`, 'Crie uma turma primeiro');
    fillSelect($('#planSubject'), DB.getSubjects(),  s => s.name, 'Crie uma disciplina primeiro');
    const di = $('#planDate');
    if (di) di.value = todayISO();
    openModal('planModal');
  });

  function closePlanModal() {
    closeModal('planModal');
    const fields = ['#planClass','#planSubject','#planDate','#planBncc','#planContent'];
    fields.forEach(sel => { const el = $(sel); if (el) el.value = ''; });
  }

  $('#closePlanModal')  ?.addEventListener('click', closePlanModal);
  $('#closePlanModal2') ?.addEventListener('click', closePlanModal);

  $('#savePlanBtn')?.addEventListener('click', () => {
    const class_id   = $('#planClass')?.value;
    const subject_id = $('#planSubject')?.value;
    const bncc       = ($('#planBncc')?.value   || '').trim();
    const content    = ($('#planContent')?.value || '').trim();
    const date       = $('#planDate')?.value;
    if (!class_id)   return alert('Selecione uma turma.');
    if (!subject_id) return alert('Selecione uma disciplina.');
    if (!content)    return alert('Informe o conteúdo da aula.');
    if (!date)       return alert('Informe a data.');
    DB.addLessonPlan({ class_id, subject_id, bncc, content, date });
    closePlanModal();
    renderPlans();
  });

  // ════════════════════════════════════════════════
  // AVALIAÇÕES
  // ════════════════════════════════════════════════
  let gradeAssessmentId = null;

  function renderAssessments() {
    const wrap = $('#assessmentsList');
    if (!wrap) return;
    const data = DB.getAssessments();
    wrap.innerHTML = '';
    if (!data.length) {
      wrap.innerHTML = `<div class="item"><div>Nenhuma avaliação cadastrada ainda.</div></div>`;
      return;
    }
    for (const a of data) {
      const grades = DB.getGrades(a.id);
      const roster = DB.getClassStudents(a.class_id);
      const filled = grades.filter(g => g.grade !== null && g.grade !== '').length;
      const el = document.createElement('div');
      el.className = 'item';
      el.innerHTML = `
        <div>
          <strong>${esc(a.name)}</strong>
          <div class="meta">
            ${a.classes  ? esc(a.classes.name)  : '—'} &nbsp;·&nbsp;
            ${a.subjects ? esc(a.subjects.name) : '—'} &nbsp;·&nbsp;
            Valor: ${a.max_score}
            &nbsp;·&nbsp; <span class="pill pill-grade">${filled}/${roster.length} notas</span>
          </div>
        </div>
        <div style="display:flex;gap:8px;flex-wrap:wrap;justify-content:flex-end;">
          <button class="btn-ghost" type="button" data-open-grades="${a.id}">Ver / Lançar notas</button>
          <button class="btn-ghost btn-danger" type="button" data-del-assess="${a.id}">Excluir</button>
        </div>`;
      wrap.appendChild(el);
    }
    wrap.querySelectorAll('[data-open-grades]').forEach(btn => {
      btn.addEventListener('click', () => openGradeModal(btn.dataset.openGrades));
    });
    wrap.querySelectorAll('[data-del-assess]').forEach(btn => {
      btn.addEventListener('click', () => {
        if (!confirm('Excluir esta avaliação e todas as notas?')) return;
        DB.deleteAssessment(btn.dataset.delAssess);
        renderAssessments();
      });
    });
  }

  // Botão abrir modal nova avaliação
  $('#openAssessModalBtn')?.addEventListener('click', () => {
    fillSelect($('#assessClass'),   DB.getClasses(),  c => `${c.name} • ${c.year}${c.shift?' • '+c.shift:''}`, 'Crie uma turma primeiro');
    fillSelect($('#assessSubject'), DB.getSubjects(), s => s.name, 'Crie uma disciplina primeiro');
    openModal('assessModal');
  });

  function closeAssessModal() {
    closeModal('assessModal');
    ['#assessClass','#assessSubject','#assessName','#assessMax'].forEach(sel => {
      const el = $(sel); if (el) el.value = '';
    });
  }

  $('#closeAssessModal')  ?.addEventListener('click', closeAssessModal);
  $('#closeAssessModal2') ?.addEventListener('click', closeAssessModal);

  $('#saveAssessBtn')?.addEventListener('click', () => {
    const class_id   = $('#assessClass')?.value;
    const subject_id = $('#assessSubject')?.value;
    const name       = ($('#assessName')?.value || '').trim();
    const max_score  = Number($('#assessMax')?.value);
    if (!class_id)                    return alert('Selecione uma turma.');
    if (!subject_id)                  return alert('Selecione uma disciplina.');
    if (!name)                        return alert('Informe o nome da avaliação.');
    if (!max_score || max_score <= 0) return alert('Informe um valor válido.');
    DB.addAssessment({ class_id, subject_id, name, max_score });
    closeAssessModal();
    renderAssessments();
  });

  // Modal de notas
  function openGradeModal(assessmentId) {
    gradeAssessmentId = String(assessmentId);
    const assessment = DB.getAssessments().find(a => String(a.id) === gradeAssessmentId);
    if (!assessment) return;

    const maxScore = assessment.max_score;
    const title    = $('#gradeModalTitle');
    if (title) title.textContent = `Notas — ${assessment.name} (máx: ${maxScore})`;

    const roster     = DB.getClassStudents(assessment.class_id);
    const gradeMap   = new Map(DB.getGrades(assessmentId).map(g => [g.student_id, g.grade]));
    const list       = $('#gradeList');
    list.innerHTML   = '';

    if (!roster.length) {
      list.innerHTML = `<div class="item"><div>Nenhum aluno nesta turma.</div></div>`;
    } else {
      for (const row of roster) {
        const st    = row.students;
        const saved = gradeMap.has(st.id) ? gradeMap.get(st.id) : '';
        const el    = document.createElement('div');
        el.className = 'item grade-row';
        el.innerHTML = `
          <div><strong>${esc(st.name)}</strong></div>
          <div class="grade-input-wrap">
            <input
              type="number"
              class="grade-input"
              data-student-id="${st.id}"
              min="0" max="${maxScore}" step="0.1"
              value="${saved !== null && saved !== '' ? saved : ''}"
              placeholder="—"
            />
            <span class="grade-max">/ ${maxScore}</span>
          </div>`;
        list.appendChild(el);
      }
      list.querySelectorAll('.grade-input').forEach(input => {
        input.addEventListener('input', () => {
          const max = Number(input.getAttribute('max'));
          if (input.value !== '' && Number(input.value) > max) {
            input.value = max;
            input.classList.add('input-error');
            setTimeout(() => input.classList.remove('input-error'), 600);
          }
        });
      });
    }
    openModal('gradeModal');
  }

  $('#closeGradeModal')?.addEventListener('click', () => closeModal('gradeModal'));

  $('#saveGradesBtn')?.addEventListener('click', () => {
    if (!gradeAssessmentId) return;
    const rows = $$('#gradeList .grade-input').map(inp => ({
      student_id: inp.getAttribute('data-student-id'),
      grade: inp.value !== '' ? Number(inp.value) : null,
    }));
    DB.saveGrades(gradeAssessmentId, rows);
    closeModal('gradeModal');
    renderAssessments();
  });

  // ════════════════════════════════════════════════
  // RELATÓRIO POR ALUNO
  // ════════════════════════════════════════════════
  let reportClassId = null;

  $('#openReportModalBtn')?.addEventListener('click', () => {
    fillSelect($('#reportClassSelect'), DB.getClasses(),
      c => `${c.name} • ${c.year}${c.shift ? ' • ' + c.shift : ''}`,
      'Crie uma turma primeiro');
    $('#reportContent').innerHTML = '';
    openModal('reportModal');
  });

  $('#closeReportModal') ?.addEventListener('click', () => closeModal('reportModal'));
  $('#closeReportModal2')?.addEventListener('click', () => closeModal('reportModal'));

  $('#loadReportBtn')?.addEventListener('click', () => {
    reportClassId = $('#reportClassSelect')?.value;
    if (!reportClassId) return alert('Selecione uma turma.');
    renderReport(reportClassId);
  });

  function buildReportData(classId) {
    const roster      = DB.getClassStudents(classId);
    const assessments = DB.getAssessments().filter(a => a.class_id === classId);
    const allAttend   = DB.getAllAttendanceForClass(classId);

    return roster.map(row => {
      const st     = row.students;
      const faltas = allAttend.filter(a => a.student_id === st.id && a.is_absent).length;

      const notasArr = assessments.map(a => {
        const grades   = DB.getGrades(a.id);
        const gradeRec = grades.find(g => g.student_id === st.id);
        const nota     = (gradeRec && gradeRec.grade !== null && gradeRec.grade !== '') ? Number(gradeRec.grade) : null;
        return { avaliacao: a.name, max: a.max_score, nota, disciplina: a.subjects?.name || '—' };
      });

      return { id: st.id, nome: st.name, faltas, notas: notasArr };
    });
  }

  function renderReport(classId) {
    const cls   = DB.getClass(classId);
    const data  = buildReportData(classId);
    const wrap  = $('#reportContent');
    if (!wrap) return;

    if (!data.length) {
      wrap.innerHTML = `<div class="item"><div>Nenhum aluno nesta turma.</div></div>`;
      return;
    }

    const assessments = DB.getAssessments().filter(a => a.class_id === classId);
    wrap.innerHTML = '';

    // cabeçalho da turma
    const header = document.createElement('div');
    header.className = 'report-header';
    header.innerHTML = `<strong>${esc(cls?.name || '—')}</strong>${cls?.year ? ' • ' + cls.year : ''}${cls?.shift ? ' • ' + esc(cls.shift) : ''}`;
    wrap.appendChild(header);

    // tabela
    const tableWrap = document.createElement('div');
    tableWrap.className = 'report-table-wrap';

    const thead = ['Aluno', 'Faltas', ...assessments.map(a => `${esc(a.name)}<br><small>${esc(a.subjects?.name||'')}&nbsp;/&nbsp;${a.max_score}</small>`)];
    let html = `<table class="report-table"><thead><tr>${thead.map(h => `<th>${h}</th>`).join('')}</tr></thead><tbody>`;

    for (const aluno of data) {
      const notas = aluno.notas.map(n => {
        if (n.nota === null) return `<td class="nota-vazia">—</td>`;
        const pct  = n.nota / n.max;
        const cls2 = pct >= 0.6 ? 'nota-ok' : 'nota-baixa';
        return `<td class="${cls2}">${n.nota}</td>`;
      }).join('');

      const faltasCls = aluno.faltas > 0 ? 'nota-baixa' : '';
      html += `<tr>
        <td class="aluno-nome">${esc(aluno.nome)}</td>
        <td class="faltas-cell ${faltasCls}">${aluno.faltas}</td>
        ${notas}
      </tr>`;
    }

    html += '</tbody></table>';
    tableWrap.innerHTML = html;
    wrap.appendChild(tableWrap);
  }

  $('#exportReportPdfBtn')?.addEventListener('click', () => {
    if (!reportClassId) return alert('Gere o relatório primeiro.');
    exportReportToPdf(reportClassId);
  });

  function exportReportToPdf(classId) {
    const jsPDF = window.jsPDF;
    const doc    = new jsPDF('l', 'mm', 'a4');
    const pageW  = 297, pageH = 210;
    const margin = 14, usable = pageW - margin * 2;
    const footerY = pageH - 10;

    const INK    = [30,  30,  30];
    const MUTED  = [110, 110, 110];
    const ACCENT = [60,  90,  140];
    const LINE   = [200, 200, 200];
    const GREEN  = [40,  140, 70];
    const RED    = [190, 50,  50];
    const YELLOW = [180, 140, 30];

    let y    = margin;
    let page = 1;

    const cls         = DB.getClass(classId);
    const data        = buildReportData(classId);
    const assessments = DB.getAssessments().filter(a => a.class_id === classId);

    function addFooter() {
      doc.setDrawColor(LINE[0], LINE[1], LINE[2]);
      doc.setLineWidth(0.3);
      doc.line(margin, footerY - 3, pageW - margin, footerY - 3);
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(7);
      doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
      doc.text('Planner Pedagogico', margin, footerY);
      doc.text('Pagina ' + page, pageW / 2, footerY);
      doc.text(new Date().toLocaleDateString('pt-BR'), pageW - margin, footerY);
    }

    function checkPage(needed) {
      needed = needed || 10;
      if (y + needed > footerY - 6) {
        addFooter();
        doc.addPage();
        page++;
        y = margin;
        return true;
      }
      return false;
    }

    // ── cabeçalho ──
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(15);
    doc.setTextColor(ACCENT[0], ACCENT[1], ACCENT[2]);
    doc.text('Relatorio por Aluno', margin, y);
    y += 6;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
    const turmaLabel = cls
      ? (cls.name + (cls.year ? ' • ' + cls.year : '') + (cls.shift ? ' • ' + cls.shift : ''))
      : '—';
    doc.text('Turma: ' + turmaLabel, margin, y);
    y += 4;

    doc.setDrawColor(ACCENT[0], ACCENT[1], ACCENT[2]);
    doc.setLineWidth(0.5);
    doc.line(margin, y, pageW - margin, y);
    y += 6;

    if (!data.length) {
      doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
      doc.text('Nenhum aluno encontrado.', margin, y);
      addFooter();
      doc.save('relatorio_' + (cls?.name||'turma').replace(/[^a-zA-Z0-9]/g,'_') + '.pdf');
      return;
    }

    // ── cálculo de larguras das colunas ──
    const nomeW   = 42;
    const faltasW = 16;
    const notaW   = Math.min(28, Math.max(18, Math.floor((usable - nomeW - faltasW) / Math.max(assessments.length, 1))));
    const rowH    = 7;
    const headH   = 12;

    // ── função de cabeçalho de tabela ──
    function drawTableHeader(startY) {
      let cx = margin;
      // Aluno
      doc.setFillColor(240, 242, 248);
      doc.rect(cx, startY, nomeW, headH, 'F');
      doc.setDrawColor(LINE[0], LINE[1], LINE[2]);
      doc.setLineWidth(0.2);
      doc.rect(cx, startY, nomeW, headH);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.5);
      doc.setTextColor(INK[0], INK[1], INK[2]);
      doc.text('ALUNO', cx + 2, startY + 5);
      cx += nomeW;

      // Faltas
      doc.setFillColor(240, 242, 248);
      doc.rect(cx, startY, faltasW, headH, 'F');
      doc.rect(cx, startY, faltasW, headH);
      doc.setTextColor(INK[0], INK[1], INK[2]);
      doc.text('FALTAS', cx + 2, startY + 5);
      cx += faltasW;

      // Avaliações
      for (const a of assessments) {
        doc.setFillColor(240, 242, 248);
        doc.rect(cx, startY, notaW, headH, 'F');
        doc.rect(cx, startY, notaW, headH);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(6.5);
        doc.setTextColor(INK[0], INK[1], INK[2]);
        // nome da avaliação — trunca
        const maxC = Math.floor(notaW / 1.8);
        const label = a.name.length > maxC ? a.name.slice(0, maxC - 1) + '…' : a.name;
        doc.text(label, cx + 2, startY + 4);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(6);
        doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
        doc.text((a.subjects?.name||'') + ' / ' + a.max_score, cx + 2, startY + 8.5);
        cx += notaW;
      }
      return startY + headH;
    }

    y = drawTableHeader(y);

    // ── linhas de alunos ──
    for (let i = 0; i < data.length; i++) {
      const aluno = data[i];
      checkPage(rowH + 2);

      // se virou página, redesenha o header
      if (page > 1 && y === margin) {
        y = drawTableHeader(y);
      }

      const rowBg = i % 2 === 0 ? [255,255,255] : [248,249,252];
      let cx = margin;

      // nome
      doc.setFillColor(rowBg[0], rowBg[1], rowBg[2]);
      doc.rect(cx, y, nomeW, rowH, 'F');
      doc.setDrawColor(LINE[0], LINE[1], LINE[2]);
      doc.setLineWidth(0.2);
      doc.rect(cx, y, nomeW, rowH);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(INK[0], INK[1], INK[2]);
      const nomeT = aluno.nome.length > 22 ? aluno.nome.slice(0,21) + '…' : aluno.nome;
      doc.text(nomeT, cx + 2, y + 4.8);
      cx += nomeW;

      // faltas
      doc.setFillColor(...rowBg);
      doc.rect(cx, y, faltasW, rowH, 'F');
      doc.rect(cx, y, faltasW, rowH);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(aluno.faltas > 0 ? RED[0] : INK[0], aluno.faltas > 0 ? RED[1] : INK[1], aluno.faltas > 0 ? RED[2] : INK[2]);
      doc.text(String(aluno.faltas), cx + faltasW / 2, y + 4.8);
      cx += faltasW;

      // notas
      for (const n of aluno.notas) {
        doc.setFillColor(rowBg[0], rowBg[1], rowBg[2]);
        doc.rect(cx, y, notaW, rowH, 'F');
        doc.setDrawColor(LINE[0], LINE[1], LINE[2]);
        doc.setLineWidth(0.2);
        doc.rect(cx, y, notaW, rowH);

        if (n.nota === null) {
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(8);
          doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
          doc.text('—', cx + notaW / 2, y + 4.8);
        } else {
          const pct = n.nota / n.max;
          const cor = pct >= 0.6 ? GREEN : (pct >= 0.4 ? YELLOW : RED);
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(8);
          doc.setTextColor(cor[0], cor[1], cor[2]);
          doc.text(String(n.nota), cx + notaW / 2, y + 4.8);
        }
        cx += notaW;
      }

      y += rowH;
    }

    // ── legenda ──
    y += 6;
    checkPage(16);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
    doc.text('Legenda:', margin, y);
    y += 4;
    doc.setFont('helvetica', 'normal');

    const legenda = [
      [GREEN, 'Aprovado (>= 60%)'],
      [YELLOW,'Recuperacao (40–59%)'],
      [RED,   'Reprovado (< 40%) / Faltas'],
    ];
    let lx = margin;
    for (const [cor, txt] of legenda) {
      doc.setFillColor(cor[0], cor[1], cor[2]);
      doc.rect(lx, y - 2.5, 4, 3.5, 'F');
      doc.setTextColor(INK[0], INK[1], INK[2]);
      doc.text(txt, lx + 5.5, y);
      lx += 58;
    }

    addFooter();

    const safeCls = (cls?.name || 'turma').replace(/[^a-zA-Z0-9]/g, '_');
    doc.save('relatorio_' + safeCls + '_' + new Date().toISOString().slice(0,10).replace(/-/g,'') + '.pdf');
  }

  // ════════════════════════════════════════════════
  // INIT
  // ════════════════════════════════════════════════
  initTabs();
  loadSubjects();
  loadClasses();
  refreshConsultation();
  populateAttendanceClassSelect();
  setAttendanceDateToday();

}); // fim DOMContentLoaded
