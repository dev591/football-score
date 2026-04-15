const express = require('express')
const router = express.Router()
const supabase = require('../lib/supabase')

router.get('/', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('teams')
      .select(`
        *,
        players:players(count)
      `)
    
    if (error) throw error
    
    const teamsWithCount = (data || []).map(team => ({
      ...team,
      player_count: team.players?.[0]?.count || 0, // supabase count query format
      players: undefined
    }))
    
    res.json(teamsWithCount)
  } catch (error) {
    console.error('Error fetching teams:', error)
    res.status(500).json({ error: 'Failed to fetch teams' })
  }
})

router.post('/', async (req, res) => {
  try {
    const { name } = req.body
    const { data, error } = await supabase
      .from('teams')
      .insert({ name })
      .select()
      .single()
    
    if (error) throw error
    res.json(data)
  } catch (error) {
    console.error('Error creating team:', error)
    res.status(500).json({ error: 'Failed to create team' })
  }
})

router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params
    const { name } = req.body
    
    const { data, error } = await supabase
      .from('teams')
      .update({ name })
      .eq('id', id)
      .select()
      .single()
      
    if (error) throw error
    res.json(data)
  } catch (err) {
    console.error('Error updating team:', err)
    res.status(500).json({ error: 'Failed to update team' })
  }
})

module.exports = router
