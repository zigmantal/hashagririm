import { MatchFixture, MatchTeam, WeeklyScheduleDay, WeeklyScheduleChannel, WeeklyScheduleItem } from '../../src/types';
import { getSupabaseClient } from './playerStore';
import { buildConfirmedBroadcast, buildUnconfirmedBroadcast } from './israeliBroadcastService';

// ---------------------------------------------------------------------------
// Yes broadcast-schedule data source
// ---------------------------------------------------------------------------
// IMPORTANT: this server (Cloud Run, europe-west2/London) CANNOT call svc.yes.co.il directly
// — Yes's CloudFront CDN returns HTTP 403 for requests from non-Israeli datacenter IPs
// (confirmed: x-amz-cf-pop LHR3-P3). Instead, a standalone script (scripts/fetch-yes-schedule.ts)
// runs on a cron on a machine physically located in Israel, calls the real Yes API there, and
// writes the raw results into the `yes_schedule_cache` Supabase table. Everything in this file
// reads from that table — never calls svc.yes.co.il itself.
//
// Confirmed real Yes response shape (as fetched from Israel, 2026-09-05), for reference —
// this is what scripts/fetch-yes-schedule.ts stores verbatim in `yes_schedule_cache.items`:
//   GET https://svc.yes.co.il/api/content/broadcast-schedule/channels/{CID}?date={Y-M-D}&ignorePastItems={bool}
//     -> { items: [{ id, programId, title, description, imageUrl, starts, ends, channelId }] }
//     (starts/ends are clean ISO-8601 UTC, e.g. "2026-09-05T21:30:00Z")

interface YesChannel {
  channelId: string;
  title: string;
}

interface YesScheduleItem {
  title: string;
  description?: string;
  imageUrl?: string;
  starts: string; // ISO-8601 UTC
  ends: string; // ISO-8601 UTC
}

function jerusalemDateKey(d: Date): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jerusalem' }).format(d);
}

// ---------------------------------------------------------------------------
// Sport-channel list (backed by Supabase `broadcast_channels`, refreshed periodically)
// ---------------------------------------------------------------------------

let sportChannelsCache: { channels: YesChannel[]; timestamp: number } | null = null;
const CHANNEL_LIST_TTL_MS = 1000 * 60 * 60 * 6; // 6 hours

async function loadSportChannelsFromSupabase(): Promise<YesChannel[]> {
  try {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from('broadcast_channels')
      .select('channel_id, title')
      .eq('is_sport_channel', true);
    if (error) {
      console.warn('[YesBroadcast] Supabase broadcast_channels read error:', error.message);
      return [];
    }
    return (data || []).map((row: any) => ({ channelId: row.channel_id, title: row.title }));
  } catch (err: any) {
    console.warn('[YesBroadcast] Supabase unavailable for broadcast_channels:', err?.message || err);
    return [];
  }
}

/**
 * Channel list refresh must run from Israel (same CDN restriction as schedules), so it's not
 * done from this server. If Yes adds a new sport channel, add its CID/title directly to the
 * `broadcast_channels` table (or extend scripts/fetch-yes-schedule.ts to also sync channels).
 */
export async function refreshChannelsFromYes(): Promise<{ total: number; newlyAdded: number }> {
  console.warn('[YesBroadcast] refreshChannelsFromYes is a no-op on this server (geoblocked from Israel). Update broadcast_channels manually or via scripts/fetch-yes-schedule.ts run from Israel.');
  return { total: 0, newlyAdded: 0 };
}

async function getSportChannels(): Promise<YesChannel[]> {
  if (sportChannelsCache && Date.now() - sportChannelsCache.timestamp < CHANNEL_LIST_TTL_MS) {
    return sportChannelsCache.channels;
  }
  const channels = await loadSportChannelsFromSupabase();
  sportChannelsCache = { channels, timestamp: Date.now() };
  return channels;
}

