import { SUPABASE_URL, SUPABASE_KEY, WORK_TARGET_MINUTES, WORK_DAYS, MINIMUM_MINUTES } from './config.js';

const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

/* =====================================================================
   Helpers
   ===================================================================== */
const $ = (sel, root = document) => root.querySelector(sel);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const pad = (n) => String(n).padStart(2, '0');
const ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const today = () => ymd(new Date());
const parseYmd = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
const addDays = (s, n) => { const d = parseYmd(s); d.setDate(d.getDate() + n); return ymd(d); };
const isoWeekday = (s) => ((parseYmd(s).getDay() + 6) % 7) + 1; // 1 = Monday … 7 = Sunday
const weekStart = (s) => addDays(s, 1 - isoWeekday(s));
const DAY = ['', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const DAY_LONG = ['', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const fmtLong = (s) => parseYmd(s).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });
const fmtShort = (s) => parseYmd(s).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
const fmtMins = (m) => { m = Math.round(m || 0); const h = Math.floor(m / 60), r = m % 60; return h ? (r ? `${h}h ${r}m` : `${h}h`) : `${r}m`; };
const fmtTime = (t) => { const [h, m] = t.split(':').map(Number); const ap = h >= 12 ? 'pm' : 'am'; const hh = h % 12 || 12; return m ? `${hh}.${pad(m)}${ap}` : `${hh}${ap}`; };
const relDay = (s) => {
  const t = today();
  if (s === t) return 'Today';
  if (s === addDays(t, 1)) return 'Tomorrow';
  if (s === addDays(t, -1)) return 'Yesterday';
  const diff = (parseYmd(s) - parseYmd(t)) / 864e5;
  if (diff > 0 && diff < 7) return DAY_LONG[isoWeekday(s)];
  return fmtShort(s);
};
const AREAS = ['personal', 'house', 'admin', 'money', 'freelance', 'gym'];
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
const store = {
  get(k) { try { return JSON.parse(localStorage.getItem('daybook.' + k)); } catch { return null; } },
  set(k, v) { try { v == null ? localStorage.removeItem('daybook.' + k) : localStorage.setItem('daybook.' + k, JSON.stringify(v)); } catch { /* private mode */ } },
};

const ICONS = {
  today: '<circle cx="12" cy="12" r="8.5"/><path d="M8.5 12.5l2.5 2.5 4.5-5"/>',
  gym: '<path d="M6 7v10M18 7v10M3 10v4M21 10v4M6 12h12"/>',
  money: '<rect x="3" y="6" width="18" height="13" rx="2"/><path d="M3 10h18M16 14.5h2"/>',
  work: '<path d="M3 9.5A2.5 2.5 0 015.5 7h13A2.5 2.5 0 0121 9.5v4a2.5 2.5 0 01-2.5 2.5H15l-3-2.5L9 16H5.5A2.5 2.5 0 013 13.5z"/>',
  tasks: '<path d="M10 6h10M10 12h10M10 18h10M4 6l1.2 1.2L7.5 5M4 12l1.2 1.2L7.5 11M4 18l1.2 1.2L7.5 17"/>',
  review: '<path d="M3 20h18M6 16v-5M11 16V6M16 16v-8M20 16v-3"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  close: '<path d="M6 6l12 12M18 6L6 18"/>',
  snooze: '<path d="M5 12h12M13 7l5 5-5 5"/>',
  trash: '<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 20c1.5-4 4.5-6 8-6s6.5 2 8 6"/>',
};
const icon = (name, size = 22) => `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name]}</svg>`;

/* =====================================================================
   State & data
   ===================================================================== */
const S = {
  user: null, loadedAt: 0,
  tasks: [], habits: [], logs: [], sessions: [], daysOff: [], goals: [], milestones: [], reminders: [],
  openGoals: new Set(), taskArea: 'all', showDone: false,
};

async function q(p) { const { data, error } = await p; if (error) throw error; return data; }
const insert = (table, row) => q(sb.from(table).insert(row).select().single());
const update = (table, id, patch) => q(sb.from(table).update(patch).eq('id', id).select().single());
const remove = (table, id) => q(sb.from(table).delete().eq('id', id));
const replaceIn = (arr, row) => { const i = arr.findIndex((x) => x.id === row.id); if (i >= 0) arr[i] = row; else arr.push(row); };

async function loadAll() {
  const since = addDays(today(), -120);
  const doneSince = new Date(Date.now() - 14 * 864e5).toISOString();
  const [open, done, habits, logs, sessions, daysOff, goals, milestones, reminders] = await Promise.all([
    q(sb.from('tasks').select('*').eq('done', false).order('due_date', { ascending: true, nullsFirst: false }).order('created_at')),
    q(sb.from('tasks').select('*').eq('done', true).gte('done_at', doneSince).order('done_at', { ascending: false })),
    q(sb.from('habits').select('*').eq('active', true).order('sort_order').order('created_at')),
    q(sb.from('habit_logs').select('*').gte('log_date', since)),
    q(sb.from('work_sessions').select('*').gte('session_on', since).order('session_on', { ascending: false }).order('created_at', { ascending: false })),
    q(sb.from('days_off').select('*').gte('off_date', since).order('off_date')),
    q(sb.from('goals').select('*').neq('status', 'dropped').order('created_at')),
    q(sb.from('milestones').select('*').order('sort_order').order('title')),
    q(sb.from('reminders').select('*').eq('active', true).order('remind_at')),
  ]);
  Object.assign(S, { tasks: [...open, ...done], habits, logs, sessions, daysOff, goals, milestones, reminders, loadedAt: Date.now() });
}

