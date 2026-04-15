'use client'

import { useState, useEffect } from 'react'
import { api, Team, Player } from '@/lib/api'

export default function SquadsTab() {
  const [teams, setTeams] = useState<Team[]>([])
  const [selectedTeam, setSelectedTeam] = useState<string>('')
  const [players, setPlayers] = useState<Player[]>([])
  const [loading, setLoading] = useState(true)

  // Form States
  const [newTeamName, setNewTeamName] = useState('')
  const [newPlayerName, setNewPlayerName] = useState('')
  const [newPlayerTeamId, setNewPlayerTeamId] = useState('')
  const [newPlayerIsCaptain, setNewPlayerIsCaptain] = useState(false)
  const [editingPlayerId, setEditingPlayerId] = useState<string | null>(null)
  const [editBuffer, setEditBuffer] = useState('')
  const [editingTeamId, setEditingTeamId] = useState<string | null>(null)
  const [editTeamBuffer, setEditTeamBuffer] = useState('')

  const loadData = async () => {
    const data = await api.getTeams()
    setTeams(data)
    if (data.length > 0 && !selectedTeam) {
      setSelectedTeam(data[0].id)
      setNewPlayerTeamId(data[0].id)
    }
    setLoading(false)
  }

  useEffect(() => {
    loadData()
  }, [])

  useEffect(() => {
    if (selectedTeam) {
      api.getPlayers(selectedTeam).then(setPlayers)
      setNewPlayerTeamId(selectedTeam)
    }
  }, [selectedTeam])

  const handleAddTeam = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newTeamName.trim()) return
    await api.createTeam(newTeamName.trim())
    setNewTeamName('')
    loadData()
  }

  const handleAddPlayer = async (e: React.FormEvent) => {
    e.preventDefault()
    const targetTeamId = newPlayerTeamId || selectedTeam
    if (!newPlayerName.trim() || !targetTeamId) return
    
    await api.createPlayer({
      name: newPlayerName.trim(),
      team_id: targetTeamId,
      is_captain: newPlayerIsCaptain
    })
    
    setNewPlayerName('')
    setNewPlayerIsCaptain(false)
    
    // If the team added to is different from current selection, maybe switch or just refresh
    if (targetTeamId === selectedTeam) {
      api.getPlayers(selectedTeam).then(setPlayers)
    } else {
      setSelectedTeam(targetTeamId)
    }
  }

  const handleToggleCaptain = async (player: Player) => {
    if (!player.is_captain) {
        await api.setCaptain(player.id)
    } else {
        await api.updatePlayer(player.id, { is_captain: false })
    }
    api.getPlayers(selectedTeam).then(setPlayers)
  }

  const handleStartEdit = (player: Player) => {
    setEditingPlayerId(player.id)
    setEditBuffer(player.name)
  }

  const handleSaveEdit = async () => {
    if (!editingPlayerId || !editBuffer.trim()) return
    await api.updatePlayer(editingPlayerId, { name: editBuffer.trim() })
    setEditingPlayerId(null)
    api.getPlayers(selectedTeam).then(setPlayers)
  }

  const handleStartTeamEdit = (team: Team) => {
    setEditingTeamId(team.id)
    setEditTeamBuffer(team.name)
  }

  const handleSaveTeamEdit = async () => {
    if (!editingTeamId || !editTeamBuffer.trim()) return
    await api.updateTeam(editingTeamId, editTeamBuffer.trim())
    setEditingTeamId(null)
    loadData()
  }

  const handleDeletePlayer = async (id: string) => {
    if (confirm('Are you sure you want to delete this player?')) {
      await api.deletePlayer(id)
      setPlayers(players.filter(p => p.id !== id))
    }
  }

  // Sort players to put captain at top
  const sortedPlayers = [...players].sort((a, b) => {
    if (a.is_captain && !b.is_captain) return -1
    if (!a.is_captain && b.is_captain) return 1
    return 0
  })

  return (
    <div className="space-y-12 max-w-7xl mx-auto">
      {/* Manual Entry Headers */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="bg-surface-container-high inner-stroke-top p-6">
           <h3 className="font-headline font-black text-[10px] tracking-[0.3em] text-tertiary uppercase mb-6">MANUAL TEAM ADDITION</h3>
           <form onSubmit={handleAddTeam} className="flex gap-4">
              <input 
                value={newTeamName} 
                onChange={(e) => setNewTeamName(e.target.value)}
                placeholder="TEAM NAME..." 
                className="flex-1 bg-black/40 border border-outline-variant/10 p-3 font-headline font-bold text-xs uppercase tracking-widest text-white outline-none focus:border-tertiary/50"
              />
              <button className="bg-tertiary text-black font-black px-6 py-3 uppercase tracking-widest text-[10px] active:scale-95 transition-all">ADD TEAM</button>
           </form>
        </div>

        <div className="bg-surface-container-high inner-stroke-top p-6">
           <h3 className="font-headline font-black text-[10px] tracking-[0.3em] text-primary-container uppercase mb-6">MANUAL PLAYER REGISTRATION</h3>
           <form onSubmit={handleAddPlayer} className="flex flex-col gap-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <input 
                  value={newPlayerName} 
                  onChange={(e) => setNewPlayerName(e.target.value)}
                  placeholder="PLAYER NAME..." 
                  className="bg-black/40 border border-outline-variant/10 p-3 font-headline font-bold text-xs uppercase tracking-widest text-white outline-none focus:border-primary-container/50"
                />
                <select 
                  value={newPlayerTeamId} 
                  onChange={(e) => setNewPlayerTeamId(e.target.value)}
                  className="bg-black/40 border border-outline-variant/10 p-3 font-headline font-bold text-xs uppercase tracking-widest text-white outline-none focus:border-primary-container/50 appearance-none cursor-pointer"
                >
                  <option value="" disabled>SELECT TEAM...</option>
                  {teams.map(t => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
              </div>
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-3 cursor-pointer group">
                  <input 
                    type="checkbox" 
                    checked={newPlayerIsCaptain} 
                    onChange={(e) => setNewPlayerIsCaptain(e.target.checked)}
                    className="w-4 h-4 bg-black border border-outline-variant/30 rounded-none checked:bg-primary-container appearance-none relative checked:after:content-['✓'] after:absolute after:inset-0 after:flex after:items-center after:justify-center after:text-[10px]"
                  />
                  <span className="text-[10px] font-bold text-secondary uppercase tracking-widest group-hover:text-on-surface transition-colors">MARK AS TEAM CAPTAIN</span>
                </label>
                <button className="bg-primary-container text-white font-black px-8 py-3 uppercase tracking-widest text-[10px] active:scale-95 transition-all shadow-lg">REGISTER PLAYER</button>
              </div>
           </form>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-8">
        {/* Team Selection Side Panel */}
        <div className="md:col-span-4 space-y-4">
          <h3 className="font-headline font-black text-xs tracking-[0.3em] text-primary-container uppercase mb-6">SQUADS LIST</h3>
          <div className="grid grid-cols-1 gap-px bg-outline-variant/20 border border-outline-variant/10 shadow-2xl overflow-hidden rounded-sm">
            {teams.map(team => (
              <div key={team.id} className="relative group">
                <button
                  onClick={() => setSelectedTeam(team.id)}
                  className={`w-full p-5 text-left font-headline font-black text-[11px] md:text-xs uppercase tracking-widest transition-all border-l-4 ${
                    selectedTeam === team.id ? 'bg-primary-container/10 border-primary-container text-white' : 'bg-surface-container-low border-transparent text-secondary hover:bg-surface-container-high'
                  }`}
                >
                  {editingTeamId === team.id ? (
                    <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                       <input 
                         value={editTeamBuffer}
                         onChange={(e) => setEditTeamBuffer(e.target.value)}
                         onKeyDown={(e) => e.key === 'Enter' && handleSaveTeamEdit()}
                         autoFocus
                         className="flex-1 bg-black border border-primary-container/40 p-2 font-headline font-bold text-[10px] uppercase text-white outline-none"
                       />
                       <button onClick={handleSaveTeamEdit} className="material-symbols-outlined text-sm text-tertiary">check</button>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between">
                       <span>{team.name}</span>
                       <button 
                         onClick={(e) => { e.stopPropagation(); handleStartTeamEdit(team); }}
                         className="material-symbols-outlined text-sm opacity-0 group-hover:opacity-40 hover:opacity-100 transition-opacity"
                       >
                         edit
                       </button>
                    </div>
                  )}
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Players List */}
        <div className="md:col-span-8 space-y-6">
          <div className="flex items-center justify-between mb-6 border-b border-outline-variant/10 pb-4">
            <h3 className="font-headline font-black text-xs tracking-[0.3em] text-primary-container uppercase italic">ROSTER CALIBRATION</h3>
            <span className="text-[9px] font-black text-secondary uppercase tracking-[0.2em]">{players.length} TOTAL REGISTERED</span>
          </div>

          <div className="grid grid-cols-1 gap-4">
            {sortedPlayers.map(player => (
              <div 
                key={player.id} 
                className={`inner-stroke-top p-5 flex items-center justify-between group transition-all rounded-sm ${
                  player.is_captain 
                    ? 'bg-gradient-to-r from-tertiary/20 to-surface-container-high border border-tertiary/30 shadow-[0_0_20px_rgba(255,215,0,0.1)]' 
                    : 'bg-surface-container-high hover:bg-surface-container-highest'
                }`}
              >
                <div className="flex items-center gap-6 flex-1">
                  <button 
                    onClick={() => handleToggleCaptain(player)}
                    title={player.is_captain ? "Unmark Captain" : "Mark as Captain"}
                    className={`material-symbols-outlined transition-all transform hover:scale-125 ${
                      player.is_captain ? 'text-tertiary fill-1 drop-shadow-[0_0_8px_rgba(255,215,0,0.5)]' : 'text-neutral-700 hover:text-tertiary'
                    }`}
                  >
                    stars
                  </button>
                  
                  {editingPlayerId === player.id ? (
                    <div className="flex-1 flex gap-2">
                      <input 
                        value={editBuffer} 
                        onChange={(e) => setEditBuffer(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleSaveEdit()}
                        autoFocus
                        className="flex-1 bg-black border border-tertiary/30 p-2 font-headline font-bold text-sm uppercase tracking-tight text-white outline-none"
                      />
                      <button onClick={handleSaveEdit} className="text-tertiary material-symbols-outlined">check</button>
                      <button onClick={() => setEditingPlayerId(null)} className="text-error material-symbols-outlined">close</button>
                    </div>
                  ) : (
                    <div className="flex flex-col group/name cursor-text" onClick={() => handleStartEdit(player)}>
                      <p className={`font-headline font-black uppercase tracking-tight transition-all ${
                        player.is_captain ? 'text-tertiary text-xl md:text-2xl italic tracking-tighter' : 'text-white text-base md:text-lg'
                      }`}>
                         {player.name}
                         <span className="material-symbols-outlined text-xs opacity-0 group-hover/name:opacity-40 transition-opacity ml-3">edit</span>
                      </p>
                      <span className={`text-[9px] font-black uppercase tracking-widest ${
                        player.is_captain ? 'text-tertiary/80 animate-pulse' : 'text-secondary/60'
                      }`}>
                        {player.is_captain ? 'PRIMARY SQUAD CAPTAIN' : 'REGULAR PLAYER'}
                      </span>
                    </div>
                  )}
                </div>
                
                <div className="flex items-center gap-4">
                  <button 
                    onClick={() => handleDeletePlayer(player.id)}
                    className="opacity-0 group-hover:opacity-100 p-2 text-error hover:scale-110 transition-all font-headline font-black text-[10px] tracking-widest uppercase flex items-center gap-2"
                  >
                    <span className="material-symbols-outlined text-sm">delete</span>
                    REMOVE
                  </button>
                </div>
              </div>
            ))}
            
            {players.length === 0 && !loading && (
              <div className="py-32 text-center border-2 border-dashed border-outline-variant/5 bg-surface-container-low/30 font-headline text-secondary uppercase text-[10px] tracking-[0.4em] italic">
                NO ROSTER DATA DEPLOYED FOR THIS SQUAD
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
