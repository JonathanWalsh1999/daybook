import { SUPABASE_URL, SUPABASE_KEY, WORK_TARGET_MINUTES, WORK_DAYS, MINIMUM_MINUTES, GYM_TARGET_PER_WEEK, VAPID_PUBLIC_KEY } from './config.js';

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
  town: '<path d="M3 20h18M5 20V10l4-2v12M9 20V5l6 3v12M15 20v-7l4-2v9"/>',
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
  allReminders: [], breaks: [], policies: [], profile: null, tasksDoneCount: 0, needsUpdate: false, pushState: null,
  openGoals: new Set(), taskArea: 'all', showDone: false,
  month: monthOf(today()), reviewWeek: null,
};

async function q(p) { const { data, error } = await p; if (error) throw error; return data; }
const insert = (table, row) => q(sb.from(table).insert(row).select().single());
const update = (table, id, patch) => q(sb.from(table).update(patch).eq('id', id).select().single());
const remove = (table, id) => q(sb.from(table).delete().eq('id', id));
const replaceIn = (arr, row) => { const i = arr.findIndex((x) => x.id === row.id); if (i >= 0) arr[i] = row; else arr.push(row); };
const byId = (arr, id) => arr.find((x) => x.id === id);

// Tables added in update 2 may not exist yet: load them softly and flag the update.
async function soft(p, fallback = []) { const { data, error } = await p; if (error) { S.needsUpdate = true; return fallback; } return data; }
async function loadAll() {
  const setsSince = parseYmd(addDays(today(), -180)).toISOString();
  const doneSince = new Date(Date.now() - 60 * 864e5).toISOString();
  S.needsUpdate = false;
  const [open, done, doneCount, sessions, daysOff, goals, milestones, reminders, workouts, sets, cats, expenses, reviews, breaks, policies, profile] = await Promise.all([
    q(sb.from('tasks').select('*').eq('done', false).order('due_date', { ascending: true, nullsFirst: false }).order('created_at')),
    q(sb.from('tasks').select('*').eq('done', true).gte('done_at', doneSince).order('done_at', { ascending: false })),
    sb.from('tasks').select('id', { count: 'exact', head: true }).eq('done', true).then((r) => r.count || 0),
    q(sb.from('work_sessions').select('*').order('session_on', { ascending: false }).order('created_at', { ascending: false })),
    q(sb.from('days_off').select('*').order('off_date')),
    q(sb.from('goals').select('*').neq('status', 'dropped').order('created_at')),
    q(sb.from('milestones').select('*').order('sort_order').order('title')),
    q(sb.from('reminders').select('*').order('weekday').order('remind_at')),
    q(sb.from('workouts').select('*').order('started_at', { ascending: false })),
    q(sb.from('workout_sets').select('*').gte('created_at', setsSince).order('created_at')),
    q(sb.from('expense_categories').select('*').order('sort_order').order('name')),
    q(sb.from('expenses').select('*').order('spent_on', { ascending: false }).order('created_at', { ascending: false })),
    q(sb.from('weekly_reviews').select('*').order('week_start', { ascending: false })),
    soft(sb.from('breaks').select('*').order('start_date', { ascending: false })),
    soft(sb.from('policies').select('*').order('created_at')),
    soft(sb.from('profiles').select('*').maybeSingle(), null),
  ]);
  Object.assign(S, { tasks: [...open, ...done], tasksDoneCount: Math.max(doneCount, done.length), sessions, daysOff, goals, milestones, allReminders: reminders, reminders: reminders.filter((r) => r.active), workouts, sets, cats, expenses, reviews, breaks, policies, profile, loadedAt: Date.now() });
  applyTheme();
}
const applyTheme = () => { document.documentElement.dataset.theme = S.profile?.theme === 'dark' ? 'dark' : 'light'; };

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
  if (!S.profile && !S.needsUpdate) await soft(sb.from('profiles').insert({}).select().single(), null);
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
  if (isPaused(slot)) return 'paused';
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
  if (isPaused()) return null;
  const past = recentSlots(3).filter((s) => !['pending', 'before', 'paused', 'away'].includes(s.status));
  const last = past[past.length - 1];
  if (!last || last.status !== 'missed') return null;
  const prev = past[past.length - 2];
  if (prev && prev.status === 'missed') return `Two missed on the bounce. Reset with just ${MINIMUM_MINUTES} minutes — it genuinely counts.`;
  return `Missed ${DAY_LONG[isoWeekday(last.slot)]}'s session. Not ideal, not a disaster — just don't miss twice.`;
}

// --- Gym ---
const activeWorkout = () => S.workouts.find((w) => !w.ended_at) || null;
const setsFor = (wid) => S.sets.filter((s) => s.workout_id === wid);
const gymDays = (from, to) => [...new Set(S.workouts.map((w) => localDay(w.started_at)).filter((d) => d >= from && d <= to))];
const isCardio = (s) => s.kind === 'cardio';
const exerciseNames = (cardio = false) => [...new Set(S.sets.slice().reverse().filter((s) => isCardio(s) === cardio).map((s) => s.exercise))];
const CARDIO_SUGGEST = ['Treadmill', 'Bike', 'Rowing', 'Cross-trainer', 'Stair climber', 'Run', 'Swim'];
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
  const cardioSets = S.sets.filter((s) => isCardio(s) && norm(s.exercise) === norm(exercise));
  if (cardioSets.length) {
    for (const s of cardioSets) {
      const d = Number(s.distance_km) || 0, m = Number(s.duration_min) || 0;
      if (!best || d > (Number(best.distance_km) || 0) || (d === (Number(best.distance_km) || 0) && m > (Number(best.duration_min) || 0))) best = s;
    }
    return best;
  }
  for (const s of S.sets) {
    if (norm(s.exercise) !== norm(exercise) || s.weight_kg == null) continue;
    if (!best || Number(s.weight_kg) > Number(best.weight_kg) || (Number(s.weight_kg) === Number(best.weight_kg) && (s.reps || 0) > (best.reps || 0))) best = s;
  }
  return best;
}
const kg = (n) => (n == null ? '—' : `${Number(n)}kg`);
const pace = (s) => (s.distance_km && s.duration_min ? (() => { const p = Number(s.duration_min) / Number(s.distance_km); return `${Math.floor(p)}:${pad(Math.round((p % 1) * 60))}/km`; })() : '');
const cardioLine = (s) => [s.duration_min != null ? `${Number(s.duration_min)} min` : null, s.distance_km != null ? `${Number(s.distance_km)} km` : null].filter(Boolean).join(', ') || '—';
const bestLabel = (b) => (isCardio(b) ? cardioLine(b) : `${kg(b.weight_kg)} × ${b.reps ?? '—'}`);
const setsLine = (ss) => { if (ss.length && isCardio(ss[0])) return ss.map(cardioLine).join(' + ');
  const w = ss[0]?.weight_kg; return ss.every((s) => s.weight_kg === w) ? `${kg(w)} × ${ss.map((s) => s.reps ?? '—').join(', ')}` : ss.map((s) => `${kg(s.weight_kg)}×${s.reps ?? '—'}`).join(', '); };
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
   Personality: British, dry, kind. Lines are picked once per day so they don't flicker.
   ===================================================================== */
const hash = (s) => { let h = 2166136261; for (const c of s) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return h >>> 0; };
const daily = (arr, salt = '') => arr[hash(today() + salt) % arr.length];
const any = (arr) => arr[Math.floor(Math.random() * arr.length)];
const Q = {
  morning: ['Kettle first, ambition second.', "Let's make today mildly heroic.", "Rise and shine. Or just rise; shining's optional.", 'Fresh day. Try not to spill it.'],
  afternoon: ['Still plenty of time to be impressive.', "Nothing a cup of tea can't fix.", 'Halfway there. Probably.'],
  evening: ['The telly can wait five minutes.', 'One small win before the sofa?', 'Evening. Feet up soon, promise.'],
  night: ['Burning the midnight oil? Bold.', "It's late. Future you would like some sleep."],
  done: ['Done. Have a biscuit.', 'Ticked. Very civilised.', 'Smashed it. Modestly, of course.', 'One less thing. Lovely.', 'Sorted. Put the kettle on.'],
  set: ['Lovely stuff.', 'Another one for the books.', 'Strong. Literally.', 'Your future self is impressed.'],
  expense: ["Noted. We won't tell anyone.", 'Logged. The Treasury thanks you.', 'Receipt filed. Mentally.'],
  session: ['Look at you, being a professional.', 'Logged. The Studio lot twitches with anticipation.', 'Nice one. Next step saved for later.'],
  emptyDue: ["Nothing due. Suspicious, but we'll allow it.", 'Nothing due today. Enjoy the rare calm.', 'Clear skies on the to-do front.'],
  quips: {
    gym: ['Lift heavy things. Put them down again.', 'Sweat now, smug later.'],
    money: ['Every pound a job. Even the pizza ones.', 'The Treasury is open for business.'],
    work: ['Building the side hustle, one Monday at a time.', "VR, 360, Unity — and a fair bit of tea."],
    tasks: ['Life admin: thrilling, necessary, done.', "If it's written down, it's half done. Roughly."],
    town: ['Population: you, mostly.', 'Planning permission granted.'],
  },
};
const greeting = () => { const h = new Date().getHours(); return h < 5 ? ['Still up?', daily(Q.night)] : h < 12 ? ['Good morning', daily(Q.morning)] : h < 18 ? ['Good afternoon', daily(Q.afternoon)] : ['Good evening', daily(Q.evening)]; };

/* =====================================================================
   Breaks (ill / holiday / rest): streaks freeze, targets shrink, nudges go quiet.
   ===================================================================== */
const breakCovers = (b, d) => b.start_date <= d && (!b.end_date || b.end_date >= d);
const isPaused = (d = today()) => S.breaks.some((b) => breakCovers(b, d));
const activeBreak = () => S.breaks.find((b) => breakCovers(b, today())) || null;
const pausedDays = (from, to) => { let n = 0; for (let d = from; d <= to; d = addDays(d, 1)) if (isPaused(d)) n++; return n; };
const activeRatio = (ws) => (7 - pausedDays(ws, addDays(ws, 6))) / 7;
const gymTarget = (ws = weekStart(today())) => Math.round(GYM_TARGET_PER_WEEK * activeRatio(ws));
const workTarget = (ws = weekStart(today())) => Math.round((WORK_TARGET_MINUTES * activeRatio(ws)) / 5) * 5;
const BREAK_LABEL = { ill: 'Off sick', holiday: 'On holiday', rest: 'Rest day' };
const BREAK_LINE = {
  ill: 'Get well soon. Tea, toast and absolutely no guilt.',
  holiday: 'Enjoy it. The town will cope without you. Just about.',
  rest: 'Rest day, approved by the council. Very sensible.',
};
function recentReturn() { // a break of 2+ days that ended in the last 3 days
  const t = today();
  return S.breaks.filter((b) => b.end_date && b.end_date < t && b.end_date >= addDays(t, -3) && (parseYmd(b.end_date) - parseYmd(b.start_date)) / 864e5 >= 1)
    .sort((a, b) => b.end_date.localeCompare(a.end_date))[0] || null;
}

/* =====================================================================
   The town: growth points, levels, buildings, districts, policies
   ===================================================================== */
const LEVELS = [[0, 'Muddy field'], [100, 'Hamlet'], [250, 'Village'], [500, 'Market town'], [900, 'Spa town'], [1400, 'County town'], [2000, 'Cathedral city'], [2800, 'Great city'], [3800, 'Northern powerhouse'], [5000, 'Capital of the North']];
const UNLOCKS = [
  { level: 2, key: 'night', text: 'Night mode (in Settings)' },
  { level: 3, key: 'slot4', text: 'A 4th policy slot' },
  { level: 5, key: 'slot5', text: 'A 5th policy slot' },
];
const levelFor = (xp) => { let i = 0; while (i + 1 < LEVELS.length && xp >= LEVELS[i + 1][0]) i++; return { idx: i, name: LEVELS[i][1], floor: LEVELS[i][0], next: LEVELS[i + 1] || null }; };
const unlocked = (key) => { const u = UNLOCKS.find((x) => x.key === key); return !!u && town().level.idx >= u.level; };
const policySlots = () => 3 + (unlocked('slot4') ? 1 : 0) + (unlocked('slot5') ? 1 : 0);

