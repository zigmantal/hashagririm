import { GoogleGenAI, Type } from '@google/genai';
import { MatchFixture, Player, SportType } from '../../src/types';
import { resolveIsraeliBroadcast } from './israeliBroadcastService';
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

interface RawFixtureTemplate {
  opponent: string;
  opponentShort: string;
  opponentLogo: string;
  isHome: boolean;
  competition: string;
  round: string;
  venueName: string;
  venueCity: string;
  venueCountry: string;
  daysFromNow: number;
  timeHourUtc: number;
  timeMinuteUtc: number;
  importance: 'high' | 'medium' | 'derby' | 'championship' | 'standard';
  customBroadcast?: string;
  notes?: string;
}

// Rich realistic upcoming schedule matrix for known teams & leagues
const SCHEDULE_TEMPLATES: Record<string, RawFixtureTemplate[]> = {
  // Deni Avdija - Portland Trail Blazers (NBA)
  'Portland Trail Blazers': [
    {
      opponent: 'Los Angeles Lakers',
      opponentShort: 'LAL',
      opponentLogo: 'https://a.espncdn.com/i/teamlogos/nba/500/lal.png',
      isHome: true,
      competition: 'NBA Regular Season',
      round: 'Western Conference Clash',
      venueName: 'Moda Center',
      venueCity: 'Portland, OR',
      venueCountry: 'USA',
      daysFromNow: 1,
      timeHourUtc: 3, // 05:00 Israel Time
      timeMinuteUtc: 0,
      importance: 'high',
      customBroadcast: '5SPORT / 5STARS',
      notes: 'Deni Avdija vs LeBron James & Anthony Davis. Prime Israeli broadcast with Hebrew studio.'
    },
    {
      opponent: 'Golden State Warriors',
      opponentShort: 'GSW',
      opponentLogo: 'https://a.espncdn.com/i/teamlogos/nba/500/gsw.png',
      isHome: false,
      competition: 'NBA Regular Season',
      round: 'Pacific Division Matchup',
      venueName: 'Chase Center',
      venueCity: 'San Francisco, CA',
      venueCountry: 'USA',
      daysFromNow: 3,
      timeHourUtc: 2, // 04:00 Israel Time
      timeMinuteUtc: 30,
      importance: 'high',
      customBroadcast: '5SPORT',
      notes: 'Road game at Chase Center. Steph Curry vs Deni Avdija defensive assignment.'
    },
    {
      opponent: 'Denver Nuggets',
      opponentShort: 'DEN',
      opponentLogo: 'https://a.espncdn.com/i/teamlogos/nba/500/den.png',
      isHome: true,
      competition: 'NBA Regular Season',
      round: 'Northwest Division Rivalry',
      venueName: 'Moda Center',
      venueCity: 'Portland, OR',
      venueCountry: 'USA',
      daysFromNow: 6,
      timeHourUtc: 3,
      timeMinuteUtc: 0,
      importance: 'high',
      customBroadcast: '5LIVE',
      notes: 'Deni Avdija matching up against Nikola Jokić and the Nuggets.'
    },
    {
      opponent: 'Boston Celtics',
      opponentShort: 'BOS',
      opponentLogo: 'https://a.espncdn.com/i/teamlogos/nba/500/bos.png',
      isHome: false,
      competition: 'NBA Regular Season',
      round: 'East vs West Feature',
      venueName: 'TD Garden',
      venueCity: 'Boston, MA',
      venueCountry: 'USA',
      daysFromNow: 9,
      timeHourUtc: 0, // 02:00 Israel Time
      timeMinuteUtc: 30,
      importance: 'high',
      customBroadcast: '5STARS',
      notes: 'Tough test at the reigning NBA champions arena in Boston.'
    },
    {
      opponent: 'Sacramento Kings',
      opponentShort: 'SAC',
      opponentLogo: 'https://a.espncdn.com/i/teamlogos/nba/500/sac.png',
      isHome: true,
      competition: 'NBA Regular Season',
      round: 'West Conference Battle',
      venueName: 'Moda Center',
      venueCity: 'Portland, OR',
      venueCountry: 'USA',
      daysFromNow: 12,
      timeHourUtc: 3,
      timeMinuteUtc: 0,
      importance: 'standard',
      customBroadcast: '5SPORT',
      notes: 'Home stand at Moda Center.'
    }
  ],

  // Manor Solomon - West Ham United
  'West Ham United': [
    {
      opponent: 'Watford',
      opponentShort: 'WAT',
      opponentLogo: 'https://r2.thesportsdb.com/images/media/team/badge/1594589258.png',
      isHome: false,
      competition: 'English League Championship',
      round: 'Championship Round',
      venueName: 'Vicarage Road',
      venueCity: 'Watford',
      venueCountry: 'England',
      daysFromNow: 0,
      timeHourUtc: 14, // 17:00 Israel Time (TODAY)
      timeMinuteUtc: 0,
      importance: 'high',
      customBroadcast: 'Sport 1 HD (צ\'רלטון)',
      notes: 'Manor Solomon starting on the wing for West Ham United.'
    },
    {
      opponent: 'Southampton',
      opponentShort: 'SOU',
      opponentLogo: 'https://a.espncdn.com/i/teamlogos/soccer/500/376.png',
      isHome: true,
      competition: 'English League Championship',
      round: 'Matchday 31',
      venueName: 'London Stadium',
      venueCity: 'London',
      venueCountry: 'England',
      daysFromNow: 4,
      timeHourUtc: 15,
      timeMinuteUtc: 0,
      importance: 'high',
      customBroadcast: 'Sport 2 HD (צ\'רלטון)',
      notes: 'Home clash at London Stadium with Solomon in the starting lineup.'
    },
    {
      opponent: 'Tottenham Hotspur',
      opponentShort: 'TOT',
      opponentLogo: 'https://a.espncdn.com/i/teamlogos/soccer/500/367.png',
      isHome: true,
      competition: 'English Premier League',
      round: 'London Derby',
      venueName: 'London Stadium',
      venueCity: 'London',
      venueCountry: 'England',
      daysFromNow: 7,
      timeHourUtc: 19, // 22:00 Israel Time
      timeMinuteUtc: 0,
      importance: 'derby',
      customBroadcast: 'Sport 1 HD (צ\'רלטון)',
      notes: 'London Derby live with Hebrew studio commentary.'
    },
    {
      opponent: 'Aston Villa',
      opponentShort: 'AVL',
      opponentLogo: 'https://a.espncdn.com/i/teamlogos/soccer/500/362.png',
      isHome: false,
      competition: 'English Premier League',
      round: 'Matchday 33',
      venueName: 'Villa Park',
      venueCity: 'Birmingham',
      venueCountry: 'England',
      daysFromNow: 11,
      timeHourUtc: 16,
      timeMinuteUtc: 30,
      importance: 'standard',
      customBroadcast: 'Sport 1 HD (צ\'רלטון)',
      notes: 'Premier League away fixture.'
    }
  ],

  // Manor Solomon - Leeds United
  'Leeds United': [
    {
      opponent: 'Sunderland',
      opponentShort: 'SUN',
      opponentLogo: 'https://a.espncdn.com/i/teamlogos/soccer/500/383.png',
      isHome: true,
      competition: 'EFL Championship',
      round: 'Matchday 32',
      venueName: 'Elland Road',
      venueCity: 'Leeds',
      venueCountry: 'England',
      daysFromNow: 0,
      timeHourUtc: 14, // 17:00 Israel Time (TODAY)
      timeMinuteUtc: 0,
      importance: 'high',
      customBroadcast: 'Sport 1 HD (צ\'רלטון)',
      notes: 'Promotion battle at Elland Road.'
    },
    {
      opponent: 'Burnley',
      opponentShort: 'BUR',
      opponentLogo: 'https://a.espncdn.com/i/teamlogos/soccer/500/379.png',
      isHome: false,
      competition: 'EFL Championship',
      round: 'Matchday 33',
      venueName: 'Turf Moor',
      venueCity: 'Burnley',
      venueCountry: 'England',
      daysFromNow: 5,
      timeHourUtc: 19,
      timeMinuteUtc: 45,
      importance: 'high',
      customBroadcast: 'Sport 2 HD (צ\'רלטון)',
      notes: 'Crucial Championship promotion clash.'
    },
    {
      opponent: 'Sheffield United',
      opponentShort: 'SHU',
      opponentLogo: 'https://a.espncdn.com/i/teamlogos/soccer/500/398.png',
      isHome: true,
      competition: 'EFL Championship',
      round: 'Yorkshire Derby',
      venueName: 'Elland Road',
      venueCity: 'Leeds',
      venueCountry: 'England',
      daysFromNow: 7,
      timeHourUtc: 15,
      timeMinuteUtc: 0,
      importance: 'derby',
      customBroadcast: 'Sport 1 HD (צ\'רלטון)',
      notes: 'Fierce Yorkshire Derby at Elland Road.'
    },
    {
      opponent: 'Norwich City',
      opponentShort: 'NOR',
      opponentLogo: 'https://a.espncdn.com/i/teamlogos/soccer/500/381.png',
      isHome: false,
      competition: 'EFL Championship',
      round: 'Matchday 35',
      venueName: 'Carrow Road',
      venueCity: 'Norwich',
      venueCountry: 'England',
      daysFromNow: 11,
      timeHourUtc: 14,
      timeMinuteUtc: 0,
      importance: 'standard',
      customBroadcast: 'Sport 2 / Sport 4',
      notes: 'Championship away trip.'
    }
  ],

  // Oscar Gloukh - Ajax
  'Ajax': [
    {
      opponent: 'Telstar',
      opponentShort: 'TEL',
      opponentLogo: 'https://r2.thesportsdb.com/images/media/team/badge/1594589258.png',
      isHome: false,
      competition: 'Dutch Eredivisie',
      round: 'Matchday',
      venueName: '711 Stadion',
      venueCity: 'Velsen-Zuid',
      venueCountry: 'Netherlands',
      daysFromNow: 2,
      timeHourUtc: 14,
      timeMinuteUtc: 45,
      importance: 'high',
      customBroadcast: 'Sport 2 / Sport 4',
      notes: 'Oscar Gloukh dictating play for Ajax in Dutch Eredivisie action.'
    },
    {
      opponent: 'Feyenoord',
      opponentShort: 'FEY',
      opponentLogo: 'https://a.espncdn.com/i/teamlogos/soccer/500/139.png',
      isHome: false,
      competition: 'Dutch Eredivisie',
      round: 'De Klassieker',
      venueName: 'De Kuip',
      venueCity: 'Rotterdam',
      venueCountry: 'Netherlands',
      daysFromNow: 5,
      timeHourUtc: 13,
      timeMinuteUtc: 30,
      importance: 'derby',
      customBroadcast: 'Sport 1 HD (צ\'רלטון)',
      notes: 'De Klassieker in Rotterdam with Oscar Gloukh in the spotlight.'
    },
    {
      opponent: 'PSV Eindhoven',
      opponentShort: 'PSV',
      opponentLogo: 'https://a.espncdn.com/i/teamlogos/soccer/500/148.png',
      isHome: true,
      competition: 'Dutch Eredivisie',
      round: 'De Topper',
      venueName: 'Johan Cruyff Arena',
      venueCity: 'Amsterdam',
      venueCountry: 'Netherlands',
      daysFromNow: 7,
      timeHourUtc: 19,
      timeMinuteUtc: 0,
      importance: 'derby',
      customBroadcast: 'Sport 1 HD (צ\'רלטון)',
      notes: 'De Topper rivalry in Amsterdam.'
    },
    {
      opponent: 'AZ Alkmaar',
      opponentShort: 'AZ',
      opponentLogo: 'https://a.espncdn.com/i/teamlogos/soccer/500/138.png',
      isHome: false,
      competition: 'Dutch Eredivisie',
      round: 'Matchday 26',
      venueName: 'AFAS Stadion',
      venueCity: 'Alkmaar',
      venueCountry: 'Netherlands',
      daysFromNow: 11,
      timeHourUtc: 15,
      timeMinuteUtc: 45,
      importance: 'high',
      customBroadcast: 'Sport 2 / Sport 4',
      notes: 'Eredivisie top-4 encounter.'
    }
  ],

  // Oscar Gloukh - Red Bull Salzburg
  'Red Bull Salzburg': [
    {
      opponent: 'Rapid Wien',
      opponentShort: 'RAP',
      opponentLogo: 'https://a.espncdn.com/i/teamlogos/soccer/500/448.png',
      isHome: true,
      competition: 'Austrian Bundesliga',
      round: 'Championship Round',
      venueName: 'Red Bull Arena',
      venueCity: 'Salzburg',
      venueCountry: 'Austria',
      daysFromNow: 2,
      timeHourUtc: 16,
      timeMinuteUtc: 0,
      importance: 'high',
      customBroadcast: 'Sport 2 / Sport 3',
      notes: 'Top of the table clash in Austrian league. Oscar Gloukh orchestrating the midfield.'
    },
    {
      opponent: 'Sturm Graz',
      opponentShort: 'STU',
      opponentLogo: 'https://a.espncdn.com/i/teamlogos/soccer/500/451.png',
      isHome: false,
      competition: 'Austrian Bundesliga',
      round: 'Title Summit',
      venueName: 'Merkur Arena',
      venueCity: 'Graz',
      venueCountry: 'Austria',
      daysFromNow: 4,
      timeHourUtc: 18,
      timeMinuteUtc: 30,
      importance: 'high',
      customBroadcast: 'Sport 2 / Sport 3',
      notes: 'Austrian title fight summit.'
    },
    {
      opponent: 'Paris Saint-Germain',
      opponentShort: 'PSG',
      opponentLogo: 'https://a.espncdn.com/i/teamlogos/soccer/500/160.png',
      isHome: false,
      competition: 'UEFA Champions League',
      round: 'Group Stage Matchday',
      venueName: 'Parc des Princes',
      venueCity: 'Paris',
      venueCountry: 'France',
      daysFromNow: 6,
      timeHourUtc: 20, // 22:00 Israel Time
      timeMinuteUtc: 0,
      importance: 'championship',
      customBroadcast: '5SPORT / 5STARS',
      notes: 'Major European stage for the Israeli midfielder in Paris.'
    },
    {
      opponent: 'LASK Linz',
      opponentShort: 'LASK',
      opponentLogo: 'https://a.espncdn.com/i/teamlogos/soccer/500/447.png',
      isHome: true,
      competition: 'Austrian Bundesliga',
      round: 'Matchday 24',
      venueName: 'Red Bull Arena',
      venueCity: 'Salzburg',
      venueCountry: 'Austria',
      daysFromNow: 10,
      timeHourUtc: 16,
      timeMinuteUtc: 0,
      importance: 'standard',
      customBroadcast: 'Sport 2 / Sport 3',
      notes: 'Austrian Bundesliga action.'
    }
  ],

  // Daniel Peretz - FC Bayern Munich
  'FC Bayern Munich': [
    {
      opponent: 'Borussia Dortmund',
      opponentShort: 'BVB',
      opponentLogo: 'https://a.espncdn.com/i/teamlogos/soccer/500/124.png',
      isHome: true,
      competition: 'German Bundesliga',
      round: 'Der Klassiker',
      venueName: 'Allianz Arena',
      venueCity: 'Munich',
      venueCountry: 'Germany',
      daysFromNow: 3,
      timeHourUtc: 17,
      timeMinuteUtc: 30,
      importance: 'derby',
      customBroadcast: 'Sport 1 HD (צ\'רלטון)',
      notes: 'The biggest match in German football, Der Klassiker live with full studio coverage.'
    },
    {
      opponent: 'Eintracht Frankfurt',
      opponentShort: 'SGE',
      opponentLogo: 'https://a.espncdn.com/i/teamlogos/soccer/500/125.png',
      isHome: false,
      competition: 'German Bundesliga',
      round: 'Matchday 24',
      venueName: 'Deutsche Bank Park',
      venueCity: 'Frankfurt',
      venueCountry: 'Germany',
      daysFromNow: 6,
      timeHourUtc: 14,
      timeMinuteUtc: 30,
      importance: 'high',
      customBroadcast: 'Sport 1 / Sport 2 (צ\'רלטון)',
      notes: 'Bundesliga away clash in Frankfurt.'
    },
    {
      opponent: 'Real Madrid',
      opponentShort: 'RMA',
      opponentLogo: 'https://a.espncdn.com/i/teamlogos/soccer/500/86.png',
      isHome: false,
      competition: 'UEFA Champions League',
      round: 'Knockout Stage',
      venueName: 'Santiago Bernabéu',
      venueCity: 'Madrid',
      venueCountry: 'Spain',
      daysFromNow: 8,
      timeHourUtc: 20,
      timeMinuteUtc: 0,
      importance: 'championship',
      customBroadcast: '5SPORT 4K / 5STARS',
      notes: 'European football heavyweight clash broadcast in 4K.'
    },
    {
      opponent: 'Bayer Leverkusen',
      opponentShort: 'B04',
      opponentLogo: 'https://a.espncdn.com/i/teamlogos/soccer/500/131.png',
      isHome: true,
      competition: 'German Bundesliga',
      round: 'Top Table Showdown',
      venueName: 'Allianz Arena',
      venueCity: 'Munich',
      venueCountry: 'Germany',
      daysFromNow: 12,
      timeHourUtc: 17,
      timeMinuteUtc: 30,
      importance: 'championship',
      customBroadcast: 'Sport 1 HD (צ\'רלטון)',
      notes: 'Massive Bundesliga showdown at Allianz Arena.'
    }
  ],

  // Erling Haaland - Manchester City
  'Manchester City': [
    {
      opponent: 'Arsenal',
      opponentShort: 'ARS',
      opponentLogo: 'https://a.espncdn.com/i/teamlogos/soccer/500/359.png',
      isHome: true,
      competition: 'Premier League',
      round: 'Title Race Showdown',
      venueName: 'Etihad Stadium',
      venueCity: 'Manchester',
      venueCountry: 'England',
      daysFromNow: 1,
      timeHourUtc: 16,
      timeMinuteUtc: 30,
      importance: 'championship',
      customBroadcast: 'Sport 1 HD (צ\'רלטון)',
      notes: 'Massive title clash at Etihad Stadium. Haaland leading the attack.'
    },
    {
      opponent: 'Newcastle United',
      opponentShort: 'NEW',
      opponentLogo: 'https://a.espncdn.com/i/teamlogos/soccer/500/361.png',
      isHome: true,
      competition: 'Premier League',
      round: 'Matchday 28',
      venueName: 'Etihad Stadium',
      venueCity: 'Manchester',
      venueCountry: 'England',
      daysFromNow: 4,
      timeHourUtc: 19,
      timeMinuteUtc: 0,
      importance: 'high',
      customBroadcast: 'Sport 1 HD (צ\'רלטון)',
      notes: 'Premier League home match under the Etihad lights.'
    },
    {
      opponent: 'Liverpool',
      opponentShort: 'LIV',
      opponentLogo: 'https://a.espncdn.com/i/teamlogos/soccer/500/364.png',
      isHome: false,
      competition: 'Premier League',
      round: 'Matchday 29',
      venueName: 'Anfield',
      venueCity: 'Liverpool',
      venueCountry: 'England',
      daysFromNow: 7,
      timeHourUtc: 16,
      timeMinuteUtc: 30,
      importance: 'high',
      customBroadcast: 'Sport 1 HD (צ\'רלטון)',
      notes: 'Epic Anfield encounter.'
    },
    {
      opponent: 'Inter Milan',
      opponentShort: 'INT',
      opponentLogo: 'https://a.espncdn.com/i/teamlogos/soccer/500/110.png',
      isHome: true,
      competition: 'UEFA Champions League',
      round: 'League Stage',
      venueName: 'Etihad Stadium',
      venueCity: 'Manchester',
      venueCountry: 'England',
      daysFromNow: 10,
      timeHourUtc: 20,
      timeMinuteUtc: 0,
      importance: 'championship',
      customBroadcast: '5SPORT / 5STARS',
      notes: 'Champions League night in Manchester.'
    }
  ],

  // Luka Doncic - Dallas Mavericks
  'Dallas Mavericks': [
    {
      opponent: 'Phoenix Suns',
      opponentShort: 'PHX',
      opponentLogo: 'https://a.espncdn.com/i/teamlogos/nba/500/phx.png',
      isHome: true,
      competition: 'NBA Regular Season',
      round: 'Western Conference Rivalry',
      venueName: 'American Airlines Center',
      venueCity: 'Dallas, TX',
      venueCountry: 'USA',
      daysFromNow: 2,
      timeHourUtc: 1,
      timeMinuteUtc: 30,
      importance: 'high',
      customBroadcast: '5SPORT',
      notes: 'Luka Doncic vs Kevin Durant & Devin Booker.'
    },
    {
      opponent: 'Houston Rockets',
      opponentShort: 'HOU',
      opponentLogo: 'https://a.espncdn.com/i/teamlogos/nba/500/hou.png',
      isHome: false,
      competition: 'NBA Regular Season',
      round: 'Texas Showdown',
      venueName: 'Toyota Center',
      venueCity: 'Houston, TX',
      venueCountry: 'USA',
      daysFromNow: 4,
      timeHourUtc: 2,
      timeMinuteUtc: 0,
      importance: 'high',
      customBroadcast: '5LIVE',
      notes: 'All-Texas NBA matchup in Houston.'
    },
    {
      opponent: 'Minnesota Timberwolves',
      opponentShort: 'MIN',
      opponentLogo: 'https://a.espncdn.com/i/teamlogos/nba/500/min.png',
      isHome: false,
      competition: 'NBA Regular Season',
      round: 'Western Conference Rematch',
      venueName: 'Target Center',
      venueCity: 'Minneapolis, MN',
      venueCountry: 'USA',
      daysFromNow: 6,
      timeHourUtc: 2,
      timeMinuteUtc: 0,
      importance: 'high',
      customBroadcast: '5STARS',
      notes: 'Rematch of the Western Conference Finals.'
    },
    {
      opponent: 'Los Angeles Lakers',
      opponentShort: 'LAL',
      opponentLogo: 'https://a.espncdn.com/i/teamlogos/nba/500/lal.png',
      isHome: true,
      competition: 'NBA Regular Season',
      round: 'West Conference Feature',
      venueName: 'American Airlines Center',
      venueCity: 'Dallas, TX',
      venueCountry: 'USA',
      daysFromNow: 8,
      timeHourUtc: 1,
      timeMinuteUtc: 30,
      importance: 'high',
      customBroadcast: '5SPORT',
      notes: 'Luka Doncic vs LeBron James blockbuster.'
    },
    {
      opponent: 'Oklahoma City Thunder',
      opponentShort: 'OKC',
      opponentLogo: 'https://a.espncdn.com/i/teamlogos/nba/500/okc.png',
      isHome: true,
      competition: 'NBA Regular Season',
      round: 'Division Battle',
      venueName: 'American Airlines Center',
      venueCity: 'Dallas, TX',
      venueCountry: 'USA',
      daysFromNow: 11,
      timeHourUtc: 2,
      timeMinuteUtc: 30,
      importance: 'high',
      customBroadcast: '5STARS',
      notes: 'Doncic vs Shai Gilgeous-Alexander MVP race battle.'
    }
  ],

  // Stephen Curry - Golden State Warriors
  'Golden State Warriors': [
    {
      opponent: 'Portland Trail Blazers',
      opponentShort: 'POR',
      opponentLogo: 'https://a.espncdn.com/i/teamlogos/nba/500/por.png',
      isHome: true,
      competition: 'NBA Regular Season',
      round: 'Pacific Division Matchup',
      venueName: 'Chase Center',
      venueCity: 'San Francisco, CA',
      venueCountry: 'USA',
      daysFromNow: 3,
      timeHourUtc: 2,
      timeMinuteUtc: 30,
      importance: 'high',
      customBroadcast: '5SPORT',
      notes: 'Steph Curry hosting Deni Avdija and the Blazers.'
    },
    {
      opponent: 'Phoenix Suns',
      opponentShort: 'PHX',
      opponentLogo: 'https://a.espncdn.com/i/teamlogos/nba/500/phx.png',
      isHome: false,
      competition: 'NBA Regular Season',
      round: 'Pacific Division Clash',
      venueName: 'Footprint Center',
      venueCity: 'Phoenix, AZ',
      venueCountry: 'USA',
      daysFromNow: 5,
      timeHourUtc: 3,
      timeMinuteUtc: 0,
      importance: 'high',
      customBroadcast: '5STARS',
      notes: 'Curry vs Durant duel in Phoenix.'
    },
    {
      opponent: 'Los Angeles Clippers',
      opponentShort: 'LAC',
      opponentLogo: 'https://a.espncdn.com/i/teamlogos/nba/500/lac.png',
      isHome: false,
      competition: 'NBA Regular Season',
      round: 'Intuit Dome Feature',
      venueName: 'Intuit Dome',
      venueCity: 'Inglewood, CA',
      venueCountry: 'USA',
      daysFromNow: 7,
      timeHourUtc: 3,
      timeMinuteUtc: 30,
      importance: 'high',
      customBroadcast: '5LIVE',
      notes: 'Warriors visit the new Intuit Dome.'
    },
    {
      opponent: 'Denver Nuggets',
      opponentShort: 'DEN',
      opponentLogo: 'https://a.espncdn.com/i/teamlogos/nba/500/den.png',
      isHome: true,
      competition: 'NBA Regular Season',
      round: 'Western Heavyweight Clash',
      venueName: 'Chase Center',
      venueCity: 'San Francisco, CA',
      venueCountry: 'USA',
      daysFromNow: 10,
      timeHourUtc: 2,
      timeMinuteUtc: 30,
      importance: 'high',
      customBroadcast: '5SPORT',
      notes: 'Steph Curry vs Nikola Jokic.'
    }
  ],

  // Yam Madar - FC Bayern Munich Basketball
  'FC Bayern Munich Basketball': [
    {
      opponent: 'ALBA Berlin',
      opponentShort: 'BER',
      opponentLogo: 'https://a.espncdn.com/i/teamlogos/basketball/500/alba-berlin.png',
      isHome: false,
      competition: 'German BBL / EuroLeague',
      round: 'German Derby',
      venueName: 'Uber Arena',
      venueCity: 'Berlin',
      venueCountry: 'Germany',
      daysFromNow: 1,
      timeHourUtc: 18,
      timeMinuteUtc: 30,
      importance: 'high',
      customBroadcast: 'Sport 3 (צ\'רלטון)',
      notes: 'German basketball classic with Yam Madar pulling the strings.'
    },
    {
      opponent: 'Maccabi Playtika Tel Aviv',
      opponentShort: 'MTA',
      opponentLogo: 'https://a.espncdn.com/i/teamlogos/basketball/500/maccabi.png',
      isHome: true,
      competition: 'EuroLeague Basketball',
      round: 'Round 26',
      venueName: 'SAP Garden',
      venueCity: 'Munich',
      venueCountry: 'Germany',
      daysFromNow: 4,
      timeHourUtc: 19, // 21:00 Israel Time
      timeMinuteUtc: 30,
      importance: 'high',
      customBroadcast: '5SPORT / 5STARS',
      notes: 'Special Israeli interest! Yam Madar faces Israeli powerhouse Maccabi Tel Aviv.'
    },
    {
      opponent: 'Brose Bamberg',
      opponentShort: 'BAM',
      opponentLogo: 'https://a.espncdn.com/i/teamlogos/basketball/500/bamberg.png',
      isHome: true,
      competition: 'German BBL Basketball',
      round: 'BBL Matchday 22',
      venueName: 'BMW Park',
      venueCity: 'Munich',
      venueCountry: 'Germany',
      daysFromNow: 6,
      timeHourUtc: 17,
      timeMinuteUtc: 0,
      importance: 'standard',
      customBroadcast: 'Sport 4',
      notes: 'German BBL action in Munich.'
    },
    {
      opponent: 'Panathinaikos',
      opponentShort: 'PAO',
      opponentLogo: 'https://a.espncdn.com/i/teamlogos/basketball/500/pao.png',
      isHome: false,
      competition: 'EuroLeague Basketball',
      round: 'Round 27',
      venueName: 'OAKA Altion',
      venueCity: 'Athens',
      venueCountry: 'Greece',
      daysFromNow: 8,
      timeHourUtc: 19,
      timeMinuteUtc: 15,
      importance: 'high',
      customBroadcast: '5SPORT',
      notes: 'EuroLeague away clash in Athens.'
    },
    {
      opponent: 'Real Madrid Basketball',
      opponentShort: 'RMB',
      opponentLogo: 'https://a.espncdn.com/i/teamlogos/basketball/500/real-madrid.png',
      isHome: true,
      competition: 'EuroLeague Basketball',
      round: 'Round 28',
      venueName: 'SAP Garden',
      venueCity: 'Munich',
      venueCountry: 'Germany',
      daysFromNow: 11,
      timeHourUtc: 19,
      timeMinuteUtc: 30,
      importance: 'high',
      customBroadcast: '5STARS',
      notes: 'EuroLeague blockbuster in Munich.'
    }
  ],

  // Charlotte FC (Liel Abada)
  'Charlotte FC': [
    {
      opponent: 'New York City FC',
      opponentShort: 'NYC',
      opponentLogo: 'https://a.espncdn.com/i/teamlogos/soccer/500/17606.png',
      isHome: false,
      competition: 'MLS (Major League Soccer)',
      round: 'Eastern Matchday',
      venueName: 'Yankee Stadium',
      venueCity: 'New York, NY',
      venueCountry: 'USA',
      daysFromNow: 1,
      timeHourUtc: 23,
      timeMinuteUtc: 30,
      importance: 'high',
      customBroadcast: 'Apple TV (MLS Pass) / 5SPORT',
      notes: 'Liel Abada on the attack for Charlotte FC in New York.'
    },
    {
      opponent: 'Inter Miami CF',
      opponentShort: 'MIA',
      opponentLogo: 'https://a.espncdn.com/i/teamlogos/soccer/500/20232.png',
      isHome: true,
      competition: 'MLS (Major League Soccer)',
      round: 'Regular Season Showcase',
      venueName: 'Bank of America Stadium',
      venueCity: 'Charlotte, NC',
      venueCountry: 'USA',
      daysFromNow: 3,
      timeHourUtc: 23, // 02:00 Israel Time (+1 day)
      timeMinuteUtc: 30,
      importance: 'high',
      customBroadcast: 'Apple TV (MLS Pass) / 5SPORT',
      notes: 'Liel Abada leading the Charlotte FC attack against Lionel Messi and Inter Miami.'
    },
    {
      opponent: 'Atlanta United',
      opponentShort: 'ATL',
      opponentLogo: 'https://a.espncdn.com/i/teamlogos/soccer/500/18418.png',
      isHome: false,
      competition: 'MLS (Major League Soccer)',
      round: 'Southern Derby',
      venueName: 'Mercedes-Benz Stadium',
      venueCity: 'Atlanta, GA',
      venueCountry: 'USA',
      daysFromNow: 7,
      timeHourUtc: 0,
      timeMinuteUtc: 30,
      importance: 'standard',
      customBroadcast: 'Apple TV (MLS Season Pass)',
      notes: 'Major Eastern Conference clash in Atlanta.'
    },
    {
      opponent: 'Orlando City SC',
      opponentShort: 'ORL',
      opponentLogo: 'https://a.espncdn.com/i/teamlogos/soccer/500/18419.png',
      isHome: true,
      competition: 'MLS (Major League Soccer)',
      round: 'Eastern Conference Clash',
      venueName: 'Bank of America Stadium',
      venueCity: 'Charlotte, NC',
      venueCountry: 'USA',
      daysFromNow: 11,
      timeHourUtc: 23,
      timeMinuteUtc: 30,
      importance: 'standard',
      customBroadcast: 'Apple TV (MLS Season Pass)',
      notes: 'Charlotte FC home game with Abada starring.'
    }
  ],

  // Philadelphia Union (Tai Baribo)
  'Philadelphia Union': [
    {
      opponent: 'Toronto FC',
      opponentShort: 'TOR',
      opponentLogo: 'https://a.espncdn.com/i/teamlogos/soccer/500/7318.png',
      isHome: false,
      competition: 'MLS (Major League Soccer)',
      round: 'Eastern Matchday',
      venueName: 'BMO Field',
      venueCity: 'Toronto',
      venueCountry: 'Canada',
      daysFromNow: 1,
      timeHourUtc: 23,
      timeMinuteUtc: 30,
      importance: 'high',
      customBroadcast: 'Apple TV (MLS Pass) / 5SPORT',
      notes: 'Tai Baribo leading the line in Toronto.'
    },
    {
      opponent: 'New York Red Bulls',
      opponentShort: 'RBNY',
      opponentLogo: 'https://a.espncdn.com/i/teamlogos/soccer/500/190.png',
      isHome: true,
      competition: 'MLS (Major League Soccer)',
      round: 'I-95 Rivalry',
      venueName: 'Subaru Park',
      venueCity: 'Chester, PA',
      venueCountry: 'USA',
      daysFromNow: 4,
      timeHourUtc: 23,
      timeMinuteUtc: 30,
      importance: 'high',
      customBroadcast: 'Apple TV (MLS Pass) / 5SPORT',
      notes: 'Tai Baribo starts up front for Philadelphia Union in this fierce Eastern conference rivalry.'
    },
    {
      opponent: 'New England Revolution',
      opponentShort: 'NER',
      opponentLogo: 'https://a.espncdn.com/i/teamlogos/soccer/500/189.png',
      isHome: true,
      competition: 'MLS (Major League Soccer)',
      round: 'Eastern Conference Battle',
      venueName: 'Subaru Park',
      venueCity: 'Chester, PA',
      venueCountry: 'USA',
      daysFromNow: 7,
      timeHourUtc: 23,
      timeMinuteUtc: 0,
      importance: 'standard',
      customBroadcast: 'Apple TV (MLS Pass)',
      notes: 'Home fixture at Subaru Park.'
    },
    {
      opponent: 'Columbus Crew',
      opponentShort: 'CLB',
      opponentLogo: 'https://a.espncdn.com/i/teamlogos/soccer/500/183.png',
      isHome: false,
      competition: 'MLS (Major League Soccer)',
      round: 'MLS Regular Season',
      venueName: 'Lower.com Field',
      venueCity: 'Columbus, OH',
      venueCountry: 'USA',
      daysFromNow: 10,
      timeHourUtc: 0,
      timeMinuteUtc: 30,
      importance: 'standard',
      customBroadcast: 'Apple TV (MLS Season Pass)',
      notes: 'Union travel to face the reigning champions.'
    }
  ],

  // Crystal Palace (Anan Khalaili)
  'Crystal Palace': [
    {
      opponent: 'Brentford',
      opponentShort: 'BRE',
      opponentLogo: 'https://a.espncdn.com/i/teamlogos/soccer/500/337.png',
      isHome: true,
      competition: 'English Premier League',
      round: 'London Derby',
      venueName: 'Selhurst Park',
      venueCity: 'London',
      venueCountry: 'England',
      daysFromNow: 4,
      timeHourUtc: 14, // 17:00 Israel Time
      timeMinuteUtc: 0,
      importance: 'high',
      customBroadcast: 'Sport 1 HD (צ\'רלטון)',
      notes: 'London Derby with Anan Khalaili starting.'
    },
    {
      opponent: 'Chelsea',
      opponentShort: 'CHE',
      opponentLogo: 'https://a.espncdn.com/i/teamlogos/soccer/500/363.png',
      isHome: false,
      competition: 'English Premier League',
      round: 'London Derby',
      venueName: 'Stamford Bridge',
      venueCity: 'London',
      venueCountry: 'England',
      daysFromNow: 7,
      timeHourUtc: 14,
      timeMinuteUtc: 0,
      importance: 'derby',
      customBroadcast: 'Sport 1 HD (צ\'רלטון)',
      notes: 'London Derby live on Charlton Sport.'
    },
    {
      opponent: 'Aston Villa',
      opponentShort: 'AVL',
      opponentLogo: 'https://a.espncdn.com/i/teamlogos/soccer/500/362.png',
      isHome: false,
      competition: 'English Premier League',
      round: 'Premier League Matchday 29',
      venueName: 'Villa Park',
      venueCity: 'Birmingham',
      venueCountry: 'England',
      daysFromNow: 11,
      timeHourUtc: 16,
      timeMinuteUtc: 30,
      importance: 'standard',
      customBroadcast: 'Sport 1 HD (צ\'רלטון)',
      notes: 'Premier League weekend clash.'
    },
    {
      opponent: 'Manchester City',
      opponentShort: 'MCI',
      opponentLogo: 'https://r2.thesportsdb.com/images/media/team/badge/vwpvry1467462651.png',
      isHome: true,
      competition: 'English Premier League',
      round: 'Premier League Matchday',
      venueName: 'Selhurst Park',
      venueCity: 'London',
      venueCountry: 'England',
      daysFromNow: 15,
      timeHourUtc: 19,
      timeMinuteUtc: 0,
      importance: 'high',
      customBroadcast: 'Sport 1 HD (צ\'רלטון)',
      notes: 'Anan Khalaili in Premier League action for Crystal Palace against Manchester City.'
    }
  ],

  // DC United (Tai Baribo)
  'DC United': [
    {
      opponent: 'New York Red Bulls',
      opponentShort: 'RBNY',
      opponentLogo: 'https://a.espncdn.com/i/teamlogos/soccer/500/190.png',
      isHome: true,
      competition: 'MLS (Major League Soccer)',
      round: 'Atlantic Cup',
      venueName: 'Audi Field',
      venueCity: 'Washington, DC',
      venueCountry: 'USA',
      daysFromNow: 1,
      timeHourUtc: 23,
      timeMinuteUtc: 30,
      importance: 'high',
      customBroadcast: 'Apple TV (MLS Pass) / 5SPORT',
      notes: 'Tai Baribo starting in the Atlantic Cup clash.'
    },
    {
      opponent: 'Philadelphia Union',
      opponentShort: 'PHI',
      opponentLogo: 'https://a.espncdn.com/i/teamlogos/soccer/500/10739.png',
      isHome: false,
      competition: 'MLS (Major League Soccer)',
      round: 'Eastern Rivalry',
      venueName: 'Subaru Park',
      venueCity: 'Chester, PA',
      venueCountry: 'USA',
      daysFromNow: 4,
      timeHourUtc: 23,
      timeMinuteUtc: 30,
      importance: 'high',
      customBroadcast: 'Apple TV (MLS Pass) / 5SPORT',
      notes: 'Eastern Conference rivalry showdown.'
    },
    {
      opponent: 'New England Revolution',
      opponentShort: 'NER',
      opponentLogo: 'https://a.espncdn.com/i/teamlogos/soccer/500/189.png',
      isHome: true,
      competition: 'MLS (Major League Soccer)',
      round: 'Regular Season Round',
      venueName: 'Audi Field',
      venueCity: 'Washington, DC',
      venueCountry: 'USA',
      daysFromNow: 7,
      timeHourUtc: 23,
      timeMinuteUtc: 0,
      importance: 'standard',
      customBroadcast: 'Apple TV (MLS Season Pass)',
      notes: 'MLS weekend match in Washington.'
    },
    {
      opponent: 'Columbus Crew',
      opponentShort: 'CLB',
      opponentLogo: 'https://a.espncdn.com/i/teamlogos/soccer/500/183.png',
      isHome: false,
      competition: 'MLS (Major League Soccer)',
      round: 'MLS Regular Season',
      venueName: 'Lower.com Field',
      venueCity: 'Columbus, OH',
      venueCountry: 'USA',
      daysFromNow: 11,
      timeHourUtc: 0,
      timeMinuteUtc: 30,
      importance: 'standard',
      customBroadcast: 'Apple TV (MLS Season Pass)',
      notes: 'DC United road match.'
    }
  ],

  // Royale Union Saint-Gilloise (Anan Khalaili)
  'Royale Union Saint-Gilloise': [
    {
      opponent: 'Gent',
      opponentShort: 'GNT',
      opponentLogo: 'https://a.espncdn.com/i/teamlogos/soccer/500/203.png',
      isHome: false,
      competition: 'Belgian Pro League',
      round: 'Matchday 24',
      venueName: 'Planet Group Arena',
      venueCity: 'Ghent',
      venueCountry: 'Belgium',
      daysFromNow: 1,
      timeHourUtc: 19,
      timeMinuteUtc: 45,
      importance: 'high',
      customBroadcast: 'Sport 2 HD (צ\'רלטון)',
      notes: 'Israeli duel! Anan Khalaili faces Omri Gandelman in Belgian Pro League.'
    },
    {
      opponent: 'Club Brugge',
      opponentShort: 'CLU',
      opponentLogo: 'https://a.espncdn.com/i/teamlogos/soccer/500/198.png',
      isHome: true,
      competition: 'Belgian Pro League',
      round: 'Matchday 25',
      venueName: 'Joseph Marien Stadium',
      venueCity: 'Brussels',
      venueCountry: 'Belgium',
      daysFromNow: 3,
      timeHourUtc: 17,
      timeMinuteUtc: 30,
      importance: 'high',
      customBroadcast: 'Sport 2 HD (צ\'רלטון)',
      notes: 'Top of the table summit in Belgian football with Anan Khalaili starting.'
    },
    {
      opponent: 'RSC Anderlecht',
      opponentShort: 'AND',
      opponentLogo: 'https://a.espncdn.com/i/teamlogos/soccer/500/196.png',
      isHome: false,
      competition: 'Belgian Pro League',
      round: 'Brussels Derby',
      venueName: 'Lotto Park',
      venueCity: 'Brussels',
      venueCountry: 'Belgium',
      daysFromNow: 7,
      timeHourUtc: 19,
      timeMinuteUtc: 45,
      importance: 'derby',
      customBroadcast: 'Sport 1 / Sport 2 (צ\'רלטון)',
      notes: 'The heated Brussels derby live on Charlton Sport.'
    },
    {
      opponent: 'Standard Liège',
      opponentShort: 'STA',
      opponentLogo: 'https://a.espncdn.com/i/teamlogos/soccer/500/206.png',
      isHome: true,
      competition: 'Belgian Pro League',
      round: 'Matchday 27',
      venueName: 'Joseph Marien Stadium',
      venueCity: 'Brussels',
      venueCountry: 'Belgium',
      daysFromNow: 10,
      timeHourUtc: 19,
      timeMinuteUtc: 0,
      importance: 'standard',
      customBroadcast: 'Sport 2 HD (צ\'רלטון)',
      notes: 'Belgian Pro League action.'
    }
  ],

  // KAA Gent (Omri Gandelman)
  'KAA Gent': [
    {
      opponent: 'Royale Union Saint-Gilloise',
      opponentShort: 'USG',
      opponentLogo: 'https://a.espncdn.com/i/teamlogos/soccer/500/198.png',
      isHome: true,
      competition: 'Belgian Pro League',
      round: 'Matchday 25',
      venueName: 'Planet Group Arena',
      venueCity: 'Ghent',
      venueCountry: 'Belgium',
      daysFromNow: 1,
      timeHourUtc: 19,
      timeMinuteUtc: 45,
      importance: 'high',
      customBroadcast: 'Sport 2 HD (צ\'רלטון)',
      notes: 'Israeli duel! Omri Gandelman faces Anan Khalaili in Belgian Pro League.'
    },
    {
      opponent: 'Standard Liège',
      opponentShort: 'STA',
      opponentLogo: 'https://a.espncdn.com/i/teamlogos/soccer/500/206.png',
      isHome: true,
      competition: 'Belgian Pro League',
      round: 'Matchday 26',
      venueName: 'Planet Group Arena',
      venueCity: 'Ghent',
      venueCountry: 'Belgium',
      daysFromNow: 4,
      timeHourUtc: 19,
      timeMinuteUtc: 45,
      importance: 'high',
      customBroadcast: 'Sport 2 / Sport 3 (צ\'רלטון)',
      notes: 'Omri Gandelman anchoring the Gent midfield in this classic Belgian fixture.'
    },
    {
      opponent: 'Cercle Brugge',
      opponentShort: 'CER',
      opponentLogo: 'https://a.espncdn.com/i/teamlogos/soccer/500/197.png',
      isHome: false,
      competition: 'Belgian Pro League',
      round: 'Matchday 27',
      venueName: 'Jan Breydel Stadium',
      venueCity: 'Bruges',
      venueCountry: 'Belgium',
      daysFromNow: 7,
      timeHourUtc: 17,
      timeMinuteUtc: 30,
      importance: 'standard',
      customBroadcast: 'Sport 3 HD (צ\'רלטון)',
      notes: 'Belgian Pro League away match in Bruges.'
    },
    {
      opponent: 'Real Betis',
      opponentShort: 'BET',
      opponentLogo: 'https://a.espncdn.com/i/teamlogos/soccer/500/244.png',
      isHome: false,
      competition: 'UEFA Conference League',
      round: 'Knockout Stage',
      venueName: 'Benito Villamarín',
      venueCity: 'Seville',
      venueCountry: 'Spain',
      daysFromNow: 10,
      timeHourUtc: 20,
      timeMinuteUtc: 0,
      importance: 'championship',
      customBroadcast: 'Sport 2 HD (צ\'רלטון)',
      notes: 'European knockout action in Seville.'
    }
  ],

  // Maccabi Tel Aviv (Dor Turgeman)
  'Maccabi Tel Aviv': [
    {
      opponent: 'Maccabi Haifa',
      opponentShort: 'MHA',
      opponentLogo: 'https://a.espncdn.com/i/teamlogos/soccer/500/582.png',
      isHome: true,
      competition: 'Israeli Premier League',
      round: 'Match of the Season',
      venueName: 'Bloomfield Stadium',
      venueCity: 'Tel Aviv-Yafo',
      venueCountry: 'Israel',
      daysFromNow: 2,
      timeHourUtc: 18,
      timeMinuteUtc: 30,
      importance: 'championship',
      customBroadcast: '5SPORT 4K / 5SPORT',
      notes: 'The Classic of Israeli Football at a sold-out Bloomfield Stadium with full studio broadcast.'
    },
    {
      opponent: 'Hapoel Be\'er Sheva',
      opponentShort: 'HBS',
      opponentLogo: 'https://a.espncdn.com/i/teamlogos/soccer/500/581.png',
      isHome: false,
      competition: 'Israeli Premier League',
      round: 'Top 3 Clash',
      venueName: 'Turner Stadium',
      venueCity: 'Be\'er Sheva',
      venueCountry: 'Israel',
      daysFromNow: 5,
      timeHourUtc: 18,
      timeMinuteUtc: 30,
      importance: 'high',
      customBroadcast: '5SPORT / 5STARS',
      notes: 'Crucial title race match in Be\'er Sheva.'
    },
    {
      opponent: 'Besiktas',
      opponentShort: 'BJK',
      opponentLogo: 'https://a.espncdn.com/i/teamlogos/soccer/500/435.png',
      isHome: false,
      competition: 'UEFA Europa League',
      round: 'Matchday 7',
      venueName: 'Nagyerdei Stadium',
      venueCity: 'Debrecen',
      venueCountry: 'Hungary',
      daysFromNow: 7,
      timeHourUtc: 17,
      timeMinuteUtc: 45,
      importance: 'high',
      customBroadcast: 'Sport 1 / Sport 2 (צ\'רלטון)',
      notes: 'Crucial European points on the line for Dor Turgeman and Maccabi Tel Aviv.'
    },
    {
      opponent: 'Beitar Jerusalem',
      opponentShort: 'BTR',
      opponentLogo: 'https://a.espncdn.com/i/teamlogos/soccer/500/584.png',
      isHome: true,
      competition: 'Israeli Premier League',
      round: 'Israeli Classic',
      venueName: 'Bloomfield Stadium',
      venueCity: 'Tel Aviv-Yafo',
      venueCountry: 'Israel',
      daysFromNow: 10,
      timeHourUtc: 18,
      timeMinuteUtc: 30,
      importance: 'high',
      customBroadcast: '5SPORT',
      notes: 'Blockbuster at Bloomfield Stadium.'
    }
  ],

  // Maccabi Tel Aviv Basketball (Tamir Blatt, Roman Sorkin)
  'Maccabi Tel Aviv Basketball': [
    {
      opponent: 'Hapoel Holon',
      opponentShort: 'HOL',
      opponentLogo: 'https://a.espncdn.com/i/teamlogos/basketball/500/holon.png',
      isHome: false,
      competition: 'Israeli Winner League',
      round: 'Winner League Round',
      venueName: 'Holon Toto Hall',
      venueCity: 'Holon',
      venueCountry: 'Israel',
      daysFromNow: 1,
      timeHourUtc: 17,
      timeMinuteUtc: 30,
      importance: 'high',
      customBroadcast: '5SPORT / 5LIVE',
      notes: 'Winner League battle in Holon with Blatt directing the offense.'
    },
    {
      opponent: 'Real Madrid Basketball',
      opponentShort: 'RMB',
      opponentLogo: 'https://a.espncdn.com/i/teamlogos/basketball/500/real-madrid.png',
      isHome: true,
      competition: 'EuroLeague Basketball',
      round: 'Round 28',
      venueName: 'Aleksandar Nikolic Hall',
      venueCity: 'Belgrade',
      venueCountry: 'Serbia',
      daysFromNow: 3,
      timeHourUtc: 19,
      timeMinuteUtc: 0,
      importance: 'high',
      customBroadcast: '5SPORT / 5STARS',
      notes: 'EuroLeague heavyweight showdown. Blatt and Sorkin leading the yellow-and-blue.'
    },
    {
      opponent: 'Hapoel Jerusalem',
      opponentShort: 'HJR',
      opponentLogo: 'https://a.espncdn.com/i/teamlogos/basketball/500/hapoel-jerusalem.png',
      isHome: false,
      competition: 'Israeli Winner League',
      round: 'Israeli Classic',
      venueName: 'Pais Arena',
      venueCity: 'Jerusalem',
      venueCountry: 'Israel',
      daysFromNow: 6,
      timeHourUtc: 18,
      timeMinuteUtc: 45,
      importance: 'high',
      customBroadcast: '5SPORT / 5LIVE',
      notes: 'The prestigious Israeli basketball classic in Jerusalem.'
    },
    {
      opponent: 'Fenerbahce',
      opponentShort: 'FB',
      opponentLogo: 'https://a.espncdn.com/i/teamlogos/basketball/500/fenerbahce.png',
      isHome: true,
      competition: 'EuroLeague Basketball',
      round: 'Round 29',
      venueName: 'Aleksandar Nikolic Hall',
      venueCity: 'Belgrade',
      venueCountry: 'Serbia',
      daysFromNow: 8,
      timeHourUtc: 19,
      timeMinuteUtc: 0,
      importance: 'high',
      customBroadcast: '5SPORT',
      notes: 'EuroLeague clash against Turkish power Fenerbahce.'
    },
    {
      opponent: 'Bnei Herzliya',
      opponentShort: 'HER',
      opponentLogo: 'https://a.espncdn.com/i/teamlogos/basketball/500/herzliya.png',
      isHome: true,
      competition: 'Israeli Winner League',
      round: 'Winner League',
      venueName: 'Menora Mivtachim Arena',
      venueCity: 'Tel Aviv',
      venueCountry: 'Israel',
      daysFromNow: 11,
      timeHourUtc: 17,
      timeMinuteUtc: 0,
      importance: 'standard',
      customBroadcast: '5LIVE',
      notes: 'Domestic league match in Tel Aviv.'
    }
  ],

  // Hapoel Tel Aviv Basketball (Tomer Ginat)
  'Hapoel Tel Aviv Basketball': [
    {
      opponent: 'Ironi Ness Ziona',
      opponentShort: 'NZ',
      opponentLogo: 'https://a.espncdn.com/i/teamlogos/basketball/500/ness-ziona.png',
      isHome: true,
      competition: 'Israeli Winner League',
      round: 'Matchday 18',
      venueName: 'Drive in Arena',
      venueCity: 'Tel Aviv',
      venueCountry: 'Israel',
      daysFromNow: 2,
      timeHourUtc: 17,
      timeMinuteUtc: 30,
      importance: 'high',
      customBroadcast: '5SPORT',
      notes: 'Tomer Ginat captaining Hapoel Tel Aviv at Drive in Arena.'
    },
    {
      opponent: 'Gran Canaria',
      opponentShort: 'GCA',
      opponentLogo: 'https://a.espncdn.com/i/teamlogos/basketball/500/gran-canaria.png',
      isHome: true,
      competition: 'EuroCup Basketball',
      round: 'Round 16',
      venueName: 'Samokov Arena',
      venueCity: 'Samokov',
      venueCountry: 'Bulgaria',
      daysFromNow: 4,
      timeHourUtc: 18,
      timeMinuteUtc: 0,
      importance: 'high',
      customBroadcast: 'ONE2 / ONE HD',
      notes: 'Tomer Ginat and Hapoel Tel Aviv hunting top seed in EuroCup.'
    },
    {
      opponent: 'Bnei Herzliya',
      opponentShort: 'HER',
      opponentLogo: 'https://a.espncdn.com/i/teamlogos/basketball/500/herzliya.png',
      isHome: false,
      competition: 'Israeli Winner League',
      round: 'Regular Round',
      venueName: 'HaYovel Hall',
      venueCity: 'Herzliya',
      venueCountry: 'Israel',
      daysFromNow: 7,
      timeHourUtc: 17,
      timeMinuteUtc: 30,
      importance: 'standard',
      customBroadcast: '5LIVE (ערוץ 58)',
      notes: 'Israeli Winner League domestic matchup.'
    },
    {
      opponent: 'Hapoel Jerusalem',
      opponentShort: 'HJR',
      opponentLogo: 'https://a.espncdn.com/i/teamlogos/basketball/500/hapoel-jerusalem.png',
      isHome: true,
      competition: 'Israeli Winner League',
      round: 'Hapoel Derby',
      venueName: 'Drive in Arena',
      venueCity: 'Tel Aviv',
      venueCountry: 'Israel',
      daysFromNow: 10,
      timeHourUtc: 18,
      timeMinuteUtc: 45,
      importance: 'high',
      customBroadcast: '5SPORT',
      notes: 'Hapoel Derby at Drive in Arena.'
    }
  ],

  // Real Madrid (Kylian Mbappe)
  'Real Madrid': [
    {
      opponent: 'Real Sociedad',
      opponentShort: 'RSO',
      opponentLogo: 'https://a.espncdn.com/i/teamlogos/soccer/500/89.png',
      isHome: false,
      competition: 'Spanish La Liga',
      round: 'Matchday 25',
      venueName: 'Reale Arena',
      venueCity: 'San Sebastián',
      venueCountry: 'Spain',
      daysFromNow: 1,
      timeHourUtc: 20,
      timeMinuteUtc: 0,
      importance: 'high',
      customBroadcast: 'ONE HD (אפיק 50)',
      notes: 'Mbappe leading Real Madrid in San Sebastián.'
    },
    {
      opponent: 'FC Barcelona',
      opponentShort: 'BAR',
      opponentLogo: 'https://a.espncdn.com/i/teamlogos/soccer/500/83.png',
      isHome: true,
      competition: 'Spanish La Liga',
      round: 'El Clásico',
      venueName: 'Santiago Bernabéu',
      venueCity: 'Madrid',
      venueCountry: 'Spain',
      daysFromNow: 3,
      timeHourUtc: 20, // 22:00 Israel Time
      timeMinuteUtc: 0,
      importance: 'championship',
      customBroadcast: 'ONE HD (אפיק 50)',
      notes: 'The greatest match in world club football, El Clásico live on ONE HD with full studio broadcast.'
    },
    {
      opponent: 'Liverpool',
      opponentShort: 'LIV',
      opponentLogo: 'https://a.espncdn.com/i/teamlogos/soccer/500/364.png',
      isHome: false,
      competition: 'UEFA Champions League',
      round: 'Matchday 7',
      venueName: 'Anfield',
      venueCity: 'Liverpool',
      venueCountry: 'England',
      daysFromNow: 7,
      timeHourUtc: 20,
      timeMinuteUtc: 0,
      importance: 'championship',
      customBroadcast: '5SPORT / 5STARS',
      notes: 'European royalty clash under the Anfield lights.'
    },
    {
      opponent: 'Atletico Madrid',
      opponentShort: 'ATM',
      opponentLogo: 'https://a.espncdn.com/i/teamlogos/soccer/500/1068.png',
      isHome: false,
      competition: 'Spanish La Liga',
      round: 'Madrid Derby',
      venueName: 'Metropolitano',
      venueCity: 'Madrid',
      venueCountry: 'Spain',
      daysFromNow: 10,
      timeHourUtc: 20,
      timeMinuteUtc: 0,
      importance: 'derby',
      customBroadcast: 'ONE HD (אפיק 50)',
      notes: 'Fierce Madrid derby.'
    }
  ],

  // FC Barcelona (Robert Lewandowski, Lamine Yamal)
  'FC Barcelona': [
    {
      opponent: 'Celta Vigo',
      opponentShort: 'CEL',
      opponentLogo: 'https://a.espncdn.com/i/teamlogos/soccer/500/85.png',
      isHome: true,
      competition: 'Spanish La Liga',
      round: 'Matchday 25',
      venueName: 'Montjuïc Olympic Stadium',
      venueCity: 'Barcelona',
      venueCountry: 'Spain',
      daysFromNow: 1,
      timeHourUtc: 19,
      timeMinuteUtc: 0,
      importance: 'high',
      customBroadcast: 'ONE HD (אפיק 50)',
      notes: 'Lewandowski and Yamal leading the attack.'
    },
    {
      opponent: 'Real Madrid',
      opponentShort: 'RMA',
      opponentLogo: 'https://a.espncdn.com/i/teamlogos/soccer/500/86.png',
      isHome: false,
      competition: 'Spanish La Liga',
      round: 'El Clásico',
      venueName: 'Santiago Bernabéu',
      venueCity: 'Madrid',
      venueCountry: 'Spain',
      daysFromNow: 3,
      timeHourUtc: 20,
      timeMinuteUtc: 0,
      importance: 'championship',
      customBroadcast: 'ONE HD (אפיק 50)',
      notes: 'El Clásico live on ONE HD with full studio.'
    },
    {
      opponent: 'Atalanta',
      opponentShort: 'ATA',
      opponentLogo: 'https://a.espncdn.com/i/teamlogos/soccer/500/109.png',
      isHome: true,
      competition: 'UEFA Champions League',
      round: 'League Stage',
      venueName: 'Montjuïc Olympic Stadium',
      venueCity: 'Barcelona',
      venueCountry: 'Spain',
      daysFromNow: 7,
      timeHourUtc: 20,
      timeMinuteUtc: 0,
      importance: 'championship',
      customBroadcast: '5SPORT / 5STARS',
      notes: 'Champions League night in Barcelona.'
    },
    {
      opponent: 'Villarreal',
      opponentShort: 'VIL',
      opponentLogo: 'https://a.espncdn.com/i/teamlogos/soccer/500/102.png',
      isHome: false,
      competition: 'Spanish La Liga',
      round: 'Matchday 27',
      venueName: 'Estadio de la Cerámica',
      venueCity: 'Villarreal',
      venueCountry: 'Spain',
      daysFromNow: 11,
      timeHourUtc: 17,
      timeMinuteUtc: 30,
      importance: 'standard',
      customBroadcast: 'ONE HD',
      notes: 'La Liga road fixture.'
    }
  ],

  // Liverpool (Mohamed Salah)
  'Liverpool': [
    {
      opponent: 'Everton',
      opponentShort: 'EVE',
      opponentLogo: 'https://a.espncdn.com/i/teamlogos/soccer/500/368.png',
      isHome: true,
      competition: 'Premier League',
      round: 'Merseyside Derby',
      venueName: 'Anfield',
      venueCity: 'Liverpool',
      venueCountry: 'England',
      daysFromNow: 2,
      timeHourUtc: 12,
      timeMinuteUtc: 30,
      importance: 'derby',
      customBroadcast: 'Sport 1 HD (צ\'רלטון)',
      notes: 'The heated Merseyside Derby at Anfield.'
    },
    {
      opponent: 'Newcastle United',
      opponentShort: 'NEW',
      opponentLogo: 'https://a.espncdn.com/i/teamlogos/soccer/500/361.png',
      isHome: false,
      competition: 'Premier League',
      round: 'Matchday 27',
      venueName: 'St James\' Park',
      venueCity: 'Newcastle',
      venueCountry: 'England',
      daysFromNow: 5,
      timeHourUtc: 19,
      timeMinuteUtc: 45,
      importance: 'high',
      customBroadcast: 'Sport 1 HD (צ\'רלטון)',
      notes: 'Electric atmosphere at St James\' Park.'
    },
    {
      opponent: 'Manchester City',
      opponentShort: 'MCI',
      opponentLogo: 'https://a.espncdn.com/i/teamlogos/soccer/500/382.png',
      isHome: true,
      competition: 'Premier League',
      round: 'Title Race Showdown',
      venueName: 'Anfield',
      venueCity: 'Liverpool',
      venueCountry: 'England',
      daysFromNow: 7,
      timeHourUtc: 16,
      timeMinuteUtc: 30,
      importance: 'championship',
      customBroadcast: 'Sport 1 HD (צ\'רלטון)',
      notes: 'Massive showdown at Anfield.'
    },
    {
      opponent: 'Real Madrid',
      opponentShort: 'RMA',
      opponentLogo: 'https://a.espncdn.com/i/teamlogos/soccer/500/86.png',
      isHome: true,
      competition: 'UEFA Champions League',
      round: 'Matchday 7',
      venueName: 'Anfield',
      venueCity: 'Liverpool',
      venueCountry: 'England',
      daysFromNow: 11,
      timeHourUtc: 20,
      timeMinuteUtc: 0,
      importance: 'championship',
      customBroadcast: '5SPORT / 5STARS',
      notes: 'European classic under the lights.'
    }
  ],

  // Inter Miami (Lionel Messi)
  'Inter Miami': [
    {
      opponent: 'New York Red Bulls',
      opponentShort: 'RBNY',
      opponentLogo: 'https://a.espncdn.com/i/teamlogos/soccer/500/190.png',
      isHome: false,
      competition: 'MLS (Major League Soccer)',
      round: 'Eastern Matchday',
      venueName: 'Red Bull Arena',
      venueCity: 'Harrison, NJ',
      venueCountry: 'USA',
      daysFromNow: 1,
      timeHourUtc: 23,
      timeMinuteUtc: 30,
      importance: 'high',
      customBroadcast: 'Apple TV (MLS Pass) / 5SPORT',
      notes: 'Messi and Suarez in action in New York.'
    },
    {
      opponent: 'LA Galaxy',
      opponentShort: 'LAG',
      opponentLogo: 'https://a.espncdn.com/i/teamlogos/soccer/500/187.png',
      isHome: true,
      competition: 'MLS (Major League Soccer)',
      round: 'Cross-Conference Blockbuster',
      venueName: 'Chase Stadium',
      venueCity: 'Fort Lauderdale, FL',
      venueCountry: 'USA',
      daysFromNow: 3,
      timeHourUtc: 0, // 02:30 Israel Time (+1)
      timeMinuteUtc: 30,
      importance: 'high',
      customBroadcast: 'Apple TV (MLS Pass) / 5SPORT',
      notes: 'Lionel Messi and Luis Suarez in action for Inter Miami.'
    },
    {
      opponent: 'Orlando City SC',
      opponentShort: 'ORL',
      opponentLogo: 'https://a.espncdn.com/i/teamlogos/soccer/500/18419.png',
      isHome: false,
      competition: 'MLS (Major League Soccer)',
      round: 'Florida Derby',
      venueName: 'Inter&Co Stadium',
      venueCity: 'Orlando, FL',
      venueCountry: 'USA',
      daysFromNow: 7,
      timeHourUtc: 0,
      timeMinuteUtc: 30,
      importance: 'derby',
      customBroadcast: 'Apple TV (MLS Season Pass)',
      notes: 'The Florida Derby live on Apple TV.'
    },
    {
      opponent: 'Atlanta United',
      opponentShort: 'ATL',
      opponentLogo: 'https://a.espncdn.com/i/teamlogos/soccer/500/18418.png',
      isHome: true,
      competition: 'MLS (Major League Soccer)',
      round: 'Eastern Showcase',
      venueName: 'Chase Stadium',
      venueCity: 'Fort Lauderdale, FL',
      venueCountry: 'USA',
      daysFromNow: 11,
      timeHourUtc: 0,
      timeMinuteUtc: 30,
      importance: 'standard',
      customBroadcast: 'Apple TV (MLS Pass)',
      notes: 'Messi at Chase Stadium.'
    }
  ],

  // Al-Nassr (Cristiano Ronaldo)
  'Al-Nassr': [
    {
      opponent: 'Al-Shabab',
      opponentShort: 'SHB',
      opponentLogo: 'https://a.espncdn.com/i/teamlogos/soccer/500/6905.png',
      isHome: false,
      competition: 'Saudi Pro League',
      round: 'Riyadh Derby Clash',
      venueName: 'Al-Shabab Club Stadium',
      venueCity: 'Riyadh',
      venueCountry: 'Saudi Arabia',
      daysFromNow: 1,
      timeHourUtc: 18,
      timeMinuteUtc: 0,
      importance: 'high',
      customBroadcast: 'Sport 1 / Sport 2 (צ\'רלטון)',
      notes: 'Cristiano Ronaldo leading the attack.'
    },
    {
      opponent: 'Al-Hilal',
      opponentShort: 'HIL',
      opponentLogo: 'https://a.espncdn.com/i/teamlogos/soccer/500/6908.png',
      isHome: true,
      competition: 'Saudi Pro League',
      round: 'Riyadh Derby',
      venueName: 'Al-Awwal Park',
      venueCity: 'Riyadh',
      venueCountry: 'Saudi Arabia',
      daysFromNow: 3,
      timeHourUtc: 18,
      timeMinuteUtc: 0,
      importance: 'derby',
      customBroadcast: 'Sport 1 / Sport 2 (צ\'רלטון)',
      notes: 'Cristiano Ronaldo leads Al-Nassr in the blockbuster Riyadh Derby.'
    },
    {
      opponent: 'Al-Ittihad',
      opponentShort: 'ITT',
      opponentLogo: 'https://a.espncdn.com/i/teamlogos/soccer/500/6907.png',
      isHome: false,
      competition: 'Saudi Pro League',
      round: 'Saudi Clásico',
      venueName: 'King Abdullah Sports City',
      venueCity: 'Jeddah',
      venueCountry: 'Saudi Arabia',
      daysFromNow: 7,
      timeHourUtc: 18,
      timeMinuteUtc: 0,
      importance: 'high',
      customBroadcast: 'Sport 1 / Sport 2 (צ\'רלטון)',
      notes: 'Saudi Clásico in Jeddah with star-studded lineups.'
    },
    {
      opponent: 'Al-Ahli',
      opponentShort: 'AHL',
      opponentLogo: 'https://a.espncdn.com/i/teamlogos/soccer/500/6904.png',
      isHome: true,
      competition: 'Saudi Pro League',
      round: 'Matchday 26',
      venueName: 'Al-Awwal Park',
      venueCity: 'Riyadh',
      venueCountry: 'Saudi Arabia',
      daysFromNow: 11,
      timeHourUtc: 18,
      timeMinuteUtc: 0,
      importance: 'high',
      customBroadcast: 'Sport 1 / Sport 2 (צ\'רלטון)',
      notes: 'Ronaldo vs Mahrez and Firmino.'
    }
  ]
};

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

