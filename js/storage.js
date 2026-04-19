/**
 * ═══════════════════════════════════════════════════════════════
 * 📦 STORAGE.JS — Gerenciador de Banco de Dados (localStorage)
 * ═══════════════════════════════════════════════════════════════
 * 
 * Este módulo implementa um banco de dados simples usando localStorage
 * do navegador. Todos os dados da aplicação são salvos localmente no 
 * dispositivo do usuário, sem dependência de servidor online.
 * 
 * Estrutura: IIFE (Immediately Invoked Function Expression)
 * - Encapsula todas as funções em um escopo privado
 * - Retorna apenas as funções públicas no final
 * - Protege os dados de acesso externo
 */

const DB = (() => {
  // Chave única para armazenar os dados no localStorage
  const KEY = 'plannerDB_v1';

  /**
   * Carrega os dados do banco de dados do localStorage
   * @returns {Object} Objeto com todos os dados ou {} se estiver vazio/corrompido
   */
  function load() {
    try { 
      // Tenta ler e converter JSON
      return JSON.parse(localStorage.getItem(KEY)) || {}; 
    }
    catch { 
      // Se houver erro na leitura, retorna objeto vazio
      return {}; 
    }
  }

  /**
   * Salva o banco de dados inteiro no localStorage
   * @param {Object} db - Objeto completo do banco de dados
   */
  function save(db) { 
    localStorage.setItem(KEY, JSON.stringify(db)); 
  }

  /**
   * Gera um ID único para cada registro
   * Combinação de: timestamp em base 36 + números aleatórios
   * Exemplo: "a1b2c3d4e5"
   * @returns {string} ID único
   */
  function uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  // ══════════════════════════════════════════════════════════════
  // 📚 DISCIPLINAS (SUBJECTS)
  // ══════════════════════════════════════════════════════════════

  /**
   * Recupera todas as disciplinas cadastradas
   * @returns {Array} Lista de disciplinas ordenada alfabeticamente
   */
  function getSubjects() {
    return (load().subjects || []).sort((a,b) => a.name.localeCompare(b.name));
  }

  /**
   * Adiciona uma nova disciplina ao banco de dados
   * @param {string} name - Nome da disciplina (ex: "Matemática")
   * @returns {Object} Registro criado com id e data de criação
   */
  function addSubject(name) {
    const db = load();
    db.subjects = db.subjects || [];
    const rec = { 
      id: uid(), 
      name, 
      created_at: new Date().toISOString() 
    };
    db.subjects.push(rec);
    save(db);
    return rec;
  }

  /**
   * Deleta uma disciplina e todas as referências a ela
   * Cascata: remove de turmas, horários e planejamentos
   * @param {string} id - ID da disciplina a deletar
   */
  function deleteSubject(id) {
    const db = load();
    // Remove a disciplina da lista principal
    db.subjects        = (db.subjects        || []).filter(s  => s.id  !== id);
    // Remove de todas as associações com turmas
    db.class_subjects  = (db.class_subjects  || []).filter(cs => cs.subject_id !== id);
    // Remove de todos os horários
    db.class_schedule  = (db.class_schedule  || []).filter(cs => cs.subject_id !== id);
    save(db);
  }

  // ══════════════════════════════════════════════════════════════
  // 🎓 TURMAS (CLASSES)
  // ══════════════════════════════════════════════════════════════

  /**
   * Recupera todas as turmas cadastradas
   * Ordenadas por: ano descendente, depois nome alfabético
   * @returns {Array} Lista de turmas
   */
  function getClasses() {
    return (load().classes || []).sort((a,b) => {
      if (b.year !== a.year) return b.year - a.year;
      return a.name.localeCompare(b.name);
    });
  }

  /**
   * Busca uma turma específica pelo ID
   * @param {string} id - ID da turma
   * @returns {Object|null} Turma encontrada ou null
   */
  function getClass(id) {
    return (load().classes || []).find(c => c.id === id) || null;
  }

  /**
   * Cria uma nova turma
   * @param {Object} params - Parâmetros da turma
   * @param {string} params.name - Nome da turma (ex: "3ºA")
   * @param {number} params.year - Ano da turma (ex: 2025)
   * @param {string} params.shift - Turno (ex: "Manhã", opcional)
   * @returns {Object} Turma criada
   */
  function addClass({ name, year, shift }) {
    const db = load();
    db.classes = db.classes || [];
    const rec = { 
      id: uid(), 
      name, 
      year: Number(year), 
      shift: shift || '', 
      created_at: new Date().toISOString() 
    };
    db.classes.push(rec);
    save(db);
    return rec;
  }

  /**
   * Deleta uma turma e TODOS os dados relacionados (cascata)
   * Remove: disciplinas, horários, alunos, chamadas, planejamentos, avaliações
   * @param {string} id - ID da turma a deletar
   */
  function deleteClass(id) {
    const db = load();
    db.classes         = (db.classes         || []).filter(c  => c.id       !== id);
    db.class_subjects  = (db.class_subjects  || []).filter(cs => cs.class_id !== id);
    db.class_schedule  = (db.class_schedule  || []).filter(cs => cs.class_id !== id);
    db.class_students  = (db.class_students  || []).filter(cs => cs.class_id !== id);
    db.attendance      = (db.attendance      || []).filter(a  => a.class_id  !== id);
    db.lesson_plans    = (db.lesson_plans    || []).filter(p  => p.class_id  !== id);
    db.assessments     = (db.assessments     || []).filter(a  => a.class_id  !== id);
    save(db);
  }

  // ══════════════════════════════════════════════════════════════
  // 🔗 VINCULAÇÃO TURMA-DISCIPLINA (CLASS_SUBJECTS)
  // ══════════════════════════════════════════════════════════════

  /**
   * Busca todas as disciplinas de uma turma
   * Enriquece com informações da disciplina (nome, etc)
   * @param {string} class_id - ID da turma
   * @returns {Array} Lista de disciplinas com dados completos
   */
  function getClassSubjects(class_id) {
    const db = load();
    return (db.class_subjects || [])
      .filter(cs => cs.class_id === class_id)
      // Busca o nome da disciplina e junta aos dados
      .map(cs => ({ 
        ...cs, 
        subjects: (db.subjects || []).find(s => s.id === cs.subject_id) || null 
      }))
      .sort((a,b) => (a.created_at||'').localeCompare(b.created_at||''));
  }

  /**
   * Vincula uma disciplina a uma turma
   * Evita duplicação e permite especificar quantas aulas/semana
   * @param {Object} params
   * @param {string} params.class_id - ID da turma
   * @param {string} params.subject_id - ID da disciplina
   * @param {number} params.weekly_classes - Quantas aulas por semana (opcional)
   * @returns {Object} Vínculo criado
   * @throws {Error} Se disciplina já existe nesta turma
   */
  function linkSubject({ class_id, subject_id, weekly_classes }) {
    const db = load();
    db.class_subjects = db.class_subjects || [];
    
    // Verifica se já existe para evitar duplicação
    if (db.class_subjects.some(cs => cs.class_id === class_id && cs.subject_id === subject_id))
      throw new Error('Disciplina já adicionada a esta turma.');
    
    const rec = { 
      id: uid(), 
      class_id, 
      subject_id, 
      weekly_classes: weekly_classes ?? null, 
      created_at: new Date().toISOString() 
    };
    db.class_subjects.push(rec);
    save(db);
    return rec;
  }

  /**
   * Remove uma disciplina de uma turma
   * @param {string} linkId - ID do vínculo a remover
   */
  function unlinkSubject(linkId) {
    const db = load();
    db.class_subjects = (db.class_subjects || []).filter(cs => cs.id !== linkId);
    save(db);
  }

  // ══════════════════════════════════════════════════════════════
  // ⏰ HORÁRIOS (CLASS_SCHEDULE)
  // ══════════════════════════════════════════════════════════════

  /**
   * Busca todos os horários de uma turma específica
   * @param {string} class_id - ID da turma
   * @returns {Array} Horários ordenados por dia e hora
   */
  function getClassSchedule(class_id) {
    const db = load();
    return (db.class_schedule || [])
      .filter(r => r.class_id === class_id)
      .map(r => ({ ...r, subjects: (db.subjects || []).find(s => s.id === r.subject_id) || null }))
      .sort((a,b) => a.day_of_week - b.day_of_week || a.start_time.localeCompare(b.start_time));
  }

  /**
   * Busca TODOS os horários de TODAS as turmas (com dados enriquecidos)
   */
  function getAllSchedule() {
    const db = load();
    return (db.class_schedule || []).map(r => ({
      ...r,
      subjects: (db.subjects || []).find(s => s.id === r.subject_id) || null,
      classes:  (db.classes  || []).find(c => c.id === r.class_id)   || null,
    }));
  }

  /**
   * Adiciona um novo horário para uma turma
   */
  function addSchedule({ class_id, subject_id, day_of_week, start_time, end_time }) {
    const db = load();
    db.class_schedule = db.class_schedule || [];
    const rec = { id: uid(), class_id, subject_id, day_of_week: Number(day_of_week), start_time, end_time, created_at: new Date().toISOString() };
    db.class_schedule.push(rec);
    save(db);
    return rec;
  }

  /**
   * Deleta um horário específico
   */
  function deleteSchedule(id) {
    const db = load();
    db.class_schedule = (db.class_schedule || []).filter(r => r.id !== id);
    save(db);
  }

  // ══════════════════════════════════════════════════════════════
  // 👤 ALUNOS (STUDENTS)
  // ══════════════════════════════════════════════════════════════

  /**
   * Busca todos os alunos vinculados a uma turma (ordenado por nome)
   */
  function getClassStudents(class_id) {
    const db = load();
    return (db.class_students || [])
      .filter(l => l.class_id === class_id)
      .map(l => ({ ...l, students: (db.students || []).find(s => s.id === l.student_id) || null }))
      .sort((a,b) => (a.students?.name||'').localeCompare(b.students?.name||''));
  }

  /**
   * Adiciona um novo aluno a uma turma
   */
  function addStudent(class_id, name) {
    const db = load();
    db.students       = db.students       || [];
    db.class_students = db.class_students || [];
    const student = { id: uid(), name, created_at: new Date().toISOString() };
    const link    = { id: uid(), class_id, student_id: student.id, created_at: new Date().toISOString() };
    db.students.push(student);
    db.class_students.push(link);
    save(db);
    return { student, link };
  }

  /**
   * Remove um aluno de uma turma
   */
  function removeStudentFromClass(linkId) {
    const db = load();
    db.class_students = (db.class_students || []).filter(cs => cs.id !== linkId);
    save(db);
  }

  // ══════════════════════════════════════════════════════════════
  // 📋 CHAMADA (ATTENDANCE)
  // ══════════════════════════════════════════════════════════════

  /**
   * Busca a chamada de uma turma em uma data específica
   */
  function getAttendanceForDay(class_id, date) {
    return (load().attendance || []).filter(a => a.class_id === class_id && a.lesson_date === date);
  }

  /**
   * Busca TODA a chamada de uma turma (histórico completo)
   */
  function getAllAttendanceForClass(class_id) {
    return (load().attendance || []).filter(a => a.class_id === class_id);
  }

  /**
   * Salva a chamada de um dia para uma turma
   */
  function saveAttendance(class_id, date, rows) {
    const db = load();
    db.attendance = db.attendance || [];
    for (const row of rows) {
      const idx = db.attendance.findIndex(a => a.class_id === class_id && a.student_id === row.student_id && a.lesson_date === date);
      if (idx >= 0) db.attendance[idx].is_absent = row.is_absent;
      else db.attendance.push({ id: uid(), class_id, student_id: row.student_id, lesson_date: date, is_absent: row.is_absent, created_at: new Date().toISOString() });
    }
    save(db);
  }

  // ══════════════════════════════════════════════════════════════
  // 📝 PLANEJAMENTOS (LESSON_PLANS)
  // ══════════════════════════════════════════════════════════════

  /**
   * Busca todos os planejamentos cadastrados (ordenados por data)
   */
  function getLessonPlans() {
    const db = load();
    return (db.lesson_plans || [])
      .map(p => ({
        ...p,
        classes:  (db.classes  || []).find(c => c.id === p.class_id)   || null,
        subjects: (db.subjects || []).find(s => s.id === p.subject_id) || null,
      }))
      .sort((a,b) => (b.date||'').localeCompare(a.date||''));
  }

  /**
   * Cria um novo planejamento de aula
   */
  function addLessonPlan({ class_id, subject_id, bncc, content, date }) {
    const db = load();
    db.lesson_plans = db.lesson_plans || [];
    const rec = { id: uid(), class_id, subject_id, bncc: bncc||'', content: content||'', date: date||'', created_at: new Date().toISOString() };
    db.lesson_plans.push(rec);
    save(db);
    return rec;
  }

  /**
   * Deleta um planejamento
   */
  function deleteLessonPlan(id) {
    const db = load();
    db.lesson_plans = (db.lesson_plans || []).filter(p => p.id !== id);
    save(db);
  }

  // ══════════════════════════════════════════════════════════════
  // 📊 AVALIAÇÕES (ASSESSMENTS)
  // ══════════════════════════════════════════════════════════════

  /**
   * Busca todas as avaliações cadastradas
   */
  function getAssessments() {
    const db = load();
    return (db.assessments || [])
      .map(a => ({
        ...a,
        classes:  (db.classes  || []).find(c => c.id === a.class_id)   || null,
        subjects: (db.subjects || []).find(s => s.id === a.subject_id) || null,
      }))
      .sort((a,b) => (b.created_at||'').localeCompare(a.created_at||''));
  }

  /**
   * Cria uma nova avaliação
   */
  function addAssessment({ class_id, subject_id, name, max_score }) {
    const db = load();
    db.assessments = db.assessments || [];
    const rec = { id: uid(), class_id, subject_id, name, max_score: Number(max_score), created_at: new Date().toISOString() };
    db.assessments.push(rec);
    save(db);
    return rec;
  }

  /**
   * Deleta uma avaliação e TODAS as notas relacionadas
   */
  function deleteAssessment(id) {
    const db = load();
    db.assessments = (db.assessments || []).filter(a => a.id !== id);
    db.grades      = (db.grades      || []).filter(g => g.assessment_id !== id);
    save(db);
  }

  // ══════════════════════════════════════════════════════════════
  // 📈 NOTAS (GRADES)
  // ══════════════════════════════════════════════════════════════

  /**
   * Busca todas as notas de uma avaliação
   */
  function getGrades(assessment_id) {
    return (load().grades || []).filter(g => g.assessment_id === assessment_id);
  }

  /**
   * Salva as notas de uma avaliação (atualiza ou cria novas)
   */
  function saveGrades(assessment_id, rows) {
    const db = load();
    db.grades = db.grades || [];
    for (const row of rows) {
      const idx = db.grades.findIndex(g => g.assessment_id === assessment_id && g.student_id === row.student_id);
      if (idx >= 0) db.grades[idx].grade = row.grade;
      else db.grades.push({ id: uid(), assessment_id, student_id: row.student_id, grade: row.grade, created_at: new Date().toISOString() });
    }
    save(db);
  }

  // ══════════════════════════════════════════════════════════════
  // API PÚBLICA — Retorna apenas as funções para uso externo
  // ══════════════════════════════════════════════════════════════
  return {
    getSubjects, addSubject, deleteSubject,
    getClasses, getClass, addClass, deleteClass,
    getClassSubjects, linkSubject, unlinkSubject,
    getClassSchedule, getAllSchedule, addSchedule, deleteSchedule,
    getClassStudents, addStudent, removeStudentFromClass,
    getAttendanceForDay, getAllAttendanceForClass, saveAttendance,
    getLessonPlans, addLessonPlan, deleteLessonPlan,
    getAssessments, addAssessment, deleteAssessment,
    getGrades, saveGrades,
  };
})();
