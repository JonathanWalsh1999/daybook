import { SUPABASE_URL, SUPABASE_KEY, WORK_TARGET_MINUTES, WORK_DAYS, MINIMUM_MINUTES, GYM_TARGET_PER_WEEK } from './config.js';

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
const localDay = (iso) => ymd(new Date(iso));
const DAY = ['', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const DAY_LONG = ['', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const fmtLong = (s) => parseYmd(s).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });
const fmtShort = (s) => parseYmd(s).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
const fmtDM = (s) => parseYmd(s).toLocaleDateString('en-GB', { day: 'numeric', month: 'long' });
const fmtMins = (m) => { m = Math.round(m || 0); const h = Math.floor(m / 60), r = m % 60; return h ? (r ? `${h}h ${r}m` : `${h}h`) : `${r}m`; };
const fmtTime = (t) => { const [h, m] = t.split(':').map(Number); const ap = h >= 12 ? 'pm' : 'am'; const hh = h % 12 || 12; return m ? `${hh}.${pad(m)}${ap}` : `${hh}${ap}`; };
const relDay = (s) => {
  const t = today();
  if (s === t) return 'Today';
  if (s === addDays(t, 1)) return 'Tomorrow';
  if (s === addDays(t, -1)) return 'Yesterday';
  const diff = (parseYmd(s) - parseYmd(t)) / 864e5;
  if (Math.abs(diff) < 7) return DAY_LONG[isoWeekday(s)];
  return fmtShort(s);
};
const gbp = (n) => { n = Number(n) || 0; const whole = Math.abs(n - Math.round(n)) < 0.005; return `${n < 0 ? '−' : ''}£${Math.abs(n).toLocaleString('en-GB', { minimumFractionDigits: whole ? 0 : 2, maximumFractionDigits: 2 })}`; };
const monthOf = (s) => s.slice(0, 7);
const daysInMonth = (m) => { const [y, mo] = m.split('-').map(Number); return new Date(y, mo, 0).getDate(); };
const addMonths = (m, n) => { const [y, mo] = m.split('-').map(Number); const d = new Date(y, mo - 1 + n, 1); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`; };
const fmtMonth = (m) => parseYmd(m + '-01').toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
const AREAS = ['personal', 'house', 'admin', 'money', 'freelance', 'gym'];
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
const sum = (arr, f) => arr.reduce((a, x) => a + (Number(f(x)) || 0), 0);
const norm = (s) => String(s || '').trim().toLowerCase();
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
  left: '<path d="M15 5l-7 7 7 7"/>',
  right: '<path d="M9 5l7 7-7 7"/>',
};
const icon = (name, size = 22) => `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name]}</svg>`;

/* =====================================================================
   State & data
   ===================================================================== */
const S = {
  user: null, loadedAt: 0,
  tasks: [], sessions: [], daysOff: [], goals: [], milestones: [], reminders: [],
  workouts: [], sets: [], cats: [], expenses: [], reviews: [],
  openGoals: new Set(), taskArea: 'all', showDone: false,
  month: monthOf(today()), reviewWeek: null,
};

async function q(p) { const { data, error } = await p; if (error) throw error; return data; }
const insert = (table, row) => q(sb.from(table).insert(row).select().single());
const update = (table, id, patch) => q(sb.from(table).update(patch).eq('id', id).select().single());
const remove = (table, id) => q(sb.from(table).delete().eq('id', id));
const replaceIn = (arr, row) => { const i = arr.findIndex((x) => x.id === row.id); if (i >= 0) arr[i] = row; else arr.push(row); };
const byId = (arr, id) => arr.find((x) => x.id === id);

async function loadAll() {
  const since = addDays(today(), -120);
  const sinceIso = parseYmd(since).toISOString();
  const doneSince = new Date(Date.now() - 60 * 864e5).toISOString();
  const [open, done, sessions, daysOff, goals, milestones, reminders, workouts, sets, cats, expenses, reviews] = await Promise.all([
    q(sb.from('tasks').select('*').eq('done', false).order('due_date', { ascending: true, nullsFirst: false }).order('created_at')),
    q(sb.from('tasks').select('*').eq('done', true).gte('done_at', doneSince).order('done_at', { ascending: false })),
    q(sb.from('work_sessions').select('*').gte('session_on', since).order('session_on', { ascending: false }).order('created_at', { ascending: false })),
    q(sb.from('days_off').select('*').gte('off_date', since).order('off_date')),
    q(sb.from('goals').select('*').neq('status', 'dropped').order('created_at')),
    q(sb.from('milestones').select('*').order('sort_order').order('title')),
    q(sb.from('reminders').select('*').eq('active', true).order('remind_at')),
    q(sb.from('workouts').select('*').gte('started_at', sinceIso).order('started_at', { ascending: false })),
    q(sb.from('workout_sets').select('*').gte('created_at', sinceIso).order('created_at')),
    q(sb.from('expense_categories').select('*').order('sort_order').order('name')),
    q(sb.from('expenses').select('*').gte('spent_on', addDays(today(), -400)).order('spent_on', { ascending: false }).order('created_at', { ascending: false })),
    q(sb.from('weekly_reviews').select('*').order('week_start', { ascending: false }).limit(12)),
  ]);
  Object.assign(S, { tasks: [...open, ...done], sessions, daysOff, goals, milestones, reminders, workouts, sets, cats, expenses, reviews, loadedAt: Date.now() });
}

// First login: routine reminders + freelance roadmap. First visit after the money update: starter categories.
async function seedIfNew() {
  if (!S.reminders.length && !S.goals.length && !S.tasks.length && !S.sessions.length) {
    await q(sb.from('reminders').insert([
      { title: 'Home, change, then 1 hour at the PC before tea', weekday: 1, remind_at: '18:15' },
      { title: 'Weekly build block, 3–5pm', weekday: 6, remind_at: '14:55' },
    ]));
    const g = await insert('goals', { title: 'First paid VR job', area: 'freelance' });
    const steps = ['Case study 1', 'Case study 2', 'Case study 3', 'Rebuild portfolio', 'Post a demo on LinkedIn', 'Contact past Unity client', 'Book first paid job', 'Buy a headset (only once a job is booked)'];
    await q(sb.from('milestones').insert(steps.map((title, i) => ({ goal_id: g.id, title, sort_order: i }))));
  }
  if (!S.cats.length) {
    const names = ['Rent & bills', 'Groceries', 'Transport', 'Eating out', 'Subscriptions', 'Gym & health', 'Other'];
    await q(sb.from('expense_categories').insert(names.map((name, i) => ({ name, sort_order: i }))));
  }
  await loadAll();
}

/* =====================================================================
   Derived data
   ===================================================================== */
// --- Freelance ---
const weekMinutes = (ws = weekStart(today())) => sum(S.sessions.filter((s) => s.session_on >= ws && s.session_on <= addDays(ws, 6)), (s) => s.minutes);
const latestNextStep = () => S.sessions.find((s) => s.next_step && s.next_step.trim())?.next_step || null;
const startDate = () => (S.user?.created_at ? localDay(S.user.created_at) : today()); // no "misses" before you started
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
const currentSlot = () => recentSlots(1)[0] || null;
function missWarning() {
  const past = recentSlots(3).filter((s) => s.status !== 'pending' && s.status !== 'before');
  const last = past[past.length - 1];
  if (!last || last.status !== 'missed') return null;
  const prev = past[past.length - 2];
  if (prev && prev.status === 'missed') return `Two missed in a row. Reset with just ${MINIMUM_MINUTES} minutes — that counts.`;
  return `You missed ${DAY_LONG[isoWeekday(last.slot)]}'s session. Never miss twice — even ${MINIMUM_MINUTES} minutes keeps the chain.`;
}

