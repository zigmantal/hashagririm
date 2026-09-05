import { IsraeliBroadcastInfo, NetworkGroup, BroadcastChannelGuide } from '../../src/types';

/**
 * Maps a Yes broadcast-schedule channel *title* (as returned by the Yes API / stored in the
 * Supabase `broadcast_channels` table, e.g. "Sport 5 HD (55)", "Sport 1 HD") onto our existing
 * ISRAELI_CHANNELS_GUIDE entries, so that once yesBroadcastService confirms a real fixture-to-
 * channel match we can still show the familiar HOT/YES/Partner/Cellcom numbers and badge colors.
 *
 * Keys are normalized (lowercased, parenthetical numbers stripped, punctuation collapsed).
 */
const YES_TITLE_TO_GUIDE_ID: Record<string, string> = {
  'sport 5 hd': 'sport5',
  'sport 5': 'sport5',
  'sport 5 live hd': 'sport5-live',
  'sport 5 live': 'sport5-live',
  'sport 5 stars hd': 'sport5-stars',
  'sport 5 stars': 'sport5-stars',
  'sport 5+ hd': 'sport5-plus',
  'sport 5 plus': 'sport5-plus',
  'sport 5 4k': 'sport5-4k',
  'sport 1 hd': 'sport1',
  'sport 1': 'sport1',
  'sport 2 hd': 'sport2',
  'sport 2': 'sport2',
  'sport 3 hd': 'sport3',
  'sport 3': 'sport3',
  'sport 4 hd': 'sport4',
  'sport 4': 'sport4',
  'one hd': 'one',
  'one': 'one',
  'one2 hd': 'one2',
  'one2': 'one2',
  'kan 11': 'kan11',
  'makan 33': 'kan11',
  'eurosport hd': 'eurosport1',
  'eurosport': 'eurosport1',
  'eurosport 1': 'eurosport1',
  'eurosport ip hd ssr sd': 'eurosport1', // confirmed real Yes title for PT39
};

