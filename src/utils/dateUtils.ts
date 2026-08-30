export function formatIsraelDateTime(isoString: string): {
  dateStr: string;
  timeStr: string;
  dayOfWeek: string;
  month: string;
  day: string;
  fullStr: string;
  relativeCountdown: string;
} {
  const matchDate = new Date(isoString);
  const now = new Date();

  // Format in Israel Timezone (Asia/Jerusalem)
  const isrDateFormatter = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Jerusalem',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });

  const isrMonthFormatter = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Jerusalem',
    month: 'short',
  });

  const isrDayNumFormatter = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Jerusalem',
    day: '2-digit',
  });

  const isrDayFormatter = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Jerusalem',
    weekday: 'short',
  });

  const isrTimeFormatter = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Jerusalem',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });

  const dateStr = isrDateFormatter.format(matchDate);
  const month = isrMonthFormatter.format(matchDate).toUpperCase();
  const day = isrDayNumFormatter.format(matchDate);
  const dayOfWeek = isrDayFormatter.format(matchDate);
  const timeStr = isrTimeFormatter.format(matchDate);
  const fullStr = `${dayOfWeek}, ${dateStr} • ${timeStr} IDT`;

  // Calculate relative countdown
  const diffMs = matchDate.getTime() - now.getTime();
  let relativeCountdown = '';

  if (diffMs < 0 && diffMs > -3 * 60 * 60 * 1000) {
    relativeCountdown = 'LIVE NOW 🔴';
  } else if (diffMs < 0) {
    relativeCountdown = 'Finished';
  } else {
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffMinutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    const diffDays = Math.floor(diffHours / 24);

    if (diffDays > 1) {
      relativeCountdown = `In ${diffDays} days (${timeStr} IDT)`;
    } else if (diffDays === 1) {
      relativeCountdown = `Tomorrow at ${timeStr} IDT`;
    } else if (diffHours > 0) {
      relativeCountdown = `In ${diffHours}h ${diffMinutes}m`;
    } else {
      relativeCountdown = `In ${diffMinutes} mins`;
    }
  }

  return {
    dateStr,
    timeStr,
    dayOfWeek,
    month,
    day,
    fullStr,
    relativeCountdown,
  };
}

export function formatHebrewDay(dayOfWeek: string): string {
  const map: Record<string, string> = {
    Mon: 'שני',
    Tue: 'שלישי',
    Wed: 'רביעי',
    Thu: 'חמישי',
    Fri: 'שישי',
    Sat: 'שבת',
    Sun: 'ראשון',
  };
  return map[dayOfWeek] || dayOfWeek;
}