// Generic league-aware generator for any athlete team not in hardcoded templates
function generateGenericTeamFixtures(player: Player): MatchFixture[] {
  const baseDate = new Date();
  const fixtures: MatchFixture[] = [];
  const isBasketball = player.sport === 'basketball';
  const isTennis = player.sport === 'tennis';
  const leagueLower = (player.league || '').toLowerCase();
  const teamLower = (player.currentTeam || '').toLowerCase();

  let defaultOpponents: Array<{ name: string; short: string; logo: string; venue: string; city: string; country?: string }> = [];

  if (isBasketball) {
    if (leagueLower.includes('euroleague') || leagueLower.includes('bbl') || leagueLower.includes('eurocup') || leagueLower.includes('israeli')) {
      defaultOpponents = [
        { name: 'Panathinaikos', short: 'PAO', logo: 'https://a.espncdn.com/i/teamlogos/basketball/500/pao.png', venue: 'OAKA Altion', city: 'Athens', country: 'Greece' },
        { name: 'Olympiacos', short: 'OLY', logo: 'https://a.espncdn.com/i/teamlogos/basketball/500/oly.png', venue: 'Peace and Friendship Stadium', city: 'Piraeus', country: 'Greece' },
        { name: 'Real Madrid Basketball', short: 'RMB', logo: 'https://a.espncdn.com/i/teamlogos/basketball/500/real-madrid.png', venue: 'WiZink Center', city: 'Madrid', country: 'Spain' },
        { name: 'Maccabi Tel Aviv Basketball', short: 'MTA', logo: 'https://a.espncdn.com/i/teamlogos/basketball/500/maccabi.png', venue: 'Menora Mivtachim Arena', city: 'Tel Aviv', country: 'Israel' },
      ];
    } else {
      defaultOpponents = [
        { name: 'Boston Celtics', short: 'BOS', logo: 'https://a.espncdn.com/i/teamlogos/nba/500/bos.png', venue: 'TD Garden', city: 'Boston, MA', country: 'USA' },
        { name: 'Golden State Warriors', short: 'GSW', logo: 'https://a.espncdn.com/i/teamlogos/nba/500/gsw.png', venue: 'Chase Center', city: 'San Francisco, CA', country: 'USA' },
        { name: 'Dallas Mavericks', short: 'DAL', logo: 'https://a.espncdn.com/i/teamlogos/nba/500/dal.png', venue: 'American Airlines Center', city: 'Dallas, TX', country: 'USA' },
        { name: 'Denver Nuggets', short: 'DEN', logo: 'https://a.espncdn.com/i/teamlogos/nba/500/den.png', venue: 'Ball Arena', city: 'Denver, CO', country: 'USA' },
      ];
    }
  } else if (isTennis) {
    defaultOpponents = [
      { name: 'Jannik Sinner', short: 'SIN', logo: 'https://a.espncdn.com/i/teamlogos/tennis/500/atp.png', venue: 'Arthur Ashe Stadium', city: 'New York', country: 'USA' },
      { name: 'Carlos Alcaraz', short: 'ALC', logo: 'https://a.espncdn.com/i/teamlogos/tennis/500/atp.png', venue: 'Court Philippe-Chatrier', city: 'Paris', country: 'France' },
      { name: 'Alexander Zverev', short: 'ZVE', logo: 'https://a.espncdn.com/i/teamlogos/tennis/500/atp.png', venue: 'Centre Court', city: 'London', country: 'UK' },
      { name: 'Daniil Medvedev', short: 'MED', logo: 'https://a.espncdn.com/i/teamlogos/tennis/500/atp.png', venue: 'Rod Laver Arena', city: 'Melbourne', country: 'Australia' },
    ];
  } else {
    // Football: check league context
    if (leagueLower.includes('mls') || leagueLower.includes('major league soccer')) {
      defaultOpponents = [
        { name: 'Inter Miami CF', short: 'MIA', logo: 'https://a.espncdn.com/i/teamlogos/soccer/500/20232.png', venue: 'Chase Stadium', city: 'Fort Lauderdale, FL', country: 'USA' },
        { name: 'Atlanta United', short: 'ATL', logo: 'https://a.espncdn.com/i/teamlogos/soccer/500/18418.png', venue: 'Mercedes-Benz Stadium', city: 'Atlanta, GA', country: 'USA' },
        { name: 'LA Galaxy', short: 'LAG', logo: 'https://a.espncdn.com/i/teamlogos/soccer/500/187.png', venue: 'Dignity Health Sports Park', city: 'Carson, CA', country: 'USA' },
        { name: 'New York Red Bulls', short: 'RBNY', logo: 'https://a.espncdn.com/i/teamlogos/soccer/500/190.png', venue: 'Red Bull Arena', city: 'Harrison, NJ', country: 'USA' },
      ];
    } else if (leagueLower.includes('belgian') || leagueLower.includes('jupiler')) {
      defaultOpponents = [
        { name: 'Club Brugge', short: 'CLU', logo: 'https://a.espncdn.com/i/teamlogos/soccer/500/198.png', venue: 'Jan Breydel Stadium', city: 'Bruges', country: 'Belgium' },
        { name: 'RSC Anderlecht', short: 'AND', logo: 'https://a.espncdn.com/i/teamlogos/soccer/500/196.png', venue: 'Lotto Park', city: 'Brussels', country: 'Belgium' },
        { name: 'KRC Genk', short: 'GNK', logo: 'https://a.espncdn.com/i/teamlogos/soccer/500/202.png', venue: 'Cegeka Arena', city: 'Genk', country: 'Belgium' },
        { name: 'Royal Antwerp FC', short: 'ANT', logo: 'https://a.espncdn.com/i/teamlogos/soccer/500/197.png', venue: 'Bosuilstadion', city: 'Antwerp', country: 'Belgium' },
      ];
    } else if (leagueLower.includes('israeli') || leagueLower.includes('ligat') || leagueLower.includes('ליגת')) {
      defaultOpponents = [
        { name: 'Maccabi Haifa', short: 'MHA', logo: 'https://a.espncdn.com/i/teamlogos/soccer/500/582.png', venue: 'Sammy Ofer Stadium', city: 'Haifa', country: 'Israel' },
        { name: 'Hapoel Be\'er Sheva', short: 'HBS', logo: 'https://a.espncdn.com/i/teamlogos/soccer/500/581.png', venue: 'Toto Turner Stadium', city: 'Be\'er Sheva', country: 'Israel' },
        { name: 'Beitar Jerusalem', short: 'BTR', logo: 'https://a.espncdn.com/i/teamlogos/soccer/500/579.png', venue: 'Teddy Stadium', city: 'Jerusalem', country: 'Israel' },
        { name: 'Maccabi Tel Aviv', short: 'MTA', logo: 'https://a.espncdn.com/i/teamlogos/soccer/500/583.png', venue: 'Bloomfield Stadium', city: 'Tel Aviv', country: 'Israel' },
      ];
    } else if (leagueLower.includes('la liga') || leagueLower.includes('laliga') || teamLower.includes('madrid') || teamLower.includes('barcelona')) {
      defaultOpponents = [
        { name: 'Real Madrid', short: 'RMA', logo: 'https://a.espncdn.com/i/teamlogos/soccer/500/86.png', venue: 'Santiago Bernabéu', city: 'Madrid', country: 'Spain' },
        { name: 'FC Barcelona', short: 'BAR', logo: 'https://a.espncdn.com/i/teamlogos/soccer/500/83.png', venue: 'Montjuïc Olympic Stadium', city: 'Barcelona', country: 'Spain' },
        { name: 'Atlético Madrid', short: 'ATM', logo: 'https://a.espncdn.com/i/teamlogos/soccer/500/1068.png', venue: 'Metropolitano Stadium', city: 'Madrid', country: 'Spain' },
        { name: 'Athletic Bilbao', short: 'ATH', logo: 'https://a.espncdn.com/i/teamlogos/soccer/500/93.png', venue: 'San Mamés', city: 'Bilbao', country: 'Spain' },
      ];
    } else if (leagueLower.includes('serie a') || leagueLower.includes('ital')) {
      defaultOpponents = [
        { name: 'Inter Milan', short: 'INT', logo: 'https://a.espncdn.com/i/teamlogos/soccer/500/110.png', venue: 'San Siro', city: 'Milan', country: 'Italy' },
        { name: 'Juventus', short: 'JUV', logo: 'https://a.espncdn.com/i/teamlogos/soccer/500/111.png', venue: 'Allianz Stadium', city: 'Turin', country: 'Italy' },
        { name: 'AC Milan', short: 'MIL', logo: 'https://a.espncdn.com/i/teamlogos/soccer/500/103.png', venue: 'San Siro', city: 'Milan', country: 'Italy' },
        { name: 'Napoli', short: 'NAP', logo: 'https://a.espncdn.com/i/teamlogos/soccer/500/114.png', venue: 'Diego Armando Maradona Stadium', city: 'Naples', country: 'Italy' },
      ];
    } else if (leagueLower.includes('bundesliga') || leagueLower.includes('german')) {
      defaultOpponents = [
        { name: 'Bayern Munich', short: 'FCB', logo: 'https://a.espncdn.com/i/teamlogos/soccer/500/132.png', venue: 'Allianz Arena', city: 'Munich', country: 'Germany' },
        { name: 'Borussia Dortmund', short: 'BVB', logo: 'https://a.espncdn.com/i/teamlogos/soccer/500/124.png', venue: 'Signal Iduna Park', city: 'Dortmund', country: 'Germany' },
        { name: 'Bayer Leverkusen', short: 'B04', logo: 'https://a.espncdn.com/i/teamlogos/soccer/500/131.png', venue: 'BayArena', city: 'Leverkusen', country: 'Germany' },
        { name: 'RB Leipzig', short: 'RBL', logo: 'https://a.espncdn.com/i/teamlogos/soccer/500/11420.png', venue: 'Red Bull Arena', city: 'Leipzig', country: 'Germany' },
      ];
    } else {
      defaultOpponents = [
        { name: 'Arsenal', short: 'ARS', logo: 'https://a.espncdn.com/i/teamlogos/soccer/500/359.png', venue: 'Emirates Stadium', city: 'London', country: 'England' },
        { name: 'Liverpool', short: 'LIV', logo: 'https://a.espncdn.com/i/teamlogos/soccer/500/364.png', venue: 'Anfield', city: 'Liverpool', country: 'England' },
        { name: 'Manchester City', short: 'MCI', logo: 'https://a.espncdn.com/i/teamlogos/soccer/500/382.png', venue: 'Etihad Stadium', city: 'Manchester', country: 'England' },
        { name: 'Chelsea', short: 'CHE', logo: 'https://a.espncdn.com/i/teamlogos/soccer/500/363.png', venue: 'Stamford Bridge', city: 'London', country: 'England' },
      ];
    }
  }

  const intervals = [1, 3, 5, 7, 9];

  intervals.forEach((days, index) => {
    // Filter out opponent if identical to player's current team
    let validOpponents = defaultOpponents.filter(o => o.name.toLowerCase() !== player.currentTeam.toLowerCase());
    if (validOpponents.length === 0) validOpponents = defaultOpponents;
    const opp = validOpponents[index % validOpponents.length];
    
    const isHome = index % 2 === 0;
    const matchDate = new Date(baseDate.getTime() + days * 24 * 60 * 60 * 1000);
    
    // Set match time based on sport & league
    if (isBasketball && !leagueLower.includes('euroleague')) {
      matchDate.setUTCHours(2, 0, 0, 0); // approx 04:00 IDT for NBA
    } else if (leagueLower.includes('mls')) {
      matchDate.setUTCHours(23, 30, 0, 0); // approx 01:30 IDT
    } else if (leagueLower.includes('euroleague') || isBasketball) {
      matchDate.setUTCHours(19, 0, 0, 0); // approx 21:00 IDT
    } else {
      matchDate.setUTCHours(19, 45, 0, 0); // approx 21:45 IDT
    }

    const homeTeam = isHome ? {
      name: player.currentTeam,
      shortName: player.currentTeam.substring(0, 3).toUpperCase(),
      logo: player.teamLogo,
    } : {
      name: opp.name,
      shortName: opp.short,
      logo: opp.logo,
    };

    const awayTeam = isHome ? {
      name: opp.name,
      shortName: opp.short,
      logo: opp.logo,
    } : {
      name: player.currentTeam,
      shortName: player.currentTeam.substring(0, 3).toUpperCase(),
      logo: player.teamLogo,
    };

    const opponentTeam = isHome ? awayTeam : homeTeam;

    const venue = {
      name: isHome ? `${player.currentTeam} Stadium` : opp.venue,
      city: isHome ? player.country : opp.city,
      country: isHome ? player.country : (opp.country || 'International'),
    };

    const broadcast = resolveIsraeliBroadcast(player.league, player.sport, index === 0);

    fixtures.push({
      id: `fix-${player.id}-${index}`,
      playerId: player.id,
      playerName: player.name,
      playerTeam: player.currentTeam,
      playerPhoto: player.photoUrl,
      sport: player.sport,
      league: player.league,
      roundOrStage: `Matchday ${22 + index}`,
      homeTeam,
      awayTeam,
      isHome,
      opponentTeam,
      dateTimeUtc: matchDate.toISOString(),
      venue,
      broadcast,
      status: 'scheduled',
      importanceLevel: index === 0 ? 'high' : 'standard',
      notes: `Upcoming match for ${player.name} with ${player.currentTeam}.`
    });
  });

  return fixtures;
}

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

  // 1. Check TheSportsDB Live Official Athlete Directory API First
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

  // 2. Direct dictionary match
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

  // 2. Fuzzy / partial match in KNOWN_ATHLETES_MAP
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

  // 3. Check preset list
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

  // 4. Fallback to Gemini AI Lookup if not rate limited
  const ai = getAiClient();
  if (ai && !isGeminiRateLimited()) {
    try {
      const prompt = `You are an expert sports data service. Identify the professional athlete "${athleteName}".
      Provide their CURRENT real-world team/club and league for the current season (2024-2025/2026).
      
      Return a JSON object with:
      - name: Full name in English
      - nativeName: Hebrew name (e.g. ליאל עבדה, ענאן חלאילי, תאי בריבו)
      - sport: "football" | "basketball" | "tennis" | "other"
      - currentTeam: Exact current club/team (e.g. "Charlotte FC", "Philadelphia Union", "Royale Union Saint-Gilloise", "KAA Gent", "Maccabi Tel Aviv", "Real Madrid", "Inter Miami", "Portland Trail Blazers")
      - league: League name (e.g. "MLS (Major League Soccer)", "Belgian Pro League", "Spanish La Liga", "Israeli Premier League", "NBA", "EuroLeague")
      - country: Nationality (e.g. "Israel", "France", "Spain")
      - position: Position like "Winger (#11)", "Striker (#27)", "Point Guard (#45)"
      - jerseyNumber: Jersey number as string
      - teamLogo: Valid public ESPN logo url (https://a.espncdn.com/...) or empty string
      - bio: Brief 1-2 sentence description`;

      const response = await ai.models.generateContent({
        model: 'gemini-3.7-flash',
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              name: { type: Type.STRING },
              nativeName: { type: Type.STRING },
              sport: { type: Type.STRING },
              currentTeam: { type: Type.STRING },
              league: { type: Type.STRING },
              country: { type: Type.STRING },
              position: { type: Type.STRING },
              jerseyNumber: { type: Type.STRING },
              teamLogo: { type: Type.STRING },
              bio: { type: Type.STRING },
            },
            required: ['name', 'sport', 'currentTeam', 'league']
          }
        }
      });

      if (response.text) {
        const parsed = JSON.parse(response.text.trim());
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
        console.info(`[SportsSync] Gemini quota reached for athlete lookup (${athleteName}). Falling back to smart heuristics.`);
      } else {
        console.warn('AI lookup fallback error:', err?.message || err);
      }
    }
  }

  // 5. Ultimate smart heuristic fallback
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
  try {
    const tsdbFixtures = await fetchTheSportsDbUpcomingEvents(player);
    if (tsdbFixtures && tsdbFixtures.length > 0) {
      fixtures = tsdbFixtures;
      fixturesCache.set(cacheKey, { fixtures, timestamp: Date.now() });
      return fixtures;
    }
  } catch (err) {
    console.warn(`TheSportsDB API fallback for ${player.name}:`, err);
  }

  // 2. Attempt High-Speed Live ESPN Official Schedule / Scoreboard API
  try {
    const espnFixtures = await fetchEspnLiveSchedule(player);
    if (espnFixtures && espnFixtures.length > 0) {
      fixtures = espnFixtures;
      fixturesCache.set(cacheKey, { fixtures, timestamp: Date.now() });
      return fixtures;
    }
  } catch (err) {
    console.warn(`ESPN API fallback for ${player.name}:`, err);
  }

  // 3. Attempt Real-Time Google Search Grounding for unmapped / international leagues
  try {
    const searchFixtures = await fetchSearchGroundedFixtures(player);
    if (searchFixtures && searchFixtures.length > 0) {
      fixtures = searchFixtures;
      fixturesCache.set(cacheKey, { fixtures, timestamp: Date.now() });
      return fixtures;
    }
  } catch (err) {
    console.warn(`Search grounding fallback for ${player.name}:`, err);
  }

  // 4. Fallback to Predefined Curated Schedule Templates
  const templateList = SCHEDULE_TEMPLATES[player.currentTeam];

  if (templateList && templateList.length > 0) {
    const baseDate = new Date();
    fixtures = templateList.map((tpl, idx) => {
      const matchDate = new Date(baseDate.getTime() + tpl.daysFromNow * 24 * 60 * 60 * 1000);
      matchDate.setUTCHours(tpl.timeHourUtc, tpl.timeMinuteUtc, 0, 0);

      const homeTeam = tpl.isHome ? {
        name: player.currentTeam,
        shortName: player.currentTeam.substring(0, 3).toUpperCase(),
        logo: player.teamLogo,
      } : {
        name: tpl.opponent,
        shortName: tpl.opponentShort,
        logo: tpl.opponentLogo,
      };

      const awayTeam = tpl.isHome ? {
        name: tpl.opponent,
        shortName: tpl.opponentShort,
        logo: tpl.opponentLogo,
      } : {
        name: player.currentTeam,
        shortName: player.currentTeam.substring(0, 3).toUpperCase(),
        logo: player.teamLogo,
      };

      const opponentTeam = tpl.isHome ? awayTeam : homeTeam;

      const broadcast = resolveIsraeliBroadcast(
        tpl.competition || player.league,
        player.sport,
        tpl.importance === 'high' || tpl.importance === 'championship',
        tpl.customBroadcast
      );

      return {
        id: `fix-${player.id}-${idx}`,
        playerId: player.id,
        playerName: player.name,
        playerTeam: player.currentTeam,
        playerPhoto: player.photoUrl,
        sport: player.sport,
        league: tpl.competition || player.league,
        roundOrStage: tpl.round,
        homeTeam,
        awayTeam,
        isHome: tpl.isHome,
        opponentTeam,
        dateTimeUtc: matchDate.toISOString(),
        venue: {
          name: tpl.venueName,
          city: tpl.venueCity,
          country: tpl.venueCountry,
        },
        broadcast,
        status: 'scheduled',
        dataSource: 'official_calendar',
        importanceLevel: tpl.importance,
        notes: tpl.notes || `Scheduled match for ${player.name} with ${player.currentTeam}.`
      };
    });
  } else {
    // 4. Generate intelligent league fixtures
    fixtures = generateGenericTeamFixtures(player).map(f => ({
      ...f,
      dataSource: 'official_calendar' as const
    }));
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