// First login: add the routine reminders and the freelance roadmap.
async function seedIfNew() {
  if (S.reminders.length || S.goals.length || S.habits.length || S.tasks.length || S.sessions.length) return;
  await q(sb.from('reminders').insert([
    { title: 'Home, change, then 1 hour at the PC before tea', weekday: 1, remind_at: '18:15' },
    { title: 'Weekly build block, 3–5pm', weekday: 6, remind_at: '14:55' },
  ]));
  const g = await insert('goals', { title: 'First paid VR job', area: 'freelance' });
  const steps = ['Case study 1', 'Case study 2', 'Case study 3', 'Rebuild portfolio', 'Post a demo on LinkedIn', 'Contact past Unity client', 'Book first paid job', 'Buy a headset (only once a job is booked)'];
  await q(sb.from('milestones').insert(steps.map((title, i) => ({ goal_id: g.id, title, sort_order: i }))));
  await loadAll();
}

/* =====================================================================
   Derived data
   ===================================================================== */
const habitDone = (hid, d) => S.logs.some((l) => l.habit_id === hid && l.log_date === d);
const weekMinutes = () => { const ws = weekStart(today()); return S.sessions.filter((s) => s.session_on >= ws && s.session_on <= today()).reduce((a, s) => a + s.minutes, 0); };
const latestNextStep = () => S.sessions.find((s) => s.next_step && s.next_step.trim())?.next_step || null;
// Sessions before you started using Daybook don't count as misses.
const startDate = () => (S.user?.created_at ? ymd(new Date(S.user.created_at)) : today());
const nextSlotAfter = (d) => { let x = addDays(d, 1); for (let i = 0; i < 8 && !WORK_DAYS.includes(isoWeekday(x)); i++) x = addDays(x, 1); return x; };

// A planned session (Mon/Sat) is covered by any session logged before the next planned day.
function slotStatus(slot) {
  const end = addDays(nextSlotAfter(slot), -1);
  const ss = S.sessions.filter((s) => s.session_on >= slot && s.session_on <= end);
  if (ss.length) return ss.some((s) => s.kind !== 'minimum') ? 'full' : 'minimum';
  if (S.daysOff.some((o) => o.off_date === slot)) return 'away';
  if (end >= today()) return 'pending';
  if (slot < startDate()) return 'before';
  return 'missed';
}
function recentSlots(n = 8) {
  const out = []; let d = today();
  for (let i = 0; out.length < n && i < 80; i++, d = addDays(d, -1)) if (WORK_DAYS.includes(isoWeekday(d))) out.push(d);
  return out.reverse().map((slot) => ({ slot, status: slotStatus(slot) }));
}
function currentSlot() { const s = recentSlots(1)[0]; return s || null; }
function missWarning() {
  const past = recentSlots(3).filter((s) => s.status !== 'pending' && s.status !== 'before');
  const last = past[past.length - 1];
  if (!last || last.status !== 'missed') return null;
  const prev = past[past.length - 2];
  if (prev && prev.status === 'missed') return `Two missed in a row. Reset with just ${MINIMUM_MINUTES} minutes — that counts.`;
  return `You missed ${DAY_LONG[isoWeekday(last.slot)]}. Never miss twice — even ${MINIMUM_MINUTES} minutes keeps the chain.`;
}

/* =====================================================================
   Rendering
   ===================================================================== */