// --- Gym ---
const activeWorkout = () => S.workouts.find((w) => !w.ended_at) || null;
const setsFor = (wid) => S.sets.filter((s) => s.workout_id === wid);
const gymDays = (from, to) => [...new Set(S.workouts.map((w) => localDay(w.started_at)).filter((d) => d >= from && d <= to))];
const exerciseNames = () => [...new Set(S.sets.slice().reverse().map((s) => s.exercise))];
function lastTimeFor(exercise, excludeWid) {
  for (const w of S.workouts) {
    if (w.id === excludeWid) continue;
    const ss = setsFor(w.id).filter((s) => norm(s.exercise) === norm(exercise));
    if (ss.length) return { w, sets: ss };
  }
  return null;
}
function bestFor(exercise) {
  let best = null;
  for (const s of S.sets) {
    if (norm(s.exercise) !== norm(exercise) || s.weight_kg == null) continue;
    if (!best || Number(s.weight_kg) > Number(best.weight_kg) || (Number(s.weight_kg) === Number(best.weight_kg) && (s.reps || 0) > (best.reps || 0))) best = s;
  }
  return best;
}
const kg = (n) => (n == null ? '—' : `${Number(n)}kg`);
const setsLine = (ss) => { const w = ss[0]?.weight_kg; return ss.every((s) => s.weight_kg === w) ? `${kg(w)} × ${ss.map((s) => s.reps ?? '—').join(', ')}` : ss.map((s) => `${kg(s.weight_kg)}×${s.reps ?? '—'}`).join(', '); };
const workoutMinutes = (w) => Math.max(1, Math.round(((w.ended_at ? new Date(w.ended_at) : new Date()) - new Date(w.started_at)) / 60000));

// --- Money ---
const monthExpenses = (m) => S.expenses.filter((e) => monthOf(e.spent_on) === m);
const budgetTotal = () => sum(S.cats, (c) => c.monthly_budget);
const catName = (id) => byId(S.cats, id)?.name || 'Uncategorised';
function missingRecurring(m) {
  const prev = monthExpenses(addMonths(m, -1)).filter((e) => e.is_recurring);
  const cur = monthExpenses(m);
  return prev.filter((p) => !cur.some((c) => c.is_recurring && norm(c.description) === norm(p.description) && Number(c.amount) === Number(p.amount)));
}
const spendBetween = (from, to) => sum(S.expenses.filter((e) => e.spent_on >= from && e.spent_on <= to), (e) => e.amount);

// --- Reviews ---
const reviewFor = (ws) => S.reviews.find((r) => r.week_start === ws) || null;

/* =====================================================================
   Rendering
   ===================================================================== */
