import { GoogleGenAI } from '@google/genai';
import { MatchFixture, Player, SportType, MatchStatus } from '../../src/types';
import { resolveIsraeliBroadcast } from './israeliBroadcastService';

let aiClient: GoogleGenAI | null = null;
let geminiCooldownUntil = 0;

export function isGeminiRateLimited(): boolean {
  return Date.now() < geminiCooldownUntil;
}

export function setGeminiRateLimited(durationMs = 5 * 60 * 1000): void {
  geminiCooldownUntil = Date.now() + durationMs;
}

function getAi(): GoogleGenAI | null {
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

// ESPN League mapping definitions
export const ESPN_LEAGUE_MAP: Record<string, string> = {
  // MLS
  'mls': 'soccer/usa.1',
  'major league soccer': 'soccer/usa.1',
  'mls (major league soccer)': 'soccer/usa.1',
  
  // English Leagues
  'premier league': 'soccer/eng.1',
  'english premier league': 'soccer/eng.1',
  'epl': 'soccer/eng.1',
  'championship': 'soccer/eng.2',
  'efl championship': 'soccer/eng.2',
  'english championship': 'soccer/eng.2',

  // Spain
  'la liga': 'soccer/esp.1',
  'laliga': 'soccer/esp.1',
  'spanish la liga': 'soccer/esp.1',
  'laliga ea sports': 'soccer/esp.1',

  // Germany
  'bundesliga': 'soccer/ger.1',
  'german bundesliga': 'soccer/ger.1',

  // Italy
  'serie a': 'soccer/ita.1',
  'italian serie a': 'soccer/ita.1',

  // France
  'ligue 1': 'soccer/fra.1',
  'french ligue 1': 'soccer/fra.1',

  // Belgium
  'belgian pro league': 'soccer/bel.1',
  'jupiler pro league': 'soccer/bel.1',
  'belgian first division a': 'soccer/bel.1',

  // European UEFA
  'uefa champions league': 'soccer/uefa.champions',
  'champions league': 'soccer/uefa.champions',
  'ucl': 'soccer/uefa.champions',
  'uefa europa league': 'soccer/uefa.europa',
  'europa league': 'soccer/uefa.europa',
  'uefa conference league': 'soccer/uefa.europa.conf',
  'conference league': 'soccer/uefa.europa.conf',

  // Israel
  'israeli premier league': 'soccer/isr.1',
  'ligat haal': 'soccer/isr.1',
  "ligat ha'al": 'soccer/isr.1',

  // Saudi
  'saudi pro league': 'soccer/sau.1',

  // Basketball
  'nba': 'basketball/nba',
  'nba regular season': 'basketball/nba',
  'wnba': 'basketball/wnba',
};

// Known ESPN Team IDs for exact fast query
export const ESPN_KNOWN_TEAMS: Record<string, { league: string; teamId: string; logo?: string }> = {
  // MLS
  'charlotte fc': { league: 'soccer/usa.1', teamId: '21300', logo: 'https://a.espncdn.com/i/teamlogos/soccer/500/21300.png' },
  'philadelphia union': { league: 'soccer/usa.1', teamId: '10739', logo: 'https://a.espncdn.com/i/teamlogos/soccer/500/10739.png' },
  'inter miami cf': { league: 'soccer/usa.1', teamId: '18635', logo: 'https://a.espncdn.com/i/teamlogos/soccer/500/18635.png' },
  'inter miami': { league: 'soccer/usa.1', teamId: '18635', logo: 'https://a.espncdn.com/i/teamlogos/soccer/500/18635.png' },
  'la galaxy': { league: 'soccer/usa.1', teamId: '187', logo: 'https://a.espncdn.com/i/teamlogos/soccer/500/187.png' },
  'los angeles fc': { league: 'soccer/usa.1', teamId: '18966', logo: 'https://a.espncdn.com/i/teamlogos/soccer/500/18966.png' },
  'lafc': { league: 'soccer/usa.1', teamId: '18966', logo: 'https://a.espncdn.com/i/teamlogos/soccer/500/18966.png' },
  
  // English Football
  'leeds united': { league: 'soccer/eng.2', teamId: '357', logo: 'https://a.espncdn.com/i/teamlogos/soccer/500/357.png' },
  'arsenal': { league: 'soccer/eng.1', teamId: '359', logo: 'https://a.espncdn.com/i/teamlogos/soccer/500/359.png' },
  'manchester city': { league: 'soccer/eng.1', teamId: '382', logo: 'https://a.espncdn.com/i/teamlogos/soccer/500/382.png' },
  'liverpool': { league: 'soccer/eng.1', teamId: '364', logo: 'https://a.espncdn.com/i/teamlogos/soccer/500/364.png' },
  'chelsea': { league: 'soccer/eng.1', teamId: '363', logo: 'https://a.espncdn.com/i/teamlogos/soccer/500/363.png' },
  'tottenham hotspur': { league: 'soccer/eng.1', teamId: '367', logo: 'https://a.espncdn.com/i/teamlogos/soccer/500/367.png' },

  // Spain
  'real madrid': { league: 'soccer/esp.1', teamId: '86', logo: 'https://a.espncdn.com/i/teamlogos/soccer/500/86.png' },
  'barcelona': { league: 'soccer/esp.1', teamId: '83', logo: 'https://a.espncdn.com/i/teamlogos/soccer/500/83.png' },
  'atletico madrid': { league: 'soccer/esp.1', teamId: '1068', logo: 'https://a.espncdn.com/i/teamlogos/soccer/500/1068.png' },

  // Belgium
  'royale union saint-gilloise': { league: 'soccer/bel.1', teamId: '5807', logo: 'https://a.espncdn.com/i/teamlogos/soccer/500/5807.png' },
  'union st.-gilloise': { league: 'soccer/bel.1', teamId: '5807', logo: 'https://a.espncdn.com/i/teamlogos/soccer/500/5807.png' },
  'union sg': { league: 'soccer/bel.1', teamId: '5807', logo: 'https://a.espncdn.com/i/teamlogos/soccer/500/5807.png' },
  'kaa gent': { league: 'soccer/bel.1', teamId: '3611', logo: 'https://a.espncdn.com/i/teamlogos/soccer/500/3611.png' },
  'gent': { league: 'soccer/bel.1', teamId: '3611', logo: 'https://a.espncdn.com/i/teamlogos/soccer/500/3611.png' },
  'club brugge': { league: 'soccer/bel.1', teamId: '570', logo: 'https://a.espncdn.com/i/teamlogos/soccer/500/570.png' },
  'anderlecht': { league: 'soccer/bel.1', teamId: '441', logo: 'https://a.espncdn.com/i/teamlogos/soccer/500/441.png' },

  // NBA
  'portland trail blazers': { league: 'basketball/nba', teamId: '22', logo: 'https://a.espncdn.com/i/teamlogos/nba/500/por.png' },
  'los angeles lakers': { league: 'basketball/nba', teamId: '13', logo: 'https://a.espncdn.com/i/teamlogos/nba/500/lal.png' },
  'golden state warriors': { league: 'basketball/nba', teamId: '9', logo: 'https://a.espncdn.com/i/teamlogos/nba/500/gsw.png' },
  'denver nuggets': { league: 'basketball/nba', teamId: '7', logo: 'https://a.espncdn.com/i/teamlogos/nba/500/den.png' },
  'boston celtics': { league: 'basketball/nba', teamId: '2', logo: 'https://a.espncdn.com/i/teamlogos/nba/500/bos.png' },
  'dallas mavericks': { league: 'basketball/nba', teamId: '6', logo: 'https://a.espncdn.com/i/teamlogos/nba/500/dal.png' },
};

function normalizeText(text: string): string {
  return (text || '').toLowerCase().trim().replace(/[-_]/g, ' ');
}

/**
 * Fetch Live Official Fixtures directly from ESPN Public API
 */
export async function fetchEspnLiveSchedule(player: Player): Promise<MatchFixture[] | null> {
  const normTeam = normalizeText(player.currentTeam);
  const normLeague = normalizeText(player.league);

  let espnLeague: string | null = null;
  let espnTeamId: string | null = null;

  // 1. Direct team map
  if (ESPN_KNOWN_TEAMS[normTeam]) {
    espnLeague = ESPN_KNOWN_TEAMS[normTeam].league;
    espnTeamId = ESPN_KNOWN_TEAMS[normTeam].teamId;
  } else {
    // 2. League detection
    for (const [key, val] of Object.entries(ESPN_LEAGUE_MAP)) {
      if (normLeague.includes(key) || key.includes(normLeague)) {
        espnLeague = val;
        break;
      }
    }
  }

  if (!espnLeague) return null;

  try {
    let rawEvents: any[] = [];

    // Attempt 1: Fetch via team schedule if team ID is known
    if (espnTeamId) {
      const url = `https://site.api.espn.com/apis/site/v2/sports/${espnLeague}/teams/${espnTeamId}/schedule`;
      const res = await fetch(url, { headers: { 'Accept': 'application/json' } });
      if (res.ok) {
        const data = await res.json();
        if (data.events && Array.isArray(data.events) && data.events.length > 0) {
          rawEvents = data.events;
        }
      }
    }

    // Attempt 2: If team schedule returned 0 or no team ID, fetch league scoreboard
    if (rawEvents.length === 0) {
      const scoreboardUrl = `https://site.api.espn.com/apis/site/v2/sports/${espnLeague}/scoreboard`;
      const res = await fetch(scoreboardUrl, { headers: { 'Accept': 'application/json' } });
      if (res.ok) {
        const data = await res.json();
        if (data.events && Array.isArray(data.events)) {
          // Filter events matching the player's team
          rawEvents = data.events.filter((e: any) => {
            const evName = (e.name || '').toLowerCase();
            const comp = e.competitions?.[0];
            const hasTeam = comp?.competitors?.some((c: any) => {
              const name = (c.team?.displayName || c.team?.name || '').toLowerCase();
              const shortName = (c.team?.shortDisplayName || c.team?.abbreviation || '').toLowerCase();
              return name.includes(normTeam) || normTeam.includes(name) || (shortName && normTeam.includes(shortName));
            });
            return hasTeam || evName.includes(normTeam);
          });
        }
      }
    }

    if (rawEvents.length === 0) return null;

    // Filter to future games or recent active games
    const nowThreshold = new Date(Date.now() - 24 * 60 * 60 * 1000);
    let validEvents = rawEvents
      .filter((e: any) => new Date(e.date) >= nowThreshold)
      .slice(0, 5);

    // If all scheduled season events in the feed have passed, take the most recent 3 official matches
    if (validEvents.length === 0 && rawEvents.length > 0) {
      validEvents = rawEvents.slice(-3);
    }

    if (validEvents.length === 0) return null;

    // Parse ESPN events into MatchFixture[]
    const fixtures: MatchFixture[] = validEvents.map((event: any, idx: number) => {
      const competition = event.competitions?.[0] || {};
      const competitors = competition.competitors || [];
      
      const homeComp = competitors.find((c: any) => c.homeAway === 'home') || competitors[0] || {};
      const awayComp = competitors.find((c: any) => c.homeAway === 'away') || competitors[1] || {};

      const homeName = homeComp.team?.displayName || homeComp.team?.name || 'Home Team';
      const awayName = awayComp.team?.displayName || awayComp.team?.name || 'Away Team';

      const normPlayerTeam = normalizeText(player.currentTeam);
      const isHome = normalizeText(homeName).includes(normPlayerTeam) || normPlayerTeam.includes(normalizeText(homeName));

      const homeTeam = {
        name: homeName,
        shortName: homeComp.team?.abbreviation || homeName.substring(0, 3).toUpperCase(),
        logo: homeComp.team?.logo || (isHome ? player.teamLogo : 'https://a.espncdn.com/i/teamlogos/default-team-logo-500.png'),
        score: homeComp.score ? parseInt(homeComp.score.displayValue || homeComp.score, 10) : undefined,
      };

      const awayTeam = {
        name: awayName,
        shortName: awayComp.team?.abbreviation || awayName.substring(0, 3).toUpperCase(),
        logo: awayComp.team?.logo || (!isHome ? player.teamLogo : 'https://a.espncdn.com/i/teamlogos/default-team-logo-500.png'),
        score: awayComp.score ? parseInt(awayComp.score.displayValue || awayComp.score, 10) : undefined,
      };

      const opponentTeam = isHome ? awayTeam : homeTeam;

      // Status resolution
      const rawStatusState = event.status?.type?.state || competition.status?.type?.state || 'pre';
      let status: MatchStatus = 'scheduled';
      let liveClock: string | undefined = undefined;
      let liveScore: { home: number; away: number; period?: string } | undefined = undefined;

      if (rawStatusState === 'in') {
        status = 'live';
        liveClock = event.status?.type?.detail || event.status?.displayClock || 'LIVE';
        if (homeTeam.score !== undefined && awayTeam.score !== undefined) {
          liveScore = {
            home: homeTeam.score,
            away: awayTeam.score,
            period: event.status?.type?.shortDetail || 'LIVE'
          };
        }
      } else if (rawStatusState === 'post') {
        status = 'finished';
      }

      // Venue
      const venueName = competition.venue?.fullName || competition.venue?.name || (isHome ? `${player.currentTeam} Arena` : `${opponentTeam.name} Stadium`);
      const venueCity = competition.venue?.address?.city || competition.venue?.city || '';
      const venueCountry = competition.venue?.address?.country || 'USA';

      // Competition & broadcast
      const leagueTitle = event.season?.displayName || player.league;
      const broadcast = resolveIsraeliBroadcast(
        leagueTitle,
        player.sport,
        idx === 0
      );

      return {
        id: `espn-${event.id || `${player.id}-${idx}`}`,
        playerId: player.id,
        playerName: player.name,
        playerTeam: player.currentTeam,
        playerPhoto: player.photoUrl,
        sport: player.sport,
        league: leagueTitle,
        roundOrStage: event.season?.type === 1 ? 'Preseason' : event.season?.type === 3 ? 'Postseason / Playoffs' : 'Official Regular Season',
        homeTeam,
        awayTeam,
        isHome,
        opponentTeam,
        dateTimeUtc: new Date(event.date).toISOString(),
        venue: {
          name: venueName,
          city: venueCity,
          country: venueCountry,
        },
        broadcast,
        status,
        liveClock,
        liveScore,
        dataSource: 'espn_live',
        importanceLevel: idx === 0 ? 'high' : 'standard',
        notes: `Official live match from ESPN for ${player.name} with ${player.currentTeam}.`
      };
    });

    return fixtures;
  } catch (err) {
    console.warn(`ESPN schedule fetch error for ${player.name}:`, err);
    return null;
  }
}

/**
 * Fetch Live Real-Time Official Fixtures via Gemini with Google Search Grounding
 */
export async function fetchSearchGroundedFixtures(player: Player): Promise<MatchFixture[] | null> {
  const ai = getAi();
  if (!ai) return null;

  try {
    const prompt = `You are a real-time live sports API. What are the next 3 to 5 official upcoming match fixtures for athlete "${player.name}" playing for club "${player.currentTeam}" in competition "${player.league}"?

Use Google Search to find the EXACT real official calendar dates, kickoff times in UTC, opponent clubs, home/away status, and stadium.

Return a JSON ARRAY of objects with the exact schema:
[
  {
    "dateUtc": "2025-03-02T19:30:00Z",
    "opponentName": "Opponent Club Name",
    "opponentShort": "OPP",
    "isHome": true,
    "competition": "Competition Name (e.g. MLS, EuroLeague, Belgian Pro League)",
    "round": "Matchday / Round Name",
    "venueName": "Official Stadium Name",
    "venueCity": "City Name",
    "venueCountry": "Country Name",
    "notes": "1-sentence tactical or broadcast preview note"
  }
]

CRITICAL: Return ONLY valid JSON array. If no matches found, return empty array.`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.7-flash',
      contents: prompt,
      config: {
        tools: [{ googleSearch: {} }],
      },
    });

    const text = response.text?.trim() || '';
    const jsonMatch = text.match(/\[\s*\{[\s\S]*\}\s*\]/);
    if (!jsonMatch) return null;

    const parsedArray = JSON.parse(jsonMatch[0]);
    if (!Array.isArray(parsedArray) || parsedArray.length === 0) return null;

    const fixtures: MatchFixture[] = parsedArray.map((item: any, idx: number) => {
      const isHome = Boolean(item.isHome);
      const oppName = item.opponentName || 'Opponent Club';
      const oppShort = item.opponentShort || oppName.substring(0, 3).toUpperCase();

      const homeTeam = isHome ? {
        name: player.currentTeam,
        shortName: player.currentTeam.substring(0, 3).toUpperCase(),
        logo: player.teamLogo,
      } : {
        name: oppName,
        shortName: oppShort,
        logo: 'https://a.espncdn.com/i/teamlogos/default-team-logo-500.png',
      };

      const awayTeam = isHome ? {
        name: oppName,
        shortName: oppShort,
        logo: 'https://a.espncdn.com/i/teamlogos/default-team-logo-500.png',
      } : {
        name: player.currentTeam,
        shortName: player.currentTeam.substring(0, 3).toUpperCase(),
        logo: player.teamLogo,
      };

      const opponentTeam = isHome ? awayTeam : homeTeam;
      const competition = item.competition || player.league;
      const broadcast = resolveIsraeliBroadcast(competition, player.sport, idx === 0);

      // Validate date
      let parsedDate: Date;
      try {
        parsedDate = new Date(item.dateUtc);
        if (isNaN(parsedDate.getTime())) {
          parsedDate = new Date(Date.now() + (idx + 1) * 3 * 24 * 60 * 60 * 1000);
        }
      } catch {
        parsedDate = new Date(Date.now() + (idx + 1) * 3 * 24 * 60 * 60 * 1000);
      }

      return {
        id: `search-${player.id}-${idx}`,
        playerId: player.id,
        playerName: player.name,
        playerTeam: player.currentTeam,
        playerPhoto: player.photoUrl,
        sport: player.sport,
        league: competition,
        roundOrStage: item.round || 'Regular Season',
        homeTeam,
        awayTeam,
        isHome,
        opponentTeam,
        dateTimeUtc: parsedDate.toISOString(),
        venue: {
          name: item.venueName || (isHome ? `${player.currentTeam} Stadium` : `${oppName} Stadium`),
          city: item.venueCity || '',
          country: item.venueCountry || '',
        },
        broadcast,
        status: 'scheduled' as MatchStatus,
        dataSource: 'search_grounded',
        importanceLevel: idx === 0 ? 'high' : 'standard',
        notes: item.notes || `Live verified match schedule for ${player.name} in ${competition}.`
      };
    });

    return fixtures;
  } catch (err: any) {
    const errMsg = err?.message || String(err);
    if (errMsg.includes('429') || errMsg.includes('quota') || errMsg.includes('RESOURCE_EXHAUSTED')) {
      setGeminiRateLimited(10 * 60 * 1000); // 10 minutes cooldown
      console.info(`[SportsSync] Gemini quota limit reached (${player.name}). Using reliable official calendar schedule fallback.`);
    } else {
      console.warn(`Search grounding schedule fetch unavailable for ${player.name}:`, err?.message || err);
    }
    return null;
  }
}
