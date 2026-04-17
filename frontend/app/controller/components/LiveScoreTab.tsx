'use client'

import { useState, useEffect } from 'react'
import { api, Team, Player, Match, MatchEvent } from '@/lib/api'

export default function LiveScoreTab() {
  const [fixtures, setFixtures] = useState<Match[]>([])
  const [selectedMatch, setSelectedMatch] = useState<Match | null>(null)
  const [teamAPlayers, setTeamAPlayers] = useState<Player[]>([])
  const [teamBPlayers, setTeamBPlayers] = useState<Player[]>([])
  const [lineup, setLineup] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [currentMinute, setCurrentMinute] = useState(0)
  const [matchEvents, setMatchEvents] = useState<MatchEvent[]>([])
  const [benchTimers, setBenchTimers] = useState<Record<string, number>>({})
  
  // UI State
  const [showEventModal, setShowEventModal] = useState(false)
  const [eventType, setEventType] = useState<'goal' | 'yellow' | 'red' | 'sub'>('goal')
  const [eventTeam, setEventTeam] = useState('')
  const [subSwapId, setSubSwapId] = useState<string | null>(null) // The player being swapped out
  const [subDirection, setSubDirection] = useState<'out' | 'in'>('out') // 'out' = pitch player selected, 'in' = bench player selected

  const loadBaseData = async () => {
    const data = await api.getMatches()
    setFixtures(data)
    setLoading(false)
  }

  useEffect(() => {
    loadBaseData()
  }, [])

  const loadMatchDeatils = async (m: Match) => {
    setSelectedMatch(m)
    const [a, b, line, events] = await Promise.all([
      api.getPlayers(m.team_a_id),
      api.getPlayers(m.team_b_id),
      api.getLineup(m.id),
      api.getMatchEvents(m.id)
    ])
    setTeamAPlayers(a)
    setTeamBPlayers(b)
    setLineup(line || [])
    setMatchEvents(events)
  }

  useEffect(() => {
    if (selectedMatch) {
      loadMatchDeatils(selectedMatch)
    }
  }, [selectedMatch?.id])

  // Live Clock
  useEffect(() => {
    if (!selectedMatch || selectedMatch.status !== 'live' || !selectedMatch.started_at) {
      setCurrentMinute(0)
      return
    }
    const updateMinute = () => {
      const start = new Date(selectedMatch.started_at!).getTime()
      const diff = Math.floor((Date.now() - start) / 1000 / 60)
      setCurrentMinute(Math.max(0, diff))
    }
    updateMinute()
    const timer = setInterval(updateMinute, 10000)
    return () => clearInterval(timer)
  }, [selectedMatch])

  // Bench Timer Logic (2 mins for Yellow Card)
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now()
      const newTimers: Record<string, number> = {}
      
      matchEvents.forEach(event => {
        if (event.type === 'yellow' && event.created_at) {
          const createdAt = new Date(event.created_at).getTime()
          const diff = (now - createdAt) / 1000
          const remaining = 120 - diff // 2 minutes = 120 seconds
          
          if (remaining > 0) {
            newTimers[event.player_id] = Math.ceil(remaining)
          }
        }
      })
      
      setBenchTimers(newTimers)
    }, 1000)
    
    return () => clearInterval(interval)
  }, [matchEvents])

  const handleStatusChange = async (status: string) => {
    if (!selectedMatch) return
    const updated = await api.updateMatchStatus(selectedMatch.id, status)
    setSelectedMatch(updated)
    loadBaseData()
  }

  const handleToggleLineup = async (teamId: string, playerId: string) => {
    if (!selectedMatch) return
    const currentTeamLineup = lineup.filter(l => l.team_id === teamId)
    const isIn = currentTeamLineup.some(l => l.player_id === playerId)
    
    let newPlayerIds = currentTeamLineup.map(l => l.player_id)
    if (isIn) {
      newPlayerIds = newPlayerIds.filter(id => id !== playerId)
    } else {
      if (newPlayerIds.length >= 7) {
        alert("MAX 7 STARTERS REACHED")
        return
      }
      newPlayerIds.push(playerId)
    }

    await api.setLineup(selectedMatch.id, teamId, newPlayerIds)
    const newLineup = await api.getLineup(selectedMatch.id)
    setLineup(newLineup)
  }

  const handlePerformSub = async (selectedPlayerId: string) => {
    if (!selectedMatch || !subSwapId) return
    
    const teamId = eventTeam
    // If subDirection is 'out': subSwapId = player going out, selectedPlayerId = player coming in
    // If subDirection is 'in': subSwapId = player coming in, selectedPlayerId = player going out
    const playerOutId = subDirection === 'out' ? subSwapId : selectedPlayerId
    const playerInId = subDirection === 'out' ? selectedPlayerId : subSwapId

    try {
      await api.substitutePlayer(selectedMatch.id, teamId, playerOutId, playerInId, currentMinute)
      const newLineup = await api.getLineup(selectedMatch.id)
      setLineup(newLineup)
      const updatedEvents = await api.getMatchEvents(selectedMatch.id)
      setMatchEvents(updatedEvents)
      setSubSwapId(null)
      setShowEventModal(false)
    } catch (err) {
      console.error('Sub failed:', err)
      alert('Substitution failed. Check connection.')
    }
  }

  const handleAddEvent = async (playerId: string) => {
    if (!selectedMatch) return
    const eventData: any = {
      type: eventType,
      team_id: eventTeam,
      player_id: playerId,
      minute: currentMinute
    }
    try {
      const result = await api.createMatchEvent(selectedMatch.id, eventData)
      if (eventType === 'goal') {
        setSelectedMatch({ ...selectedMatch, score_a: result.scores?.score_a, score_b: result.scores?.score_b })
        // Refresh sidebar list to prevent stale data overwrites
        loadBaseData()
      }
      // Refresh events for timers
      const updatedEvents = await api.getMatchEvents(selectedMatch.id)
      setMatchEvents(updatedEvents)
      
      setShowEventModal(false)
      setSubSwapId(null)
    } catch (err) {
      console.error('Failed to log event:', err)
      alert('Error logging event. Check connection.')
    }
  }

  const handleUndoEvent = async () => {
    if (!selectedMatch) return
    if (!window.confirm('Undo the last recorded event? This will revert score and timeline.')) return
    
    try {
      const result = await api.deleteLastMatchEvent(selectedMatch.id)
      setSelectedMatch({ ...selectedMatch, score_a: result.scores?.score_a ?? 0, score_b: result.scores?.score_b ?? 0 })
      
      const updatedEvents = await api.getMatchEvents(selectedMatch.id)
      setMatchEvents(updatedEvents)
      // Refresh sidebar list
      loadBaseData()
    } catch (err) {
      alert('Failed to undo event or no events found to undo.')
    }
  }

  const getPitchPlayers = (teamId: string) => {
    const ids = lineup.filter(l => l.team_id === teamId).map(l => l.player_id)
    const basePlayers = teamId === selectedMatch?.team_a_id ? teamAPlayers : teamBPlayers
    return basePlayers.filter(p => ids.includes(p.id))
  }

  const getBenchPlayers = (teamId: string) => {
    const ids = lineup.filter(l => l.team_id === teamId).map(l => l.player_id)
    const basePlayers = teamId === selectedMatch?.team_a_id ? teamAPlayers : teamBPlayers
    return basePlayers.filter(p => !ids.includes(p.id))
  }

  const handleResetMatch = async () => {
    if (!selectedMatch) return
    if (!window.confirm('⚠️ Reset this match? This will delete all goals, cards, and lineups for this specific encounter.')) return
    
    try {
      const updated = await api.resetMatch(selectedMatch.id)
      setSelectedMatch(updated)
      await loadMatchDeatils(updated)
      await loadBaseData()
    } catch (err) {
      alert('Failed to reset match')
    }
  }

  return (
    <div className="max-w-7xl mx-auto space-y-8">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
        {/* Match Selection */}
        <div className="md:col-span-1 space-y-6">
           <div className="flex justify-between items-center border-b border-primary-container/20 pb-4">
              <h3 className="font-headline font-black text-[10px] tracking-[0.4em] text-primary-container uppercase">MATCH HUB</h3>
           </div>
           
           <div className="space-y-2 overflow-y-auto max-h-[80vh] custom-scrollbar pr-2">
             {fixtures.map(m => (
               <button
                 key={m.id}
                 onClick={() => setSelectedMatch(m)}
                 className={`w-full p-5 text-left transition-all border ${
                   selectedMatch?.id === m.id ? 'bg-primary-container border-primary-container text-white shadow-2xl scale-[1.02]' : 'bg-surface-container-low border-white/5 text-secondary hover:border-white/20'
                 }`}
               >
                  <div className="flex justify-between items-center mb-3">
                    <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-0.5 ${m.status === 'live' ? 'bg-white text-primary-container animate-pulse' : 'bg-black/40 text-secondary'}`}>
                      {m.status}
                    </span>
                    <span className="text-[10px] font-bold opacity-60 tracking-widest">{m.time}</span>
                  </div>
                  <div className="font-headline font-black uppercase tracking-tight text-xs border-t border-white/5 pt-4">
                    {m.team_a?.name} <span className="text-secondary/40 px-1">v</span> {m.team_b?.name}
                  </div>
               </button>
             ))}
           </div>
        </div>

        {/* Console */}
        <div className="md:col-span-3 space-y-8">
          {selectedMatch ? (
            <div className="space-y-8 animate-in slide-in-from-right-8 duration-500">
               {/* Dashboard Header */}
               <div className="bg-surface-container-high inner-stroke-top p-8 flex flex-col md:flex-row items-center justify-between gap-8 border-l-8 border-primary-container shadow-2xl relative overflow-hidden group">
                  <div className="absolute right-0 top-0 w-32 h-32 bg-primary-container/5 rounded-full translate-x-16 -translate-y-16 group-hover:scale-150 transition-transform"></div>
                  <div className="flex items-center gap-10 relative z-10">
                     <div className="flex flex-col">
                        <span className="text-[10px] font-black text-primary-container tracking-[0.4em] uppercase mb-2">LIVE CONTROL UNIT</span>
                        <h2 className="font-headline font-black text-3xl uppercase italic tracking-tighter text-white">
                          {selectedMatch.team_a?.name} <span className="text-tertiary">v</span> {selectedMatch.team_b?.name}
                        </h2>
                     </div>
                     <div className="bg-black/80 px-8 py-3 border border-white/10 flex flex-col items-center">
                        <span className="text-[9px] font-black text-secondary uppercase tracking-[0.3em] mb-1">CHRONO</span>
                        <div className="flex items-center gap-2">
                           <span className="font-headline font-black text-3xl text-tertiary italic">{currentMinute}'</span>
                           {selectedMatch.status === 'live' && (
                              <div className="flex items-center gap-1 ml-4 border-l border-white/10 pl-4">
                                 <span className="text-[14px] font-black text-primary-container">+</span>
                                 <input 
                                   type="number" 
                                   value={selectedMatch.stoppage_time || 0}
                                   onChange={async (e) => {
                                     const val = parseInt(e.target.value) || 0
                                     const updated = await api.updateMatch(selectedMatch.id, { stoppage_time: val })
                                     setSelectedMatch(updated)
                                   }}
                                   className="w-12 bg-transparent text-white font-headline font-black text-xl focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                   placeholder="0"
                                 />
                              </div>
                           )}
                        </div>
                     </div>
                  </div>
                  <div className="flex gap-4 relative z-10">
                    {selectedMatch.status === 'ft' && (
                       <div className="flex items-center gap-4 bg-black/40 px-6 py-2 border border-white/10 rounded-lg">
                          <span className="text-[9px] font-black text-secondary tracking-widest uppercase">PENS</span>
                          <div className="flex items-center gap-2">
                             <input 
                               type="number"
                               value={selectedMatch.result_override?.startsWith('P:') ? selectedMatch.result_override.split(':')[1].split('-')[0] : ''}
                               onChange={async (e) => {
                                 const valA = e.target.value || '0'
                                 const currentB = selectedMatch.result_override?.startsWith('P:') ? selectedMatch.result_override.split(':')[1].split('-')[1] : '0'
                                 const updated = await api.updateMatch(selectedMatch.id, { result_override: `P:${valA}-${currentB}` as any })
                                 setSelectedMatch(updated)
                               }}
                               className="w-10 bg-surface-container-highest text-white font-headline font-black text-center p-2 rounded focus:ring-1 focus:ring-tertiary focus:outline-none"
                               placeholder="A"
                             />
                             <span className="text-secondary font-black">-</span>
                             <input 
                               type="number"
                               value={selectedMatch.result_override?.startsWith('P:') ? selectedMatch.result_override.split(':')[1].split('-')[1] : ''}
                               onChange={async (e) => {
                                 const valB = e.target.value || '0'
                                 const currentA = selectedMatch.result_override?.startsWith('P:') ? selectedMatch.result_override.split(':')[1].split('-')[0] : '0'
                                 const updated = await api.updateMatch(selectedMatch.id, { result_override: `P:${currentA}-${valB}` as any })
                                 setSelectedMatch(updated)
                               }}
                               className="w-10 bg-surface-container-highest text-white font-headline font-black text-center p-2 rounded focus:ring-1 focus:ring-tertiary focus:outline-none"
                               placeholder="B"
                             />
                          </div>
                       </div>
                    )}
                    
                    {selectedMatch.status === 'scheduled' && (
                       <button onClick={() => handleStatusChange('live')} className="bg-tertiary text-black font-black px-12 py-4 uppercase tracking-widest text-[11px] active:scale-95 shadow-xl shadow-tertiary/20">ACTIVATE SIGNAL</button>
                    )}
                    {selectedMatch.status === 'live' && (
                       <button onClick={() => handleStatusChange('ft')} className="bg-primary-container text-white font-black px-12 py-4 uppercase tracking-widest text-[11px] active:scale-95 shadow-xl shadow-primary-container/20">END BROADCAST</button>
                    )}
                    {selectedMatch.status === 'ft' && (
                       <button onClick={() => handleStatusChange('scheduled')} className="bg-secondary text-white font-black px-12 py-4 uppercase tracking-widest text-[11px] active:scale-95">REVERT TO QUEUE</button>
                    )}
                     <button 
                       onClick={handleUndoEvent}
                       className="bg-black/40 text-tertiary border border-tertiary/40 hover:bg-tertiary hover:text-black px-6 py-4 font-black uppercase tracking-widest text-[10px] transition-all flex items-center gap-2"
                       title="Remove last event"
                     >
                       <span className="material-symbols-outlined text-sm">undo</span>
                       UNDO LAST
                     </button>
                    <button 
                      onClick={handleResetMatch}
                      className="bg-black/40 text-error border border-error/40 hover:bg-error hover:text-white px-6 py-4 font-black uppercase tracking-widest text-[10px] transition-all flex items-center gap-2"
                      title="Clear all events and reset score"
                    >
                      <span className="material-symbols-outlined text-sm">restart_alt</span>
                      RESET
                    </button>
                  </div>
               </div>

               {/* Lineup & Event Grids */}
               <div className="grid grid-cols-1 md:grid-cols-2 gap-px bg-outline-variant/10 border border-outline-variant/10 shadow-2xl">
                  {['a', 'b'].map(side => {
                    const isA = side === 'a'
                    const team = isA ? selectedMatch.team_a : selectedMatch.team_b
                    const teamId = isA ? selectedMatch.team_a_id : selectedMatch.team_b_id
                    const pitch = getPitchPlayers(teamId)
                    const bench = getBenchPlayers(teamId)
                    const score = isA ? selectedMatch.score_a : selectedMatch.score_b

                    return (
                      <div key={side} className="bg-surface-container-low p-8 space-y-8">
                         <div className="flex justify-between items-end border-b border-white/5 pb-6">
                            <h4 className="font-headline font-black text-sm tracking-widest uppercase text-white">{team?.name}</h4>
                            <div className="font-headline font-black text-7xl italic text-white drop-shadow-2xl leading-none">{score ?? 0}</div>
                         </div>

                         {/* Quick Event Buttons */}
                         <div className="grid grid-cols-3 gap-3">
                            <button 
                              onClick={() => { setEventType('goal'); setEventTeam(teamId); setShowEventModal(true); }}
                              className="col-span-3 bg-primary-container text-white font-black py-4 uppercase tracking-[0.2em] text-[11px] hover:brightness-110 active:scale-[0.98] transition-all flex items-center justify-center gap-3"
                            >
                              <span className="material-symbols-outlined text-sm">sports_soccer</span> GOAL
                            </button>
                            <button onClick={() => { setEventType('yellow'); setEventTeam(teamId); setShowEventModal(true); }} className="bg-tertiary text-black font-black py-3 uppercase tracking-widest text-[9px]">YELLOW</button>
                            <button onClick={() => { setEventType('red'); setEventTeam(teamId); setShowEventModal(true); }} className="bg-error text-white font-black py-3 uppercase tracking-widest text-[9px]">RED</button>
                            <button onClick={() => { setEventType('sub'); setEventTeam(teamId); setShowEventModal(true); }} className="bg-on-surface text-background font-black py-3 uppercase tracking-widest text-[9px]">CUSTOM EVENT</button>
                         </div>

                         {/* Squad & Lineup Manager */}
                         <div className="space-y-6 pt-4">
                            <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-widest opacity-40">
                               <span>ACTIVE ON PITCH (7 MAX)</span>
                               <span>BENCH (SUBS)</span>
                            </div>
                            
                            <div className="space-y-2">
                               {/* Pitch List */}
                               <div className="space-y-1">
                                  {pitch.map(p => (
                                    <div key={p.id} className={`flex justify-between items-center bg-white/[0.03] p-3 border-l-2 group ${benchTimers[p.id] ? 'border-tertiary bg-tertiary/5' : 'border-primary-container'}`}>
                                       <span className="text-[11px] font-black uppercase tracking-tight text-white">
                                         {p.name} {p.is_captain && <span className="text-tertiary text-[9px] ml-2">(C)</span>}
                                         {benchTimers[p.id] && (
                                           <span className="ml-3 px-2 py-0.5 bg-tertiary text-black text-[9px] font-black rounded-sm animate-pulse">
                                             BENCH: {Math.floor(benchTimers[p.id] / 60)}:{String(benchTimers[p.id] % 60).padStart(2, '0')}
                                           </span>
                                         )}
                                       </span>
                                       <div className="flex gap-2">
                                          {selectedMatch.status === 'scheduled' ? (
                                            <button onClick={() => handleToggleLineup(teamId, p.id)} className="material-symbols-outlined text-sm text-error">remove_circle</button>
                                          ) : (
                                            <button 
                                              onClick={() => { setEventTeam(teamId); setSubSwapId(p.id); setSubDirection('out'); setEventType('sub'); setShowEventModal(true); }}
                                              className="bg-white/10 text-[8px] font-black px-3 py-1 uppercase tracking-widest hover:bg-tertiary hover:text-black transition-all"
                                            >
                                              🔄 SUB
                                            </button>
                                          )}
                                       </div>
                                    </div>
                                  ))}
                                  {pitch.length === 0 && <div className="p-4 border border-white/5 text-center text-[9px] uppercase font-bold opacity-20 italic">No starters selected</div>}
                               </div>

                               {/* Bench List */}
                               <div className="pt-4 border-t border-white/5 space-y-1">
                                  {bench.map(p => (
                                    <div key={p.id} className="flex justify-between items-center opacity-40 hover:opacity-100 transition-opacity p-3 bg-black/20 group">
                                       <span className="text-[10px] font-black uppercase text-secondary">{p.name}</span>
                                       {selectedMatch.status === 'scheduled' ? (
                                          <button onClick={() => handleToggleLineup(teamId, p.id)} className="material-symbols-outlined text-sm text-primary-container">add_circle</button>
                                       ) : (
                                          <button 
                                            onClick={() => { setEventTeam(teamId); setSubSwapId(p.id); setSubDirection('in'); setEventType('sub'); setShowEventModal(true); }}
                                            className="opacity-0 group-hover:opacity-100 bg-white/10 text-[8px] font-black px-3 py-1 uppercase tracking-widest transition-all"
                                          >
                                            🔄 SUB
                                          </button>
                                       )}
                                    </div>
                                  ))}
                               </div>
                            </div>
                         </div>
                      </div>
                    )
                  })}
               </div>
            </div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center py-40 bg-surface-container-low border border-dashed border-white/5 text-center opacity-40">
               <span className="material-symbols-outlined text-9xl text-primary-container mb-6 animate-pulse">broadcast_on_home</span>
               <h3 className="font-headline font-black text-3xl uppercase italic tracking-tighter">SIGNAL STANDBY</h3>
               <p className="text-[10px] font-black tracking-[0.4em] uppercase mt-2">LINK TO AN UPCOMING FIXTURE TO BEGIN</p>
            </div>
          )}
        </div>
      </div>

      {/* Selector Modal (Events / Substitutions) */}
      {showEventModal && (
        <div className="fixed inset-0 z-[100] bg-black/95 backdrop-blur-3xl flex items-center justify-center p-8">
           <div className="bg-surface-container-high w-full max-w-2xl p-12 inner-stroke-top border-t-8 border-primary-container shadow-[0_0_100px_rgba(0,0,0,1)]">
              <div className="flex justify-between items-center mb-12">
                 <div>
                    <span className="text-[10px] font-black text-primary-container tracking-[0.5em] uppercase mb-2 block">BROADCAST OPERATOR UNIT</span>
                    <h3 className="font-headline font-black text-4xl tracking-tighter uppercase italic text-white leading-none">
                      {eventType === 'sub' ? (subSwapId ? `SELECT ${subDirection === 'out' ? 'REPLACEMENT FOR' : 'WHO COMES OFF FOR'} ${[...teamAPlayers, ...teamBPlayers].find(p => p.id === subSwapId)?.name}` : 'INITIATE TACTICAL SWAP') : `LOG ${eventType.toUpperCase()}`}
                    </h3>
                 </div>
                 <button onClick={() => { setShowEventModal(false); setSubSwapId(null); setSubDirection('out'); }} className="w-16 h-16 flex items-center justify-center hover:bg-white/5 transition-all text-secondary hover:text-white border border-white/5">
                    <span className="material-symbols-outlined text-4xl">close</span>
                 </button>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[50vh] overflow-y-auto pr-6 custom-scrollbar">
                 {(eventType === 'sub' && subSwapId) 
                   ? (subDirection === 'out' ? getBenchPlayers(eventTeam) : getPitchPlayers(eventTeam)).map(player => (
                       <button 
                         key={player.id}
                         onClick={() => handlePerformSub(player.id)}
                         className="group w-full p-6 bg-black/50 border border-white/5 font-headline font-black text-sm uppercase tracking-widest text-white hover:bg-primary-container hover:border-primary-container transition-all flex justify-between items-center"
                       >
                         {player.name}
                         <span className="text-[10px] text-primary-container font-black p-2 bg-primary-container/20 opacity-0 group-hover:opacity-100 transition-opacity">
                           {subDirection === 'out' ? 'COMES IN' : 'GOES OFF'}
                         </span>
                       </button>
                    ))
                   : (eventTeam === selectedMatch?.team_a_id ? teamAPlayers : teamBPlayers).map(player => (
                       <button 
                         key={player.id}
                         onClick={() => handleAddEvent(player.id)}
                         className="group w-full p-6 bg-black/50 border border-white/5 font-headline font-black text-sm uppercase tracking-widest text-white hover:bg-tertiary hover:border-tertiary hover:text-black transition-all flex justify-between items-center"
                       >
                         {player.name}
                         <span className="text-[10px] font-black p-2 bg-tertiary/20 opacity-0 group-hover:opacity-100 transition-opacity">LOG {eventType.toUpperCase()}</span>
                       </button>
                 ))}
              </div>
           </div>
        </div>
      )}
    </div>
  )
}
