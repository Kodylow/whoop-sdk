import express from 'express';
import cors from 'cors';
import session from 'express-session';
import cookieParser from 'cookie-parser';
import { config } from 'dotenv';
import { WhoopSDK, getRecommendedScopes } from '@whoop/sdk';
import path from 'path';

// Load environment variables from parent directory
config({ path: path.resolve(__dirname, '../../../.env') });

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true
}));
app.use(express.json());
app.use(cookieParser());
app.use(session({
  secret: process.env.SESSION_SECRET || 'your-session-secret-change-in-production',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
  }
}));

// Extend session type
declare module 'express-session' {
  interface SessionData {
    tokens?: {
      access_token: string;
      refresh_token?: string;
      expires_in?: number;
      token_type?: string;
      scope?: string;
    };
    userId?: string;
  }
}

// Initialize Whoop SDK for OAuth
const whoopOAuth = new WhoopSDK({
  oauth: {
    clientId: process.env.WHOOP_CLIENT_ID!,
    clientSecret: process.env.WHOOP_CLIENT_SECRET!,
    redirectUri: process.env.WHOOP_REDIRECT_URI || 'http://localhost:3001/auth/whoop/callback',
    scopes: getRecommendedScopes()
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

// OAuth routes
app.get('/auth/whoop', (req, res) => {
  try {
    const state = Math.random().toString(36).substring(2);
    req.session.oauthState = state;
    
    const authUrl = whoopOAuth.auth!.getAuthorizationUrl({ state });
    res.redirect(authUrl);
  } catch (error) {
    console.error('Error initiating OAuth:', error);
    res.status(500).json({ error: 'Failed to initiate authentication' });
  }
});

app.get('/auth/whoop/callback', async (req, res) => {
  try {
    const { code, state, error } = req.query;

    if (error) {
      console.error('OAuth error:', error);
      return res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:5173'}?error=oauth_error`);
    }

    if (!code || typeof code !== 'string') {
      return res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:5173'}?error=no_code`);
    }

    // Verify state parameter
    if (state !== req.session.oauthState) {
      console.error('State mismatch in OAuth callback');
      return res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:5173'}?error=state_mismatch`);
    }

    // Exchange code for tokens
    const tokens = await whoopOAuth.auth!.exchangeCodeForTokens(code);
    
    // Store tokens in session
    req.session.tokens = tokens;
    
    // Clean up state
    delete req.session.oauthState;
    
    console.log('OAuth successful, redirecting to frontend');
    res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:5173'}?auth=success`);
  } catch (error) {
    console.error('Error in OAuth callback:', error);
    res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:5173'}?error=callback_error`);
  }
});

// Authentication status endpoint
app.get('/api/auth/status', (req, res) => {
  const isAuthenticated = !!(req.session.tokens?.access_token);
  res.json({ 
    authenticated: isAuthenticated,
    hasTokens: !!req.session.tokens
  });
});

// Logout endpoint
app.post('/api/auth/logout', async (req, res) => {
  try {
    if (req.session.tokens?.access_token) {
      // Try to revoke the token
      try {
        const whoopClient = WhoopSDK.withTokens(
          req.session.tokens.access_token,
          req.session.tokens.refresh_token
        );
        // Note: Token revocation would need to be implemented in the SDK
        // For now, just clear the session
      } catch (revokeError) {
        console.warn('Failed to revoke token:', revokeError);
      }
    }

    req.session.destroy((err) => {
      if (err) {
        console.error('Error destroying session:', err);
        return res.status(500).json({ error: 'Failed to logout' });
      }
      res.clearCookie('connect.sid');
      res.json({ success: true });
    });
  } catch (error) {
    console.error('Error during logout:', error);
    res.status(500).json({ error: 'Failed to logout' });
  }
});

// Middleware to check authentication
const requireAuth = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  if (!req.session.tokens?.access_token) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  next();
};

// User profile endpoint
app.get('/api/user/profile', requireAuth, async (req, res) => {
  try {
    const whoopClient = WhoopSDK.withTokens(
      req.session.tokens!.access_token,
      req.session.tokens!.refresh_token
    );

    const profile = await whoopClient.profile.getProfile();
    res.json(profile);
  } catch (error) {
    console.error('Error fetching user profile:', error);
    res.status(500).json({ error: 'Failed to fetch user profile' });
  }
});

// Current recovery endpoint
app.get('/api/user/recovery/current', requireAuth, async (req, res) => {
  try {
    const whoopClient = WhoopSDK.withTokens(
      req.session.tokens!.access_token,
      req.session.tokens!.refresh_token
    );

    const recovery = await whoopClient.getCurrentRecovery();
    res.json(recovery);
  } catch (error) {
    console.error('Error fetching current recovery:', error);
    res.status(500).json({ error: 'Failed to fetch recovery data' });
  }
});

// User summary endpoint
app.get('/api/user/summary', requireAuth, async (req, res) => {
  try {
    const whoopClient = WhoopSDK.withTokens(
      req.session.tokens!.access_token,
      req.session.tokens!.refresh_token
    );

    const summary = await whoopClient.getUserSummary();
    res.json(summary);
  } catch (error) {
    console.error('Error fetching user summary:', error);
    res.status(500).json({ error: 'Failed to fetch user summary' });
  }
});

// Recent recovery trends endpoint
app.get('/api/user/recovery/trends', requireAuth, async (req, res) => {
  try {
    const days = parseInt(req.query.days as string) || 7;
    const whoopClient = WhoopSDK.withTokens(
      req.session.tokens!.access_token,
      req.session.tokens!.refresh_token
    );

    const trends = await whoopClient.getRecentRecoveryScores(days);
    res.json(trends);
  } catch (error) {
    console.error('Error fetching recovery trends:', error);
    res.status(500).json({ error: 'Failed to fetch recovery trends' });
  }
});

// Cycles endpoint
app.get('/api/user/cycles', requireAuth, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit as string) || 10;
    const whoopClient = WhoopSDK.withTokens(
      req.session.tokens!.access_token,
      req.session.tokens!.refresh_token
    );

    const cycles = await whoopClient.cycles.list({ limit });
    res.json(cycles);
  } catch (error) {
    console.error('Error fetching cycles:', error);
    res.status(500).json({ error: 'Failed to fetch cycles data' });
  }
});

