const express = require('express')
const router = express.Router()
const supabase = require('../lib/supabase')

router.post('/auction-results', async (req, res) => {
  try {
    const { players } = req.body
    
    if (!players || !Array.isArray(players)) {
      return res.status(400).json({ error: 'Players array required' })
    }
    
    const errors = []
    const validPlayers = []
    
    // Validate and filter players
    players.forEach((player, index) => {
      const name = player.name?.trim()
      const team = player.team?.trim()
      const is_captain = !!player.is_captain
      
      if (!name || !team) {
        errors.push(`Row ${index + 1}: Missing name or team`)
        return
      }
      
      validPlayers.push({ name, team, is_captain, owner_name: player.owner_name })
    })
    
    // Extract unique team names and their owners
    const teamMetadata = new Map()
    validPlayers.forEach(p => {
      const key = p.team.toLowerCase()
      if (!teamMetadata.has(key)) {
        teamMetadata.set(key, { name: p.team, owner_name: p.owner_name })
      }
    })
    
    // Get existing teams
    const { data: existingTeams, error: teamsError } = await supabase
      .from('teams')
      .select('id, name')
    
    if (teamsError) throw teamsError
    
    const existingTeamMap = new Map(
      existingTeams.map(team => [team.name.toLowerCase(), team.id])
    )
    
    // Create new teams
    const teamsToCreate = Array.from(teamMetadata.values()).filter(
      t => !existingTeamMap.has(t.name.toLowerCase())
    )
    
    let teamsCreated = 0
    if (teamsToCreate.length > 0) {
      const { data: newTeams, error: createError } = await supabase
        .from('teams')
        .insert(teamsToCreate.map(t => ({ name: t.name, owner_name: t.owner_name })))
        .select()
      
      if (createError) throw createError
      
      teamsCreated = newTeams.length
      newTeams.forEach(team => {
        existingTeamMap.set(team.name.toLowerCase(), team.id)
      })
    }
    
    // Also update existing teams with owner names if they were missing before
    // (Optional logic, but good for completeness)
    for (const team of existingTeams) {
      const meta = teamMetadata.get(team.name.toLowerCase())
      if (meta && meta.owner_name) {
        await supabase.from('teams').update({ owner_name: meta.owner_name }).eq('id', team.id)
      }
    }
    
    // Get existing players to check for duplicates
    const { data: existingPlayers, error: playersError } = await supabase
      .from('players')
      .select('name')
    
    if (playersError) throw playersError
    
    const existingPlayerNames = new Set(
      existingPlayers.map(player => player.name.toLowerCase())
    )
    
    // Insert players
    const playersToInsert = validPlayers.filter(player => 
      !existingPlayerNames.has(player.name.toLowerCase())
    ).map(player => ({
      name: player.name,
      team_id: existingTeamMap.get(player.team.toLowerCase()),
      is_captain: player.is_captain
    }))
    
    let playersImported = 0
    if (playersToInsert.length > 0) {
      const { data: insertedPlayers, error: insertError } = await supabase
        .from('players')
        .insert(playersToInsert)
        .select()
      
      if (insertError) throw insertError
      
      playersImported = insertedPlayers.length
    }
    
    // Check for players that already exist
    const duplicatePlayers = validPlayers.filter(player =>
      existingPlayerNames.has(player.name.toLowerCase())
    )
    
    if (duplicatePlayers.length > 0) {
      errors.push(`${duplicatePlayers.length} players already exist and were skipped`)
    }
    
    res.json({
      teams_created: teamsCreated,
      players_imported: playersImported,
      errors
    })
  } catch (error) {
    console.error('Error importing auction results:', error)
    res.status(500).json({ error: 'Failed to import auction results' })
  }
})

router.post('/nuke', async (req, res) => {
  try {
    // Delete in order to respect Foreign Key constraints
    await supabase.from('match_lineups').delete().neq('id', '00000000-0000-0000-0000-000000000000')
    await supabase.from('match_events').delete().neq('id', '00000000-0000-0000-0000-000000000000')
    await supabase.from('players').delete().neq('id', '00000000-0000-0000-0000-000000000000')
    await supabase.from('matches').delete().neq('id', '00000000-0000-0000-0000-000000000000')
    await supabase.from('teams').delete().neq('id', '00000000-0000-0000-0000-000000000000')
    
    res.json({ message: 'Tournament wiped successfully' })
  } catch (error) {
    console.error('Nuke Error:', error)
    res.status(500).json({ error: 'Failed to wipe tournament' })
  }
})

module.exports = router
