import { GoogleGenAI } from '@google/genai';
import { MatchFixture, Player, SportType } from '../../src/types';
import { resolveIsraeliBroadcast } from './israeliBroadcastService';
import { resolveBroadcastsForFixtures } from './yesBroadcastService';
import { POPULAR_PRESET_PLAYERS } from '../data/defaultPlayers';
import { fetchEspnLiveSchedule, fetchSearchGroundedFixtures, isGeminiRateLimited, setGeminiRateLimited } from './liveSportsService';
import { searchPlayerOnTheSportsDb, fetchTheSportsDbUpcomingEvents } from './sportsDbService';

let aiClient: GoogleGenAI | null = null;

function getAiClient(): GoogleGenAI | null {
  if (isGeminiRateLimited()) return null;
  if (!aiClient && process.env.GEMINI_API_KEY) {
    aiClient = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  }
  return aiClient;
}

// In-memory fixture cache to keep app snappy
const fixturesCache = new Map<string, { fixtures: MatchFixture[]; timestamp: number }>();
const CACHE_TTL_MS = 1000 * 60 * 15; // 15 minutes

// Known athlete quick catalog
const KNOWN_ATHLETES_MAP: Record<string, {
  name: string;
  nativeName: string;
  sport: SportType;
  currentTeam: string;
  league: string;
  country: string;
  position: string;
  jerseyNumber: string;
  photoUrl?: string;
  teamLogo?: string;
  bio: string;
}> = {
  'manor solomon': {
    name: 'Manor Solomon',
    nativeName: 'מנור סולומון',
    sport: 'football',
    currentTeam: 'West Ham United',
    league: 'English League Championship / Premier League',
    country: 'Israel',
    position: 'Left Wing (#14)',
    jerseyNumber: '14',
    photoUrl: 'https://r2.thesportsdb.com/images/media/player/cutout/8xfxe41762889351.png',
    teamLogo: 'https://r2.thesportsdb.com/images/media/team/badge/yutyxs1467459956.png',
    bio: 'Dynamic Israeli international forward/winger starring for West Ham United, known for cut-ins and clutch goals in English football.'
  },
  'manor solomin': {
    name: 'Manor Solomon',
    nativeName: 'מנור סולומון',
    sport: 'football',
    currentTeam: 'West Ham United',
    league: 'English League Championship / Premier League',
    country: 'Israel',
    position: 'Left Wing (#14)',
    jerseyNumber: '14',
    photoUrl: 'https://r2.thesportsdb.com/images/media/player/cutout/8xfxe41762889351.png',
    teamLogo: 'https://r2.thesportsdb.com/images/media/team/badge/yutyxs1467459956.png',
    bio: 'Dynamic Israeli international forward/winger starring for West Ham United.'
  },
  'solomon': {
    name: 'Manor Solomon',
    nativeName: 'מנור סולומון',
    sport: 'football',
    currentTeam: 'West Ham United',
    league: 'English League Championship / Premier League',
    country: 'Israel',
    position: 'Left Wing (#14)',
    jerseyNumber: '14',
    photoUrl: 'https://r2.thesportsdb.com/images/media/player/cutout/8xfxe41762889351.png',
    teamLogo: 'https://r2.thesportsdb.com/images/media/team/badge/yutyxs1467459956.png',
    bio: 'Dynamic Israeli international forward/winger starring for West Ham United.'
  },
  'מנור סולומון': {
    name: 'Manor Solomon',
    nativeName: 'מנור סולומון',
    sport: 'football',
    currentTeam: 'West Ham United',
    league: 'English League Championship / Premier League',
    country: 'Israel',
    position: 'Left Wing (#14)',
    jerseyNumber: '14',
    photoUrl: 'https://r2.thesportsdb.com/images/media/player/cutout/8xfxe41762889351.png',
    teamLogo: 'https://r2.thesportsdb.com/images/media/team/badge/yutyxs1467459956.png',
    bio: 'Dynamic Israeli international forward/winger starring for West Ham United.'
  },
  'oscar gloukh': {
    name: 'Oscar Gloukh',
    nativeName: 'אוסקר גלוך',
    sport: 'football',
    currentTeam: 'Ajax',
    league: 'Dutch Eredivisie',
    country: 'Israel',
    position: 'Attacking Midfield (#10)',
    jerseyNumber: '10',
    photoUrl: 'https://r2.thesportsdb.com/images/media/player/cutout/kxjkcn1759498060.png',
    teamLogo: 'https://r2.thesportsdb.com/images/media/team/badge/zg9tii1755495289.png',
    bio: 'Prodigious Israeli playmaker starring for Dutch powerhouse Ajax and the Israel national team.'
  },
  'gloukh': {
    name: 'Oscar Gloukh',
    nativeName: 'אוסקר גלוך',
    sport: 'football',
    currentTeam: 'Ajax',
    league: 'Dutch Eredivisie',
    country: 'Israel',
    position: 'Attacking Midfield (#10)',
    jerseyNumber: '10',
    photoUrl: 'https://r2.thesportsdb.com/images/media/player/cutout/kxjkcn1759498060.png',
    teamLogo: 'https://r2.thesportsdb.com/images/media/team/badge/zg9tii1755495289.png',
    bio: 'Prodigious Israeli playmaker starring for Ajax.'
  },
  'אוסקר גלוך': {
    name: 'Oscar Gloukh',
    nativeName: 'אוסקר גלוך',
    sport: 'football',
    currentTeam: 'Ajax',
    league: 'Dutch Eredivisie',
    country: 'Israel',
    position: 'Attacking Midfield (#10)',
    jerseyNumber: '10',
    photoUrl: 'https://r2.thesportsdb.com/images/media/player/cutout/kxjkcn1759498060.png',
    teamLogo: 'https://r2.thesportsdb.com/images/media/team/badge/zg9tii1755495289.png',
    bio: 'Prodigious Israeli playmaker starring for Ajax.'
  },
  'daniel peretz': {
    name: 'Daniel Peretz',
    nativeName: 'דניאל פרץ',
    sport: 'football',
    currentTeam: 'FC Bayern Munich',
    league: 'German Bundesliga',
    country: 'Israel',
    position: 'Goalkeeper (#18)',
    jerseyNumber: '18',
    teamLogo: 'https://a.espncdn.com/i/teamlogos/soccer/500/132.png',
    bio: 'Israeli goalkeeper at European giants FC Bayern Munich.'
  },
  'דניאל פרץ': {
    name: 'Daniel Peretz',
    nativeName: 'דניאל פרץ',
    sport: 'football',
    currentTeam: 'FC Bayern Munich',
    league: 'German Bundesliga',
    country: 'Israel',
    position: 'Goalkeeper (#18)',
    jerseyNumber: '18',
    teamLogo: 'https://a.espncdn.com/i/teamlogos/soccer/500/132.png',
    bio: 'Israeli goalkeeper at European giants FC Bayern Munich.'
  },
  'deni avdija': {
    name: 'Deni Avdija',
    nativeName: 'דני אבדיה',
    sport: 'basketball',
    currentTeam: 'Portland Trail Blazers',
    league: 'NBA',
    country: 'Israel',
    position: 'Forward (#8)',
    jerseyNumber: '8',
    teamLogo: 'https://a.espncdn.com/i/teamlogos/nba/500/por.png',
    bio: 'Israeli basketball star forward for the Portland Trail Blazers in the NBA.'
  },
  'דני אבדיה': {
    name: 'Deni Avdija',
    nativeName: 'דני אבדיה',
    sport: 'basketball',
    currentTeam: 'Portland Trail Blazers',
    league: 'NBA',
    country: 'Israel',
    position: 'Forward (#8)',
    jerseyNumber: '8',
    teamLogo: 'https://a.espncdn.com/i/teamlogos/nba/500/por.png',
    bio: 'Israeli basketball star forward for the Portland Trail Blazers in the NBA.'
  },
  'yam madar': {
    name: 'Yam Madar',
    nativeName: 'ים מדר',
    sport: 'basketball',
    currentTeam: 'FC Bayern Munich Basketball',
    league: 'EuroLeague Basketball',
    country: 'Israel',
    position: 'Point Guard (#41)',
    jerseyNumber: '41',
    teamLogo: 'https://a.espncdn.com/i/teamlogos/basketball/500/bayern.png',
    bio: 'Israeli star point guard playing in the EuroLeague.'
  },
  'ים מדר': {
    name: 'Yam Madar',
    nativeName: 'ים מדר',
    sport: 'basketball',
    currentTeam: 'FC Bayern Munich Basketball',
    league: 'EuroLeague Basketball',
    country: 'Israel',
    position: 'Point Guard (#41)',
    jerseyNumber: '41',
    teamLogo: 'https://a.espncdn.com/i/teamlogos/basketball/500/bayern.png',
    bio: 'Israeli star point guard playing in the EuroLeague.'
  },
  'eli dasa': {
    name: 'Eli Dasa',
    nativeName: 'אלי דסה',
    sport: 'football',
    currentTeam: 'Dynamo Moscow',
    league: 'Russian Premier League',
    country: 'Israel',
    position: 'Right Back (#2)',
    jerseyNumber: '2',
    teamLogo: 'https://a.espncdn.com/i/teamlogos/soccer/500/328.png',
    bio: 'Captain and right-back of the Israel national football team.'
  },
  'liel abada': {
    name: 'Liel Abada',
    nativeName: 'ליאל עבדה',
    sport: 'football',
    currentTeam: 'Charlotte FC',
    league: 'MLS (Major League Soccer)',
    country: 'Israel',
    position: 'Winger (#11)',
    jerseyNumber: '11',
    teamLogo: 'https://a.espncdn.com/i/teamlogos/soccer/500/20906.png',
    bio: 'Israeli star designated player winger starring for Charlotte FC in Major League Soccer.'
  },
  'tai baribo': {
    name: 'Tai Baribo',
    nativeName: 'תאי בריבו',
    sport: 'football',
    currentTeam: 'Philadelphia Union',
    league: 'MLS (Major League Soccer)',
    country: 'Israel',
    position: 'Striker (#27)',
    jerseyNumber: '27',
    teamLogo: 'https://a.espncdn.com/i/teamlogos/soccer/500/10739.png',
    bio: 'Prolific Israeli international striker leading the Philadelphia Union attack in MLS.'
  },
  'anan khalaili': {
    name: 'Anan Khalaili',
    nativeName: 'ענאן חלאילי',
    sport: 'football',
    currentTeam: 'Crystal Palace',
    league: 'English Premier League',
    country: 'Israel',
    position: 'Right Wing (#11)',
    jerseyNumber: '11',
    photoUrl: 'https://r2.thesportsdb.com/images/media/player/cutout/rldq7y1767102670.png',
    teamLogo: 'https://r2.thesportsdb.com/images/media/team/badge/ia6i3m1656014992.png',
    bio: 'Electric Israeli winger starring for Crystal Palace in the English Premier League.'
  },
  'ענאן חלאילי': {
    name: 'Anan Khalaili',
    nativeName: 'ענאן חלאילי',
    sport: 'football',
    currentTeam: 'Crystal Palace',
    league: 'English Premier League',
    country: 'Israel',
    position: 'Right Wing (#11)',
    jerseyNumber: '11',
    photoUrl: 'https://r2.thesportsdb.com/images/media/player/cutout/rldq7y1767102670.png',
    teamLogo: 'https://r2.thesportsdb.com/images/media/team/badge/ia6i3m1656014992.png',
    bio: 'Electric Israeli winger starring for Crystal Palace in the English Premier League.'
  },
  'omri gandelman': {
    name: 'Omri Gandelman',
    nativeName: 'עומרי גאנדלמן',
    sport: 'football',
    currentTeam: 'KAA Gent',
    league: 'Belgian Pro League / UEFA Conference League',
    country: 'Israel',
    position: 'Midfielder (#6)',
    jerseyNumber: '6',
    teamLogo: 'https://a.espncdn.com/i/teamlogos/soccer/500/203.png',
    bio: 'Goalscoring midfielder for KAA Gent in Belgian Pro League and European competitions.'
  },
  'dor turgeman': {
    name: 'Dor Turgeman',
    nativeName: 'דור תורג\'מן',
    sport: 'football',
    currentTeam: 'Maccabi Tel Aviv',
    league: 'Israeli Premier League / UEFA Europa League',
    country: 'Israel',
    position: 'Striker (#32)',
    jerseyNumber: '32',
    teamLogo: 'https://a.espncdn.com/i/teamlogos/soccer/500/583.png',
    bio: 'Dynamic Israeli forward leading Maccabi Tel Aviv in domestic and European play.'
  },
  'tamir blatt': {
    name: 'Tamir Blatt',
    nativeName: 'תמיר בלאט',
    sport: 'basketball',
    currentTeam: 'Maccabi Tel Aviv Basketball',
    league: 'EuroLeague / Israeli Winner League',
    country: 'Israel',
    position: 'Point Guard (#45)',
    jerseyNumber: '45',
    teamLogo: 'https://a.espncdn.com/i/teamlogos/basketball/500/maccabi.png',
    bio: 'Elite playmaker and 3-point marksman for Maccabi Tel Aviv in the EuroLeague.'
  },
  'roman sorkin': {
    name: 'Roman Sorkin',
    nativeName: 'רומן סורקין',
    sport: 'basketball',
    currentTeam: 'Maccabi Tel Aviv Basketball',
    league: 'EuroLeague / Israeli Winner League',
    country: 'Israel',
    position: 'Center / Forward (#9)',
    jerseyNumber: '9',
    teamLogo: 'https://a.espncdn.com/i/teamlogos/basketball/500/maccabi.png',
    bio: 'Dominant Israeli big man and MVP finalist with Maccabi Tel Aviv in EuroLeague action.'
  },
  'tomer ginat': {
    name: 'Tomer Ginat',
    nativeName: 'תומר גינת',
    sport: 'basketball',
    currentTeam: 'Hapoel Tel Aviv Basketball',
    league: 'EuroCup / Israeli Winner League',
    country: 'Israel',
    position: 'Power Forward (#41)',
    jerseyNumber: '41',
    teamLogo: 'https://a.espncdn.com/i/teamlogos/basketball/500/hapoel-tel-aviv.png',
    bio: 'Captain of the Israel national team and Hapoel Tel Aviv talisman in EuroCup.'
  },
  'kylian mbappe': {
    name: 'Kylian Mbappé',
    nativeName: 'קיליאן אמבפה',
    sport: 'football',
    currentTeam: 'Real Madrid',
    league: 'Spanish La Liga / UEFA Champions League',
    country: 'France',
    position: 'Forward (#9)',
    jerseyNumber: '9',
    teamLogo: 'https://a.espncdn.com/i/teamlogos/soccer/500/86.png',
    bio: 'Global superstar forward leading Real Madrid in Spanish La Liga and Champions League.'
  },
  'lionel messi': {
    name: 'Lionel Messi',
    nativeName: 'ליאו מסי',
    sport: 'football',
    currentTeam: 'Inter Miami',
    league: 'MLS (Major League Soccer)',
    country: 'Argentina',
    position: 'Forward (#10)',
    jerseyNumber: '10',
    teamLogo: 'https://a.espncdn.com/i/teamlogos/soccer/500/20232.png',
    bio: '8-time Ballon d\'Or champion commanding Inter Miami in MLS.'
  },
  'cristiano ronaldo': {
    name: 'Cristiano Ronaldo',
    nativeName: 'כריסטיאנו רונאלדו',
    sport: 'football',
    currentTeam: 'Al-Nassr',
    league: 'Saudi Pro League / AFC Champions League',
    country: 'Portugal',
    position: 'Striker (#7)',
    jerseyNumber: '7',
    teamLogo: 'https://a.espncdn.com/i/teamlogos/soccer/500/6909.png',
    bio: 'Legendary goalscorer leading Al-Nassr in the Saudi Pro League.'
  },
  'vinicius jr': {
    name: 'Vinicius Jr',
    nativeName: 'ויניסיוס ג\'וניור',
    sport: 'football',
    currentTeam: 'Real Madrid',
    league: 'Spanish La Liga / UEFA Champions League',
    country: 'Brazil',
    position: 'Winger (#7)',
    jerseyNumber: '7',
    teamLogo: 'https://a.espncdn.com/i/teamlogos/soccer/500/86.png',
    bio: 'Superstar Brazilian winger electrifying Real Madrid in La Liga and Champions League.'
  },
  'robert lewandowski': {
    name: 'Robert Lewandowski',
    nativeName: 'רוברט לבנדובסקי',
    sport: 'football',
    currentTeam: 'FC Barcelona',
    league: 'Spanish La Liga / UEFA Champions League',
    country: 'Poland',
    position: 'Striker (#9)',
    jerseyNumber: '9',
    teamLogo: 'https://a.espncdn.com/i/teamlogos/soccer/500/83.png',
    bio: 'Prolific goalscoring striker leading FC Barcelona in La Liga.'
  },
  'lamine yamal': {
    name: 'Lamine Yamal',
    nativeName: 'לאמין ימאל',
    sport: 'football',
    currentTeam: 'FC Barcelona',
    league: 'Spanish La Liga / UEFA Champions League',
    country: 'Spain',
    position: 'Winger (#19)',
    jerseyNumber: '19',
    teamLogo: 'https://a.espncdn.com/i/teamlogos/soccer/500/83.png',
    bio: 'Sensational Spanish wunderkind winger starring for FC Barcelona in La Liga.'
  },
  'mohamed salah': {
    name: 'Mohamed Salah',
    nativeName: 'מוחמד סלאח',
    sport: 'football',
    currentTeam: 'Liverpool',
    league: 'Premier League / UEFA Champions League',
    country: 'Egypt',
    position: 'Winger (#11)',
    jerseyNumber: '11',
    teamLogo: 'https://a.espncdn.com/i/teamlogos/soccer/500/364.png',
    bio: 'Egyptian king and Premier League top goalscorer for Liverpool.'
  }
};

