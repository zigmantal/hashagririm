export type SportType = 'football' | 'basketball' | 'tennis' | 'other';

export interface Player {
  id: string;
  name: string;
  nativeName?: string;
  sport: SportType;
  currentTeam: string;
  league: string;
  country: string;
  position: string;
  jerseyNumber?: string;
  photoUrl: string;
  teamLogo: string;
  teamColor?: string;
  bio?: string;
  isDemo?: boolean;
  active: boolean;
  addedAt: string;
}

export type NetworkGroup = 
  | 'Sport 5'
  | 'Charlton (Sport 1-4)'
  | 'ONE'
  | 'Public (Kan 11)'
  | 'Commercial (Keshet/Reshet)'
  | 'EuroSport'
  | 'Streaming'
  | 'TBD';

export interface IsraeliBroadcastInfo {
  channelName: string;
  hebrewName: string;
  networkGroup: NetworkGroup;
  channelNumberHot: string;
  channelNumberYes: string;
  channelNumberPartner?: string;
  channelNumberCellcom?: string;
  badgeBg: string;
  badgeTextColor: string;
  borderColor: string;
  isFreeToAir: boolean;
  streamingPlatform?: string;
  descriptionHebrew?: string;
  studioPreShow?: string;
  commentaryHebrew?: boolean;
  /**
   * true  = matched against Yes's real broadcast-schedule feed for this exact fixture
   * false = could not be confirmed against real data; channel fields are intentionally left blank
   * undefined = legacy/rule-based guess (pre-Yes-integration data, kept only for backwards compat)
   */
  confirmed?: boolean;
  /** The raw Yes programme title this fixture was matched against, for debugging/QA */
  sourceProgramTitle?: string;
}

export interface WeeklyScheduleItem {
  title: string;
  description?: string;
  startsUtc: string;
  endsUtc: string;
}

export interface WeeklyScheduleChannel {
  channelId: string;
  title: string;
  items: WeeklyScheduleItem[];
}

export interface WeeklyScheduleDay {
  dateKey: string; // YYYY-MM-DD in Asia/Jerusalem
  channels: WeeklyScheduleChannel[];
}

export interface MatchTeam {
  name: string;
  shortName: string;
  logo: string;
  score?: number;
}

export interface MatchVenue {
  name: string;
  city: string;
  country: string;
  capacity?: number;
  indoor?: boolean;
}

export type MatchStatus = 'scheduled' | 'live' | 'finished' | 'postponed';

export interface MatchFixture {
  id: string;
  playerId: string;
  playerName: string;
  playerTeam: string;
  playerPhoto: string;
  sport: SportType;
  league: string;
  leagueLogo?: string;
  roundOrStage: string;
  homeTeam: MatchTeam;
  awayTeam: MatchTeam;
  isHome: boolean;
  opponentTeam: MatchTeam;
  dateTimeUtc: string; // ISO String
  venue: MatchVenue;
  broadcast: IsraeliBroadcastInfo;
  status: MatchStatus;
  liveClock?: string;
  liveScore?: {
    home: number;
    away: number;
    period?: string;
  };
  dataSource?: 'sportsdb_live' | 'espn_live' | 'search_grounded' | 'official_calendar';
  notes?: string;
  ticketUrl?: string;
  importanceLevel?: 'high' | 'medium' | 'derby' | 'championship' | 'standard';
}

export interface FilterOptions {
  search: string;
  sport: string;
  playerId: string;
  networkGroup: string;
  timeframe: 'all' | 'today' | 'tomorrow' | 'coming_7_days' | 'coming_14_days' | 'this_week' | 'upcoming' | 'past';
  sortBy: 'date_asc' | 'date_desc' | 'player_asc' | 'importance';
}

export interface BroadcastChannelGuide {
  id: string;
  name: string;
  hebrewName: string;
  group: NetworkGroup;
  hotNumber: string;
  yesNumber: string;
  partnerNumber: string;
  cellcomNumber: string;
  competitions: string[];
  color: string;
  freeToAir: boolean;
  logoUrl?: string;
}
