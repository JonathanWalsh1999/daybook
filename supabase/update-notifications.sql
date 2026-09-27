-- =====================================================================
-- Daybook notifications scheduler. Run AFTER deploying the "notify" edge function.
-- Replace PASTE_CRON_SECRET_HERE with the same CRON_SECRET you saved in
-- Supabase → Edge Functions → Secrets. (Keep the secret out of GitHub.)
-- =====================================================================
create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.unschedule(jobid) from cron.job where jobname = 'daybook-notify';

select cron.schedule(
  'daybook-notify',
  '*/5 * * * *',
  $$
  select net.http_post(
    url     := 'https://bysbvqjeaivxqkersgvf.supabase.co/functions/v1/notify',
    headers := '{"Content-Type": "application/json", "x-cron-secret": "PASTE_CRON_SECRET_HERE"}'::jsonb,
    body    := '{}'::jsonb
  );
  $$
);
