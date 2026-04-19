# 📚 Guia Didático do Planner Pedagógico

## Estrutura do Projeto

```
Planner Pedagogico
├── index.html                 # Página principal com todas as abas
├── js/
│   ├── app.js                # Lógica principal (COMENTADO)
│   ├── storage.js            # Banco de dados localStorage (COMENTADO)
│   └── theme.js              # Gerenciador de tema claro/escuro (COMENTADO)
├── css/
│   └── style.css             # Estilos da aplicação
├── assets/                   # Ícones e assets
└── planning/                 # Página secundária (plano de aula)
    ├── index.html
    ├── script.js             # Lógica do planejamento
    └── styles.css
```

---

## 📦 storage.js — Banco de Dados Local

### O que faz?
Gerencia TODOS os dados da aplicação usando `localStorage` do navegador. Não precisa de internet ou servidor!

### Estrutura de Dados

```javascript
{
  subjects: [              // 📚 Disciplinas (Matemática, Português, etc)
    { id, name, created_at }
  ],
  classes: [               // 🎓 Turmas (3ºA, 6º Ano B, etc)
    { id, name, year, shift, created_at }
  ],
  class_subjects: [        // 🔗 Vinculação: qual disciplina em qual turma
    { id, class_id, subject_id, weekly_classes, created_at }
  ],
  class_schedule: [        // ⏰ Horários das aulas
    { id, class_id, subject_id, day_of_week, start_time, end_time, created_at }
  ],
  students: [              // 👤 Alunos cadastrados
    { id, name, created_at }
  ],
  class_students: [        // Vinculação: qual aluno em qual turma
    { id, class_id, student_id, created_at }
  ],
  attendance: [            // 📋 Registro de presença/falta
    { id, class_id, student_id, lesson_date, is_absent, created_at }
  ],
  lesson_plans: [          // 📝 Planejamentos de aula
    { id, class_id, subject_id, bncc, content, date, created_at }
  ],
  assessments: [           // 📊 Avaliações
    { id, class_id, subject_id, name, max_score, created_at }
  ],
  grades: [                // 📈 Notas dos alunos
    { id, assessment_id, student_id, grade, created_at }
  ]
}
```

### Funções Principais

| Função | O que faz |
|--------|-----------|
| `load()` | Carrega dados do localStorage |
| `save(db)` | Salva dados no localStorage |
| `uid()` | Gera ID único para cada registro |
| `addSubject(name)` | Cria disciplina |
| `addClass({name, year, shift})` | Cria turma |
| `linkSubject({class_id, subject_id})` | Vincula disciplina à turma |
| `addSchedule({...})` | Cria horário de aula |
| `addStudent(class_id, name)` | Adiciona aluno à turma |
| `saveAttendance(...)` | Registra presença/falta |

---

## 🎨 theme.js — Tema Escuro/Claro

### O que faz?
Alterna entre modo claro (☀️) e escuro (🌙) com persistência.

### Como funciona?

```javascript
// 1. Detecta preferência do usuário (salva ou SO)
const saved = localStorage.getItem(KEY);
if (saved) {
  apply(saved);  // Usa preferência salva
} else {
  const prefersLight = matchMedia("(prefers-color-scheme: light)").matches;
  apply(prefersLight ? "light" : "dark");  // Usa preferência do SO
}

// 2. Aplica tema
function apply(theme) {
  root.dataset.theme = theme;  // CSS lê isso: html[data-theme="dark"]
  localStorage.setItem(KEY, theme);  // Salva escolha
  btn.textContent = theme === "light" ? "🌞" : "🌙";  // Atualiza ícone
}

// 3. Ouve clique no botão
btn.addEventListener('click', () => {
  const next = theme === "light" ? "dark" : "light";
  apply(next);  // Alterna
});
```

---

## 🎯 app.js — Lógica Principal

### Estrutura em Seções

