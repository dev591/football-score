const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'https://football-score-production.up.railway.app/api'

export interface Team {
  id: string
  name: string
  owner_name?: string
  created_at: string
}

export interface Player {
  id: string
  name: string
  team_id: string
  is_captain: boolean
  position?: string
  team?: { name: string }
}

export interface Match {
  id: string
  team_a_id: string
  team_b_id: string
  date: string
  time: string
  status: 'scheduled' | 'live' | 'ft' | 'ht'
  bracket_type?: 'group' | 'qf' | 'sf' | 'final' | 'eliminator'
  score_a?: number
  score_b?: number
  event_count?: number
  stoppage_time?: number
  started_at?: string
  team_a?: { name: string; owner_name: string }
  team_b?: { name: string; owner_name: string }
  star_player_id?: string
  star_player_note?: string
  result_override?: 'team_a' | 'team_b' | 'draw'
  events?: MatchEvent[]
}

export interface MatchEvent {
  id: string
  match_id: string
  type: 'goal' | 'yellow' | 'red' | 'sub'
  team_id: string
  player_id: string
  player_in_id?: string // for substitutions
  minute: number
  created_at: string
  player?: Player
  team?: Team
}

export interface Standing {
  position: number
  team: string
  owner?: string
  played: number
  won: number
  drawn: number
  lost: number
  goals_for: number
  goals_against: number
  goal_difference: number
  points: number
}

export interface TopScorer {
  rank?: number
  player: string
  team: string
  goals: number
}

export interface Discipline {
  player: string
  team: string
  yellow: number
  red: number
}

export interface StarPlayer {
  player_name: string
  team_name?: string
  star_count: number
}

export interface GlobalStats {
  totalTeams: number
  totalPlayers: number
  totalMatches: number
}

// API Functions
export const api = {
  // Auth
  async login(password: string) {
    const response = await fetch(`${API_BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password })
    })
    return response.json()
  },

  // Teams
  async getTeams(): Promise<Team[]> {
    const response = await fetch(`${API_BASE_URL}/teams`)
    return response.json()
  },

  async createTeam(name: string) {
    const response = await fetch(`${API_BASE_URL}/teams`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name })
    })
    return response.json()
  },

  async updateTeam(id: string, name: string) {
    const response = await fetch(`${API_BASE_URL}/teams/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name })
    })
    return response.json()
  },

  // Players
  async getPlayers(teamId?: string): Promise<Player[]> {
    const url = teamId ? `${API_BASE_URL}/players?team_id=${teamId}` : `${API_BASE_URL}/players`
    const response = await fetch(url)
    return response.json()
  },

  async createPlayer(data: Partial<Player>) {
    const response = await fetch(`${API_BASE_URL}/players`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    })
    return response.json()
  },

  async updatePlayer(id: string, data: Partial<Player>) {
    const response = await fetch(`${API_BASE_URL}/players/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    })
    return response.json()
  },

  async setCaptain(id: string) {
    const response = await fetch(`${API_BASE_URL}/players/${id}/set-captain`, {
      method: 'PUT'
    })
    return response.json()
  },

  async deletePlayer(id: string) {
    const response = await fetch(`${API_BASE_URL}/players/${id}`, {
      method: 'DELETE'
    })
    return response.json()
  },

  // Import
  async importAuctionResults(players: { name: string; team: string; is_captain?: boolean; owner_name?: string }[]) {
    const response = await fetch(`${API_BASE_URL}/import/auction-results`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ players })
    })
    return response.json()
  },

  async nukeTournament() {
    const response = await fetch(`${API_BASE_URL}/import/nuke`, {
      method: 'POST'
    })
    return response.json()
  },

  // Matches
  async getMatches(): Promise<Match[]> {
    const response = await fetch(`${API_BASE_URL}/matches`)
    return response.json()
  },

  async createMatch(data: Partial<Match>) {
    const response = await fetch(`${API_BASE_URL}/matches`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    })
    return response.json()
  },

  async updateMatch(id: string, data: Partial<Match>) {
    const response = await fetch(`${API_BASE_URL}/matches/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    })
    return response.json()
  },

  async deleteMatch(id: string) {
    const response = await fetch(`${API_BASE_URL}/matches/${id}`, {
      method: 'DELETE'
    })
    return response.json()
  },

  async updateMatchStatus(id: string, status: string) {
    const response = await fetch(`${API_BASE_URL}/matches/${id}/status`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status })
    })
    return response.json()
  },

  async resetMatch(id: string) {
    const response = await fetch(`${API_BASE_URL}/matches/${id}/reset`, {
      method: 'POST'
    })
    return response.json()
  },

  // Match Events
  async getMatchEvents(matchId: string): Promise<MatchEvent[]> {
    const response = await fetch(`${API_BASE_URL}/matches/${matchId}/events`)
    return response.json()
  },

  async createMatchEvent(matchId: string, data: Partial<MatchEvent>) {
    const response = await fetch(`${API_BASE_URL}/matches/${matchId}/events`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    })
    return response.json()
  },

  async deleteLastMatchEvent(matchId: string) {
    const response = await fetch(`${API_BASE_URL}/matches/${matchId}/events/last`, {
      method: 'DELETE'
    })
    return response.json()
  },

  // Stats (backend mounts at /api/standings)
  async getStandings(): Promise<Standing[]> {
    const response = await fetch(`${API_BASE_URL}/standings`)
    return response.json()
  },

  async getTopScorers(): Promise<TopScorer[]> {
    const response = await fetch(`${API_BASE_URL}/standings/top-scorers`)
    return response.json()
  },

  async getStarPlayers(): Promise<StarPlayer[]> {
    const response = await fetch(`${API_BASE_URL}/standings/star-players`)
    return response.json()
  },

  async getDiscipline(): Promise<Discipline[]> {
    const response = await fetch(`${API_BASE_URL}/standings/discipline`)
    return response.json()
  },

  async getGlobalStats(): Promise<GlobalStats> {
    const response = await fetch(`${API_BASE_URL}/standings/global`)
    return response.json()
  },

  // Lineups
  async getLineup(matchId: string) {
    const response = await fetch(`${API_BASE_URL}/lineups/${matchId}`)
    return response.json()
  },

  async setLineup(matchId: string, teamId: string, playerIds: string[]) {
    const response = await fetch(`${API_BASE_URL}/lineups/${matchId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ team_id: teamId, player_ids: playerIds })
    })
    return response.json()
  },

  async substitutePlayer(matchId: string, teamId: string, playerOutId: string, playerInId: string, minute: number) {
    const response = await fetch(`${API_BASE_URL}/lineups/${matchId}/substitute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ team_id: teamId, player_out_id: playerOutId, player_in_id: playerInId, minute })
    })
    return response.json()
  }
}