// ---------------------------------------------------------------------------
// Full schedule cache — ONE bulk read instead of many small ones
// ---------------------------------------------------------------------------
// Previously each (channel, date) pair did its own Supabase query, cached individually. For a
// single player's fixtures that meant up to ~60 separate queries (15 channels x ~4 needed
// dates) fanning out every time the cache was cold — which on Cloud Run happens often, since
// instances restart/scale and wipe in-memory state. The whole yes_schedule_cache table is only
// ~150 rows (15 channels x 7 days) and only changes when the cron script runs (~2x/day), so
// there's no reason not to just load all of it in a single query and cache it as one blob.

interface FullScheduleCacheEntry {
  byKey: Map<string, YesScheduleItem[]>; // key: `${channelId}:${dateKey}`
  timestamp: number;
}
let fullScheduleCache: FullScheduleCacheEntry | null = null;
let fullScheduleInFlight: Promise<Map<string, YesScheduleItem[]>> | null = null;
const FULL_SCHEDULE_TTL_MS = 1000 * 60 * 60; // 1 hour — data itself only changes ~2x/day

async function loadFullScheduleFromSupabase(): Promise<Map<string, YesScheduleItem[]>> {
  const byKey = new Map<string, YesScheduleItem[]>();
  try {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from('yes_schedule_cache')
      .select('channel_id, date_key, items');
    if (error) {
      console.warn('[YesBroadcast] Supabase yes_schedule_cache bulk read error:', error.message);
      return byKey;
    }
    for (const row of data || []) {
      const items = Array.isArray((row as any).items)
        ? (row as any).items
            .map((it: any) => ({
              title: String(it.title ?? '').trim(),
              description: it.description ? String(it.description).trim() : undefined,
              imageUrl: it.imageUrl ? String(it.imageUrl) : undefined,
              starts: String(it.starts ?? ''),
              ends: String(it.ends ?? ''),
            }))
            .filter((it: YesScheduleItem) => it.title && it.starts)
        : [];
      byKey.set(`${(row as any).channel_id}:${(row as any).date_key}`, items);
    }
  } catch (err: any) {
    console.warn('[YesBroadcast] Supabase unavailable for yes_schedule_cache bulk read:', err?.message || err);
  }
  return byKey;
}

async function getFullSchedule(): Promise<Map<string, YesScheduleItem[]>> {
  if (fullScheduleCache && Date.now() - fullScheduleCache.timestamp < FULL_SCHEDULE_TTL_MS) {
    return fullScheduleCache.byKey;
  }
  // Multiple concurrent callers (e.g. several players' fixtures resolving at once on a cold
  // cache) should share one in-flight request instead of each firing their own bulk query.
  if (fullScheduleInFlight) {
    return fullScheduleInFlight;
  }
  fullScheduleInFlight = loadFullScheduleFromSupabase().then((byKey) => {
    fullScheduleCache = { byKey, timestamp: Date.now() };
    fullScheduleInFlight = null;
    return byKey;
  }).catch((err) => {
    fullScheduleInFlight = null;
    throw err;
  });
  return fullScheduleInFlight;
}

async function getDaySchedule(channelId: string, date: Date, ignorePastItems: boolean): Promise<YesScheduleItem[]> {
  const dateKey = jerusalemDateKey(date);
  const byKey = await getFullSchedule();
  const items = byKey.get(`${channelId}:${dateKey}`) || [];

  if (ignorePastItems) {
    const now = Date.now();
    return items.filter((it) => {
      const end = new Date(it.ends).getTime();
      return isNaN(end) || end >= now;
    });
  }
  return items;
}

// ---------------------------------------------------------------------------
// Team-name matching
// ---------------------------------------------------------------------------
// Yes programme titles are typically in Hebrew (e.g. "כדורגל: ריאל מדריד - ברצלונה") but
// sometimes include the Latin club name too. We normalize both sides and look for either a
// known Hebrew alias or the raw English name appearing in the programme text.