function monthsOnBudget() {
  const b = budgetTotal(); if (!b) return [];
  const months = [...new Set(S.expenses.map((e) => monthOf(e.spent_on)))].filter((m) => m < monthOf(today()));
  return months.filter((m) => sum(monthExpenses(m), (e) => e.amount) <= b + 0.5);
}
function paidJobDone() {
  return S.milestones.some((m) => m.done && /paid job/i.test(m.title)) || S.goals.some((g) => g.status === 'done' && g.area === 'freelance');
}
function townStats() {
  const endedWorkouts = S.workouts.filter((w) => w.ended_at);
  return {
    workouts: endedWorkouts.length, sessions: S.sessions.length, tasksDone: S.tasksDoneCount,
    expenses: S.expenses.length, onBudget: monthsOnBudget().length, reviews: S.reviews.length, paidJob: paidJobDone(),
  };
}

// Every lot on the map: [i, j, width, depth], height in px, roof or not, and how to unlock it.
const BUILDINGS = [
  { id: 'shed', name: 'Gym shed', d: 'health', lot: [2, 2, 1, 1], h: 14, stat: 'workouts', need: 1, how: 'Finish your first workout' },
  { id: 'leisure', name: 'Leisure centre', d: 'health', lot: [0, 0, 2, 1], h: 28, stat: 'workouts', need: 25, how: '25 workouts' },
  { id: 'stadium', name: 'Stadium', d: 'health', lot: [0, 1, 2, 2], h: 14, stat: 'workouts', need: 100, how: '100 workouts' },
  { id: 'workshop', name: 'Workshop', d: 'industry', lot: [0, 4, 1, 1], h: 16, stat: 'sessions', need: 1, how: 'Log a freelance session' },
  { id: 'studio', name: 'VR Studio', d: 'industry', lot: [1, 4, 2, 2], h: 24, stat: 'paidJob', need: 1, how: 'Land your first paid job' },
  { id: 'campus', name: 'Tech campus', d: 'industry', lot: [0, 6, 2, 2], h: 48, stat: 'sessions', need: 50, how: '50 freelance sessions' },
  { id: 'kiosk', name: 'Money kiosk', d: 'treasury', lot: [4, 2, 1, 1], h: 10, stat: 'expenses', need: 1, how: 'Log your first expense' },
  { id: 'bank', name: 'Bank', d: 'treasury', lot: [5, 1, 2, 2], h: 26, stat: 'onBudget', need: 1, how: 'Finish a month on budget' },
  { id: 'exchange', name: 'Stock exchange', d: 'treasury', lot: [7, 0, 1, 2], h: 60, stat: 'onBudget', need: 6, how: '6 months on budget' },
  { id: 'cottage', name: 'Cottage', d: 'services', lot: [4, 4, 1, 1], h: 12, roof: true, stat: 'tasksDone', need: 1, how: 'Tick off a task' },
  { id: 'terrace', name: 'Terrace', d: 'services', lot: [5, 4, 2, 1], h: 16, roof: true, stat: 'tasksDone', need: 25, how: '25 tasks done' },
  { id: 'townhall', name: 'Town hall', d: 'services', lot: [4, 6, 2, 2], h: 26, roof: true, stat: 'reviews', need: 1, how: 'Publish your first Gazette' },
  { id: 'clock', name: 'Clock tower', d: 'services', lot: [6, 6, 1, 1], h: 58, roof: true, stat: 'reviews', need: 10, how: '10 Gazettes' },
];
const TREES = [[2, 0], [2, 1], [4, 0], [5, 0], [6, 0], [4, 1], [2, 6], [2, 7], [6, 5], [7, 4], [7, 5], [7, 6], [7, 7], [6, 7], [1, 3.9], [0, 5]];
const statVal = (st, key) => (key === 'paidJob' ? (st.paidJob ? 1 : 0) : st[key] || 0);

// Growth points are worked out from what you've logged, so they can never be lost.
function growthEvents() {
  const ev = []; const add = (date, pts, src, what) => ev.push({ date, pts, src, what });
  S.workouts.filter((w) => w.ended_at).forEach((w) => add(localDay(w.started_at), 15, 'health', 'workout'));
  S.sessions.forEach((s) => add(s.session_on, Math.min(30, Math.max(10, Math.round(s.minutes / 4))), 'industry', 'session'));
  const doneLoaded = S.tasks.filter((x) => x.done && x.done_at);
  doneLoaded.forEach((x) => add(localDay(x.done_at), 3, 'services', 'task'));
  const older = Math.max(0, S.tasksDoneCount - doneLoaded.length); if (older) add('0000-00-00', older * 3, 'services', 'task');
  S.milestones.filter((m) => m.done).forEach((m) => add(m.done_at ? localDay(m.done_at) : '0000-00-00', 20, 'town', 'milestone'));
  S.reviews.forEach((r) => add(addDays(r.week_start, 6), 25, 'town', 'gazette'));
  monthsOnBudget().forEach((m) => add(`${m}-${pad(daysInMonth(m))}`, 40, 'treasury', 'month'));
  const perMonth = {};
  S.expenses.slice().sort((a, b) => a.spent_on.localeCompare(b.spent_on)).forEach((e) => { const m = monthOf(e.spent_on); perMonth[m] = (perMonth[m] || 0) + 1; if (perMonth[m] <= 30) add(e.spent_on, 1, 'treasury', 'expense'); });
  S.policies.filter((p) => p.active).forEach((p) => {
    for (let ws = weekStart(localDay(p.created_at)); addDays(ws, 6) < today(); ws = addDays(ws, 7)) {
      if (activeRatio(ws) > 0 && policyUpheld(p, ws)) add(addDays(ws, 6), 10, 'town', 'policy');
    }
  });
  return ev;
}
let townCache = null; let townCacheKey = '';
function town() {
  const key = `${S.loadedAt}|${S.tasks.length}|${S.sessions.length}|${S.workouts.length}|${S.expenses.length}|${S.reviews.length}|${S.policies.length}|${S.milestones.filter((m) => m.done).length}|${S.tasks.filter((t) => t.done).length}|${S.workouts.filter((w) => w.ended_at).length}|${S.breaks.length}`;
  if (townCache && key === townCacheKey) return townCache;
  const ev = growthEvents();
  const xp = sum(ev, (e) => e.pts);
  const ws = weekStart(today());
  const week = ev.filter((e) => e.date >= ws);
  const st = townStats();
  const built = BUILDINGS.filter((b) => statVal(st, b.stat) >= b.need).map((b) => b.id);
  townCache = { xp, level: levelFor(xp), weekXp: sum(week, (e) => e.pts), week, st, built };
  townCacheKey = key;
  return townCache;
}

const PAL = {
  health: ['#FF9A82', '#E8553B', '#B8361F'], industry: ['#A792FF', '#6D4AE8', '#4F2FC0'],
  treasury: ['#FFD766', '#F2B21B', '#C48A00'], services: ['#86CDF5', '#1C8FD6', '#0E6FAF'], roof: ['#F07A5F', '#C94A30'],
};
function townSvg(t) {
  const W = 22, H = 11, X0 = 184, Y0 = 70, N = 8;
  const pt = (i, j, z = 0) => [X0 + (i - j) * W, Y0 + (i + j) * H - z];
  const P = (ps) => ps.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
  const out = [];
  for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) {
    const road = i === 3 || j === 3;
    out.push(`<polygon points="${P([pt(i, j), pt(i + 1, j), pt(i + 1, j + 1), pt(i, j + 1)])}" fill="${road ? '#CFC8D6' : (i + j) % 2 ? '#A9DE8A' : '#B6E59A'}" stroke="${road ? '#BDB5C6' : '#9ACF7C'}" stroke-width="0.8"/>`);
  }
  // road markings
  for (let k = 0; k < N; k++) {
    if (k !== 3) { const [x1, y1] = pt(3.5, k + 0.2), [x2, y2] = pt(3.5, k + 0.8); out.push(`<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#fff" stroke-width="1.6" stroke-linecap="round"/>`); }
    if (k !== 3) { const [x1, y1] = pt(k + 0.2, 3.5), [x2, y2] = pt(k + 0.8, 3.5); out.push(`<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#fff" stroke-width="1.6" stroke-linecap="round"/>`); }
  }
  const items = [];
  const nextUp = BUILDINGS.filter((b) => !t.built.includes(b.id));
  BUILDINGS.forEach((b) => {
    const [i, j, w, d] = b.lot; const depth = i + j + w + d;
    if (!t.built.includes(b.id)) {
      items.push({ depth: depth - 100, svg: `<polygon points="${P([pt(i, j), pt(i + w, j), pt(i + w, j + d), pt(i, j + d)])}" fill="rgba(255,255,255,0.35)" stroke="#6F8F5E" stroke-width="1.2" stroke-dasharray="4 3"><title>Empty lot: ${esc(b.name)} — ${esc(b.how)}</title></polygon>` });
      return;
    }
    const [top, left, right] = PAL[b.d]; const h = b.h;
    const A = pt(i, j, h), B = pt(i + w, j, h), C = pt(i + w, j + d, h), E = pt(i, j + d, h), Bb = pt(i + w, j), Cc = pt(i + w, j + d), Ee = pt(i, j + d);
    let g = `<g stroke="#1E1B2E" stroke-width="1.2" stroke-linejoin="round"><title>${esc(b.name)}</title>`;
    g += `<polygon points="${P([E, C, Cc, Ee])}" fill="${left}"/><polygon points="${P([B, C, Cc, Bb])}" fill="${right}"/>`;
    if (b.roof) {
      const apex = pt(i + w / 2, j + d / 2, h + 14);
      g += `<polygon points="${P([E, C, apex])}" fill="${PAL.roof[0]}"/><polygon points="${P([B, C, apex])}" fill="${PAL.roof[1]}"/>`;
    } else {
      g += `<polygon points="${P([A, B, C, E])}" fill="${top}"/>`;
    }
    // windows on the right face
    const rows = Math.floor((h - 6) / 10);
    for (let r = 0; r < rows; r++) for (let c = 0; c < d * 2; c++) {
      const f = (c + 0.5) / (d * 2);
      const [wx, wy] = pt(i + w, j + d * f, 6 + r * 10);
      g += `<rect x="${(wx - 0.5).toFixed(1)}" y="${(wy - 5).toFixed(1)}" width="3" height="4" fill="#FFF3B8" stroke="none" transform="skewY(-26.6)" transform-origin="${wx} ${wy}"/>`;
    }
    g += '</g>';
    items.push({ depth, svg: g });
  });
  const trees = TREES.slice(0, Math.min(TREES.length, 3 + t.level.idx * 2));
  trees.forEach(([i, j]) => {
    const [x, y] = pt(i + 0.5, j + 0.5);
    items.push({ depth: i + j + 1.2, svg: `<g stroke="#1E1B2E" stroke-width="1.1"><rect x="${x - 1.5}" y="${y - 6}" width="3" height="7" fill="#8A5A2B"/><circle cx="${x}" cy="${y - 11}" r="7.5" fill="#3FAE6A"/></g>` });
  });
  items.sort((a, b) => a.depth - b.depth).forEach((it) => out.push(it.svg));
  const label = `Your town: ${t.built.length} of ${BUILDINGS.length} buildings built${nextUp[0] ? `. Next: ${nextUp[0].name}` : ''}`;
  return `<svg viewBox="0 0 368 250" role="img" aria-label="${esc(label)}">${out.join('')}</svg>`;
}

