import { Player } from '../types';
import { UserPlus, Sparkles, Activity, Dribbble, Shield } from 'lucide-react';

interface PlayerRosterBarProps {
  players: Player[];
  selectedPlayerId: string;
  onSelectPlayer: (id: string) => void;
  onOpenAdmin: () => void;
}

export function PlayerRosterBar({
  players,
  selectedPlayerId,
  onSelectPlayer,
  onOpenAdmin,
}: PlayerRosterBarProps) {
  const activePlayers = players.filter((p) => p.active);

  return (
    <div className="w-full bg-[#1E293B]/90 border-b border-slate-700/80 py-2 sm:py-2.5 backdrop-blur-sm">
      <div className="max-w-6xl mx-auto px-3 sm:px-6">
        {/* Scrollable Player Chips */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none no-scrollbar">
          {/* "All Athletes" Pill */}
          <button
            id="player-filter-all"
            onClick={() => onSelectPlayer('all')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition cursor-pointer shrink-0 ${
              selectedPlayerId === 'all'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20'
                : 'bg-slate-900/90 text-slate-300 hover:bg-slate-800 hover:text-white border border-slate-700/70'
            }`}
          >
            <Activity className="w-3.5 h-3.5" />
            <span>All ({activePlayers.length})</span>
          </button>

          {activePlayers.map((player) => {
            const isSelected = selectedPlayerId === player.id;
            return (
              <button
                key={player.id}
                id={`player-chip-${player.id}`}
                onClick={() => onSelectPlayer(player.id)}
                className={`group flex items-center gap-2 px-2.5 py-1.5 rounded-xl text-xs transition cursor-pointer shrink-0 ${
                  isSelected
                    ? 'bg-blue-900/80 text-white border border-blue-500 shadow-md shadow-blue-500/20'
                    : 'bg-slate-900/90 text-slate-300 hover:bg-slate-800 hover:text-white border border-slate-700/70'
                }`}
              >
                {/* Avatar / Photo */}
                <div className="relative w-6 h-6 sm:w-7 sm:h-7 rounded-full overflow-hidden bg-slate-700 ring-1 ring-slate-600 shrink-0">
                  <img
                    src={player.photoUrl}
                    alt={player.name}
                    className="w-full h-full object-cover"
                    loading="lazy"
                    referrerPolicy="no-referrer"
                    onError={(e) => {
                      (e.target as HTMLElement).style.display = 'none';
                    }}
                  />
                </div>

                {/* Info */}
                <div className="text-left">
                  <div className="font-bold text-slate-100 whitespace-nowrap">
                    {player.name}
                  </div>
                  <div className="text-[10px] text-slate-400 truncate max-w-[110px]">
                    {player.currentTeam}
                  </div>
                </div>
              </button>
            );
          })}

          {/* Quick Add Pill */}
          <button
            id="add-more-athletes-chip"
            onClick={onOpenAdmin}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-medium text-slate-400 hover:text-blue-400 bg-slate-900/50 hover:bg-slate-800 border border-dashed border-slate-700 transition cursor-pointer shrink-0"
          >
            <UserPlus className="w-3.5 h-3.5" />
            <span>+ Add</span>
          </button>
        </div>
      </div>
    </div>
  );
}