export function clearPlayerFixtureCache(playerId?: string) {
  if (playerId) {
    fixturesCache.delete(`fixtures-${playerId}`);
  } else {
    fixturesCache.clear();
  }
}

export async function lookupAthleteDetails(athleteName: string): Promise<{
  name: string;
  nativeName: string;
  sport: SportType;
  currentTeam: string;
  league: string;
  country: string;
  position: string;
  jerseyNumber: string;
  photoUrl: string;
  teamLogo: string;
  bio: string;
} | null> {
  const cleanKey = athleteName.toLowerCase().trim();

  // 1. Gemini AI Lookup with live Google Search grounding FIRST — this is the only source here
  // that can actually reflect a very recent transfer, since it searches the live web rather
  // than relying on a community-maintained DB snapshot (TheSportsDB, below) or training data.
  const ai = getAiClient();
  if (ai && !isGeminiRateLimited()) {
    try {
      const prompt = `Identify the professional athlete "${athleteName}" and find their CURRENT real-world
      team/club using up-to-date web search — this must reflect any recent transfers, not just
      commonly-known historical team associations. Today's date context: use search results, not memory.

      Return ONLY a valid JSON object (no markdown, no commentary) with these fields:
      - name: Full name in English
      - nativeName: Hebrew name if known, else same as name
      - sport: "football" | "basketball" | "tennis" | "other"
      - currentTeam: Exact current club/team as of today
      - league: League name (e.g. "MLS (Major League Soccer)", "Belgian Pro League", "Spanish La Liga", "Israeli Premier League", "NBA", "EuroLeague")
      - country: Nationality (e.g. "Israel", "France", "Spain")
      - position: Position like "Winger (#11)", "Striker (#27)", "Point Guard (#45)"
      - jerseyNumber: Jersey number as string
      - teamLogo: Valid public ESPN logo url (https://a.espncdn.com/...) or empty string
      - bio: Brief 1-2 sentence description mentioning their current club

      If you find evidence of a recent transfer, use the NEW club, not the previous one.`;

      const response = await ai.models.generateContent({
        model: 'gemini-3.7-flash',
        contents: prompt,
        config: {
          tools: [{ googleSearch: {} }],
        },
      });

      const text = response.text?.trim() || '';
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        const sport = (['football', 'basketball', 'tennis'].includes(parsed.sport?.toLowerCase())
          ? parsed.sport.toLowerCase()
          : 'football') as SportType;

        return {
          name: parsed.name || athleteName,
          nativeName: parsed.nativeName || parsed.name || athleteName,
          sport,
          currentTeam: parsed.currentTeam || 'Club Team',
          league: parsed.league || 'Top League',
          country: parsed.country || 'International',
          position: parsed.position || 'Player',
          jerseyNumber: parsed.jerseyNumber || '',
          photoUrl: sport === 'basketball'
            ? 'https://images.unsplash.com/photo-1546519638-68e109498ffc?w=600&auto=format&fit=crop&q=80'
            : 'https://images.unsplash.com/photo-1508098682722-e99c43a406b2?w=600&auto=format&fit=crop&q=80',
          teamLogo: parsed.teamLogo || 'https://a.espncdn.com/i/teamlogos/default-team-logo-500.png',
          bio: parsed.bio || `Professional ${sport} athlete playing for ${parsed.currentTeam}.`
        };
      }
    } catch (err: any) {
      const errMsg = err?.message || String(err);
      if (errMsg.includes('429') || errMsg.includes('quota') || errMsg.includes('RESOURCE_EXHAUSTED')) {
        setGeminiRateLimited(10 * 60 * 1000);
        console.info(`[SportsSync] Gemini quota reached for athlete lookup (${athleteName}). Falling back to TheSportsDB/static data.`);
      } else {
        console.warn('AI search-grounded lookup error:', err?.message || err);
      }
    }
  }

  // 2. TheSportsDB — used as a fallback if the search-grounded AI lookup above was unavailable
  // (rate-limited) or failed. This is a community-maintained free DB that can itself lag behind
  // very recent transfers, which is why it's no longer checked first.
  try {
    const sportsDbResult = await searchPlayerOnTheSportsDb(athleteName);
    if (sportsDbResult && sportsDbResult.currentTeam && sportsDbResult.currentTeam !== 'Free Agent') {
      const known = KNOWN_ATHLETES_MAP[cleanKey] || POPULAR_PRESET_PLAYERS.find(p => p.name.toLowerCase() === cleanKey);
      return {
        ...sportsDbResult,
        nativeName: known?.nativeName || sportsDbResult.nativeName || sportsDbResult.name,
      };
    }
  } catch (tsdbErr) {
    console.warn('[SportsSync] TheSportsDB search error:', tsdbErr);
  }

  // 3. Direct dictionary match — hardcoded in the codebase, so this can go stale after a real
  // transfer. Only reached if TheSportsDB and the search-grounded AI lookup above both failed.
  if (KNOWN_ATHLETES_MAP[cleanKey]) {
    const known = KNOWN_ATHLETES_MAP[cleanKey];
    return {
      name: known.name,
      nativeName: known.nativeName,
      sport: known.sport,
      currentTeam: known.currentTeam,
      league: known.league,
      country: known.country,
      position: known.position,
      jerseyNumber: known.jerseyNumber,
      photoUrl: known.sport === 'basketball'
        ? 'https://images.unsplash.com/photo-1546519638-68e109498ffc?w=600&auto=format&fit=crop&q=80'
        : 'https://images.unsplash.com/photo-1508098682722-e99c43a406b2?w=600&auto=format&fit=crop&q=80',
      teamLogo: known.teamLogo || 'https://a.espncdn.com/i/teamlogos/default-team-logo-500.png',
      bio: known.bio
    };
  }

  // 4. Fuzzy / partial match in KNOWN_ATHLETES_MAP (same staleness caveat as above)
  for (const [key, known] of Object.entries(KNOWN_ATHLETES_MAP)) {
    if (cleanKey.includes(key) || key.includes(cleanKey) || (cleanKey.length > 4 && key.startsWith(cleanKey.slice(0, 4)))) {
      return {
        name: known.name,
        nativeName: known.nativeName,
        sport: known.sport,
        currentTeam: known.currentTeam,
        league: known.league,
        country: known.country,
        position: known.position,
        jerseyNumber: known.jerseyNumber,
        photoUrl: known.sport === 'basketball'
          ? 'https://images.unsplash.com/photo-1546519638-68e109498ffc?w=600&auto=format&fit=crop&q=80'
          : 'https://images.unsplash.com/photo-1508098682722-e99c43a406b2?w=600&auto=format&fit=crop&q=80',
        teamLogo: known.teamLogo || 'https://a.espncdn.com/i/teamlogos/default-team-logo-500.png',
        bio: known.bio
      };
    }
  }

  // 5. Check preset list (same staleness caveat)
  const preset = POPULAR_PRESET_PLAYERS.find(p => 
    p.name.toLowerCase() === cleanKey || 
    p.nativeName.toLowerCase() === cleanKey ||
    p.name.toLowerCase().includes(cleanKey) ||
    cleanKey.includes(p.name.toLowerCase())
  );

  if (preset) {
    return {
      name: preset.name,
      nativeName: preset.nativeName,
      sport: preset.sport,
      currentTeam: preset.currentTeam,
      league: preset.league,
      country: preset.country,
      position: preset.position,
      jerseyNumber: preset.jerseyNumber || '',
      photoUrl: preset.photoUrl,
      teamLogo: preset.teamLogo,
      bio: preset.bio
    };
  }

  // 6. Ultimate smart heuristic fallback
  const isBasketball = /basketball|basket|nba|macabi|hapoel.*basket/i.test(athleteName);
  return {
    name: athleteName.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' '),
    nativeName: athleteName,
    sport: isBasketball ? 'basketball' : 'football',
    currentTeam: 'International Pro Club',
    league: isBasketball ? 'Pro Basketball League' : 'Pro Football League',
    country: 'Israel',
    position: 'Athlete',
    jerseyNumber: '10',
    photoUrl: isBasketball
      ? 'https://images.unsplash.com/photo-1546519638-68e109498ffc?w=600&auto=format&fit=crop&q=80'
      : 'https://images.unsplash.com/photo-1508098682722-e99c43a406b2?w=600&auto=format&fit=crop&q=80',
    teamLogo: 'https://a.espncdn.com/i/teamlogos/default-team-logo-500.png',
    bio: `Professional athlete tracked on SportsSync Elite.`
  };
}

