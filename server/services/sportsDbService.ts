import { MatchFixture, Player, SportType } from '../../src/types';
import { resolveIsraeliBroadcast } from './israeliBroadcastService';

interface TheSportsDbPlayer {
  idPlayer: string;
  idTeam?: string;
  strPlayer: string;
  strNationality?: string;
  strSport?: string;
  strTeam?: string;
  strTeam2?: string;
  strPosition?: string;
  strNumber?: string;
  strThumb?: string;
  strCutout?: string;
  strRender?: string;
  strDescriptionEN?: string;
}

interface TheSportsDbTeam {
  idTeam: string;
  strTeam: string;
  strLeague?: string;
  strBadge?: string;
  strLogo?: string;
  strColour1?: string;
  strCountry?: string;
  strStadium?: string;
  strStadiumLocation?: string;
}

interface TheSportsDbEvent {
  idEvent: string;
  strEvent: string;
  strLeague: string;
  idLeague?: string;
  strHomeTeam: string;
  strAwayTeam: string;
  dateEvent: string;
  strTime?: string;
  strVenue?: string;
  strCountry?: string;
  strCity?: string;
  strThumb?: string;
  intHomeScore?: string | null;
  intAwayScore?: string | null;
  strStatus?: string;
}

function mapSportsDbSport(sportStr?: string): SportType {
  const s = (sportStr || '').toLowerCase();
  if (s.includes('soccer') || s.includes('football')) return 'football';
  if (s.includes('basket')) return 'basketball';
  if (s.includes('tennis')) return 'tennis';
  return 'other';
}

/**
 * Searches for a player on TheSportsDB API
 */
export async function searchPlayerOnTheSportsDb(playerName: string): Promise<{
  name: string;
  nativeName?: string;
  sport: SportType;
  currentTeam: string;
  league: string;
  country: string;
  position: string;
  jerseyNumber: string;
  photoUrl: string;
  teamLogo: string;
  teamColor: string;
  bio: string;
} | null> {
  try {
    const cleanName = playerName.trim();
    const url = `https://www.thesportsdb.com/api/v1/json/3/searchplayers.php?p=${encodeURIComponent(cleanName)}`;
    
    const res = await fetch(url, { headers: { 'User-Agent': 'SportsSyncElite/1.0' } });
    if (!res.ok) return null;
    
    const data = await res.json();
    if (!data.player || !Array.isArray(data.player) || data.player.length === 0) {
      return null;
    }

    const p: TheSportsDbPlayer = data.player[0];
    const sport = mapSportsDbSport(p.strSport);
    const teamName = p.strTeam || 'Free Agent';

    // Enrich team info (league, badge, color)
    let league = sport === 'basketball' ? 'NBA' : 'Top Tier League';
    let teamBadge = 'https://a.espncdn.com/i/teamlogos/default-team-logo-500.png';
    let teamColor = '#1E40AF';

    if (p.strTeam) {
      try {
        const teamUrl = `https://www.thesportsdb.com/api/v1/json/3/searchteams.php?t=${encodeURIComponent(p.strTeam)}`;
        const teamRes = await fetch(teamUrl, { headers: { 'User-Agent': 'SportsSyncElite/1.0' } });
        if (teamRes.ok) {
          const teamData = await teamRes.json();
          if (teamData.teams && teamData.teams.length > 0) {
            const t: TheSportsDbTeam = teamData.teams[0];
            if (t.strLeague) league = t.strLeague;
            if (t.strBadge) teamBadge = t.strBadge;
            if (t.strColour1) teamColor = t.strColour1;
          }
        }
      } catch (teamErr) {
        console.warn('TheSportsDB team detail fetch warning:', teamErr);
      }
    }

    const photoUrl = p.strCutout || p.strThumb || (
      sport === 'basketball' 
        ? 'https://images.unsplash.com/photo-1546519638-68e109498ffc?w=600&auto=format&fit=crop&q=80'
        : 'https://images.unsplash.com/photo-1508098682722-e99c43a406b2?w=600&auto=format&fit=crop&q=80'
    );

    const position = p.strPosition || 'Athlete';
    const country = p.strNationality || 'Israel';
    const jerseyNumber = p.strNumber || '';
    const bio = p.strDescriptionEN 
      ? p.strDescriptionEN.slice(0, 240) + '...'
      : `Professional ${sport} athlete playing for ${teamName} (${league}).`;

    return {
      name: p.strPlayer || cleanName,
      nativeName: p.strPlayer || cleanName,
      sport,
      currentTeam: teamName,
      league,
      country,
      position,
      jerseyNumber,
      photoUrl,
      teamLogo: teamBadge,
      teamColor,
      bio
    };
  } catch (err) {
    console.warn('TheSportsDB search error for player:', playerName, err);
    return null;
  }
}

