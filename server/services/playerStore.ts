import fs from 'fs';
import path from 'path';
import { Player } from '../../src/types';
import { INITIAL_DEMO_PLAYERS, POPULAR_PRESET_PLAYERS } from '../data/defaultPlayers';

const PERSISTENCE_FILE = path.join(process.cwd(), 'server', 'data', 'persisted_players.json');

class PlayerStore {
  private players: Player[] = [];

  constructor() {
    this.loadFromDisk();
  }

  private loadFromDisk(): void {
    try {
      if (fs.existsSync(PERSISTENCE_FILE)) {
        const raw = fs.readFileSync(PERSISTENCE_FILE, 'utf-8');
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          this.players = parsed;
          return;
        }
      }
    } catch (err) {
      console.warn('Could not read persisted players file, falling back to initial:', err);
    }
    this.resetToDefault();
  }

  private saveToDisk(): void {
    try {
      const dir = path.dirname(PERSISTENCE_FILE);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(PERSISTENCE_FILE, JSON.stringify(this.players, null, 2), 'utf-8');
    } catch (err) {
      console.error('Failed to persist players to disk:', err);
    }
  }

  public resetToDefault(): void {
    this.players = JSON.parse(JSON.stringify(INITIAL_DEMO_PLAYERS));
    this.saveToDisk();
  }

  public getAll(): Player[] {
    return this.players;
  }

  public getActive(): Player[] {
    return this.players.filter(p => p.active);
  }

  public getById(id: string): Player | undefined {
    return this.players.find(p => p.id === id);
  }

  public updatePlayer(id: string, updates: Partial<Player>): Player | null {
    const player = this.players.find(p => p.id === id);
    if (!player) return null;

    if (updates.name !== undefined) player.name = updates.name.trim();
    if (updates.nativeName !== undefined) player.nativeName = updates.nativeName.trim();
    if (updates.currentTeam !== undefined) player.currentTeam = updates.currentTeam.trim();
    if (updates.league !== undefined) player.league = updates.league.trim();
    if (updates.sport !== undefined) player.sport = updates.sport;
    if (updates.country !== undefined) player.country = updates.country.trim();
    if (updates.position !== undefined) player.position = updates.position.trim();
    if (updates.jerseyNumber !== undefined) player.jerseyNumber = updates.jerseyNumber.trim();
    if (updates.photoUrl !== undefined) player.photoUrl = updates.photoUrl.trim();
    if (updates.teamLogo !== undefined) player.teamLogo = updates.teamLogo.trim();
    if (updates.teamColor !== undefined) player.teamColor = updates.teamColor;
    if (updates.bio !== undefined) player.bio = updates.bio;
    if (updates.active !== undefined) player.active = updates.active;

    this.saveToDisk();
    return player;
  }

  public addPlayer(playerData: Partial<Player> & { name: string; currentTeam: string; sport: Player['sport'] }): Player {
    const slug = playerData.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    const existing = this.players.find(p => p.id === slug || p.name.toLowerCase() === playerData.name.toLowerCase());
    
    // Check if in preset list
    const preset = POPULAR_PRESET_PLAYERS.find(p => p.name.toLowerCase() === playerData.name.toLowerCase());

    if (existing) {
      existing.active = true;
      if (playerData.currentTeam && playerData.currentTeam !== 'Unknown Team') {
        existing.currentTeam = playerData.currentTeam;
      } else if (preset) {
        existing.currentTeam = preset.currentTeam;
      }
      if (playerData.league) existing.league = playerData.league;
      if (playerData.sport) existing.sport = playerData.sport;
      if (playerData.position) existing.position = playerData.position;
      if (playerData.jerseyNumber) existing.jerseyNumber = playerData.jerseyNumber;
      if (playerData.nativeName) existing.nativeName = playerData.nativeName;
      if (playerData.teamLogo) existing.teamLogo = playerData.teamLogo;
      this.saveToDisk();
      return existing;
    }

    const currentTeam = playerData.currentTeam || preset?.currentTeam || 'Club Team';
    const sport = playerData.sport || preset?.sport || 'football';
    const league = playerData.league || preset?.league || (sport === 'basketball' ? 'NBA' : 'Top Tier League');

    const newPlayer: Player = {
      id: slug || `player-${Date.now()}`,
      name: playerData.name,
      nativeName: playerData.nativeName || preset?.nativeName || playerData.name,
      sport,
      currentTeam,
      league,
      country: playerData.country || preset?.country || 'International',
      position: playerData.position || preset?.position || (sport === 'basketball' ? 'Guard / Forward' : 'Forward / Midfielder'),
      jerseyNumber: playerData.jerseyNumber || preset?.jerseyNumber || '',
      photoUrl: playerData.photoUrl || preset?.photoUrl || (sport === 'basketball' 
        ? 'https://images.unsplash.com/photo-1546519638-68e109498ffc?w=600&auto=format&fit=crop&q=80'
        : 'https://images.unsplash.com/photo-1508098682722-e99c43a406b2?w=600&auto=format&fit=crop&q=80'),
      teamLogo: playerData.teamLogo || preset?.teamLogo || 'https://a.espncdn.com/i/teamlogos/default-team-logo-500.png',
      teamColor: playerData.teamColor || preset?.teamColor || '#1E40AF',
      bio: playerData.bio || preset?.bio || `Professional ${sport} athlete playing for ${currentTeam} in ${league}.`,
      isDemo: false,
      active: true,
      addedAt: new Date().toISOString(),
    };

    this.players.unshift(newPlayer);
    this.saveToDisk();
    return newPlayer;
  }

  public removePlayer(id: string): boolean {
    const idx = this.players.findIndex(p => p.id === id);
    if (idx !== -1) {
      this.players.splice(idx, 1);
      this.saveToDisk();
      return true;
    }
    return false;
  }

  public togglePlayerActive(id: string): Player | null {
    const player = this.players.find(p => p.id === id);
    if (player) {
      player.active = !player.active;
      this.saveToDisk();
      return player;
    }
    return null;
  }

  public importFromText(text: string): { added: Player[]; total: number } {
    const lines = text
      .split(/\r?\n|,|;/)
      .map(line => line.trim())
      .filter(line => line.length > 1);

    const added: Player[] = [];

    for (const line of lines) {
      // Check if matches preset
      const preset = POPULAR_PRESET_PLAYERS.find(p => 
        p.name.toLowerCase() === line.toLowerCase() || 
        (p.nativeName && p.nativeName.toLowerCase() === line.toLowerCase()) ||
        p.name.toLowerCase().includes(line.toLowerCase())
      );

      if (preset) {
        const addedPlayer = this.addPlayer(preset);
        added.push(addedPlayer);
      } else {
        // Guess sport based on common terms or default to football
        const isBasketball = line.toLowerCase().includes('nba') || line.toLowerCase().includes('basket');
        const cleanName = line.replace(/(\(.*\)|\[.*\])/g, '').trim();
        
        const addedPlayer = this.addPlayer({
          name: cleanName,
          sport: isBasketball ? 'basketball' : 'football',
          currentTeam: isBasketball ? 'NBA Team' : 'Club Football',
          league: isBasketball ? 'NBA' : 'Top Tier League',
          country: 'International',
          position: 'Player'
        });
        added.push(addedPlayer);
      }
    }

    this.saveToDisk();
    return { added, total: this.players.length };
  }

  public syncFromClientBackup(clientPlayers: Player[]): { addedCount: number; total: number } {
    if (!Array.isArray(clientPlayers) || clientPlayers.length === 0) {
      return { addedCount: 0, total: this.players.length };
    }

    let addedCount = 0;
    for (const cp of clientPlayers) {
      if (!cp || !cp.name) continue;
      const existing = this.players.find(p => p.id === cp.id || p.name.toLowerCase() === cp.name.toLowerCase());
      if (!existing) {
        this.players.push(cp);
        addedCount++;
      } else if (cp.active && !existing.active) {
        existing.active = true;
      }
    }

    if (addedCount > 0) {
      this.saveToDisk();
    }

    return { addedCount, total: this.players.length };
  }

  public exportToText(): string {
    return this.players
      .filter(p => p.active)
      .map(p => `${p.name} (${p.currentTeam} - ${p.sport.toUpperCase()})`)
      .join('\n');
  }

  public getAvailablePresets(): Player[] {
    const existingIds = new Set(this.players.map(p => p.id));
    return POPULAR_PRESET_PLAYERS.filter(p => !existingIds.has(p.id) || !this.getById(p.id)?.active);
  }
}

export const playerStore = new PlayerStore();
