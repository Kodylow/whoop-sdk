# Whoop SDK Demo App

A fullstack demo application showcasing the Whoop SDK with React frontend and Bun backend.

## Features

- 🔐 **Secure OAuth Authentication** - Complete Whoop OAuth2 flow
- 📊 **Recovery Dashboard** - Current recovery score, HRV, resting heart rate
- 📈 **Recovery Trends** - 7-day recovery and strain trends
- 😴 **Sleep Analytics** - Recent sleep performance and efficiency
- 🏋️ **Workout Tracking** - Recent workouts with strain data
- 🎨 **Modern UI** - Beautiful dashboard with Whoop brand colors
- ⚡ **Real-time Data** - Fetch fresh data from Whoop API

## Technology Stack

### Backend
- **Bun** - Fast JavaScript runtime and package manager
- **Express** - Web server framework
- **TypeScript** - Type safety
- **Whoop SDK** - Official Whoop API integration
- **Session Management** - Secure token storage

### Frontend
- **React 18** - Modern React with hooks
- **TypeScript** - Type safety
- **Vite** - Fast build tool and dev server
- **Tailwind CSS** - Utility-first CSS framework
- **Lucide React** - Beautiful icons
- **React Router** - Client-side routing

## Prerequisites

Before you begin, ensure you have:

1. **Node.js** (version 16 or higher)
2. **Bun** installed globally (`npm install -g bun`)
3. **Whoop Developer Account** and API credentials

### Getting Whoop API Credentials

1. Visit the [Whoop Developer Portal](https://developer.whoop.com/)
2. Create a developer account or sign in
3. Create a new application
4. Note down your `Client ID` and `Client Secret`
5. Set the redirect URI to: `http://localhost:3001/auth/whoop/callback`

## Installation

1. **Clone the repository:**
```bash
git clone <repository-url>
cd whoop-sdk/demo-app
```

2. **Install dependencies:**
```bash
npm run setup
```

This will install dependencies for both frontend and backend.

3. **Configure environment variables:**

The demo app uses the `.env` file from the parent directory (whoop-sdk root). Create or edit the `.env` file in the whoop-sdk directory:

```bash
cd .. # Go back to whoop-sdk root directory
```

Create or edit `.env` and add your Whoop credentials along with demo app configuration:
```env
# Whoop API Credentials
WHOOP_CLIENT_ID=your_whoop_client_id_here
WHOOP_CLIENT_SECRET=your_whoop_client_secret_here
WHOOP_REDIRECT_URI=http://localhost:3001/auth/whoop/callback

# Demo App Configuration
PORT=3001
NODE_ENV=development
FRONTEND_URL=http://localhost:5173
SESSION_SECRET=your-random-session-secret-here-change-in-production
```

## Development

### Run both frontend and backend simultaneously:

```bash
npm run dev
```

This will start:
- Backend server at `http://localhost:3001`
- Frontend dev server at `http://localhost:5173`

### Run individually:

**Backend only:**
```bash
npm run dev:backend
```

**Frontend only:**
```bash
npm run dev:frontend
```

## Usage

1. **Open your browser** to `http://localhost:5173`

2. **Click "Connect with Whoop"** to start the OAuth flow

3. **Authorize the application** on Whoop's website

4. **View your dashboard** with all your Whoop data:
   - Current recovery score
   - Recovery trends over the last 7 days
   - Recent sleep data
   - Recent workout data
   - Resting heart rate and HRV

## API Endpoints

The backend provides several endpoints:

### Authentication
- `GET /auth/whoop` - Start OAuth flow
- `GET /auth/whoop/callback` - OAuth callback
- `GET /api/auth/status` - Check authentication status
- `POST /api/auth/logout` - Logout user

### User Data
- `GET /api/user/profile` - User profile information
- `GET /api/user/summary` - Complete user summary
- `GET /api/user/recovery/current` - Current recovery data
- `GET /api/user/recovery/trends?days=7` - Recovery trends
- `GET /api/user/cycles?limit=10` - Recent cycles
- `GET /api/user/sleep?limit=10` - Recent sleep data
- `GET /api/user/workouts?limit=10` - Recent workouts
- `GET /api/user/body` - Body measurements

## Project Structure

```
demo-app/
├── backend/                 # Bun backend
│   ├── src/
│   │   └── index.ts        # Main server file
│   ├── package.json
│   └── tsconfig.json
├── frontend/               # React frontend
│   ├── src/
│   │   ├── components/
│   │   │   ├── Dashboard.tsx    # Main dashboard
│   │   │   ├── LoginPage.tsx    # OAuth login page
│   │   │   └── LoadingSpinner.tsx
│   │   ├── App.tsx         # Main app component
│   │   ├── main.tsx        # React entry point
│   │   └── index.css       # Global styles
│   ├── index.html
│   ├── package.json
│   ├── vite.config.ts      # Vite configuration
│   ├── tailwind.config.js  # Tailwind configuration
│   └── tsconfig.json
├── package.json            # Root package.json
└── README.md
```

## Features in Detail

### OAuth Authentication
The app implements the complete OAuth2 flow:
1. User clicks "Connect with Whoop"
2. Redirected to Whoop's authorization server
3. User authorizes the application
4. Whoop redirects back with authorization code
5. Backend exchanges code for access/refresh tokens
6. Tokens stored securely in server session

### Dashboard Components

**Recovery Cards:** Show current recovery score, resting heart rate, HRV, and strain with color-coded indicators.

**Recovery Trends:** 7-day chart showing recovery scores and strain values over time.

**Sleep Overview:** Recent sleep sessions with performance metrics and efficiency scores.

**Workout Summary:** Recent workouts with strain data and heart rate information.

### Data Management
- All API calls are made from the backend to maintain security
- Tokens are stored server-side in encrypted sessions
- Frontend makes authenticated requests to backend APIs
- Automatic token refresh handled by the Whoop SDK

## Troubleshooting

### Common Issues

**OAuth Errors:**
- Verify your Whoop client ID and secret are correct
- Ensure the redirect URI in your Whoop app matches exactly
- Check that the Whoop app is not in sandbox mode (unless intended)

**No Recovery Data:**
- New Whoop users may be in "calibration" mode for several days
- The app will show a calibration message for these users

**Connection Errors:**
- Ensure both frontend and backend are running
- Check that ports 3001 and 5173 are available
- Verify the CORS configuration allows the frontend URL

**Build Errors:**
- Make sure you have the latest Node.js version
- Try deleting node_modules and reinstalling dependencies
- Ensure Bun is properly installed

### Debug Mode

To enable detailed logging, set in your `.env`:
```env
NODE_ENV=development
```

This will show detailed OAuth flow logs and API request/response information.

## Production Deployment

### Backend
1. Set `NODE_ENV=production`
2. Generate a secure session secret
3. Configure your production domain in Whoop app settings
4. Use HTTPS for all endpoints

### Frontend
1. Build the production bundle: `npm run build:frontend`
2. Serve the `dist` folder with your preferred static hosting
3. Update `FRONTEND_URL` in backend configuration

## Security Considerations

- Never expose your Whoop client secret in frontend code
- Use HTTPS in production
- Generate strong session secrets
- Implement proper CSRF protection for production use
- Consider implementing rate limiting

## License

This demo app is provided as an example implementation. Check the main Whoop SDK license for usage terms.

## Support

For issues with:
- **The Whoop SDK:** Check the main repository issues
- **This demo app:** Open an issue in this repository
- **Whoop API:** Consult the [Whoop Developer Documentation](https://developer.whoop.com/docs) 