function districts() {
  const t = today(); const from = addDays(t, -13);
  const active14 = (14 - pausedDays(from, t)) / 14;
  const rate = (r, labels) => (r >= 1 ? labels[0] : r >= 0.66 ? labels[1] : r >= 0.33 ? labels[2] : labels[3]);
  const gym = gymDays(from, t).length; const gymT = Math.max(1, GYM_TARGET_PER_WEEK * 2 * active14);
  const mins = sum(S.sessions.filter((s) => s.session_on >= from), (s) => s.minutes); const workT = Math.max(15, WORK_TARGET_MINUTES * 2 * active14);
  const m = monthOf(t); const spent = sum(monthExpenses(m), (e) => e.amount); const b = budgetTotal();
  const plan = b * (parseYmd(t).getDate() / daysInMonth(m));
  const overdue = S.tasks.filter((x) => !x.done && x.due_date && x.due_date < t).length;
  return [
    { d: 'health', name: 'Health', href: '#/gym', v: `${gymDays(weekStart(t), t).length} / ${gymTarget()} gym`, pct: Math.max(gym / gymT, gymDays(weekStart(t), t).length / Math.max(1, gymTarget())) * 100, r: isPaused() ? 'Resting' : rate(Math.max(gym / gymT, gymDays(weekStart(t), t).length / Math.max(1, gymTarget())), ['Thriving', 'Healthy', 'Ticking over', 'Needs a visit']) },
    { d: 'industry', name: 'Industry', href: '#/work', v: `${fmtMins(weekMinutes())} / ${fmtMins(workTarget())}`, pct: Math.max(mins / workT, weekMinutes() / Math.max(15, workTarget())) * 100, r: isPaused() ? 'Resting' : rate(Math.max(mins / workT, weekMinutes() / Math.max(15, workTarget())), ['Booming', 'Busy', 'Building up', 'Tumbleweed']) },
    { d: 'treasury', name: 'Treasury', href: '#/money', v: b ? (spent <= b ? `${gbp(Math.round(b - spent))} left` : `${gbp(Math.round(spent - b))} over`) : gbp(Math.round(spent)), pct: b ? 100 - Math.max(0, ((spent - plan) / Math.max(1, b)) * 400) : 50, r: !b ? 'No budget set' : spent <= plan + 1 ? 'Balanced' : spent <= b ? 'A bit tight' : 'Overspent' },
    { d: 'services', name: 'Services', href: '#/tasks', v: `${S.tasks.filter((x) => x.done && x.done_at && localDay(x.done_at) >= weekStart(t)).length} done`, pct: Math.max(8, 100 - overdue * 20), r: overdue === 0 ? 'Running smoothly' : overdue <= 3 ? 'Bit of a queue' : 'Council backlog' },
  ];
}

// Policies you can enact. Each week one is kept earns +10 growth. Slipping just skips the bonus.
const POLICY_TYPES = {
  never_miss_twice: { title: 'Never miss twice', sub: 'Freelance: no two planned sessions missed in a row' },
  gym_target: { title: 'Hit the gym target', sub: `${GYM_TARGET_PER_WEEK} sessions a week (less on breaks)` },
  weekly_review: { title: 'Publish the Sunday Gazette', sub: 'Do the weekly review every week' },
  pay_first: { title: 'Pay yourself first', sub: 'A savings payment logged every month', needsCat: true },
  cap_category: { title: 'Stick to a category budget', sub: 'Stay within its monthly budget', needsCat: true },
};
function policyUpheld(p, ws) {
  const we = addDays(ws, 6); const end = we < today() ? we : today();
  if (p.kind === 'never_miss_twice') {
    const slots = []; for (let d = addDays(ws, -7); d <= end; d = addDays(d, 1)) if (WORK_DAYS.includes(isoWeekday(d))) slots.push([d, slotStatus(d)]);
    return !slots.some(([d, s], k) => k > 0 && d >= ws && s === 'missed' && slots[k - 1][1] === 'missed'); // only a second miss inside this week counts
  }
  if (p.kind === 'gym_target') return gymDays(ws, we).length >= gymTarget(ws);
  if (p.kind === 'weekly_review') return !!reviewFor(ws);
  const cid = p.params?.category_id; const m = monthOf(end);
  if (p.kind === 'pay_first') return S.expenses.some((e) => e.category_id === cid && monthOf(e.spent_on) === m);
  if (p.kind === 'cap_category') { const c = byId(S.cats, cid); if (!c || !c.monthly_budget) return true; return sum(S.expenses.filter((e) => e.category_id === cid && e.spent_on >= `${m}-01` && e.spent_on <= end), (e) => e.amount) <= Number(c.monthly_budget); }
  return false;
}
function policyNow(p) {
  const ws = weekStart(today());
  if (isPaused()) return ['Paused', 'off'];
  if (p.kind === 'gym_target') { const n = gymDays(ws, today()).length; return n >= gymTarget() ? ['Kept ✓', 'on'] : [`${n} of ${gymTarget()} so far`, 'off']; }
  if (p.kind === 'weekly_review') return reviewFor(ws) ? ['Kept ✓', 'on'] : ['Due Sunday', 'off'];
  if (p.kind === 'pay_first') return policyUpheld(p, ws) ? ['Kept ✓', 'on'] : ['Not yet this month', 'off'];
  return policyUpheld(p, ws) ? ['On track', 'on'] : ['Slipped — no penalty', 'off'];
}
function policyStreak(p) { let n = 0; for (let ws = addDays(weekStart(today()), -7); ws >= weekStart(localDay(p.created_at)); ws = addDays(ws, -7)) { if (activeRatio(ws) === 0) continue; if (policyUpheld(p, ws)) n++; else break; } return n; }

// The Gazette: headlines written from your week.
function gazette(ws) {
  const st = weekStats(ws); const we = addDays(ws, 6); const name = S.profile?.town_name || 'Daybook';
  const off = pausedDays(ws, we < today() ? we : today());
  const brk = S.breaks.find((b) => b.start_date <= we && (!b.end_date || b.end_date >= ws));
  const gymStreak = (() => { let n = 0; for (let w = ws; n < 52; w = addDays(w, -7)) { if (gymDays(w, addDays(w, 6)).length >= Math.max(1, gymTarget(w))) n++; else break; } return n; })();
  const doneMs = S.milestones.filter((m) => m.done && m.done_at && localDay(m.done_at) >= ws && localDay(m.done_at) <= we);
  const pbs = S.sets.filter((x) => localDay(x.created_at) >= ws && localDay(x.created_at) <= we && !isCardio(x) && x.weight_kg != null)
    .filter((x) => { const b = bestFor(x.exercise); return b && b.id === x.id; });
  const nth = (n) => `${n}${[, 'st', 'nd', 'rd'][(n % 100 >> 3 ^ 1) && n % 10] || 'th'}`;
  const stories = [];
  if (off >= 3 && brk) stories.push({ k: 'town', p: 100, h: brk.kind === 'ill' ? 'Mayor off sick; town carries on regardless' : brk.kind === 'holiday' ? 'Mayor on holiday; nothing burns down' : 'Council declares official rest week', b: 'Streaks were frozen and targets shrunk. Nothing was missed.' });
  if (st.gym >= Math.max(1, st.gymTarget)) stories.push({ k: 'health', p: 80 + gymStreak, h: gymStreak >= 2 ? `Gym attendance hits target for ${nth(gymStreak)} week running` : 'Gym attendance hits target; locals stunned', b: `${st.gym} session${st.gym === 1 ? '' : 's'} this week.` });
  if (pbs.length) stories.push({ k: 'health', p: 75, h: `New personal best on ${pbs[0].exercise}`, b: `${kg(pbs[0].weight_kg)} × ${pbs[0].reps ?? '—'}. Someone frame it.` });
  if (doneMs.length) stories.push({ k: 'town', p: 78, h: `Roadmap milestone reached: ${doneMs[0].title}`, b: 'Planning committee delighted. Biscuits were had.' });
  if (st.work >= Math.max(15, st.workTarget)) stories.push({ k: 'industry', p: 70, h: 'Freelance district works full hours; kettle overworked', b: `${fmtMins(st.work)} logged against a ${fmtMins(st.workTarget)} target.` });
  else if (st.work > 0) stories.push({ k: 'industry', p: 40, h: 'Industry ticks over; progress quietly made', b: `${fmtMins(st.work)} of ${fmtMins(st.workTarget)}. Every session counts.` });
  if (st.planned && st.spend <= st.planned) stories.push({ k: 'treasury', p: 60, h: 'Treasury balanced. Chancellor quietly smug.', b: `${gbp(Math.round(st.planned - st.spend))} under plan this week.` });
  else if (st.planned) stories.push({ k: 'treasury', p: 30, h: 'Spending runs a little hot', b: `${gbp(Math.round(st.spend - st.planned))} over plan. The pizza was worth it, presumably.` });
  if (st.tasksDone >= 8) stories.push({ k: 'services', p: 55, h: `${st.tasksDone} jobs done; council baffled by efficiency`, b: 'Life admin: handled.' });
  else if (st.tasksDone > 0) stories.push({ k: 'services', p: 35, h: `${st.tasksDone} task${st.tasksDone === 1 ? '' : 's'} ticked off`, b: 'Steady as she goes.' });
  if (!stories.length) stories.push({ k: 'town', p: 1, h: `Quiet week in ${name}. Pigeons report no concerns.`, b: 'Next week is a fresh page.' });
  stories.sort((a, b) => b.p - a.p);
  return { name, lead: stories[0], rest: stories.slice(1, 5), st };
}

/* =====================================================================
   Rendering
   ===================================================================== */
