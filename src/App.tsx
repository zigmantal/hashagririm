import { useState, useEffect, useMemo } from 'react';
import { Player, MatchFixture, FilterOptions } from './types';
import { Header } from './components/Header';
import { TrackedAthletesSidebar } from './components/TrackedAthletesSidebar';
import { PlayerRosterBar } from './components/PlayerRosterBar';
import { FixtureFilters } from './components/FixtureFilters';
import { FixtureCard } from './components/FixtureCard';
import { FixtureTableView } from './components/FixtureTableView';
import { AdminModal } from './components/AdminModal';
import { IsraeliChannelsModal } from './components/IsraeliChannelsModal';
import { WeeklyScheduleModal } from './components/WeeklyScheduleModal';
import { GoogleLoginModal } from './components/GoogleLoginModal';
import { useAuth } from './context/AuthContext';
import { Calendar, Search, Users, Tv, RefreshCw, AlertCircle, LayoutList, LayoutGrid } from 'lucide-react';

export default function App() {
  const { requireAdminAction, getAuthHeaders, isLoginModalOpen, closeLoginModal } = useAuth();
  const [players, setPlayers] = useState<Player[]>([]);
  const [presets, setPresets] = useState<Player[]>([]);
  const [fixtures, setFixtures] = useState<MatchFixture[]>([]);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Selected Player for Focused Spotlight
  const [selectedPlayerId, setSelectedPlayerId] = useState<string>('all');

  // View Mode: Table (Compact date-grouped list) vs Card Grid
  const [viewMode, setViewMode] = useState<'table' | 'grid'>('table');

  // Modals
  const [isAdminOpen, setIsAdminOpen] = useState(false);
  const [adminInitialTab, setAdminInitialTab] = useState<'roster' | 'add' | 'text'>('roster');
  const [isChannelsModalOpen, setIsChannelsModalOpen] = useState(false);
  const [isWeeklyScheduleOpen, setIsWeeklyScheduleOpen] = useState(false);

  // Filters State - Default to Coming 7 Days
  const [filters, setFilters] = useState<FilterOptions>({
    search: '',
    sport: 'all',
    playerId: 'all',
    networkGroup: 'all',
    timeframe: 'coming_7_days',
    sortBy: 'date_asc',
  });

  // Load Players with LocalStorage persistence and auto-recovery
  const loadPlayers = async () => {
    try {
      const res = await fetch('/api/players');
      if (!res.ok) throw new Error('Failed to load player roster');
      const data = await res.json();
      let serverPlayers: Player[] = data.players || [];
      const presetsList = data.presets || [];

      // Check client-side backup in case server was restarted/republished
      const cachedRaw = localStorage.getItem('sportssync_persisted_athletes_v2');
      if (cachedRaw) {
        try {
          const cachedPlayers: Player[] = JSON.parse(cachedRaw);
          if (Array.isArray(cachedPlayers) && cachedPlayers.length > 0) {
            const serverIds = new Set(serverPlayers.map((p) => p.id));
            const missingInServer = cachedPlayers.filter((cp) => !serverIds.has(cp.id));
            
            // If server is missing athletes that the user previously added, auto-recover them!
            if (missingInServer.length > 0) {
              const syncRes = await fetch('/api/players/sync-backup', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ players: cachedPlayers }),
              });
              if (syncRes.ok) {
                const syncData = await syncRes.json();
                if (syncData.players) {
                  serverPlayers = syncData.players;
                }
              }
            }
          }
        } catch (e) {
          console.warn('Could not parse local athletes backup', e);
        }
      }

      setPlayers(serverPlayers);
      setPresets(presetsList);
      localStorage.setItem('sportssync_persisted_athletes_v2', JSON.stringify(serverPlayers));
    } catch (err: any) {
      console.error(err);
      setError(err.message);
    }
  };

  // Load Fixtures
  const loadFixtures = async (force = false) => {
    if (force) setIsRefreshing(true);
    try {
      let res;
      if (force) {
        res = await fetch('/api/fixtures/sync-live', { method: 'POST' });
      } else {
        res = await fetch('/api/fixtures');
      }
      if (!res.ok) throw new Error('Failed to fetch fixture schedule');
      const data = await res.json();
      setFixtures(data.fixtures || []);
      setError(null);
    } catch (err: any) {
      console.error(err);
      setError(err.message);
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    loadPlayers();
    loadFixtures();
  }, []);

  // Update filter when clicking player in roster bar / sidebar
  const handleSelectPlayer = (id: string) => {
    setSelectedPlayerId(id);
    setFilters((prev) => ({ ...prev, playerId: id }));
  };

  // Filter & Sort Logic
  const filteredFixtures = useMemo(() => {
    let result = [...fixtures];

    // Player filter
    if (filters.playerId !== 'all') {
      result = result.filter((f) => f.playerId === filters.playerId);
    }

    // Sport filter
    if (filters.sport !== 'all') {
      result = result.filter((f) => f.sport === filters.sport);
    }

    // Network Group Filter
    if (filters.networkGroup !== 'all') {
      result = result.filter((f) => f.broadcast.networkGroup === filters.networkGroup);
    }

    // Search Query
    if (filters.search.trim() !== '') {
      const q = filters.search.toLowerCase().trim();
      result = result.filter(
        (f) =>
          f.playerName.toLowerCase().includes(q) ||
          f.playerTeam.toLowerCase().includes(q) ||
          f.homeTeam.name.toLowerCase().includes(q) ||
          f.awayTeam.name.toLowerCase().includes(q) ||
          f.opponentTeam.name.toLowerCase().includes(q) ||
          f.league.toLowerCase().includes(q) ||
          f.venue.name.toLowerCase().includes(q) ||
          f.venue.city.toLowerCase().includes(q) ||
          f.broadcast.channelName.toLowerCase().includes(q) ||
          f.broadcast.hebrewName.toLowerCase().includes(q)
      );
    }

    // Timeframe Filter
    if (filters.timeframe !== 'all') {
      const now = new Date();
      const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
      const endOfToday = new Date(startOfToday.getTime() + 24 * 60 * 60 * 1000);
      const endOfTomorrow = new Date(startOfToday.getTime() + 48 * 60 * 60 * 1000);
      // 7 full upcoming calendar days inclusive (start of today to end of day 7)
      const endOf7Days = new Date(startOfToday.getTime() + 8 * 24 * 60 * 60 * 1000);
      const endOf14Days = new Date(startOfToday.getTime() + 15 * 24 * 60 * 60 * 1000);

      result = result.filter((f) => {
        const matchDate = new Date(f.dateTimeUtc);
        if (filters.timeframe === 'today') {
          return matchDate >= startOfToday && matchDate < endOfToday;
        } else if (filters.timeframe === 'tomorrow') {
          return matchDate >= endOfToday && matchDate < endOfTomorrow;
        } else if (filters.timeframe === 'coming_7_days' || filters.timeframe === 'this_week') {
          return matchDate >= startOfToday && matchDate < endOf7Days;
        } else if (filters.timeframe === 'coming_14_days') {
          return matchDate >= startOfToday && matchDate < endOf14Days;
        }
        return true;
      });
    }

    // Sorting
    result.sort((a, b) => {
      if (filters.sortBy === 'date_asc') {
        return new Date(a.dateTimeUtc).getTime() - new Date(b.dateTimeUtc).getTime();
      } else if (filters.sortBy === 'date_desc') {
        return new Date(b.dateTimeUtc).getTime() - new Date(a.dateTimeUtc).getTime();
      } else if (filters.sortBy === 'player_asc') {
        return a.playerName.localeCompare(b.playerName);
      } else if (filters.sortBy === 'importance') {
        const score = (f: MatchFixture) => (f.importanceLevel === 'high' || f.importanceLevel === 'derby' || f.importanceLevel === 'championship' ? 2 : 1);
        return score(b) - score(a);
      }
      return 0;
    });

    return result;
  }, [fixtures, filters]);

  // Spotlight Player (If a player is selected, or demo player)
  const spotlightPlayer = useMemo(() => {
    if (selectedPlayerId !== 'all') {
      return players.find((p) => p.id === selectedPlayerId);
    }
    // Default to the first active player or demo player
    return players.find((p) => p.isDemo && p.active) || players.find((p) => p.active);
  }, [players, selectedPlayerId]);

  const spotlightNextFixture = useMemo(() => {
    if (!spotlightPlayer) return undefined;
    return fixtures.find((f) => f.playerId === spotlightPlayer.id);
  }, [fixtures, spotlightPlayer]);

  // Admin Actions with Authorization Headers
  const handleAddPlayer = async (playerData: any) => {
    const res = await fetch('/api/players', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeaders(),
      },
      body: JSON.stringify(playerData),
    });
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.error || 'Failed to add athlete. Admin privileges required.');
    }
    await loadPlayers();
    await loadFixtures(true);
  };

  const handleRemovePlayer = async (id: string) => {
    const res = await fetch(`/api/players/${id}`, {
      method: 'DELETE',
      headers: {
        ...getAuthHeaders(),
      },
    });
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.error || 'Failed to remove athlete. Admin privileges required.');
    }
    await loadPlayers();
    await loadFixtures(true);
    if (selectedPlayerId === id) {
      setSelectedPlayerId('all');
    }
  };

  const handleUpdatePlayer = async (id: string, updates: Partial<Player>) => {
    const res = await fetch(`/api/players/${id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeaders(),
      },
      body: JSON.stringify(updates),
    });
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.error || 'Failed to update athlete. Admin privileges required.');
    }
    await loadPlayers();
    await loadFixtures(true);
  };

  const handleTogglePlayer = async (id: string) => {
    const res = await fetch(`/api/players/${id}/toggle`, {
      method: 'PATCH',
      headers: {
        ...getAuthHeaders(),
      },
    });
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.error || 'Failed to toggle athlete status.');
    }
    await loadPlayers();
    await loadFixtures(true);
  };

  const handleImportText = async (text: string) => {
    const res = await fetch('/api/players/import-text', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeaders(),
      },
      body: JSON.stringify({ text }),
    });
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.error || 'Failed to import text list. Admin privileges required.');
    }
    await loadPlayers();
    await loadFixtures(true);
  };

  const handleExportText = async () => {
    const res = await fetch('/api/players/export-text');
    return await res.text();
  };

  const handleOpenAdmin = (tab: 'roster' | 'add' | 'text' = 'roster') => {
    requireAdminAction(() => {
      setAdminInitialTab(tab);
      setIsAdminOpen(true);
    });
  };

  return (
    <div className="min-h-screen bg-[#0F172A] text-slate-100 flex flex-col selection:bg-blue-600 selection:text-white">
      
      {/* Top Navbar */}
      <Header
        onOpenAdmin={() => handleOpenAdmin('add')}
        onOpenChannelsGuide={() => setIsChannelsModalOpen(true)}
        onRefresh={() => loadFixtures(true)}
        isRefreshing={isRefreshing}
        activeCount={players.filter((p) => p.active).length}
        searchQuery={filters.search}
        onSearchChange={(q) => setFilters((prev) => ({ ...prev, search: q }))}
      />

      {/* Main Body Container: Sidebar + Content */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
        
        {/* Left Desktop Sidebar */}
        <div className="hidden lg:block">
          <TrackedAthletesSidebar
            players={players}
            selectedPlayerId={selectedPlayerId}
            onSelectPlayer={handleSelectPlayer}
            onOpenAdmin={() => handleOpenAdmin('roster')}
            onOpenChannelsGuide={() => setIsChannelsModalOpen(true)}
          />
        </div>

        {/* Mobile / Tablet Horizontal Roster Bar */}
        <div className="block lg:hidden">
          <PlayerRosterBar
            players={players}
            selectedPlayerId={selectedPlayerId}
            onSelectPlayer={handleSelectPlayer}
            onOpenAdmin={() => handleOpenAdmin('roster')}
          />
        </div>

        {/* Main Content Area */}
        <main className="flex-1 p-3 sm:p-5 lg:p-6 overflow-y-auto max-w-5xl w-full mx-auto">
          
          {/* Error Alert */}
          {error && (
            <div className="mb-4 p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                <span>{error}</span>
              </div>
              <button
                onClick={() => loadFixtures(true)}
                className="underline font-semibold cursor-pointer"
              >
                Retry
              </button>
            </div>
          )}

          {/* Filters and Search Bar */}
          <FixtureFilters
            filters={filters}
            onChange={(updated) => setFilters((prev) => ({ ...prev, ...updated }))}
            onReset={() =>
              setFilters({
                search: '',
                sport: 'all',
                playerId: 'all',
                networkGroup: 'all',
                timeframe: 'coming_7_days',
                sortBy: 'date_asc',
              })
            }
            totalCount={filteredFixtures.length}
          />

          {/* Fixtures Section Header */}
          <div className="flex items-center justify-between gap-2 mb-3">
            <div className="flex items-center gap-2">
              <h3 className="text-sm sm:text-base font-bold text-white tracking-tight flex items-center gap-1.5">
                <Calendar className="w-4 h-4 text-blue-400" />
                <span>Upcoming Games</span>
              </h3>
              <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-slate-800 text-slate-300 border border-slate-700">
                {filteredFixtures.length} {filteredFixtures.length === 1 ? 'Match' : 'Matches'}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <div className="text-[11px] text-slate-400 hidden md:block">
                Broadcast times in <strong className="text-slate-200">Israel Time (IDT)</strong>
              </div>

              {/* View mode toggle switch */}
              <div className="flex items-center gap-0.5 p-1 rounded-xl bg-slate-800 border border-slate-700">
                <button
                  onClick={() => setViewMode('grid')}
                  className={`p-1.5 rounded-lg text-xs transition cursor-pointer ${
                    viewMode === 'grid' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'
                  }`}
                  title="Card View"
                >
                  <LayoutGrid className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => setViewMode('table')}
                  className={`p-1.5 rounded-lg text-xs transition cursor-pointer ${
                    viewMode === 'table' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'
                  }`}
                  title="Table View"
                >
                  <LayoutList className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>

          {/* Loading State */}
          {loading ? (
            <div className="text-center py-16 bg-[#1E293B] border border-slate-700 rounded-2xl">
              <RefreshCw className="w-8 h-8 text-blue-400 animate-spin mx-auto mb-3" />
              <p className="text-sm text-slate-300 font-medium">
                Fetching upcoming match schedules and Israeli broadcasting rights...
              </p>
            </div>
          ) : filteredFixtures.length === 0 ? (
            /* Empty State */
            <div className="bg-[#1E293B] border border-slate-700 rounded-2xl p-10 text-center max-w-lg mx-auto my-8 shadow-xl">
              <div className="w-12 h-12 rounded-2xl bg-slate-800 flex items-center justify-center mx-auto mb-4 text-slate-400 border border-slate-700">
                <Search className="w-6 h-6" />
              </div>
              <h4 className="text-base font-bold text-white mb-1">
                No matching fixtures found
              </h4>
              <p className="text-xs text-slate-400 mb-5">
                Try adjusting your search terms, timeframe, sport filters, or add more athletes to your roster.
              </p>
              <div className="flex items-center justify-center gap-3">
                <button
                  onClick={() =>
                    setFilters({
                      search: '',
                      sport: 'all',
                      playerId: 'all',
                      networkGroup: 'all',
                      timeframe: 'all',
                      sortBy: 'date_asc',
                    })
                  }
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition cursor-pointer"
                >
                  Clear Filters
                </button>
                <button
                  onClick={() => handleOpenAdmin('add')}
                  className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold transition cursor-pointer"
                >
                  + Add / Import Athletes
                </button>
              </div>
            </div>
          ) : viewMode === 'table' ? (
            /* Table View */
            <FixtureTableView
              fixtures={filteredFixtures}
              onOpenChannelsGuide={() => setIsChannelsModalOpen(true)}
            />
          ) : (
            /* Grid View */
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5">
              {filteredFixtures.map((fixture) => (
                <FixtureCard
                  key={fixture.id}
                  fixture={fixture}
                  onOpenChannelsGuide={() => setIsChannelsModalOpen(true)}
                />
              ))}
            </div>
          )}

        </main>
      </div>

      {/* Footer */}
      <footer className="border-t border-slate-700 bg-[#1E293B] py-5 text-xs text-slate-400">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Tv className="w-4 h-4 text-blue-400" />
            <span className="font-bold text-slate-200">SportsSync Elite</span>
            <span>— Player Match Schedule & Israeli Broadcast Directory</span>
          </div>
          <div className="flex items-center gap-4 text-[11px] text-slate-400">
            <span>5SPORT • Charlton • ONE • Kan 11</span>
            <span>•</span>
            <button
              onClick={() => setIsChannelsModalOpen(true)}
              className="text-blue-400 hover:underline cursor-pointer font-semibold"
            >
              Israeli TV Channels Guide
            </button>
            <span>•</span>
            <button
              onClick={() => setIsWeeklyScheduleOpen(true)}
              className="text-blue-400 hover:underline cursor-pointer font-semibold"
            >
              View Full TV Schedule
            </button>
          </div>
        </div>
      </footer>

      {/* Admin / Player Management Modal */}
      <AdminModal
        isOpen={isAdminOpen}
        onClose={() => setIsAdminOpen(false)}
        initialTab={adminInitialTab}
        players={players}
        presets={presets}
        onAddPlayer={handleAddPlayer}
        onUpdatePlayer={handleUpdatePlayer}
        onRemovePlayer={handleRemovePlayer}
        onTogglePlayer={handleTogglePlayer}
        onImportText={handleImportText}
        onExportText={handleExportText}
      />

      {/* Israeli TV Channels Guide Modal */}
      <IsraeliChannelsModal
        isOpen={isChannelsModalOpen}
        onClose={() => setIsChannelsModalOpen(false)}
      />

      {/* Full Weekly TV Schedule Modal */}
      <WeeklyScheduleModal
        isOpen={isWeeklyScheduleOpen}
        onClose={() => setIsWeeklyScheduleOpen(false)}
      />

      {/* Google Authentication Modal for Admin Privileges */}
      <GoogleLoginModal
        isOpen={isLoginModalOpen}
        onClose={closeLoginModal}
      />

    </div>
  );
}

