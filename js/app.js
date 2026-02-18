// js/app.js
(() => {
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  const supabase = window.getSupabase?.();
  if (!supabase) {
    console.error("Supabase client não inicializado. Verifique js/supabaseClient.js");
    return;
  }

  const DOW = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];
  let selectedClassId = null;
  let lastScheduleRows = [];

  // ✅ schema detectado da tabela attendance
  const attendanceSchema = {
    dateCol: null,            // lesson_date / date / day / attendance_date
    presenceCol: null,        // is_absent / present
    presenceMode: "absent",   // "absent" (is_absent) | "present" (present)
    dateMode: "date",         // "date" | "timestamptz"
    ready: false,
  };

  async function bootstrap() {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      window.location.href = "auth.html";
      return;
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("username, role, name")
      .eq("id", session.user.id)
      .single();

    $("#userBadge").textContent =
      profile?.username ? `@${profile.username}` : (session.user.email || "Logada");

    $("#logoutBtn")?.addEventListener("click", async () => {
      await supabase.auth.signOut();
      window.location.href = "auth.html";
    });

    initTabs();

    bindSubjectsUI();
    bindClassesUI();
    bindScheduleUI();

    // ✅ alunos + chamada
    bindStudentsUI();
    bindAttendanceUI();

    $("#refreshScheduleBtn")?.addEventListener("click", refreshConsultation);
    $("#shiftFilter")?.addEventListener("change", refreshConsultation);
    $("#printWeekBtn")?.addEventListener("click", () => printWeek(lastScheduleRows));

    await loadSubjects();
    await loadClasses();
    await refreshConsultation();

    await populateAttendanceClassSelect();
    setAttendanceDateToday();

    // ✅ tenta detectar schema da tabela attendance (não quebra se falhar)
    await detectAttendanceSchema();
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

      if (viewName === "classes") refreshConsultation();

      if (viewName === "attendance") {
        populateAttendanceClassSelect();
        setAttendanceDateToday();
      }
    }

    tabs.forEach(t => t.addEventListener("click", () => setActive(t.dataset.view)));
  }

  async function getUserId() {
    const { data } = await supabase.auth.getUser();
    return data?.user?.id || null;
  }

  // =====================
  // Disciplinas
  // =====================
  async function loadSubjects() {
    const { data, error } = await supabase
      .from("subjects")
      .select("id, name")
      .order("name", { ascending: true });

    if (error) {
      console.error("loadSubjects:", error);
      return;
    }

    const list = $("#subjectsList");
    if (list) {
      list.innerHTML = "";
      if (!data?.length) {
        list.innerHTML = `<div class="item"><div>Nenhuma disciplina cadastrada ainda.</div></div>`;
      } else {
        for (const s of data) {
          const el = document.createElement("div");
          el.className = "item";
          el.innerHTML = `
            <div><strong>${escapeHtml(s.name)}</strong></div>
            <div style="display:flex; gap:8px;">
              <button class="btn-ghost" type="button" data-del-subject="${s.id}">Excluir</button>
            </div>
          `;
          list.appendChild(el);
        }

        list.querySelectorAll("[data-del-subject]").forEach(btn => {
          btn.addEventListener("click", async () => {
            if (!confirm("Excluir esta disciplina?")) return;
            await deleteSubject(btn.dataset.delSubject);
            await loadSubjects();
            await loadSubjectsToSelect();
            await loadScheduleSubjectsToSelect();
            if (selectedClassId) {
              await loadClassSubjects(selectedClassId);
              await loadClassSchedule(selectedClassId);
            }
            await refreshConsultation();
          });
        });
      }
    }

    await loadSubjectsToSelect(data);
    await loadScheduleSubjectsToSelect(data);
  }

  async function createSubject(name) {
    const user_id = await getUserId();
    if (!user_id) return alert("Sessão inválida. Faça login novamente.");

    const { error } = await supabase.from("subjects").insert({ user_id, name });
    if (error) {
      console.error("createSubject:", error);
      alert(error.message || "Erro ao criar disciplina.");
    }
  }

  async function deleteSubject(subjectId) {
    const { error } = await supabase.from("subjects").delete().eq("id", subjectId);
    if (error) {
      console.error("deleteSubject:", error);
      alert(error.message || "Erro ao excluir disciplina.");
    }
  }

  async function loadSubjectsToSelect(prefetched) {
    const sel = $("#subjectSelect");
    if (!sel) return;

    const data = prefetched ?? (await supabase
      .from("subjects").select("id, name").order("name", { ascending: true })
    ).data;

    sel.innerHTML = "";
    if (!data?.length) {
      sel.disabled = true;
      sel.innerHTML = `<option value="">Crie uma disciplina primeiro.</option>`;
      return;
    }

    sel.disabled = false;
    for (const s of data) {
      const opt = document.createElement("option");
      opt.value = s.id;
      opt.textContent = s.name;
      sel.appendChild(opt);
    }
  }

  async function loadScheduleSubjectsToSelect(prefetched) {
    const sel = $("#scheduleSubject");
    if (!sel) return;

    const data = prefetched ?? (await supabase
      .from("subjects").select("id, name").order("name", { ascending: true })
    ).data;

    sel.innerHTML = "";
    if (!data?.length) {
      sel.disabled = true;
      sel.innerHTML = `<option value="">Crie uma disciplina primeiro.</option>`;
      return;
    }

    sel.disabled = false;
    for (const s of data) {
      const opt = document.createElement("option");
      opt.value = s.id;
      opt.textContent = s.name;
      sel.appendChild(opt);
    }
  }

  function bindSubjectsUI() {
    $("#subjectCreateForm")?.addEventListener("submit", async (e) => {
      e.preventDefault();
      const name = $("#subjectName")?.value.trim();
      if (!name) return;
      await createSubject(name);
      $("#subjectCreateForm").reset();
      await loadSubjects();
    });
  }

  // =====================
  // Turmas
  // =====================
  async function loadClasses() {
    const { data, error } = await supabase
      .from("classes")
      .select("id, name, year, shift")
      .order("year", { ascending: false })
      .order("name", { ascending: true });

    if (error) {
      console.error("loadClasses:", error);
      return;
    }

    const wrap = $("#classesList");
    if (!wrap) return;

    wrap.innerHTML = "";
    if (!data?.length) {
      wrap.innerHTML = `<div class="item"><div>Nenhuma turma criada ainda.</div></div>`;
      return;
    }

    for (const c of data) {
      const el = document.createElement("div");
      el.className = "item";
      el.innerHTML = `
        <div>
          <strong>${escapeHtml(c.name)}</strong>
          <div class="meta">${c.year}${c.shift ? " • " + escapeHtml(c.shift) : ""}</div>
        </div>
        <div style="display:flex; gap:8px;">
          <button class="btn-ghost" type="button" data-open="${c.id}">Abrir</button>
        </div>
      `;
      wrap.appendChild(el);
    }

    wrap.querySelectorAll("[data-open]").forEach(btn => {
      btn.addEventListener("click", () => openClass(btn.dataset.open));
    });
  }

  async function createClass({ name, year, shift }) {
    const user_id = await getUserId();
    if (!user_id) return alert("Sessão inválida. Faça login novamente.");

    const { error } = await supabase.from("classes").insert({
      user_id,
      name,
      year,
      shift: shift || null,
    });

    if (error) {
      console.error("createClass:", error);
      alert(error.message || "Erro ao criar turma.");
      return;
    }

    await loadClasses();
    await populateAttendanceClassSelect();
    await refreshConsultation();
  }

  async function deleteClass(classId) {
    const { error } = await supabase.from("classes").delete().eq("id", classId);
    if (error) {
      console.error("deleteClass:", error);
      alert(error.message || "Erro ao excluir turma.");
      return;
    }
    closeClassDetail();
    await loadClasses();
    await populateAttendanceClassSelect();
    await refreshConsultation();
  }

  function closeClassDetail() {
    selectedClassId = null;
    $("#classDetail").hidden = true;
    $("#classSubjectsList").innerHTML = "";
    $("#scheduleList").innerHTML = "";
    const s = $("#classStudentsList");
    if (s) s.innerHTML = "";
  }

  async function openClass(classId) {
    selectedClassId = classId;

    const { data: cls, error } = await supabase
      .from("classes")
      .select("id, name, year, shift")
      .eq("id", classId)
      .single();

    if (error) {
      console.error("openClass:", error);
      return;
    }

    $("#classDetail").hidden = false;
    $("#classTitle").textContent = `${cls.name} • ${cls.year}${cls.shift ? " • " + cls.shift : ""}`;

    $("#deleteClassBtn").onclick = () => {
      if (confirm("Tem certeza que deseja excluir esta turma?")) deleteClass(classId);
    };

    await loadSubjectsToSelect();
    await loadScheduleSubjectsToSelect();
    await loadClassSubjects(classId);
    await loadClassSchedule(classId);

    await loadClassStudents(classId);
  }

  function bindClassesUI() {
    $("#classCreateForm")?.addEventListener("submit", async (e) => {
      e.preventDefault();
      const name = $("#className").value.trim();
      const year = Number($("#classYear").value);
      const shift = $("#classShift").value.trim();

      if (!name) return alert("Informe o nome da turma.");
      if (!year || year < 2000) return alert("Informe um ano válido.");

      await createClass({ name, year, shift });
      $("#classCreateForm").reset();
    });

    $("#linkSubjectForm")?.addEventListener("submit", async (e) => {
      e.preventDefault();
      if (!selectedClassId) return;

      const subject_id = $("#subjectSelect").value;
      if (!subject_id) return;

      const wcRaw = $("#weeklyClasses").value;
      const weekly_classes = wcRaw === "" ? null : Number(wcRaw);

      await linkSubjectToClass({ class_id: selectedClassId, subject_id, weekly_classes });
      $("#weeklyClasses").value = "";
      await loadClassSubjects(selectedClassId);
    });
  }

  // =====================
  // class_subjects
  // =====================
  async function loadClassSubjects(classId) {
    const { data, error } = await supabase
      .from("class_subjects")
      .select("id, weekly_classes, subjects(id, name)")
      .eq("class_id", classId)
      .order("created_at", { ascending: true });

    if (error) {
      console.error("loadClassSubjects:", error);
      return;
    }

    const wrap = $("#classSubjectsList");
    wrap.innerHTML = "";

    if (!data?.length) {
      wrap.innerHTML = `<div class="item"><div>Nenhuma disciplina adicionada ainda.</div></div>`;
      return;
    }

    for (const row of data) {
      const subj = row.subjects;
      const el = document.createElement("div");
      el.className = "item";
      el.innerHTML = `
        <div>
          <strong>${escapeHtml(subj?.name || "Disciplina")}</strong>
          <div class="meta">${row.weekly_classes != null ? `Aulas/semana: ${row.weekly_classes}` : "Sem carga definida"}</div>
        </div>
        <div style="display:flex; gap:8px;">
          <button class="btn-ghost" type="button" data-unlink="${row.id}">Remover</button>
        </div>
      `;
      wrap.appendChild(el);
    }

    wrap.querySelectorAll("[data-unlink]").forEach(btn => {
      btn.addEventListener("click", async () => {
        if (!confirm("Remover disciplina desta turma?")) return;
        await unlinkSubject(btn.dataset.unlink);
        await loadClassSubjects(classId);
      });
    });
  }

  async function linkSubjectToClass({ class_id, subject_id, weekly_classes }) {
    const user_id = await getUserId();
    if (!user_id) return alert("Sessão inválida. Faça login novamente.");

    const { error } = await supabase.from("class_subjects").insert({
      user_id,
      class_id,
      subject_id,
      weekly_classes: weekly_classes ?? null,
    });

    if (error) {
      console.error("linkSubjectToClass:", error);
      alert(error.message || "Erro ao adicionar disciplina (talvez já exista).");
    }
  }

  async function unlinkSubject(linkId) {
    const { error } = await supabase.from("class_subjects").delete().eq("id", linkId);
    if (error) {
      console.error("unlinkSubject:", error);
      alert(error.message || "Erro ao remover disciplina.");
    }
  }

  // =====================
  // class_schedule
  // =====================
  function bindScheduleUI() {
    $("#scheduleCreateForm")?.addEventListener("submit", async (e) => {
      e.preventDefault();
      if (!selectedClassId) return;

      const user_id = await getUserId();
      if (!user_id) return alert("Sessão inválida. Faça login novamente.");

      const day_of_week = Number($("#scheduleDay").value);
      const subject_id = $("#scheduleSubject").value;
      const start_time = $("#scheduleStart").value;
      const end_time = $("#scheduleEnd").value;

      if (!subject_id) return alert("Selecione uma disciplina.");
      if (!start_time || !end_time) return alert("Informe início e fim.");
      if (end_time <= start_time) return alert("O horário final deve ser maior que o inicial.");

      const { error } = await supabase.from("class_schedule").insert({
        user_id,
        class_id: selectedClassId,
        subject_id,
        day_of_week,
        start_time,
        end_time,
      });

      if (error) {
        console.error("schedule insert:", error);
        alert(error.message || "Erro ao adicionar horário (pode ser duplicado).");
        return;
      }

      $("#scheduleCreateForm").reset();
      await loadClassSchedule(selectedClassId);
      await refreshConsultation();
    });
  }

  async function loadClassSchedule(classId) {
    const { data, error } = await supabase
      .from("class_schedule")
      .select("id, day_of_week, start_time, end_time, subjects(id, name)")
      .eq("class_id", classId)
      .order("day_of_week", { ascending: true })
      .order("start_time", { ascending: true });

    if (error) {
      console.error("loadClassSchedule:", error);
      return;
    }

    const wrap = $("#scheduleList");
    wrap.innerHTML = "";

    if (!data?.length) {
      wrap.innerHTML = `<div class="item"><div>Nenhum horário cadastrado ainda.</div></div>`;
      return;
    }

    for (const row of data) {
      const el = document.createElement("div");
      el.className = "item";
      el.innerHTML = `
        <div>
          <strong>${escapeHtml(row.subjects?.name || "Disciplina")}</strong>
          <div class="meta">${DOW[row.day_of_week]} • ${fmtTime(row.start_time)}–${fmtTime(row.end_time)}</div>
        </div>
        <div style="display:flex; gap:8px;">
          <button class="btn-ghost" type="button" data-del-schedule="${row.id}">Excluir</button>
        </div>
      `;
      wrap.appendChild(el);
    }

    wrap.querySelectorAll("[data-del-schedule]").forEach(btn => {
      btn.addEventListener("click", async () => {
        if (!confirm("Excluir este horário?")) return;
        await deleteSchedule(btn.dataset.delSchedule);
        await loadClassSchedule(classId);
        await refreshConsultation();
      });
    });
  }

  async function deleteSchedule(scheduleId) {
    const { error } = await supabase.from("class_schedule").delete().eq("id", scheduleId);
    if (error) {
      console.error("deleteSchedule:", error);
      alert(error.message || "Erro ao excluir horário.");
    }
  }

  // =====================
  // ✅ Alunos por turma
  // =====================
  function bindStudentsUI() {
    $("#studentCreateForm")?.addEventListener("submit", async (e) => {
      e.preventDefault();
      if (!selectedClassId) return;

      const user_id = await getUserId();
      if (!user_id) return alert("Sessão inválida. Faça login novamente.");

      const name = $("#studentName")?.value.trim();
      if (!name) return;

      const { data: st, error: stErr } = await supabase
        .from("students")
        .insert({ user_id, name })
        .select("id, name")
        .single();

      if (stErr) {
        console.error("students insert:", stErr);
        alert(stErr.message || "Erro ao cadastrar aluno.");
        return;
      }

      const { error: linkErr } = await supabase
        .from("class_students")
        .insert({ user_id, class_id: selectedClassId, student_id: st.id });

      if (linkErr) {
        console.error("class_students insert:", linkErr);
        alert(linkErr.message || "Erro ao vincular aluno na turma.");
        return;
      }

      $("#studentCreateForm").reset();
      await loadClassStudents(selectedClassId);
    });
  }

  async function loadClassStudents(classId) {
    const wrap = $("#classStudentsList");
    if (!wrap) return;

    const { data, error } = await supabase
      .from("class_students")
      .select("id, student_id, students(id, name)")
      .eq("class_id", classId)
      .order("created_at", { ascending: true });

    if (error) {
      console.error("loadClassStudents:", error);
      wrap.innerHTML = `<div class="item"><div>Erro ao carregar alunos.</div></div>`;
      return;
    }

    wrap.innerHTML = "";

    if (!data?.length) {
      wrap.innerHTML = `<div class="item"><div>Nenhum aluno nesta turma ainda.</div></div>`;
      return;
    }

    const rows = [...data].sort((a, b) => (a.students?.name || "").localeCompare(b.students?.name || ""));

    for (const row of rows) {
      const el = document.createElement("div");
      el.className = "item";
      el.innerHTML = `
        <div>
          <strong>${escapeHtml(row.students?.name || "Aluno")}</strong>
          <div class="meta">Aluno</div>
        </div>
        <div style="display:flex; gap:8px;">
          <button class="btn-ghost" type="button" data-unlink-student="${row.id}">Remover</button>
        </div>
      `;
      wrap.appendChild(el);
    }

    wrap.querySelectorAll("[data-unlink-student]").forEach(btn => {
      btn.addEventListener("click", async () => {
        if (!confirm("Remover este aluno da turma?")) return;
        const { error } = await supabase.from("class_students").delete().eq("id", btn.dataset.unlinkStudent);
        if (error) {
          console.error("class_students delete:", error);
          alert(error.message || "Erro ao remover aluno.");
          return;
        }
        await loadClassStudents(classId);
      });
    });
  }

  // =====================
  // ✅ CHAMADA (attendance) — usa lesson_date
  // =====================
  function bindAttendanceUI() {
    $("#loadAttendanceBtn")?.addEventListener("click", async () => {
      await loadAttendanceScreen();
    });

    $("#saveAttendanceBtn")?.addEventListener("click", async () => {
      await saveAttendance();
    });
  }

  async function populateAttendanceClassSelect() {
    const sel = $("#attendanceClassSelect");
    if (!sel) return;

    const { data, error } = await supabase
      .from("classes")
      .select("id, name, year, shift")
      .order("year", { ascending: false })
      .order("name", { ascending: true });

    if (error) {
      console.error("populateAttendanceClassSelect:", error);
      sel.innerHTML = `<option value="">Erro ao carregar</option>`;
      sel.disabled = true;
      return;
    }

    sel.innerHTML = "";
    if (!data?.length) {
      sel.innerHTML = `<option value="">Crie uma turma primeiro</option>`;
      sel.disabled = true;
      return;
    }

    sel.disabled = false;
    for (const c of data) {
      const opt = document.createElement("option");
      opt.value = c.id;
      opt.textContent = `${c.name} • ${c.year}${c.shift ? " • " + c.shift : ""}`;
      sel.appendChild(opt);
    }
  }

  function setAttendanceDateToday() {
    const el = $("#attendanceDate");
    if (!el) return;
    if (el.value) return;

    const d = new Date();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    el.value = `${yyyy}-${mm}-${dd}`;
  }

  function statusErr(prefix, err) {
    const msg = `${prefix}${err?.message ? `: ${err.message}` : ""}${err?.code ? ` (code ${err.code})` : ""}`;
    console.error(msg, err);
    $("#attendanceStatus") && ($("#attendanceStatus").textContent = msg);
  }

  async function detectAttendanceSchema() {
    if (attendanceSchema.ready) return;

    // presença: is_absent ou present
    {
      const { error } = await supabase.from("attendance").select("is_absent").limit(1);
      if (!error) {
        attendanceSchema.presenceCol = "is_absent";
        attendanceSchema.presenceMode = "absent";
      } else {
        const { error: e2 } = await supabase.from("attendance").select("present").limit(1);
        if (!e2) {
          attendanceSchema.presenceCol = "present";
          attendanceSchema.presenceMode = "present";
        } else {
          // fallback
          attendanceSchema.presenceCol = "is_absent";
          attendanceSchema.presenceMode = "absent";
        }
      }
    }

    // ✅ data: prioriza lesson_date (porque é NOT NULL no seu banco)
    {
      const candidates = ["lesson_date", "date", "day", "attendance_date"];
      for (const c of candidates) {
        const { error } = await supabase.from("attendance").select(c).limit(1);
        if (!error) {
          attendanceSchema.dateCol = c;
          break;
        }
      }
      if (!attendanceSchema.dateCol) attendanceSchema.dateCol = "lesson_date";
    }

    // tenta filtrar por 'YYYY-MM-DD' para inferir modo
    {
      const test = "2000-01-01";
      const { error } = await supabase
        .from("attendance")
        .select("id")
        .eq(attendanceSchema.dateCol, test)
        .limit(1);

      const msg = String(error?.message || "").toLowerCase();
      if (error && (msg.includes("operator") || msg.includes("invalid input"))) {
        attendanceSchema.dateMode = "timestamptz";
      } else {
        attendanceSchema.dateMode = "date";
      }
    }

    attendanceSchema.ready = true;
    console.log("attendance schema detected:", { ...attendanceSchema });
  }

  function dayRange(dateStr) {
    const start = new Date(dateStr + "T00:00:00");
    const end = new Date(start);
    end.setDate(end.getDate() + 1);
    return { startIso: start.toISOString(), endIso: end.toISOString() };
  }

  function toAbsentFlag(row) {
    if (!row) return false;
    if (attendanceSchema.presenceMode === "absent") return !!row[attendanceSchema.presenceCol];
    return !row[attendanceSchema.presenceCol];
  }

  async function fetchAttendanceForDay(classId, dateStr) {
    await detectAttendanceSchema();

    let q = supabase
      .from("attendance")
      .select(`student_id, ${attendanceSchema.presenceCol}`)
      .eq("class_id", classId);

    if (attendanceSchema.dateMode === "date") {
      q = q.eq(attendanceSchema.dateCol, dateStr);
    } else {
      const { startIso, endIso } = dayRange(dateStr);
      q = q.gte(attendanceSchema.dateCol, startIso).lt(attendanceSchema.dateCol, endIso);
    }

    return await q;
  }

  async function fetchAttendanceTotals(classId) {
    await detectAttendanceSchema();
    return await supabase
      .from("attendance")
      .select(`student_id, ${attendanceSchema.presenceCol}`)
      .eq("class_id", classId);
  }

  async function loadAttendanceScreen() {
    const list = $("#attendanceList");
    if (!list) return;

    const user_id = await getUserId();
    if (!user_id) return alert("Sessão inválida. Faça login novamente.");

    const classId = $("#attendanceClassSelect")?.value;
    const date = $("#attendanceDate")?.value;

    if (!classId) return alert("Selecione uma turma.");
    if (!date) return alert("Selecione uma data.");

    $("#attendanceStatus") && ($("#attendanceStatus").textContent = "Carregando…");
    list.innerHTML = "";

    const { data: rosterIds, error: rErr } = await supabase
      .from("class_students")
      .select("student_id")
      .eq("class_id", classId);

    if (rErr) {
      statusErr("Erro ao carregar alunos (IDs)", rErr);
      list.innerHTML = `<div class="item"><div>Erro ao carregar alunos.</div></div>`;
      return;
    }

    const ids = (rosterIds || []).map(r => r.student_id).filter(Boolean);

    if (!ids.length) {
      $("#attendanceStatus") && ($("#attendanceStatus").textContent = "Nenhum aluno cadastrado nesta turma.");
      list.innerHTML = `<div class="item"><div>Nenhum aluno cadastrado nesta turma.</div></div>`;
      return;
    }

    const { data: studentsRows, error: sErr } = await supabase
      .from("students")
      .select("id, name")
      .in("id", ids)
      .order("name", { ascending: true });

    if (sErr) {
      statusErr("Erro ao carregar dados dos alunos", sErr);
      list.innerHTML = `<div class="item"><div>Erro ao carregar alunos.</div></div>`;
      return;
    }

    const students = (studentsRows || [])
      .map(s => ({ id: s.id, name: s.name || "Aluno" }))
      .sort((a, b) => a.name.localeCompare(b.name));

    const { data: todayRows, error: tErr } = await fetchAttendanceForDay(classId, date);
    if (tErr) {
      statusErr("Erro ao carregar chamada do dia", tErr);
      list.innerHTML = `<div class="item"><div>Erro ao carregar chamada do dia.</div></div>`;
      return;
    }

    const todayMap = new Map((todayRows || []).map(r => [r.student_id, toAbsentFlag(r)]));

    const { data: allRows, error: aErr } = await fetchAttendanceTotals(classId);
    if (aErr) {
      statusErr("Erro ao carregar totais de faltas", aErr);
      list.innerHTML = `<div class="item"><div>Erro ao carregar totais.</div></div>`;
      return;
    }

    const totals = new Map();
    for (const r of (allRows || [])) {
      if (!toAbsentFlag(r)) continue;
      totals.set(r.student_id, (totals.get(r.student_id) || 0) + 1);
    }

    list.innerHTML = "";
    for (const st of students) {
      const checked = todayMap.get(st.id) ? "checked" : "";
      const totalAbs = totals.get(st.id) || 0;

      const el = document.createElement("div");
      el.className = "item";
      el.innerHTML = `
        <div>
          <strong>${escapeHtml(st.name)}</strong>
          <div class="meta">Total de faltas: ${totalAbs}</div>
        </div>
        <label class="meta" style="display:flex; align-items:center; gap:10px; cursor:pointer; user-select:none;">
          <input type="checkbox" data-att-student="${st.id}" ${checked} />
          Faltou
        </label>
      `;
      list.appendChild(el);
    }

    $("#attendanceStatus") && ($("#attendanceStatus").textContent = `Carregado: ${students.length} aluno(s).`);
  }

  async function saveAttendance() {
    const user_id = await getUserId();
    if (!user_id) return alert("Sessão inválida. Faça login novamente.");

    const classId = $("#attendanceClassSelect")?.value;
    const date = $("#attendanceDate")?.value;
    if (!classId) return alert("Selecione uma turma.");
    if (!date) return alert("Selecione uma data.");

    const checks = $$("[data-att-student]");
    if (!checks.length) return alert("Carregue a chamada antes de salvar.");

    await detectAttendanceSchema();

    const rows = checks.map(cb => {
      const student_id = cb.getAttribute("data-att-student");
      const faltou = cb.checked;

      const row = {
        user_id,
        class_id: classId,
        student_id,
      };

      // ✅ grava na coluna correta (lesson_date)
      if (attendanceSchema.dateMode === "date") {
        row[attendanceSchema.dateCol] = date;
      } else {
        row[attendanceSchema.dateCol] = new Date(date + "T00:00:00").toISOString();
      }

      if (attendanceSchema.presenceMode === "absent") {
        row[attendanceSchema.presenceCol] = faltou;
      } else {
        row[attendanceSchema.presenceCol] = !faltou;
      }

      return row;
    });

    const onConflict = `student_id,class_id,${attendanceSchema.dateCol}`;

    const { error } = await supabase
      .from("attendance")
      .upsert(rows, { onConflict });

    if (error) {
      statusErr("Erro ao salvar chamada", error);
      alert(error.message || "Erro ao salvar chamada.");
      return;
    }

    $("#attendanceStatus") && ($("#attendanceStatus").textContent = "Chamada salva ✅");
    await loadAttendanceScreen();
  }

  // =====================
  // Consulta (mantida)
  // =====================
  async function refreshConsultation() {
    const now = new Date();
    const dow = now.getDay();

    $("#todayTitle") && ($("#todayTitle").textContent = `Hoje • ${DOW[dow]}`);

    const { data, error } = await supabase
      .from("class_schedule")
      .select("id, day_of_week, start_time, end_time, classes(id, name, year, shift), subjects(id, name)")
      .order("day_of_week", { ascending: true })
      .order("start_time", { ascending: true });

    if (error) {
      console.error("refreshConsultation:", error);
      return;
    }

    lastScheduleRows = data || [];

    const filtered = applyShiftFilter(lastScheduleRows);

    renderNextClass(filtered, now);
    renderToday(filtered, dow);
    renderWeek(filtered);
  }

  function applyShiftFilter(rows) {
    const v = ($("#shiftFilter")?.value || "all").toLowerCase();
    if (v === "all") return rows || [];

    return (rows || []).filter(r => {
      const shift = (r?.classes?.shift || "").trim().toLowerCase();

      if (v === "none") return !shift;
      const norm = normalizeShift(shift);
      const target = normalizeShift(v);
      return norm === target;
    });
  }

  function normalizeShift(s) {
    return (s || "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .trim();
  }

  function renderNextClass(rows, now) {
    const wrap = $("#nextClassCard");
    if (!wrap) return;

    const dow = now.getDay();
    const nowMin = now.getHours() * 60 + now.getMinutes();

    const todayUpcoming = (rows || [])
      .filter(r => r.day_of_week === dow)
      .map(r => ({ r, startMin: timeToMinutes(r.start_time) }))
      .filter(x => x.startMin > nowMin)
      .sort((a, b) => a.startMin - b.startMin);

    wrap.innerHTML = "";

    if (!todayUpcoming.length) {
      wrap.innerHTML = `<div class="item is-highlight"><div>Sem próximas aulas hoje (no filtro atual).</div></div>`;
      return;
    }

    const next = todayUpcoming[0].r;
    const cls = next.classes;
    const subj = next.subjects;

    const el = document.createElement("div");
    el.className = "item is-highlight";
    el.innerHTML = `
      <div>
        <strong>${escapeHtml(subj?.name || "Disciplina")}</strong>
        <div class="meta">
          ${escapeHtml(cls?.name || "Turma")} • ${fmtTime(next.start_time)}–${fmtTime(next.end_time)}
          ${cls?.shift ? " • " + escapeHtml(cls.shift) : ""}
        </div>
      </div>
      <div class="pill">próxima</div>
    `;
    wrap.appendChild(el);
  }

  function renderToday(rows, dow) {
    const wrap = $("#todayScheduleList");
    if (!wrap) return;

    const today = (rows || []).filter(r => r.day_of_week === dow);

    wrap.innerHTML = "";
    if (!today.length) {
      wrap.innerHTML = `<div class="item"><div>Nenhuma aula cadastrada para hoje (no filtro atual).</div></div>`;
      return;
    }

    for (const r of today) {
      const cls = r.classes;
      const subj = r.subjects;
      const el = document.createElement("div");
      el.className = "item";
      el.innerHTML = `
        <div>
          <strong>${escapeHtml(subj?.name || "Disciplina")}</strong>
          <div class="meta">
            ${escapeHtml(cls?.name || "Turma")} • ${fmtTime(r.start_time)}–${fmtTime(r.end_time)}
          </div>
        </div>
        <div class="meta">${cls?.shift ? escapeHtml(cls.shift) : ""}</div>
      `;
      wrap.appendChild(el);
    }
  }

  function renderWeek(rows) {
    const wrap = $("#weekSchedule");
    if (!wrap) return;

    wrap.innerHTML = "";

    const byDay = new Map();
    for (const r of (rows || [])) {
      if (!byDay.has(r.day_of_week)) byDay.set(r.day_of_week, []);
      byDay.get(r.day_of_week).push(r);
    }

    const order = [1, 2, 3, 4, 5, 6, 0];

    let hasAny = false;
    for (const day of order) {
      const dayRows = byDay.get(day) || [];
      if (!dayRows.length) continue;
      hasAny = true;

      const block = document.createElement("div");
      block.className = "item";
      block.style.flexDirection = "column";
      block.style.alignItems = "stretch";
      block.innerHTML = `<div style="font-weight:650; margin-bottom:8px;">${DOW[day]}</div>`;

      const list = document.createElement("div");
      list.className = "list";
      list.style.marginTop = "0";

      for (const r of dayRows) {
        const cls = r.classes;
        const subj = r.subjects;

        const item = document.createElement("div");
        item.className = "item";
        item.innerHTML = `
          <div>
            <strong>${escapeHtml(subj?.name || "Disciplina")}</strong>
            <div class="meta">
              ${escapeHtml(cls?.name || "Turma")} • ${fmtTime(r.start_time)}–${fmtTime(r.end_time)}
            </div>
          </div>
          <div class="meta">${cls?.shift ? escapeHtml(cls.shift) : ""}</div>
        `;
        list.appendChild(item);
      }

      block.appendChild(list);
      wrap.appendChild(block);
    }

    if (!hasAny) {
      wrap.innerHTML = `<div class="item"><div>Cadastre horários em Configuração para ver sua semana aqui (no filtro atual).</div></div>`;
    }
  }

  function printWeek() { window.print?.(); }

  function escapeHtml(str) {
    return String(str)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function fmtTime(t) {
    const s = String(t || "");
    return s.length >= 5 ? s.slice(0, 5) : s;
  }

  function timeToMinutes(t) {
    const s = fmtTime(t);
    const [hh, mm] = s.split(":").map(Number);
    if (Number.isNaN(hh) || Number.isNaN(mm)) return 0;
    return hh * 60 + mm;
  }

  bootstrap();
})();
