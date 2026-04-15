# STRIKER

College football tournament platform with live scoring and auction drafts.

## Project Structure

```
striker/
|-- frontend/          # Next.js 14 frontend (Vercel)
|   |-- app/
|   |   |-- page.tsx           # Landing page
|   |   |-- controller/page.tsx # Admin dashboard
|   |   |-- watch/page.tsx      # Public live view
|   |-- components/
|   |-- lib/
|   |-- package.json
|   |-- tailwind.config.js
|   |-- tsconfig.json
|   `-- README.md
|
|-- backend/           # Node.js + Express backend (Railway)
|   |-- routes/
|   |   |-- auth.js
|   |   |-- teams.js
|   |   |-- players.js
|   |   |-- matches.js
|   |   |-- events.js
|   |   |-- standings.js
|   |   `-- importResults.js
|   |-- lib/
|   |   `-- supabase.js
|   |-- index.js
|   |-- package.json
|   |-- .env.example
|   `-- README.md
```

## Tech Stack

**Frontend:**
- Next.js 14 (App Router)
- TypeScript
- Tailwind CSS
- Google Fonts (Bebas Neue, Outfit, JetBrains Mono)
- Socket.IO Client
- GSAP + ScrollTrigger
- Three.js

**Backend:**
- Node.js + Express
- Socket.IO
- Supabase (PostgreSQL)
- CORS

## Features

- **Landing Page**: Cinematic experience with Three.js background, animated stats, fixtures
- **Controller Dashboard**: Password-protected admin interface for managing teams, players, matches, live scoring
- **Live Watch Page**: Public view for real-time match updates
- **Real-time Updates**: Socket.IO integration for live scoring
- **Auction Import**: Excel file import for auction results
- **Standings & Stats**: Automatic calculation of league standings, top scorers, discipline

## Design System

### Colors
- Dark: `#0D0C0A` (hero, controller)
- Light: `#F5F2ED` (content sections)
- Surface: `#FFFFFF` (cards on light)
- Gold: `#C8A84B` (primary accent)
- Crimson: `#C1392B` (live status)

### Typography
- **Bebas Neue**: Headings, team names, scores
- **Outfit**: Body text, labels, buttons
- **JetBrains Mono**: Numbers, stats, data

## Quick Start

### Backend Setup

1. Navigate to backend directory:
```bash
cd backend
```

2. Install dependencies:
```bash
npm install
```

3. Create environment file:
```bash
cp .env.example .env
```

4. Configure Supabase credentials in `.env`

5. Set up database tables (see backend/README.md)

6. Start backend:
```bash
npm run dev
```

### Frontend Setup

1. Navigate to frontend directory:
```bash
cd frontend
```

2. Install dependencies:
```bash
npm install
```

3. Create environment file:
```bash
cp .env.example .env.local
```

4. Start frontend:
```bash
npm run dev
```

## Default Access

- **Controller Dashboard**: `/controller`
- **Password**: `xlr8_dev`
- **API Base**: `http://localhost:4000/api`

## Deployment

- **Frontend**: Vercel (Next.js)
- **Backend**: Railway (Node.js)
- **Database**: Supabase

## API Documentation

See `backend/README.md` for complete API documentation.

## Socket.IO Events

- `fixtures:updated` - Fixtures changed
- `match:updated` - Match status/events changed
