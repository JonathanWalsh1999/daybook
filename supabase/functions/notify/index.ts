// Daybook notifications. Runs every 5 minutes (triggered by pg_cron) and sends
// any phone notifications that are due. Secrets live in Supabase → Edge Functions → Secrets:
//   VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT (e.g. mailto:you@example.com), CRON_SECRET
// SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are provided automatically.
import webpush from 'npm:web-push@3.6.7';
import { createClient } from 'npm:@supabase/supabase-js@2';

const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
webpush.setVapidDetails(Deno.env.get('VAPID_SUBJECT') || 'mailto:daybook@example.com', Deno.env.get('VAPID_PUBLIC_KEY')!, Deno.env.get('VAPID_PRIVATE_KEY')!);

const WINDOW = 5; // minutes; matches the cron schedule
const DEFAULTS = { gym: true, weekly: true, tasks: false, max2: true, quiet_paused: true };
const pick = <T>(arr: T[]) => arr[Math.floor(Math.random() * arr.length)];

function londonNow() {
  const f = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/London', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', weekday: 'short', hour12: false });
  const p = Object.fromEntries(f.formatToParts(new Date()).map((x) => [x.type, x.value]));
  const weekday = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].indexOf(p.weekday) + 1;
  return { date: `${p.year}-${p.month}-${p.day}`, weekday, minutes: (Number(p.hour) % 24) * 60 + Number(p.minute) };
}
const addDays = (s: string, n: number) => { const d = new Date(s + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const inWindow = (now: number, target: number) => now >= target && now < target + WINDOW;
const toMin = (t: string) => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };

type Msg = { key: string; title: string; body: string; url: string };

async function dueFor(uid: string, now: ReturnType<typeof londonNow>): Promise<Msg[]> {
  const { data: prof } = await sb.from('profiles').select('notify, town_name').eq('user_id', uid).maybeSingle();
  const prefs = { ...DEFAULTS, ...(prof?.notify || {}) };
  const { data: brk } = await sb.from('breaks').select('id').eq('user_id', uid).lte('start_date', now.date).or(`end_date.is.null,end_date.gte.${now.date}`);
  if (brk?.length && prefs.quiet_paused) return [];

  const out: Msg[] = [];
  // Routine reminders (e.g. Monday 6.15pm, Saturday 2.55pm)
  const { data: rems } = await sb.from('reminders').select('*').eq('user_id', uid).eq('active', true).eq('weekday', now.weekday);
  if (rems?.length) {
    const { data: last } = await sb.from('work_sessions').select('next_step').eq('user_id', uid).not('next_step', 'is', null).order('session_on', { ascending: false }).order('created_at', { ascending: false }).limit(1);
    const next = last?.[0]?.next_step;
    for (const r of rems) {
      if (!inWindow(now.minutes, toMin(r.remind_at))) continue;
      out.push({ key: `rem:${r.id}:${now.date}`, title: r.title, body: next ? `Next step: ${next}` : pick(['The kettle can wait. Probably.', 'Future you says thanks in advance.', 'Fifteen minutes still counts.']), url: './#/work' });
    }
  }
  // Gym nudge at 6pm if 3+ days since the last workout
  if (prefs.gym && inWindow(now.minutes, 18 * 60)) {
    const { data: w } = await sb.from('workouts').select('started_at').eq('user_id', uid).order('started_at', { ascending: false }).limit(1);
    const lastDay = w?.[0]?.started_at?.slice(0, 10);
    if (!lastDay || lastDay <= addDays(now.date, -3)) {
      out.push({ key: `gym:${now.date}`, title: 'Your gym membership called', body: pick(['It says it misses you. Bit clingy, but it has a point.', "It's been a few days. The dumbbells are asking questions.", 'Even a light session counts. Go on.']), url: './#/gym' });
    }
  }
  // Sunday 6pm: weekly Gazette
  if (prefs.weekly && now.weekday === 7 && inWindow(now.minutes, 18 * 60)) {
    out.push({ key: `weekly:${now.date}`, title: `The ${prof?.town_name || 'Daybook'} Gazette is out`, body: pick(['Spoiler: you did better than you think.', 'Five minutes, a cuppa, and your week in headlines.', 'Hot off the press. Mostly good news, allegedly.']), url: './#/review' });
  }
  // 8am: tasks due today (only if there are any)
  if (prefs.tasks && inWindow(now.minutes, 8 * 60)) {
    const { count } = await sb.from('tasks').select('id', { count: 'exact', head: true }).eq('user_id', uid).eq('done', false).lte('due_date', now.date);
    if (count) out.push({ key: `tasks:${now.date}`, title: `${count} thing${count === 1 ? '' : 's'} due today`, body: pick(["Nothing dramatic. Let's just get it done.", 'Tick them off before they tick you off.', 'Small list, big satisfaction.']), url: './#/tasks' });
  }
  if (!out.length) return out;

  // Don't repeat, and cap at 2 a day if asked
  const { data: sent } = await sb.from('notification_log').select('key').eq('user_id', uid).eq('sent_on', now.date);
  const sentKeys = new Set((sent || []).map((s) => s.key));
  let fresh = out.filter((m) => !sentKeys.has(m.key));
  if (prefs.max2) fresh = fresh.slice(0, Math.max(0, 2 - sentKeys.size));
  return fresh;
}

const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, content-type, apikey, x-client-info', 'Access-Control-Allow-Methods': 'POST, OPTIONS' };

// "Send me a test" button in the app: signed-in user, their own devices only.
async function sendTest(req: Request) {
  const token = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
  const { data: { user } } = await sb.auth.getUser(token);
  if (!user) return new Response('Unauthorized', { status: 401, headers: CORS });
  const { data: subs } = await sb.from('push_subscriptions').select('*').eq('user_id', user.id);
  let ok = 0;
  for (const s of subs || []) {
    try {
      await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, JSON.stringify({ title: 'Testing, testing', body: "If you can read this, notifications work. Marvellous.", url: './#/today', tag: 'test' }));
      ok++;
    } catch (e) {
      const code = (e as { statusCode?: number }).statusCode;
      if (code === 404 || code === 410) await sb.from('push_subscriptions').delete().eq('id', s.id);
    }
  }
  return new Response(JSON.stringify({ ok: true, sent: ok }), { headers: { ...CORS, 'Content-Type': 'application/json' } });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.headers.get('x-cron-secret') !== Deno.env.get('CRON_SECRET')) return sendTest(req);
  const now = londonNow();
  const { data: subs, error } = await sb.from('push_subscriptions').select('*');
  if (error) return new Response(error.message, { status: 500 });
  let sentCount = 0;
  for (const uid of [...new Set((subs || []).map((s) => s.user_id))]) {
    const msgs = await dueFor(uid, now);
    for (const m of msgs) {
      const { error: logErr } = await sb.from('notification_log').insert({ user_id: uid, key: m.key, sent_on: now.date });
      if (logErr) continue; // already sent by an overlapping run
      for (const s of subs!.filter((x) => x.user_id === uid)) {
        try {
          await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, JSON.stringify({ title: m.title, body: m.body, url: m.url, tag: m.key }));
          sentCount++;
        } catch (e) {
          const code = (e as { statusCode?: number }).statusCode;
          if (code === 404 || code === 410) await sb.from('push_subscriptions').delete().eq('id', s.id); // phone unsubscribed
        }
      }
    }
  }
  return new Response(JSON.stringify({ ok: true, at: now, sent: sentCount }), { headers: { 'Content-Type': 'application/json' } });
});
