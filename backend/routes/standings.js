const express = require('express')
const router = express.Router()
const supabase = require('../lib/supabase')

router.get('/', async (req, res) => {
  try {
    // Get all finished matches
    const { data: matches, error: matchesError } = await supabase
      .from('matches')
      .select('*')
      .eq('status', 'ft')
    
    if (matchesError) throw matchesError
    
    // Get all teams
    const { data: teams, error: teamsError } = await supabase
      .from('teams')
      .select('*')
    
    if (teamsError) throw teamsError
    
    // Initialize standings
    const standingsMap = {}
    teams.forEach(team => {
      standingsMap[team.id] = {
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
    matches.forEach(match => {
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
      .select(`
        star_player_id,
        player:players!matches_star_player_id_fkey(name),
        team_a:teams!matches_team_a_id_fkey(name),
        team_b:teams!matches_team_b_id_fkey(name)
      `)
      .eq('status', 'ft')
      .not('star_player_id', 'is', null)
    
    if (error) throw error
    
    const starCounts = {}
    data.forEach(match => {
      const key = match.star_player_id
      const playerName = match.player?.name || 'Unknown Player'
      if (!starCounts[key]) {
        starCounts[key] = {
          player_name: playerName,
          star_count: 0
        }
      }
      starCounts[key].star_count++
    })
    
    const result = Object.values(starCounts).sort((a, b) => b.star_count - a.star_count)
    res.json(result)
  } catch (error) {
    console.error('Error fetching star players:', error)
    res.status(500).json({ error: 'Failed to fetch star players' })
  }
})

module.exports = router
