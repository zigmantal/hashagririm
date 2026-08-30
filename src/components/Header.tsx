import { useEffect, useState } from 'react';
import { Tv, UserPlus, RefreshCw, Radio, Search, Shield, LogOut, Lock } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

interface HeaderProps {
  onOpenAdmin: () => void;
  onOpenChannelsGuide: () => void;
  onRefresh: () => void;
  isRefreshing: boolean;
  activeCount: number;
  searchQuery: string;
  onSearchChange: (q: string) => void;
}

export function Header({
  onOpenAdmin,
  onOpenChannelsGuide,
  onRefresh,
  isRefreshing,
  activeCount,
  searchQuery,
  onSearchChange,
}: HeaderProps) {
  const { user, isAdmin, openLoginModal, logout } = useAuth();
  const [israelTime, setIsraelTime] = useState<string>('');

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      const formatted = new Intl.DateTimeFormat('en-GB', {
        timeZone: 'Asia/Jerusalem',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
      }).format(now);
      setIsraelTime(`${formatted} IDT`);
    };

    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <header className="sticky top-0 z-40 bg-[#1E293B] border-b border-slate-700 shadow-md">
      <div className="max-w-6xl mx-auto px-3 sm:px-6 py-2.5 sm:py-3 flex items-center justify-between gap-2">
        {/* Brand Identity */}
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          <div className="bg-blue-600 p-1.5 sm:p-2 rounded-xl shadow-sm text-white flex items-center justify-center">
            <Tv className="w-4 h-4 sm:w-5 sm:h-5" />
          </div>
          <div>
            <h1 className="text-base sm:text-lg font-bold tracking-tight text-white flex items-center gap-1.5">
              SportsSync <span className="text-blue-400 font-semibold">Elite</span> <span className="text-slate-500 text-xs">v2</span>
              <span className="hidden xs:inline-block text-[9px] sm:text-[10px] uppercase tracking-wider font-extrabold px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-300 border border-blue-500/30">
                IL
              </span>
            </h1>
          </div>
        </div>

        {/* Center Search / Live Clock for larger screens */}
        <div className="hidden md:flex items-center gap-2 lg:gap-3 flex-1 max-w-md mx-2">
          <div className="relative w-full">
            <input
              type="text"
              placeholder="Search players, teams, channels..."
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 rounded-full py-1.5 pl-9 pr-4 text-xs sm:text-sm text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
            />
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          </div>

          {/* Live Israel Clock */}
          <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full bg-slate-900 border border-slate-700 text-xs font-mono text-slate-300 shrink-0">
            <Radio className="w-3 h-3 text-emerald-400 animate-pulse" />
            <span>{israelTime || 'IL Time'}</span>
          </div>
        </div>

        {/* Right Controls - Mobile Optimized */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          {/* Local TV Guide */}
          <button
            id="channels-guide-btn"
            onClick={onOpenChannelsGuide}
            className="flex items-center gap-1 px-2.5 sm:px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium border border-slate-700 transition cursor-pointer"
            title="Israeli TV Channels Guide"
          >
            <Tv className="w-3.5 h-3.5 text-blue-400" />
            <span className="hidden sm:inline">TV Guide</span>
          </button>

          {/* Live Sync Schedule Button */}
          <button
            id="refresh-fixtures-btn"
            onClick={onRefresh}
            disabled={isRefreshing}
            className="flex items-center gap-1 px-2.5 sm:px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 hover:border-blue-500/50 transition disabled:opacity-50 cursor-pointer"
            title="Synchronize match schedules"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-blue-400 ${isRefreshing ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">{isRefreshing ? 'Syncing...' : 'Sync'}</span>
          </button>

          {/* Add / Import Athletes Button */}
          <button
            id="add-import-athletes-btn"
            onClick={onOpenAdmin}
            className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 px-2.5 sm:px-3.5 py-1.5 rounded-xl text-xs font-semibold text-white shadow-md shadow-blue-600/20 transition-colors cursor-pointer"
          >
            <UserPlus className="w-3.5 h-3.5" />
            <span className="text-xs">+ Athlete</span>
          </button>

          {/* User Status if Logged In - discreet admin indicator */}
          {user && isAdmin ? (
            <div className="flex items-center gap-1.5 pl-1.5 border-l border-slate-700">
              <div
                className="w-7 h-7 rounded-full bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400 text-xs font-bold"
                title="Administrator Active"
              >
                <Shield className="w-3.5 h-3.5" />
              </div>
              <button
                onClick={logout}
                title="Sign Out"
                className="p-1 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-slate-800 transition cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </header>
  );
}