const ROUTES = [
  ['today', 'Today'], ['gym', 'Gym'], ['money', 'Money'], ['work', 'Work'], ['tasks', 'Tasks'], ['review', 'Review'],
];
const route = () => (location.hash.replace(/^#\/?/, '') || 'today').split('?')[0];

function renderShell() {
  $('#app').innerHTML = `
    <div class="shell">
      <nav class="tabs" aria-label="Main">
        <div class="brand">Daybook</div>
        ${ROUTES.map(([r, label]) => `<a href="#/${r}" data-route="${r}">${icon(r)}<span>${label}</span></a>`).join('')}
        <a href="#" class="side-only" data-act="account">${icon('user')}<span>Account</span></a>
      </nav>
      <main class="view" id="view" tabindex="-1"></main>
      <button type="button" class="fab" data-act="quick-add" aria-label="Quick add">${icon('plus', 24)}</button>
    </div>`;
}

let timerTick = null;
function render() {
  if (!S.user) return;
  const r = ROUTES.some(([k]) => k === route()) ? route() : 'today';
  document.querySelectorAll('nav.tabs a[data-route]').forEach((a) => { if (a.dataset.route === r) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); });
  const view = $('#view');
  view.innerHTML = VIEWS[r]();
  document.title = `${ROUTES.find(([k]) => k === r)[1]} · Daybook`;
  $('.fab').hidden = !['today', 'tasks', 'work'].includes(r);
  clearInterval(timerTick);
  if ($('#timer-elapsed')) { tickTimer(); timerTick = setInterval(tickTimer, 1000); }
}

function head(eyebrow, title, extra = '') {
  return `<header class="view-head"><div><div class="eyebrow">${eyebrow}</div><h1>${title}</h1></div>${extra}</header>`;
}
const avatarBtn = () => `<button type="button" class="avatar" data-act="account" aria-label="Account">${esc((S.user.email || '?')[0].toUpperCase())}</button>`;

function taskRow(t, { showDate = true } = {}) {
  const overdue = !t.done && t.due_date && t.due_date < today();
  const sub = [];
  if (showDate && t.due_date) sub.push(overdue ? `<span class="sub alert">Was due ${esc(relDay(t.due_date).toLowerCase() === 'yesterday' ? 'yesterday' : relDay(t.due_date))}</span>` : `<span class="sub">${esc(relDay(t.due_date))}</span>`);
  if (t.times_moved >= 2 && !t.done) sub.push(`<span class="sub alert">Moved ${t.times_moved}×</span>`);
  return `
    <div class="row ${t.done ? 'done' : ''}">
      <label class="check-wrap"><input type="checkbox" class="check" data-change="task-done" data-id="${t.id}" ${t.done ? 'checked' : ''} aria-label="Done: ${esc(t.title)}"></label>
      <button type="button" class="title-btn" data-act="edit-task" data-id="${t.id}"><span class="title">${esc(t.title)}</span>${sub.join('')}</button>
      ${t.area !== 'personal' ? `<span class="chip ${esc(t.area)}">${esc(cap(t.area))}</span>` : ''}
      ${!t.done ? `<button type="button" class="icon-btn" data-act="snooze" data-id="${t.id}" aria-label="Move to tomorrow" title="Move to tomorrow">${icon('snooze', 20)}</button>` : ''}
    </div>`;
}

function habitsCard() {
  const t = today();
  const done = S.habits.filter((h) => habitDone(h.id, t)).length;
  const suggestions = ['Water 2L', 'Read 20 min', 'Stretch', 'No takeaway', '10k steps'].filter((s) => !S.habits.some((h) => h.title === s));
  return `
    <section class="card" aria-label="Habits">
      <div class="card-head"><h2>Today's habits</h2><span class="meta">${S.habits.length ? `${done} of ${S.habits.length}` : ''} <button type="button" class="btn link" data-act="manage-habits">Edit</button></span></div>
      ${S.habits.length ? `<div class="habit-grid">${S.habits.map((h) => {
        const on = habitDone(h.id, t);
        return `<button type="button" class="habit" aria-pressed="${on}" data-act="toggle-habit" data-id="${h.id}">${esc(h.title)}${on ? ' ✓' : ''}</button>`;
      }).join('')}</div>` : `<p class="empty">No habits yet. Tap one to add it, or choose Edit to write your own.</p>
        <div class="suggest">${suggestions.map((s) => `<button type="button" class="btn small" data-act="add-habit-suggest" data-title="${esc(s)}">+ ${esc(s)}</button>`).join('')}</div>`}
    </section>`;
}

function timerCard() {
  const tm = store.get('timer');
  if (!tm) return '';
  return `
    <section class="card dark" aria-label="Session running">
      <div class="card-head"><h2>Freelance session running</h2><span class="meta">since ${new Date(tm.start).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</span></div>
      <div class="timer" id="timer-elapsed">0:00</div>
      <div class="btn-row"><button type="button" class="btn primary grow" data-act="stop-timer">Stop &amp; log</button><button type="button" class="btn small" style="background:transparent;color:#FFFDF8;border-color:#5E5A52" data-act="discard-timer">Discard</button></div>
    </section>`;
}
function tickTimer() {
  const tm = store.get('timer'); const el = $('#timer-elapsed');
  if (!tm || !el) return;
  const s = Math.max(0, Math.floor((Date.now() - tm.start) / 1000));
  el.textContent = `${Math.floor(s / 3600)}:${pad(Math.floor((s % 3600) / 60))}:${pad(s % 60)}`;
}

function nextStepSticky(label = 'Next step · from last session') {
  const ns = latestNextStep();
  if (!ns) return '';
  return `<section class="sticky" aria-label="Next step"><span class="lbl">${esc(label)}</span><span class="txt">${esc(ns)}</span></section>`;
}

/* ---------- Today ---------- */
function viewToday() {
  const t = today();
  const hour = new Date().getHours();
  const greet = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
  const due = S.tasks.filter((x) => !x.done && x.due_date && x.due_date <= t);
  const doneToday = S.tasks.filter((x) => x.done && x.done_at && ymd(new Date(x.done_at)) === t && x.due_date && x.due_date <= t);
  const list = [...due.sort((a, b) => a.due_date.localeCompare(b.due_date)), ...doneToday];
  const mins = weekMinutes();
  const habitsDone = S.habits.filter((h) => habitDone(h.id, t)).length;
  const rems = S.reminders.filter((r) => r.weekday === isoWeekday(t));
  const cur = currentSlot();
  const warn = missWarning();
  const running = !!store.get('timer');

  const workCard = running ? timerCard() : (cur && cur.status === 'pending') ? `
    <section class="card soft" aria-label="Freelance">
      <div class="card-head"><h2>${cur.slot === t ? 'Build session today' : `${DAY_LONG[isoWeekday(cur.slot)]}'s session is still open`}</h2><span class="meta" style="color:var(--green-deep);white-space:nowrap">${fmtMins(mins)} / ${fmtMins(WORK_TARGET_MINUTES)}</span></div>
      ${latestNextStep() ? `<div style="font-size:15px;font-weight:500">Next step: ${esc(latestNextStep())}</div>` : ''}
      <div class="btn-row"><button type="button" class="btn primary grow" data-act="start-timer">Start session</button><button type="button" class="btn small" data-act="log-minimum">Bad day · ${MINIMUM_MINUTES} min</button></div>
    </section>` : '';

  return `
    ${head(fmtLong(t), greet, avatarBtn())}
    ${rems.map((r) => `<div class="card warn" role="note"><div style="font-size:14px"><b>${fmtTime(r.remind_at)}</b> · ${esc(r.title)}</div></div>`).join('')}
    ${warn && !running ? `<div class="card warn" role="note"><div style="font-size:14px">${esc(warn)}</div></div>` : ''}
    <section class="tiles" aria-label="At a glance">
      <a class="tile" href="#/work"><span class="k">Freelance</span><span class="v">${fmtMins(mins)}</span><span class="s">of ${fmtMins(WORK_TARGET_MINUTES)} this week</span></a>
      <a class="tile" href="#/tasks"><span class="k">Due</span><span class="v">${due.length}</span><span class="s">${due.length === 1 ? 'task' : 'tasks'} today</span></a>
      <div class="tile"><span class="k">Habits</span><span class="v">${habitsDone} / ${S.habits.length}</span><span class="s">done today</span></div>
    </section>
    <div class="desk-grid">
      <div class="col">
        ${workCard}
        <section class="card" aria-label="Due today">
          <div class="card-head"><h2>Due today</h2><span class="meta">${list.length ? `${doneToday.length} of ${list.length} done` : ''}</span></div>
          ${list.length ? `<div class="list">${list.map((x) => taskRow(x, { showDate: x.due_date < t })).join('')}</div>` : `<p class="empty">Nothing due. Add a task with the + button.</p>`}
          <a class="btn link" href="#/tasks" style="align-self:flex-start">All tasks →</a>
        </section>
      </div>
      <div class="col">
        ${habitsCard()}
        ${!workCard && latestNextStep() ? nextStepSticky('Freelance · next step') : ''}
      </div>
    </div>`;
}

/* ---------- Tasks ---------- */
function viewTasks() {
  const t = today();
  const area = S.taskArea;
  const open = S.tasks.filter((x) => !x.done && (area === 'all' || x.area === area));
  const groups = [
    ['Overdue', open.filter((x) => x.due_date && x.due_date < t), true],
    ['Today', open.filter((x) => x.due_date === t)],
    ['Tomorrow', open.filter((x) => x.due_date === addDays(t, 1))],
    ['Next 7 days', open.filter((x) => x.due_date > addDays(t, 1) && x.due_date <= addDays(t, 7))],
    ['Later', open.filter((x) => x.due_date > addDays(t, 7))],
    ['No date', open.filter((x) => !x.due_date)],
  ].filter(([, items]) => items.length);
  const done = S.tasks.filter((x) => x.done && (area === 'all' || x.area === area));
  const goals = S.goals.filter((g) => g.status === 'active' && g.area !== 'freelance');
  const overdueCount = open.filter((x) => x.due_date && x.due_date < t).length;

  return `
    ${head(`${open.length} open${overdueCount ? ` · ${overdueCount} overdue` : ''}`, 'Tasks &amp; plans')}
    <form class="card" data-form="task" autocomplete="off">
      <label class="sr" for="new-task">New task</label>
      <div class="inline-add"><input id="new-task" name="title" class="input" placeholder="Add a task…" required maxlength="200"><button class="btn primary" type="submit">Add</button></div>
      <div class="form-grid">
        <label class="field"><span>Due</span><input type="date" name="due_date" class="input" value="${t}"></label>
        <label class="field"><span>Area</span><select name="area" class="input">${AREAS.map((a) => `<option value="${a}" ${a === (area === 'all' ? 'personal' : area) ? 'selected' : ''}>${cap(a)}</option>`).join('')}</select></label>
      </div>
    </form>
    <nav class="chips" aria-label="Filter by area">
      ${['all', ...AREAS].map((a) => `<a href="#/tasks" data-act="task-area" data-area="${a}" ${a === area ? 'aria-current="true"' : ''}>${cap(a)}</a>`).join('')}
    </nav>
    <div class="desk-grid">
      <div class="col">
        ${groups.length ? groups.map(([label, items, alert]) => `
          <h2 class="section-label ${alert ? 'alert' : ''}">${label}</h2>
          <section class="card" style="padding:0 16px;gap:0"><div class="list">${items.map((x) => taskRow(x, { showDate: label === 'Overdue' || label === 'Next 7 days' || label === 'Later' })).join('')}</div></section>`).join('')
          : `<section class="card"><p class="empty">No open tasks${area !== 'all' ? ` in ${cap(area)}` : ''}. Nice.</p></section>`}
        ${done.length ? `<button type="button" class="btn link" data-act="toggle-done" style="align-self:flex-start">${S.showDone ? 'Hide' : 'Show'} ${done.length} done recently</button>
          ${S.showDone ? `<section class="card" style="padding:0 16px;gap:0"><div class="list">${done.map((x) => taskRow(x)).join('')}</div></section>` : ''}` : ''}
      </div>
      <div class="col">
        <h2 class="section-label">Plans &amp; goals</h2>
        ${goals.map(goalCard).join('') || '<p class="empty">No goals yet. Add one below — something with a deadline works best.</p>'}
        <form class="card" data-form="goal" autocomplete="off">
          <div class="inline-add"><label class="sr" for="new-goal">New goal</label><input id="new-goal" name="title" class="input" placeholder="New goal, e.g. Run a half marathon" required maxlength="120"><button class="btn" type="submit">Add</button></div>
          <div class="form-grid">
            <label class="field"><span>Target date</span><input type="date" name="target_date" class="input"></label>
            <label class="field"><span>Area</span><select name="area" class="input">${AREAS.map((a) => `<option value="${a}">${cap(a)}</option>`).join('')}</select></label>
          </div>
        </form>
      </div>
    </div>`;
}

function goalCard(g) {
  const ms = S.milestones.filter((m) => m.goal_id === g.id);
  const n = ms.filter((m) => m.done).length;
  const pct = ms.length ? Math.round((n / ms.length) * 100) : 0;
  const next = ms.find((m) => !m.done);
  return `
    <details class="goal ${g.area === 'freelance' ? 'freelance' : ''}" data-goal="${g.id}" ${S.openGoals.has(g.id) ? 'open' : ''}>
      <summary>
        <span class="g-title"><b>${esc(g.title)}</b>${g.target_date ? `<span class="meta">${esc(fmtShort(g.target_date))}</span>` : ''}</span>
        <span class="bar" style="height:8px"><span style="width:${pct}%"></span></span>
        <span class="meta">${ms.length ? `${n} of ${ms.length} milestones${next ? ` · next: ${esc(next.title)}` : ' · all done!'}` : 'Tap to add milestones'}</span>
      </summary>
      <div class="body">
        <div class="list">${ms.map((m) => `
          <div class="row ${m.done ? 'done' : ''}">
            <label class="check-wrap"><input type="checkbox" class="check" data-change="milestone" data-id="${m.id}" ${m.done ? 'checked' : ''} aria-label="Done: ${esc(m.title)}"></label>
            <span class="grow"><span class="title">${esc(m.title)}</span></span>
            <button type="button" class="icon-btn" data-act="delete-milestone" data-id="${m.id}" aria-label="Delete milestone">${icon('close', 18)}</button>
          </div>`).join('')}</div>
        <form class="inline-add" data-form="milestone" data-goal="${g.id}" autocomplete="off">
          <label class="sr" for="ms-${g.id}">New milestone</label>
          <input id="ms-${g.id}" name="title" class="input" placeholder="Add a milestone…" required maxlength="160"><button class="btn small" type="submit">Add</button>
        </form>
        <div class="btn-row"><button type="button" class="btn small" data-act="goal-done" data-id="${g.id}">Mark goal achieved</button><button type="button" class="btn small danger" data-act="goal-drop" data-id="${g.id}">Delete</button></div>
      </div>
    </details>`;
}

/* ---------- Work (freelance) ---------- */
function viewWork() {
  const t = today();
  const mins = weekMinutes();
  const pct = Math.min(100, Math.round((mins / WORK_TARGET_MINUTES) * 100));
  const ws = weekStart(t);
  const thisWeek = S.sessions.filter((s) => s.session_on >= ws);
  const vol = thisWeek.filter((s) => s.kind === 'volunteer').reduce((a, s) => a + s.minutes, 0);
  const weekSlots = WORK_DAYS.map((wd) => addDays(ws, wd - 1));
  const slots = recentSlots(8);
  const warn = missWarning();
  const running = !!store.get('timer');
  const roadmap = S.goals.filter((g) => g.area === 'freelance' && g.status === 'active');
  const upcomingOff = S.daysOff.filter((o) => o.off_date >= t);
  const statusText = { full: ['Done', 'ok'], minimum: ['Minimum ✓', 'ok'], away: ['Away', ''], missed: ['Missed', 'due'], pending: ['To do', 'due'], before: ['—', ''] };

  return `
    ${head('VR · 360 · Unity', 'Freelance')}
    ${warn && !running ? `<div class="card warn" role="note"><div style="font-size:14px">${esc(warn)}</div></div>` : ''}
    <div class="desk-grid">
      <div class="col">
        <section class="card dark" aria-label="This week">
          <div class="card-head"><span class="meta">This week</span><span class="meta">Target ${fmtMins(WORK_TARGET_MINUTES)}</span></div>
          <div style="display:flex;align-items:baseline;gap:8px;flex-wrap:wrap"><span class="big">${fmtMins(mins)}</span>${vol ? `<span class="meta">incl. ${fmtMins(vol)} volunteer</span>` : ''}</div>
          <div class="bar"><span style="width:${pct}%"></span></div>
          <div class="week-slots">${weekSlots.map((d) => {
            const st = d > t ? ['Coming up', ''] : statusText[slotStatus(d)];
            return `<div><span>${DAY[isoWeekday(d)]} ${parseYmd(d).getDate()}</span><b class="${st[1]}">${d === t && slotStatus(d) === 'pending' ? 'Today' : st[0]}</b></div>`;
          }).join('')}</div>
        </section>
        ${running ? timerCard() : `
          ${nextStepSticky()}
          <div class="btn-row"><button type="button" class="btn primary grow" data-act="start-timer">Start session</button><button type="button" class="btn" data-act="log-minimum">Bad day · ${MINIMUM_MINUTES} min</button></div>
          <button type="button" class="btn link" data-act="log-session" style="align-self:flex-start">Log a past session or volunteer time</button>`}
        <section class="card" aria-label="Never miss twice">
          <div class="card-head"><h2>Never miss twice</h2><span class="meta">last ${slots.length} planned</span></div>
          <div class="slots">${slots.map(({ slot, status }) => `<div class="slot ${status}" title="${esc(fmtShort(slot))}: ${status}"><i></i>${DAY[isoWeekday(slot)]}<br>${parseYmd(slot).getDate()}</div>`).join('')}</div>
          <div class="legend"><span style="--c:var(--green)">Full</span><span style="--c:var(--mint)">${MINIMUM_MINUTES}-min</span><span style="--c:var(--amber)">Missed</span><span style="--c:transparent;--b:2px dashed #B9B09C">Away</span><span style="--c:transparent;--b:2px solid var(--green)">To do</span></div>
        </section>
      </div>
      <div class="col">
        <h2 class="section-label">Roadmap</h2>
        ${roadmap.map(goalCard).join('') || `<p class="empty">No freelance goals. Add one from Tasks → Plans &amp; goals with the area set to Freelance.</p>`}
        <section class="card" aria-label="Sessions this week">
          <div class="card-head"><h2>Sessions this week</h2><span class="meta">${thisWeek.length}</span></div>
          ${thisWeek.length ? `<div class="list">${thisWeek.map((s) => `
            <div class="row"><span class="grow"><span class="title">${esc(fmtMins(s.minutes))}${s.project ? ` · ${esc(s.project)}` : ''}</span><span class="sub">${esc(relDay(s.session_on))} · ${s.kind === 'minimum' ? 'Minimum' : s.kind === 'volunteer' ? 'Volunteer' : 'Full session'}</span></span>
            <button type="button" class="icon-btn" data-act="delete-session" data-id="${s.id}" aria-label="Delete session">${icon('trash', 18)}</button></div>`).join('')}</div>` : '<p class="empty">Nothing logged yet this week.</p>'}
        </section>
        <section class="card" aria-label="Planned days away">
          <div class="card-head"><h2>Days away</h2><button type="button" class="btn link" data-act="add-day-off">+ Plan a day away</button></div>
          ${upcomingOff.length ? `<div class="list">${upcomingOff.map((o) => `<div class="row"><span class="grow"><span class="title">${esc(fmtLong(o.off_date))}</span>${o.reason ? `<span class="sub">${esc(o.reason)}</span>` : ''}</span><button type="button" class="icon-btn" data-act="delete-day-off" data-id="${o.id}" aria-label="Remove">${icon('close', 18)}</button></div>`).join('')}</div>`
            : `<p class="empty">Weekends away that you plan here don't count as misses.</p>`}
        </section>
      </div>
    </div>`;
}

/* ---------- Coming soon ---------- */
const soon = (eyebrow, title, items) => () => `
  ${head(eyebrow, title)}
  <section class="card"><h2 style="font-size:16px">Coming in the next update</h2><ul class="soon">${items.map((i) => `<li>${i}</li>`).join('')}</ul></section>`;

const VIEWS = {
  today: viewToday,
  tasks: viewTasks,
  work: viewWork,
  gym: soon('Next update', 'Gym', ['Log sets, reps and weight as you go', 'See what you lifted last time', 'Sessions per week against your goal', 'Personal bests']),
  money: soon('Next update', 'Money', ['Monthly budget and what\'s left', 'Spending by category with overspend warnings', 'Quick add expense', 'Recurring bills']),
  review: soon('Next update', 'Weekly review', ['Your week scored: freelance hours, gym, tasks, habits', 'What slipped (tasks moved twice or more)', 'Three commitments for next week', 'Sunday summary email']),
};

/* =====================================================================
   Sheets (bottom-sheet dialogs)
   ===================================================================== */
const sheet = () => $('#sheet');
function openSheet(title, body) {
  sheet().innerHTML = `<div class="sheet-inner"><div class="sheet-head"><h2 id="sheet-title">${title}</h2><button type="button" class="icon-btn" data-act="close-sheet" aria-label="Close">${icon('close')}</button></div>${body}</div>`;
  if (!sheet().open) sheet().showModal();
  const first = sheet().querySelector('input:not([type=hidden]):not([type=radio]), textarea');
  if (first && window.matchMedia('(min-width: 640px)').matches) first.focus();
}
const closeSheet = () => sheet().open && sheet().close();

function sessionForm({ minutes = 60, kind = 'full', date = today(), title = 'Log session' } = {}) {
  const projects = [...new Set(S.sessions.map((s) => s.project).filter(Boolean))].slice(0, 12);
  openSheet(title, `
    <form data-form="session" autocomplete="off" style="display:flex;flex-direction:column;gap:14px">
      <div class="seg" role="radiogroup" aria-label="Type">
        ${[['full', 'Full session'], ['minimum', `${MINIMUM_MINUTES}-min minimum`], ['volunteer', 'Volunteer']].map(([v, l]) => `<label><input type="radio" name="kind" value="${v}" ${v === kind ? 'checked' : ''}><span>${l}</span></label>`).join('')}
      </div>
      <div class="form-grid">
        <label class="field"><span>Minutes</span><input type="number" name="minutes" class="input" min="1" max="1440" inputmode="numeric" value="${minutes}" required></label>
        <label class="field"><span>Date</span><input type="date" name="session_on" class="input" value="${date}" max="${today()}" required></label>
      </div>
      <label class="field"><span>What did you work on?</span><input name="project" class="input" list="projects" placeholder="e.g. Case study 2" maxlength="120"><datalist id="projects">${projects.map((p) => `<option value="${esc(p)}">`).join('')}</datalist></label>
      <label class="field"><span>Sticky note: the very next step</span><textarea name="next_step" class="input" placeholder="So next time you can start straight away" maxlength="500">${esc(latestNextStep() || '')}</textarea></label>
      <button class="btn primary" type="submit">Save session</button>
    </form>`);
}

function taskForm(t = null) {
  openSheet(t ? 'Edit task' : 'Quick add', `
    <form data-form="${t ? 'task-edit' : 'task'}" ${t ? `data-id="${t.id}"` : ''} data-close="1" autocomplete="off" style="display:flex;flex-direction:column;gap:14px">
      <label class="field"><span>Task</span><input name="title" class="input" required maxlength="200" value="${esc(t?.title || '')}" placeholder="What needs doing?"></label>
      <div class="form-grid">
        <label class="field"><span>Due</span><input type="date" name="due_date" class="input" value="${t ? (t.due_date || '') : today()}"></label>
        <label class="field"><span>Area</span><select name="area" class="input">${AREAS.map((a) => `<option value="${a}" ${a === (t?.area || 'personal') ? 'selected' : ''}>${cap(a)}</option>`).join('')}</select></label>
      </div>
      <button class="btn primary" type="submit">${t ? 'Save' : 'Add task'}</button>
      ${t ? `<button type="button" class="btn danger" data-act="delete-task" data-id="${t.id}">Delete task</button>` : `
        <div class="btn-row"><button type="button" class="btn small grow" data-act="log-session">Log freelance time</button><button type="button" class="btn small grow" data-act="start-timer">Start freelance timer</button></div>`}
    </form>`);
}

function habitsSheet() {
  openSheet('Habits', `
    <div class="list">${S.habits.map((h) => `<div class="row"><span class="grow"><span class="title">${esc(h.title)}</span></span><button type="button" class="icon-btn" data-act="archive-habit" data-id="${h.id}" aria-label="Remove ${esc(h.title)}">${icon('trash', 18)}</button></div>`).join('') || '<p class="empty">No habits yet.</p>'}</div>
    <form class="inline-add" data-form="habit" autocomplete="off"><label class="sr" for="new-habit">New habit</label><input id="new-habit" name="title" class="input" placeholder="e.g. Stretch 10 min" required maxlength="60"><button class="btn primary" type="submit">Add</button></form>
    <p class="meta">Removing a habit keeps its history.</p>`);
}

function accountSheet() {
  openSheet('Account', `
    <p class="meta">Signed in as <b>${esc(S.user.email)}</b></p>
    <button type="button" class="btn" data-act="export">Export all my data</button>
    <p class="meta">Saves a backup file of everything. Worth doing once a month.</p>
    <button type="button" class="btn danger" data-act="sign-out">Sign out</button>`);
}

/* =====================================================================
   Actions
   ===================================================================== */
let toastTimer;
function toast(msg) {
  const el = $('#toast'); el.textContent = msg; el.classList.add('show');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => el.classList.remove('show'), 2600);
}
async function run(fn, okMsg) {
  try { await fn(); if (okMsg) toast(okMsg); }
  catch (e) {
    console.error(e);
    toast(!navigator.onLine ? "You're offline — that wasn't saved." : `Couldn't save: ${e.message || 'unknown error'}`);
  }
  render();
}
const byId = (arr, id) => arr.find((x) => x.id === id);

