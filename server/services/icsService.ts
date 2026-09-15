import { MatchFixture } from '../../src/types';

// ---------------------------------------------------------------------------
// .ics (RFC 5545) calendar feed generation
// ---------------------------------------------------------------------------
// Lets a person subscribe (webcal://) in Apple/Google/Outlook Calendar to a live-updating
// feed of tracked fixtures, instead of having to open the app to check kickoff time/channel.
// Calendar apps periodically re-fetch the URL, so this stays current automatically as long as
// the underlying fixtures/broadcast data does.

const SPORT_EMOJI: Record<string, string> = {
  football: '⚽',
  basketball: '🏀',
  tennis: '🎾',
  other: '🏆',
};

/** Escapes text per RFC 5545 §3.3.11 (backslash, semicolon, comma, then newlines). */
function escapeIcsText(text: string): string {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n');
}

/** Folds a content line to <=75 octets per RFC 5545 §3.1, as most strict parsers expect. */
function foldLine(line: string): string {
  const maxLen = 75;
  if (line.length <= maxLen) return line;
  let result = line.slice(0, maxLen);
  let rest = line.slice(maxLen);
  while (rest.length > 0) {
    const chunk = rest.slice(0, maxLen - 1); // continuation lines start with a leading space
    result += `\r\n ${chunk}`;
    rest = rest.slice(maxLen - 1);
  }
  return result;
}

function toIcsUtc(iso: string): string {
  const d = new Date(iso);
  return d.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
}

function buildEvent(fixture: MatchFixture, hostForUid: string): string {
  const emoji = SPORT_EMOJI[fixture.sport] || SPORT_EMOJI.other;
  const vsOrAt = fixture.isHome ? 'vs' : '@';
  const summary = `${emoji} ${fixture.playerName} (${fixture.playerTeam}) ${vsOrAt} ${fixture.opponentTeam.name}`;

  const start = new Date(fixture.dateTimeUtc);
  // Football/basketball/tennis broadcasts run long with pre/post-show coverage; block 2h30m
  // so the event doesn't look like it's "over" mid-match on a glanced-at calendar.
  const end = new Date(start.getTime() + 2.5 * 60 * 60 * 1000);

  const broadcastLine = fixture.broadcast.confirmed
    ? `Channel: ${fixture.broadcast.channelName} (${fixture.broadcast.hebrewName}) — Hot ${fixture.broadcast.channelNumberHot} / Yes ${fixture.broadcast.channelNumberYes}`
    : 'Channel: not yet confirmed (check the app closer to kickoff)';

  const descriptionLines = [
    `${fixture.league}${fixture.roundOrStage ? ` — ${fixture.roundOrStage}` : ''}`,
    broadcastLine,
    `${fixture.venue.name}, ${fixture.venue.city}`,
  ];
  if (fixture.notes) descriptionLines.push(fixture.notes);

  const lines = [
    'BEGIN:VEVENT',
    `UID:${fixture.id}@${hostForUid}`,
    `DTSTAMP:${toIcsUtc(new Date().toISOString())}`,
    `DTSTART:${toIcsUtc(fixture.dateTimeUtc)}`,
    `DTEND:${toIcsUtc(end.toISOString())}`,
    `SUMMARY:${escapeIcsText(summary)}`,
    `LOCATION:${escapeIcsText(`${fixture.venue.name}, ${fixture.venue.city}, ${fixture.venue.country}`)}`,
    `DESCRIPTION:${escapeIcsText(descriptionLines.join('\n'))}`,
    `STATUS:${fixture.status === 'postponed' ? 'TENTATIVE' : 'CONFIRMED'}`,
    // A 30-minute-before reminder is the whole point of a "never miss the broadcast" feed.
    'BEGIN:VALARM',
    'ACTION:DISPLAY',
    `DESCRIPTION:${escapeIcsText(summary)}`,
    'TRIGGER:-PT30M',
    'END:VALARM',
    'END:VEVENT',
  ];
  return lines.map(foldLine).join('\r\n');
}

/**
 * Builds a full .ics calendar body for the given fixtures.
 * `calendarName` becomes the subscribed calendar's display name in the person's calendar app.
 */
export function buildIcsCalendar(fixtures: MatchFixture[], calendarName: string, hostForUid: string): string {
  const relevant = fixtures.filter((f) => f.status !== 'finished');

  const header = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Hashagririm//TV Schedule//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${escapeIcsText(calendarName)}`,
    'X-WR-TIMEZONE:Asia/Jerusalem',
    // Most calendar apps re-poll a subscribed feed roughly this often; this is a hint, not a guarantee.
    'X-PUBLISHED-TTL:PT6H',
    'REFRESH-INTERVAL;VALUE=DURATION:PT6H',
  ].map(foldLine);

  const events = relevant.map((f) => buildEvent(f, hostForUid));

  return [...header, ...events, 'END:VCALENDAR'].join('\r\n') + '\r\n';
}