const ROUTES = [['today', 'Today'], ['gym', 'Gym'], ['money', 'Money'], ['work', 'Work'], ['tasks', 'Tasks'], ['review', 'Review']];
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
      <button type="button" class="fab" data-act="fab" aria-label="Add">${icon('plus', 24)}<span class="fab-label"></span></button>
    </div>`;
}

let ticker = null;
function render() {
  if (!S.user || !$('#view')) return;
  const r = ROUTES.some(([k]) => k === route()) ? route() : 'today';
  document.querySelectorAll('nav.tabs a[data-route]').forEach((a) => { if (a.dataset.route === r) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); });
  $('#view').innerHTML = VIEWS[r]();
  document.title = `${ROUTES.find(([k]) => k === r)[1]} · Daybook`;
  const fab = $('.fab');
  const fabLabel = { money: 'Add expense' }[r] || '';
  fab.hidden = !['today', 'tasks', 'work', 'money'].includes(r);
  fab.querySelector('.fab-label').textContent = fabLabel;
  fab.setAttribute('aria-label', fabLabel || 'Quick add');
  clearInterval(ticker);
  if (document.querySelector('[data-since]')) { tick(); ticker = setInterval(tick, 1000); }
}
// Live clocks: any element with data-since="<ms>" shows elapsed time.
function tick() {
  document.querySelectorAll('[data-since]').forEach((el) => {
    const s = Math.max(0, Math.floor((Date.now() - Number(el.dataset.since)) / 1000));
    el.textContent = el.dataset.fmt === 'min' ? fmtMins(s / 60) : `${Math.floor(s / 3600)}:${pad(Math.floor((s % 3600) / 60))}:${pad(s % 60)}`;
  });
}

const head = (eyebrow, title, extra = '') => `<header class="view-head"><div><div class="eyebrow">${eyebrow}</div><h1>${title}</h1></div>${extra}</header>`;
const avatarBtn = () => `<button type="button" class="avatar" data-act="account" aria-label="Account">${esc((S.user.email || '?')[0].toUpperCase())}</button>`;
const note = (html, cls = 'warn') => `<div class="card ${cls}" role="note"><div style="font-size:14px">${html}</div></div>`;
const bar = (pct, over = false) => `<div class="bar"><span style="width:${Math.max(0, Math.min(100, pct))}%${over ? ';background:var(--amber)' : ''}"></span></div>`;

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

function timerCard() {
  const tm = store.get('timer');
  if (!tm) return '';
  return `
    <section class="card dark" aria-label="Session running">
      <div class="card-head"><h2>Freelance session running</h2><span class="meta">since ${new Date(tm.start).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</span></div>
      <div class="timer" data-since="${tm.start}">0:00:00</div>
      <div class="btn-row"><button type="button" class="btn primary grow" data-act="stop-timer">Stop &amp; log</button><button type="button" class="btn small ghost-dark" data-act="discard-timer">Discard</button></div>
    </section>`;
}
function nextStepSticky(label = 'Next step · from last session') {
  const ns = latestNextStep();
  return ns ? `<section class="sticky" aria-label="Next step"><span class="lbl">${esc(label)}</span><span class="txt">${esc(ns)}</span></section>` : '';
}

/* ---------- Today ---------- */
function viewToday() {
  const t = today();
  const hour = new Date().getHours();
  const greet = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
  const due = S.tasks.filter((x) => !x.done && x.due_date && x.due_date <= t);
  const doneToday = S.tasks.filter((x) => x.done && x.done_at && localDay(x.done_at) === t && x.due_date && x.due_date <= t);
  const list = [...due.sort((a, b) => a.due_date.localeCompare(b.due_date)), ...doneToday];
  const mins = weekMinutes();
  const ws = weekStart(t);
  const gym = gymDays(ws, t).length;
  const m = monthOf(t); const spent = sum(monthExpenses(m), (e) => e.amount); const budget = budgetTotal();
  const rems = S.reminders.filter((r) => r.weekday === isoWeekday(t));
  const cur = currentSlot();
  const warn = missWarning();
  const running = !!store.get('timer');
  const active = activeWorkout();
  const lastGym = S.workouts[0] ? localDay(S.workouts[0].started_at) : null;
  const gymGap = lastGym ? Math.round((parseYmd(t) - parseYmd(lastGym)) / 864e5) : null;
  const lastReview = reviewFor(addDays(ws, -7));
  const commitments = (lastReview?.commitments || []).filter(Boolean);
  const needsReview = isoWeekday(t) >= 6 && !reviewFor(ws);

  let workCard = '';
  if (running) workCard = timerCard();
  else if (cur && cur.status === 'pending') {
    const isToday = cur.slot === t;
    const deadline = DAY_LONG[isoWeekday(nextSlotAfter(cur.slot))];
    workCard = `
    <section class="card soft" aria-label="Freelance">
      <div class="card-head"><h2>${isToday ? 'Freelance session today' : `${DAY_LONG[isoWeekday(cur.slot)]}'s session isn't logged yet`}</h2><span class="meta nowrap" style="color:var(--green-deep)">${fmtMins(mins)} / ${fmtMins(WORK_TARGET_MINUTES)}</span></div>
      ${!isToday ? `<div style="font-size:14px">You've got until ${deadline} to catch up. Already did it? Log it so it counts.</div>` : ''}
      ${latestNextStep() ? `<div style="font-size:15px;font-weight:500">Next step: ${esc(latestNextStep())}</div>` : ''}
      <div class="btn-row"><button type="button" class="btn primary grow" data-act="start-timer">Start session</button><button type="button" class="btn small" data-act="log-minimum">Bad day · ${MINIMUM_MINUTES} min</button></div>
      ${!isToday ? `<button type="button" class="btn link" data-act="log-session" data-date="${cur.slot}" style="align-self:flex-start">I did it — log ${DAY_LONG[isoWeekday(cur.slot)]}'s session</button>` : ''}
    </section>`;
  }

  return `
    ${head(fmtLong(t), greet, avatarBtn())}
    <section class="tiles" aria-label="At a glance">
      <a class="tile" href="#/work"><span class="k">Freelance</span><span class="v">${fmtMins(mins)}</span><span class="s">of ${fmtMins(WORK_TARGET_MINUTES)} this week</span></a>
      <a class="tile" href="#/gym"><span class="k">Gym</span><span class="v">${gym} / ${GYM_TARGET_PER_WEEK}</span><span class="s">this week</span></a>
      <a class="tile" href="#/money"><span class="k">Money</span><span class="v">${budget ? gbp(Math.round(Math.abs(budget - spent))) : gbp(Math.round(spent))}</span><span class="s">${budget ? (spent > budget ? 'over budget' : `left in ${parseYmd(t).toLocaleDateString('en-GB', { month: 'short' })}`) : 'spent this month'}</span></a>
    </section>
    ${rems.map((r) => note(`<b>${fmtTime(r.remind_at)}</b> · ${esc(r.title)}`)).join('')}
    ${warn && !running ? note(esc(warn)) : ''}
    ${active ? note(`Workout in progress: <b>${esc(active.name || 'Workout')}</b> · <a href="#/gym">carry on</a>`, 'soft') : (gymGap != null && gymGap >= 3 ? note(`Your last gym session was ${gymGap} days ago (${esc(relDay(lastGym))}).`) : '')}
    ${needsReview ? note(`It's the weekend — take 5 minutes for your <a href="#/review">weekly review</a>.`, 'soft') : ''}
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
        ${commitments.length ? `<section class="card soft" aria-label="This week's commitments"><div class="card-head"><h2>This week I said I'd…</h2></div><ol class="commit">${commitments.map((c) => `<li>${esc(c)}</li>`).join('')}</ol></section>` : ''}
        ${!workCard.includes('Next step') && latestNextStep() && !running ? nextStepSticky('Freelance · next step') : ''}
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
  const done = S.tasks.filter((x) => x.done && (area === 'all' || x.area === area)).slice(0, 30);
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
          <section class="card flush"><div class="list">${items.map((x) => taskRow(x, { showDate: label === 'Overdue' || label === 'Next 7 days' || label === 'Later' })).join('')}</div></section>`).join('')
          : `<section class="card"><p class="empty">No open tasks${area !== 'all' ? ` in ${cap(area)}` : ''}. Nice.</p></section>`}
        ${done.length ? `<button type="button" class="btn link" data-act="toggle-done" style="align-self:flex-start">${S.showDone ? 'Hide' : 'Show'} ${done.length} done recently</button>
          ${S.showDone ? `<section class="card flush"><div class="list">${done.map((x) => taskRow(x)).join('')}</div></section>` : ''}` : ''}
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
const SLOT_TEXT = { full: ['Done', 'ok'], minimum: ['Minimum ✓', 'ok'], away: ['Away', ''], missed: ['Missed', 'due'], pending: ['To do', 'due'], before: ['—', ''] };
function viewWork() {
  const t = today();
  const mins = weekMinutes();
  const ws = weekStart(t);
  const thisWeek = S.sessions.filter((s) => s.session_on >= ws);
  const vol = sum(thisWeek.filter((s) => s.kind === 'volunteer'), (s) => s.minutes);
  const weekSlots = WORK_DAYS.map((wd) => addDays(ws, wd - 1));
  const slots = recentSlots(8);
  const warn = missWarning();
  const running = !!store.get('timer');
  const roadmap = S.goals.filter((g) => g.area === 'freelance' && g.status === 'active');
  const upcomingOff = S.daysOff.filter((o) => o.off_date >= t);

  return `
    ${head('VR · 360 · Unity', 'Freelance')}
    ${warn && !running ? note(esc(warn)) : ''}
    <div class="desk-grid">
      <div class="col">
        <section class="card dark" aria-label="This week">
          <div class="card-head"><span class="meta">This week</span><span class="meta">Target ${fmtMins(WORK_TARGET_MINUTES)}</span></div>
          <div style="display:flex;align-items:baseline;gap:8px;flex-wrap:wrap"><span class="big">${fmtMins(mins)}</span>${vol ? `<span class="meta">incl. ${fmtMins(vol)} volunteer</span>` : ''}</div>
          ${bar((mins / WORK_TARGET_MINUTES) * 100)}
          <div class="week-slots">${weekSlots.map((d) => {
            const st = d > t ? ['Coming up', ''] : SLOT_TEXT[slotStatus(d)];
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

/* ---------- Gym ---------- */
function weekDots(ws, days) {
  const t = today();
  return `<div class="dots">${[1, 2, 3, 4, 5, 6, 7].map((i) => {
    const d = addDays(ws, i - 1);
    const cls = days.includes(d) ? 'on' : d === t ? 'now' : '';
    return `<div class="${d === t ? 'is-today' : ''}">${DAY[i][0]}<span class="${cls}" aria-label="${DAY_LONG[i]}${days.includes(d) ? ': trained' : ''}"></span></div>`;
  }).join('')}</div>`;
}

function viewGym() {
  const w = activeWorkout();
  return w ? viewWorkout(w) : viewGymIdle();
}

function viewGymIdle() {
  const t = today(); const ws = weekStart(t);
  const days = gymDays(ws, t);
  const lastWeek = gymDays(addDays(ws, -7), addDays(ws, -1)).length;
  const names = [...new Set(S.workouts.map((w) => w.name).filter(Boolean))].slice(0, 6);
  const recent = S.workouts.filter((x) => x.ended_at).slice(0, 12);
  const bests = exerciseNames().slice(0, 8).map((e) => ({ e, b: bestFor(e) })).filter((x) => x.b);
  return `
    ${head(`Goal: ${GYM_TARGET_PER_WEEK} sessions a week`, 'Gym')}
    <div class="desk-grid">
      <div class="col">
        <section class="card" aria-label="This week">
          <div class="card-head"><h2>This week</h2><span class="meta">${days.length} of ${GYM_TARGET_PER_WEEK}${lastWeek ? ` · last week ${lastWeek}` : ''}</span></div>
          ${weekDots(ws, days)}
        </section>
        <form class="card" data-form="start-workout" autocomplete="off">
          <div class="card-head"><h2>Start a workout</h2></div>
          <label class="sr" for="w-name">Workout name</label>
          <input id="w-name" name="name" class="input" placeholder="e.g. Leg day, Push, Upper" maxlength="60" list="w-names">
          <datalist id="w-names">${names.map((n) => `<option value="${esc(n)}">`).join('')}</datalist>
          ${names.length ? `<div class="suggest">${names.map((n) => `<button type="button" class="btn small" data-act="start-named" data-name="${esc(n)}">${esc(n)}</button>`).join('')}</div>` : ''}
          <button class="btn primary" type="submit">Start workout</button>
        </form>
      </div>
      <div class="col">
        <section class="card" aria-label="Recent workouts">
          <div class="card-head"><h2>Recent workouts</h2></div>
          ${recent.length ? `<div class="list">${recent.map((x) => {
            const ss = setsFor(x.id); const ex = new Set(ss.map((s) => norm(s.exercise))).size;
            return `<div class="row"><button type="button" class="title-btn" data-act="show-workout" data-id="${x.id}"><span class="title">${esc(x.name || 'Workout')}</span><span class="sub">${esc(relDay(localDay(x.started_at)))} · ${ex} exercise${ex === 1 ? '' : 's'}, ${ss.length} sets · ${fmtMins(workoutMinutes(x))}</span></button></div>`;
          }).join('')}</div>` : '<p class="empty">No workouts logged yet. Start one when you get to the gym.</p>'}
        </section>
        ${bests.length ? `<section class="card" aria-label="Personal bests"><div class="card-head"><h2>Personal bests</h2></div><div class="list">${bests.map(({ e, b }) => `<div class="row"><span class="grow"><span class="title">${esc(e)}</span></span><span class="chip gym">${kg(b.weight_kg)} × ${b.reps ?? '—'}</span></div>`).join('')}</div></section>` : ''}
      </div>
    </div>`;
}

function viewWorkout(w) {
  const ss = setsFor(w.id);
  const order = [...new Set(ss.map((s) => s.exercise))];
  const lastSet = ss[ss.length - 1];
  const curEx = lastSet?.exercise || '';
  const prev = curEx ? lastTimeFor(curEx, w.id) : null;
  const names = exerciseNames();
  return `
    ${head(`Workout in progress · <span data-since="${new Date(w.started_at).getTime()}" data-fmt="min"></span>`, esc(w.name || 'Workout'))}
    <form class="card" data-form="set" autocomplete="off">
      <div class="card-head"><h2>Log a set</h2>${prev ? `<span class="meta">Last time: ${esc(setsLine(prev.sets))}</span>` : ''}</div>
      <label class="field"><span>Exercise</span><input name="exercise" class="input" list="ex-names" value="${esc(curEx)}" placeholder="e.g. Back squat" required maxlength="80"></label>
      <datalist id="ex-names">${names.map((n) => `<option value="${esc(n)}">`).join('')}</datalist>
      <div class="form-grid">
        <label class="field"><span>Weight (kg)</span><input name="weight_kg" class="input" type="number" inputmode="decimal" step="0.5" min="0" max="999" value="${lastSet?.weight_kg ?? ''}"></label>
        <label class="field"><span>Reps</span><input name="reps" class="input" type="number" inputmode="numeric" min="0" max="999" value="${lastSet?.reps ?? ''}"></label>
      </div>
      <button class="btn primary big-btn" type="submit">Log set</button>
    </form>
    ${order.slice().reverse().map((ex) => {
      const exSets = ss.filter((s) => s.exercise === ex);
      const best = bestFor(ex); const last = lastTimeFor(ex, w.id);
      return `<section class="card" aria-label="${esc(ex)}">
        <div class="card-head"><h2>${esc(ex)}</h2>${best ? `<span class="chip gym">Best ${kg(best.weight_kg)} × ${best.reps ?? '—'}</span>` : ''}</div>
        <div class="sets"><span>Set</span><span>kg</span><span>Reps</span><span></span>
        ${exSets.map((s, i) => `<span class="muted">${i + 1}</span><span>${s.weight_kg ?? '—'}</span><span>${s.reps ?? '—'}</span><button type="button" class="icon-btn" data-act="delete-set" data-id="${s.id}" aria-label="Delete set ${i + 1}">${icon('close', 16)}</button>`).join('')}</div>
        ${last ? `<div class="meta">Last time (${esc(relDay(localDay(last.w.started_at)))}): ${esc(setsLine(last.sets))}</div>` : ''}
      </section>`;
    }).join('')}
    <div class="btn-row"><button type="button" class="btn dark grow" data-act="finish-workout" data-id="${w.id}">Finish workout</button><button type="button" class="btn danger" data-act="discard-workout" data-id="${w.id}">Discard</button></div>`;
}

/* ---------- Money ---------- */
function viewMoney() {
  const m = S.month; const t = today(); const isNow = m === monthOf(t);
  const exps = monthExpenses(m);
  const spent = sum(exps, (e) => e.amount);
  const budget = budgetTotal();
  const left = budget - spent;
  const daysLeft = isNow ? daysInMonth(m) - parseYmd(t).getDate() + 1 : 0;
  const missing = isNow ? missingRecurring(m) : [];
  const byCat = S.cats.map((c) => ({ c, spent: sum(exps.filter((e) => e.category_id === c.id), (e) => e.amount) }));
  const uncat = sum(exps.filter((e) => !e.category_id || !byId(S.cats, e.category_id)), (e) => e.amount);
  const navBtns = `<div class="month-nav"><button type="button" class="icon-btn" data-act="month" data-dir="-1" aria-label="Previous month">${icon('left', 20)}</button><button type="button" class="icon-btn" data-act="month" data-dir="1" aria-label="Next month" ${isNow ? 'disabled' : ''}>${icon('right', 20)}</button></div>`;

  return `
    ${head(isNow ? `${fmtMonth(m)} · ${daysLeft} day${daysLeft === 1 ? '' : 's'} left` : fmtMonth(m), 'Money', navBtns)}
    <section class="card dark" aria-label="Monthly spending">
      <span class="meta">Spent ${isNow ? 'this month' : `in ${fmtMonth(m)}`}</span>
      <div style="display:flex;align-items:baseline;gap:8px;flex-wrap:wrap"><span class="big">${gbp(spent)}</span>${budget ? `<span class="meta">of ${gbp(budget)}</span>` : ''}</div>
      ${budget ? bar((spent / budget) * 100, spent > budget) : ''}
      <div style="font-size:14px;color:#E9E4D8">${!budget ? 'Set a monthly budget on each category below to see what\'s left.'
        : left < 0 ? `<b style="color:#F2B98A">${gbp(-left)} over budget</b>`
        : isNow ? `${gbp(left)} left · about ${gbp(Math.floor(left / Math.max(1, daysLeft)))} a day` : `${gbp(left)} under budget`}</div>
    </section>
    ${missing.length ? `<section class="card soft" aria-label="Recurring bills"><div style="font-size:14px"><b>${missing.length} recurring bill${missing.length === 1 ? '' : 's'}</b> from last month not logged yet (${gbp(sum(missing, (e) => e.amount))}): ${missing.map((e) => esc(e.description || catName(e.category_id))).join(', ')}.</div><button type="button" class="btn small primary" data-act="add-recurring" style="align-self:flex-start">Add them for ${esc(parseYmd(m + '-01').toLocaleDateString('en-GB', { month: 'long' }))}</button></section>` : ''}
    <div class="desk-grid">
      <div class="col">
        <section class="card" aria-label="By category">
          <div class="card-head"><h2>By category</h2><button type="button" class="btn link" data-act="add-cat">+ Category</button></div>
          ${byCat.map(({ c, spent: s }) => {
            const b = Number(c.monthly_budget) || 0; const over = b && s > b;
            return `<button type="button" class="cat" data-act="edit-cat" data-id="${c.id}">
              <span class="cat-top"><span class="${over ? 'strong' : ''}">${esc(c.name)}</span><span class="${over ? 'over' : 'meta'}">${gbp(s)}${b ? ` / ${gbp(b)}` : ''}${over ? ' · over' : ''}</span></span>
              ${b ? bar((s / b) * 100, over) : '<span class="meta small">No budget set — tap to add one</span>'}
            </button>`;
          }).join('')}
          ${uncat ? `<div class="cat-top" style="padding:4px 0"><span>Uncategorised</span><span class="meta">${gbp(uncat)}</span></div>` : ''}
        </section>
      </div>
      <div class="col">
        <section class="card" aria-label="Spending">
          <div class="card-head"><h2>${isNow ? 'This month' : fmtMonth(m)}</h2><span class="meta">${exps.length} item${exps.length === 1 ? '' : 's'}</span></div>
          ${exps.length ? `<div class="list">${exps.map((e) => `
            <div class="row"><button type="button" class="title-btn" data-act="edit-expense" data-id="${e.id}"><span class="title">${esc(e.description || catName(e.category_id))}</span><span class="sub">${esc(catName(e.category_id))} · ${esc(relDay(e.spent_on))}${e.is_recurring ? ' · Recurring' : ''}</span></button><span class="amt">−${gbp(e.amount)}</span></div>`).join('')}</div>`
            : `<p class="empty">Nothing logged${isNow ? ' yet. Tap “Add expense” when you spend.' : '.'}</p>`}
        </section>
      </div>
    </div>`;
}

/* ---------- Weekly review ---------- */
function weekStats(ws) {
  const we = addDays(ws, 6); const t = today();
  const end = we < t ? we : t;
  const work = weekMinutes(ws), workPrev = weekMinutes(addDays(ws, -7));
  const gym = gymDays(ws, we).length, gymPrev = gymDays(addDays(ws, -7), addDays(ws, -1)).length;
  const spend = spendBetween(ws, we);
  let planned = 0; for (let d = ws; d <= end; d = addDays(d, 1)) planned += budgetTotal() / daysInMonth(monthOf(d));
  const tasksDone = S.tasks.filter((x) => x.done && x.done_at && localDay(x.done_at) >= ws && localDay(x.done_at) <= we).length;
  const slipped = [];
  S.tasks.filter((x) => !x.done && x.due_date && x.due_date >= ws && x.due_date <= end && x.due_date < t).forEach((x) => slipped.push(`Not done: ${x.title}`));
  S.tasks.filter((x) => !x.done && x.times_moved >= 2).forEach((x) => slipped.push(`${x.title} — moved ${x.times_moved} times`));
  WORK_DAYS.map((wd) => addDays(ws, wd - 1)).filter((d) => d <= t && slotStatus(d) === 'missed').forEach((d) => slipped.push(`Missed ${DAY_LONG[isoWeekday(d)]}'s freelance session`));
  const m = monthOf(end);
  S.cats.forEach((c) => { const b = Number(c.monthly_budget); if (!b) return; const s = sum(monthExpenses(m).filter((e) => e.category_id === c.id), (e) => e.amount); if (s > b) slipped.push(`${c.name} is ${gbp(s - b)} over budget for ${parseYmd(m + '-01').toLocaleDateString('en-GB', { month: 'long' })}`); });
  if (gym < GYM_TARGET_PER_WEEK && we < t) slipped.push(`Gym: ${gym} of ${GYM_TARGET_PER_WEEK} sessions`);
  return { work, workPrev, gym, gymPrev, spend, planned, tasksDone, slipped: [...new Set(slipped)] };
}
const diff = (a, b, fmt, unit = '') => (a === b ? 'Same as last week' : `${a > b ? 'Up' : 'Down'} ${fmt(Math.abs(a - b))}${unit} on last week`);

function viewReview() {
  const t = today();
  const ws = S.reviewWeek || weekStart(t);
  const we = addDays(ws, 6);
  const isCurrent = ws === weekStart(t);
  const st = weekStats(ws);
  const rev = reviewFor(ws);
  const prevRev = reviewFor(addDays(ws, -7));
  const said = (prevRev?.commitments || []).filter(Boolean);
  const cm = rev?.commitments || [];
  const navBtns = `<div class="month-nav"><button type="button" class="icon-btn" data-act="review-week" data-dir="-1" aria-label="Previous week">${icon('left', 20)}</button><button type="button" class="icon-btn" data-act="review-week" data-dir="1" aria-label="Next week" ${isCurrent ? 'disabled' : ''}>${icon('right', 20)}</button></div>`;
  return `
    ${head(`${parseYmd(ws).getDate()}${monthOf(ws) !== monthOf(we) ? ` ${parseYmd(ws).toLocaleDateString('en-GB', { month: 'short' })}` : ''}–${fmtDM(we)}${isCurrent ? ' · this week' : ''}`, 'Weekly review', navBtns)}
    <section class="score" aria-label="Scorecard">
      <div class="tile"><span class="k">Freelance</span><span class="v">${fmtMins(st.work)} / ${fmtMins(WORK_TARGET_MINUTES)}</span><span class="s ${st.work >= st.workPrev ? 'good' : ''}">${diff(st.work, st.workPrev, fmtMins)}</span></div>
      <div class="tile"><span class="k">Gym sessions</span><span class="v">${st.gym} / ${GYM_TARGET_PER_WEEK}</span><span class="s ${st.gym >= st.gymPrev ? 'good' : ''}">${diff(st.gym, st.gymPrev, String)}</span></div>
      <div class="tile"><span class="k">Spending</span><span class="v">${gbp(Math.round(st.spend))}</span><span class="s ${st.planned && st.spend <= st.planned ? 'good' : st.planned ? 'bad' : ''}">${st.planned ? (st.spend <= st.planned ? `${gbp(Math.round(st.planned - st.spend))} under plan` : `${gbp(Math.round(st.spend - st.planned))} over plan`) : 'No budget set'}</span></div>
      <div class="tile"><span class="k">Tasks done</span><span class="v">${st.tasksDone}</span><span class="s">${S.tasks.filter((x) => !x.done && x.due_date && x.due_date <= we && x.due_date < t).length} still overdue</span></div>
    </section>
    <div class="desk-grid">
      <div class="col">
        ${said.length ? `<section class="card soft" aria-label="Last week's commitments"><div class="card-head"><h2>You said you'd…</h2></div><ol class="commit">${said.map((c) => `<li>${esc(c)}</li>`).join('')}</ol><span class="meta" style="color:var(--green-deep)">Did you? Be honest in the notes below.</span></section>` : ''}
        <section class="card" aria-label="What slipped">
          <div class="card-head"><h2>What slipped</h2></div>
          ${st.slipped.length ? `<ul class="slipped">${st.slipped.map((s) => `<li>${esc(s)}</li>`).join('')}</ul>` : '<p class="empty">Nothing slipped. Great week.</p>'}
        </section>
      </div>
      <div class="col">
        <form class="card" data-form="review" data-week="${ws}" autocomplete="off">
          <label class="field"><span>What went well?</span><textarea name="went_well" class="input" maxlength="1000">${esc(rev?.went_well || '')}</textarea></label>
          <label class="field"><span>What got in the way?</span><textarea name="slipped" class="input" maxlength="1000">${esc(rev?.slipped || '')}</textarea></label>
          <div class="field"><span>Next week I will…</span>
            ${[0, 1, 2].map((i) => `<label class="sr" for="c${i}">Commitment ${i + 1}</label><input id="c${i}" name="c${i}" class="input" maxlength="140" value="${esc(cm[i] || '')}" placeholder="${['e.g. Hit the gym 4 times', 'e.g. Finish case study 2', 'Third commitment (optional)'][i]}">`).join('')}
          </div>
          <button class="btn primary" type="submit">${rev ? 'Update review' : 'Save review'}</button>
          ${rev ? '<span class="meta">Saved. Your commitments will show on Today next week.</span>' : ''}
        </form>
      </div>
    </div>`;
}

const VIEWS = { today: viewToday, tasks: viewTasks, work: viewWork, gym: viewGym, money: viewMoney, review: viewReview };

/* =====================================================================
   Sheets (bottom-sheet dialogs)
   ===================================================================== */
const sheet = () => $('#sheet');
function openSheet(title, body) {
  sheet().innerHTML = `<div class="sheet-inner"><div class="sheet-head"><h2 id="sheet-title">${title}</h2><button type="button" class="icon-btn" data-act="close-sheet" aria-label="Close">${icon('close')}</button></div>${body}</div>`;
  if (!sheet().open) sheet().showModal();
  const first = sheet().querySelector('[data-autofocus]') || sheet().querySelector('input:not([type=hidden]):not([type=radio]):not([type=checkbox]), textarea');
  if (first && (first.dataset.autofocus || window.matchMedia('(min-width: 640px)').matches)) first.focus();
}
const closeSheet = () => { if (sheet().open) sheet().close(); };

function sessionForm({ minutes = 60, kind = 'full', date = today(), title = 'Log session' } = {}) {
  const projects = [...new Set(S.sessions.map((s) => s.project).filter(Boolean))].slice(0, 12);
  openSheet(title, `
    <form data-form="session" autocomplete="off" class="stack">
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
    <form data-form="${t ? 'task-edit' : 'task'}" ${t ? `data-id="${t.id}"` : ''} data-close="1" autocomplete="off" class="stack">
      <label class="field"><span>Task</span><input name="title" class="input" required maxlength="200" value="${esc(t?.title || '')}" placeholder="What needs doing?"></label>
      <div class="form-grid">
        <label class="field"><span>Due</span><input type="date" name="due_date" class="input" value="${t ? (t.due_date || '') : today()}"></label>
        <label class="field"><span>Area</span><select name="area" class="input">${AREAS.map((a) => `<option value="${a}" ${a === (t?.area || 'personal') ? 'selected' : ''}>${cap(a)}</option>`).join('')}</select></label>
      </div>
      <button class="btn primary" type="submit">${t ? 'Save' : 'Add task'}</button>
      ${t ? `<button type="button" class="btn danger" data-act="delete-task" data-id="${t.id}">Delete task</button>` : `
        <div class="quick-grid">
          <button type="button" class="btn small" data-act="add-expense">${icon('money', 18)} Expense</button>
          <button type="button" class="btn small" data-act="log-session">${icon('work', 18)} Freelance time</button>
          <button type="button" class="btn small" data-act="goto-gym">${icon('gym', 18)} Workout</button>
        </div>`}
    </form>`);
}

function expenseForm(e = null) {
  const lastCat = e?.category_id || store.get('lastCat') || S.cats[0]?.id;
  const descs = [...new Set(S.expenses.map((x) => x.description).filter(Boolean))].slice(0, 30);
  openSheet(e ? 'Edit expense' : 'Add expense', `
    <form data-form="${e ? 'expense-edit' : 'expense'}" ${e ? `data-id="${e.id}"` : ''} data-close="1" autocomplete="off" class="stack">
      <label class="field"><span>Amount (£)</span><input name="amount" class="input amount" type="number" inputmode="decimal" step="0.01" min="0.01" max="1000000" required value="${e ? Number(e.amount) : ''}" placeholder="0.00" ${e ? '' : 'data-autofocus="1"'}></label>
      <fieldset class="field" style="border:0;padding:0;margin:0"><legend class="legend-lbl">Category</legend>
        <div class="pick">${S.cats.map((c) => `<label><input type="radio" name="category_id" value="${c.id}" ${c.id === lastCat ? 'checked' : ''}><span>${esc(c.name)}</span></label>`).join('')}</div>
      </fieldset>
      <label class="field"><span>What was it? (optional)</span><input name="description" class="input" list="descs" maxlength="120" value="${esc(e?.description || '')}" placeholder="e.g. Tesco"><datalist id="descs">${descs.map((d) => `<option value="${esc(d)}">`).join('')}</datalist></label>
      <div class="form-grid">
        <label class="field"><span>Date</span><input type="date" name="spent_on" class="input" value="${e?.spent_on || today()}" required></label>
        <label class="check-line"><input type="checkbox" class="check" name="is_recurring" ${e?.is_recurring ? 'checked' : ''}><span>Monthly bill</span></label>
      </div>
      <button class="btn primary" type="submit">${e ? 'Save' : 'Add expense'}</button>
      ${e ? `<button type="button" class="btn danger" data-act="delete-expense" data-id="${e.id}">Delete expense</button>` : ''}
    </form>`);
}

function catForm(c = null) {
  openSheet(c ? esc(c.name) : 'New category', `
    <form data-form="${c ? 'cat-edit' : 'cat'}" ${c ? `data-id="${c.id}"` : ''} data-close="1" autocomplete="off" class="stack">
      <label class="field"><span>Name</span><input name="name" class="input" required maxlength="40" value="${esc(c?.name || '')}"></label>
      <label class="field"><span>Monthly budget (£) — leave blank for none</span><input name="monthly_budget" class="input" type="number" inputmode="decimal" step="1" min="0" value="${c?.monthly_budget ?? ''}"></label>
      <button class="btn primary" type="submit">Save</button>
      ${c ? `<button type="button" class="btn danger" data-act="delete-cat" data-id="${c.id}">Delete category</button><p class="meta">Deleting keeps its expenses (they become uncategorised).</p>` : ''}
    </form>`);
}

function workoutSheet(w) {
  const ss = setsFor(w.id);
  const order = [...new Set(ss.map((s) => s.exercise))];
  openSheet(esc(w.name || 'Workout'), `
    <p class="meta">${esc(fmtLong(localDay(w.started_at)))} · ${fmtMins(workoutMinutes(w))}</p>
    ${order.map((ex) => `<div class="row"><span class="grow"><span class="title">${esc(ex)}</span><span class="sub">${esc(setsLine(ss.filter((s) => s.exercise === ex)))}</span></span></div>`).join('') || '<p class="empty">No sets logged.</p>'}
    <button type="button" class="btn danger" data-act="delete-workout" data-id="${w.id}">Delete workout</button>`);
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
const askFirst = (msg, fn) => { if (confirm(msg)) fn(); };

const ACTIONS = {
  'close-sheet': closeSheet,
  'account': (el, e) => { e.preventDefault(); accountSheet(); },
  'fab': () => (route() === 'money' ? expenseForm() : taskForm()),
  'edit-task': (el) => taskForm(byId(S.tasks, el.dataset.id)),
  'toggle-done': () => { S.showDone = !S.showDone; render(); },
  'task-area': (el, e) => { e.preventDefault(); S.taskArea = el.dataset.area; render(); },
  'goto-gym': () => { closeSheet(); location.hash = '#/gym'; },

  'snooze': (el) => run(async () => {
    const t = byId(S.tasks, el.dataset.id);
    const base = t.due_date && t.due_date > today() ? t.due_date : today();
    replaceIn(S.tasks, await update('tasks', t.id, { due_date: addDays(base, 1), times_moved: (t.times_moved || 0) + 1 }));
  }, 'Moved to tomorrow'),
  'delete-task': (el) => run(async () => { await remove('tasks', el.dataset.id); S.tasks = S.tasks.filter((x) => x.id !== el.dataset.id); closeSheet(); }, 'Task deleted'),

  'delete-milestone': (el) => run(async () => { await remove('milestones', el.dataset.id); S.milestones = S.milestones.filter((m) => m.id !== el.dataset.id); }),
  'goal-done': (el) => run(async () => { replaceIn(S.goals, await update('goals', el.dataset.id, { status: 'done' })); }, 'Goal achieved — well done'),
  'goal-drop': (el) => askFirst('Delete this goal and its milestones?', () => run(async () => { await remove('goals', el.dataset.id); S.goals = S.goals.filter((g) => g.id !== el.dataset.id); }, 'Goal deleted')),

  // Freelance
  'start-timer': () => { store.set('timer', { start: Date.now() }); closeSheet(); if (!['work', 'today'].includes(route())) location.hash = '#/work'; render(); toast('Session started — good.'); },
  'stop-timer': () => { const tm = store.get('timer'); if (tm) sessionForm({ minutes: Math.max(1, Math.round((Date.now() - tm.start) / 60000)), title: 'Nice work — log it' }); },
  'discard-timer': () => askFirst('Discard this session without logging it?', () => { store.set('timer', null); render(); }),
  'log-minimum': () => sessionForm({ minutes: MINIMUM_MINUTES, kind: 'minimum', title: 'Bad-day minimum' }),
  'log-session': (el) => sessionForm({ date: el.dataset.date || today() }),
  'delete-session': (el) => askFirst('Delete this session?', () => run(async () => { await remove('work_sessions', el.dataset.id); S.sessions = S.sessions.filter((s) => s.id !== el.dataset.id); }, 'Session deleted')),
  'add-day-off': () => openSheet('Plan a day away', `
    <form data-form="day-off" data-close="1" class="stack">
      <label class="field"><span>Date</span><input type="date" name="off_date" class="input" min="${today()}" value="${today()}" required></label>
      <label class="field"><span>Reason (optional)</span><input name="reason" class="input" maxlength="80" placeholder="e.g. Weekend in the Lakes"></label>
      <button class="btn primary" type="submit">Save</button>
    </form>`),
  'delete-day-off': (el) => run(async () => { await remove('days_off', el.dataset.id); S.daysOff = S.daysOff.filter((o) => o.id !== el.dataset.id); }),

  // Gym
  'start-named': (el) => startWorkout(el.dataset.name),
  'finish-workout': (el) => run(async () => {
    const w = byId(S.workouts, el.dataset.id);
    if (!setsFor(w.id).length) { await remove('workouts', w.id); S.workouts = S.workouts.filter((x) => x.id !== w.id); return; }
    replaceIn(S.workouts, await update('workouts', w.id, { ended_at: new Date().toISOString() }));
  }, 'Workout saved — nice work'),
  'discard-workout': (el) => askFirst('Discard this workout and its sets?', () => run(async () => { await remove('workouts', el.dataset.id); S.workouts = S.workouts.filter((x) => x.id !== el.dataset.id); S.sets = S.sets.filter((s) => s.workout_id !== el.dataset.id); }, 'Workout discarded')),
  'delete-set': (el) => run(async () => { await remove('workout_sets', el.dataset.id); S.sets = S.sets.filter((s) => s.id !== el.dataset.id); }),
  'show-workout': (el) => workoutSheet(byId(S.workouts, el.dataset.id)),
  'delete-workout': (el) => askFirst('Delete this workout?', () => run(async () => { await remove('workouts', el.dataset.id); S.workouts = S.workouts.filter((x) => x.id !== el.dataset.id); S.sets = S.sets.filter((s) => s.workout_id !== el.dataset.id); closeSheet(); }, 'Workout deleted')),

  // Money
  'add-expense': () => expenseForm(),
  'edit-expense': (el) => expenseForm(byId(S.expenses, el.dataset.id)),
  'delete-expense': (el) => run(async () => { await remove('expenses', el.dataset.id); S.expenses = S.expenses.filter((x) => x.id !== el.dataset.id); closeSheet(); }, 'Expense deleted'),
  'month': (el) => { const n = addMonths(S.month, Number(el.dataset.dir)); if (n <= monthOf(today())) { S.month = n; render(); } },
  'add-cat': () => catForm(),
  'edit-cat': (el) => catForm(byId(S.cats, el.dataset.id)),
  'delete-cat': (el) => askFirst('Delete this category? Its expenses are kept.', () => run(async () => {
    await remove('expense_categories', el.dataset.id); S.cats = S.cats.filter((c) => c.id !== el.dataset.id);
    S.expenses.forEach((x) => { if (x.category_id === el.dataset.id) x.category_id = null; }); closeSheet();
  }, 'Category deleted')),
  'add-recurring': () => run(async () => {
    const m = S.month;
    const rows = missingRecurring(m).map((p) => ({ amount: p.amount, category_id: p.category_id, description: p.description, is_recurring: true, spent_on: `${m}-${pad(Math.min(parseYmd(p.spent_on).getDate(), daysInMonth(m)))}` }));
    const saved = await q(sb.from('expenses').insert(rows).select());
    S.expenses.unshift(...saved); S.expenses.sort((a, b) => b.spent_on.localeCompare(a.spent_on));
  }, 'Recurring bills added'),

  // Review
  'review-week': (el) => { const cur = S.reviewWeek || weekStart(today()); const n = addDays(cur, 7 * Number(el.dataset.dir)); if (n <= weekStart(today())) { S.reviewWeek = n; render(); } },

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

function startWorkout(name) {
  return run(async () => {
    if (activeWorkout()) return;
    S.workouts.unshift(await insert('workouts', { name: (name || '').trim() || null, started_at: new Date().toISOString() }));
    if (route() !== 'gym') location.hash = '#/gym';
  }, 'Workout started');
}

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

const money = (v) => Math.round(Number(v) * 100) / 100;
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
    S.milestones.push(await insert('milestones', { goal_id: gid, title: f.get('title').trim(), sort_order: S.milestones.filter((m) => m.goal_id === gid).length }));
  }),
  session: (f) => run(async () => {
    const saved = await insert('work_sessions', {
      minutes: Number(f.get('minutes')), kind: f.get('kind'), session_on: f.get('session_on'),
      project: f.get('project').trim() || null, next_step: f.get('next_step').trim() || null,
    });
    S.sessions.unshift(saved);
    S.sessions.sort((a, b) => b.session_on.localeCompare(a.session_on) || (b.created_at || '').localeCompare(a.created_at || ''));
    store.set('timer', null); closeSheet();
  }, 'Session logged ✓'),
  'day-off': (f) => run(async () => {
    S.daysOff.push(await insert('days_off', { off_date: f.get('off_date'), reason: f.get('reason').trim() || null }));
    S.daysOff.sort((a, b) => a.off_date.localeCompare(b.off_date));
  }, 'Saved — that day won\'t count as a miss'),

  'start-workout': (f) => startWorkout(f.get('name')),
  set: (f) => run(async () => {
    const w = activeWorkout(); if (!w) return;
    const exercise = f.get('exercise').trim(); if (!exercise) return;
    const existing = setsFor(w.id).filter((s) => norm(s.exercise) === norm(exercise));
    const name = existing[0]?.exercise || exerciseNames().find((n) => norm(n) === norm(exercise)) || exercise;
    const wkg = f.get('weight_kg'), reps = f.get('reps');
    S.sets.push(await insert('workout_sets', { workout_id: w.id, exercise: name, set_number: existing.length + 1, weight_kg: wkg === '' ? null : Number(wkg), reps: reps === '' ? null : Number(reps) }));
  }, 'Set logged'),

  expense: (f) => run(async () => {
    const row = { amount: money(f.get('amount')), category_id: f.get('category_id') || null, description: f.get('description').trim() || null, spent_on: f.get('spent_on'), is_recurring: f.get('is_recurring') === 'on' };
    store.set('lastCat', row.category_id);
    S.expenses.unshift(await insert('expenses', row)); S.expenses.sort((a, b) => b.spent_on.localeCompare(a.spent_on));
  }, 'Expense added'),
  'expense-edit': (f, form) => run(async () => {
    replaceIn(S.expenses, await update('expenses', form.dataset.id, { amount: money(f.get('amount')), category_id: f.get('category_id') || null, description: f.get('description').trim() || null, spent_on: f.get('spent_on'), is_recurring: f.get('is_recurring') === 'on' }));
    S.expenses.sort((a, b) => b.spent_on.localeCompare(a.spent_on));
  }, 'Saved'),
  cat: (f) => run(async () => {
    S.cats.push(await insert('expense_categories', { name: f.get('name').trim(), monthly_budget: f.get('monthly_budget') === '' ? null : money(f.get('monthly_budget')), sort_order: S.cats.length }));
  }, 'Category added'),
  'cat-edit': (f, form) => run(async () => {
    replaceIn(S.cats, await update('expense_categories', form.dataset.id, { name: f.get('name').trim(), monthly_budget: f.get('monthly_budget') === '' ? null : money(f.get('monthly_budget')) }));
  }, 'Saved'),

  review: (f, form) => run(async () => {
    const ws = form.dataset.week;
    const row = { went_well: f.get('went_well').trim() || null, slipped: f.get('slipped').trim() || null, commitments: [0, 1, 2].map((i) => f.get('c' + i).trim()).filter(Boolean) };
    const ex = reviewFor(ws);
    const saved = ex ? await update('weekly_reviews', ex.id, row) : await insert('weekly_reviews', { ...row, week_start: ws });
    replaceIn(S.reviews, saved);
  }, 'Review saved'),
};

document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-act]');
  if (!el || el.disabled || !ACTIONS[el.dataset.act]) return;
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
  const fd = new FormData(form);
  const btn = form.querySelector('[type=submit]'); if (btn) btn.disabled = true;
  if (form.dataset.close) closeSheet();
  FORMS[form.dataset.form](fd, form);
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
  clearInterval(ticker);
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