const ACTIONS = {
  'close-sheet': closeSheet,
  'account': (el, e) => { e.preventDefault(); accountSheet(); },
  'quick-add': () => taskForm(),
  'edit-task': (el) => taskForm(byId(S.tasks, el.dataset.id)),
  'manage-habits': habitsSheet,
  'toggle-done': () => { S.showDone = !S.showDone; render(); },
  'task-area': (el, e) => { e.preventDefault(); S.taskArea = el.dataset.area; render(); },

  'snooze': (el) => run(async () => {
    const t = byId(S.tasks, el.dataset.id);
    const base = t.due_date && t.due_date > today() ? t.due_date : today();
    replaceIn(S.tasks, await update('tasks', t.id, { due_date: addDays(base, 1), times_moved: (t.times_moved || 0) + 1 }));
  }, 'Moved to tomorrow'),
  'delete-task': (el) => run(async () => {
    await remove('tasks', el.dataset.id); S.tasks = S.tasks.filter((x) => x.id !== el.dataset.id); closeSheet();
  }, 'Task deleted'),

  'toggle-habit': (el) => run(async () => {
    const t = today(); const hid = el.dataset.id;
    const log = S.logs.find((l) => l.habit_id === hid && l.log_date === t);
    if (log) { await remove('habit_logs', log.id); S.logs = S.logs.filter((l) => l !== log); }
    else S.logs.push(await insert('habit_logs', { habit_id: hid, log_date: t }));
  }),
  'add-habit-suggest': (el) => run(async () => { S.habits.push(await insert('habits', { title: el.dataset.title, sort_order: S.habits.length })); }),
  'archive-habit': (el) => run(async () => { await update('habits', el.dataset.id, { active: false }); S.habits = S.habits.filter((h) => h.id !== el.dataset.id); habitsSheet(); }),

  'delete-milestone': (el) => run(async () => { await remove('milestones', el.dataset.id); S.milestones = S.milestones.filter((m) => m.id !== el.dataset.id); }),
  'goal-done': (el) => run(async () => { replaceIn(S.goals, await update('goals', el.dataset.id, { status: 'done' })); }, 'Goal achieved — well done'),
  'goal-drop': (el) => { if (confirm('Delete this goal and its milestones?')) run(async () => { await remove('goals', el.dataset.id); S.goals = S.goals.filter((g) => g.id !== el.dataset.id); }, 'Goal deleted'); },

  'start-timer': () => { store.set('timer', { start: Date.now() }); closeSheet(); if (route() !== 'work' && route() !== 'today') location.hash = '#/work'; render(); toast('Session started — good.'); },
  'stop-timer': () => { const tm = store.get('timer'); if (!tm) return; sessionForm({ minutes: Math.max(1, Math.round((Date.now() - tm.start) / 60000)), title: 'Nice work — log it' }); },
  'discard-timer': () => { if (confirm('Discard this session without logging it?')) { store.set('timer', null); render(); } },
  'log-minimum': () => sessionForm({ minutes: MINIMUM_MINUTES, kind: 'minimum', title: 'Bad-day minimum' }),
  'log-session': () => sessionForm(),
  'delete-session': (el) => { if (confirm('Delete this session?')) run(async () => { await remove('work_sessions', el.dataset.id); S.sessions = S.sessions.filter((s) => s.id !== el.dataset.id); }, 'Session deleted'); },
  'add-day-off': () => openSheet('Plan a day away', `
    <form data-form="day-off" data-close="1" style="display:flex;flex-direction:column;gap:14px">
      <label class="field"><span>Date</span><input type="date" name="off_date" class="input" min="${today()}" value="${today()}" required></label>
      <label class="field"><span>Reason (optional)</span><input name="reason" class="input" maxlength="80" placeholder="e.g. Weekend in the Lakes"></label>
      <button class="btn primary" type="submit">Save</button>
    </form>`),
  'delete-day-off': (el) => run(async () => { await remove('days_off', el.dataset.id); S.daysOff = S.daysOff.filter((o) => o.id !== el.dataset.id); }),

  'export': () => run(async () => {
    const tables = ['tasks', 'goals', 'milestones', 'habits', 'habit_logs', 'workouts', 'workout_sets', 'expense_categories', 'expenses', 'work_sessions', 'days_off', 'weekly_reviews', 'reminders'];
    const out = { exported_at: new Date().toISOString() };
    for (const t of tables) out[t] = await q(sb.from(t).select('*'));
    const name = `daybook-backup-${today()}.json`;
    const file = new File([JSON.stringify(out, null, 2)], name, { type: 'application/json' });
    if (navigator.canShare && navigator.canShare({ files: [file] }) && /iPhone|iPad|Android/i.test(navigator.userAgent)) {
      await navigator.share({ files: [file], title: 'Daybook backup' });
    } else {
      const a = document.createElement('a'); a.href = URL.createObjectURL(file); a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 5000);
    }
  }, 'Backup ready'),
  'sign-out': async () => { closeSheet(); await sb.auth.signOut(); },
};