/**
 * Fetches real upcoming official match events from TheSportsDB
 */
export async function fetchTheSportsDbUpcomingEvents(player: Player): Promise<MatchFixture[] | null> {
  try {
    if (!player.currentTeam || player.currentTeam === 'Free Agent' || player.currentTeam.includes('International Pro Club')) {
      return null;
    }

    // 1. Search team ID
    const teamUrl = `https://www.thesportsdb.com/api/v1/json/3/searchteams.php?t=${encodeURIComponent(player.currentTeam)}`;
    const teamRes = await fetch(teamUrl, { headers: { 'User-Agent': 'SportsSyncElite/1.0' } });
    if (!teamRes.ok) return null;

    const teamData = await teamRes.json();
    if (!teamData.teams || teamData.teams.length === 0) return null;

    const team: TheSportsDbTeam = teamData.teams[0];
    const teamId = team.idTeam;

    // 2. Fetch next events
    const eventsUrl = `https://www.thesportsdb.com/api/v1/json/3/eventsnext.php?id=${teamId}`;
    const evRes = await fetch(eventsUrl, { headers: { 'User-Agent': 'SportsSyncElite/1.0' } });
    if (!evRes.ok) return null;

    const evData = await evRes.json();
    if (!evData.events || !Array.isArray(evData.events) || evData.events.length === 0) {
      return null;
    }

    const fixtures: MatchFixture[] = [];
    const events: TheSportsDbEvent[] = evData.events.slice(0, 5);

    for (const ev of events) {
      const isHome = (ev.strHomeTeam || '').toLowerCase().includes(player.currentTeam.toLowerCase());
      const opponentName = isHome ? (ev.strAwayTeam || 'Opponent') : (ev.strHomeTeam || 'Opponent');

      // Date parsing
      let timePart = ev.strTime || '19:00:00';
      if (timePart.length === 5) timePart += ':00';
      const dateStr = `${ev.dateEvent}T${timePart}Z`;
      const dateObj = new Date(dateStr);
      const isoDate = isNaN(dateObj.getTime()) ? new Date().toISOString() : dateObj.toISOString();

      const homeTeam = {
        name: ev.strHomeTeam || player.currentTeam,
        shortName: (ev.strHomeTeam || '').slice(0, 3).toUpperCase(),
        logo: isHome ? (team.strBadge || player.teamLogo) : 'https://a.espncdn.com/i/teamlogos/default-team-logo-500.png',
        score: ev.intHomeScore ? parseInt(ev.intHomeScore, 10) : undefined,
      };

      const awayTeam = {
        name: ev.strAwayTeam || 'Opponent',
        shortName: (ev.strAwayTeam || '').slice(0, 3).toUpperCase(),
        logo: !isHome ? (team.strBadge || player.teamLogo) : 'https://a.espncdn.com/i/teamlogos/default-team-logo-500.png',
        score: ev.intAwayScore ? parseInt(ev.intAwayScore, 10) : undefined,
      };

      const competition = ev.strLeague || player.league || 'Official Championship';
      const broadcast = resolveIsraeliBroadcast(
        competition,
        player.sport,
        false
      );

      fixtures.push({
        id: `tsdb-${ev.idEvent}-${player.id}`,
        playerId: player.id,
        playerName: player.name,
        playerTeam: player.currentTeam,
        playerPhoto: player.photoUrl,
        sport: player.sport,
        league: competition,
        leagueLogo: ev.strThumb,
        roundOrStage: 'Regular Season',
        homeTeam,
        awayTeam,
        isHome,
        opponentTeam: isHome ? awayTeam : homeTeam,
        dateTimeUtc: isoDate,
        venue: {
          name: ev.strVenue || team.strStadium || 'Home Arena',
          city: ev.strCity || team.strStadiumLocation || 'Metropolitan Area',
          country: ev.strCountry || team.strCountry || 'International'
        },
        broadcast,
        status: 'scheduled',
        dataSource: 'sportsdb_live',
        notes: `Official fixture via TheSportsDB live calendar.`,
        importanceLevel: /derby|clash|final|cup|champions/i.test(`${ev.strHomeTeam} ${ev.strAwayTeam} ${competition}`) ? 'derby' : 'standard',
      });
    }

    return fixtures.length > 0 ? fixtures : null;
  } catch (err) {
    console.warn('TheSportsDB upcoming events fetch error for team:', player.currentTeam, err);
    return null;
  }
}
