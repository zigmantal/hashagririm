import { useState, FormEvent, useEffect } from 'react';
import { Player, SportType } from '../types';
import { X, UserPlus, FileText, Check, Trash2, Search, Sparkles, AlertCircle, RefreshCw, Upload, Download, Dribbble, Shield, Edit3, Tv, ExternalLink } from 'lucide-react';

interface AdminModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialTab?: 'roster' | 'add' | 'text';
  players: Player[];
  presets: Player[];
  onAddPlayer: (playerData: any) => Promise<void>;
  onUpdatePlayer?: (id: string, updates: Partial<Player>) => Promise<void>;
  onRemovePlayer: (id: string) => Promise<void>;
  onTogglePlayer: (id: string) => Promise<void>;
  onImportText: (text: string) => Promise<void>;
  onExportText: () => Promise<string>;
}

export function AdminModal({
  isOpen,
  onClose,
  initialTab = 'roster',
  players,
  presets,
  onAddPlayer,
  onUpdatePlayer,
  onRemovePlayer,
  onTogglePlayer,
  onImportText,
  onExportText,
}: AdminModalProps) {
  const [activeTab, setActiveTab] = useState<'roster' | 'add' | 'text'>(initialTab ?? 'roster');

  useEffect(() => {
    if (isOpen) {
      setActiveTab(initialTab ?? 'roster');
    }
  }, [isOpen, initialTab]);
  
  // Add Player State
  const [searchName, setSearchName] = useState('');
  const [isLookingUp, setIsLookingUp] = useState(false);
  const [lookupResult, setLookupResult] = useState<any>(null);
  const [sport, setSport] = useState<SportType>('football');
  const [currentTeam, setCurrentTeam] = useState('');
  const [league, setLeague] = useState('');
  const [position, setPosition] = useState('');
  const [jerseyNumber, setJerseyNumber] = useState('');
  const [nativeName, setNativeName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  // Edit Player State
  const [editingPlayer, setEditingPlayer] = useState<Player | null>(null);
  const [editTeam, setEditTeam] = useState('');
  const [editLeague, setEditLeague] = useState('');
  const [editSport, setEditSport] = useState<SportType>('football');
  const [editPos, setEditPos] = useState('');
  const [editJersey, setEditJersey] = useState('');
  const [editNative, setEditNative] = useState('');

  // Text Import State
  const [rawText, setRawText] = useState('');
  const [isImporting, setIsImporting] = useState(false);
  const [exportedText, setExportedText] = useState('');

  if (!isOpen) return null;

  const handleLookup = async () => {
    if (!searchName.trim()) return;
    setIsLookingUp(true);
    try {
      const res = await fetch('/api/players/lookup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: searchName.trim() }),
      });
      const data = await res.json();
      if (data.found && data.details) {
        setLookupResult(data.details);
        setCurrentTeam(data.details.currentTeam || '');
        setLeague(data.details.league || '');
        setSport(data.details.sport || 'football');
        setPosition(data.details.position || '');
        setJerseyNumber(data.details.jerseyNumber || '');
        setNativeName(data.details.nativeName || '');
      } else {
        setLookupResult({
          name: searchName,
          currentTeam: 'Club Team',
          league: 'Top League',
          sport: 'football',
          position: 'Player',
        });
        setCurrentTeam('Club Team');
        setLeague('Top League');
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsLookingUp(false);
    }
  };

  const handleCreatePlayer = async (e: FormEvent) => {
    e.preventDefault();
    if (!searchName.trim()) return;
    setIsSubmitting(true);
    try {
      await onAddPlayer({
        name: searchName.trim(),
        nativeName: nativeName.trim() || undefined,
        sport,
        currentTeam: currentTeam || 'Club Team',
        league: league || 'Top League',
        position: position || 'Player',
        jerseyNumber: jerseyNumber || '',
      });
      setActionSuccess(`Added ${searchName}!`);
      setSearchName('');
      setCurrentTeam('');
      setLeague('');
      setPosition('');
      setJerseyNumber('');
      setNativeName('');
      setLookupResult(null);
      setTimeout(() => setActionSuccess(null), 3000);
      setActiveTab('roster');
    } catch (err: any) {
      console.error(err);
      setActionError(err.message || 'Failed to add athlete');
      setTimeout(() => setActionError(null), 4000);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleStartEdit = (player: Player) => {
    setEditingPlayer(player);
    setEditTeam(player.currentTeam);
    setEditLeague(player.league);
    setEditSport(player.sport);
    setEditPos(player.position);
    setEditJersey(player.jerseyNumber || '');
    setEditNative(player.nativeName || '');
  };

  const handleSaveEdit = async (e: FormEvent) => {
    e.preventDefault();
    if (!editingPlayer || !onUpdatePlayer) return;
    setIsSubmitting(true);
    try {
      await onUpdatePlayer(editingPlayer.id, {
        currentTeam: editTeam.trim(),
        league: editLeague.trim(),
        sport: editSport,
        position: editPos.trim(),
        jerseyNumber: editJersey.trim(),
        nativeName: editNative.trim() || undefined,
      });
      setActionSuccess(`Updated details for ${editingPlayer.name}!`);
      setEditingPlayer(null);
      setTimeout(() => setActionSuccess(null), 3000);
    } catch (err: any) {
      console.error(err);
      setActionError(err.message || 'Failed to update athlete');
      setTimeout(() => setActionError(null), 4000);
    } finally {
      setIsSubmitting(false);
    }
  };

  const getExpectedChannel = (lg: string, sp: SportType) => {
    const l = (lg || '').toLowerCase();
    if (l.includes('mls') || l.includes('major league soccer')) return 'Apple TV (MLS Pass) / 5SPORT';
    if (l.includes('belgian') || l.includes('jupiler')) return 'Sport 1 / Sport 2 (צ\'רלטון)';
    if (l.includes('israeli') || l.includes('ligat')) return '5SPORT / 5LIVE';
    if (l.includes('euroleague') || l.includes('bbl')) return '5SPORT / 5STARS';
    if (l.includes('eurocup')) return 'ONE2 / ONE HD';
    if (l.includes('la liga') || l.includes('laliga') || l.includes('spain')) return 'ONE HD (אפיק 50)';
    if (l.includes('premier league') || l.includes('england') || l.includes('epl')) return 'Sport 1 / Sport 2 (צ\'רלטון)';
    if (l.includes('champions league') || l.includes('ucl')) return '5SPORT / 5STARS';
    if (l.includes('europa league') || l.includes('conference league')) return 'Sport 1 / Sport 2 / Sport 3';
    if (l.includes('nba')) return 'Sport 5 / 5STARS (55/56)';
    if (l.includes('saudi')) return 'Sport 1 / Sport 2 (צ\'רלטון)';
    if (sp === 'tennis') return 'EuroSport 1 / Sport 5';
    return 'Sport 5 / Charlton Sport';
  };

  const handleQuickAddPreset = async (preset: Player) => {
    setIsSubmitting(true);
    try {
      await onAddPlayer(preset);
      setActionSuccess(`Added ${preset.name}!`);
      setTimeout(() => setActionSuccess(null), 2500);
    } catch (err: any) {
      console.error(err);
      setActionError(err.message || 'Failed to add athlete');
      setTimeout(() => setActionError(null), 4000);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleTextImportSubmit = async () => {
    if (!rawText.trim()) return;
    setIsImporting(true);
    try {
      await onImportText(rawText);
      setActionSuccess('Successfully imported player list!');
      setRawText('');
      setTimeout(() => {
        setActionSuccess(null);
        setActiveTab('roster');
      }, 2000);
    } catch (err: any) {
      console.error(err);
      setActionError(err.message || 'Failed to import roster');
      setTimeout(() => setActionError(null), 4000);
    } finally {
      setIsImporting(false);
    }
  };

  const handleLoadSampleText = (presetType: 'israeli' | 'nba' | 'global') => {
    if (presetType === 'israeli') {
      setRawText(`Deni Avdija\nManor Solomon\nOscar Gloukh\nDaniel Peretz\nYam Madar`);
    } else if (presetType === 'nba') {
      setRawText(`Deni Avdija\nLuka Doncic\nStephen Curry\nNikola Jokic\nLeBron James`);
    } else {
      setRawText(`Erling Haaland\nKylian Mbappe\nLionel Messi\nVinicius Junior\nMohamed Salah`);
    }
  };

  const handleExportClick = async () => {
    const txt = await onExportText();
    setExportedText(txt);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm overflow-y-auto">
      <div className="relative w-full max-w-3xl bg-[#1E293B] border border-slate-700 rounded-2xl shadow-2xl overflow-hidden my-8 max-h-[90vh] flex flex-col">
        
        {/* Modal Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-700 bg-slate-900/90">
          <div>
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <UserPlus className="w-5 h-5 text-blue-400" />
              <span>Athlete Roster & Administration</span>
            </h2>
            <p className="text-xs text-slate-400">
              Manage tracked players, add athletes with auto-team detection, or import simple .txt rosters
            </p>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Tabs */}
        <div className="flex border-b border-slate-700 bg-slate-900/40 px-5 gap-4">
          <button
            onClick={() => setActiveTab('roster')}
            className={`py-3 text-xs font-semibold border-b-2 transition cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'roster'
                ? 'border-blue-500 text-blue-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <span>Current Roster ({players.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('add')}
            className={`py-3 text-xs font-semibold border-b-2 transition cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'add'
                ? 'border-blue-500 text-blue-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <UserPlus className="w-3.5 h-3.5" />
            <span>Search & Add Player</span>
          </button>

          <button
            onClick={() => setActiveTab('text')}
            className={`py-3 text-xs font-semibold border-b-2 transition cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'text'
                ? 'border-blue-500 text-blue-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Text File / Bulk Import</span>
          </button>
        </div>

        {/* Success Alert */}
        {actionSuccess && (
          <div className="mx-5 mt-4 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs font-semibold flex items-center gap-2">
            <Check className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{actionSuccess}</span>
          </div>
        )}

        {/* Error Alert */}
        {actionError && (
          <div className="mx-5 mt-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs font-semibold flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{actionError}</span>
            </div>
            <button
              onClick={() => setActionError(null)}
              className="text-rose-400 hover:text-white p-0.5 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Tab Contents (Scrollable) */}
        <div className="p-5 overflow-y-auto flex-1 space-y-6">

          {/* EDIT ATHLETE VIEW */}
          {editingPlayer && (
            <div className="bg-slate-900 border border-blue-500/40 rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                <div className="flex items-center gap-2">
                  <Edit3 className="w-4 h-4 text-blue-400" />
                  <h3 className="text-sm font-bold text-white">Edit Athlete: {editingPlayer.name}</h3>
                </div>
                <button
                  onClick={() => setEditingPlayer(null)}
                  className="text-xs text-slate-400 hover:text-white cursor-pointer"
                >
                  Cancel
                </button>
              </div>

              <form onSubmit={handleSaveEdit} className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-slate-300 font-semibold mb-1">Current Club / Team</label>
                    <input
                      type="text"
                      value={editTeam}
                      onChange={(e) => setEditTeam(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white focus:outline-none focus:border-blue-500"
                      placeholder="e.g. Charlotte FC, Philadelphia Union"
                    />
                  </div>

                  <div>
                    <label className="block text-xs text-slate-300 font-semibold mb-1">League / Competition</label>
                    <input
                      type="text"
                      value={editLeague}
                      onChange={(e) => setEditLeague(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white focus:outline-none focus:border-blue-500"
                      placeholder="e.g. MLS, Belgian Pro League, La Liga"
                    />
                  </div>

                  <div>
                    <label className="block text-xs text-slate-300 font-semibold mb-1">Sport</label>
                    <select
                      value={editSport}
                      onChange={(e) => setEditSport(e.target.value as SportType)}
                      className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white focus:outline-none focus:border-blue-500"
                    >
                      <option value="football">Football / Soccer</option>
                      <option value="basketball">Basketball</option>
                      <option value="tennis">Tennis</option>
                      <option value="other">Other</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs text-slate-300 font-semibold mb-1">Position / Jersey #</label>
                    <input
                      type="text"
                      value={editPos}
                      onChange={(e) => setEditPos(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white focus:outline-none focus:border-blue-500"
                      placeholder="e.g. Winger (#11), Striker (#27)"
                    />
                  </div>
                </div>

                <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Tv className="w-3.5 h-3.5 text-blue-400" />
                    <span className="text-xs text-slate-300">Expected Israeli TV Broadcast:</span>
                  </div>
                  <span className="text-xs font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                    {getExpectedChannel(editLeague, editSport)}
                  </span>
                </div>

                <div className="flex justify-end gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setEditingPlayer(null)}
                    className="px-3 py-1.5 rounded-xl bg-slate-800 text-slate-300 text-xs hover:bg-slate-700 cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="px-4 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition disabled:opacity-50 cursor-pointer"
                  >
                    {isSubmitting ? 'Saving...' : 'Save Updates'}
                  </button>
                </div>
              </form>
            </div>
          )}
          
          {/* TAB 1: CURRENT ROSTER */}
          {activeTab === 'roster' && !editingPlayer && (
            <div className="space-y-6">
              
              {/* Active Players List */}
              <div>
                <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-3">
                  Currently Tracked Athletes
                </h3>
                <div className="space-y-2.5">
                  {players.map((player) => (
                    <div
                      key={player.id}
                      className="flex items-center justify-between gap-3 p-3 rounded-xl bg-slate-950 border border-slate-800/90 hover:border-slate-700 transition"
                    >
                      <div className="flex items-center gap-3">
                        <img
                          src={player.photoUrl}
                          alt={player.name}
                          className="w-10 h-10 rounded-full object-cover ring-1 ring-slate-700 shrink-0"
                          referrerPolicy="no-referrer"
                        />
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-bold text-white">{player.name}</span>
                            {player.nativeName && (
                              <span className="text-xs text-slate-400">({player.nativeName})</span>
                            )}
                          </div>
                          <div className="text-xs text-slate-400 flex flex-wrap items-center gap-1.5 mt-0.5">
                            <span className="text-blue-400 font-semibold">{player.currentTeam}</span>
                            <span>•</span>
                            <span>{player.league}</span>
                            <span>•</span>
                            <span className="text-emerald-400 font-medium">{getExpectedChannel(player.league, player.sport)}</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleStartEdit(player)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-blue-400 hover:bg-blue-500/10 transition cursor-pointer"
                          title="Edit Club / League"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>

                        <button
                          onClick={() => onTogglePlayer(player.id)}
                          className={`px-2.5 py-1 rounded-lg text-xs font-medium transition cursor-pointer ${
                            player.active
                              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                              : 'bg-slate-800 text-slate-400 border border-slate-700'
                          }`}
                        >
                          {player.active ? 'Active' : 'Paused'}
                        </button>

                        <button
                          onClick={() => onRemovePlayer(player.id)}
                          className="p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition cursor-pointer"
                          title="Remove Athlete"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Quick Add Presets */}
              {presets.length > 0 && (
                <div className="pt-4 border-t border-slate-800">
                  <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
                    Quick Add Popular Stars (1-Click)
                  </h3>
                  <p className="text-xs text-slate-400 mb-3">
                    Add top Israeli and international athletes ready with verified team and broadcasting data:
                  </p>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {presets.map((preset) => (
                      <div
                        key={preset.id}
                        className="flex items-center justify-between p-2.5 rounded-xl bg-slate-950/70 border border-slate-800/80 hover:border-slate-700 transition"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <img
                            src={preset.photoUrl}
                            alt={preset.name}
                            className="w-8 h-8 rounded-full object-cover ring-1 ring-slate-700 shrink-0"
                            referrerPolicy="no-referrer"
                          />
                          <div className="min-w-0">
                            <div className="text-xs font-bold text-slate-200 truncate">
                              {preset.name}
                              {preset.nativeName && <span className="text-[10px] text-slate-400 font-normal ml-1">({preset.nativeName})</span>}
                            </div>
                            <div className="text-[11px] text-blue-400 truncate">
                              {preset.currentTeam}
                            </div>
                            <div className="text-[10px] text-slate-400 truncate">
                              {preset.league}
                            </div>
                          </div>
                        </div>

                        <button
                          onClick={() => handleQuickAddPreset(preset)}
                          disabled={isSubmitting}
                          className="px-2.5 py-1 rounded-lg bg-blue-600/20 hover:bg-blue-600 text-blue-300 hover:text-white text-xs font-semibold border border-blue-500/30 transition cursor-pointer shrink-0 ml-2"
                        >
                          + Add
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

            </div>
          )}

          {/* TAB 2: SEARCH & ADD PLAYER */}
          {activeTab === 'add' && (
            <form onSubmit={handleCreatePlayer} className="space-y-4">
              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-semibold text-slate-300">
                    Athlete Name (Auto-Detect Team & Sport)
                  </label>
                  <a
                    href="https://www.transfermarkt.com"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-slate-400 hover:text-blue-400 transition flex items-center gap-1"
                  >
                    <span>Look up on Transfermarkt</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="e.g., Liel Abada, Tai Baribo, Anan Khalaili, Kylian Mbappe, Lionel Messi"
                    value={searchName}
                    onChange={(e) => setSearchName(e.target.value)}
                    className="flex-1 px-3.5 py-2 rounded-xl bg-slate-900 border border-slate-700 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                  />
                  <button
                    type="button"
                    onClick={handleLookup}
                    disabled={isLookingUp || !searchName.trim()}
                    className="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold transition flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
                  >
                    {isLookingUp ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                    <span>Auto-Detect</span>
                  </button>
                </div>
                <p className="text-[11px] text-slate-400">
                  Type any athlete's name (Israeli or international) and click Auto-Detect to pull their current club and Israeli broadcasting channel.
                </p>
              </div>

              {/* Editable Fields */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Sport
                  </label>
                  <select
                    value={sport}
                    onChange={(e) => setSport(e.target.value as SportType)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-sm text-white focus:outline-none focus:border-blue-500"
                  >
                    <option value="football">Football / Soccer (MLS, Belgian Pro League, La Liga, Premier League)</option>
                    <option value="basketball">Basketball (NBA, EuroLeague, EuroCup)</option>
                    <option value="tennis">Tennis</option>
                    <option value="other">Other Sport</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Current Team / Club
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Charlotte FC, Philadelphia Union, Real Madrid"
                    value={currentTeam}
                    onChange={(e) => setCurrentTeam(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    League / Competition
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. MLS (Major League Soccer), Belgian Pro League"
                    value={league}
                    onChange={(e) => setLeague(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Position / Jersey #
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Winger (#11), Striker (#27)"
                    value={position}
                    onChange={(e) => setPosition(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              {/* Broadcast Preview Box */}
              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Tv className="w-4 h-4 text-blue-400" />
                  <span className="text-xs text-slate-300">Israeli Broadcasting Channel:</span>
                </div>
                <span className="text-xs font-bold text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-lg border border-emerald-500/20">
                  {getExpectedChannel(league, sport)}
                </span>
              </div>

              <div className="pt-3 flex justify-end">
                <button
                  type="submit"
                  disabled={isSubmitting || !searchName.trim()}
                  className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold shadow-lg shadow-blue-600/30 transition disabled:opacity-50 cursor-pointer"
                >
                  {isSubmitting ? 'Saving Athlete...' : 'Save & Track Athlete'}
                </button>
              </div>
            </form>
          )}

          {/* TAB 3: TEXT FILE & BULK IMPORT */}
          {activeTab === 'text' && (
            <div className="space-y-4">
              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800">
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-bold text-slate-200">
                    Paste Athlete List (Text / TXT)
                  </label>
                  <div className="flex items-center gap-1.5 text-xs text-slate-400">
                    <span>Sample Lists:</span>
                    <button
                      type="button"
                      onClick={() => handleLoadSampleText('israeli')}
                      className="text-blue-400 hover:underline cursor-pointer"
                    >
                      Israeli Stars
                    </button>
                    <span>•</span>
                    <button
                      type="button"
                      onClick={() => handleLoadSampleText('nba')}
                      className="text-blue-400 hover:underline cursor-pointer"
                    >
                      NBA
                    </button>
                    <span>•</span>
                    <button
                      type="button"
                      onClick={() => handleLoadSampleText('global')}
                      className="text-blue-400 hover:underline cursor-pointer"
                    >
                      Football
                    </button>
                  </div>
                </div>

                <textarea
                  rows={6}
                  value={rawText}
                  onChange={(e) => setRawText(e.target.value)}
                  placeholder="Paste player names (one per line, or comma-separated):&#10;Deni Avdija&#10;Manor Solomon&#10;Oscar Gloukh&#10;Erling Haaland&#10;Luka Doncic"
                  className="w-full p-3 rounded-xl bg-slate-900 border border-slate-700 text-sm font-mono text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500"
                />

                <div className="mt-3 flex items-center justify-between">
                  <p className="text-[11px] text-slate-400">
                    Each athlete will be automatically linked to their team, league, and Israeli broadcast schedule.
                  </p>
                  <button
                    onClick={handleTextImportSubmit}
                    disabled={isImporting || !rawText.trim()}
                    className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition flex items-center gap-1.5 disabled:opacity-50 cursor-pointer shrink-0"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    <span>{isImporting ? 'Importing...' : 'Import List'}</span>
                  </button>
                </div>
              </div>

              {/* Export Section */}
              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-xs font-bold text-slate-200">
                    Export Current Roster as Text (.txt)
                  </h4>
                  <button
                    onClick={handleExportClick}
                    className="text-xs text-blue-400 hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Generate Export Text</span>
                  </button>
                </div>

                {exportedText && (
                  <div className="mt-2">
                    <pre className="p-3 bg-slate-900 rounded-lg border border-slate-700 text-xs font-mono text-emerald-400 overflow-x-auto">
                      {exportedText}
                    </pre>
                  </div>
                )}
              </div>
            </div>
          )}

        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/80 flex items-center justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition cursor-pointer"
          >
            Close
          </button>
        </div>

      </div>
    </div>
  );
}