const CHANGES = {
  'task-done': (el) => run(async () => {
    const done = el.checked;
    replaceIn(S.tasks, await update('tasks', el.dataset.id, { done, done_at: done ? new Date().toISOString() : null }));
  }, el.checked ? 'Done ✓' : null),
  'milestone': (el) => run(async () => {
    const done = el.checked;
    replaceIn(S.milestones, await update('milestones', el.dataset.id, { done, done_at: done ? new Date().toISOString() : null }));
  }, el.checked ? 'Milestone ticked off' : null),
};

const FORMS = {
  task: (f) => run(async () => {
    const title = f.get('title').trim(); if (!title) return;
    S.tasks.push(await insert('tasks', { title, due_date: f.get('due_date') || null, area: f.get('area') }));
  }, 'Task added'),
  'task-edit': (f, form) => run(async () => {
    replaceIn(S.tasks, await update('tasks', form.dataset.id, { title: f.get('title').trim(), due_date: f.get('due_date') || null, area: f.get('area') }));
  }, 'Saved'),
  goal: (f) => run(async () => {
    const g = await insert('goals', { title: f.get('title').trim(), target_date: f.get('target_date') || null, area: f.get('area') });
    S.goals.push(g); S.openGoals.add(g.id);
  }, 'Goal added — now break it into milestones'),
  milestone: (f, form) => run(async () => {
    const gid = form.dataset.goal;
    const n = S.milestones.filter((m) => m.goal_id === gid).length;
    S.milestones.push(await insert('milestones', { goal_id: gid, title: f.get('title').trim(), sort_order: n }));
  }),
  habit: (f) => run(async () => { S.habits.push(await insert('habits', { title: f.get('title').trim(), sort_order: S.habits.length })); habitsSheet(); }),
  session: (f) => run(async () => {
    const row = {
      minutes: Number(f.get('minutes')), kind: f.get('kind'), session_on: f.get('session_on'),
      project: f.get('project').trim() || null, next_step: f.get('next_step').trim() || null,
    };
    const saved = await insert('work_sessions', row);
    S.sessions.unshift(saved);
    S.sessions.sort((a, b) => b.session_on.localeCompare(a.session_on) || (b.created_at || '').localeCompare(a.created_at || ''));
    store.set('timer', null); closeSheet();
  }, 'Session logged ✓'),
  'day-off': (f) => run(async () => {
    const row = await insert('days_off', { off_date: f.get('off_date'), reason: f.get('reason').trim() || null });
    S.daysOff.push(row); S.daysOff.sort((a, b) => a.off_date.localeCompare(b.off_date));
  }, 'Saved — that day won\'t count as a miss'),
};