```
app.js
├── Helpers Globais (esc, fmtTime, fmtDate, timeToMinutes, todayISO, fillSelect)
├── Funções de Modal (openModal, closeModal)
├── Abas (initTabs)
├── 📚 DISCIPLINAS (loadSubjects, syncSubjectSelects)
├── 🎓 TURMAS (loadClasses, openClass, closeClassDetail)
├── 🔗 TURMA-DISCIPLINA (loadClassSubjects, linkSubject)
├── ⏰ HORÁRIOS (loadClassSchedule, addSchedule)
├── 👤 ALUNOS (loadClassStudents, addStudent)
├── 📋 CHAMADA (loadAttendanceScreen, saveAttendance)
├── 👀 CONSULTA SEMANAL (refreshConsultation, renderToday, renderWeek)
├── 📝 PLANEJAMENTO (renderPlans, openViewPlanModal, exportPlanToPdf)
├── 📊 AVALIAÇÕES (renderAssessments, openGradeModal, exportReportToPdf)
└── 🎬 INIT (inicializa tudo)
```

### Padrão CRUD (Create, Read, Update, Delete)

Todas as seções seguem este padrão:

```javascript
// 1️⃣ READ — Busca dados e renderiza
function loadXXX() {
  const data = DB.getXXX();  // Busca do BD
  const wrap = $('#wrapper');
  wrap.innerHTML = '';
  
  for (const item of data) {
    // Cria elemento HTML para cada item
    const el = document.createElement('div');
    el.innerHTML = `<p>${item.name}</p>`;
    wrap.appendChild(el);
  }
}

// 2️⃣ CREATE — Cria novo registro
$('#createForm').addEventListener('submit', e => {
  e.preventDefault();
  const name = $('#name').value;
  if (!name) return alert('Preencha o nome');
  DB.addXXX(name);  // Salva no BD
  $('#createForm').reset();
  loadXXX();  // Atualiza lista
});

// 3️⃣ UPDATE — Edita registro
btn.addEventListener('click', () => {
  DB.updateXXX(id, newData);
  loadXXX();
});

// 4️⃣ DELETE — Deleta registro
btn.addEventListener('click', () => {
  if (!confirm('Excluir?')) return;
  DB.deleteXXX(id);
  loadXXX();
});
```

### Fluxo: Do formulário ao Banco de Dados

```
Usuário preenche formulário
  ↓
addEventListener('submit') captura
  ↓
Valida dados (nome vazio?, valores válidos?)
  ↓
Chama DB.add/update/delete (storage.js)
  ↓
Storage atualiza localStorage
  ↓
Limpa formulário
  ↓
Chama load/render para atualizar interface
```

### Exemplo Completo: Adicionar Disciplina

```javascript
// 1. HTML tem <form id="subjectCreateForm">
//    com <input id="subjectName">

// 2. JavaScript ouve submit
$('#subjectCreateForm')?.addEventListener('submit', e => {
  e.preventDefault();
  const name = $('#subjectName')?.value.trim();
  if (!name) return;  // Validação
  
  DB.addSubject(name);  // Grava no localStorage
  $('#subjectCreateForm').reset();  // Limpa campo
  loadSubjects();  // Atualiza lista na tela
});

// 3. DB.addSubject faz:
function addSubject(name) {
  const db = load();  // Lê localStorage
  db.subjects = db.subjects || [];
  const rec = { 
    id: uid(),                               // Gera ID único
    name, 
    created_at: new Date().toISOString()
  };
  db.subjects.push(rec);  // Adiciona à lista
  save(db);  // Grava de volta no localStorage
  return rec;
}

// 4. loadSubjects atualiza a interface
function loadSubjects() {
  const data = DB.getSubjects();  // Busca do localStorage
  const list = $('#subjectsList');
  list.innerHTML = '';
  for (const s of data) {
    // Cria elemento para cada disciplina
    const el = document.createElement('div');
    el.className = 'item';
    el.innerHTML = `
      <strong>${esc(s.name)}</strong>
      <button data-del-subject="${s.id}">Excluir</button>
    `;
    list.appendChild(el);
  }
}
```

---

## 📊 Fluxo de Dados (Data Flow)

### Do usuário até a tela:

```
Usuário interagua (click, submit, input)
         ↓
addEventListener dispara
         ↓
JavaScript valida dados
         ↓
Chama DB.funcao() → storage.js
         ↓
storage.js: load() → modifica → save()
         ↓
Atualiza localStorage do navegador
         ↓
Chama render/load() para atualizar DOM
         ↓
DOM atualizado aparece na tela
```

### localStorage:

```
localStorage['plannerDB_v1'] = {
  "subjects": [...],
  "classes": [...],
  ...
}
```

---

## 🎓 Conceitos Importantes

### IIFE (Immediately Invoked Function Expression)

```javascript
// storage.js e theme.js usam IIFE
const DB = (() => {
  // Tudo aqui é privado
  const KEY = 'plannerDB_v1';
  
  function load() { ... }
  function save() { ... }
  
  // Apenas essas funções são expostas
  return {
    getSubjects,
    addSubject,
    deleteSubject,
    // ...
  };
})();

// Uso:
DB.getSubjects();  // ✅ Funciona (público)
DB.load();         // ❌ Erro: load é privado
```

**Por quê?** Protege dados de acesso acidental e evita conflitos de nomes.

### Escaping XSS

```javascript
// ❌ Perigoso (XSS - injeção de código):
div.innerHTML = userInput;  // Se userInput = "<script>alert(1)</script>"

// ✅ Seguro:
div.innerHTML = esc(userInput);  // Converte para &lt;script&gt;...
```

### Array Methods Usadas

```javascript
// filter: seleciona alguns itens
array.filter(item => item.active);

// map: transforma cada item
array.map(item => ({ ...item, name: item.name.toUpperCase() }));

// find: primeiro item que combina
array.find(item => item.id === myId);

// sort: ordena
array.sort((a, b) => a.name.localeCompare(b.name));

// forEach: itera
array.forEach(item => console.log(item));

// Exemplo combinado (usado em storage.js):
data
  .filter(cs => cs.class_id === classId)
  .map(cs => ({ ...cs, subjects: findSubject(cs.subject_id) }))
  .sort((a,b) => a.created_at.localeCompare(b.created_at));
```

---

## 🔍 Como Debugar

### 1. Abra o Console (F12 ou Dev Tools)

```javascript
// Ver todos os dados
console.log(JSON.parse(localStorage.getItem('plannerDB_v1')));

// Ou use:
DB  // Mostra o objeto com todas as funções
```

### 2. Teste Funções

```javascript
// No console, teste:
DB.getSubjects();           // Retorna array
DB.addSubject('Teste');      // Cria e retorna
DB.getClasses();             // Vê turmas
```

### 3. Limpe localStorage (reset)

```javascript
// Para começar do zero:
localStorage.removeItem('plannerDB_v1');
location.reload();  // Recarrega página
```

---

## ⚙️ Fluxo de Inicialização

Quando a página carrega:

```
1. HTML carrega (DOM criado)
   ↓
2. Scripts carregam:
   - storage.js (cria DB)
   - theme.js (inicializa tema)
   - app.js (espera DOMContentLoaded)
   ↓
3. DOMContentLoaded dispara
   ↓
4. initTabs() ativa abas
5. loadSubjects() carrega disciplinas
6. loadClasses() carrega turmas
7. refreshConsultation() mostra próximas aulas
8. populateAttendanceClassSelect() preenche select
9. setAttendanceDateToday() define data
   ↓
10. Pronto! Tudo aparece na tela
```

---

## 📝 Resumo das Funções Principais

### storage.js (Banco de Dados)

```javascript
DB.getSubjects()               // Retorna todas as disciplinas
DB.addSubject(name)            // Cria disciplina
DB.deleteSubject(id)           // Deleta disciplina

DB.getClasses()                // Retorna todas as turmas
DB.getClass(id)                // Busca turma específica
DB.addClass({name, year})      // Cria turma
DB.deleteClass(id)             // Deleta turma

DB.getClassSchedule(classId)   // Horários de uma turma
DB.addSchedule({...})          // Cria horário
DB.getAllSchedule()            // Todos os horários

DB.getClassStudents(classId)   // Alunos de uma turma
DB.addStudent(classId, name)   // Adiciona aluno
DB.removeStudentFromClass(id)  // Remove aluno

DB.getAttendanceForDay(...)    // Chamada de um dia
DB.saveAttendance(...)         // Salva chamada

DB.getLessonPlans()            // Planejamentos
DB.addLessonPlan({...})        // Cria planejamento

DB.getAssessments()            // Avaliações
DB.addAssessment({...})        // Cria avaliação

DB.getGrades(assessmentId)     // Notas de uma avaliação
DB.saveGrades(...)             // Salva notas
```

