# STRIKER Frontend

Next.js 14 frontend for the STRIKER college football tournament platform.

## Setup

1. Install dependencies:
```bash
npm install
```

2. Create environment variables:
```bash
cp .env.example .env.local
```

3. Start development server:
```bash
npm run dev
```

## Environment Variables

- `NEXT_PUBLIC_API_URL` - Backend API URL (default: http://localhost:4000/api)
- `NEXT_PUBLIC_SOCKET_URL` - Socket.IO server URL (default: http://localhost:4000)

## Project Structure

- `app/` - Next.js 14 app router pages
- `components/` - Reusable React components
- `lib/` - Utility functions and API client

## Pages

- `/` - Landing page (public)
- `/controller` - Admin dashboard (password protected)
- `/watch` - Public live match view