const TEAM_ALIASES: Record<string, string[]> = {
  'real madrid': ['ריאל מדריד', 'real madrid'],
  'fc barcelona': ['ברצלונה', 'barcelona'],
  'atletico madrid': ['אתלטיקו מדריד', 'atletico madrid', 'atlético madrid'],
  'liverpool': ['ליברפול', 'liverpool'],
  'manchester city': ['מנצ\'סטר סיטי', 'man city', 'manchester city'],
  'manchester united': ['מנצ\'סטר יונייטד', 'man utd', 'manchester united'],
  'arsenal': ['ארסנל', 'arsenal'],
  'chelsea': ['צ\'לסי', 'chelsea'],
  'tottenham hotspur': ['טוטנהאם', 'tottenham'],
  'newcastle united': ['ניוקאסל', 'newcastle'],
  'everton': ['אברטון', 'everton'],
  'crystal palace': ['קריסטל פאלאס', 'crystal palace'],
  'aston villa': ['אסטון וילה', 'aston villa'],
  'brentford': ['ברנטפורד', 'brentford'],
  'leeds united': ['לידס יונייטד', 'leeds'],
  'fc bayern munich': ['באיירן מינכן', 'bayern munich', 'bayern münchen'],
  'borussia dortmund': ['בורוסיה דורטמונד', 'dortmund'],
  'bayer leverkusen': ['בייר לברקוזן', 'leverkusen'],
  'eintracht frankfurt': ['אייכטרכט פרנקפורט', 'frankfurt'],
  'paris saint-germain': ['פריז סן ז\'רמן', 'psg'],
  'inter miami': ['אינטר מיאמי', 'inter miami'],
  'charlotte fc': ['שרלוט', 'charlotte fc'],
  'philadelphia union': ['פילדלפיה יוניון', 'philadelphia union'],
  'dc united': ['די סי יונייטד', 'dc united'],
  'los angeles galaxy': ['לוס אנג\'לס גלאקסי', 'la galaxy'],
  'al-nassr': ['אל נאסר', 'al-nassr', 'al nassr'],
  'al-hilal': ['אל הילאל', 'al-hilal', 'al hilal'],
  'west ham united': ['ווסטהאם', 'west ham'],
  'ajax': ['אייאקס', 'ajax'],
  'feyenoord': ['פיינורד', 'feyenoord'],
  'psv eindhoven': ['פי אס וי', 'psv'],
  'az alkmaar': ['אלקמאר', 'az alkmaar'],
  'red bull salzburg': ['זלצבורג', 'salzburg'],
  'rapid wien': ['ראפיד וינה', 'rapid wien'],
  'sturm graz': ['שטורם גראץ', 'sturm graz'],
  'royale union saint-gilloise': ['יוניון סן ז\'יליז', 'union saint-gilloise', 'union sg'],
  'kaa gent': ['חנט', 'gent'],
  'club brugge': ['ברוז', 'club brugge'],
  'rsc anderlecht': ['אנדרלכט', 'anderlecht'],
  'standard liège': ['סטנדרד ליאז\'', 'standard liege'],
  'maccabi tel aviv': ['מכבי תל אביב'],
  'maccabi haifa': ['מכבי חיפה'],
  "hapoel be'er sheva": ['הפועל באר שבע'],
  'beitar jerusalem': ['בית"ר ירושלים', 'beitar jerusalem'],
  'portland trail blazers': ['פורטלנד', 'trail blazers'],
  'los angeles lakers': ['לייקרס', 'lakers'],
  'golden state warriors': ['ווריורס', 'warriors'],
  'denver nuggets': ['נאגטס', 'nuggets'],
  'boston celtics': ['סלטיקס', 'celtics'],
  'dallas mavericks': ['מאבריקס', 'mavericks'],
  'sacramento kings': ['קינגס', 'sacramento kings'],
};

