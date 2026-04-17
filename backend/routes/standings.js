const express = require('express')
const router = express.Router()
const supabase = require('../lib/supabase')

router.get('/', async (req, res) => {
  try {
    // Get all matches (we will filter for those with scores in JS)
    const { data: matches, error: matchesError } = await supabase
      .from('matches')
      .select('*')
    
    if (matchesError) throw matchesError

    // Filter for matches that have a result (either marked FT or have scores)
    const processedMatches = matches.filter(m => 
      m.status === 'ft' || (m.score_a !== null && m.score_b !== null)
    )
    
    // Get all teams
    const { data: teams, error: teamsError } = await supabase
      .from('teams')
      .select('*')
    
    if (teamsError) throw teamsError
    
    // Initialize standings
    const standingsMap = {}
    teams.forEach(team => {
      standingsMap[team.id] = {
        team_id: team.id,
        team: team.name,
        owner: team.owner_name,
        played: 0,
        won: 0,
        drawn: 0,
        lost: 0,
        goals_for: 0,
        goals_against: 0,
        goal_difference: 0,
        points: 0
      }
    })
    
    // Process each match
    processedMatches.forEach(match => {
      const homeTeam = standingsMap[match.team_a_id]
      const awayTeam = standingsMap[match.team_b_id]
      
      if (homeTeam && awayTeam) {
        homeTeam.played++
        awayTeam.played++
        homeTeam.goals_for += (match.score_a || 0)
        homeTeam.goals_against += (match.score_b || 0)
        awayTeam.goals_for += (match.score_b || 0)
        awayTeam.goals_against += (match.score_a || 0)
        
        // Use result_override if available, else use score
        let winner = null // 'a', 'b', or 'draw'
        
        if (match.result_override) {
          if (match.result_override === 'team_a') winner = 'a'
          else if (match.result_override === 'team_b') winner = 'b'
          else if (match.result_override === 'draw') winner = 'draw'
        } else {
          if ((match.score_a || 0) > (match.score_b || 0)) winner = 'a'
          else if ((match.score_b || 0) > (match.score_a || 0)) winner = 'b'
          else winner = 'draw'
        }

        if (winner === 'a') {
          homeTeam.won++
          homeTeam.points += 3
          awayTeam.lost++
        } else if (winner === 'b') {
          awayTeam.won++
          awayTeam.points += 3
          homeTeam.lost++
        } else {
          homeTeam.drawn++
          awayTeam.drawn++
          homeTeam.points += 1
          awayTeam.points += 1
        }
      }
    })
    
    // Calculate goal differences and convert to array
    const standings = Object.values(standingsMap).map(team => ({
      ...team,
      goal_difference: team.goals_for - team.goals_against
    }))
    
    // Sort standings
    standings.sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points
      if (b.goal_difference !== a.goal_difference) return b.goal_difference - a.goal_difference
      return b.goals_for - a.goals_for
    })
    
    res.json(standings)
  } catch (error) {
    console.error('Error calculating standings:', error)
    res.status(500).json({ error: 'Failed to calculate standings' })
  }
})

router.get('/top-scorers', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('match_events')
      .select(`
        player_id,
        player:players(name),
        team:teams(name)
      `)
      .eq('type', 'goal')
    
    if (error) throw error
    
    const goalCounts = {}
    data.forEach(event => {
      const key = event.player_id
      const playerName = event.player?.name || 'Unknown Player'
      if (!goalCounts[key]) {
        goalCounts[key] = {
          player: playerName,
          team: event.team?.name || 'Unknown Team',
          goals: 0
        }
      }
      goalCounts[key].goals++
    })
    
    const topScorers = Object.values(goalCounts)
      .sort((a, b) => b.goals - a.goals)
      .slice(0, 10)
    
    res.json(topScorers)
  } catch (error) {
    console.error('Error fetching top scorers:', error)
    res.status(500).json({ error: 'Failed to fetch top scorers' })
  }
})

router.get('/discipline', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('match_events')
      .select(`
        player_id,
        type,
        player:players(name),
        team:teams(name)
      `)
      .in('type', ['yellow', 'red'])
    
    if (error) throw error
    
    const cardCounts = {}
    data.forEach(event => {
      const key = event.player_id
      const playerName = event.player?.name || 'Unknown Player'
      if (!cardCounts[key]) {
        cardCounts[key] = {
          player: playerName,
          team: event.team?.name || 'Unknown Team',
          yellow: 0,
          red: 0
        }
      }
      if (event.type === 'yellow') cardCounts[key].yellow++
      else if (event.type === 'red') cardCounts[key].red++
    })
    
    const discipline = Object.values(cardCounts)
      .sort((a, b) => (b.red * 2 + b.yellow) - (a.red * 2 + a.yellow))
      .slice(0, 10)
    
    res.json(discipline)
  } catch (error) {
    console.error('Error fetching discipline stats:', error)
    res.status(500).json({ error: 'Failed to fetch discipline stats' })
  }
})

router.get('/star-players', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('matches')
      .select('star_player_id, star_player_note')
      .eq('status', 'ft')
      .not('star_player_id', 'is', null)
    
    if (error) throw error

    // Count star awards per player
    const starCounts = {}
    data.forEach(match => {
      const key = match.star_player_id
      if (!starCounts[key]) {
        starCounts[key] = { player_id: key, star_count: 0 }
      }
      starCounts[key].star_count++
    })

    // Fetch player names in one query
    const playerIds = Object.keys(starCounts)
    if (playerIds.length === 0) return res.json([])

    const { data: players, error: playersError } = await supabase
      .from('players')
      .select('id, name, team:teams(name)')
      .in('id', playerIds)

    if (playersError) throw playersError

    const playerMap = {}
    players.forEach(p => {
      playerMap[p.id] = { name: p.name, team: p.team?.name || '' }
    })

    const result = Object.values(starCounts)
      .map(s => ({
        player_name: playerMap[s.player_id]?.name || 'Unknown Player',
        team_name: playerMap[s.player_id]?.team || '',
        star_count: s.star_count
      }))
      .sort((a, b) => b.star_count - a.star_count)

    res.json(result)
  } catch (error) {
    console.error('Error fetching star players:', error)
    res.status(500).json({ error: 'Failed to fetch star players' })
  }
})

router.get('/global', async (req, res) => {
  try {
    const [teamsRes, playersRes, matchesRes] = await Promise.all([
      supabase.from('teams').select('id', { count: 'exact' }),
      supabase.from('players').select('id', { count: 'exact' }),
      supabase.from('matches').select('id', { count: 'exact' })
    ])
    
    res.json({
      totalTeams: teamsRes.count || 0,
      totalPlayers: playersRes.count || 0,
      totalMatches: matchesRes.count || 0
    })
  } catch (error) {
    console.error('Error fetching global stats:', error)
    res.status(500).json({ error: 'Failed to fetch global stats' })
  }
})

module.exports = router
