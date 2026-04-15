# STRIKER Backend

Node.js + Express backend for the STRIKER college football tournament platform.

## Setup

1. Install dependencies:
```bash
npm install
```

2. Create environment file:
```bash
cp .env.example .env
```

3. Fill in your Supabase credentials in `.env`:
- `SUPABASE_URL` - Your Supabase project URL
- `SUPABASE_SERVICE_KEY` - Your Supabase service key
- `PORT` - Server port (default: 4000)
- `ADMIN_PASSWORD` - Controller dashboard password (default: xlr8_dev)

4. Start development server:
```bash
npm run dev
```

## Database Schema

Create these tables in your Supabase project:

```sql
create table teams (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  created_at timestamptz default now()
);

create table players (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  team_id uuid references teams(id) on delete set null,
  position text,
  created_at timestamptz default now()
);

create table matches (
  id uuid primary key default gen_random_uuid(),
  team_a_id uuid references teams(id),
  team_b_id uuid references teams(id),
  date date not null,
  time time not null,
  status text default 'scheduled',
  score_a int default 0,
  score_b int default 0,
  created_at timestamptz default now()
);

create table match_events (
  id uuid primary key default gen_random_uuid(),
  match_id uuid references matches(id) on delete cascade,
  type text not null,
  team_id uuid references teams(id),
  player_id uuid references players(id),
  minute int,
  created_at timestamptz default now()
);
```

## API Routes

- `POST /api/auth/login` - Admin authentication
- `GET /api/teams` - Get all teams
- `GET /api/players` - Get all players
- `PUT /api/players/:id` - Update player
- `DELETE /api/players/:id` - Delete player
- `POST /api/import/auction-results` - Import auction results
- `GET /api/matches` - Get all matches
- `POST /api/matches` - Create match
- `PUT /api/matches/:id` - Update match
- `DELETE /api/matches/:id` - Delete match
- `PUT /api/matches/:id/status` - Update match status
- `GET /api/matches/:id/events` - Get match events
- `POST /api/matches/:id/events` - Create match event
- `DELETE /api/matches/:id/events/last` - Delete last event
- `GET /api/standings` - Get league standings
- `GET /api/stats/top-scorers` - Get top scorers
- `GET /api/stats/discipline` - Get discipline stats

## Socket.IO Events

- `fixtures:updated` - Emitted when fixtures are created/updated/deleted
- `match:updated` - Emitted when match status or events change