function normalizeForMatch(text: string): string {
  return text.toLowerCase().replace(/['".ʼ’]/g, '').replace(/\s+/g, ' ').trim();
}

function teamMatchesText(team: MatchTeam, haystack: string): boolean {
  const normHaystack = normalizeForMatch(haystack);
  const key = normalizeForMatch(team.name);
  const aliases = TEAM_ALIASES[key] || [];
  const candidates = [team.name, team.shortName, ...aliases].filter(Boolean);
  return candidates.some((c) => normHaystack.includes(normalizeForMatch(c)));
}

// ---------------------------------------------------------------------------
// Fixture -> real channel resolution
// ---------------------------------------------------------------------------

interface ScheduleIndexEntry {
  channelId: string;
  channelTitle: string;
  item: YesScheduleItem;
}

/**
 * Resolves real Yes broadcast channels for a batch of fixtures in one pass: fetches each
 * unique (sport channel, Israel-local date) pair only once, then matches every fixture
 * against that shared index. Never throws — any fixture that can't be confidently matched
 * gets `buildUnconfirmedBroadcast()` rather than a guess.
 */
export async function resolveBroadcastsForFixtures(fixtures: MatchFixture[]): Promise<void> {
  if (fixtures.length === 0) return;

  const channels = await getSportChannels();
  if (channels.length === 0) {
    console.warn('[YesBroadcast] No sport channels available (Supabase empty or unreachable); leaving all fixtures unconfirmed.');
    fixtures.forEach((f) => { f.broadcast = buildUnconfirmedBroadcast(); });
    return;
  }

  // Collect the set of Israel-local dates we need (each fixture's date, plus the day before,
  // since evening matches can be listed against the previous Yes schedule day depending on
  // how they bucket post-midnight kickoffs).
  const neededDates = new Map<string, Date>();
  for (const f of fixtures) {
    const d = new Date(f.dateTimeUtc);
    const prev = new Date(d.getTime() - 24 * 60 * 60 * 1000);
    neededDates.set(jerusalemDateKey(d), d);
    neededDates.set(jerusalemDateKey(prev), prev);
  }

  const fetchJobs: Array<Promise<{ dateKey: string; channel: YesChannel; items: YesScheduleItem[] }>> = [];
  for (const [dateKey, date] of neededDates) {
    for (const channel of channels) {
      fetchJobs.push(
        getDaySchedule(channel.channelId, date, false)
          .then((items) => ({ dateKey, channel, items }))
          .catch(() => ({ dateKey, channel, items: [] as YesScheduleItem[] }))
      );
    }
  }

  const results = await Promise.allSettled(fetchJobs);
  const indexByDate = new Map<string, ScheduleIndexEntry[]>();
  for (const r of results) {
    if (r.status !== 'fulfilled') continue;
    const { dateKey, channel, items } = r.value;
    if (items.length === 0) continue;
    const list = indexByDate.get(dateKey) || [];
    for (const item of items) {
      list.push({ channelId: channel.channelId, channelTitle: channel.title, item });
    }
    indexByDate.set(dateKey, list);
  }

  let matchedCount = 0;

  for (const fixture of fixtures) {
    const fixtureDate = new Date(fixture.dateTimeUtc);
    const dateKey = jerusalemDateKey(fixtureDate);
    const prevDateKey = jerusalemDateKey(new Date(fixtureDate.getTime() - 24 * 60 * 60 * 1000));
    const candidates = [...(indexByDate.get(dateKey) || []), ...(indexByDate.get(prevDateKey) || [])];

    let best: ScheduleIndexEntry | null = null;
    let bestTimeDeltaMs = Infinity;

    for (const candidate of candidates) {
      const text = `${candidate.item.title} ${candidate.item.description || ''}`;
      const homeMatches = teamMatchesText(fixture.homeTeam, text);
      const awayMatches = teamMatchesText(fixture.awayTeam, text);
      if (!homeMatches || !awayMatches) continue;

      const itemStart = new Date(candidate.item.starts).getTime();
      if (isNaN(itemStart)) continue;
      const delta = Math.abs(itemStart - fixtureDate.getTime());
      // Require the programme to start within 3 hours of kickoff to avoid matching a
      // same-teams rerun/highlights show airing at a different time.
      if (delta > 3 * 60 * 60 * 1000) continue;

      if (delta < bestTimeDeltaMs) {
        best = candidate;
        bestTimeDeltaMs = delta;
      }
    }

    if (best) {
      fixture.broadcast = buildConfirmedBroadcast(best.channelTitle, best.item.title, best.item.description);
      matchedCount++;
    } else {
      fixture.broadcast = buildUnconfirmedBroadcast();
    }
  }

  console.info(`[YesBroadcast] Resolved ${matchedCount}/${fixtures.length} fixtures against real Yes schedule data.`);
}

// ---------------------------------------------------------------------------
// Weekly schedule (all tracked sport channels, next 7 days)
// ---------------------------------------------------------------------------

interface WeeklyScheduleCacheEntry {
  days: WeeklyScheduleDay[];
  timestamp: number;
}
let weeklyScheduleCache: WeeklyScheduleCacheEntry | null = null;
const WEEKLY_TTL_MS = 1000 * 60 * 60 * 12; // 12 hours (2x/day)

export async function getWeeklySchedule(forceRefresh = false): Promise<WeeklyScheduleDay[]> {
  if (!forceRefresh && weeklyScheduleCache && Date.now() - weeklyScheduleCache.timestamp < WEEKLY_TTL_MS) {
    return weeklyScheduleCache.days;
  }

  const channels = await getSportChannels();
  if (channels.length === 0) {
    return [];
  }

  const days: Date[] = [];
  for (let i = 0; i < 7; i++) {
    days.push(new Date(Date.now() + i * 24 * 60 * 60 * 1000));
  }

  const jobs: Array<Promise<{ dateKey: string; channel: YesChannel; items: YesScheduleItem[] }>> = [];
  for (const day of days) {
    for (const channel of channels) {
      jobs.push(
        getDaySchedule(channel.channelId, day, true)
          .then((items) => ({ dateKey: jerusalemDateKey(day), channel, items }))
          .catch(() => ({ dateKey: jerusalemDateKey(day), channel, items: [] as YesScheduleItem[] }))
      );
    }
  }

  const settled = await Promise.allSettled(jobs);
  const byDate = new Map<string, Map<string, WeeklyScheduleChannel>>();

  for (const r of settled) {
    if (r.status !== 'fulfilled') continue;
    const { dateKey, channel, items } = r.value;
    if (items.length === 0) continue;
    if (!byDate.has(dateKey)) byDate.set(dateKey, new Map());
    const channelsForDay = byDate.get(dateKey)!;
    const scheduleItems: WeeklyScheduleItem[] = items.map((it) => ({
      title: it.title,
      description: it.description,
      startsUtc: new Date(it.starts).toISOString(),
      endsUtc: it.ends ? new Date(it.ends).toISOString() : new Date(it.starts).toISOString(),
    }));
    channelsForDay.set(channel.channelId, { channelId: channel.channelId, title: channel.title, items: scheduleItems });
  }

  const result: WeeklyScheduleDay[] = days.map((d) => {
    const dateKey = jerusalemDateKey(d);
    const channelsMap = byDate.get(dateKey);
    return {
      dateKey,
      channels: channelsMap ? Array.from(channelsMap.values()) : [],
    };
  });

  weeklyScheduleCache = { days: result, timestamp: Date.now() };
  return result;
}

export function clearYesCaches(): void {
  fullScheduleCache = null;
  weeklyScheduleCache = null;
  sportChannelsCache = null;
}
