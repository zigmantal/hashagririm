import fs from 'fs';
import path from 'path';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Player } from '../../src/types';
import { INITIAL_DEMO_PLAYERS, POPULAR_PRESET_PLAYERS } from '../data/defaultPlayers';

export interface DbPlayerRow {
  id: string;
  name: string;
  native_name: string | null;
  sport: string;
  current_team: string | null;
  league: string | null;
  country: string | null;
  position: string | null;
  jersey_number: string | null;
  photo_url: string | null;
  team_logo: string | null;
  team_color: string | null;
  bio: string | null;
  is_demo: boolean | null;
  active: boolean | null;
  added_at: string;
}

let supabaseInstance: SupabaseClient | null = null;

export function getSupabaseClient(): SupabaseClient {
  if (!supabaseInstance) {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
      const errorMsg = '[FATAL] Missing SUPABASE_URL or SUPABASE_SERVICE_KEY environment variable. Supabase is required for player persistence.';
      console.error(errorMsg);
      throw new Error(errorMsg);
    }

    supabaseInstance = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });
  }
  return supabaseInstance;
}

function rowToPlayer(row: DbPlayerRow): Player {
  return {
    id: row.id,
    name: row.name,
    nativeName: row.native_name ?? undefined,
    sport: (row.sport as Player['sport']) || 'football',
    currentTeam: row.current_team ?? '',
    league: row.league ?? '',
    country: row.country ?? '',
    position: row.position ?? '',
    jerseyNumber: row.jersey_number ?? undefined,
    photoUrl: row.photo_url ?? '',
    teamLogo: row.team_logo ?? '',
    teamColor: row.team_color ?? undefined,
    bio: row.bio ?? undefined,
    isDemo: !!row.is_demo,
    active: row.active !== false,
    addedAt: row.added_at || new Date().toISOString(),
  };
}

function playerToDbRow(player: Player): DbPlayerRow {
  return {
    id: player.id,
    name: player.name,
    native_name: player.nativeName ?? null,
    sport: player.sport,
    current_team: player.currentTeam ?? null,
    league: player.league ?? null,
    country: player.country ?? null,
    position: player.position ?? null,
    jersey_number: player.jerseyNumber ?? null,
    photo_url: player.photoUrl ?? null,
    team_logo: player.teamLogo ?? null,
    team_color: player.teamColor ?? null,
    bio: player.bio ?? null,
    is_demo: player.isDemo ?? false,
    active: player.active ?? true,
    added_at: player.addedAt || new Date().toISOString(),
  };
}

function handleSupabaseError(context: string, error: any): void {
  const msg = error?.message || String(error);
  console.error(`[PlayerStore] ${context} error:`, msg);
  if (msg.includes('row-level security') || error?.code === '42501') {
    console.error(`[PlayerStore] RLS / Permission Notice: Ensure SUPABASE_SERVICE_KEY is the secret/service role key (e.g. 'sb_secret_...' or service_role JWT), rather than the publishable key ('sb_publishable_...').`);
  }
}

class PlayerStore {
  private isInitialized = false;

  public async init(): Promise<void> {
    if (this.isInitialized) return;

    try {
      const supabase = getSupabaseClient();

      // Check if players table exists and whether it contains any rows
      const { count, error } = await supabase
        .from('players')
        .select('id', { count: 'exact', head: true });

      if (error) {
        handleSupabaseError('init check', error);
        throw error;
      }

      if (count === 0 || count === null) {
        console.log('[PlayerStore] Players table in Supabase is empty. Performing one-time seed migration...');

        const seedMap = new Map<string, Player>();

        // 1. Initial demo players
        for (const player of INITIAL_DEMO_PLAYERS) {
          seedMap.set(player.id, player);
        }

        // 2. Check legacy persisted_players.json if it exists on disk
        const legacyFile = path.join(process.cwd(), 'server', 'data', 'persisted_players.json');
        try {
          if (fs.existsSync(legacyFile)) {
            const raw = fs.readFileSync(legacyFile, 'utf-8');
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed)) {
              for (const player of parsed) {
                if (player && player.id && player.name) {
                  seedMap.set(player.id, player);
                }
              }
            }
          }
        } catch (fileErr) {
          console.warn('[PlayerStore] Could not read legacy persisted_players.json during seed:', fileErr);
        }

        const rowsToInsert = Array.from(seedMap.values()).map(playerToDbRow);
        if (rowsToInsert.length > 0) {
          const { error: insertErr } = await supabase
            .from('players')
            .upsert(rowsToInsert);

          if (insertErr) {
            handleSupabaseError('init seed insert', insertErr);
          } else {
            console.log(`[PlayerStore] One-time seed migration complete. Inserted ${rowsToInsert.length} players into Supabase.`);
          }
        }
      } else {
        console.log(`[PlayerStore] Supabase connected successfully. Found ${count} existing players.`);
      }

