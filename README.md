# Aurix — Your AI Trading Co-Pilot

A full-stack production-ready AI trading webapp with real-time crypto tracking, Indian stock monitoring, sentiment analysis, and AI-powered insights.

## Features

- **Real-time Crypto Tracking** - Live price updates for Top 10 cryptocurrencies via Binance WebSocket
- **Indian Stock Market** - NIFTY 50 delayed data via Yahoo Finance
- **AI-Powered Analysis** - Market insights using Gemini/Groq models
- **Sentiment Engine** - Reddit, Twitter, and Fear & Greed Index aggregation
- **On-Chain Monitoring** - Whale alerts and exchange flow tracking
- **Portfolio Tracking** - PnL calculation and risk assessment
- **Advanced Alerts** - Custom condition-based notifications
- **Daily AI Reports** - Comprehensive market analysis (Pro feature)

## Tech Stack

### Frontend
- Next.js 14 (App Router)
- TypeScript
- TailwindCSS
- Shadcn UI
- Firebase Auth
- Zustand (state management)

### Backend
- Node.js + Fastify
- TypeScript
- WebSocket support
- Redis (Upstash)
- Firebase Admin SDK
- Binance WebSocket API

### AI
- Google Gemini (primary)
- Groq (fallback)

### Infrastructure
- Vercel (frontend)
- Railway/Render (backend)
- Firebase (Auth + Firestore)
- Upstash Redis
- Resend (email)

## Project Structure

```
/aurix
├── apps/
│   ├── web/              # Next.js frontend
│   └── server/           # Fastify backend
├── packages/
│   ├── types/            # Shared TypeScript types
│   └── utils/            # Shared utility functions
├── package.json
├── pnpm-workspace.yaml
└── README.md
```

## Getting Started

### Prerequisites
- Node.js 18+
- pnpm 8+
- Firebase project
- Upstash Redis instance
- Resend account (for emails)

### Installation

1. Clone the repository:
```bash
git clone https://github.com/yourusername/aurix.git
cd aurix
```

2. Install dependencies:
```bash
pnpm install
```

3. Set up environment variables:
```bash
cp .env.example apps/web/.env.local
cp .env.example apps/server/.env
```

Fill in your API keys in both files.

4. Start development servers:
```bash
# Start both frontend and backend
pnpm dev

# Or individually
pnpm --filter @aurix/web dev
pnpm --filter @aurix/server dev
```

### Environment Variables

#### Frontend (.env.local)
```
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_API_URL=http://localhost:3001
```

#### Backend (.env)
```
# Binance
BINANCE_WS_URL=wss://stream.binance.com:9443/ws

# AI
GEMINI_API_KEY=
GROQ_API_KEY=

# Redis
UPSTASH_REDIS_URL=
UPSTASH_REDIS_TOKEN=

# Firebase
FIREBASE_PROJECT_ID=
FIREBASE_CLIENT_EMAIL=
FIREBASE_PRIVATE_KEY=

# Email
RESEND_API_KEY=
```

## Deployment

### Frontend (Vercel)

1. Connect your GitHub repo to Vercel
2. Set root directory to `apps/web`
3. Add environment variables
4. Deploy

### Backend (Railway)

1. Create new project from GitHub repo
2. Set root directory to `apps/server`
3. Add environment variables
4. Deploy

### Alternative: Render

1. Create new Web Service
2. Connect GitHub repo
3. Set build command: `pnpm install && pnpm build`
4. Set start command: `pnpm start`
5. Add environment variables

## API Documentation

### Authentication
- `POST /auth/login` - Login with Firebase token
- `POST /auth/register` - Create new account

### Market Data
- `GET /market/crypto` - List all crypto prices
- `GET /market/crypto/:symbol` - Get specific crypto data
- `GET /market/stocks` - List all stocks
- `GET /market/pulse` - Market pulse metrics

### Portfolio
- `GET /portfolio` - Get user portfolio
- `POST /portfolio` - Add position
- `PUT /portfolio/:id` - Update position
- `DELETE /portfolio/:id` - Remove position

### Alerts
- `GET /alerts` - List user alerts
- `POST /alerts` - Create alert
- `PUT /alerts/:id` - Update alert
- `DELETE /alerts/:id` - Delete alert

### AI
- `POST /ai/analyze` - Analyze asset
- `GET /ai/reports` - Get AI reports (Pro only)

## Freemium Limits

| Feature | Free | Pro |
|---------|------|-----|
| Watchlist Assets | 3 | 50 |
| Active Alerts | 2 | Unlimited |
| AI Queries/Day | 5 | Unlimited |
| Portfolio Assets | 10 | 100 |
| Daily Reports | ❌ | ✅ |

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

MIT License - see LICENSE file for details

## Disclaimer

Aurix is for informational purposes only. Not financial advice. Trading involves risk.
