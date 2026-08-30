import { Player, MatchFixture } from '../types';
import { formatIsraelDateTime } from '../utils/dateUtils';
import { getGoogleCalendarUrl } from '../utils/calendarUtils';
import { Calendar, MapPin, Tv, Clock, ExternalLink, Shield, Sparkles, LayoutList, LayoutGrid } from 'lucide-react';

interface DemoHeroCardProps {
  player: Player;
  nextFixture?: MatchFixture;
  onOpenChannelsGuide: () => void;
  viewMode: 'table' | 'grid';
  onViewModeChange: (mode: 'table' | 'grid') => void;
}

export function DemoHeroCard({
  player,
  nextFixture,
  onOpenChannelsGuide,
  viewMode,
  onViewModeChange,
}: DemoHeroCardProps) {
  const formatted = nextFixture ? formatIsraelDateTime(nextFixture.dateTimeUtc) : null;
  const initials = player.name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  return (
    <div className="bg-[#1E293B] border border-slate-700 rounded-2xl p-5 sm:p-7 mb-6 shadow-xl relative overflow-hidden">
      {/* Background Subtle Gradient */}
      <div 
        className="absolute -right-24 -top-24 w-80 h-80 rounded-full blur-3xl opacity-15 pointer-events-none"
        style={{ backgroundColor: player.teamColor || '#3B82F6' }}
      />

      <div className="relative z-10 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
        
        {/* Left: Athlete Profile & Monogram/Photo */}
        <div className="flex items-center gap-5 sm:gap-6">
          <div className="relative shrink-0">
            {player.photoUrl ? (
              <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl overflow-hidden bg-gradient-to-br from-blue-600 to-indigo-700 border-4 border-slate-700 shadow-xl flex items-center justify-center text-3xl sm:text-4xl font-black text-white">
                <img
                  src={player.photoUrl}
                  alt={player.name}
                  className="w-full h-full object-cover"
                  referrerPolicy="no-referrer"
                  onError={(e) => {
                    (e.target as HTMLElement).style.display = 'none';
                  }}
                />
                <span className="absolute inset-0 flex items-center justify-center -z-10">{initials}</span>
              </div>
            ) : (
              <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-700 flex items-center justify-center text-3xl sm:text-4xl font-bold border-4 border-slate-700 shadow-xl text-white">
                {initials}
              </div>
            )}
            {player.jerseyNumber && (
              <span className="absolute -bottom-2 -right-2 px-2 py-0.5 rounded-full bg-blue-600 text-white font-black text-xs border-2 border-slate-900 shadow">
                #{player.jerseyNumber}
              </span>
            )}
          </div>

          <div>
            <div className="flex items-center gap-2 mb-1.5 flex-wrap">
              <span className="bg-blue-500/20 text-blue-400 text-[10px] font-bold px-2 py-0.5 rounded border border-blue-500/30 uppercase tracking-wider">
                {player.active ? 'Active Athlete' : 'Roster Tracked'}
              </span>
              <span className="text-slate-400 text-xs sm:text-sm font-medium">
                {player.league} • {player.position}
              </span>
              {player.isDemo && (
                <span className="bg-amber-500/20 text-amber-300 text-[10px] font-bold px-2 py-0.5 rounded border border-amber-500/30 uppercase flex items-center gap-1">
                  <Sparkles className="w-3 h-3" />
                  Featured Demo
                </span>
              )}
            </div>

            <h2 className="text-2xl sm:text-4xl font-black tracking-tight text-white uppercase">
              {player.name}
              {player.nativeName && (
                <span className="text-base sm:text-lg font-bold text-slate-400 normal-case ml-2">
                  ({player.nativeName})
                </span>
              )}
            </h2>

            {nextFixture ? (
              <p className="text-slate-300 text-xs sm:text-sm mt-1 flex items-center gap-2 flex-wrap font-medium">
                <span className="text-blue-400 font-bold">Next:</span>
                <span>vs. {nextFixture.opponentTeam.name}</span>
                <span className="text-slate-500">•</span>
                <span className="text-amber-400">{formatted?.month} {formatted?.day}, {formatted?.timeStr} IDT</span>
                <span className="text-slate-500">•</span>
                <span className="text-slate-400">{nextFixture.broadcast.channelName}</span>
              </p>
            ) : (
              <p className="text-slate-400 text-xs sm:text-sm mt-1">
                {player.bio || `${player.name} plays for ${player.currentTeam}.`}
              </p>
            )}
          </div>
        </div>

        {/* Right: View Mode Toggle & Next Match Card */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 self-stretch lg:self-auto">
          {/* View Mode Toggle */}
          <div className="flex items-center gap-1 p-1 rounded-xl bg-slate-800/80 border border-slate-700">
            <button
              id="view-mode-table-btn"
              onClick={() => onViewModeChange('table')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                viewMode === 'table'
                  ? 'bg-blue-600 text-white shadow'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              title="Table View"
            >
              <LayoutList className="w-3.5 h-3.5" />
              <span>Table View</span>
            </button>
            <button
              id="view-mode-grid-btn"
              onClick={() => onViewModeChange('grid')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                viewMode === 'grid'
                  ? 'bg-blue-600 text-white shadow'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              title="Card Grid View"
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              <span>Card Grid</span>
            </button>
          </div>

          {/* Quick TV Guide Button */}
          <button
            onClick={onOpenChannelsGuide}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-semibold text-slate-200 hover:text-white transition cursor-pointer"
          >
            <Tv className="w-3.5 h-3.5 text-blue-400" />
            <span>Channel Matrix</span>
          </button>
        </div>

      </div>
    </div>
  );
}

