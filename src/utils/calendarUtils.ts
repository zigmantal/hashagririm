import { MatchFixture } from '../types';

export function getGoogleCalendarUrl(fixture: MatchFixture): string {
  const startDate = new Date(fixture.dateTimeUtc);
  const endDate = new Date(startDate.getTime() + (fixture.sport === 'basketball' ? 2.5 : 2) * 60 * 60 * 1000);

  const formatGCalTime = (d: Date) => {
    return d.toISOString().replace(/-|:|\.\d+/g, '');
  };

  const title = encodeURIComponent(`${fixture.homeTeam.name} vs ${fixture.awayTeam.name} (${fixture.playerName})`);
  const details = encodeURIComponent(
    `Match: ${fixture.homeTeam.name} vs ${fixture.awayTeam.name}\n` +
    `Featuring: ${fixture.playerName} (${fixture.playerTeam})\n` +
    `League: ${fixture.league} (${fixture.roundOrStage})\n` +
    `Israeli TV Broadcast: ${fixture.broadcast.channelName} (${fixture.broadcast.hebrewName})\n` +
    `HOT: Ch ${fixture.broadcast.channelNumberHot} | YES: Ch ${fixture.broadcast.channelNumberYes} | Partner: Ch ${fixture.broadcast.channelNumberPartner || '55'}\n` +
    `Venue: ${fixture.venue.name}, ${fixture.venue.city}\n` +
    `${fixture.notes || ''}`
  );
  const location = encodeURIComponent(`${fixture.venue.name}, ${fixture.venue.city}, ${fixture.venue.country}`);
  const dates = `${formatGCalTime(startDate)}/${formatGCalTime(endDate)}`;

  return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${dates}&details=${details}&location=${location}`;
}

export function downloadIcsFile(fixture: MatchFixture): void {
  const startDate = new Date(fixture.dateTimeUtc);
  const endDate = new Date(startDate.getTime() + 2 * 60 * 60 * 1000);

  const formatIcsTime = (d: Date) => {
    return d.toISOString().replace(/-|:|\.\d+/g, '').slice(0, 15) + 'Z';
  };

  const icsContent = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Athlete Broadcast Tracker//EN',
    'CALSCALE:GREGORIAN',
    'BEGIN:VEVENT',
    `UID:${fixture.id}@athletebroadcast.app`,
    `DTSTAMP:${formatIcsTime(new Date())}`,
    `DTSTART:${formatIcsTime(startDate)}`,
    `DTEND:${formatIcsTime(endDate)}`,
    `SUMMARY:${fixture.homeTeam.name} vs ${fixture.awayTeam.name} (${fixture.playerName})`,
    `DESCRIPTION:Watch ${fixture.playerName} in ${fixture.league}\\nBroadcast on Israeli TV: ${fixture.broadcast.channelName} (${fixture.broadcast.hebrewName})\\nHOT: ${fixture.broadcast.channelNumberHot} / YES: ${fixture.broadcast.channelNumberYes}\\nVenue: ${fixture.venue.name}`,
    `LOCATION:${fixture.venue.name}, ${fixture.venue.city}`,
    'STATUS:CONFIRMED',
    'END:VEVENT',
    'END:VCALENDAR'
  ].join('\r\n');

  const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
  const link = document.createElement('a');
  link.href = window.URL.createObjectURL(blob);
  link.setAttribute('download', `${fixture.playerName.replace(/\s+/g, '_')}_${fixture.opponentTeam.name}.ics`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