function normalizeYesTitle(title: string): { key: string; parenNumber?: string } {
  const parenMatch = title.match(/\((\d+)\)/);
  const key = title
    .toLowerCase()
    .replace(/\(\d+\)/g, '')
    .replace(/[^a-z0-9+\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  return { key, parenNumber: parenMatch?.[1] };
}

/**
 * Looks up (or synthesizes) a BroadcastChannelGuide-shaped record for a given real Yes channel
 * title. Falls back to a generic "Sport 5 family" styled entry (using the channel's own
 * parenthetical number if present) for channels not in ISRAELI_CHANNELS_GUIDE yet, e.g.
 * "Sport 5 Gold (57)", "Eurosport 2", "Sport TOGO 1/2" — this way new Yes channels never
 * silently disappear, they just render with a best-effort generic style until someone adds
 * them explicitly to ISRAELI_CHANNELS_GUIDE above.
 */
export function findChannelGuideByYesTitle(yesTitle: string): BroadcastChannelGuide {
  const { key, parenNumber } = normalizeYesTitle(yesTitle);
  const guideId = YES_TITLE_TO_GUIDE_ID[key];
  const existing = guideId ? ISRAELI_CHANNELS_GUIDE.find((c) => c.id === guideId) : undefined;
  if (existing) {
    // Prefer the number embedded in the live Yes title when we have one (it's authoritative),
    // otherwise fall back to whatever's in the static guide.
    const num = parenNumber || existing.hotNumber;
    return { ...existing, hotNumber: num, yesNumber: num, partnerNumber: num, cellcomNumber: num };
  }

  // Generic fallback for channels not yet in the static guide
  const isEurosport = key.includes('eurosport');
  const isTogo = key.includes('togo');
  const num = parenNumber || '';
  return {
    id: `yes-${key.replace(/\s+/g, '-')}`,
    name: yesTitle,
    hebrewName: yesTitle,
    group: isEurosport ? 'EuroSport' : isTogo ? 'Streaming' : 'Sport 5',
    hotNumber: num,
    yesNumber: num,
    partnerNumber: num,
    cellcomNumber: num,
    competitions: [],
    color: isEurosport ? '#059669' : isTogo ? '#000000' : '#0055A5',
    freeToAir: false,
  };
}

/**
 * Builds a confirmed IsraeliBroadcastInfo from a real Yes broadcast-schedule match.
 */
export function buildConfirmedBroadcast(
  channelTitle: string,
  programTitle: string,
  programDescription?: string
): IsraeliBroadcastInfo {
  const guide = findChannelGuideByYesTitle(channelTitle);
  return {
    channelName: guide.name,
    hebrewName: guide.hebrewName,
    networkGroup: guide.group,
    channelNumberHot: guide.hotNumber,
    channelNumberYes: guide.yesNumber,
    channelNumberPartner: guide.partnerNumber,
    channelNumberCellcom: guide.cellcomNumber,
    badgeBg: guide.color,
    badgeTextColor: '#FFFFFF',
    borderColor: guide.color,
    isFreeToAir: guide.freeToAir,
    descriptionHebrew: programDescription,
    commentaryHebrew: true,
    confirmed: true,
    sourceProgramTitle: programTitle,
  };
}

/**
 * Broadcast placeholder for when no real Yes match was found. Per product decision, we do NOT
 * fall back to the old league-name-based guessing here — the channel is left explicitly blank
 * and the UI shows a "not yet confirmed" state instead of a possibly-wrong guess.
 */
export function buildUnconfirmedBroadcast(): IsraeliBroadcastInfo {
  return {
    channelName: '',
    hebrewName: '',
    networkGroup: 'TBD',
    channelNumberHot: '',
    channelNumberYes: '',
    channelNumberPartner: '',
    channelNumberCellcom: '',
    badgeBg: '#334155',
    badgeTextColor: '#94A3B8',
    borderColor: '#334155',
    isFreeToAir: false,
    confirmed: false,
  };
}

export const ISRAELI_CHANNELS_GUIDE: BroadcastChannelGuide[] = [
  {
    id: 'sport5',
    name: '5SPORT',
    hebrewName: 'ספורט 5',
    group: 'Sport 5',
    hotNumber: '55',
    yesNumber: '55',
    partnerNumber: '55',
    cellcomNumber: '55',
    competitions: ['UEFA Champions League', 'NBA', 'EuroLeague Basketball', 'Israeli Premier League', 'Ligue 1', 'Copa del Rey'],
    color: '#0055A5',
    freeToAir: false,
  },
  {
    id: 'sport5-stars',
    name: '5STARS',
    hebrewName: '5 כוכבים (5STARS)',
    group: 'Sport 5',
    hotNumber: '56',
    yesNumber: '56',
    partnerNumber: '56',
    cellcomNumber: '56',
    competitions: ['NBA Prime Matches', 'EuroLeague Live', 'Champions League Simulcast'],
    color: '#0B2046',
    freeToAir: false,
  },
  {
    id: 'sport5-live',
    name: '5LIVE',
    hebrewName: '5 לייב (5LIVE)',
    group: 'Sport 5',
    hotNumber: '58',
    yesNumber: '58',
    partnerNumber: '58',
    cellcomNumber: '58',
    competitions: ['NBA Late Night Live', 'EuroLeague Multicast', 'Israeli League Cup'],
    color: '#D90429',
    freeToAir: false,
  },
  {
    id: 'sport5-plus',
    name: '5PLUS',
    hebrewName: '5 פלוס (5PLUS)',
    group: 'Sport 5',
    hotNumber: '57',
    yesNumber: '57',
    partnerNumber: '57',
    cellcomNumber: '57',
    competitions: ['Ligue 1', 'Scottish Premiership', 'Handball', 'Motorsport'],
    color: '#1E3A8A',
    freeToAir: false,
  },
  {
    id: 'sport5-4k',
    name: '5SPORT 4K',
    hebrewName: '5 ספורט 4K',
    group: 'Sport 5',
    hotNumber: '555',
    yesNumber: '555',
    partnerNumber: '555',
    cellcomNumber: '555',
    competitions: ['Champions League Final', 'NBA Finals 4K', 'Selected Big Matches'],
    color: '#7C3AED',
    freeToAir: false,
  },
  {
    id: 'sport1',
    name: 'Sport 1 (Charlton)',
    hebrewName: 'ספורט 1 (צ\'רלטון)',
    group: 'Charlton (Sport 1-4)',
    hotNumber: '51',
    yesNumber: '51',
    partnerNumber: '51',
    cellcomNumber: '51',
    competitions: ['English Premier League', 'German Bundesliga', 'UEFA Europa League', 'UEFA Conference League', 'FA Cup'],
    color: '#E11D48',
    freeToAir: false,
  },
  {
    id: 'sport2',
    name: 'Sport 2 (Charlton)',
    hebrewName: 'ספורט 2 (צ\'רלטון)',
    group: 'Charlton (Sport 1-4)',
    hotNumber: '52',
    yesNumber: '52',
    partnerNumber: '52',
    cellcomNumber: '52',
    competitions: ['English Premier League Secondary', 'Bundesliga Big Games', 'EFL Championship'],
    color: '#BE123C',
    freeToAir: false,
  },
  {
    id: 'sport3',
    name: 'Sport 3 (Charlton)',
    hebrewName: 'ספורט 3 (צ\'רלטון)',
    group: 'Charlton (Sport 1-4)',
    hotNumber: '53',
    yesNumber: '53',
    partnerNumber: '53',
    cellcomNumber: '53',
    competitions: ['Belgian Pro League', 'Dutch Eredivisie', 'Portuguese Primeira Liga'],
    color: '#9F1239',
    freeToAir: false,
  },
  {
    id: 'sport4',
    name: 'Sport 4 (Charlton)',
    hebrewName: 'ספורט 4 (צ\'רלטון)',
    group: 'Charlton (Sport 1-4)',
    hotNumber: '54',
    yesNumber: '54',
    partnerNumber: '54',
    cellcomNumber: '54',
    competitions: ['Europa League Multi-feed', 'South American Football', 'Copa Libertadores'],
    color: '#881337',
    freeToAir: false,
  },
  {
    id: 'one',
    name: 'ONE HD',
    hebrewName: 'ערוץ ONE HD',
    group: 'ONE',
    hotNumber: '50',
    yesNumber: '50',
    partnerNumber: '50',
    cellcomNumber: '50',
    competitions: ['Spanish La Liga', 'Italian Serie A', 'EuroCup Basketball'],
    color: '#F59E0B',
    freeToAir: false,
  },
  {
    id: 'one2',
    name: 'ONE2 HD',
    hebrewName: 'ערוץ ONE2 HD',
    group: 'ONE',
    hotNumber: '66',
    yesNumber: '66',
    partnerNumber: '66',
    cellcomNumber: '66',
    competitions: ['Italian Serie A Live', 'La Liga 2', 'EuroCup Basketball Live'],
    color: '#D97706',
    freeToAir: false,
  },
  {
    id: 'kan11',
    name: 'Kan 11 (Makan 33)',
    hebrewName: 'כאן 11 / מכאן 33',
    group: 'Public (Kan 11)',
    hotNumber: '11',
    yesNumber: '11',
    partnerNumber: '11',
    cellcomNumber: '11',
    competitions: ['Israel National Team Fixtures', 'FIFA World Cup', 'UEFA Euro', 'Israeli State Cup Final'],
    color: '#0284C7',
    freeToAir: true,
  },
  {
    id: 'eurosport1',
    name: 'EuroSport 1',
    hebrewName: 'יורוספורט 1',
    group: 'EuroSport',
    hotNumber: '59',
    yesNumber: '59',
    partnerNumber: '59',
    cellcomNumber: '59',
    competitions: ['Grand Slam Tennis (Australian Open, Roland Garros)', 'Tour de France', 'Winter Olympics'],
    color: '#059669',
    freeToAir: false,
  }
];

export function resolveIsraeliBroadcast(
  league: string,
  sport: string,
  isSpecialMatch = false,
  customChannel?: string
): IsraeliBroadcastInfo {
  if (customChannel) {
    const matched = ISRAELI_CHANNELS_GUIDE.find(c => 
      c.name.toLowerCase().includes(customChannel.toLowerCase()) || 
      c.hebrewName.toLowerCase().includes(customChannel.toLowerCase())
    );
    if (matched) {
      return {
        channelName: matched.name,
        hebrewName: matched.hebrewName,
        networkGroup: matched.group,
        channelNumberHot: matched.hotNumber,
        channelNumberYes: matched.yesNumber,
        channelNumberPartner: matched.partnerNumber,
        channelNumberCellcom: matched.cellcomNumber,
        badgeBg: matched.color,
        badgeTextColor: '#FFFFFF',
        borderColor: matched.color,
        isFreeToAir: matched.freeToAir,
        streamingPlatform: `${matched.group} App`,
        commentaryHebrew: true,
        studioPreShow: 'שידור ישיר עם אולפן מקדים בעברית'
      };
    }
  }

  const leagueLower = (league || '').toLowerCase();
  const sportLower = (sport || '').toLowerCase();

  // NBA Basketball
  if (leagueLower.includes('nba') || sportLower === 'basketball' && (leagueLower.includes('trail blazers') || leagueLower.includes('warriors') || leagueLower.includes('mavericks'))) {
    return {
      channelName: isSpecialMatch ? '5STARS / 5SPORT' : '5SPORT / 5LIVE',
      hebrewName: 'ספורט 5 / 5LIVE (בלעדי בישראל)',
      networkGroup: 'Sport 5',
      channelNumberHot: '55 / 58',
      channelNumberYes: '55 / 58',
      channelNumberPartner: '55',
      channelNumberCellcom: '55',
      badgeBg: '#0055A5',
      badgeTextColor: '#FFFFFF',
      borderColor: '#0284C7',
      isFreeToAir: false,
      streamingPlatform: '5SPORT App & NBA League Pass',
      descriptionHebrew: 'שידור בלעדי של משחקי ה-NBA בערוצי ספורט 5 עם פרשנות בעברית',
      commentaryHebrew: true,
      studioPreShow: 'אולפן הלילה של ערוץ הספורט'
    };
  }

  // EuroLeague Basketball
  if (leagueLower.includes('euroleague') || leagueLower.includes('יורוליג')) {
    return {
      channelName: '5SPORT / 5STARS',
      hebrewName: 'ספורט 5 / 5STARS',
      networkGroup: 'Sport 5',
      channelNumberHot: '55',
      channelNumberYes: '55',
      channelNumberPartner: '55',
      channelNumberCellcom: '55',
      badgeBg: '#0055A5',
      badgeTextColor: '#FFFFFF',
      borderColor: '#3B82F6',
      isFreeToAir: false,
      streamingPlatform: '5SPORT Online & EuroLeague TV',
      commentaryHebrew: true,
      studioPreShow: 'אולפן היורוליג בשידור חי'
    };
  }

  // Belgian Pro League & Dutch Eredivisie & Portuguese Liga (Charlton)
  if (leagueLower.includes('belgian') || leagueLower.includes('jupiler') || leagueLower.includes('eredivisie') || leagueLower.includes('dutch') || leagueLower.includes('portuguese') || leagueLower.includes('primeira')) {
    return {
      channelName: 'Sport 2 / Sport 3',
      hebrewName: 'ספורט 2 / ספורט 3 (צ\'רלטון)',
      networkGroup: 'Charlton (Sport 1-4)',
      channelNumberHot: '52 / 53',
      channelNumberYes: '52 / 53',
      channelNumberPartner: '52 / 53',
      channelNumberCellcom: '52 / 53',
      badgeBg: '#E11D48',
      badgeTextColor: '#FFFFFF',
      borderColor: '#FB7185',
      isFreeToAir: false,
      streamingPlatform: 'Sport 1 Online (צ\'רלטון)',
      descriptionHebrew: 'שידור ישיר בערוצי ספורט 1-4 של צ\'רלטון',
      commentaryHebrew: true,
      studioPreShow: 'שידור ישיר עם פרשנות בעברית'
    };
  }

  // MLS (Major League Soccer - USA)
  if (leagueLower.includes('mls') || leagueLower.includes('major league soccer') || leagueLower.includes('leagues cup')) {
    return {
      channelName: 'Apple TV (MLS Pass) / 5SPORT',
      hebrewName: 'אפל TV (כרטיס עונתי) / ספורט 5',
      networkGroup: 'Streaming',
      channelNumberHot: '55',
      channelNumberYes: '55',
      channelNumberPartner: '55',
      channelNumberCellcom: '55',
      badgeBg: '#000000',
      badgeTextColor: '#38BDF8',
      borderColor: '#0284C7',
      isFreeToAir: false,
      streamingPlatform: 'Apple TV App (MLS Season Pass)',
      descriptionHebrew: 'שידור בלעדי ב-Apple TV עם משחקים נבחרים בערוץ הספורט 5',
      commentaryHebrew: true,
      studioPreShow: 'MLS Matchday Live'
    };
  }

  // Israeli Premier League (Ligat Ha'Al) & State Cup
  if (leagueLower.includes('israeli premier') || leagueLower.includes('ligat') || leagueLower.includes('ליגת העל') || leagueLower.includes('גביע המדינה') || leagueLower.includes('winner league') || leagueLower.includes('טוטו')) {
    const isBigMatch = isSpecialMatch || leagueLower.includes('עיר') || leagueLower.includes('גמר') || leagueLower.includes('משחק העונה');
    return {
      channelName: isBigMatch ? '5SPORT 4K / 5SPORT' : '5LIVE / 5STARS',
      hebrewName: 'ערוץ הספורט (5SPORT / 5LIVE)',
      networkGroup: 'Sport 5',
      channelNumberHot: '55 / 58',
      channelNumberYes: '55 / 58',
      channelNumberPartner: '55',
      channelNumberCellcom: '55',
      badgeBg: '#0055A5',
      badgeTextColor: '#FFFFFF',
      borderColor: '#38BDF8',
      isFreeToAir: false,
      streamingPlatform: '5SPORT 4K / 5SPORT App',
      descriptionHebrew: 'המשחק המרכזי וכל שידורי ליגת העל בכדורגל בערוצי ספורט 5',
      commentaryHebrew: true,
      studioPreShow: 'אולפן שער השבת והמשחק המרכזי'
    };
  }

  // EuroCup Basketball
  if (leagueLower.includes('eurocup') || leagueLower.includes('יורוקאפ')) {
    return {
      channelName: 'ONE2 / ONE HD',
      hebrewName: 'ערוץ ONE2 / ONE HD',
      networkGroup: 'ONE',
      channelNumberHot: '66 / 50',
      channelNumberYes: '66 / 50',
      channelNumberPartner: '66 / 50',
      channelNumberCellcom: '66 / 50',
      badgeBg: '#D97706',
      badgeTextColor: '#FFFFFF',
      borderColor: '#F59E0B',
      isFreeToAir: false,
      streamingPlatform: 'ONE+ App',
      descriptionHebrew: 'שידורי היורוקאפ בערוצי ONE ו-ONE2',
      commentaryHebrew: true,
      studioPreShow: 'אולפן היורוקאפ'
    };
  }

  // Tennis (ATP Tour / Grand Slams / Wimbledon)
  if (sportLower === 'tennis' || leagueLower.includes('tennis') || leagueLower.includes('wimbledon') || leagueLower.includes('atp') || leagueLower.includes('wta') || leagueLower.includes('grand slam')) {
    if (leagueLower.includes('wimbledon') || leagueLower.includes('ווימבלדון')) {
      return {
        channelName: 'Sport 1 / Sport 2',
        hebrewName: 'ספורט 1 / ספורט 2 (צ\'רלטון)',
        networkGroup: 'Charlton (Sport 1-4)',
        channelNumberHot: '51 / 52',
        channelNumberYes: '51 / 52',
        channelNumberPartner: '51 / 52',
        channelNumberCellcom: '51 / 52',
        badgeBg: '#059669',
        badgeTextColor: '#FFFFFF',
        borderColor: '#10B981',
        isFreeToAir: false,
        streamingPlatform: 'Sport 1 Online',
        descriptionHebrew: 'טורניר ווימבלדון בשידור חי בלעדי בצ\'רלטון',
        commentaryHebrew: true,
      };
    }
    return {
      channelName: 'EuroSport 1 / 2',
      hebrewName: 'יורוספורט 1 / 2 (ערוץ 59)',
      networkGroup: 'EuroSport',
      channelNumberHot: '59',
      channelNumberYes: '59',
      channelNumberPartner: '59',
      channelNumberCellcom: '59',
      badgeBg: '#059669',
      badgeTextColor: '#FFFFFF',
      borderColor: '#34D399',
      isFreeToAir: false,
      streamingPlatform: 'EuroSport Player / Discovery+',
      descriptionHebrew: 'גראנד סלאם וסבב הטניס העולמי ביורוספורט',
      commentaryHebrew: true,
      studioPreShow: 'שידור ישיר סביב השעון'
    };
  }

  // Saudi Pro League
  if (leagueLower.includes('saudi') || leagueLower.includes('al-nassr') || leagueLower.includes('al-hilal') || leagueLower.includes('סעודית')) {
    return {
      channelName: 'Sport 1 / Sport 2',
      hebrewName: 'ספורט 1 / 2 (צ\'רלטון)',
      networkGroup: 'Charlton (Sport 1-4)',
      channelNumberHot: '51 / 52',
      channelNumberYes: '51 / 52',
      channelNumberPartner: '51 / 52',
      channelNumberCellcom: '51 / 52',
      badgeBg: '#BE123C',
      badgeTextColor: '#FFFFFF',
      borderColor: '#E11D48',
      isFreeToAir: false,
      streamingPlatform: 'Sport 1 Online',
      commentaryHebrew: true,
    };
  }

  // French Ligue 1
  if (leagueLower.includes('ligue 1') || leagueLower.includes('צרפתית') || leagueLower.includes('psg') || leagueLower.includes('monaco')) {
    return {
      channelName: '5SPORT / 5PLUS',
      hebrewName: 'ספורט 5 / 5 פלוס',
      networkGroup: 'Sport 5',
      channelNumberHot: '55 / 57',
      channelNumberYes: '55 / 57',
      channelNumberPartner: '55',
      channelNumberCellcom: '55',
      badgeBg: '#0055A5',
      badgeTextColor: '#FFFFFF',
      borderColor: '#0284C7',
      isFreeToAir: false,
      streamingPlatform: '5SPORT App',
      commentaryHebrew: true,
    };
  }

  // Premier League (EPL) & EFL Championship
  if (leagueLower.includes('premier league') || leagueLower.includes('championship') || leagueLower.includes('פרמייר ליג') || leagueLower.includes('epl') || leagueLower.includes('fa cup')) {
    const isMainMatch = isSpecialMatch || leagueLower.includes('premier league');
    return {
      channelName: isMainMatch ? 'Sport 1 HD' : 'Sport 2 HD',
      hebrewName: isMainMatch ? 'ספורט 1 (צ\'רלטון)' : 'ספורט 2 (צ\'רלטון)',
      networkGroup: 'Charlton (Sport 1-4)',
      channelNumberHot: isMainMatch ? '51' : '52',
      channelNumberYes: isMainMatch ? '51' : '52',
      channelNumberPartner: isMainMatch ? '51' : '52',
      channelNumberCellcom: isMainMatch ? '51' : '52',
      badgeBg: '#E11D48',
      badgeTextColor: '#FFFFFF',
      borderColor: '#F43F5E',
      isFreeToAir: false,
      streamingPlatform: 'Sport 1 Online (צ\'רלטון)',
      descriptionHebrew: 'שידור ישיר בלעדי בצ\'רלטון עם צוות השידור הבכיר',
      commentaryHebrew: true,
      studioPreShow: 'אולפן הפרמיירליג החי'
    };
  }

  // UEFA Champions League
  if (leagueLower.includes('champions league') || leagueLower.includes('אלופות') || leagueLower.includes('ucl')) {
    return {
      channelName: '5SPORT / 5STARS',
      hebrewName: 'ספורט 5 / 5 כוכבים',
      networkGroup: 'Sport 5',
      channelNumberHot: '55 / 56',
      channelNumberYes: '55 / 56',
      channelNumberPartner: '55',
      channelNumberCellcom: '55',
      badgeBg: '#1E1B4B',
      badgeTextColor: '#38BDF8',
      borderColor: '#6366F1',
      isFreeToAir: false,
      streamingPlatform: '5SPORT App & 4K',
      descriptionHebrew: 'ליגת האלופות בשידור ישיר וחגיגת שידורים בערוץ הספורט',
      commentaryHebrew: true,
      studioPreShow: 'אולפן ליגת האלופות המרכזי'
    };
  }

  // UEFA Europa League / Conference League
  if (leagueLower.includes('europa') || leagueLower.includes('conference') || leagueLower.includes('אירופית')) {
    return {
      channelName: 'Sport 1 / Sport 2',
      hebrewName: 'ספורט 1 / ספורט 2',
      networkGroup: 'Charlton (Sport 1-4)',
      channelNumberHot: '51 / 52',
      channelNumberYes: '51 / 52',
      channelNumberPartner: '51',
      channelNumberCellcom: '51',
      badgeBg: '#E11D48',
      badgeTextColor: '#FFFFFF',
      borderColor: '#FB7185',
      isFreeToAir: false,
      streamingPlatform: 'Sport 1 Online',
      commentaryHebrew: true,
    };
  }

  // Spanish La Liga
  if (leagueLower.includes('la liga') || leagueLower.includes('ספרדית') || leagueLower.includes('laliga')) {
    return {
      channelName: 'ONE HD / ONE2',
      hebrewName: 'ערוץ ONE HD (אפיק 50)',
      networkGroup: 'ONE',
      channelNumberHot: '50 / 66',
      channelNumberYes: '50 / 66',
      channelNumberPartner: '50',
      channelNumberCellcom: '50',
      badgeBg: '#D97706',
      badgeTextColor: '#FFFFFF',
      borderColor: '#FBBF24',
      isFreeToAir: false,
      streamingPlatform: 'ONE+ App',
      descriptionHebrew: 'הליגה הספרדית בשידור חי בערוץ ONE',
      commentaryHebrew: true,
      studioPreShow: 'אולפן הליגה הספרדית ב-ONE'
    };
  }

  // German Bundesliga
  if (leagueLower.includes('bundesliga') || leagueLower.includes('בונדסליגה') || leagueLower.includes('austrian')) {
    return {
      channelName: 'Sport 2 / Sport 3',
      hebrewName: 'ספורט 2 / 3 (צ\'רלטון)',
      networkGroup: 'Charlton (Sport 1-4)',
      channelNumberHot: '52 / 53',
      channelNumberYes: '52 / 53',
      channelNumberPartner: '52',
      channelNumberCellcom: '52',
      badgeBg: '#BE123C',
      badgeTextColor: '#FFFFFF',
      borderColor: '#E11D48',
      isFreeToAir: false,
      streamingPlatform: 'Sport 1 Online',
      commentaryHebrew: true,
    };
  }

  // Italian Serie A
  if (leagueLower.includes('serie a') || leagueLower.includes('איטלקית')) {
    return {
      channelName: 'ONE2 / Sport 1',
      hebrewName: 'ערוץ ONE2 / ספורט 1',
      networkGroup: 'ONE',
      channelNumberHot: '66 / 51',
      channelNumberYes: '66 / 51',
      channelNumberPartner: '66',
      channelNumberCellcom: '66',
      badgeBg: '#D97706',
      badgeTextColor: '#FFFFFF',
      borderColor: '#F59E0B',
      isFreeToAir: false,
      streamingPlatform: 'ONE+ App',
      commentaryHebrew: true,
    };
  }

  // National Team / Major Tournaments
  if (leagueLower.includes('israel') || leagueLower.includes('national') || leagueLower.includes('nations league') || leagueLower.includes('euro 20') || leagueLower.includes('world cup')) {
    return {
      channelName: 'Kan 11 (Free to Air)',
      hebrewName: 'כאן 11 (פתוח לכולם חינם)',
      networkGroup: 'Public (Kan 11)',
      channelNumberHot: '11',
      channelNumberYes: '11',
      channelNumberPartner: '11',
      channelNumberCellcom: '11',
      badgeBg: '#0284C7',
      badgeTextColor: '#FFFFFF',
      borderColor: '#38BDF8',
      isFreeToAir: true,
      streamingPlatform: 'Kan Box / Kan 11 Web & App',
      descriptionHebrew: 'שידור ציבורי פתוח בחינם באיכות HD באתר וביישומון כאן',
      commentaryHebrew: true,
      studioPreShow: 'אולפן הנבחרת הממלכתי'
    };
  }

  // Default fallback to Sport 5
  return {
    channelName: 'Sport 5 / 5PLUS',
    hebrewName: 'ערוץ הספורט (5SPORT)',
    networkGroup: 'Sport 5',
    channelNumberHot: '55',
    channelNumberYes: '55',
    channelNumberPartner: '55',
    channelNumberCellcom: '55',
    badgeBg: '#0055A5',
    badgeTextColor: '#FFFFFF',
    borderColor: '#3B82F6',
    isFreeToAir: false,
    streamingPlatform: '5SPORT App',
    commentaryHebrew: true,
  };
}