export async function fetchPlayerFixtures(player: Player, forceRefresh = false): Promise<MatchFixture[]> {
  const cacheKey = `fixtures-${player.id}`;
  const cached = fixturesCache.get(cacheKey);

  if (!forceRefresh && cached && (Date.now() - cached.timestamp < CACHE_TTL_MS)) {
    return cached.fixtures;
  }

  let fixtures: MatchFixture[] = [];

  // 1. Attempt TheSportsDB Official Live Event Schedule API
  if (fixtures.length === 0) {
    try {
      const tsdbFixtures = await fetchTheSportsDbUpcomingEvents(player);
      if (tsdbFixtures && tsdbFixtures.length > 0) {
        fixtures = tsdbFixtures;
      }
    } catch (err) {
      console.warn(`TheSportsDB API fallback for ${player.name}:`, err);
    }
  }

  // 2. Attempt High-Speed Live ESPN Official Schedule / Scoreboard API
  if (fixtures.length === 0) {
    try {
      const espnFixtures = await fetchEspnLiveSchedule(player);
      if (espnFixtures && espnFixtures.length > 0) {
        fixtures = espnFixtures;
      }
    } catch (err) {
      console.warn(`ESPN API fallback for ${player.name}:`, err);
    }
  }

  // 3. Attempt Real-Time Google Search Grounding for unmapped / international leagues
  if (fixtures.length === 0) {
    try {
      const searchFixtures = await fetchSearchGroundedFixtures(player);
      if (searchFixtures && searchFixtures.length > 0) {
        fixtures = searchFixtures;
      }
    } catch (err) {
      console.warn(`Search grounding fallback for ${player.name}:`, err);
    }
  }

  // No placeholder/template fixtures: if none of the real sources above returned a game,
  // the player simply has no upcoming fixtures listed.

  // Resolve real Israeli broadcast channels against Yes's live schedule feed, overriding
  // whatever placeholder `resolveIsraeliBroadcast` guess is currently sitting on each fixture
  // (regardless of which source produced them above). Fixtures with no confident match are
  // left explicitly unconfirmed rather than showing a possibly-wrong guess. Never throws.
  try {
    await resolveBroadcastsForFixtures(fixtures);
  } catch (err) {
    console.warn(`[SportsDataService] Yes broadcast resolution failed for ${player.name}:`, err);
  }

  fixturesCache.set(cacheKey, { fixtures, timestamp: Date.now() });
  return fixtures;
}

export async function fetchAllActiveFixtures(players: Player[], forceRefresh = false): Promise<MatchFixture[]> {
  const activePlayers = players.filter((p) => p.active);

  const results = await Promise.allSettled(
    activePlayers.map(async (player) => {
      try {
        return await fetchPlayerFixtures(player, forceRefresh);
      } catch (err) {
        console.error(`[SportsDataService] Error fetching fixtures for ${player.name} (${player.id}):`, err);
        return [];
      }
    })
  );

  const allFixtures: MatchFixture[] = [];
  for (const result of results) {
    if (result.status === 'fulfilled' && Array.isArray(result.value)) {
      allFixtures.push(...result.value);
    }
  }

  // Sort by date ascending
  return allFixtures.sort((a, b) => new Date(a.dateTimeUtc).getTime() - new Date(b.dateTimeUtc).getTime());
}