document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-act]');
  if (!el || !ACTIONS[el.dataset.act]) return;
  ACTIONS[el.dataset.act](el, e);
});
document.addEventListener('change', (e) => {
  const el = e.target.closest('[data-change]');
  if (el && CHANGES[el.dataset.change]) CHANGES[el.dataset.change](el, e);
});
document.addEventListener('submit', (e) => {
  const form = e.target.closest('form[data-form]');
  if (!form || !FORMS[form.dataset.form]) return;
  e.preventDefault();
  const btn = form.querySelector('[type=submit]'); if (btn) btn.disabled = true;
  if (form.dataset.close) closeSheet();
  FORMS[form.dataset.form](new FormData(form), form);
});
document.addEventListener('toggle', (e) => {
  const d = e.target;
  if (d.matches && d.matches('details[data-goal]')) { if (d.open) S.openGoals.add(d.dataset.goal); else S.openGoals.delete(d.dataset.goal); }
}, true);
sheet()?.addEventListener('click', (e) => { if (e.target === sheet()) closeSheet(); }); // tap backdrop to close
window.addEventListener('hashchange', () => { render(); window.scrollTo(0, 0); });
window.addEventListener('offline', () => toast("You're offline. Changes won't save until you reconnect."));
document.addEventListener('visibilitychange', async () => {
  if (document.visibilityState === 'visible' && S.user && Date.now() - S.loadedAt > 60000 && !sheet().open) {
    try { await loadAll(); render(); } catch { /* keep what we have */ }
  }
});