---

## 🚀 Como Estender (Adicionar Features)

### Exemplo: Adicionar campo "Email" a um aluno

#### Passo 1: Modificar storage.js

```javascript
function addStudent(class_id, name, email) {  // ← Adiciona email
  const db = load();
  db.students = db.students || [];
  const student = { 
    id: uid(), 
    name, 
    email,              // ← Novo campo
    created_at: new Date().toISOString() 
  };
  // ...
}
```

#### Passo 2: Modificar HTML (index.html)

```html
<form id="studentCreateForm" class="form form-inline">
  <div class="field">
    <label for="studentName">Nome</label>
    <input id="studentName" placeholder="Ex.: Ana" required />
  </div>
  
  <!-- ↓ Adiciona campo email -->
  <div class="field">
    <label for="studentEmail">Email</label>
    <input id="studentEmail" type="email" placeholder="ana@example.com" />
  </div>
  
  <button class="btn-ghost" type="submit">Adicionar</button>
</form>
```

#### Passo 3: Modificar app.js

```javascript
$('#studentCreateForm')?.addEventListener('submit', e => {
  e.preventDefault();
  if (!selectedClassId) return;
  const name = $('#studentName')?.value.trim();
  const email = $('#studentEmail')?.value.trim();  // ← Lê email
  if (!name) return;
  
  DB.addStudent(selectedClassId, name, email);  // ← Passa email
  $('#studentCreateForm').reset();
  loadClassStudents(selectedClassId);  // ← Atualiza
});

// Também atualizar a exibição:
function loadClassStudents(classId) {
  const data = DB.getClassStudents(classId);
  const wrap = $('#classStudentsList');
  for (const row of data) {
    const st = row.students;
    const el = document.createElement('div');
    el.className = 'item';
    el.innerHTML = `
      <div>
        <strong>${esc(st.name)}</strong>
        <div class="meta">${esc(st.email || '')}</div>  <!-- ← Mostra email -->
      </div>
    `;
    wrap.appendChild(el);
  }
}
```

---

## 📚 Recursos para Aprender

### JavaScript Concepts Usados

- **Array Methods**: filter, map, find, sort, forEach, reduce
- **DOM Manipulation**: querySelector, createElement, appendChild, classList
- **Event Listeners**: addEventListener, preventDefault, stopPropagation
- **localStorage API**: getItem, setItem, removeItem
- **Template Literals**: `` `string ${variable}` ``
- **Object Destructuring**: `{ name, year } = obj`
- **Spread Operator**: `{ ...obj, newField: value }`
- **Async/Await**: (usado em planning/script.js para PDF)
- **IIFE**: Padrão de função auto-executável

### Melhorias Futuras

1. **Backend**: Substituir localStorage por banco de dados real (Node + MongoDB)
2. **Sincronização**: Sincronizar com servidor (Supabase)
3. **Offline-First**: PWA com Service Workers
4. **Validação**: Adicionar mais validações de dados
5. **Testes**: Testes automatizados (Jest, Vitest)
6. **Temas**: Sistema de temas mais flexível
7. **Relatórios**: Mais tipos de relatórios e gráficos

---

## 🎉 Conclusão

O Planner Pedagógico é uma aplicação **client-side pura** que:

✅ Não precisa de internet (offline-first)  
✅ Dados salvos no navegador do usuário  
✅ Interface responsiva e intuitiva  
✅ CRUD completo para gestão pedagógica  
✅ Relatórios em PDF  

Estrutura didática para aprender JavaScript real!

---

Última atualização: 2026-04-19
Comentários adicionados em: storage.js, theme.js, app.js (parcial)