      this.isInitialized = true;
    } catch (err: any) {
      console.error('[PlayerStore] Initialization error:', err.message || err);
      throw err;
    }
  }

  public async getAll(): Promise<Player[]> {
    try {
      const supabase = getSupabaseClient();
      const { data, error } = await supabase
        .from('players')
        .select('*')
        .order('added_at', { ascending: true });

      if (error) {
        handleSupabaseError('getAll', error);
        throw error;
      }

      const players = (data || []).map(rowToPlayer);
      if (players.length === 0) {
        return INITIAL_DEMO_PLAYERS;
      }
      return players;
    } catch (err: any) {
      handleSupabaseError('getAll', err);
      return INITIAL_DEMO_PLAYERS;
    }
  }

  public async getActive(): Promise<Player[]> {
    try {
      const supabase = getSupabaseClient();
      const { data, error } = await supabase
        .from('players')
        .select('*')
        .eq('active', true)
        .order('name', { ascending: true });

      if (error) {
        handleSupabaseError('getActive', error);
        throw error;
      }

      const players = (data || []).map(rowToPlayer);
      if (players.length === 0) {
        return INITIAL_DEMO_PLAYERS.filter(p => p.active);
      }
      return players;
    } catch (err: any) {
      handleSupabaseError('getActive', err);
      return INITIAL_DEMO_PLAYERS.filter(p => p.active);
    }
  }

  public async getById(id: string): Promise<Player | null> {
    try {
      const supabase = getSupabaseClient();
      const { data, error } = await supabase
        .from('players')
        .select('*')
        .eq('id', id)
        .maybeSingle();

      if (error) {
        handleSupabaseError(`getById(${id})`, error);
        throw error;
      }

      if (!data) {
        const fallback = INITIAL_DEMO_PLAYERS.find(p => p.id === id);
        return fallback || null;
      }

      return rowToPlayer(data);
    } catch (err: any) {
      handleSupabaseError(`getById(${id})`, err);
      const fallback = INITIAL_DEMO_PLAYERS.find(p => p.id === id);
      return fallback || null;
    }
  }

  public async updatePlayer(id: string, updates: Partial<Player>): Promise<Player | null> {
    try {
      const supabase = getSupabaseClient();
      const dbUpdates: Partial<DbPlayerRow> = {};

      if (updates.name !== undefined) dbUpdates.name = updates.name.trim();
      if (updates.nativeName !== undefined) dbUpdates.native_name = updates.nativeName.trim();
      if (updates.currentTeam !== undefined) dbUpdates.current_team = updates.currentTeam.trim();
      if (updates.league !== undefined) dbUpdates.league = updates.league.trim();
      if (updates.sport !== undefined) dbUpdates.sport = updates.sport;
      if (updates.country !== undefined) dbUpdates.country = updates.country.trim();
      if (updates.position !== undefined) dbUpdates.position = updates.position.trim();
      if (updates.jerseyNumber !== undefined) dbUpdates.jersey_number = updates.jerseyNumber.trim();
      if (updates.photoUrl !== undefined) dbUpdates.photo_url = updates.photoUrl.trim();
      if (updates.teamLogo !== undefined) dbUpdates.team_logo = updates.teamLogo.trim();
      if (updates.teamColor !== undefined) dbUpdates.team_color = updates.teamColor;
      if (updates.bio !== undefined) dbUpdates.bio = updates.bio;
      if (updates.active !== undefined) dbUpdates.active = updates.active;
      if (updates.isDemo !== undefined) dbUpdates.is_demo = updates.isDemo;

      const { data, error } = await supabase
        .from('players')
        .update(dbUpdates)
        .eq('id', id)
        .select('*')
        .maybeSingle();

      if (error) {
        handleSupabaseError(`updatePlayer(${id})`, error);
        throw error;
      }

      return data ? rowToPlayer(data) : null;
    } catch (err: any) {
      handleSupabaseError(`updatePlayer(${id})`, err);
      throw err;
    }
  }

  public async addPlayer(playerData: Partial<Player> & { name: string; currentTeam: string; sport: Player['sport'] }): Promise<Player> {
    try {
      const supabase = getSupabaseClient();
      const slug = playerData.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

      // Check if existing player with this slug or matching name
      const { data: existingRows, error: searchError } = await supabase
        .from('players')
        .select('*')
        .or(`id.eq.${slug},name.ilike.${playerData.name.trim()}`);

      if (searchError) {
        handleSupabaseError('addPlayer search', searchError);
      }

      const preset = POPULAR_PRESET_PLAYERS.find(p => p.name.toLowerCase() === playerData.name.toLowerCase());
      const existing = existingRows && existingRows.length > 0 ? existingRows[0] : null;

      if (existing) {
        const existingPlayer = rowToPlayer(existing);
        const updates: Partial<Player> = { active: true };
        if (playerData.currentTeam && playerData.currentTeam !== 'Unknown Team') {
          updates.currentTeam = playerData.currentTeam;
        } else if (preset) {
          updates.currentTeam = preset.currentTeam;
        }
        if (playerData.league) updates.league = playerData.league;
        if (playerData.sport) updates.sport = playerData.sport;
        if (playerData.position) updates.position = playerData.position;
        if (playerData.jerseyNumber) updates.jerseyNumber = playerData.jerseyNumber;
        if (playerData.nativeName) updates.nativeName = playerData.nativeName;
        if (playerData.teamLogo) updates.teamLogo = playerData.teamLogo;

        const updated = await this.updatePlayer(existingPlayer.id, updates);
        return updated || existingPlayer;
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

      const { data: inserted, error: insertError } = await supabase
        .from('players')
        .insert(playerToDbRow(newPlayer))
        .select('*')
        .single();

      if (insertError) {
        handleSupabaseError('addPlayer insert', insertError);
        throw insertError;
      }

      return inserted ? rowToPlayer(inserted) : newPlayer;
    } catch (err: any) {
      handleSupabaseError('addPlayer', err);
      throw err;
    }
  }

  public async removePlayer(id: string): Promise<boolean> {
    try {
      const supabase = getSupabaseClient();
      const { error } = await supabase
        .from('players')
        .delete()
        .eq('id', id);

      if (error) {
        handleSupabaseError(`removePlayer(${id})`, error);
        return false;
      }

      return true;
    } catch (err: any) {
      handleSupabaseError(`removePlayer(${id})`, err);
      return false;
    }
  }

  public async togglePlayerActive(id: string): Promise<Player | null> {
    try {
      const existing = await this.getById(id);
      if (!existing) return null;

      return await this.updatePlayer(id, { active: !existing.active });
    } catch (err: any) {
      handleSupabaseError(`togglePlayerActive(${id})`, err);
      throw err;
    }
  }

  public async importFromText(text: string): Promise<{ added: Player[]; total: number }> {
    const lines = text
      .split(/\r?\n|,|;/)
      .map(line => line.trim())
      .filter(line => line.length > 1);

    const added: Player[] = [];

    for (const line of lines) {
      const preset = POPULAR_PRESET_PLAYERS.find(p => 
        p.name.toLowerCase() === line.toLowerCase() || 
        (p.nativeName && p.nativeName.toLowerCase() === line.toLowerCase()) ||
        p.name.toLowerCase().includes(line.toLowerCase())
      );

      if (preset) {
        const addedPlayer = await this.addPlayer(preset);
        added.push(addedPlayer);
      } else {
        const isBasketball = line.toLowerCase().includes('nba') || line.toLowerCase().includes('basket');
        const cleanName = line.replace(/(\(.*\)|\[.*\])/g, '').trim();
        
        const addedPlayer = await this.addPlayer({
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

    const all = await this.getAll();
    return { added, total: all.length };
  }

  public async syncFromClientBackup(clientPlayers: Player[]): Promise<{ addedCount: number; total: number }> {
    if (!Array.isArray(clientPlayers) || clientPlayers.length === 0) {
      const all = await this.getAll();
      return { addedCount: 0, total: all.length };
    }

    const currentPlayers = await this.getAll();
    let addedCount = 0;

    for (const cp of clientPlayers) {
      if (!cp || !cp.name) continue;
      const existing = currentPlayers.find(p => p.id === cp.id || p.name.toLowerCase() === cp.name.toLowerCase());
      if (!existing) {
        const newPlayer: Player = {
          ...cp,
          id: cp.id || cp.name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
          addedAt: cp.addedAt || new Date().toISOString(),
        };
        await this.addPlayer(newPlayer);
        addedCount++;
      } else if (cp.active && !existing.active) {
        await this.updatePlayer(existing.id, { active: true });
      }
    }

    const total = (await this.getAll()).length;
    return { addedCount, total };
  }

  public async exportToText(): Promise<string> {
    const activePlayers = await this.getActive();
    return activePlayers
      .map(p => `${p.name} (${p.currentTeam} - ${p.sport.toUpperCase()})`)
      .join('\n');
  }

  public async getAvailablePresets(): Promise<Player[]> {
    const all = await this.getAll();
    const activeMap = new Map(all.map(p => [p.id, p.active]));
    return POPULAR_PRESET_PLAYERS.filter(p => !activeMap.has(p.id) || !activeMap.get(p.id));
  }

  public async resetToDefault(): Promise<void> {
    try {
      const supabase = getSupabaseClient();
      const { error: deleteErr } = await supabase
        .from('players')
        .delete()
        .neq('id', '');

      if (deleteErr) {
        handleSupabaseError('resetToDefault delete', deleteErr);
        throw deleteErr;
      }

      const rows = INITIAL_DEMO_PLAYERS.map(playerToDbRow);
      const { error: insertErr } = await supabase
        .from('players')
        .insert(rows);

      if (insertErr) {
        handleSupabaseError('resetToDefault insert', insertErr);
        throw insertErr;
      }
      console.log('[PlayerStore] Reset players table to default.');
    } catch (err: any) {
      handleSupabaseError('resetToDefault', err);
      throw err;
    }
  }
}

export const playerStore = new PlayerStore();