/* =====================================================================
   Login & startup
   ===================================================================== */
function showLogin(msg = '') {
  S.user = null;
  clearInterval(timerTick);
  $('#app').innerHTML = `
    <div class="login">
      <form id="login-form" autocomplete="on">
        <h1>Daybook</h1>
        <p class="meta" style="margin:-6px 0 6px">Sign in to your tracker.</p>
        <label class="field"><span>Email</span><input class="input" type="email" name="email" autocomplete="username" required></label>
        <label class="field"><span>Password</span><input class="input" type="password" name="password" autocomplete="current-password" required></label>
        <div class="err" role="alert">${esc(msg)}</div>
        <button class="btn primary" type="submit">Sign in</button>
      </form>
    </div>`;
  $('#login-form').addEventListener('submit', async (e) => {
    e.preventDefault(); e.stopPropagation();
    const f = new FormData(e.target); const btn = e.target.querySelector('button'); btn.disabled = true; btn.textContent = 'Signing in…';
    const { error } = await sb.auth.signInWithPassword({ email: f.get('email').trim(), password: f.get('password') });
    if (error) { $('.login .err').textContent = error.message === 'Invalid login credentials' ? 'Email or password not recognised.' : error.message; btn.disabled = false; btn.textContent = 'Sign in'; }
  });
}

let starting = false;
async function start(user) {
  if (starting || S.user) return;
  starting = true;
  S.user = user;
  $('#app').innerHTML = '<div class="boot">Loading your day…</div>';
  try {
    await loadAll();
    await seedIfNew();
    renderShell();
    render();
  } catch (e) {
    console.error(e);
    S.user = null;
    showLogin(`Couldn't load your data: ${e.message}`);
  } finally { starting = false; }
}

(async function boot() {
  if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(() => {});
  const { data: { session } } = await sb.auth.getSession();
  if (session) start(session.user); else showLogin();
  sb.auth.onAuthStateChange((event, session) => {
    if (event === 'SIGNED_OUT') showLogin();
    else if (event === 'SIGNED_IN' && session && !S.user) start(session.user);
  });
})();