const ROUTES = [['today', 'Today'], ['gym', 'Gym'], ['money', 'Money'], ['work', 'Work'], ['tasks', 'Tasks'], ['town', 'Town']];
const HIDDEN = { review: ['Gazette', 'town'], settings: ['Settings', null] };
const ACCENT = { today: 'town', gym: 'health', money: 'treasury', work: 'industry', tasks: 'services', town: 'town', review: 'town', settings: 'services' };
const route = () => (location.hash.replace(/^#\/?/, '') || 'today').split('?')[0];

function renderShell() {
  $('#app').innerHTML = `
    <div class="shell">
      <nav class="tabs" aria-label="Main">
        <div class="brand">Daybook</div>
        ${ROUTES.map(([r, label]) => `<a href="#/${r}" data-route="${r}"><span class="ico">${icon(r)}</span><span>${label}</span></a>`).join('')}
        <a href="#/settings" class="side-only" data-route="settings"><span class="ico">${icon('user')}</span><span>Settings</span></a>
      </nav>
      <main class="view" id="view" tabindex="-1"></main>
      <button type="button" class="fab" data-act="fab" aria-label="Add">${icon('plus', 24)}<span class="fab-label"></span></button>
    </div>`;
}

let ticker = null;
function render() {
  if (!S.user || !$('#view')) return;
  const r = ROUTES.some(([k]) => k === route()) || HIDDEN[route()] ? route() : 'today';
  const navR = HIDDEN[r] ? HIDDEN[r][1] : r;
  document.querySelectorAll('nav.tabs a[data-route]').forEach((a) => { if (a.dataset.route === navR || a.dataset.route === r) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); });
  const view = $('#view');
  view.dataset.accent = ACCENT[r];
  view.innerHTML = VIEWS[r]();
  document.title = `${ROUTES.find(([k]) => k === r)?.[1] || HIDDEN[r][0]} · Daybook`;
  $('.fab').dataset.accent = ACCENT[r];
  $('.fab').classList.toggle('treasury', r === 'money');
  const fab = $('.fab');
  const fabLabel = { money: 'Add expense' }[r] || '';
  fab.hidden = !['today', 'tasks', 'work', 'money'].includes(r);
  fab.querySelector('.fab-label').textContent = fabLabel;
  fab.setAttribute('aria-label', fabLabel || 'Quick add');
  clearInterval(ticker);
  if (document.querySelector('[data-since]')) { tick(); ticker = setInterval(tick, 1000); }
  maybeCelebrate();
}
// Live clocks: any element with data-since="<ms>" shows elapsed time.
function tick() {
  document.querySelectorAll('[data-since]').forEach((el) => {
    const s = Math.max(0, Math.floor((Date.now() - Number(el.dataset.since)) / 1000));
    el.textContent = el.dataset.fmt === 'min' ? fmtMins(s / 60) : `${Math.floor(s / 3600)}:${pad(Math.floor((s % 3600) / 60))}:${pad(s % 60)}`;
  });
}

const head = (eyebrow, title, extra = '', quip = '') => `<header class="view-head"><div><div class="eyebrow">${eyebrow}</div><h1>${title}</h1>${quip ? `<div class="quip">${quip}</div>` : ''}</div>${extra}</header>`;
const avatarBtn = () => `<a href="#/settings" class="avatar" style="display:flex;align-items:center;justify-content:center;text-decoration:none" aria-label="Settings">${esc((S.user.email || '?')[0].toUpperCase())}</a>`;
const note = (emo, html, cls = 'warn') => `<div class="card ${cls}" role="note"><div class="note"><span class="emo" aria-hidden="true">${emo}</span><span>${html}</span></div></div>`;
const bar = (pct, over = false) => `<div class="bar ${over ? 'over' : ''}"><span style="width:${Math.max(0, Math.min(100, pct))}%${over ? ';background:var(--health)' : ''}"></span></div>`;

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
    ${head(`${open.length} open${overdueCount ? ` · ${overdueCount} overdue` : ''}`, 'Tasks &amp; plans', '', daily(Q.quips.tasks, 'tasks'))}
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
        ${S.tasks.length ? '<button type="button" class="btn link" data-act="export-page" data-page="tasks" style="align-self:flex-start">Export tasks as a spreadsheet (CSV)</button>' : ''}
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
const SLOT_TEXT = { full: ['Done', 'ok'], minimum: ['Minimum ✓', 'ok'], away: ['Away', ''], missed: ['Missed', 'due'], pending: ['To do', 'due'], before: ['—', ''], paused: ['On a break', ''] };
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
    ${head('VR · 360 · Unity', 'Freelance', '', daily(Q.quips.work, 'work'))}
    ${activeBreak() ? note('🛌', `${BREAK_LABEL[activeBreak().kind]} — planned sessions are paused, nothing counts as missed.`, 'break-card') : ''}
    ${warn && !running ? note('🔗', esc(warn), 'warn') : ''}
    <div class="desk-grid">
      <div class="col">
        <section class="card dark" aria-label="This week">
          <div class="card-head"><span class="meta">This week</span><span class="meta">Target ${fmtMins(workTarget())}${workTarget() < WORK_TARGET_MINUTES ? ' (break-adjusted)' : ''}</span></div>
          <div style="display:flex;align-items:baseline;gap:8px;flex-wrap:wrap"><span class="big">${fmtMins(mins)}</span>${vol ? `<span class="meta">incl. ${fmtMins(vol)} volunteer</span>` : ''}</div>
          ${bar((mins / Math.max(1, workTarget())) * 100)}
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
          <div class="legend"><span style="--c:var(--industry)">Full</span><span style="--c:var(--industry-soft)">${MINIMUM_MINUTES}-min</span><span style="--c:var(--health-soft)">Missed</span><span style="--c:var(--services-soft)">Away / break</span><span style="--c:var(--card)">To do</span></div>
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
        ${S.sessions.length ? '<button type="button" class="btn link" data-act="export-page" data-page="work" style="align-self:flex-start">Export sessions as a spreadsheet (CSV)</button>' : ''}
      </div>
    </div>`;
}

/* ---------- Gym ---------- */
function weekDots(ws, days) {
  const t = today();
  return `<div class="dots">${[1, 2, 3, 4, 5, 6, 7].map((i) => {
    const d = addDays(ws, i - 1);
    const cls = days.includes(d) ? 'on' : isPaused(d) ? 'paused' : d === t ? 'now' : '';
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
  const bests = [...exerciseNames().slice(0, 8), ...exerciseNames(true).slice(0, 4)].map((e) => ({ e, b: bestFor(e) })).filter((x) => x.b);
  return `
    ${head(`Goal: ${GYM_TARGET_PER_WEEK} sessions a week`, 'Gym', '', daily(Q.quips.gym, 'gym'))}
    <div class="desk-grid">
      <div class="col">
        <section class="card" aria-label="This week">
          <div class="card-head"><h2>This week</h2><span class="meta">${days.length} of ${gymTarget()}${lastWeek ? ` · last week ${lastWeek}` : ''}</span></div>
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
            const ss = setsFor(x.id); const lifts = ss.filter((q) => !isCardio(q)); const cardio = ss.filter(isCardio);
            const ex = new Set(lifts.map((q) => norm(q.exercise))).size;
            const bits = [ex ? `${ex} exercise${ex === 1 ? '' : 's'}, ${lifts.length} sets` : null, cardio.length ? `${fmtMins(sum(cardio, (q) => q.duration_min))} cardio` : null].filter(Boolean).join(' · ') || 'Nothing logged';
            return `<div class="row"><button type="button" class="title-btn" data-act="show-workout" data-id="${x.id}"><span class="title">${esc(x.name || 'Workout')}</span><span class="sub">${esc(relDay(localDay(x.started_at)))} · ${bits} · ${fmtMins(workoutMinutes(x))}</span></button></div>`;
          }).join('')}</div>` : '<p class="empty">No workouts logged yet. Start one when you get to the gym.</p>'}
        </section>
        ${bests.length ? `<section class="card" aria-label="Personal bests"><div class="card-head"><h2>Personal bests</h2></div><div class="list">${bests.map(({ e, b }) => `<div class="row"><span class="grow"><span class="title">${esc(e)}</span></span><span class="chip gym">${esc(bestLabel(b))}</span></div>`).join('')}</div></section>` : ''}
        ${S.workouts.length ? `<button type="button" class="btn link" data-act="export-page" data-page="gym" style="align-self:flex-start">Export workouts as a spreadsheet (CSV)</button>` : ''}
      </div>
    </div>`;
}

function viewWorkout(w) {
  const ss = setsFor(w.id);
  const order = [...new Set(ss.map((s) => s.exercise))];
  const mode = S.setMode || (ss.length && isCardio(ss[ss.length - 1]) ? 'cardio' : 'weights');
  const lastLift = ss.filter((x) => !isCardio(x)).pop();
  const lastCardio = ss.filter(isCardio).pop();
  const curEx = lastLift?.exercise || '';
  const prev = mode === 'weights' && curEx ? lastTimeFor(curEx, w.id) : null;
  const names = exerciseNames();
  const cNames = [...new Set([...exerciseNames(true), ...CARDIO_SUGGEST])];
  const dis = (on) => (on ? '' : 'disabled');
  return `
    ${head(`Workout in progress · <span data-since="${new Date(w.started_at).getTime()}" data-fmt="min"></span>`, esc(w.name || 'Workout'))}
    <form class="card" data-form="set" data-mode="${mode}" autocomplete="off">
      <div class="seg" role="radiogroup" aria-label="Type">
        <label><input type="radio" name="mode" value="weights" data-change="set-mode" ${mode === 'weights' ? 'checked' : ''}><span>Weights</span></label>
        <label><input type="radio" name="mode" value="cardio" data-change="set-mode" ${mode === 'cardio' ? 'checked' : ''}><span>Cardio</span></label>
      </div>
      <div class="w-only stack">
        ${prev ? `<span class="meta">Last time: ${esc(setsLine(prev.sets))}</span>` : ''}
        <label class="field"><span>Exercise</span><input name="exercise" class="input" list="ex-names" value="${esc(curEx)}" placeholder="e.g. Back squat" required maxlength="80" ${dis(mode === 'weights')}></label>
        <datalist id="ex-names">${names.map((n) => `<option value="${esc(n)}">`).join('')}</datalist>
        <div class="form-grid">
          <label class="field"><span>Weight (kg)</span><input name="weight_kg" class="input" type="number" inputmode="decimal" step="0.5" min="0" max="999" value="${lastLift?.weight_kg ?? ''}" ${dis(mode === 'weights')}></label>
          <label class="field"><span>Reps</span><input name="reps" class="input" type="number" inputmode="numeric" min="0" max="999" value="${lastLift?.reps ?? ''}" ${dis(mode === 'weights')}></label>
        </div>
      </div>
      <div class="c-only stack">
        <label class="field"><span>Activity</span><input name="activity" class="input" list="cardio-names" value="${esc(lastCardio?.exercise || '')}" placeholder="e.g. Treadmill, Bike, Rowing" required maxlength="80" ${dis(mode === 'cardio')}></label>
        <datalist id="cardio-names">${cNames.map((n) => `<option value="${esc(n)}">`).join('')}</datalist>
        <div class="form-grid">
          <label class="field"><span>Minutes</span><input name="duration_min" class="input" type="number" inputmode="decimal" step="0.5" min="0" max="600" required ${dis(mode === 'cardio')}></label>
          <label class="field"><span>Distance (km, optional)</span><input name="distance_km" class="input" type="number" inputmode="decimal" step="0.01" min="0" max="500" ${dis(mode === 'cardio')}></label>
        </div>
      </div>
      <button class="btn primary big-btn" type="submit"><span class="w-only">Log set</span><span class="c-only">Log cardio</span></button>
    </form>
    ${order.slice().reverse().map((ex) => {
      const exSets = ss.filter((s) => s.exercise === ex);
      const best = bestFor(ex); const last = lastTimeFor(ex, w.id);
      if (isCardio(exSets[0])) return `<section class="card" aria-label="${esc(ex)}">
        <div class="card-head"><h2>${esc(ex)}</h2>${best ? `<span class="chip gym">Best ${esc(bestLabel(best))}</span>` : ''}</div>
        <div class="list">${exSets.map((s) => `<div class="row"><span class="grow"><span class="title">${esc(cardioLine(s))}</span>${pace(s) ? `<span class="sub">${pace(s)}</span>` : ''}</span><button type="button" class="icon-btn" data-act="delete-set" data-id="${s.id}" aria-label="Delete">${icon('close', 16)}</button></div>`).join('')}</div>
        ${last ? `<div class="meta">Last time (${esc(relDay(localDay(last.w.started_at)))}): ${esc(setsLine(last.sets))}</div>` : ''}
      </section>`;
      return `<section class="card" aria-label="${esc(ex)}">
        <div class="card-head"><h2>${esc(ex)}</h2>${best ? `<span class="chip gym">Best ${esc(bestLabel(best))}</span>` : ''}</div>
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
    ${head(isNow ? `${fmtMonth(m)} · ${daysLeft} day${daysLeft === 1 ? '' : 's'} left` : fmtMonth(m), 'Money', navBtns, daily(Q.quips.money, 'money'))}
    <section class="card dark" aria-label="Monthly spending">
      <span class="meta">Spent ${isNow ? 'this month' : `in ${fmtMonth(m)}`}</span>
      <div style="display:flex;align-items:baseline;gap:8px;flex-wrap:wrap"><span class="big">${gbp(spent)}</span>${budget ? `<span class="meta">of ${gbp(budget)}</span>` : ''}</div>
      ${budget ? bar((spent / budget) * 100, spent > budget) : ''}
      <div style="font-size:14px;opacity:0.9">${!budget ? 'Set a monthly budget on each category below to see what\'s left.'
        : left < 0 ? `<b style="color:#FF9A82">${gbp(-left)} over budget.</b> The pizza was worth it, presumably.`
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
        ${exps.length ? `<button type="button" class="btn link" data-act="export-page" data-page="money" style="align-self:flex-start">Export ${esc(fmtMonth(m))} as a spreadsheet (CSV)</button>` : ''}
      </div>
    </div>`;
}

/* ---------- Today ---------- */
function growthMini() {
  const t = town(); const L = t.level;
  if (!S.profile?.town_name && !S.needsUpdate) return `<a class="card accent" href="#/town" style="text-decoration:none;color:inherit;--accent-soft:var(--town-soft)"><div class="card-head"><h2>Your town is waiting</h2><span class="level-chip">${esc(L.name)}</span></div><span>Everything you log builds it. Tap to name it and see what you've built so far →</span></a>`;
  const pct = L.next ? ((t.xp - L.floor) / (L.next[0] - L.floor)) * 100 : 100;
  return `<a class="card accent" href="#/town" style="text-decoration:none;color:inherit;gap:8px;--accent:var(--town);--accent-soft:var(--town-soft)">
    <div class="card-head"><h2 class="town-name">${esc(S.profile?.town_name || 'Your town')} <span class="level-chip">${esc(L.name)}</span></h2><span class="meta nowrap">+${t.weekXp} this week</span></div>
    ${bar(pct)}
    <span class="meta">${L.next ? `${L.next[0] - t.xp} growth to ${esc(L.next[1])}` : 'Top of the league. Frankly showing off.'}</span>
  </a>`;
}

function viewToday() {
  const t = today();
  const [greet, quip] = greeting();
  const due = S.tasks.filter((x) => !x.done && x.due_date && x.due_date <= t);
  const doneToday = S.tasks.filter((x) => x.done && x.done_at && localDay(x.done_at) === t && x.due_date && x.due_date <= t);
  const list = [...due.sort((a, b) => a.due_date.localeCompare(b.due_date)), ...doneToday];
  const mins = weekMinutes();
  const ws = weekStart(t);
  const gym = gymDays(ws, t).length;
  const m = monthOf(t); const spent = sum(monthExpenses(m), (e) => e.amount); const budget = budgetTotal();
  const brk = activeBreak();
  const back = !brk && recentReturn();
  const rems = brk ? [] : S.reminders.filter((r) => r.active && r.weekday === isoWeekday(t));
  const cur = currentSlot();
  const warn = brk ? null : missWarning();
  const running = !!store.get('timer');
  const active = activeWorkout();
  const lastGym = S.workouts[0] ? localDay(S.workouts[0].started_at) : null;
  const gymGap = lastGym ? Math.round((parseYmd(t) - parseYmd(lastGym)) / 864e5) : null;
  const lastReview = reviewFor(addDays(ws, -7));
  const commitments = (lastReview?.commitments || []).filter(Boolean);
  const needsReview = !brk && isoWeekday(t) >= 6 && !reviewFor(ws);
  const waiting = back ? S.tasks.filter((x) => !x.done && x.due_date && x.due_date < t && x.due_date >= back.start_date) : [];

  let workCard = '';
  if (running) workCard = timerCard();
  else if (!brk && cur && cur.status === 'pending') {
    const isToday = cur.slot === t;
    const deadline = DAY_LONG[isoWeekday(nextSlotAfter(cur.slot))];
    workCard = `
    <section class="card" style="background:var(--industry-soft)" aria-label="Freelance">
      <div class="card-head"><h2>${isToday ? 'Freelance session today' : `${DAY_LONG[isoWeekday(cur.slot)]}'s session isn't logged yet`}</h2><span class="meta nowrap">${fmtMins(mins)} / ${fmtMins(workTarget())}</span></div>
      ${!isToday ? `<div style="font-size:14px">You've got until ${deadline} to catch up. Already did it? Log it so it counts.</div>` : ''}
      ${latestNextStep() ? `<div class="sticky" style="transform:none;box-shadow:none"><span class="lbl">Next step</span><span class="txt" style="font-size:16px">${esc(latestNextStep())}</span></div>` : ''}
      <div class="btn-row" style="--accent-deep:var(--industry)"><button type="button" class="btn primary grow" data-act="start-timer">Start session</button><button type="button" class="btn small" data-act="log-minimum">Bad day · ${MINIMUM_MINUTES} min</button></div>
      ${!isToday ? `<button type="button" class="btn link" data-act="log-session" data-date="${cur.slot}" style="align-self:flex-start;color:var(--industry-deep)">I did it — log ${DAY_LONG[isoWeekday(cur.slot)]}'s session</button>` : ''}
    </section>`;
  }

  const notes = [];
  if (S.needsUpdate) notes.push(note('🛠️', 'One-off database update needed for the town, breaks and notifications. Run <b>update-2.sql</b> in Supabase (see Claude\'s message).', 'update-banner'));
  rems.forEach((r) => notes.push(note('⏰', `<b>${fmtTime(r.remind_at)}</b> · ${esc(r.title)}`, 'soft')));
  if (warn && !running) notes.push(note('🔗', esc(warn), 'warn'));
  if (active) notes.push(note('🏋️', `Workout in progress: <b>${esc(active.name || 'Workout')}</b> · <a href="#/gym">carry on</a>`, 'warn'));
  else if (!brk && gymGap != null && gymGap >= 3) notes.push(note('📞', `Your gym membership called. It misses you. (${gymGap} days since ${esc(relDay(lastGym))}.)`, 'warn'));
  if (needsReview) notes.push(note('📰', `It's the weekend — your <a href="#/review">Gazette</a> is ready to write. Five minutes, one cuppa.`, 'soft'));

  return `
    ${head(fmtLong(t), greet, avatarBtn(), quip)}
    ${brk ? `<section class="card break-card" aria-label="On a break">
      <div class="card-head"><h2>${BREAK_LABEL[brk.kind]}</h2><span class="meta">since ${esc(relDay(brk.start_date))}${brk.end_date ? ` · until ${esc(fmtShort(brk.end_date))}` : ''}</span></div>
      <div style="font-size:15px">${BREAK_LINE[brk.kind]} Streaks are frozen, targets have shrunk and the nudges have gone quiet.</div>
      <button type="button" class="btn primary" data-act="end-break" data-id="${brk.id}" style="--accent-deep:var(--services-deep)">I'm back</button>
    </section>` : ''}
    ${back ? `<section class="card soft" aria-label="Welcome back">
      <div class="card-head"><h2>Oh, you're back</h2></div>
      <div style="font-size:15px">The town barely noticed. (It did. It missed you.) Nothing counted as missed, and this week's targets are adjusted for the days you were off.</div>
      ${latestNextStep() ? `<div style="font-size:14px"><b>Easy restart:</b> ${MINIMUM_MINUTES} minutes on “${esc(latestNextStep())}”.</div>` : ''}
      ${waiting.length ? `<div style="font-size:14px">${waiting.length} task${waiting.length === 1 ? '' : 's'} waited for you.</div><button type="button" class="btn small primary" data-act="spread-tasks" style="align-self:flex-start">Spread them over this week</button>` : ''}
    </section>` : ''}
    <section class="tiles" aria-label="At a glance">
      <a class="tile industry" href="#/work"><span class="k"><span class="dot industry"></span>Freelance</span><span class="v">${fmtMins(mins)}</span><span class="s">of ${fmtMins(workTarget())}</span></a>
      <a class="tile health" href="#/gym"><span class="k"><span class="dot health"></span>Gym</span><span class="v">${gym} / ${gymTarget()}</span><span class="s">this week</span></a>
      <a class="tile treasury" href="#/money"><span class="k"><span class="dot treasury"></span>Money</span><span class="v">${budget ? gbp(Math.round(Math.abs(budget - spent))) : gbp(Math.round(spent))}</span><span class="s">${budget ? (spent > budget ? 'over budget' : `left in ${parseYmd(t).toLocaleDateString('en-GB', { month: 'short' })}`) : 'spent'}</span></a>
    </section>
    ${notes.join('')}
    <div class="desk-grid">
      <div class="col">
        ${workCard}
        <section class="card" aria-label="Due today">
          <div class="card-head"><h2>Due today</h2><span class="meta">${list.length ? `${doneToday.length} of ${list.length} done` : ''}</span></div>
          ${list.length ? `<div class="list">${list.map((x) => taskRow(x, { showDate: x.due_date < t })).join('')}</div>` : `<p class="empty">${daily(Q.emptyDue, 'due')}</p>`}
          <a class="btn link" href="#/tasks" style="align-self:flex-start">All tasks →</a>
        </section>
      </div>
      <div class="col">
        ${growthMini()}
        ${commitments.length ? `<section class="card" style="background:var(--treasury-soft)" aria-label="This week's commitments"><div class="card-head"><h2>This week I said I'd…</h2></div><ol class="commit">${commitments.map((c) => `<li>${esc(c)}</li>`).join('')}</ol></section>` : ''}
        ${!workCard.includes('Next step') && latestNextStep() && !running && !brk ? nextStepSticky('Freelance · next step') : ''}
        ${!brk ? `<button type="button" class="btn link" data-act="take-break" style="align-self:flex-start;color:var(--muted)">Feeling rough or away? Take a break →</button>` : ''}
      </div>
    </div>`;
}

/* ---------- Town ---------- */
function viewTown() {
  const t = town(); const L = t.level;
  const pct = L.next ? ((t.xp - L.floor) / (L.next[0] - L.floor)) * 100 : 100;
  const next = BUILDINGS.filter((b) => !t.built.includes(b.id)).map((b) => ({ b, have: statVal(t.st, b.stat) })).sort((a, b) => (b.have / b.b.need) - (a.have / a.b.need)).slice(0, 3);
  const pols = S.policies.filter((p) => p.active);
  const slots = policySlots();
  const ws = weekStart(today());
  const gz = gazette(ws);
  if (!S.profile?.town_name && !S.needsUpdate) {
    const ideas = ['Walshford', 'Gymbridge Wells', 'Little Budgeting', 'Freelancester', 'Upper Productivity', 'Much Wenlock-in'];
    return `${head('Planning permission granted', 'Name your town', '', 'Every great town needs a name. Choose wisely; the Gazette will print it.')}
      <form class="card" data-form="town-name" autocomplete="off">
        <label class="field"><span>Town name</span><input name="town_name" class="input" maxlength="40" required placeholder="e.g. Walshford"></label>
        <div class="suggest">${ideas.map((n) => `<button type="button" class="btn small" data-act="pick-town-name" data-name="${esc(n)}">${esc(n)}</button>`).join('')}</div>
        <button class="btn primary" type="submit">Found my town</button>
      </form>`;
  }
  return `
    ${head(daily(Q.quips.town, 'town'), esc(S.profile?.town_name || 'Your town'), `<span class="level-chip">${esc(L.name)}</span>`)}
    ${S.needsUpdate ? note('🛠️', 'Run <b>update-2.sql</b> in Supabase to unlock town names, policies and breaks.', 'update-banner') : ''}
    <div class="desk-grid">
      <div class="col">
        <section class="card town-card" aria-label="Town map">${townSvg(t)}</section>
        <section class="card dark" aria-label="Growth">
          <div class="card-head"><span class="meta">${L.next ? `Next: ${esc(L.next[1])}` : 'Maximum town achieved'}</span><span class="meta">${t.xp}${L.next ? ` / ${L.next[0]}` : ''} growth</span></div>
          ${bar(pct)}
          <div style="font-size:14px;opacity:0.9">+${t.weekXp} this week. Growth only goes up — quiet weeks just grow slower.</div>
        </section>
        <section class="districts" aria-label="Districts">
          ${districts().map((d) => `<a class="district ${d.d}" href="${d.href}"><span class="k"><span class="dot ${d.d}"></span>${d.name}</span><span class="v">${d.v}</span>${bar(d.pct)}<span class="r">${d.r}</span></a>`).join('')}
        </section>
      </div>
      <div class="col">
        <a class="gazette-link" href="#/review"><span style="flex:1;display:flex;flex-direction:column;gap:3px"><span class="kicker">The ${esc(gz.name)} Gazette · this week</span><span class="hl">${esc(gz.lead.h)}</span></span><span aria-hidden="true" style="font-size:22px">›</span></a>
        <section class="card" aria-label="Policies">
          <div class="card-head"><h2>Policies</h2><span class="meta">${pols.length} of ${slots} slots</span></div>
          ${pols.length ? `<div class="list">${pols.map((p) => { const [s, cls] = policyNow(p); const n = policyStreak(p); return `
            <div class="row"><span class="grow"><span class="title">${esc(p.title)}</span><span class="sub">${n ? `Kept ${n} week${n === 1 ? '' : 's'} running · +10 a week` : '+10 growth each week it’s kept'}</span></span><span class="policy-state ${cls}">${esc(s)}</span><button type="button" class="icon-btn" data-act="repeal-policy" data-id="${p.id}" aria-label="Repeal ${esc(p.title)}">${icon('close', 16)}</button></div>`; }).join('')}</div>`
            : '<p class="empty">No policies yet. Enact one — a rule for your town that earns a bonus each week you keep it.</p>'}
          ${pols.length < slots && !S.needsUpdate ? '<button type="button" class="btn small" data-act="enact-policy" style="align-self:flex-start">+ Enact a policy</button>' : ''}
        </section>
        <section class="card" aria-label="Next to build">
          <div class="card-head"><h2>Next to build</h2><span class="meta">${t.built.length} of ${BUILDINGS.length} built</span></div>
          <div class="unlock-list">${next.map(({ b, have }) => `
            <div class="unlock"><span class="badge" style="background:var(--${b.d}-soft)">${b.need > 1 ? Math.min(have, b.need) : '?'}</span><span class="grow"><b>${esc(b.name)}</b><span class="meta">${esc(b.how)}${b.need > 1 ? ` · ${Math.min(have, b.need)} of ${b.need}` : ''}</span>${b.need > 1 ? `<span style="--accent:var(--${b.d})">${bar((have / b.need) * 100)}</span>` : ''}</span></div>`).join('') || '<p class="empty">Everything is built. Absolute legend.</p>'}</div>
        </section>
        <section class="card" aria-label="Unlocks">
          <div class="card-head"><h2>Unlocks</h2></div>
          ${UNLOCKS.map((u) => `<div class="row"><span class="grow"><span class="title">${esc(u.text)}</span><span class="sub">at ${esc(LEVELS[u.level][1])}</span></span><span class="policy-state ${L.idx >= u.level ? 'on' : 'off'}">${L.idx >= u.level ? 'Unlocked' : 'Locked'}</span></div>`).join('')}
        </section>
      </div>
    </div>`;
}

/* ---------- Weekly review: the Gazette ---------- */
function weekStats(ws) {
  const we = addDays(ws, 6); const t = today();
  const end = we < t ? we : t;
  const work = weekMinutes(ws), workPrev = weekMinutes(addDays(ws, -7));
  const gym = gymDays(ws, we).length, gymPrev = gymDays(addDays(ws, -7), addDays(ws, -1)).length;
  const spend = spendBetween(ws, we);
  let planned = 0; for (let d = ws; d <= end; d = addDays(d, 1)) planned += budgetTotal() / daysInMonth(monthOf(d));
  const tasksDone = S.tasks.filter((x) => x.done && x.done_at && localDay(x.done_at) >= ws && localDay(x.done_at) <= we).length;
  const slipped = [];
  S.tasks.filter((x) => !x.done && x.due_date && x.due_date >= ws && x.due_date <= end && x.due_date < t && !isPaused(x.due_date)).forEach((x) => slipped.push(`Not done: ${x.title}`));
  S.tasks.filter((x) => !x.done && x.times_moved >= 2).forEach((x) => slipped.push(`${x.title} — moved ${x.times_moved} times`));
  WORK_DAYS.map((wd) => addDays(ws, wd - 1)).filter((d) => d <= t && slotStatus(d) === 'missed').forEach((d) => slipped.push(`Missed ${DAY_LONG[isoWeekday(d)]}'s freelance session`));
  const m = monthOf(end);
  S.cats.forEach((c) => { const b = Number(c.monthly_budget); if (!b) return; const s = sum(monthExpenses(m).filter((e) => e.category_id === c.id), (e) => e.amount); if (s > b) slipped.push(`${c.name} is ${gbp(s - b)} over budget for ${parseYmd(m + '-01').toLocaleDateString('en-GB', { month: 'long' })}`); });
  const gT = gymTarget(ws), wT = workTarget(ws);
  if (gym < gT && we < t) slipped.push(`Gym: ${gym} of ${gT} sessions`);
  return { work, workPrev, gym, gymPrev, spend, planned, tasksDone, gymTarget: gT, workTarget: wT, slipped: [...new Set(slipped)] };
}
const diff = (a, b, fmt) => (a === b ? 'Same as last week' : `${a > b ? 'Up' : 'Down'} ${fmt(Math.abs(a - b))} on last week`);

function viewReview() {
  const t = today();
  const ws = S.reviewWeek || weekStart(t);
  const we = addDays(ws, 6);
  const isCurrent = ws === weekStart(t);
  const gz = gazette(ws); const st = gz.st;
  const rev = reviewFor(ws);
  const said = (reviewFor(addDays(ws, -7))?.commitments || []).filter(Boolean);
  const cm = rev?.commitments || [];
  const weekNo = (() => { const d = parseYmd(ws); d.setDate(d.getDate() + 3); const y = new Date(d.getFullYear(), 0, 4); return 1 + Math.round(((d - y) / 864e5 - 3 + ((y.getDay() + 6) % 7)) / 7); })();
  const gained = growthEvents().filter((e) => e.date >= ws && e.date <= we);
  const bySrc = (src) => sum(gained.filter((e) => e.src === src), (e) => e.pts);
  const navBtns = `<div class="month-nav"><button type="button" class="icon-btn" data-act="review-week" data-dir="-1" aria-label="Previous week">${icon('left', 20)}</button><button type="button" class="icon-btn" data-act="review-week" data-dir="1" aria-label="Next week" ${isCurrent ? 'disabled' : ''}>${icon('right', 20)}</button></div>`;
  return `
    <div class="view-head" style="padding:12px 14px"><a href="#/town" class="btn link" style="min-height:36px">← Town</a>${navBtns}</div>
    <article class="paper" aria-label="The Gazette">
      <header class="masthead"><div class="date">Week ${weekNo} · ${parseYmd(ws).getDate()}${monthOf(ws) !== monthOf(we) ? ` ${parseYmd(ws).toLocaleDateString('en-GB', { month: 'short' })}` : ''}–${fmtDM(we)}${isCurrent ? ' · latest edition' : ''}</div><h1>The ${esc(gz.name)} Gazette</h1></header>
      <div class="gz-kicker kick-${gz.lead.k}">${{ health: 'Health', industry: 'Industry', treasury: 'Treasury', services: 'Services', town: 'Town news' }[gz.lead.k]}</div>
      <h2 class="lead">${esc(gz.lead.h)}</h2>
      <p class="standfirst" style="margin:0">${esc(gz.lead.b)}</p>
      ${gz.rest.length ? `<div class="stories">${gz.rest.map((s) => `<div class="story"><div class="gz-kicker kick-${s.k}">${{ health: 'Health', industry: 'Industry', treasury: 'Treasury', services: 'Services', town: 'Town' }[s.k]}</div><h3>${esc(s.h)}</h3><p>${esc(s.b)}</p></div>`).join('')}</div>` : ''}
    </article>
    <section class="score" aria-label="Scorecard">
      <div class="tile industry"><span class="k">Freelance</span><span class="v">${fmtMins(st.work)} / ${fmtMins(st.workTarget)}</span><span class="s ${st.work >= st.workPrev ? 'good' : ''}">${diff(st.work, st.workPrev, fmtMins)}</span></div>
      <div class="tile health"><span class="k">Gym</span><span class="v">${st.gym} / ${st.gymTarget}</span><span class="s ${st.gym >= st.gymPrev ? 'good' : ''}">${diff(st.gym, st.gymPrev, String)}</span></div>
      <div class="tile treasury"><span class="k">Spending</span><span class="v">${gbp(Math.round(st.spend))}</span><span class="s ${st.planned && st.spend <= st.planned ? 'good' : st.planned ? 'bad' : ''}">${st.planned ? (st.spend <= st.planned ? `${gbp(Math.round(st.planned - st.spend))} under plan` : `${gbp(Math.round(st.spend - st.planned))} over plan`) : 'No budget set'}</span></div>
      <div class="tile services"><span class="k">Tasks done</span><span class="v">${st.tasksDone}</span><span class="s">${S.tasks.filter((x) => !x.done && x.due_date && x.due_date <= we && x.due_date < t).length} still overdue</span></div>
    </section>
    <div class="desk-grid">
      <div class="col">
        <section class="card accent" aria-label="Town growth"><div class="card-head"><h2>Town growth this week</h2><span class="big" style="font-size:28px">+${sum(gained, (e) => e.pts)}</span></div>
          <div class="growth-lines">${[['health', 'Workouts'], ['industry', 'Freelance'], ['services', 'Tasks'], ['treasury', 'Money'], ['town', 'Milestones, policies & Gazettes']].filter(([k]) => bySrc(k)).map(([k, l]) => `<div><span><span class="dot ${k}"></span> ${l}</span><b>+${bySrc(k)}</b></div>`).join('') || '<div><span>Nothing yet. Early days.</span></div>'}</div></section>
        ${said.length ? `<section class="card" style="background:var(--treasury-soft)" aria-label="Last week's priorities"><div class="card-head"><h2>Last week you said you'd…</h2></div><ol class="commit">${said.map((c) => `<li>${esc(c)}</li>`).join('')}</ol><span class="meta">Did you? Honesty in the notes below. Nobody's grading.</span></section>` : ''}
        <section class="card" aria-label="What slipped">
          <div class="card-head"><h2>What slipped</h2></div>
          ${st.slipped.length ? `<ul class="slipped">${st.slipped.map((s) => `<li>${esc(s)}</li>`).join('')}</ul>` : '<p class="empty">Nothing slipped. Suspiciously competent.</p>'}
        </section>
      </div>
      <div class="col">
        <form class="card" data-form="review" data-week="${ws}" autocomplete="off">
          <label class="field"><span>What went well?</span><textarea name="went_well" class="input" maxlength="1000">${esc(rev?.went_well || '')}</textarea></label>
          <label class="field"><span>What got in the way?</span><textarea name="slipped" class="input" maxlength="1000">${esc(rev?.slipped || '')}</textarea></label>
          <div class="field"><span>Council priorities for next week (up to 3)</span>
            ${[0, 1, 2].map((i) => `<label class="sr" for="c${i}">Priority ${i + 1}</label><input id="c${i}" name="c${i}" class="input" maxlength="140" value="${esc(cm[i] || '')}" placeholder="${['e.g. Gym 3× including Sunday', 'e.g. Finish case study 2', 'Third one (optional — fewer is fine)'][i]}">`).join('')}
          </div>
          <button class="btn primary" type="submit">${rev ? 'Update the Gazette' : 'Publish the Gazette (+25)'}</button>
          ${rev ? '<span class="meta">Published. Your priorities will show on Today next week.</span>' : ''}
        </form>
      </div>
    </div>`;
}

/* ---------- Settings ---------- */
function viewSettings() {
  const n = { gym: true, weekly: true, tasks: false, max2: true, quiet_paused: true, ...(S.profile?.notify || {}) };
  const push = S.pushState;
  const sw = (key, title, sub, on, attrs) => `<label class="switch-row"><span class="grow"><span class="title" style="font-weight:600">${title}</span><span class="sub meta">${sub}</span></span><input type="checkbox" class="switch" ${attrs} ${on ? 'checked' : ''}></label>`;
  return `
    ${head(esc(S.user.email), 'Settings', '', 'The boring-but-important bits.')}
    ${S.needsUpdate ? note('🛠️', 'Run <b>update-2.sql</b> in Supabase first — some settings need it.', 'update-banner') : ''}
    <div class="desk-grid"><div class="col">
      <section class="card" aria-label="Notifications">
        <div class="card-head"><h2>Notifications</h2><span class="policy-state ${push === 'on' ? 'on' : 'off'}">${{ on: 'On for this phone', off: 'Off', blocked: 'Blocked', unsupported: 'Not supported' }[push] || 'Checking…'}</span></div>
        ${push === 'on' ? '<div class="btn-row"><button type="button" class="btn small" data-act="push-test">Send me a test</button><button type="button" class="btn small danger" data-act="push-off">Turn off on this phone</button></div>'
          : push === 'blocked' ? '<p class="meta" style="margin:0">Chrome is blocking them. Tap the ⋮ menu → Settings → Site settings → Notifications and allow this site, then come back.</p>'
          : push === 'unsupported' ? '<p class="meta" style="margin:0">This browser can\'t do it. On your Pixel, use the installed app from Chrome.</p>'
          : '<button type="button" class="btn primary" data-act="push-on">Turn on notifications</button>'}
        <div class="list">
          ${S.allReminders.map((r) => sw('', esc(r.title), `${DAY_LONG[r.weekday]}s at ${fmtTime(r.remind_at)}`, r.active, `data-change="rem-active" data-id="${r.id}"`)).join('')}
          ${sw('gym', 'Gym nudge', '6pm, if 3 days pass without a workout', n.gym, 'data-change="notify-pref" data-key="gym"')}
          ${sw('weekly', 'Sunday Gazette', 'Sundays at 6pm', n.weekly, 'data-change="notify-pref" data-key="weekly"')}
          ${sw('tasks', 'Tasks due today', '8am, only if something is due', n.tasks, 'data-change="notify-pref" data-key="tasks"')}
          ${sw('quiet', 'Quiet when on a break', 'No nudges while ill or on holiday', n.quiet_paused, 'data-change="notify-pref" data-key="quiet_paused"')}
          ${sw('max2', 'Maximum 2 a day', 'So it never feels like nagging', n.max2, 'data-change="notify-pref" data-key="max2"')}
        </div>
      </section>
    </div><div class="col">
      <section class="card" aria-label="Breaks">
        <div class="card-head"><h2>Breaks</h2></div>
        ${activeBreak() ? `<p style="margin:0">${BREAK_LABEL[activeBreak().kind]} since ${esc(relDay(activeBreak().start_date))}.</p><button type="button" class="btn small primary" data-act="end-break" data-id="${activeBreak().id}" style="align-self:flex-start">I'm back</button>`
          : '<p class="meta" style="margin:0">Ill, on holiday or just need a day? Streaks freeze and targets shrink. No guilt.</p><button type="button" class="btn small" data-act="take-break" style="align-self:flex-start">Take a break</button>'}
      </section>
      <section class="card" aria-label="Appearance">
        <div class="card-head"><h2>Appearance</h2></div>
        ${unlocked('night') ? sw('night', 'Night mode', 'Easier on the eyes after dark', S.profile?.theme === 'dark', 'data-change="theme"') : `<p class="meta" style="margin:0">🔒 Night mode unlocks when your town reaches <b>${LEVELS[2][1]}</b>.</p>`}
        ${S.profile ? `<form class="inline-add" data-form="town-name" autocomplete="off"><label class="sr" for="tn">Town name</label><input id="tn" name="town_name" class="input" maxlength="40" value="${esc(S.profile.town_name || '')}" placeholder="Town name"><button class="btn small" type="submit">Rename</button></form>` : ''}
      </section>
      <section class="card" aria-label="Your data">
        <div class="card-head"><h2>Your data</h2></div>
        <button type="button" class="btn" data-act="export">Export everything (backup)</button>
        <span class="meta">Worth doing once a month. Belt and braces.</span>
        <button type="button" class="btn danger" data-act="sign-out">Sign out</button>
      </section>
    </div></div>`;
}

const VIEWS = { today: viewToday, tasks: viewTasks, work: viewWork, gym: viewGym, money: viewMoney, town: viewTown, review: viewReview, settings: viewSettings };

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
  try { await fn(); if (typeof okMsg === 'function') okMsg = okMsg(); if (okMsg) toast(okMsg); }
  catch (e) {
    console.error(e);
    toast(!navigator.onLine ? "You're offline — that wasn't saved." : `Couldn't save: ${e.message || 'unknown error'}`);
  }
  render();
}
const askFirst = (msg, fn) => { if (confirm(msg)) fn(); };

const ACTIONS = {
  'close-sheet': closeSheet,
  'account': (el, e) => { e.preventDefault(); location.hash = '#/settings'; },
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
  'start-timer': () => { store.set('timer', { start: Date.now() }); closeSheet(); if (!['work', 'today'].includes(route())) location.hash = '#/work'; render(); toast(any(['Session started. Kettle on standby.', 'Clock’s ticking. In a good way.', 'Off you go. Future you says ta.'])); },
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

  'export': (el) => backupExport(el),
  'export-page': (el) => pageExport(el.dataset.page),
  'save-file': () => saveFile('download'),
  'share-file': () => saveFile('share'),
  'sign-out': async () => { closeSheet(); await sb.auth.signOut(); },

  // Breaks
  'take-break': () => openSheet('Take a break', `
    <form data-form="break" data-close="1" class="stack">
      <div class="seg" role="radiogroup" aria-label="Why">
        ${[['ill', 'Ill'], ['holiday', 'Holiday'], ['rest', 'Rest day']].map(([v, l], k) => `<label><input type="radio" name="kind" value="${v}" ${k === 0 ? 'checked' : ''}><span>${l}</span></label>`).join('')}
      </div>
      <div class="form-grid">
        <label class="field"><span>From</span><input type="date" name="start_date" class="input" value="${today()}" required></label>
        <label class="field"><span>Until (optional)</span><input type="date" name="end_date" class="input" min="${today()}"></label>
      </div>
      <div class="card" style="box-shadow:none;background:var(--services-soft)">
        <b>While you're off</b>
        <span>✓ Streaks freeze — nothing counts as missed</span>
        <span>✓ Weekly targets shrink to match the days you're here</span>
        <span>✓ Nudges and notifications go quiet</span>
        <span>✓ Your town keeps everything it's built</span>
      </div>
      <button class="btn primary" type="submit">Pause Daybook</button>
      <p class="meta" style="margin:0;text-align:center">Leave “until” blank and tap “I'm back” when you are.</p>
    </form>`),
  'end-break': (el) => run(async () => {
    const b = byId(S.breaks, el.dataset.id);
    if (b.start_date >= today()) { await remove('breaks', b.id); S.breaks = S.breaks.filter((x) => x.id !== b.id); }
    else replaceIn(S.breaks, await update('breaks', b.id, { end_date: addDays(today(), -1) }));
    townCache = null;
  }, 'Welcome back. The town put the kettle on.'),
  'spread-tasks': () => run(async () => {
    const back = recentReturn(); if (!back) return;
    const waiting = S.tasks.filter((x) => !x.done && x.due_date && x.due_date < today() && x.due_date >= back.start_date);
    for (let k = 0; k < waiting.length; k++) replaceIn(S.tasks, await update('tasks', waiting[k].id, { due_date: addDays(today(), k % 5) }));
  }, 'Spread over the next few days. Much more civilised.'),

  // Town
  'pick-town-name': (el) => { const i = document.querySelector('input[name=town_name]'); if (i) i.value = el.dataset.name; },
  'enact-policy': () => {
    const have = S.policies.filter((p) => p.active).map((p) => p.kind + (p.params?.category_id || ''));
    const opts = Object.entries(POLICY_TYPES).filter(([k, v]) => v.needsCat || !have.includes(k));
    openSheet('Enact a policy', `
      <p class="meta" style="margin:0">Every week you keep it: +10 growth. Slip up and you just miss the bonus. No fines, no riots.</p>
      <form data-form="policy" data-close="1" class="stack">
        <div class="list">${opts.map(([k, v], i) => `<label class="switch-row"><input type="radio" name="kind" value="${k}" ${i === 0 ? 'checked' : ''} style="width:22px;height:22px;accent-color:var(--town)"><span class="grow"><span class="title" style="font-weight:600">${esc(v.title)}</span><span class="sub meta">${esc(v.sub)}</span></span></label>`).join('')}</div>
        <label class="field"><span>Category (for the money policies)</span><select name="category_id" class="input">${S.cats.map((c) => `<option value="${c.id}">${esc(c.name)}${c.monthly_budget ? ` · ${gbp(c.monthly_budget)}` : ''}</option>`).join('')}</select></label>
        <button class="btn primary" type="submit">Enact</button>
      </form>`);
  },
  'repeal-policy': (el) => askFirst('Repeal this policy? Growth it has already earned is kept.', () => run(async () => { await update('policies', el.dataset.id, { active: false }); S.policies = S.policies.filter((p) => p.id !== el.dataset.id); townCache = null; }, 'Repealed. The council shrugs.')),
  'close-celebrate': () => { closeSheet(); sheet().classList.remove('celebrate'); },

  // Notifications
  'push-on': () => enablePush(),
  'push-off': () => run(async () => {
    const reg = await navigator.serviceWorker.ready; const sub = await reg.pushManager.getSubscription();
    if (sub) { await q(sb.from('push_subscriptions').delete().eq('endpoint', sub.endpoint)); await sub.unsubscribe(); }
    S.pushState = 'off';
  }, 'Notifications off on this phone. Peace and quiet.'),
  'push-test': () => run(async () => {
    const { data, error } = await sb.functions.invoke('notify', { body: { test: true } });
    if (error) throw new Error("the notification server isn't set up yet — see Claude's steps");
    if (!data?.sent) throw new Error('no devices registered — try turning notifications off and on');
  }, 'Test sent. Give it a few seconds.'),
};

/* ---------- Exports ----------
   Files are prepared first, then saved from a button tap: phones only allow
   downloading/sharing straight after a tap, which is what caused "permission denied". */
let pendingFile = null;
const csvCell = (v) => { v = v == null ? '' : String(v); return /[",\n\r]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v; };
const toCsv = (rows) => '\ufeff' + rows.map((r) => r.map(csvCell).join(',')).join('\r\n'); // BOM so Excel shows £ correctly
function offerFile(name, text, type, summary) {
  pendingFile = new File([text], name, { type });
  const canShare = !!(navigator.canShare && navigator.canShare({ files: [pendingFile] }));
  openSheet('Export ready', `
    <p class="meta">${summary}</p>
    <p style="margin:0;font-weight:600;overflow-wrap:anywhere">${esc(name)}</p>
    <button type="button" class="btn primary" data-act="save-file">Download</button>
    ${canShare ? '<button type="button" class="btn" data-act="share-file">Share… (email, Drive, Sheets)</button>' : ''}
    <p class="meta">CSV files open in Google Sheets, Excel or Numbers.</p>`);
}
async function saveFile(how) {
  if (!pendingFile) return;
  try {
    if (how === 'share') await navigator.share({ files: [pendingFile], title: pendingFile.name });
    else {
      const a = document.createElement('a'); a.href = URL.createObjectURL(pendingFile); a.download = pendingFile.name;
      document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 10000);
    }
    closeSheet(); toast(how === 'share' ? 'Shared' : 'Downloaded — check your Downloads folder');
  } catch (e) {
    if (e.name !== 'AbortError') toast(`Couldn't save the file: ${e.message}`);
  }
}
async function backupExport(el) {
  el.disabled = true; el.textContent = 'Preparing backup…';
  const tables = ['tasks', 'goals', 'milestones', 'workouts', 'workout_sets', 'expense_categories', 'expenses', 'work_sessions', 'days_off', 'weekly_reviews', 'reminders'];
  const out = { exported_at: new Date().toISOString() }; const failed = [];
  for (const t of tables) { try { out[t] = await q(sb.from(t).select('*')); } catch { failed.push(t); } }
  offerFile(`daybook-backup-${today()}.json`, JSON.stringify(out, null, 2), 'application/json',
    `Everything in Daybook, as one backup file.${failed.length ? ` (Couldn't read: ${esc(failed.join(', '))}.)` : ''}`);
}
function pageExport(page) {
  const t = today();
  if (page === 'money') {
    const m = S.month; const exps = monthExpenses(m).slice().sort((a, b) => a.spent_on.localeCompare(b.spent_on));
    const rows = [['Date', 'Description', 'Category', 'Amount (£)', 'Monthly bill'],
      ...exps.map((e) => [e.spent_on, e.description || '', catName(e.category_id), Number(e.amount).toFixed(2), e.is_recurring ? 'Yes' : ''])];
    rows.push([], ['Category', 'Spent (£)', 'Budget (£)', 'Left (£)']);
    S.cats.forEach((c) => { const sp = sum(exps.filter((e) => e.category_id === c.id), (e) => e.amount); const b = c.monthly_budget; rows.push([c.name, sp.toFixed(2), b == null ? '' : Number(b).toFixed(2), b == null ? '' : (b - sp).toFixed(2)]); });
    const unc = sum(exps.filter((e) => !e.category_id || !byId(S.cats, e.category_id)), (e) => e.amount);
    if (unc) rows.push(['Uncategorised', unc.toFixed(2), '', '']);
    rows.push(['Total', sum(exps, (e) => e.amount).toFixed(2), budgetTotal() ? budgetTotal().toFixed(2) : '', budgetTotal() ? (budgetTotal() - sum(exps, (e) => e.amount)).toFixed(2) : '']);
    return offerFile(`daybook-money-${m}.csv`, toCsv(rows), 'text/csv', `${exps.length} expense${exps.length === 1 ? '' : 's'} for ${fmtMonth(m)}, plus a summary by category.`);
  }
  if (page === 'gym') {
    const rows = [['Date', 'Workout', 'Exercise', 'Type', 'Set', 'Weight (kg)', 'Reps', 'Minutes', 'Distance (km)']];
    S.workouts.slice().reverse().forEach((w) => setsFor(w.id).forEach((x) => rows.push([localDay(w.started_at), w.name || '', x.exercise, isCardio(x) ? 'Cardio' : 'Weights', x.set_number, x.weight_kg ?? '', x.reps ?? '', x.duration_min ?? '', x.distance_km ?? ''])));
    return offerFile(`daybook-gym-${t}.csv`, toCsv(rows), 'text/csv', `${S.workouts.length} workout${S.workouts.length === 1 ? '' : 's'} from the last 4 months, one row per set.`);
  }
  if (page === 'work') {
    const rows = [['Date', 'Minutes', 'Type', 'Worked on', 'Next step'], ...S.sessions.slice().reverse().map((x) => [x.session_on, x.minutes, x.kind === 'minimum' ? 'Minimum' : x.kind === 'volunteer' ? 'Volunteer' : 'Full', x.project || '', x.next_step || ''])];
    return offerFile(`daybook-freelance-${t}.csv`, toCsv(rows), 'text/csv', `${S.sessions.length} freelance session${S.sessions.length === 1 ? '' : 's'} from the last 4 months.`);
  }
  if (page === 'tasks') {
    const rows = [['Task', 'Area', 'Due', 'Done', 'Done on', 'Times moved'], ...S.tasks.map((x) => [x.title, cap(x.area), x.due_date || '', x.done ? 'Yes' : '', x.done_at ? localDay(x.done_at) : '', x.times_moved || 0])];
    return offerFile(`daybook-tasks-${t}.csv`, toCsv(rows), 'text/csv', `Your open tasks and those done in the last 2 months.`);
  }
}

/* ---------- Celebrations ---------- */
let celebrating = false;
function maybeCelebrate() {
  if (celebrating || !S.profile?.town_name || S.needsUpdate || sheet().open) return;
  const t = town(); const seenL = S.profile.seen_level ?? -1; const seenB = S.profile.seen_buildings || [];
  const newB = t.built.filter((id) => !seenB.includes(id));
  if (t.level.idx <= seenL && !newB.length) return;
  celebrating = true;
  const name = S.profile.town_name; const first = seenL === -1;
  const levelUp = !first && t.level.idx > seenL;
  const bNames = newB.map((id) => BUILDINGS.find((b) => b.id === id).name);
  const unlocks = UNLOCKS.filter((u) => u.level <= t.level.idx && u.level > seenL);
  const kicker = first ? 'Town founded' : levelUp ? 'Milestone reached' : 'New building';
  const title = first ? `${name} is officially on the map` : levelUp ? `${name} is now a ${t.level.name}` : `${bNames.length > 1 ? `${bNames.length} new buildings` : `The ${bNames[0]} has opened`}`;
  const colours = ['#E8553B', '#6D4AE8', '#F2B21B', '#1C8FD6', '#0E8A6A', '#FF9A82'];
  const confetti = Array.from({ length: 28 }, (_, k) => `<i style="left:${(k * 37) % 100}%;background:${colours[k % colours.length]};animation-delay:${(k % 7) * 0.08}s"></i>`).join('');
  sheet().classList.add('celebrate');
  openSheet('', `
    <div class="confetti" aria-hidden="true">${confetti}</div>
    <div class="kicker">${kicker}</div>
    <h2 class="big-title">${esc(title)}</h2>
    <div style="background:linear-gradient(180deg,#CFEFFF,#EAF8FF);border:2px solid #000;border-radius:18px;padding:6px">${townSvg(t)}</div>
    <p style="margin:0;font-size:16px">${first ? `Starting life as a <b>${esc(t.level.name)}</b>, built from everything you've logged so far.` : any(['Look at you, being all consistent.', 'The council is thrilled. Mildly.', 'Someone fetch the bunting.', 'Frankly, showing off now.'])}</p>
    ${bNames.length || unlocks.length ? `<div class="unlocked">${bNames.map((n) => `<span>🏗️ ${esc(n)} built</span>`).join('')}${unlocks.map((u) => `<span>🔓 Unlocked: ${esc(u.text)}</span>`).join('')}</div>` : ''}
    <button type="button" class="btn primary" data-act="close-celebrate">${first ? 'Show me my town' : 'Lovely. Carry on.'}</button>`);
  q(sb.from('profiles').update({ seen_level: t.level.idx, seen_buildings: t.built }).eq('user_id', S.user.id).select().single())
    .then((p) => { S.profile = p; }).catch(() => {}).finally(() => { celebrating = false; });
}

/* ---------- Notifications ---------- */
const b64u = (str) => { const padded = str + '='.repeat((4 - (str.length % 4)) % 4); const raw = atob(padded.replace(/-/g, '+').replace(/_/g, '/')); return Uint8Array.from(raw, (c) => c.charCodeAt(0)); };
const pushSupported = () => 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
async function checkPush() {
  try {
    if (!pushSupported()) { S.pushState = 'unsupported'; return; }
    if (Notification.permission === 'denied') { S.pushState = 'blocked'; return; }
    const reg = await navigator.serviceWorker.getRegistration();
    const sub = reg && (await reg.pushManager.getSubscription());
    S.pushState = sub && Notification.permission === 'granted' ? 'on' : 'off';
  } catch { S.pushState = 'off'; }
}
async function enablePush() {
  if (!pushSupported()) { S.pushState = 'unsupported'; render(); return; }
  const perm = await Notification.requestPermission(); // must follow the tap directly
  if (perm !== 'granted') { S.pushState = perm === 'denied' ? 'blocked' : 'off'; render(); return; }
  return run(async () => {
    const reg = await navigator.serviceWorker.ready;
    let sub = await reg.pushManager.getSubscription();
    if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64u(VAPID_PUBLIC_KEY) });
    const j = sub.toJSON();
    await q(sb.from('push_subscriptions').upsert({ endpoint: j.endpoint, p256dh: j.keys.p256dh, auth: j.keys.auth }, { onConflict: 'endpoint' }));
    S.pushState = 'on';
  }, 'Notifications on. We promise not to nag. Much.');
}

function startWorkout(name) {
  return run(async () => {
    if (activeWorkout()) return;
    S.workouts.unshift(await insert('workouts', { name: (name || '').trim() || null, started_at: new Date().toISOString() }));
    if (route() !== 'gym') location.hash = '#/gym';
  }, 'Workout started');
}

const CHANGES = {
  'rem-active': (el) => run(async () => { replaceIn(S.allReminders, await update('reminders', el.dataset.id, { active: el.checked })); S.reminders = S.allReminders.filter((r) => r.active); }),
  'notify-pref': (el) => run(async () => {
    const notify = { gym: true, weekly: true, tasks: false, max2: true, quiet_paused: true, ...(S.profile?.notify || {}), [el.dataset.key]: el.checked };
    S.profile = await q(sb.from('profiles').update({ notify }).eq('user_id', S.user.id).select().single());
  }),
  'theme': (el) => run(async () => {
    S.profile = await q(sb.from('profiles').update({ theme: el.checked ? 'dark' : 'light' }).eq('user_id', S.user.id).select().single()); applyTheme();
  }),
  'set-mode': (el) => {
    const form = el.closest('form'); const mode = el.value; S.setMode = mode; form.dataset.mode = mode;
    form.querySelectorAll('.w-only input').forEach((i) => { i.disabled = mode !== 'weights'; });
    form.querySelectorAll('.c-only input').forEach((i) => { i.disabled = mode !== 'cardio'; });
    const first = form.querySelector(mode === 'cardio' ? '.c-only input[name=activity]' : '.w-only input[name=exercise]');
    if (first && !first.value) first.focus();
  },
  'task-done': (el) => run(async () => {
    const done = el.checked;
    replaceIn(S.tasks, await update('tasks', el.dataset.id, { done, done_at: done ? new Date().toISOString() : null }));
  }, el.checked ? any(Q.done) : null),
  'milestone': (el) => run(async () => {
    const done = el.checked;
    replaceIn(S.milestones, await update('milestones', el.dataset.id, { done, done_at: done ? new Date().toISOString() : null }));
  }, el.checked ? 'Milestone ticked off. Roadmap looking tidy.' : null),
};

const money = (v) => Math.round(Number(v) * 100) / 100;
const FORMS = {
  break: (f) => run(async () => {
    const row = { kind: f.get('kind'), start_date: f.get('start_date'), end_date: f.get('end_date') || null };
    S.breaks.unshift(await insert('breaks', row)); townCache = null;
  }, () => BREAK_LINE[S.breaks[0]?.kind] || 'Paused.'),
  'town-name': (f) => run(async () => {
    const name = (f.get('town_name') || '').trim(); if (!name) return;
    S.profile = await q(sb.from('profiles').update({ town_name: name }).eq('user_id', S.user.id).select().single());
  }, () => `Welcome to ${S.profile?.town_name}. Population: you.`),
  policy: (f) => run(async () => {
    const kind = f.get('kind'); const t = POLICY_TYPES[kind]; const cid = f.get('category_id');
    const cat = byId(S.cats, cid);
    const title = t.needsCat ? (kind === 'pay_first' ? `Pay yourself first (${cat?.name || 'savings'})` : `Keep ${cat?.name || 'a category'} on budget`) : t.title;
    S.policies.push(await insert('policies', { kind, title, params: t.needsCat ? { category_id: cid } : {} })); townCache = null;
  }, 'Policy enacted. The council nods sagely.'),
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
  }, () => (S.sessions[0]?.kind === 'minimum' ? `${MINIMUM_MINUTES} minutes still counts. Chain intact.` : any(Q.session))),
  'day-off': (f) => run(async () => {
    S.daysOff.push(await insert('days_off', { off_date: f.get('off_date'), reason: f.get('reason').trim() || null }));
    S.daysOff.sort((a, b) => a.off_date.localeCompare(b.off_date));
  }, 'Saved — that day won\'t count as a miss'),

  'start-workout': (f) => startWorkout(f.get('name')),
  set: (f) => run(async () => {
    const w = activeWorkout(); if (!w) return;
    if (f.get('mode') === 'cardio') {
      const act = (f.get('activity') || '').trim(); if (!act) return;
      const known = exerciseNames(true).find((n) => norm(n) === norm(act)) || act;
      const dist = f.get('distance_km');
      try {
        S.sets.push(await insert('workout_sets', { workout_id: w.id, exercise: known, kind: 'cardio', set_number: setsFor(w.id).filter((x) => norm(x.exercise) === norm(known)).length + 1, duration_min: Number(f.get('duration_min')), distance_km: dist === '' ? null : Number(dist) }));
      } catch (e) {
        if (/duration_min|distance_km|kind/.test(e.message || '')) throw new Error('cardio needs a one-off database update (see Claude\'s message)');
        throw e;
      }
      S.setMode = 'cardio';
      return;
    }
    S.setMode = 'weights';
    const exercise = (f.get('exercise') || '').trim(); if (!exercise) return;
    const existing = setsFor(w.id).filter((s) => norm(s.exercise) === norm(exercise));
    const name = existing[0]?.exercise || exerciseNames().find((n) => norm(n) === norm(exercise)) || exercise;
    const wkg = f.get('weight_kg'), reps = f.get('reps');
    S.sets.push(await insert('workout_sets', { workout_id: w.id, exercise: name, set_number: existing.length + 1, weight_kg: wkg === '' ? null : Number(wkg), reps: reps === '' ? null : Number(reps) }));
  }, () => { const last = S.sets[S.sets.length - 1]; if (!last || isCardio(last)) return any(Q.set); const b = bestFor(last.exercise); const earlier = S.sets.filter((x) => norm(x.exercise) === norm(last.exercise) && x.id !== last.id); return b && b.id === last.id && earlier.length ? `New personal best on ${last.exercise}! Frame it.` : any(Q.set); }),

  expense: (f) => run(async () => {
    const row = { amount: money(f.get('amount')), category_id: f.get('category_id') || null, description: f.get('description').trim() || null, spent_on: f.get('spent_on'), is_recurring: f.get('is_recurring') === 'on' };
    store.set('lastCat', row.category_id);
    S.expenses.unshift(await insert('expenses', row)); S.expenses.sort((a, b) => b.spent_on.localeCompare(a.spent_on));
  }, () => any(Q.expense)),
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
  }, 'Gazette published. Hot off the press.'),
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
sheet()?.addEventListener('close', () => sheet().classList.remove('celebrate'));
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
    checkPush().then(() => { if (route() === 'settings') render(); });
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
