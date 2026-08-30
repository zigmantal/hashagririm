import { useState } from 'react';
import { FilterOptions } from '../types';
import { Search, ArrowUpDown, X, Filter, ChevronDown, ChevronUp } from 'lucide-react';

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
  totalCount: _totalCount,
}: FixtureFiltersProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const hasActiveFilters =
    filters.search !== '' ||
    filters.sport !== 'all' ||
    filters.networkGroup !== 'all' ||
    filters.timeframe !== 'coming_7_days' ||
    filters.sortBy !== 'date_asc';

  return (
    <div className="bg-[#1E293B] border border-slate-700/80 rounded-2xl p-3 sm:p-4 mb-4 space-y-3 shadow-lg">
      {/* Top Row: Search Bar & Filter Toggle Button */}
      <div className="flex items-center gap-2">
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
              id="clear-search-button"
              type="button"
              onClick={() => onChange({ search: '' })}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 p-0.5 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Filters Toggle Button */}
        <button
          type="button"
          id="toggle-filters-button"
          aria-expanded={isExpanded}
          onClick={() => setIsExpanded((prev) => !prev)}
          className={`relative flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs sm:text-sm font-semibold border transition cursor-pointer shrink-0 ${
            isExpanded
              ? 'bg-blue-600/20 border-blue-500/50 text-blue-300'
              : hasActiveFilters
              ? 'bg-slate-900 border-blue-500/50 text-blue-300'
              : 'bg-slate-900 border-slate-700 text-slate-300 hover:bg-slate-800 hover:text-slate-100'
          }`}
        >
          <Filter className="w-4 h-4" />
          <span className="hidden xs:inline">Filters</span>
          {isExpanded ? (
            <ChevronUp className="w-3.5 h-3.5" />
          ) : (
            <ChevronDown className="w-3.5 h-3.5" />
          )}

          {/* Active Filter Dot/Badge when collapsed */}
          {!isExpanded && hasActiveFilters && (
            <span
              id="active-filters-badge"
              className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-blue-500 rounded-full ring-2 ring-[#1E293B]"
            />
          )}
        </button>
      </div>

      {/* Expanded Filter Panel: Sort Selector & Filter Rows */}
      {isExpanded && (
        <div className="space-y-3 pt-2 border-t border-slate-700/60 text-xs">
          {/* Sort Selector Row */}
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-1.5 shrink-0">
              <ArrowUpDown className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <span className="text-[11px] font-bold text-slate-400">Sort:</span>
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

            {hasActiveFilters && (
              <button
                type="button"
                id="reset-all-filters-button"
                onClick={onReset}
                className="text-xs text-rose-400 hover:text-rose-300 underline font-medium whitespace-nowrap cursor-pointer"
              >
                Reset Filters
              </button>
            )}
          </div>

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
                type="button"
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
                type="button"
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
                type="button"
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
          </div>
        </div>
      )}
    </div>
  );
}


