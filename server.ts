import express from 'express';
import path from 'path';
import crypto from 'crypto';
import dotenv from 'dotenv';
import { createServer as createViteServer } from 'vite';
import { playerStore } from './server/services/playerStore';
import { fetchAllActiveFixtures, fetchPlayerFixtures, lookupAthleteDetails, clearPlayerFixtureCache } from './server/services/sportsDataService';
import { ISRAELI_CHANNELS_GUIDE } from './server/services/israeliBroadcastService';
import { isAdminEmail, verifyAdminCredentials } from './server/config/adminConfig';

dotenv.config();

// In-memory active administrator sessions
interface AdminSession {
  email: string;
  createdAt: number;
  expiresAt: number;
}

const activeSessions = new Map<string, AdminSession>();

// Cleanup expired sessions periodically
setInterval(() => {
  const now = Date.now();
  for (const [token, session] of activeSessions.entries()) {
    if (session.expiresAt <= now) {
      activeSessions.delete(token);
    }
  }
}, 60 * 60 * 1000);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Helper middleware for admin-only mutation endpoints with token validation
  const requireAdmin = (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const authHeader = req.headers.authorization || '';
    const customHeader = (req.headers['x-admin-token'] as string) || '';
    let token = '';

    if (authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7).trim();
    } else if (customHeader) {
      token = customHeader.trim();
    }

    if (!token) {
      return res.status(401).json({
        error: 'Authentication required. Please sign in with administrator credentials.',
      });
    }

    const session = activeSessions.get(token);
    if (!session || session.expiresAt <= Date.now()) {
      if (session) activeSessions.delete(token);
      return res.status(401).json({
        error: 'Administrator session expired or invalid. Please sign in again.',
      });
    }

    if (!isAdminEmail(session.email)) {
      activeSessions.delete(token);
      return res.status(403).json({
        error: 'Forbidden: Account does not have administrator privileges.',
      });
    }

    (req as any).adminEmail = session.email;
    next();
  };

  // API Routes
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', time: new Date().toISOString() });
  });

  // Admin Authentication Endpoints
  app.post('/api/auth/login', (req, res) => {
    try {
      const { email, password } = req.body;
      if (!email || !password) {
        return res.status(400).json({ error: 'Email and password are required.' });
      }

      const cleanEmail = email.toLowerCase().trim();
      const isValid = verifyAdminCredentials(cleanEmail, password);

      if (!isValid) {
        // Generic error - never reveals whether email exists
        return res.status(401).json({
          error: 'Invalid administrator email or password. Access denied.',
        });
      }

      // Generate secure session token
      const token = crypto.randomBytes(32).toString('hex');
      const sessionDurationMs = 7 * 24 * 60 * 60 * 1000; // 7 days
      activeSessions.set(token, {
        email: cleanEmail,
        createdAt: Date.now(),
        expiresAt: Date.now() + sessionDurationMs,
      });

      res.json({
        success: true,
        token,
        user: {
          email: cleanEmail,
          name: cleanEmail.split('@')[0],
          isAdmin: true,
        },
      });
    } catch (err: any) {
      res.status(500).json({ error: 'Authentication error occurred.' });
    }
  });

  // Verify existing admin session
  app.post('/api/auth/verify', (req, res) => {
    try {
      const authHeader = req.headers.authorization || '';
      const customHeader = (req.headers['x-admin-token'] as string) || '';
      let token = '';

      if (authHeader.startsWith('Bearer ')) {
        token = authHeader.substring(7).trim();
      } else if (customHeader) {
        token = customHeader.trim();
      }

      if (!token) {
        return res.status(401).json({ valid: false });
      }

      const session = activeSessions.get(token);
      if (!session || session.expiresAt <= Date.now() || !isAdminEmail(session.email)) {
        if (session) activeSessions.delete(token);
        return res.status(401).json({ valid: false });
      }

      res.json({
        valid: true,
        user: {
          email: session.email,
          name: session.email.split('@')[0],
          isAdmin: true,
        },
      });
    } catch (err) {
      res.status(500).json({ valid: false });
    }
  });

  // Logout admin session
  app.post('/api/auth/logout', (req, res) => {
    try {
      const authHeader = req.headers.authorization || '';
      const customHeader = (req.headers['x-admin-token'] as string) || '';
      let token = '';

      if (authHeader.startsWith('Bearer ')) {
        token = authHeader.substring(7).trim();
      } else if (customHeader) {
        token = customHeader.trim();
      }

      if (token) {
        activeSessions.delete(token);
      }

      res.json({ success: true });
    } catch (err) {
      res.json({ success: true });
    }
  });

  // Get all players
  app.get('/api/players', (req, res) => {
    try {
      const allPlayers = playerStore.getAll();
      const presets = playerStore.getAvailablePresets();
      res.json({ players: allPlayers, presets });
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Failed to fetch players' });
    }
  });

  // Add new player (Admin Only)
  app.post('/api/players', requireAdmin, async (req, res) => {
    try {
      const { name, currentTeam, sport, league, country, position, jerseyNumber, nativeName } = req.body;
      if (!name || name.trim() === '') {
        return res.status(400).json({ error: 'Player name is required' });
      }

      // If team not provided or user requested auto-enrichment, look up via AI/Sports data
      let finalTeam = currentTeam;
      let finalSport = sport;
      let finalLeague = league;
      let finalPos = position;
      let finalJersey = jerseyNumber;
      let finalNative = nativeName;

      if (!finalTeam || finalTeam.trim() === '') {
        const lookedUp = await lookupAthleteDetails(name.trim());
        if (lookedUp) {
          finalTeam = lookedUp.currentTeam;
          finalSport = lookedUp.sport;
          finalLeague = lookedUp.league;
          finalPos = lookedUp.position;
          finalJersey = lookedUp.jerseyNumber;
          finalNative = lookedUp.nativeName;
        }
      }

      const player = playerStore.addPlayer({
        name: name.trim(),
        nativeName: finalNative,
        currentTeam: finalTeam || 'Top Flight Club',
        sport: finalSport || 'football',
        league: finalLeague || 'Major League',
        country: country || 'International',
        position: finalPos || 'Athlete',
        jerseyNumber: finalJersey || '',
      });

      res.status(201).json({ player });
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Failed to add player' });
    }
  });

  // Lookup athlete info dynamically
  app.post('/api/players/lookup', async (req, res) => {
    try {
      const { name } = req.body;
      if (!name) return res.status(400).json({ error: 'Name is required' });

      const details = await lookupAthleteDetails(name);
      if (!details) {
        return res.json({
          found: false,
          suggestion: {
            name,
            sport: 'football',
            currentTeam: 'Club Football',
            league: 'Premier League',
            position: 'Forward'
          }
        });
      }

      res.json({ found: true, details });
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Lookup failed' });
    }
  });

  // Delete player (Admin Only)
  app.delete('/api/players/:id', requireAdmin, (req, res) => {
    try {
      const { id } = req.params;
      const removed = playerStore.removePlayer(id);
      if (!removed) {
        return res.status(404).json({ error: 'Player not found' });
      }
      clearPlayerFixtureCache(id);
      res.json({ success: true, id });
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Failed to delete player' });
    }
  });

  // Update / Edit player (Admin Only)
  app.put('/api/players/:id', requireAdmin, (req, res) => {
    try {
      const { id } = req.params;
      const updates = req.body;
      const updated = playerStore.updatePlayer(id, updates);
      if (!updated) {
        return res.status(404).json({ error: 'Player not found' });
      }
      clearPlayerFixtureCache(id);
      res.json({ success: true, player: updated });
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Failed to update player' });
    }
  });

  // Toggle active state (Admin Only)
  app.patch('/api/players/:id/toggle', requireAdmin, (req, res) => {
    try {
      const { id } = req.params;
      const updated = playerStore.togglePlayerActive(id);
      if (!updated) {
        return res.status(404).json({ error: 'Player not found' });
      }
      res.json({ player: updated });
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Failed to toggle player' });
    }
  });

  // Import raw text list (Admin Only)
  app.post('/api/players/import-text', requireAdmin, (req, res) => {
    try {
      const { text } = req.body;
      if (!text || typeof text !== 'string') {
        return res.status(400).json({ error: 'Text content is required' });
      }
      const result = playerStore.importFromText(text);
      res.json({ success: true, added: result.added, total: result.total });
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Failed to import text' });
    }
  });

  // Client roster persistent auto-recovery sync (Admin Only)
  app.post('/api/players/sync-backup', requireAdmin, (req, res) => {
    try {
      const { players } = req.body;
      if (!Array.isArray(players)) {
        return res.status(400).json({ error: 'Players array required' });
      }
      const result = playerStore.syncFromClientBackup(players);
      res.json({ success: true, ...result, players: playerStore.getAll() });
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Failed to sync backup' });
    }
  });

  // Export raw text list
  app.get('/api/players/export-text', (req, res) => {
    try {
      const text = playerStore.exportToText();
      res.setHeader('Content-Type', 'text/plain');
      res.send(text);
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Failed to export text' });
    }
  });

  // Get all fixtures with filters
  app.get('/api/fixtures', async (req, res) => {
    try {
      const { search, sport, playerId, timeframe, force } = req.query;
      const players = playerStore.getActive();
      const allFixtures = await fetchAllActiveFixtures(players, force === 'true');

      let filtered = allFixtures;

      // Filter by specific player
      if (playerId && typeof playerId === 'string' && playerId !== 'all') {
        filtered = filtered.filter(f => f.playerId === playerId);
      }

      // Filter by sport
      if (sport && typeof sport === 'string' && sport !== 'all') {
        filtered = filtered.filter(f => f.sport === sport);
      }

      // Search filter
      if (search && typeof search === 'string' && search.trim() !== '') {
        const q = search.toLowerCase().trim();
        filtered = filtered.filter(f =>
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

      // Timeframe filter
      if (timeframe && typeof timeframe === 'string' && timeframe !== 'all') {
        const now = new Date();
        const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const endOfToday = new Date(startOfToday.getTime() + 24 * 60 * 60 * 1000);
        const endOfTomorrow = new Date(startOfToday.getTime() + 48 * 60 * 60 * 1000);
        const endOfWeek = new Date(startOfToday.getTime() + 7 * 24 * 60 * 60 * 1000);

        filtered = filtered.filter(f => {
          const matchDate = new Date(f.dateTimeUtc);
          if (timeframe === 'today') {
            return matchDate >= startOfToday && matchDate < endOfToday;
          } else if (timeframe === 'tomorrow') {
            return matchDate >= endOfToday && matchDate < endOfTomorrow;
          } else if (timeframe === 'this_week') {
            return matchDate >= startOfToday && matchDate < endOfWeek;
          } else if (timeframe === 'upcoming') {
            return matchDate >= startOfToday;
          }
          return true;
        });
      }

      res.json({ fixtures: filtered, total: filtered.length });
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Failed to fetch fixtures' });
    }
  });

  // Force Live Sync from ESPN & Search Grounding
  app.post('/api/fixtures/sync-live', async (req, res) => {
    try {
      clearPlayerFixtureCache();
      const players = playerStore.getActive();
      const allFixtures = await fetchAllActiveFixtures(players, true);
      res.json({
        success: true,
        count: allFixtures.length,
        sources: {
          espn: allFixtures.filter(f => f.dataSource === 'espn_live').length,
          searchGrounded: allFixtures.filter(f => f.dataSource === 'search_grounded').length,
          calendar: allFixtures.filter(f => f.dataSource === 'official_calendar').length,
        },
        fixtures: allFixtures,
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Failed to sync live fixtures' });
    }
  });

  // Get fixtures for a single player
  app.get('/api/fixtures/player/:id', async (req, res) => {
    try {
      const { id } = req.params;
      const player = playerStore.getById(id);
      if (!player) {
        return res.status(404).json({ error: 'Player not found' });
      }
      const fixtures = await fetchPlayerFixtures(player);
      res.json({ player, fixtures });
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Failed to fetch player fixtures' });
    }
  });

  // Israeli TV Channels Guide
  app.get('/api/channels', (req, res) => {
    res.json({ channels: ISRAELI_CHANNELS_GUIDE });
  });

  // Vite middleware setup
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
});
