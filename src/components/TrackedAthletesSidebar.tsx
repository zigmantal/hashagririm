import { Player } from '../types';
import { UserPlus, Activity, Tv, Sparkles, CheckCircle2, ChevronRight } from 'lucide-react';

interface TrackedAthletesSidebarProps {
  players: Player[];
  selectedPlayerId: string;
  onSelectPlayer: (id: string) => void;
  onOpenAdmin: () => void;
  onOpenChannelsGuide: () => void;
}

export function TrackedAthletesSidebar({
  players,
  selectedPlayerId,
  onSelectPlayer,
  onOpenAdmin,
  onOpenChannelsGuide,
}: TrackedAthletesSidebarProps) {
  const activePlayers = players.filter((p) => p.active);

  return (
    <aside className="w-72 lg:w-80 bg-[#1E293B]/50 border-r border-slate-700 flex flex-col shrink-0 h-full overflow-y-auto">
      {/* Top Header */}
      <div className="p-4 border-b border-slate-700/80">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
            Tracked Athletes
          </h2>
          <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 border border-slate-700">
            {activePlayers.length} Active
          </span>
        </div>

        {/* Quick Add Button */}
        <button
          onClick={onOpenAdmin}
          className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-semibold text-slate-200 hover:text-white transition cursor-pointer"
        >
          <UserPlus className="w-3.5 h-3.5 text-blue-400" />
          <span>+ Add / Manage Athletes</span>
        </button>
      </div>

      {/* Athletes List */}
      <div className="p-3 space-y-2 flex-1 overflow-y-auto">
        {/* All Athletes Option */}
        <div
          onClick={() => onSelectPlayer('all')}
          className={`flex items-center justify-between p-2.5 rounded-xl cursor-pointer transition ${
            selectedPlayerId === 'all'
              ? 'bg-blue-600/20 border-l-4 border-blue-500 text-white shadow-sm'
              : 'hover:bg-slate-800/80 text-slate-300 border-l-4 border-transparent'
          }`}
        >
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm shrink-0 ${
              selectedPlayerId === 'all' ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-400'
            }`}>
              <Activity className="w-5 h-5" />
            </div>
            <div>
              <p className="text-sm font-bold">All Athletes</p>
              <p className="text-[10px] text-slate-400">Combined Match Schedule</p>
            </div>
          </div>
          <ChevronRight className="w-4 h-4 text-slate-500" />
        </div>

        {/* Individual Athletes */}
        {activePlayers.map((player) => {
          const isSelected = selectedPlayerId === player.id;
          const initials = player.name
            .split(' ')
            .map((n) => n[0])
            .join('')
            .toUpperCase()
            .slice(0, 2);

          return (
            <div
              key={player.id}
              onClick={() => onSelectPlayer(player.id)}
              className={`flex items-center justify-between p-2.5 rounded-xl cursor-pointer transition ${
                isSelected
                  ? 'bg-blue-600/20 border-l-4 border-blue-500 text-white shadow-sm'
                  : 'hover:bg-slate-800/80 text-slate-300 border-l-4 border-transparent'
              }`}
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="relative w-10 h-10 rounded-full overflow-hidden bg-slate-700 ring-1 ring-slate-600 shrink-0">
                  <img
                    src={player.photoUrl}
                    alt={player.name}
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                    onError={(e) => {
                      (e.target as HTMLElement).style.display = 'none';
                    }}
                  />
                  <div className="absolute inset-0 flex items-center justify-center text-xs font-bold text-slate-300 bg-slate-800 -z-10">
                    {initials}
                  </div>
                </div>

                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <p className="text-sm font-bold text-slate-100 truncate">{player.name}</p>
                    {player.isDemo && (
                      <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30 shrink-0">
                        DEMO
                      </span>
                    )}
                  </div>
                  <p className="text-[10px] text-slate-400 truncate italic">
                    <span className="capitalize">{player.sport}</span> • {player.currentTeam}
                  </p>
                </div>
              </div>

              <ChevronRight className={`w-4 h-4 shrink-0 ${isSelected ? 'text-blue-400' : 'text-slate-600'}`} />
            </div>
          );
        })}
      </div>

      {/* Bottom Local Israeli TV Guide Card */}
      <div className="mt-auto p-4 bg-blue-900/10 border-t border-slate-700/80">
        <div 
          onClick={onOpenChannelsGuide}
          className="border border-blue-500/30 rounded-xl p-3.5 text-center bg-slate-900/60 hover:bg-slate-900 hover:border-blue-500/60 transition cursor-pointer"
        >
          <div className="flex items-center justify-center gap-1.5 text-xs text-blue-300 font-bold mb-2">
            <Tv className="w-3.5 h-3.5 text-blue-400" />
            <span>Local Israeli TV Guide</span>
          </div>
          <div className="flex justify-center gap-1.5 flex-wrap">
            <div className="text-[10px] font-bold bg-slate-800 text-slate-300 px-2 py-1 rounded border border-slate-700">Sport 5</div>
            <div className="text-[10px] font-bold bg-slate-800 text-slate-300 px-2 py-1 rounded border border-slate-700">ONE</div>
            <div className="text-[10px] font-bold bg-slate-800 text-slate-300 px-2 py-1 rounded border border-slate-700">Charlton</div>
            <div className="text-[10px] font-bold bg-slate-800 text-slate-300 px-2 py-1 rounded border border-slate-700">Kan 11</div>
          </div>
          <p className="text-[10px] text-slate-400 mt-2">
            Click to view full channel numbers (HOT, YES, Partner, Cellcom)
          </p>
        </div>
      </div>
    </aside>
  );
}
