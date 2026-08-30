import { useState } from 'react';
import { MatchFixture } from '../types';
import { formatIsraelDateTime, formatHebrewDay } from '../utils/dateUtils';
import { getGoogleCalendarUrl, downloadIcsFile } from '../utils/calendarUtils';
import { Calendar, MapPin, Tv, Clock, Download, ChevronDown, ChevronUp, Info, Radio } from 'lucide-react';

interface FixtureCardProps {
  key?: string;
  fixture: MatchFixture;
  onOpenChannelsGuide: () => void;
}

export function FixtureCard({ fixture, onOpenChannelsGuide }: FixtureCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const formatted = formatIsraelDateTime(fixture.dateTimeUtc);

  const isHighImportance =
    fixture.importanceLevel === 'high' ||
    fixture.importanceLevel === 'derby' ||
    fixture.importanceLevel === 'championship';

  return (
    <div
      id={`fixture-card-${fixture.id}`}
      className="group relative bg-[#1E293B] hover:bg-[#233044] border border-slate-700/80 hover:border-slate-600 rounded-2xl p-3.5 sm:p-4 transition-all duration-200 shadow-lg flex flex-col justify-between"
    >
      {/* Top Meta Bar */}
      <div>
        <div className="flex items-center justify-between gap-2 mb-2 sm:mb-3">
          {/* Player Badge */}
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-full overflow-hidden bg-slate-700 ring-1 ring-slate-600 shrink-0">
              <img
                src={fixture.playerPhoto}
                alt={fixture.playerName}
                className="w-full h-full object-cover"
                referrerPolicy="no-referrer"
              />
            </div>
            <div>
              <span className="text-xs font-bold text-slate-100">
                {fixture.playerName}
              </span>
              <span className="text-[11px] text-slate-400 ml-1">
                ({fixture.playerTeam})
              </span>
            </div>
          </div>

          {/* Competition & Live Source Badge */}
          <div className="flex items-center gap-1.5 flex-wrap justify-end">
            {fixture.status === 'live' ? (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-rose-600 text-white flex items-center gap-1 animate-pulse">
                <span className="w-1.5 h-1.5 rounded-full bg-white"></span>
                LIVE {fixture.liveClock ? `• ${fixture.liveClock}` : ''}
              </span>
            ) : fixture.dataSource === 'espn_live' ? (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30 flex items-center gap-1" title="Synchronized with ESPN official sports calendar">
                <span>⚡</span> ESPN Live
              </span>
            ) : fixture.dataSource === 'search_grounded' ? (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 flex items-center gap-1" title="Verified via Real-Time Web Grounding">
                <span>🌐</span> Live Verified
              </span>
            ) : null}

            {isHighImportance && fixture.status !== 'live' && (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-rose-500/20 text-rose-300 border border-rose-500/30">
                {fixture.importanceLevel === 'derby' ? '🔥 DERBY' : '★ PRIME'}
              </span>
            )}
            <span className="px-2 py-0.5 rounded-md text-[11px] font-semibold bg-slate-800 text-slate-300 border border-slate-700">
              {fixture.league}
            </span>
          </div>
        </div>

        {/* Matchup Banner */}
        <div className="bg-slate-900/90 rounded-xl p-3.5 border border-slate-700/80 my-2 shadow-inner">
          <div className="grid grid-cols-7 items-center gap-2">
            
            {/* Home Team */}
            <div className="col-span-3 flex items-center gap-2.5">
              <img
                src={fixture.homeTeam.logo}
                alt={fixture.homeTeam.name}
                className="w-8 h-8 sm:w-9 sm:h-9 object-contain shrink-0"
                onError={(e) => { (e.target as HTMLElement).style.display = 'none'; }}
              />
              <div className="min-w-0">
                <div className={`text-xs sm:text-sm font-extrabold truncate ${fixture.homeTeam.name === fixture.playerTeam ? 'text-blue-400' : 'text-slate-200'}`}>
                  {fixture.homeTeam.name}
                </div>
                <div className="text-[10px] font-medium text-slate-400">
                  Home
                </div>
              </div>
            </div>

            {/* VS / Score / Time Badge */}
            <div className="col-span-1 text-center flex flex-col items-center justify-center">
              {fixture.liveScore || (fixture.homeTeam.score !== undefined && fixture.awayTeam.score !== undefined) ? (
                <div className="flex flex-col items-center">
                  <span className={`px-2 py-0.5 rounded-md font-mono font-black text-xs border ${fixture.status === 'live' ? 'bg-rose-950 text-rose-300 border-rose-700 animate-pulse' : 'bg-slate-800 text-slate-200 border-slate-700'}`}>
                    {fixture.liveScore?.home ?? fixture.homeTeam.score} - {fixture.liveScore?.away ?? fixture.awayTeam.score}
                  </span>
                  {fixture.status === 'live' ? (
                    <span className="text-[9px] text-rose-400 mt-0.5 font-bold whitespace-nowrap">
                      {fixture.liveScore?.period || fixture.liveClock || 'LIVE'}
                    </span>
                  ) : fixture.status === 'finished' ? (
                    <span className="text-[9px] text-slate-400 mt-0.5 font-bold whitespace-nowrap">
                      FINAL • {formatted.timeStr} IDT
                    </span>
                  ) : (
                    <span className="text-[9px] text-slate-400 mt-0.5 font-medium whitespace-nowrap">
                      {formatted.timeStr} IDT
                    </span>
                  )}
                </div>
              ) : (
                <>
                  <span className="px-2 py-1 rounded-md bg-slate-800 text-slate-300 font-mono font-black text-xs border border-slate-700">
                    {fixture.status === 'finished' ? 'FT' : 'VS'}
                  </span>
                  <span className="text-[10px] text-slate-400 mt-1 font-medium whitespace-nowrap">
                    {fixture.status === 'finished' ? `FINAL • ${formatted.timeStr} IDT` : `${formatted.timeStr} IDT`}
                  </span>
                </>
              )}
            </div>

            {/* Away Team */}
            <div className="col-span-3 flex items-center justify-end gap-2.5 text-right">
              <div className="min-w-0">
                <div className={`text-xs sm:text-sm font-extrabold truncate ${fixture.awayTeam.name === fixture.playerTeam ? 'text-blue-400' : 'text-slate-200'}`}>
                  {fixture.awayTeam.name}
                </div>
                <div className="text-[10px] font-medium text-slate-400">
                  Away
                </div>
              </div>
              <img
                src={fixture.awayTeam.logo}
                alt={fixture.awayTeam.name}
                className="w-8 h-8 sm:w-9 sm:h-9 object-contain shrink-0"
                onError={(e) => { (e.target as HTMLElement).style.display = 'none'; }}
              />
            </div>

          </div>
        </div>

        {/* Date, Venue & Countdown */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 text-xs text-slate-400 my-3">
          <div className="flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5 text-blue-400 shrink-0" />
            <span className="font-bold text-slate-200">{formatted.fullStr}</span>
            <span className="text-slate-400">({formatHebrewDay(formatted.dayOfWeek)})</span>
          </div>

          <div className="flex items-center gap-1.5 text-amber-400 font-medium">
            <Clock className="w-3.5 h-3.5 shrink-0" />
            <span>{formatted.relativeCountdown}</span>
          </div>
        </div>

        <div className="flex items-center gap-1.5 text-xs text-slate-400 mb-3">
          <MapPin className="w-3.5 h-3.5 text-rose-400 shrink-0" />
          <span className="truncate">
            {fixture.venue.name}, {fixture.venue.city}, {fixture.venue.country}
          </span>
        </div>
      </div>

      {/* Israeli TV Broadcasting Banner */}
      <div className="pt-2 border-t border-slate-700/80">
        <div className="rounded-xl p-3 bg-slate-900 border border-slate-700/80 shadow-inner">
          <div className="flex items-center justify-between gap-2 mb-1.5">
            <div className="flex items-center gap-2 flex-wrap">
              <span 
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-black text-white shadow"
                style={{ backgroundColor: fixture.broadcast.badgeBg }}
              >
                <Tv className="w-3.5 h-3.5" />
                <span>{fixture.broadcast.channelName}</span>
              </span>
              <span className="text-xs font-bold text-slate-200">
                {fixture.broadcast.hebrewName}
              </span>
            </div>

            {fixture.broadcast.isFreeToAir && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                Free to Air
              </span>
            )}
          </div>

          {/* Israeli Provider Channel Numbers */}
          <div className="flex items-center gap-3 text-[11px] text-slate-400 flex-wrap mt-2 pt-1.5 border-t border-slate-800">
            <span className="font-semibold text-slate-300">Channels:</span>
            <span>HOT: <strong className="text-slate-200">{fixture.broadcast.channelNumberHot}</strong></span>
            <span>•</span>
            <span>YES: <strong className="text-slate-200">{fixture.broadcast.channelNumberYes}</strong></span>
            <span>•</span>
            <span>Partner: <strong className="text-slate-200">{fixture.broadcast.channelNumberPartner || fixture.broadcast.channelNumberHot}</strong></span>
            <span>•</span>
            <span>Cellcom: <strong className="text-slate-200">{fixture.broadcast.channelNumberCellcom || fixture.broadcast.channelNumberHot}</strong></span>
          </div>

          {fixture.broadcast.descriptionHebrew && (
            <div className="text-[11px] text-slate-400 mt-1.5 italic">
              {fixture.broadcast.descriptionHebrew}
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between gap-2 mt-3 pt-1">
          <div className="flex items-center gap-2">
            <a
              id={`add-gcal-${fixture.id}`}
              href={getGoogleCalendarUrl(fixture)}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white text-xs font-semibold border border-slate-700 transition"
              title="Add to Google Calendar"
            >
              <Calendar className="w-3.5 h-3.5 text-blue-400" />
              <span>Google Cal</span>
            </a>

            <button
              id={`download-ics-${fixture.id}`}
              onClick={() => downloadIcsFile(fixture)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white text-xs font-semibold border border-slate-700 transition cursor-pointer"
              title="Download iCal (.ics) file for Apple/Outlook"
            >
              <Download className="w-3.5 h-3.5 text-emerald-400" />
              <span>iCal (.ics)</span>
            </button>
          </div>

          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="flex items-center gap-1 text-xs text-slate-400 hover:text-slate-200 transition cursor-pointer"
          >
            <span>{isExpanded ? 'Less' : 'Details'}</span>
            {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
        </div>

        {/* Expanded Details */}
        {isExpanded && (
          <div className="mt-3 pt-3 border-t border-slate-800 text-xs text-slate-300 space-y-2 bg-slate-900/90 p-3 rounded-xl">
            <div className="flex items-start gap-2">
              <Info className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-slate-200 mb-0.5">Broadcast & Match Notes:</p>
                <p className="text-slate-400">{fixture.notes || 'Official league broadcast schedule confirmed.'}</p>
              </div>
            </div>
            {fixture.broadcast.studioPreShow && (
              <div className="text-slate-400 flex items-center gap-1.5">
                <Radio className="w-3.5 h-3.5 text-amber-400" />
                <span>{fixture.broadcast.studioPreShow}</span>
              </div>
            )}
            <div className="text-slate-500 text-[10px] pt-1">
              * Broadcast schedule subject to Israeli television broadcaster guide updates.
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

