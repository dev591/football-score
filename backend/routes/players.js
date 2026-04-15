const express = require('express')
const router = express.Router()
const supabase = require('../lib/supabase')

router.get('/', async (req, res) => {
  try {
    const { team_id } = req.query
    
    let query = supabase
      .from('players')
      .select(`
        *,
        team:teams(name)
      `)
    
    if (team_id) {
      query = query.eq('team_id', team_id)
    }
    
    const { data, error } = await query.order('name')
    
    if (error) throw error
    
    res.json(data)
  } catch (error) {
    console.error('Error fetching players:', error)
    res.status(500).json({ error: 'Failed to fetch players' })
  }
})

router.post('/', async (req, res) => {
  try {
    const { name, team_id, is_captain, position } = req.body
    
    // If setting as captain, unmark others on the same team first
    if (is_captain) {
      await supabase
        .from('players')
        .update({ is_captain: false })
        .eq('team_id', team_id)
    }

    const { data, error } = await supabase
      .from('players')
      .insert({ name, team_id, is_captain: !!is_captain, position })
      .select()
      .single()
    
    if (error) throw error
    res.json(data)
  } catch (error) {
    console.error('Error creating player:', error)
    res.status(500).json({ error: 'Failed to create player' })
  }
})

router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params
    const { name, team_id, position, is_captain } = req.body
    
    const { data, error } = await supabase
      .from('players')
      .update({ name, team_id, position, is_captain })
      .eq('id', id)
      .select()
      .single()
    
    if (error) throw error
    
    res.json(data)
  } catch (error) {
    console.error('Error updating player:', error)
    res.status(500).json({ error: 'Failed to update player' })
  }
})

router.put('/:id/set-captain', async (req, res) => {
  try {
    const { id } = req.params
    
    // Get player to find their team_id
    const { data: player, error: fetchError } = await supabase
      .from('players')
      .select('team_id')
      .eq('id', id)
      .single()
    
    if (fetchError) throw fetchError

    // 1. Unmark all captains on this team
    await supabase
      .from('players')
      .update({ is_captain: false })
      .eq('team_id', player.team_id)
    
    // 2. Mark this player as captain
    const { data, error } = await supabase
      .from('players')
      .update({ is_captain: true })
      .eq('id', id)
      .select()
      .single()
    
    if (error) throw error
    res.json(data)
  } catch (error) {
    console.error('Error setting captain:', error)
    res.status(500).json({ error: 'Failed to set captain' })
  }
})

router.delete('/:id', async (req, res) => {
// ... existing code
  try {
    const { id } = req.params
    
    const { error } = await supabase
      .from('players')
      .delete()
      .eq('id', id)
    
    if (error) throw error
    
    res.json({ success: true })
  } catch (error) {
    console.error('Error deleting player:', error)
    res.status(500).json({ error: 'Failed to delete player' })
  }
})

module.exports = router