// Sleep data endpoint
app.get('/api/user/sleep', requireAuth, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit as string) || 10;
    const whoopClient = WhoopSDK.withTokens(
      req.session.tokens!.access_token,
      req.session.tokens!.refresh_token
    );

    const sleepData = await whoopClient.sleep.list({ limit });
    res.json(sleepData);
  } catch (error) {
    console.error('Error fetching sleep data:', error);
    res.status(500).json({ error: 'Failed to fetch sleep data' });
  }
});

// Workouts endpoint
app.get('/api/user/workouts', requireAuth, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit as string) || 10;
    const whoopClient = WhoopSDK.withTokens(
      req.session.tokens!.access_token,
      req.session.tokens!.refresh_token
    );

    const workouts = await whoopClient.workouts.list({ limit });
    res.json(workouts);
  } catch (error) {
    console.error('Error fetching workouts:', error);
    res.status(500).json({ error: 'Failed to fetch workouts data' });
  }
});

// Body measurement endpoint
app.get('/api/user/body', requireAuth, async (req, res) => {
  try {
    const whoopClient = WhoopSDK.withTokens(
      req.session.tokens!.access_token,
      req.session.tokens!.refresh_token
    );

    const bodyMeasurement = await whoopClient.body.getMeasurement();
    res.json(bodyMeasurement);
  } catch (error) {
    console.error('Error fetching body measurement:', error);
    res.status(500).json({ error: 'Failed to fetch body measurement' });
  }
});

// Error handling middleware
app.use((error: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Unhandled error:', error);
  res.status(500).json({ error: 'Internal server error' });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

app.listen(PORT, () => {
  console.log(`🚀 Whoop Demo Backend running on port ${PORT}`);
  console.log(`📋 Health check: http://localhost:${PORT}/health`);
  console.log(`🔐 OAuth start: http://localhost:${PORT}/auth/whoop`);
  
  // Check required environment variables
  if (!process.env.WHOOP_CLIENT_ID) {
    console.warn('⚠️  WHOOP_CLIENT_ID not set in environment variables');
  }
  if (!process.env.WHOOP_CLIENT_SECRET) {
    console.warn('⚠️  WHOOP_CLIENT_SECRET not set in environment variables');
  }
}); 