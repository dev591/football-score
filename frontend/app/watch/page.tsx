'use client'

import { useState, useEffect, Suspense } from 'react'
import { getSocket } from '@/lib/socket'
import { format } from 'date-fns'
import { Match, Standing, TopScorer, Discipline, StarPlayer, api, MatchEvent, Player, Team } from '@/lib/api'
import Link from 'next/link'
import { useSearchParams, useRouter } from 'next/navigation'

function WatchHubContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const tabParam = searchParams.get('tab') as 'live' | 'schedule' | 'leaderboard' | 'brackets' | 'franchise' | null
  
  const [activeTab, setActiveTab] = useState<'live' | 'schedule' | 'leaderboard' | 'brackets' | 'franchise'>(tabParam || 'live')
  const [mobileLiveMode, setMobileLiveMode] = useState<'timeline' | 'lineups'>('timeline')
  const [fixtures, setFixtures] = useState<Match[]>([])
  const [liveEvents, setLiveEvents] = useState<MatchEvent[]>([])
  const [benchTimers, setBenchTimers] = useState<Record<string, number>>({})
  const [allTeams, setAllTeams] = useState<Team[]>([])
  const [liveMatch, setLiveMatch] = useState<Match | null>(null)
  const [teamAPlayers, setTeamAPlayers] = useState<Player[]>([])
  const [teamBPlayers, setTeamBPlayers] = useState<Player[]>([])
  const [lineup, setLineup] = useState<any[]>([])
  const [standings, setStandings] = useState<Standing[]>([])
  const [topScorers, setTopScorers] = useState<TopScorer[]>([])
  const [discipline, setDiscipline] = useState<Discipline[]>([])
  const [starPlayers, setStarPlayers] = useState<StarPlayer[]>([])
  const [selectedTeamForSquad, setSelectedTeamForSquad] = useState<string | null>(null)
  const [squadPlayers, setSquadPlayers] = useState<Player[]>([])
  const [squadLoading, setSquadLoading] = useState(false)
  const [elapsedMinutes, setElapsedMinutes] = useState(0)
  const [loading, setLoading] = useState(true)
  const socket = getSocket()

  // Sync state with URL params
  useEffect(() => {
    if (tabParam && tabParam !== activeTab) {
      setActiveTab(tabParam)
    }
  }, [tabParam, activeTab])

  const handleTabChange = (tab: 'live' | 'schedule' | 'leaderboard' | 'brackets' | 'franchise') => {
    setActiveTab(tab)
    router.push(`/watch?tab=${tab}`, { scroll: false })
  }

  const fetchData = async (isManual = false) => {
    if (isManual) setLoading(true)
    try {
      // Fetch core data with individual error handling to prevent total blackout
      const [matches, standingData, scorerData, discData, starData, teamsData] = await Promise.all([
        api.getMatches().catch(() => []),
        api.getStandings().catch(() => []),
        api.getTopScorers().catch(() => []),
        api.getDiscipline().catch(() => []),
        api.getStarPlayers().catch(() => []),
        api.getTeams().catch(() => [])
      ])
      
      setFixtures(matches)
      setStandings(standingData)
      
      // Resilient Team Data: Use api.getTeams() but fallback to teams found in standings if empty
      let finalTeams = teamsData
      if ((!finalTeams || finalTeams.length === 0) && standingData && standingData.length > 0) {
        finalTeams = standingData.map(s => ({
          id: s.team_id || s.team, // Standings use 'team' for name
          name: s.team,
          owner_name: s.owner || 'Franchise Partner'
        })) as Team[]
      }
      setAllTeams(finalTeams)
      
      // Select live match - prioritize 'live' status
      const live = matches.find(m => m.status === 'live')
      if (live) {
        setLiveMatch(live)
        
        try {
          const events = await api.getMatchEvents(live.id)
          setLiveEvents(events)
          
          const [a, b, line] = await Promise.all([
            api.getPlayers(live.team_a_id),
            api.getPlayers(live.team_b_id),
            api.getLineup(live.id)
          ])
          setTeamAPlayers(a)
          setTeamBPlayers(b)
          setLineup(line || [])
        } catch (metaErr) {
          console.error('Meta fetch failed', metaErr)
        }
        
        if (live.started_at) {
          const elapsed = Math.floor((Date.now() - new Date(live.started_at).getTime()) / 1000 / 60)
          setElapsedMinutes(Math.max(0, elapsed))
        }
      } else {
        setLiveMatch(null)
        setLiveEvents([])
      }
      setLoading(false)
    } catch (err) {
      console.error('Failed to fetch data', err)
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
    if (!socket) return
    socket.on('match:updated', () => fetchData())
    socket.on('fixtures:updated', () => fetchData())
    socket.on('lineup:updated', () => fetchData())
    return () => {
      socket.off('match:updated')
      socket.off('fixtures:updated')
      socket.off('lineup:updated')
    }
  }, [socket])

  const getPlayerGoalCount = (playerId: string, teamId: string) => {
    return liveEvents.filter(e => e.type === 'goal' && e.team_id === teamId && (e.player_id === playerId || e.player_in_id === playerId)).length
  }

  const getPlayerCardCount = (playerId: string, teamId: string, type: 'yellow' | 'red') => {
    return liveEvents.filter(e => e.type === type && e.team_id === teamId && e.player_id === playerId).length
  }

  const handleOpenSquad = async (teamId: string) => {
    setSelectedTeamForSquad(teamId)
    setSquadLoading(true)
    try {
      const players = await api.getPlayers(teamId)
      setSquadPlayers(players)
    } catch (err) {
      console.error('Failed to fetch squad', err)
    } finally {
      setSquadLoading(false)
    }
  }

  const getPitchPlayers = (teamId: string, basePlayers: Player[]) => {
    const pitchIds = lineup.filter(l => l.team_id === teamId).map(l => l.player_id)
    return basePlayers.filter(p => pitchIds.includes(p.id))
  }

  const getBenchPlayers = (teamId: string, basePlayers: Player[]) => {
    const pitchIds = lineup.filter(l => l.team_id === teamId).map(l => l.player_id)
    return basePlayers.filter(p => !pitchIds.includes(p.id))
  }

  // Bench Timer Logic (2 mins for Yellow Card)
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now()
      const newTimers: Record<string, number> = {}
      
      liveEvents.forEach(event => {
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
  }, [liveEvents])

  if (loading) {
    return (
      <div className="bg-background min-h-screen flex flex-col items-center justify-center text-white font-headline">
        <div className="w-20 h-20 border-t-2 border-primary-container animate-spin rounded-full mb-8"></div>
        <div className="animate-pulse tracking-[0.5em] uppercase text-xs opacity-40">SIGNAL ACQUISITION...</div>
      </div>
    )
  }

  return (
    <div className="bg-background text-on-surface font-body selection:bg-primary-container selection:text-white min-h-screen pb-32 md:pb-12">
      {/* 1. COMPACT CINEMATIC HEADER (MOBILE OPTIMIZED) */}
      <header className="fixed top-0 w-full z-50 border-t-4 border-primary-container bg-[#0a0a0a]/90 backdrop-blur-3xl flex justify-between items-center px-4 md:px-8 py-3 md:py-5 shadow-2xl border-b border-white/5">
        <div className="flex items-center gap-4">
          <Link href="/" className="w-8 h-8 md:w-10 md:h-10 flex items-center justify-center border border-white/10 hover:bg-white/5 transition-all">
            <span className="material-symbols-outlined text-sm md:text-xl text-on-surface">arrow_back</span>
          </Link>
          <div className="flex flex-col">
            <span className="text-[7px] md:text-[9px] font-black text-primary-container tracking-[0.4em] uppercase">BROADCAST SIGNAL</span>
            <h1 className="font-headline font-black italic text-[#E62127] tracking-tighter text-lg md:text-2xl uppercase leading-none">STRIKER</h1>
          </div>
        </div>
        
        {liveMatch && (
           <div className="flex items-center gap-3">
              <button 
                onClick={() => fetchData(true)}
                className="w-8 h-8 flex items-center justify-center rounded-full border border-white/10 hover:bg-white/5 text-secondary hover:text-white transition-all"
                title="Refresh Signal"
              >
                <span className="material-symbols-outlined text-sm">refresh</span>
              </button>
              <div className="flex items-center gap-3 bg-black/40 px-3 md:px-5 py-1.5 md:py-2 border border-white/10">
                <div className="flex flex-col items-end">
                   <span className="text-[7px] md:text-[9px] font-black text-primary-container uppercase tracking-widest leading-none">LIVE</span>
                   <span className="text-[8px] font-bold text-secondary uppercase tracking-[0.2em] animate-pulse">STREAM ACTIVE</span>
                </div>
                <div className="w-2 h-2 rounded-full bg-primary-container animate-pulse-live"></div>
              </div>
           </div>
        )}
      </header>

      <main className="pt-20 md:pt-28 max-w-7xl mx-auto px-4">
        {/* 2. RESPONSIVE SCOREBOARD CARD */}
        <section className="relative w-full aspect-[16/9] md:aspect-[21/9] bg-black overflow-hidden border border-white/5 mb-6 md:mb-8 group shadow-[0_0_80px_rgba(0,0,0,1)]">
          <div className="absolute inset-0 z-0 bg-[url('https://images.unsplash.com/photo-1574629810360-7efbbe195018?q=80&w=2000')] bg-cover bg-center opacity-10 filter grayscale scale-110"></div>
          <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-black/80 z-10"></div>
          
          <div className="absolute inset-0 z-20 flex items-center justify-center p-4">
             {liveMatch ? (
                <div className="w-full max-w-4xl animate-in zoom-in-95 duration-500">
                   <div className="flex items-center justify-between gap-4 md:gap-12">
                      {/* Team A */}
                      <div className="flex-1 flex flex-col items-center gap-3 md:gap-6">
                        <div className="w-12 h-12 md:w-32 md:h-32 bg-white/5 backdrop-blur-xl rounded-full border border-white/10 flex items-center justify-center shadow-2xl relative">
                           <span className="font-headline font-black text-2xl md:text-7xl text-white opacity-80">{liveMatch.team_a?.name?.charAt(0)}</span>
                        </div>
                        <h2 className="font-headline font-black text-[9px] md:text-lg uppercase tracking-widest text-center text-white max-w-[80px] md:max-w-none leading-none">{liveMatch.team_a?.name}</h2>
                      </div>

                      {/* Score & Time */}
                      <div className="flex flex-col items-center gap-3 md:gap-6">
                        <div className="flex items-center gap-3 md:gap-8">
                           <span className="font-headline font-black text-4xl md:text-[10rem] italic text-white leading-none tracking-tighter">{liveMatch.score_a ?? 0}</span>
                           <span className="font-headline font-black text-xl md:text-7xl italic text-primary-container animate-pulse">:</span>
                           <span className="font-headline font-black text-4xl md:text-[10rem] italic text-white leading-none tracking-tighter">{liveMatch.score_b ?? 0}</span>
                        </div>
                        <div className="bg-primary-container px-3 md:px-8 py-1 md:py-2 shadow-xl transform skew-x-[-20deg]">
                           <span className="font-headline font-black text-xs md:text-3xl text-white tracking-widest block transform skew-x-[20deg] leading-none">
                             {elapsedMinutes}
                             {liveMatch.stoppage_time! > 0 && <span className="text-[0.6em] opacity-80 ml-1">+ {liveMatch.stoppage_time}</span>}
                             '
                           </span>
                        </div>
                      </div>

                      {/* Team B */}
                      <div className="flex-1 flex flex-col items-center gap-3 md:gap-6">
                        <div className="w-12 h-12 md:w-32 md:h-32 bg-white/5 backdrop-blur-xl rounded-full border border-white/10 flex items-center justify-center shadow-2xl">
                           <span className="font-headline font-black text-2xl md:text-7xl text-white opacity-80">{liveMatch.team_b?.name?.charAt(0)}</span>
                        </div>
                        <h2 className="font-headline font-black text-[9px] md:text-lg uppercase tracking-widest text-center text-white max-w-[80px] md:max-w-none leading-none">{liveMatch.team_b?.name}</h2>
                      </div>
                   </div>
                </div>
             ) : (
                <div className="text-center opacity-40">
                   <h2 className="font-headline font-black text-2xl md:text-5xl uppercase italic text-white tracking-tighter">SIGNAL STANDBY</h2>
                   <p className="text-[8px] md:text-[10px] font-black uppercase tracking-[0.5em] mt-4">WAITING FOR NEXT BROADCAST</p>
                </div>
             )}
          </div>
        </section>

        {/* 3. STICKY TAB NAVIGATION */}
        <nav className="sticky top-[72px] md:top-[96px] z-40 bg-surface-container-high/95 backdrop-blur-2xl flex w-full border border-white/5 mb-6 md:mb-8 rounded-sm shadow-2xl">
          {['live', 'schedule', 'leaderboard', 'franchise', 'brackets'].map((tab) => (
            <button 
              key={tab}
              onClick={() => handleTabChange(tab as any)} 
              className={`flex-1 py-4 md:py-5 font-headline text-[7px] md:text-[11px] font-black tracking-[0.2em] md:tracking-[0.3em] transition-all border-b-4 ${
                activeTab === tab ? 'border-primary-container text-white bg-white/5' : 'border-transparent text-secondary hover:text-white'
              }`}
            >
              {tab.toUpperCase()}
            </button>
          ))}
        </nav>

        {/* 4. TAB CONTENT LAYER (MOBILE OPTIMIZED) */}
        <div className="animate-in fade-in slide-in-from-bottom-6 duration-700">
          {activeTab === 'live' && (
            <div className="space-y-6">
               {/* Mobile Sub-Navigation for LIVE Tab */}
               <div className="lg:hidden flex gap-2 mb-4">
                  <button 
                    onClick={() => setMobileLiveMode('timeline')}
                    className={`flex-1 py-3 text-[10px] font-black uppercase tracking-widest border border-white/5 ${mobileLiveMode === 'timeline' ? 'bg-primary-container text-white' : 'bg-surface-container-low text-secondary'}`}
                  >
                    TIMELINE
                  </button>
                  <button 
                    onClick={() => setMobileLiveMode('lineups')}
                    className={`flex-1 py-3 text-[10px] font-black uppercase tracking-widest border border-white/5 ${mobileLiveMode === 'lineups' ? 'bg-primary-container text-white' : 'bg-surface-container-low text-secondary'}`}
                  >
                    LINEUPS
                  </button>
               </div>

               <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                  {/* SQUADS (SIDEBAR ON DESKTOP, SUB-TAB ON MOBILE) */}
                  <div className={`lg:col-span-3 space-y-6 ${mobileLiveMode === 'lineups' ? 'block' : 'hidden lg:block'}`}>
                     {[liveMatch?.team_a, liveMatch?.team_b].map((team, idx) => {
                       const isA = idx === 0
                       const teamId = isA ? liveMatch?.team_a_id : liveMatch?.team_b_id
                       const players = isA ? teamAPlayers : teamBPlayers
                       const pitch = getPitchPlayers(teamId || '', players)
                       const bench = getBenchPlayers(teamId || '', players)

                       return (
                        <div key={idx} className="bg-surface-container-high border-t-2 border-primary-container p-5 md:p-6 shadow-xl space-y-6">
                           <div className="flex flex-col border-b border-white/5 pb-4">
                              <h3 className="font-headline font-black text-[10px] tracking-widest text-primary-container uppercase leading-none mb-1">{team?.name}</h3>
                              {team?.owner_name && <span className="text-[7px] md:text-[8px] font-black text-secondary uppercase tracking-widest italic opacity-60">OWNER: {team.owner_name}</span>}
                           </div>
                           
                           <div className="space-y-6">
                              <div className="space-y-2">
                                 <span className="text-[7px] font-black text-secondary uppercase tracking-widest">ON PITCH (STARTERS)</span>
                                 {pitch.map(p => {
                                   const goals = liveMatch ? getPlayerGoalCount(p.id, teamId || '') : 0
                                   const yellow = liveMatch ? getPlayerCardCount(p.id, teamId || '', 'yellow') : 0
                                   const red = liveMatch ? getPlayerCardCount(p.id, teamId || '', 'red') : 0
                                   
                                   return (
                                     <div key={p.id} className={`flex justify-between items-center bg-black/40 p-3 border-l-2 ${benchTimers[p.id] ? 'border-tertiary shadow-[0_0_15px_rgba(255,183,77,0.1)]' : 'border-primary-container'}`}>
                                        <div className="flex flex-col">
                                           <span className="text-[11px] font-black uppercase text-white truncate max-w-[120px] flex items-center gap-2">
                                              {p.is_captain && <span className="text-tertiary text-[9px]">(C)</span>} {p.name}
                                              {benchTimers[p.id] && (
                                                <span className="px-1.5 py-0.5 bg-tertiary text-black text-[7px] font-black animate-pulse rounded-xs">
                                                  {Math.floor(benchTimers[p.id] / 60)}:{String(benchTimers[p.id] % 60).padStart(2, '0')}
                                                </span>
                                              )}
                                           </span>
                                           <div className="flex gap-1 mt-1">
                                              {yellow > 0 && <div className="w-2 h-3 bg-tertiary shadow-[0_0_5px_rgba(255,183,77,0.5)]"></div>}
                                              {red > 0 && <div className="w-2 h-3 bg-error shadow-[0_0_5px_rgba(230,33,39,0.5)]"></div>}
                                           </div>
                                        </div>
                                        {goals > 0 && <span className="bg-primary-container text-white text-[9px] font-black px-2 py-0.5 rounded-full">⚽ {goals}</span>}
                                     </div>
                                   )
                                 })}
                                 {pitch.length === 0 && <div className="p-4 border border-white/5 text-center text-[8px] font-black opacity-20 uppercase italic tracking-widest">Awaiting Lineup</div>}
                              </div>

                              {bench.length > 0 && (
                                <div className="space-y-2 opacity-50 hover:opacity-100 transition-opacity pt-4 border-t border-white/5">
                                   <span className="text-[7px] font-black text-secondary uppercase tracking-widest">BENCH</span>
                                   <div className="grid grid-cols-1 gap-1">
                                      {bench.map(p => (
                                        <div key={p.id} className="bg-black/20 p-2 text-[9px] font-bold text-secondary uppercase">{p.name}</div>
                                      ))}
                                   </div>
                                </div>
                              )}
                           </div>
                        </div>
                       )
                     })}
                  </div>

                  {/* LIVE FEED (MAIN CONTENT) */}
                  <div className={`lg:col-span-6 space-y-6 ${mobileLiveMode === 'timeline' ? 'block' : 'hidden lg:block'}`}>
                     <div className="bg-surface-container-high inner-stroke-top p-6 md:p-10 min-h-[400px] border border-white/5 shadow-2xl relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-primary-container/5 rounded-full -translate-y-16 translate-x-16"></div>
                        <div className="flex justify-between items-center mb-10 border-b border-white/5 pb-5 relative z-10">
                           <h3 className="font-headline font-black text-[10px] md:text-xs tracking-widest uppercase italic flex items-center gap-3">
                              <span className="w-1.5 h-1.5 rounded-full bg-primary-container animate-ping"></span> KEY EVENTS
                           </h3>
                           <span className="text-[8px] md:text-[9px] font-black text-secondary uppercase tracking-widest bg-black/60 px-3 py-1 border border-white/5">{liveEvents.length} MOMENTS</span>
                        </div>
                        
                        <div className="space-y-6 md:space-y-10 relative z-10">
                          {liveEvents.length > 0 ? [...liveEvents].reverse().map((event, i) => (
                            <div key={event.id} className="flex gap-4 md:gap-6 items-start group">
                               <div className={`mt-1 w-8 h-8 md:w-12 md:h-12 flex items-center justify-center shrink-0 border-2 shadow-2xl ${
                                 event.type === 'goal' ? 'border-primary-container bg-primary-container/20 text-primary-container' :
                                 event.type === 'yellow' ? 'border-tertiary bg-tertiary/20 text-tertiary' :
                                 event.type === 'red' ? 'border-error bg-error/20 text-error' : 'border-secondary bg-secondary/20 text-secondary'
                               }`}>
                                  <span className="material-symbols-outlined text-sm md:text-2xl">
                                    {event.type === 'goal' ? 'sports_soccer' : event.type === 'yellow' || event.type === 'red' ? 'rectangle' : 'cached'}
                                  </span>
                               </div>
                               <div className="flex-1 border-b border-white/[0.03] pb-5 md:pb-8">
                                  <div className="flex justify-between items-center mb-1">
                                     <span className="font-headline font-black text-xs md:text-lg uppercase tracking-tight text-white">{event.type === 'sub' ? 'SUBSTITUTION' : event.type.toUpperCase()}</span>
                                     <span className="text-[10px] md:text-xs font-black text-tertiary italic">{event.minute}'</span>
                                  </div>
                                  <p className="text-[10px] md:text-[13px] font-bold text-secondary uppercase tracking-widest leading-relaxed">
                                     {event.type === 'sub' ? 
                                       <span className="flex items-center gap-2"><span className="text-error">↓</span> {event.player?.name || event.player_id} <span className="text-tertiary">↑</span> {event.player_in_id}</span> : 
                                       <span className="opacity-80">{event.player?.name || event.player_id} <span className="opacity-40 mx-2">/</span> {event.team?.name}</span>
                                     }
                                  </p>
                               </div>
                            </div>
                          )) : (
                            <div className="py-24 text-center opacity-20">
                               <span className="material-symbols-outlined text-6xl md:text-8xl mb-6">sensors_off</span>
                               <div className="text-[9px] md:text-[11px] font-black uppercase tracking-[0.5em] italic">AWAITING LIVE DATA FEED</div>
                            </div>
                          )}
                        </div>
                     </div>
                  </div>
                  
                  {/* STATS (DESKTOP ONLY) */}
                  <div className="lg:col-span-3 space-y-6 hidden lg:block">
                     <div className="bg-surface-container-high border-t-2 border-tertiary p-6 shadow-xl">
                        <h3 className="font-headline font-black text-[10px] tracking-widest text-tertiary uppercase mb-6">DISCIPLINE TRACKER</h3>
                        <div className="space-y-4">
                           {liveEvents.filter(e => e.type === 'yellow' || e.type === 'red').slice(0, 5).map(e => (
                             <div key={e.id} className="flex justify-between items-center bg-black/40 p-3">
                                <div className="flex flex-col">
                                   <span className="text-[11px] font-black uppercase text-white">{e.player_id}</span>
                                   <span className="text-[8px] font-bold text-secondary uppercase italic">{e.team?.name}</span>
                                </div>
                                <div className={`w-3 h-4 ${e.type === 'yellow' ? 'bg-tertiary' : 'bg-error'}`}></div>
                             </div>
                           ))}
                           {liveEvents.filter(e => e.type === 'yellow' || e.type === 'red').length === 0 && <span className="text-[9px] opacity-20 uppercase font-bold italic">Clean Records Found</span>}
                        </div>
                     </div>
                  </div>
               </div>
            </div>
          )}

          {activeTab === 'schedule' && (
            <div className="space-y-12 max-w-4xl mx-auto">
               {/* Live Matches Column */}
               {fixtures.filter(m => m.status === 'live').length > 0 && (
                 <div className="space-y-4">
                    <h3 className="font-headline font-black text-[10px] tracking-[0.4em] text-primary-container uppercase border-l-4 border-primary-container pl-4">LIVE NOW</h3>
                    {fixtures.filter(m => m.status === 'live').map(m => (
                      <div key={m.id} className="bg-surface-container-high p-5 md:p-8 flex flex-col md:flex-row items-center justify-between gap-6 md:gap-12 relative overflow-hidden border border-primary-container/30 shadow-2xl animate-pulse-live">
                        <div className="flex-1 text-center md:text-left">
                          <h4 className="font-headline font-black text-xl md:text-2xl uppercase italic tracking-tighter text-white">{m.team_a?.name}</h4>
                        </div>
                        <div className="flex flex-col items-center px-8 text-center">
                          <div className="font-headline font-black text-4xl text-primary-container">
                             {m.score_a} : {m.score_b}
                             {m.result_override?.startsWith('P:') && (
                               <div className="text-[10px] text-tertiary mt-1">({m.result_override.split(':')[1]} P)</div>
                             )}
                          </div>
                          <button onClick={() => handleTabChange('live')} className="text-[9px] font-black text-white bg-primary-container px-4 py-1.5 uppercase mt-3 tracking-widest">SWITCH TO BROADCAST</button>
                        </div>
                        <div className="flex-1 text-center md:text-right">
                          <h4 className="font-headline font-black text-xl md:text-2xl uppercase italic tracking-tighter text-white">{m.team_b?.name}</h4>
                        </div>
                      </div>
                    ))}
                 </div>
               )}

                {/* Upcoming Matches */}
                {fixtures.filter(m => {
                  const matchDate = new Date(m.date || '');
                  const now = new Date();
                  now.setHours(0,0,0,0);
                  return m.status === 'scheduled' && matchDate >= now;
                }).length > 0 && (
                  <div className="space-y-4">
                     <h3 className="font-headline font-black text-[10px] tracking-[0.4em] text-secondary uppercase border-l-4 border-white/10 pl-4">UPCOMING FIXTURES</h3>
                     {fixtures.filter(m => {
                        const matchDate = new Date(m.date || '');
                        const now = new Date();
                        now.setHours(0,0,0,0);
                        return m.status === 'scheduled' && matchDate >= now;
                     }).map(m => (
                       <div key={m.id} className="bg-surface-container-low p-5 md:p-6 flex flex-col md:flex-row items-center justify-between gap-4 border border-white/5 opacity-80 hover:opacity-100 transition-all">
                         <div className="flex-1 text-center md:text-left">
                           <h4 className="font-headline font-black text-lg text-white uppercase italic tracking-tighter">{m.team_a?.name}</h4>
                         </div>
                         <div className="flex flex-col items-center px-6 py-2 bg-black/40 border border-white/5">
                           <span className="font-headline font-black text-lg text-white uppercase tracking-tighter">{m.time}</span>
                           <span className="text-[8px] font-bold text-secondary">{m.date ? format(new Date(m.date), 'MMM dd') : 'TBD'}</span>
                         </div>
                         <div className="flex-1 text-center md:text-right">
                           <h4 className="font-headline font-black text-lg text-white uppercase italic tracking-tighter">{m.team_b?.name}</h4>
                         </div>
                       </div>
                     ))}
                  </div>
                )}

               {/* Finished Matches (History) */}
               <div className="space-y-4">
                  <h3 className="font-headline font-black text-[10px] tracking-[0.4em] text-tertiary uppercase border-l-4 border-tertiary pl-4">MATCH HISTORY (RESULTS)</h3>
                  {fixtures.filter(m => m.status === 'ft' || m.status === 'ht').length > 0 ? (
                    fixtures.filter(m => m.status === 'ft' || m.status === 'ht').reverse().map(m => (
                      <div key={m.id} className="bg-surface-container-highest p-5 md:p-8 flex flex-col border border-white/5 relative group hover:border-tertiary/30 transition-all">
                        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
                          <div className={`flex-1 text-center md:text-left ${m.score_a! > m.score_b! ? 'text-white' : 'text-secondary opacity-50'}`}>
                            <h4 className="font-headline font-black text-xl md:text-2xl uppercase italic tracking-tighter flex items-center gap-3 justify-center md:justify-start">
                              {m.team_a?.name}
                              {m.score_a! > m.score_b! && <span className="material-symbols-outlined text-tertiary text-sm">trophy</span>}
                            </h4>
                          </div>
                          <div className="flex flex-col items-center">
                            <div className="font-headline font-black text-4xl text-white italic">{m.score_a} - {m.score_b}</div>
                            <span className="text-[8px] font-black bg-white/5 px-2 py-0.5 mt-2 tracking-widest uppercase opacity-40">{m.status === 'ft' ? 'FINAL SCORE' : 'HALF TIME'}</span>
                          </div>
                          <div className={`flex-1 text-center md:text-right ${m.score_b! > m.score_a! ? 'text-white' : 'text-secondary opacity-50'}`}>
                            <h4 className="font-headline font-black text-xl md:text-2xl uppercase italic tracking-tighter flex items-center gap-3 justify-center md:justify-end">
                              {m.score_b! > m.score_a! && <span className="material-symbols-outlined text-tertiary text-sm">trophy</span>}
                              {m.team_b?.name}
                            </h4>
                          </div>
                        </div>
                        {/* Goal Scorers Preview if available in API response */}
                        <div className="mt-6 pt-6 border-t border-white/5 flex flex-wrap justify-center gap-x-8 gap-y-2">
                           {/* We would need to fetch events for each match to show scorers here, 
                               or if the backend included them. For now, we point to the watch page 
                               or add a button to view timeline */}
                           <Link href={`/watch?tab=live&matchId=${m.id}`} className="text-[9px] font-black text-secondary hover:text-white transition-colors uppercase tracking-[0.2em]">VIEW MATCH TIMELINE & STATISTICS</Link>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="p-12 border border-dashed border-white/5 text-center text-[10px] font-black uppercase tracking-widest opacity-20">
                      NO HISTORY RECORDED IN THIS SEASON
                    </div>
                  )}
               </div>
            </div>
          )}

          {activeTab === 'leaderboard' && (
            <div className="space-y-16">
                {/* Team Standings Section */}
                <div className="space-y-6">
                   <div className="flex items-center gap-4 mb-6">
                      <div className="h-0.5 flex-1 bg-white/5"></div>
                      <h3 className="font-headline font-black text-xs tracking-[0.4em] text-primary-container uppercase">LEAGUE STANDINGS</h3>
                      <div className="h-0.5 flex-1 bg-white/5"></div>
                   </div>

                   <div className="overflow-x-auto bg-surface-container-high border border-white/5 shadow-2xl">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="bg-black/60 border-b border-white/10">
                            <th className="p-4 md:p-6 text-[8px] md:text-[10px] font-black tracking-[0.2em] text-secondary uppercase">POS</th>
                            <th className="p-4 md:p-6 text-[8px] md:text-[10px] font-black tracking-[0.2em] text-secondary uppercase text-left">FRANCHISE</th>
                            <th className="p-4 md:p-6 text-[8px] md:text-[10px] font-black tracking-[0.2em] text-secondary uppercase text-center">P</th>
                            <th className="p-4 md:p-6 text-[8px] md:text-[10px] font-black tracking-[0.2em] text-secondary uppercase text-center">W</th>
                            <th className="p-4 md:p-6 text-[8px] md:text-[10px] font-black tracking-[0.2em] text-secondary uppercase text-center hidden md:table-cell">D</th>
                            <th className="p-4 md:p-6 text-[8px] md:text-[10px] font-black tracking-[0.2em] text-secondary uppercase text-center">L</th>
                            <th className="p-4 md:p-6 text-[8px] md:text-[10px] font-black tracking-[0.2em] text-secondary uppercase text-center hidden md:table-cell">GD</th>
                            <th className="p-4 md:p-6 text-[8px] md:text-[10px] font-black tracking-[0.2em] text-primary-container uppercase text-center">PTS</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                          {standings.length > 0 ? standings.map((s, i) => (
                            <tr key={s.team} onClick={() => {
                                const t = fixtures.find(f => f.team_a?.name === s.team)?.team_a_id || fixtures.find(f => f.team_b?.name === s.team)?.team_b_id;
                                if (t) handleOpenSquad(t);
                              }} className="hover:bg-white/[0.05] cursor-pointer transition-colors group">
                              <td className="p-4 md:p-6 font-headline font-black text-sm md:text-xl italic text-white/20">{i + 1}</td>
                              <td className="p-4 md:p-6">
                                <div className="flex flex-col">
                                  <span className="font-headline font-black text-xs md:text-lg uppercase text-white group-hover:text-primary-container transition-colors tracking-tight">{s.team}</span>
                                  <span className="text-[7px] md:text-[9px] font-black text-secondary/40 uppercase tracking-widest">{s.owner}</span>
                                </div>
                              </td>
                              <td className="p-4 md:p-6 text-center font-bold text-secondary text-xs md:text-sm">{s.played}</td>
                              <td className="p-4 md:p-6 text-center font-bold text-white text-xs md:text-sm">{s.won}</td>
                              <td className="p-4 md:p-6 text-center font-bold text-secondary text-xs md:text-sm hidden md:table-cell">{s.drawn}</td>
                              <td className="p-4 md:p-6 text-center font-bold text-secondary text-xs md:text-sm">{s.lost}</td>
                              <td className="p-4 md:p-6 text-center font-bold text-tertiary text-xs md:text-sm hidden md:table-cell">{s.goal_difference > 0 ? `+${s.goal_difference}` : s.goal_difference}</td>
                              <td className="p-4 md:p-6 text-center font-headline font-black text-lg md:text-2xl italic text-primary-container">{s.points}</td>
                            </tr>
                          )) : (
                            <tr>
                              <td colSpan={8} className="p-20 text-center text-[10px] font-black uppercase tracking-[0.4em] opacity-20">Awaiting Final Results</td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                   </div>
                </div>

                {/* Scorer Standings Section */}
                <div className="space-y-6">
                   <div className="flex items-center gap-4 mb-6">
                      <div className="h-0.5 flex-1 bg-white/5"></div>
                      <h3 className="font-headline font-black text-xs tracking-[0.4em] text-tertiary uppercase">POINTS LEADERS (GOLDEN BOOT)</h3>
                      <div className="h-0.5 flex-1 bg-white/5"></div>
                   </div>
                   
                   <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {topScorers.map((scorer, i) => (
                        <div key={i} className="bg-surface-container-high p-5 flex items-center justify-between border-l-4 border-tertiary group hover:bg-surface-container-highest transition-all">
                           <div className="flex items-center gap-5">
                              <span className="font-headline font-black text-2xl italic text-white/10">{i+1}</span>
                              <div className="flex flex-col">
                                 <span className="font-headline font-black text-sm uppercase text-white group-hover:text-tertiary transition-colors">{scorer.player}</span>
                                 <span className="text-[8px] font-bold text-secondary uppercase tracking-widest">{scorer.team}</span>
                              </div>
                           </div>
                           <div className="flex flex-col items-end">
                              <span className="font-headline font-black text-2xl italic text-tertiary">{scorer.goals}</span>
                              <span className="text-[7px] font-black text-secondary uppercase tracking-widest">POINTS</span>
                           </div>
                        </div>
                      ))}
                      {topScorers.length === 0 && (
                        <div className="col-span-full py-12 text-center text-[10px] font-black uppercase tracking-widest opacity-20">NO SCORER DATA ACQUIRED</div>
                      )}
                   </div>
                </div>
             </div>
          )}

          {activeTab === 'franchise' && (
            <div className="space-y-12">
               <div className="flex flex-col items-center text-center max-w-2xl mx-auto space-y-4">
                  <h3 className="font-headline font-black text-4xl md:text-6xl uppercase italic text-white tracking-tighter leading-none">FRANCHISE <span className="text-primary-container">HUB</span></h3>
                  <p className="text-[9px] md:text-[11px] font-bold text-secondary uppercase tracking-[0.4em] opacity-60">TACTICAL OVERVIEW & PERFORMANCE MATRIX</p>
               </div>

               <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                   {allTeams.length > 0 ? (
                    allTeams.map((team, i) => {
                      const stats = standings.find(s => s.team.toLowerCase() === team.name.toLowerCase()) || { team: team.name, owner: team.owner_name, won: 0, lost: 0, played: 0 };
                      return (
                        <div key={team.id} onClick={() => handleOpenSquad(team.id)} className="bg-surface-container-high p-8 border border-white/5 relative overflow-hidden group hover:border-primary-container/30 cursor-pointer transition-all">
                          <div className="absolute top-0 right-0 w-24 h-24 bg-primary-container/5 rounded-full translate-x-12 -translate-y-12 group-hover:scale-150 transition-transform"></div>
                          
                          <div className="relative z-10 space-y-8">
                             <div>
                                <span className="text-[8px] font-black text-primary-container tracking-[0.4em] uppercase mb-2 block">FRANCHISE UNIT #{String(i+1).padStart(2, '0')}</span>
                                <h4 className="font-headline font-black text-2xl md:text-3xl uppercase italic text-white leading-tight tracking-tight">{team.name}</h4>
                                <span className="text-[10px] font-bold text-secondary uppercase tracking-widest opacity-60">MANAGER: {team.owner_name || 'N/A'}</span>
                             </div>

                             <div className="grid grid-cols-2 gap-4">
                                <div className="bg-black/60 p-4 border border-white/5">
                                   <span className="text-[8px] font-black text-secondary uppercase tracking-widest block mb-2 opacity-40">TOTAL WINS</span>
                                   <span className="font-headline font-black text-4xl text-white italic">{stats.won}</span>
                                </div>
                                <div className="bg-black/60 p-4 border border-white/5">
                                   <span className="text-[8px] font-black text-secondary uppercase tracking-widest block mb-2 opacity-40">TOTAL LOSSES</span>
                                   <span className="font-headline font-black text-4xl text-error italic">{stats.lost}</span>
                                </div>
                             </div>

                             <div className="pt-6 border-t border-white/5 flex justify-between items-center">
                                <div className="flex flex-col">
                                   <span className="font-headline font-black text-sm text-tertiary italic">{((stats.won / (stats.played || 1)) * 100).toFixed(0)}%</span>
                                   <span className="text-[7px] font-black text-secondary uppercase tracking-widest">WIN RATE</span>
                                </div>
                                <div className="flex flex-col items-end">
                                   <span className="font-headline font-black text-sm text-white italic">{stats.played}</span>
                                   <span className="text-[7px] font-black text-secondary uppercase tracking-widest">MATCHES</span>
                                </div>
                             </div>
                          </div>
                        </div>
                      )
                    })
                  ) : (
                    <div className="col-span-full py-40 text-center opacity-20 border border-dashed border-white/10">
                       <span className="text-[10px] font-black uppercase tracking-[0.5em]">FRANCHISE DATA CONSOLIDATION IN PROGRESS</span>
                    </div>
                  )}
               </div>
            </div>
          )}

          {activeTab === 'brackets' && (
             <div className="py-12 md:py-20 max-w-6xl mx-auto px-4">
                <div className="flex flex-col items-center text-center mb-16">
                   <h2 className="font-headline font-black text-4xl md:text-7xl uppercase italic text-white tracking-tighter leading-none mb-4">TOURNAMENT <span className="text-primary-container">BRACKET</span></h2>
                   <p className="text-[10px] md:text-[12px] font-bold text-secondary uppercase tracking-[0.5em] opacity-40">ROAD TO THE CHAMPIONSHIP</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-4 relative">
                    {/* Column 1: Quarter-Finals / Eliminator */}
                    <div className="space-y-8 flex flex-col justify-center">
                       <div className="text-[9px] font-black text-secondary tracking-widest uppercase mb-4 opacity-30 text-center">ELIMINATOR / QF</div>
                       {(() => {
                         const qfMatches = fixtures.filter(f => f.bracket_type === 'eliminator' || f.bracket_type === 'qf');
                         if (qfMatches.length > 0) {
                           return qfMatches.map(m => (
                             <div key={m.id} className="bg-surface-container-high border border-white/5 p-4 relative group">
                                <div className="flex justify-between items-center mb-2 border-b border-white/5 pb-2">
                                   <span className="text-[8px] font-black text-secondary uppercase">MATCH #{m.id.slice(-2)}</span>
                                   <span className="text-[8px] font-black text-primary-container uppercase">{m.status === 'live' ? 'LIVE' : m.time}</span>
                                </div>
                                <div className="space-y-2">
                                   <div className={`flex justify-between items-center ${m.score_a! > m.score_b! ? 'text-white' : 'text-secondary/40'}`}>
                                      <span className="text-xs font-black uppercase italic">{m.team_a?.name || 'TBD'}</span>
                                      <span className="font-headline font-black">{m.score_a ?? '-'}</span>
                                   </div>
                                   <div className={`flex justify-between items-center ${(m.score_b! > m.score_a!) || (m.result_override?.startsWith('P:') && parseInt(m.result_override.split(':')[1].split('-')[1]) > parseInt(m.result_override.split(':')[1].split('-')[0])) ? 'text-white' : 'text-secondary/40'}`}>
                                      <span className="text-xs font-black uppercase italic">{m.team_b?.name || 'TBD'}</span>
                                      <span className="font-headline font-black">
                                        {m.score_b ?? '-'}
                                        {m.result_override?.startsWith('P:') && <span className="text-[8px] ml-1">({m.result_override.split(':')[1].split('-')[1]})</span>}
                                      </span>
                                   </div>
                                </div>
                             </div>
                           ));
                         } else {
                           // Phantom/Mock QF structure
                           return [1, 2].map(i => (
                             <div key={`mock-qf-${i}`} className="bg-black/10 border border-dashed border-white/5 p-8 text-center opacity-10">
                                <span className="text-[8px] font-black uppercase tracking-widest">QUALIFIER {i} PENDING</span>
                             </div>
                           ));
                         }
                       })()}
                    </div>

                   {/* Column 2: Semi-Finals */}
                   <div className="space-y-8 flex flex-col justify-center">
                      <div className="text-[9px] font-black text-primary-container tracking-widest uppercase mb-4 text-center">SEMI-FINALS</div>
                      {[0, 1].map(idx => {
                        const m = fixtures.filter(f => f.bracket_type === 'sf')[idx]
                        return m ? (
                          <div key={m.id} className="bg-surface-container-high border-t-2 border-primary-container p-4 relative shadow-2xl">
                             <div className="space-y-2">
                                <div className={`flex justify-between items-center ${m.score_a! > m.score_b! ? 'text-white' : 'text-secondary/40'}`}>
                                   <span className="text-xs font-black uppercase italic">{m.team_a?.name || 'TBD'}</span>
                                   <span className="font-headline font-black">{m.score_a ?? '-'}</span>
                                </div>
                                <div className={`flex justify-between items-center ${m.score_b! > m.score_a! ? 'text-white' : 'text-secondary/40'}`}>
                                   <span className="text-xs font-black uppercase italic">{m.team_b?.name || 'TBD'}</span>
                                   <span className="font-headline font-black">{m.score_b ?? '-'}</span>
                                </div>
                             </div>
                          </div>
                        ) : (
                          <div key={idx} className="bg-black/20 border border-dashed border-white/5 p-8 text-center opacity-20 text-[8px] font-black uppercase tracking-widest">TBD</div>
                        )
                      })}
                   </div>

                   {/* Column 3: Grand Final */}
                   <div className="flex flex-col justify-center">
                      <div className="text-[9px] font-black text-tertiary tracking-widest uppercase mb-4 text-center">GRAND FINAL</div>
                      {fixtures.find(f => f.bracket_type === 'final') ? (
                        (() => {
                          const m = fixtures.find(f => f.bracket_type === 'final')!
                          return (
                            <div className="bg-surface-container-highest border-2 border-tertiary p-8 relative shadow-[0_0_50px_rgba(255,183,77,0.1)]">
                               <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-tertiary text-black text-[9px] font-black px-4 py-1 uppercase tracking-widest">CHAMPIONSHIP</div>
                               <div className="space-y-4 pt-4">
                                  <div className={`flex justify-between items-center ${m.score_a! > m.score_b! ? 'text-white' : 'text-secondary/40'}`}>
                                     <span className="text-lg font-black uppercase italic tracking-tighter">{m.team_a?.name || 'TBD'}</span>
                                     <span className="font-headline font-black text-2xl">{m.score_a ?? '-'}</span>
                                  </div>
                                  <div className="h-px bg-white/5"></div>
                                  <div className={`flex justify-between items-center ${m.score_b! > m.score_a! ? 'text-white' : 'text-secondary/40'}`}>
                                     <span className="text-lg font-black uppercase italic tracking-tighter">{m.team_b?.name || 'TBD'}</span>
                                     <span className="font-headline font-black text-2xl">{m.score_b ?? '-'}</span>
                                  </div>
                               </div>
                            </div>
                          )
                        })()
                      ) : (
                        <div className="bg-black/20 border-2 border-dashed border-tertiary/20 p-16 text-center opacity-20">
                           <span className="material-symbols-outlined text-4xl mb-4">trophy</span>
                           <div className="text-[8px] font-black uppercase tracking-widest">FINAL PENDING</div>
                        </div>
                      )}
                   </div>
                </div>
             </div>
          )}
        </div>
      </main>

      {/* MOBILE BOTTOM NAVIGATION */}
      <nav className="fixed bottom-0 left-0 w-full z-50 bg-[#0a0a0a]/95 backdrop-blur-3xl border-t border-white/10 flex justify-around items-center h-20 md:hidden px-4">
        {[
          { tab: 'live', icon: 'sensors', label: 'LIVE' },
          { tab: 'schedule', icon: 'stadium', label: 'SCHEDULE' },
          { tab: 'leaderboard', icon: 'leaderboard', label: 'STANDINGS' }
        ].map((item) => (
          <button 
            key={item.tab}
            onClick={() => handleTabChange(item.tab as any)}
            className={`flex flex-col items-center justify-center flex-1 h-full gap-1 transition-all ${activeTab === item.tab ? 'text-primary-container' : 'text-secondary opacity-40'}`}
          >
             <span className={`material-symbols-outlined text-2xl ${activeTab === item.tab ? 'fill-1 animate-pulse' : ''}`}>{item.icon}</span>
             <span className="text-[8px] font-black tracking-widest uppercase">{item.label}</span>
             {activeTab === item.tab && <div className="absolute top-0 w-8 h-1 bg-primary-container shadow-[0_0_10px_rgba(230,33,39,0.5)]"></div>}
          </button>
        ))}
        <Link href="/controller" className="flex flex-col items-center justify-center flex-1 h-full gap-1 text-secondary opacity-40">
           <span className="material-symbols-outlined text-2xl">admin_panel_settings</span>
           <span className="text-[8px] font-black tracking-widest uppercase">ADMIN</span>
        </Link>
      </nav>

      {/* SQUAD MODAL */}
      {selectedTeamForSquad && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/90 backdrop-blur-sm animate-in fade-in duration-300">
           <div className="bg-surface-container-high border-t-4 border-primary-container w-full max-w-2xl max-h-[80vh] overflow-hidden flex flex-col shadow-2xl relative">
              <button 
                onClick={() => setSelectedTeamForSquad(null)}
                className="absolute top-6 right-6 w-10 h-10 flex items-center justify-center bg-black/40 border border-white/10 hover:bg-primary-container transition-colors z-10"
              >
                 <span className="material-symbols-outlined text-white">close</span>
              </button>

              <div className="p-8 pb-4 border-b border-white/5">
                 <h3 className="font-headline font-black text-3xl italic text-white uppercase tracking-tighter">TEAM ROSTER</h3>
                 <p className="text-[10px] font-bold text-secondary uppercase tracking-[0.4em] mt-1">SQUAD DEPTH & PERSONNEL</p>
              </div>

              <div className="flex-1 overflow-y-auto p-8 space-y-4">
                 {squadLoading ? (
                   <div className="py-20 flex flex-col items-center">
                      <div className="w-10 h-10 border-2 border-primary-container border-t-transparent animate-spin rounded-full mb-4"></div>
                      <span className="text-[10px] font-black uppercase tracking-widest opacity-40">FETCHING ROSTER...</span>
                   </div>
                 ) : (
                   <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {squadPlayers.map(p => (
                        <div key={p.id} className="bg-black/40 p-4 border-l-2 border-white/10 flex justify-between items-center group hover:border-primary-container transition-all">
                           <div className="flex flex-col">
                              <span className="text-xs font-black uppercase text-white">{p.name} {p.is_captain && <span className="text-tertiary text-[9px]">(C)</span>}</span>
                              <span className="text-[8px] font-bold text-secondary uppercase tracking-widest">{p.position || 'PLAYER'}</span>
                           </div>
                           <span className="font-headline font-black text-xl text-white/5 group-hover:text-white/20 transition-colors">#{p.id.slice(-2)}</span>
                        </div>
                      ))}
                   </div>
                 )}
              </div>
           </div>
        </div>
      )}
    </div>
  )
}

export default function WatchPage() {
  return (
    <Suspense fallback={
      <div className="bg-background min-h-screen flex flex-col items-center justify-center">
        <div className="w-16 h-16 border-2 border-primary-container/20 border-t-primary-container animate-spin rounded-full mb-8"></div>
        <div className="animate-pulse tracking-[0.5em] uppercase text-[10px] text-white opacity-40">CALIBRATING SIGNAL...</div>
      </div>
    }>
      <WatchHubContent />
    </Suspense>
  )
}
