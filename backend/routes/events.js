const express = require('express')
const router = express.Router({ mergeParams: true })
const supabase = require('../lib/supabase')

// Helper function to recompute scores
async function recomputeScores(matchId) {
  try {
    // Get match details
    const { data: match, error: matchError } = await supabase
      .from('matches')
      .select('team_a_id, team_b_id')
      .eq('id', matchId)
      .single()
    
    if (matchError) throw matchError
    
    // Get all events for this match
    const { data: events, error: eventsError } = await supabase
      .from('match_events')
      .select('type, team_id')
      .eq('match_id', matchId)
    
    if (eventsError) throw eventsError
    
    // Count goals for each team
    const scoreA = events.filter(e => e.type === 'goal' && e.team_id === match.team_a_id).length
    const scoreB = events.filter(e => e.type === 'goal' && e.team_id === match.team_b_id).length
    
    // Update match scores
    const { error: updateError } = await supabase
      .from('matches')
      .update({ score_a: scoreA, score_b: scoreB })
      .eq('id', matchId)
    
    if (updateError) throw updateError
    
    return { score_a: scoreA, score_b: scoreB }
  } catch (error) {
    console.error('Error recomputing scores:', error)
    throw error
  }
}

router.get('/', async (req, res) => {
  try {
    const { matchId } = req.params
    
    const { data, error } = await supabase
      .from('match_events')
      .select(`
        *,
        player:players!match_events_player_id_fkey(name),
        player_in:players!match_events_player_in_id_fkey(name),
        team:teams(name)
      `)
      .eq('match_id', matchId)
      .order('created_at', { ascending: true })
    
    if (error) throw error
    
    res.json(data)
  } catch (error) {
    console.error('Error fetching match events:', error)
    res.status(500).json({ error: 'Failed to fetch match events' })
  }
})

router.post('/', async (req, res) => {
  try {
    const { matchId } = req.params
    const { type, team_id, player_id, minute } = req.body
    const io = req.app.get('io')
    
    // Insert event
    const { data: event, error } = await supabase
      .from('match_events')
      .insert({ match_id: matchId, ...req.body })
      .select()
      .single()
    
    if (error) throw error
    
    // Recompute scores if it's a goal
    let scores = {}
    if (type === 'goal') {
      scores = await recomputeScores(matchId)
    }
    
    // Get updated match with scores
    const { data: match, error: matchError } = await supabase
      .from('matches')
      .select('*')
      .eq('id', matchId)
      .single()
    
    if (matchError) throw matchError
    
    io.emit('match:updated', match)
    res.json({ event, scores })
  } catch (error) {
    console.error('Error creating match event:', error)
    res.status(500).json({ error: 'Failed to create match event' })
  }
})

router.delete('/last', async (req, res) => {
  try {
    const { matchId } = req.params
    const io = req.app.get('io')
    
    // Get latest event
    const { data: latestEvent, error: fetchError } = await supabase
      .from('match_events')
      .select('*')
      .eq('match_id', matchId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single()
    
    if (fetchError) throw fetchError
    
    // Delete latest event
    const { error: deleteError } = await supabase
      .from('match_events')
      .delete()
      .eq('id', latestEvent.id)
    
    if (deleteError) throw deleteError
    
    // Recompute scores if it was a goal
    let scores = {}
    if (latestEvent.type === 'goal') {
      scores = await recomputeScores(matchId)
    }
    
    // Get updated match
    const { data: match, error: matchError } = await supabase
      .from('matches')
      .select('*')
      .eq('id', matchId)
      .single()
    
    if (matchError) throw matchError
    
    io.emit('match:updated', match)
    res.json({ deleted: latestEvent, scores })
  } catch (error) {
    console.error('Error deleting last match event:', error)
    res.status(500).json({ error: 'Failed to delete last match event' })
  }
})

module.exports = router
