const express = require('express')
const router = express.Router()
const supabase = require('../lib/supabase')
const eventsRoutes = require('./events')

router.use('/:matchId/events', eventsRoutes)

router.get('/', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('matches')
      .select(`
        *,
        team_a:teams!matches_team_a_id_fkey(name),
        team_b:teams!matches_team_b_id_fkey(name),
        match_events(count)
      `)
      .order('date')
      .order('time')
    
    if (error) throw error
    
    const matchesWithCount = data.map(match => ({
      ...match,
      event_count: match.match_events?.length || 0,
      match_events: undefined
    }))
    
    res.json(matchesWithCount)
  } catch (error) {
    console.error('Error fetching matches:', error)
    res.status(500).json({ error: 'Failed to fetch matches' })
  }
})

router.post('/', async (req, res) => {
  try {
    const { team_a_id, team_b_id, date, time } = req.body
    const io = req.app.get('io')
    
    const { data, error } = await supabase
      .from('matches')
      .insert({ team_a_id, team_b_id, date, time })
      .select()
      .single()
    
    if (error) throw error
    
    io.emit('fixtures:updated', data)
    res.json(data)
  } catch (error) {
    console.error('Error creating match:', error)
    res.status(500).json({ error: 'Failed to create match' })
  }
})

router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params
    const { team_a_id, team_b_id, date, time } = req.body
    const io = req.app.get('io')
    
    const { data, error } = await supabase
      .from('matches')
      .update({ team_a_id, team_b_id, date, time })
      .eq('id', id)
      .select()
      .single()
    
    if (error) throw error
    
    io.emit('fixtures:updated', data)
    res.json(data)
  } catch (error) {
    console.error('Error updating match:', error)
    res.status(500).json({ error: 'Failed to update match' })
  }
})

router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params
    const io = req.app.get('io')
    
    const { error } = await supabase
      .from('matches')
      .delete()
      .eq('id', id)
    
    if (error) throw error
    
    io.emit('fixtures:updated', { deleted: id })
    res.json({ success: true })
  } catch (error) {
    console.error('Error deleting match:', error)
    res.status(500).json({ error: 'Failed to delete match' })
  }
})

router.post('/:id/reset', async (req, res) => {
  try {
    const { id } = req.params
    const io = req.app.get('io')
    
    // 1. Clear events and lineups for this match
    await supabase.from('match_events').delete().eq('match_id', id)
    await supabase.from('match_lineups').delete().eq('match_id', id)
    
    // 2. Reset match score and status
    const { data, error } = await supabase
      .from('matches')
      .update({
        status: 'scheduled',
        score_a: 0,
        score_b: 0,
        started_at: null,
        result_override: null,
        star_player_id: null
      })
      .eq('id', id)
      .select()
      .single()
      
    if (error) throw error
    
    io.emit('match:updated', data)
    res.json(data)
  } catch (err) {
    console.error('Match Reset Error:', err)
    res.status(500).json({ error: 'Failed to reset match' })
  }
})

router.put('/:id/status', async (req, res) => {
  try {
    const { id } = req.params
    const { status } = req.body
    const io = req.app.get('io')
    
    const updateData = { status }
    if (status === 'live') {
      updateData.started_at = new Date().toISOString()
    }
    
    const { data, error } = await supabase
      .from('matches')
      .update(updateData)
      .eq('id', id)
      .select()
      .single()
    
    if (error) throw error
    
    io.emit('match:updated', data)
    res.json(data)
  } catch (error) {
    console.error('Error updating match status:', error)
    res.status(500).json({ error: 'Failed to update match status' })
  }
})

module.exports = router
