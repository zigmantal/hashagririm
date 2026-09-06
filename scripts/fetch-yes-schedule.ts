/**
 * Standalone Yes schedule fetcher.
 *
 * MUST be run from an Israeli IP — Yes's CloudFront CDN in front of svc.yes.co.il returns
 * HTTP 403 for requests from foreign datacenter IPs (confirmed from Cloud Run's London
 * region, x-amz-cf-pop: LHR3-P3). This script is meant to run on a schedule (cron/launchd)
 * on a machine physically located in Israel, or with an Israeli residential/business IP.
 *
 * It fetches the next 7 days of programming for every sport channel in the `broadcast_channels`
 * table and upserts the raw items into `yes_schedule_cache` in Supabase. The Cloud Run app
 * (server/services/yesBroadcastService.ts) reads from that table instead of calling Yes
 * directly, so it works fine from London.
 *
 * Usage:
 *   npx tsx scripts/fetch-yes-schedule.ts
 *
 * Requires SUPABASE_URL and SUPABASE_SERVICE_KEY in the environment (e.g. via a local .env
 * file loaded with dotenv, same as the main server).
 *
 * Suggested cron (twice a day, matching the app's read-side cache TTL):
 *   0 6,18 * * *  cd /path/to/hashagririm && /usr/local/bin/npx tsx scripts/fetch-yes-schedule.ts >> /path/to/hashagririm/logs/yes-fetch.log 2>&1
 */

import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config();

const YES_BASE_URL = 'https://svc.yes.co.il/api/content/broadcast-schedule';
const YES_UA = 'Mozilla/5.0 (Linux; Linux x86_64) AppleWebKit/600.3 (KHTML, like Gecko) Chrome/48.0.2544.291 Safari/600';
const FETCH_TIMEOUT_MS = 10000;
const DAYS_AHEAD = 7;

function getSupabase() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) {
    throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_KEY in environment (.env).');
  }
  return createClient(url, key, { auth: { persistSession: false } });
}

async function yesFetch(path: string): Promise<any | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(`${YES_BASE_URL}${path}`, {
      headers: {
        'Accept': 'application/json',
        'Accept-Language': 'he-IL',
        'User-Agent': YES_UA,
      },
      signal: controller.signal,
    });
    if (!res.ok) {
      console.warn(`  [HTTP ${res.status}] ${path}`);
      return null;
    }
    return await res.json();
  } catch (err: any) {
    console.warn(`  [ERROR] ${path}: ${err?.message || err}`);
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

function formatYesDate(d: Date): string {
  // Yes expects the Asia/Jerusalem calendar day, NOT zero-padded: "2026-9-6"
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jerusalem',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
  }).formatToParts(d);
  const y = parts.find((p) => p.type === 'year')?.value;
  const m = parts.find((p) => p.type === 'month')?.value;
  const day = parts.find((p) => p.type === 'day')?.value;
  return `${y}-${m}-${day}`;
}

function jerusalemDateKey(d: Date): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jerusalem' }).format(d);
}

async function main() {
  const startedAt = Date.now();
  const supabase = getSupabase();

  const { data: channels, error } = await supabase
    .from('broadcast_channels')
    .select('channel_id, title')
    .eq('is_sport_channel', true);

  if (error) {
    console.error('Failed to load broadcast_channels from Supabase:', error.message);
    process.exit(1);
  }
  if (!channels || channels.length === 0) {
    console.error('No sport channels found in broadcast_channels — nothing to fetch.');
    process.exit(1);
  }

  console.log(`Fetching ${DAYS_AHEAD} days for ${channels.length} channels...`);

  const days: Date[] = [];
  for (let i = 0; i < DAYS_AHEAD; i++) {
    days.push(new Date(Date.now() + i * 24 * 60 * 60 * 1000));
  }

  let okCount = 0;
  let failCount = 0;
  const rows: Array<{ channel_id: string; date_key: string; items: any[]; channel_title: string; fetched_at: string }> = [];

  for (const channel of channels) {
    for (const day of days) {
      const dateStr = formatYesDate(day);
      const dateKey = jerusalemDateKey(day);
      const json = await yesFetch(`/channels/${encodeURIComponent(channel.channel_id)}?date=${dateStr}&ignorePastItems=false`);
      const items = Array.isArray(json?.items) ? json.items : [];

      if (json === null) {
        failCount++;
      } else {
        okCount++;
        rows.push({
          channel_id: channel.channel_id,
          date_key: dateKey,
          items,
          channel_title: channel.title,
          fetched_at: new Date().toISOString(),
        });
      }
    }
    console.log(`  ${channel.title} (${channel.channel_id}): done`);
  }

  if (rows.length > 0) {
    const { error: upsertError } = await supabase
      .from('yes_schedule_cache')
      .upsert(rows, { onConflict: 'channel_id,date_key' });
    if (upsertError) {
      console.error('Failed to upsert into yes_schedule_cache:', upsertError.message);
      process.exit(1);
    }
  }

  const elapsedSec = ((Date.now() - startedAt) / 1000).toFixed(1);
  console.log(`Done in ${elapsedSec}s — ${okCount} channel/day fetches OK, ${failCount} failed, ${rows.length} rows upserted.`);
}

main().catch((err) => {
  console.error('Fatal error in fetch-yes-schedule:', err);
  process.exit(1);
});
