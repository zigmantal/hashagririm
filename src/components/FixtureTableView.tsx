import { useState, useMemo } from 'react';
import { MatchFixture } from '../types';
import { formatIsraelDateTime, formatHebrewDay } from '../utils/dateUtils';
import { getGoogleCalendarUrl, downloadIcsFile } from '../utils/calendarUtils';
import { Calendar, MapPin, Tv, Clock, Download, ChevronDown, ChevronUp } from 'lucide-react';

interface FixtureTableViewProps {
  fixtures: MatchFixture[];
  onOpenChannelsGuide: () => void;
}

interface DateGroup {
  dateKey: string;
  month: string;
  day: string;
  dayOfWeek: string;
  hebrewDay: string;
  isToday: boolean;
  isTomorrow: boolean;
  fixtures: MatchFixture[];
}

export function FixtureTableView({ fixtures, onOpenChannelsGuide }: FixtureTableViewProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const toggleExpand = (id: string) => {
    setExpandedId(prev => prev === id ? null : id);
  };

  // Group fixtures by Israeli Date
  const dateGroups = useMemo(() => {
    const groups: { [key: string]: DateGroup } = {};
    const today = new Date();
    const todayIso = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jerusalem' }).format(today);
    const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000);
    const tomorrowIso = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jerusalem' }).format(tomorrow);

    for (const fixture of fixtures) {
      const matchDate = new Date(fixture.dateTimeUtc);
      const isrDateKey = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jerusalem' }).format(matchDate);
      const formatted = formatIsraelDateTime(fixture.dateTimeUtc);

      if (!groups[isrDateKey]) {
        groups[isrDateKey] = {
          dateKey: isrDateKey,
          month: formatted.month,
          day: formatted.day,
          dayOfWeek: formatted.dayOfWeek,
          hebrewDay: formatHebrewDay(formatted.dayOfWeek),
          isToday: isrDateKey === todayIso,
          isTomorrow: isrDateKey === tomorrowIso,
          fixtures: [],
        };
      }
      groups[isrDateKey].fixtures.push(fixture);
    }

    return Object.values(groups).sort((a, b) => a.dateKey.localeCompare(b.dateKey));
  }, [fixtures]);

  if (fixtures.length === 0) {
    return (
      <div className="bg-[#1E293B] rounded-2xl border border-slate-700 p-8 text-center text-slate-400">
        <p className="text-sm font-semibold">No matches found for the selected filters.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3 sm:space-y-4">
      {dateGroups.map((group) => (
        <div
          key={group.dateKey}
          className="bg-[#1E293B] rounded-xl border border-slate-700/80 shadow-md overflow-hidden"
        >
          {/* Upper Date Header Row */}
          <div className="bg-slate-800/90 px-3 sm:px-4 py-2 border-b border-slate-700 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Calendar className="w-3.5 h-3.5 text-blue-400 shrink-0" />
              <span className="font-extrabold text-xs sm:text-sm text-white tracking-wide">
                {group.month} {group.day}
              </span>
              <span className="text-[11px] sm:text-xs text-slate-400 font-medium">
                • {group.dayOfWeek} ({group.hebrewDay})
              </span>
              {group.isToday && (
                <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  TODAY
                </span>
              )}
              {group.isTomorrow && (
                <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-blue-500/20 text-blue-300 border border-blue-500/30">
                  TOMORROW
                </span>
              )}
            </div>
            <span className="text-[11px] text-slate-400 font-medium">
              {group.fixtures.length} {group.fixtures.length === 1 ? 'match' : 'matches'}
            </span>
          </div>

          {/* Matches List: time | player & team | Vs team | channel */}
          <div className="divide-y divide-slate-700/60">
            {group.fixtures.map((fixture) => {
              const formatted = formatIsraelDateTime(fixture.dateTimeUtc);
              const isExpanded = expandedId === fixture.id;
              const isHome = fixture.homeTeam.name === fixture.playerTeam;
              const opponent = isHome ? fixture.awayTeam.name : fixture.homeTeam.name;

              const playerScore = isHome
                ? (fixture.liveScore?.home ?? fixture.homeTeam.score)
                : (fixture.liveScore?.away ?? fixture.awayTeam.score);
              const opponentScore = isHome
                ? (fixture.liveScore?.away ?? fixture.awayTeam.score)
                : (fixture.liveScore?.home ?? fixture.homeTeam.score);

              return (
                <div key={fixture.id} className="transition-colors hover:bg-slate-800/40">
                  {/* Compact Single Row */}
                  <div
                    onClick={() => toggleExpand(fixture.id)}
                    className="px-2.5 sm:px-4 py-2 sm:py-2.5 flex items-center justify-between gap-1.5 sm:gap-3 cursor-pointer text-xs select-none"
                  >
                    {/* 1. Time & Score Status */}
                    <div className="shrink-0 w-14 sm:w-16 font-mono font-bold text-slate-100 text-left">
                      <div className="flex items-center gap-1">
                        <Clock className="w-3 h-3 text-blue-400 hidden xs:inline shrink-0" />
                        <span>{formatted.timeStr}</span>
                      </div>
                      {fixture.status === 'live' ? (
                        <span className="inline-block text-[8px] font-black uppercase text-rose-400 animate-pulse">
                          {fixture.liveScore ? `${playerScore}-${opponentScore} • LIVE` : 'LIVE'}
                        </span>
                      ) : (fixture.liveScore || (fixture.homeTeam.score !== undefined && fixture.awayTeam.score !== undefined)) ? (
                        <span className="inline-block text-[8px] font-black uppercase text-emerald-400">
                          {playerScore}-{opponentScore} • FT
                        </span>
                      ) : null}
                    </div>

                    {/* Divider */}
                    <span className="text-slate-600 hidden xs:inline shrink-0">|</span>

                    {/* 2. Player & Team */}
                    <div className="flex-1 min-w-0 pr-1">
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-slate-100 truncate text-[11px] sm:text-xs">
                          {fixture.playerName}
                        </span>
                      </div>
                      <div className="text-[10px] sm:text-[11px] text-slate-400 truncate">
                        {fixture.playerTeam}
                      </div>
                    </div>

                    {/* Divider */}
                    <span className="text-slate-600 shrink-0">|</span>

                    {/* 3. Vs Team */}
                    <div className="flex-1 min-w-0 px-1">
                      <div className="flex items-center gap-1">
                        <span className="text-[10px] text-slate-500 font-semibold uppercase shrink-0">
                          {isHome ? 'vs' : '@'}
                        </span>
                        <span className="font-semibold text-slate-200 truncate text-[11px] sm:text-xs">
                          {opponent}
                        </span>
                      </div>
                      <div className="text-[10px] text-slate-400 truncate">
                        {fixture.league}
                      </div>
                    </div>

                    {/* Divider */}
                    <span className="text-slate-600 shrink-0">|</span>

                    {/* 4. Channel & Expand Arrow */}
                    <div className="shrink-0 flex items-center gap-1 sm:gap-2 justify-end">
                      <span
                        className="px-2 py-0.5 rounded-md text-[10px] sm:text-[11px] font-bold truncate max-w-[85px] sm:max-w-[120px] text-center border shadow-xs"
                        style={{
                          backgroundColor: `${fixture.broadcast.badgeBg}25`,
                          borderColor: `${fixture.broadcast.badgeBg}60`,
                          color: '#F8FAFC',
                        }}
                        title={fixture.broadcast.hebrewName}
                      >
                        {fixture.broadcast.channelName}
                      </span>

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleExpand(fixture.id);
                        }}
                        className="p-1 text-slate-400 hover:text-slate-200 transition"
                      >
                        {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>

                  {/* Expandable Details Section */}
                  {isExpanded && (
                    <div className="px-3 sm:px-4 py-2.5 bg-slate-900/80 border-t border-slate-800 text-xs text-slate-300 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5">
                      <div className="space-y-1 text-[11px] sm:text-xs">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-slate-200">Channel:</span>
                          <span className="text-blue-400 font-semibold">{fixture.broadcast.hebrewName}</span>
                          <span className="text-slate-400">({fixture.broadcast.networkGroup})</span>
                        </div>
                        <div className="text-slate-400 flex items-center gap-1.5 flex-wrap">
                          <span>Channel Numbers:</span>
                          <span className="text-slate-200 font-medium">
                            HOT {fixture.broadcast.channelNumberHot} • YES {fixture.broadcast.channelNumberYes} • Partner {fixture.broadcast.channelNumberPartner || fixture.broadcast.channelNumberHot} • Cellcom {fixture.broadcast.channelNumberCellcom || fixture.broadcast.channelNumberHot}
                          </span>
                        </div>
                        <div className="flex items-center gap-1 text-slate-400">
                          <MapPin className="w-3 h-3 text-rose-400 shrink-0" />
                          <span>Venue: {fixture.venue.name} ({fixture.venue.city})</span>
                        </div>
                      </div>

                      {/* Action buttons */}
                      <div className="flex items-center gap-2 shrink-0 self-end sm:self-center pt-1 sm:pt-0">
                        <a
                          href={getGoogleCalendarUrl(fixture)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs border border-slate-700 transition"
                        >
                          <Calendar className="w-3 h-3 text-blue-400" />
                          <span>Google Cal</span>
                        </a>

                        <button
                          onClick={() => downloadIcsFile(fixture)}
                          className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs border border-slate-700 transition cursor-pointer"
                        >
                          <Download className="w-3 h-3 text-emerald-400" />
                          <span>.ICS</span>
                        </button>

                        <button
                          onClick={onOpenChannelsGuide}
                          className="px-2.5 py-1 rounded-lg bg-blue-600/20 hover:bg-blue-600 text-blue-300 hover:text-white border border-blue-500/30 text-xs font-semibold transition cursor-pointer"
                        >
                          Guide
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

