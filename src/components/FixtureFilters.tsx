import { FilterOptions } from '../types';
import { Search, ArrowUpDown, X, Filter } from 'lucide-react';

interface FixtureFiltersProps {
  filters: FilterOptions;
  onChange: (updated: Partial<FilterOptions>) => void;
  onReset: () => void;
  totalCount: number;
}

export function FixtureFilters({
  filters,
  onChange,
  onReset,
  totalCount,
}: FixtureFiltersProps) {
  const hasActiveFilters =
    filters.search !== '' ||
    filters.sport !== 'all' ||
    filters.networkGroup !== 'all' ||
    filters.timeframe !== 'coming_7_days' ||
    filters.sortBy !== 'date_asc';

  return (
    <div className="bg-[#1E293B] border border-slate-700/80 rounded-2xl p-3 sm:p-4 mb-4 space-y-3 shadow-lg">
      
      {/* Top Row: Search Bar & Sort Dropdown */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
        {/* Search Bar */}
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            id="fixture-search-input"
            type="text"
            placeholder="Search players, opponents, channels..."
            value={filters.search}
            onChange={(e) => onChange({ search: e.target.value })}
            className="w-full pl-9 pr-8 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs sm:text-sm text-slate-200 placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition"
          />
          {filters.search && (
            <button
              onClick={() => onChange({ search: '' })}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 p-0.5"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Sort Selector */}
        <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-auto">
          <ArrowUpDown className="w-3.5 h-3.5 text-slate-400 shrink-0" />
          <select
            id="sort-fixtures-select"
            value={filters.sortBy}
            onChange={(e) => onChange({ sortBy: e.target.value as FilterOptions['sortBy'] })}
            className="bg-slate-900 border border-slate-700 rounded-xl px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-blue-500 cursor-pointer"
          >
            <option value="date_asc">Earliest First (IDT)</option>
            <option value="date_desc">Latest First</option>
            <option value="importance">Marquee Matches</option>
            <option value="player_asc">Player (A-Z)</option>
          </select>
        </div>
      </div>

      {/* Filter Rows - Horizontally Scrollable on Mobile */}
      <div className="space-y-2 pt-2 border-t border-slate-700/60 text-xs">
        
        {/* Row 1: Timeframe Chips */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none no-scrollbar">
          <span className="text-[11px] font-bold text-slate-400 shrink-0 mr-1">Timeframe:</span>
          {[
            { id: 'coming_7_days', label: 'Coming 7 Days' },
            { id: 'today', label: 'Today' },
            { id: 'tomorrow', label: 'Tomorrow' },
            { id: 'coming_14_days', label: '14 Days' },
            { id: 'all', label: 'All Dates' },
          ].map((tf) => (
            <button
              key={tf.id}
              id={`timeframe-tab-${tf.id}`}
              onClick={() => onChange({ timeframe: tf.id as FilterOptions['timeframe'] })}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold whitespace-nowrap transition cursor-pointer shrink-0 ${
                filters.timeframe === tf.id
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'bg-slate-900 text-slate-300 hover:bg-slate-800 border border-slate-700/80'
              }`}
            >
              {tf.label}
            </button>
          ))}
        </div>

        {/* Row 2: Sport Chips */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none no-scrollbar">
          <span className="text-[11px] font-bold text-slate-400 shrink-0 mr-1">Sport:</span>
          {[
            { id: 'all', label: 'All Sports' },
            { id: 'football', label: 'Football / Soccer' },
            { id: 'basketball', label: 'Basketball (NBA/Euro)' },
          ].map((sp) => (
            <button
              key={sp.id}
              id={`sport-filter-${sp.id}`}
              onClick={() => onChange({ sport: sp.id })}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold whitespace-nowrap transition cursor-pointer shrink-0 ${
                filters.sport === sp.id
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'bg-slate-900 text-slate-300 hover:bg-slate-800 border border-slate-700/80'
              }`}
            >
              {sp.label}
            </button>
          ))}
        </div>

        {/* Row 3: Israeli TV Channels Filter */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none no-scrollbar">
          <span className="text-[11px] font-bold text-slate-400 shrink-0 mr-1">Israeli TV:</span>
          {[
            { id: 'all', label: 'All Channels', color: 'bg-slate-500' },
            { id: 'Sport 5', label: '5SPORT (ספורט 5)', color: 'bg-blue-500' },
            { id: 'Charlton (Sport 1-4)', label: 'Sport 1-4 (צ\'רלטון)', color: 'bg-rose-500' },
            { id: 'ONE', label: 'ONE HD (אפיק 50)', color: 'bg-amber-500' },
            { id: 'Public (Kan 11)', label: 'Kan 11 (פתוח)', color: 'bg-cyan-500' },
          ].map((net) => (
            <button
              key={net.id}
              id={`network-filter-${net.id.replace(/[^a-z0-9]/gi, '')}`}
              onClick={() => onChange({ networkGroup: net.id })}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold whitespace-nowrap transition cursor-pointer shrink-0 flex items-center gap-1.5 ${
                filters.networkGroup === net.id
                  ? 'bg-slate-100 text-slate-900 shadow-sm'
                  : 'bg-slate-900 text-slate-300 hover:bg-slate-800 border border-slate-700/80'
              }`}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${net.color}`}></span>
              <span>{net.label}</span>
            </button>
          ))}

          {hasActiveFilters && (
            <button
              onClick={onReset}
              className="text-xs text-rose-400 hover:text-rose-300 underline font-medium whitespace-nowrap ml-auto pl-2 shrink-0 cursor-pointer"
            >
              Reset
            </button>
          )}
        </div>

      </div>

    </div>
  );
}

