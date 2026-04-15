const express = require('express')
const router = express.Router()
const supabase = require('../lib/supabase')

// Get lineup for a match
router.get('/:matchId', async (req, res) => {
  try {
    const { matchId } = req.params
    const { data, error } = await supabase
      .from('match_lineups')
      .select(`
        *,
        player:players(id, name, position, is_captain)
      `)
      .eq('match_id', matchId)
    
    if (error) throw error
    res.json(data)
  } catch (error) {
    console.error('Error fetching lineup:', error)
    res.status(500).json({ error: 'Failed to fetch lineup' })
  }
})

// Set initial lineup (bulk)
router.post('/:matchId', async (req, res) => {
  try {
    const { matchId } = req.params
    const { team_id, player_ids } = req.body // player_ids should be the starting 7
    const io = req.app.get('io')

    // 1. Delete existing lineup entries for this team/match
    await supabase
      .from('match_lineups')
      .delete()
      .eq('match_id', matchId)
      .eq('team_id', team_id)

    // 2. Insert new starters
    if (player_ids && player_ids.length > 0) {
      const entries = player_ids.map(pid => ({
        match_id: matchId,
        team_id: team_id,
        player_id: pid,
        is_starter: true
      }))
      
      const { error: insertError } = await supabase
        .from('match_lineups')
        .insert(entries)
      
      if (insertError) throw insertError
    }

    io.emit('lineup:updated', { matchId, team_id })
    res.json({ success: true })
  } catch (error) {
    console.error('Error setting lineup:', error)
    res.status(500).json({ error: 'Failed to set lineup' })
  }
})

// Atomic Substitution
router.post('/:matchId/substitute', async (req, res) => {
  try {
    const { matchId } = req.params
    const { team_id, player_out_id, player_in_id, minute } = req.body
    const io = req.app.get('io')

    // 1. Record the substitution event
    // We need names for the event log text if we want descriptive logs, 
    // but the events table usually just stores IDs.
    const { data: playerOut } = await supabase.from('players').select('name').eq('id', player_out_id).single()
    const { data: playerIn } = await supabase.from('players').select('name').eq('id', player_in_id).single()

    const { error: eventError } = await supabase
      .from('match_events')
      .insert({
        match_id: matchId,
        team_id: team_id,
        type: 'sub',
        player_id: playerOut?.name || player_out_id, // Currently using name as ID in event logs based on previous code
        player_in_id: playerIn?.name || player_in_id,
        minute: minute || 0
      })
    
    if (eventError) throw eventError

    // 2. Update match_lineups: Remove player_out, Add player_in
    // We remove the starter from the lineups table (effectively moving them to bench)
    // and add the new player as a starter.
    
    await supabase
      .from('match_lineups')
      .delete()
      .eq('match_id', matchId)
      .eq('player_id', player_out_id)

    const { error: lineupError } = await supabase
      .from('match_lineups')
      .insert({
        match_id: matchId,
        team_id: team_id,
        player_id: player_in_id,
        is_starter: true
      })
    
    if (lineupError) throw lineupError

    io.emit('lineup:updated', { matchId, team_id })
    io.emit('match:updated', { id: matchId }) // Refresh events on watch hub
    
    res.json({ success: true })
  } catch (error) {
    console.error('Error performing substitution:', error)
    res.status(500).json({ error: 'Failed to perform substitution' })
  }
})

module.exports = router
