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
  const tabParam = searchParams.get('tab') as 'live' | 'schedule' | 'leaderboard' | 'franchise' | null
  
  const [activeTab, setActiveTab] = useState<'live' | 'schedule' | 'leaderboard' | 'franchise'>(tabParam || 'live')
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

  const handleTabChange = (tab: 'live' | 'schedule' | 'leaderboard' | 'franchise') => {
    setActiveTab(tab)
    router.push(`/watch?tab=${tab}`, { scroll: false })
  }

  const fetchData = async (isManual = false) => {
    if (isManual) setLoading(true)
    try {
      // Fetch core data with individual error handling to prevent total blackout
      const [matches, standingData, scorerData, discData, starData, teamsData] = await Promise.all([
        api.getMatches(),
        api.getStandings(),
        api.getTopScorers(),
        api.getDiscipline(),
        api.getStarPlayers(),
        api.getTeams()
      ])
      
      setFixtures(Array.isArray(matches) ? matches : [])
      setStandings(Array.isArray(standingData) ? standingData : [])
      setTopScorers(Array.isArray(scorerData) ? scorerData.slice(0, 10) : [])
      setDiscipline(Array.isArray(discData) ? discData.slice(0, 10) : [])
      setStarPlayers(Array.isArray(starData) ? starData.slice(0, 10) : [])
      
      // Resilient Team Data
      let finalTeams = Array.isArray(teamsData) ? teamsData : []
      if (finalTeams.length === 0 && Array.isArray(standingData) && standingData.length > 0) {
        finalTeams = standingData.map(s => ({
          id: s.team_id || s.team,
          name: s.team,
          owner_name: s.owner || 'Franchise Partner'
        })) as Team[]
      }
      setAllTeams(finalTeams)
      
      // Select live match - prioritize 'live' status
      const live = Array.isArray(matches) ? matches.find(m => m.status === 'live') : null
      if (live) {
        setLiveMatch(live)
        
        try {
          const [events, a, b, line] = await Promise.all([
            api.getMatchEvents(live.id),
            api.getPlayers(live.team_a_id),
            api.getPlayers(live.team_b_id),
            api.getLineup(live.id)
          ])
          
          setLiveEvents(Array.isArray(events) ? events : [])
          setTeamAPlayers(Array.isArray(a) ? a : [])
          setTeamBPlayers(Array.isArray(b) ? b : [])
          setLineup(Array.isArray(line) ? line : [])
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
        setTeamAPlayers([])
        setTeamBPlayers([])
        setLineup([])
      }
      setLoading(false)
    } catch (err) {
      console.error('Failed to fetch data', err)
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
    
    const s = getSocket()
    if (!s) return
    
    const handleUpdate = () => {
      console.log('Socket update received, refreshing data...')
      fetchData()
    }
    
    s.on('match:updated', handleUpdate)
    s.on('fixtures:updated', handleUpdate)
    s.on('lineup:updated', handleUpdate)
    
    return () => {
      s.off('match:updated', handleUpdate)
      s.off('fixtures:updated', handleUpdate)
      s.off('lineup:updated', handleUpdate)
    }
  }, [])

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
      <header className={`fixed top-0 w-full z-50 backdrop-blur-3xl flex justify-between items-center px-4 md:px-8 py-3 md:py-5 shadow-2xl border-b border-white/5 ${
        liveMatch?.bracket_type === 'final' 
          ? 'border-t-4 border-[#FFD700] bg-[#0a0800]/90' 
          : liveMatch?.bracket_type === 'sf'
          ? 'border-t-4 border-[#C0C0C0] bg-[#080a0a]/90'
          : 'border-t-4 border-primary-container bg-[#0a0a0a]/90'
      }`}>
        <div className="flex items-center gap-4">
          <Link href="/" className="w-8 h-8 md:w-10 md:h-10 flex items-center justify-center border border-white/10 hover:bg-white/5 transition-all">
            <span className="material-symbols-outlined text-sm md:text-xl text-on-surface">arrow_back</span>
          </Link>
          <div className="flex flex-col">
            <span className={`text-[7px] md:text-[9px] font-black tracking-[0.4em] uppercase ${
              liveMatch?.bracket_type === 'final' ? 'text-[#FFD700]' : 
              liveMatch?.bracket_type === 'sf' ? 'text-[#C0C0C0]' : 'text-primary-container'
            }`}>
              {liveMatch?.bracket_type === 'final' ? '🏆 THE GRAND FINAL' : 
               liveMatch?.bracket_type === 'sf' ? '⚔️ SEMI FINAL' : 'BROADCAST SIGNAL'}
            </span>
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
              <div className={`flex items-center gap-3 px-3 md:px-5 py-1.5 md:py-2 border ${
                liveMatch?.bracket_type === 'final' ? 'bg-[#FFD700]/10 border-[#FFD700]/40' :
                liveMatch?.bracket_type === 'sf' ? 'bg-[#C0C0C0]/10 border-[#C0C0C0]/40' :
                'bg-black/40 border-white/10'
              }`}>
                <div className="flex flex-col items-end">
                   <span className={`text-[7px] md:text-[9px] font-black uppercase tracking-widest leading-none ${
                     liveMatch?.bracket_type === 'final' ? 'text-[#FFD700]' :
                     liveMatch?.bracket_type === 'sf' ? 'text-[#C0C0C0]' : 'text-primary-container'
                   }`}>LIVE</span>
                   <span className="text-[8px] font-bold text-secondary uppercase tracking-[0.2em] animate-pulse">STREAM ACTIVE</span>
                </div>
                <div className={`w-2 h-2 rounded-full animate-pulse-live ${
                  liveMatch?.bracket_type === 'final' ? 'bg-[#FFD700]' :
                  liveMatch?.bracket_type === 'sf' ? 'bg-[#C0C0C0]' : 'bg-primary-container'
                }`}></div>
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
                             {liveMatch.status === 'ht' ? 'HT' : `${elapsedMinutes}${liveMatch.stoppage_time! > 0 ? `+${liveMatch.stoppage_time}` : ''}'`}
                           </span>
                        </div>
                        {liveMatch.status === 'ht' && (
                          <div className="bg-tertiary/20 border border-tertiary/40 px-3 py-1 mt-2">
                            <span className="text-[9px] font-black text-tertiary uppercase tracking-widest animate-pulse">HALF TIME</span>
                          </div>
                        )}
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
          {['live', 'schedule', 'leaderboard', 'franchise'].map((tab) => (
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
                  <button onClick={() => setMobileLiveMode('timeline')} className={`flex-1 py-3 text-[10px] font-black uppercase tracking-widest border border-white/5 ${mobileLiveMode === 'timeline' ? 'bg-primary-container text-white' : 'bg-surface-container-low text-secondary'}`}>TIMELINE</button>
                  <button onClick={() => setMobileLiveMode('lineups')} className={`flex-1 py-3 text-[10px] font-black uppercase tracking-widest border border-white/5 ${mobileLiveMode === 'lineups' ? 'bg-primary-container text-white' : 'bg-surface-container-low text-secondary'}`}>LINEUPS</button>
               </div>

               {!liveMatch && (
                 <div className="flex flex-col items-center justify-center py-32 gap-6 opacity-30">
                   <div className="relative"><span className="material-symbols-outlined text-8xl text-secondary">sensors_off</span><div className="absolute inset-0 rounded-full bg-secondary/5 animate-ping"></div></div>
                   <div className="text-center"><h3 className="font-headline font-black text-2xl uppercase italic tracking-tighter text-white">NO SIGNAL</h3><p className="text-[9px] font-black uppercase tracking-[0.4em] text-secondary mt-2">WAITING FOR NEXT BROADCAST</p></div>
                 </div>
               )}

               {liveMatch && <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                  {/* ===== LEFT: SQUADS ===== */}
                  <div className={`lg:col-span-3 space-y-4 ${mobileLiveMode === 'lineups' ? 'block' : 'hidden lg:block'}`}>
                     {[liveMatch?.team_a, liveMatch?.team_b].map((team, idx) => {
                       const isA = idx === 0
                       const teamId = isA ? liveMatch?.team_a_id : liveMatch?.team_b_id
                       const players = isA ? teamAPlayers : teamBPlayers
                       const pitch = getPitchPlayers(teamId || '', players)
                       const bench = getBenchPlayers(teamId || '', players)
                       const teamScore = isA ? liveMatch.score_a : liveMatch.score_b
                       return (
                        <div key={idx} className="relative bg-surface-container-high border border-white/5 overflow-hidden">
                           <div className="absolute inset-0 bg-primary-container/[0.03] animate-pulse pointer-events-none"></div>
                           <div className="absolute top-0 left-0 w-full h-0.5 bg-gradient-to-r from-transparent via-primary-container to-transparent opacity-60"></div>
                           <div className="p-5 relative z-10">
                             <div className="flex items-center justify-between border-b border-white/5 pb-3 mb-4">
                               <div><h3 className="font-headline font-black text-xs tracking-widest text-white uppercase leading-none">{team?.name}</h3>{team?.owner_name && <span className="text-[7px] font-black text-secondary uppercase tracking-widest opacity-40">{team.owner_name}</span>}</div>
                               <span className="font-headline font-black text-4xl italic text-white leading-none">{teamScore ?? 0}</span>
                             </div>
                             <div className="space-y-1.5">
                               <span className="text-[7px] font-black text-primary-container/60 uppercase tracking-widest">ON PITCH</span>
                               {pitch.map(p => {
                                 const goals = getPlayerGoalCount(p.id, teamId || '')
                                 const yellow = getPlayerCardCount(p.id, teamId || '', 'yellow')
                                 const red = getPlayerCardCount(p.id, teamId || '', 'red')
                                 const onBench = !!benchTimers[p.id]
                                 return (
                                   <div key={p.id} className={`flex justify-between items-center px-3 py-2 border-l-2 transition-all ${onBench ? 'border-tertiary bg-tertiary/5 shadow-[0_0_10px_rgba(255,183,77,0.1)]' : goals > 0 ? 'border-primary-container bg-primary-container/5' : 'border-white/10 bg-black/20'}`}>
                                     <div className="flex items-center gap-2">
                                       {p.is_captain && <span className="text-tertiary text-[8px] font-black">(C)</span>}
                                       <span className="text-[10px] font-black uppercase text-white truncate max-w-[90px]">{p.name}</span>
                                       {onBench && <span className="text-[7px] font-black bg-tertiary text-black px-1.5 py-0.5 animate-pulse">{Math.floor(benchTimers[p.id]/60)}:{String(benchTimers[p.id]%60).padStart(2,'0')}</span>}
                                     </div>
                                     <div className="flex items-center gap-1.5">
                                       {goals > 0 && <span className="text-[9px]">⚽{goals}</span>}
                                       {yellow > 0 && <div className="w-2 h-3 bg-tertiary"></div>}
                                       {red > 0 && <div className="w-2 h-3 bg-error"></div>}
                                     </div>
                                   </div>
                                 )
                               })}
                               {pitch.length === 0 && <div className="py-4 text-center text-[8px] font-black opacity-20 uppercase italic">Awaiting Lineup</div>}
                             </div>
                             {bench.length > 0 && (
                               <div className="mt-3 pt-3 border-t border-white/5 space-y-1">
                                 <span className="text-[7px] font-black text-secondary/40 uppercase tracking-widest">BENCH</span>
                                 {bench.map(p => (<div key={p.id} className="px-3 py-1.5 bg-black/20 text-[9px] font-bold text-secondary/50 uppercase">{p.name}</div>))}
                               </div>
                             )}
                           </div>
                        </div>
                       )
                     })}
                  </div>

                  {/* ===== CENTER: LIVE FEED ===== */}
                  <div className={`lg:col-span-6 space-y-4 ${mobileLiveMode === 'timeline' ? 'block' : 'hidden lg:block'}`}>
                    {/* STATUS BAR */}
                    <div className={`relative overflow-hidden flex items-center justify-between px-5 py-3 border ${liveMatch.status === 'live' ? 'bg-primary-container/10 border-primary-container/40 shadow-[0_0_30px_rgba(230,33,39,0.15)]' : liveMatch.status === 'ht' ? 'bg-tertiary/10 border-tertiary/40' : 'bg-surface-container-high border-white/5'}`}>
                      {liveMatch.status === 'live' && <div className="absolute inset-0 bg-gradient-to-r from-primary-container/5 via-transparent to-primary-container/5 animate-pulse pointer-events-none"></div>}
                      {liveMatch.status === 'ht' && <div className="absolute inset-0 bg-gradient-to-r from-tertiary/5 via-transparent to-tertiary/5 animate-pulse pointer-events-none"></div>}
                      <div className="flex items-center gap-3 relative z-10">
                        {liveMatch.status === 'live' && <><div className="w-2 h-2 rounded-full bg-primary-container animate-ping"></div><span className="text-[9px] font-black text-primary-container uppercase tracking-[0.3em]">LIVE BROADCAST</span></>}
                        {liveMatch.status === 'ht' && <><div className="w-2 h-2 rounded-full bg-tertiary animate-pulse"></div><span className="text-[9px] font-black text-tertiary uppercase tracking-[0.3em]">HALF TIME BREAK</span></>}
                        {liveMatch.status === 'ft' && <span className="text-[9px] font-black text-secondary uppercase tracking-[0.3em]">FULL TIME</span>}
                      </div>
                      <div className="flex items-center gap-4 relative z-10">
                        <span className={`font-headline font-black text-2xl italic ${liveMatch.status === 'ht' ? 'text-tertiary' : 'text-white'}`}>
                          {liveMatch.status === 'ht' ? 'HT' : `${elapsedMinutes}'`}
                        </span>
                        {liveMatch.stoppage_time! > 0 && liveMatch.status === 'live' && <span className="text-[10px] font-black text-primary-container">+{liveMatch.stoppage_time}</span>}
                      </div>
                    </div>

                    {/* TIMELINE */}
                    <div className="relative bg-surface-container-high border border-white/5 overflow-hidden" style={{minHeight: '400px'}}>
                      {liveMatch.status === 'live' && <div className="absolute inset-0 pointer-events-none"><div className="absolute top-0 left-1/2 -translate-x-1/2 w-64 h-64 bg-primary-container/5 rounded-full blur-3xl animate-pulse"></div></div>}
                      <div className="p-6 relative z-10">
                        <div className="flex justify-between items-center mb-6 pb-4 border-b border-white/5">
                          <div className="flex items-center gap-3">
                            {liveMatch.status === 'live' && <span className="w-1.5 h-1.5 rounded-full bg-primary-container animate-ping"></span>}
                            <span className="font-headline font-black text-[10px] tracking-widest uppercase italic">KEY EVENTS</span>
                          </div>
                          <span className="text-[8px] font-black text-secondary bg-black/60 px-3 py-1 border border-white/5">{liveEvents.length} MOMENTS</span>
                        </div>
                        <div className="space-y-4">
                          {liveEvents.length > 0 ? [...liveEvents].reverse().map((event, i) => {
                            const isGoal = event.type === 'goal'
                            const isYellow = event.type === 'yellow'
                            const isRed = event.type === 'red'
                            const isSub = event.type === 'sub'
                            const isFirst = i === 0
                            return (
                              <div key={event.id} className={`flex gap-4 items-start ${isFirst && liveMatch.status === 'live' ? 'animate-in slide-in-from-top-4 duration-500' : ''}`}>
                                <div className={`shrink-0 w-10 h-10 md:w-12 md:h-12 flex items-center justify-center border-2 shadow-lg ${isGoal ? 'border-primary-container bg-primary-container/20 text-primary-container shadow-[0_0_20px_rgba(230,33,39,0.3)]' : isYellow ? 'border-tertiary bg-tertiary/20 text-tertiary shadow-[0_0_15px_rgba(255,183,77,0.2)]' : isRed ? 'border-error bg-error/20 text-error shadow-[0_0_15px_rgba(230,33,39,0.2)]' : 'border-secondary/30 bg-secondary/10 text-secondary'}`}>
                                  <span className="material-symbols-outlined text-lg md:text-2xl" style={isGoal || isYellow || isRed ? {fontVariationSettings:"'FILL' 1"} : {}}>{isGoal ? 'sports_soccer' : isYellow || isRed ? 'rectangle' : 'cached'}</span>
                                </div>
                                <div className={`flex-1 pb-4 border-b ${isGoal ? 'border-primary-container/10' : 'border-white/[0.04]'}`}>
                                  <div className="flex justify-between items-start">
                                    <div>
                                      <span className={`font-headline font-black text-sm md:text-base uppercase tracking-tight ${isGoal ? 'text-white' : isYellow ? 'text-tertiary' : isRed ? 'text-error' : 'text-secondary'}`}>{isSub ? 'SUBSTITUTION' : isGoal ? '⚽ GOAL!' : event.type.toUpperCase()}</span>
                                      <p className="text-[10px] font-bold text-secondary/70 uppercase tracking-widest mt-1">
                                        {isSub ? <span className="flex items-center gap-2"><span className="text-error font-black">↓ OUT</span> {event.player?.name || event.player_id} <span className="text-tertiary font-black">↑ IN</span> {(event as any).player_in?.name || event.player_in_id}</span> : <span>{event.player?.name || event.player_id} <span className="opacity-30 mx-1">/</span> {event.team?.name}</span>}
                                      </p>
                                    </div>
                                    <span className={`font-headline font-black text-lg italic shrink-0 ml-4 ${isGoal ? 'text-primary-container' : 'text-secondary/40'}`}>{event.minute}'</span>
                                  </div>
                                </div>
                              </div>
                            )
                          }) : (
                            <div className="py-20 flex flex-col items-center gap-4 opacity-20">
                              <div className="relative"><span className="material-symbols-outlined text-6xl text-secondary">sensors</span>{liveMatch.status === 'live' && <div className="absolute inset-0 flex items-center justify-center"><div className="w-16 h-16 rounded-full border border-secondary/20 animate-ping"></div></div>}</div>
                              <span className="text-[9px] font-black uppercase tracking-[0.4em] italic">{liveMatch.status === 'live' ? 'MATCH IN PROGRESS...' : 'NO EVENTS RECORDED'}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* ===== RIGHT: DISCIPLINE + SCORERS ===== */}
                  <div className="lg:col-span-3 space-y-4 hidden lg:block">
                    <div className="bg-surface-container-high border border-white/5 overflow-hidden">
                      <div className="p-5">
                        <div className="flex items-center gap-2 mb-4 pb-3 border-b border-white/5"><span className="w-1 h-4 bg-tertiary"></span><h3 className="font-headline font-black text-[9px] tracking-widest text-tertiary uppercase">DISCIPLINE</h3></div>
                        <div className="space-y-2">
                          {liveEvents.filter(e => e.type === 'yellow' || e.type === 'red').length > 0
                            ? liveEvents.filter(e => e.type === 'yellow' || e.type === 'red').slice(0,6).map(e => (
                              <div key={e.id} className="flex justify-between items-center bg-black/30 px-3 py-2 border border-white/5">
                                <div><span className="text-[10px] font-black uppercase text-white block">{e.player?.name || e.player_id}</span><span className="text-[7px] font-bold text-secondary uppercase">{e.team?.name} · {e.minute}'</span></div>
                                <div className={`w-3 h-4 shadow-lg ${e.type === 'yellow' ? 'bg-tertiary shadow-tertiary/30' : 'bg-error shadow-error/30'}`}></div>
                              </div>
                            ))
                            : <div className="py-8 text-center text-[8px] font-black opacity-20 uppercase italic tracking-widest">Clean Sheet</div>
                          }
                        </div>
                      </div>
                    </div>
                    {liveEvents.filter(e => e.type === 'goal').length > 0 && (
                      <div className="bg-surface-container-high border border-white/5 overflow-hidden">
                        <div className="p-5">
                          <div className="flex items-center gap-2 mb-4 pb-3 border-b border-white/5"><span className="w-1 h-4 bg-primary-container"></span><h3 className="font-headline font-black text-[9px] tracking-widest text-primary-container uppercase">SCORERS</h3></div>
                          <div className="space-y-2">
                            {liveEvents.filter(e => e.type === 'goal').map(e => (
                              <div key={e.id} className="flex justify-between items-center bg-primary-container/5 px-3 py-2 border border-primary-container/10">
                                <div><span className="text-[10px] font-black uppercase text-white block">⚽ {e.player?.name || e.player_id}</span><span className="text-[7px] font-bold text-secondary uppercase">{e.team?.name}</span></div>
                                <span className="font-headline font-black text-sm italic text-primary-container">{e.minute}'</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

               </div>}
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
                {/* TOURNAMENT BRACKET */}
                {(() => {
                  // --- Derive all bracket state from fixtures ---
                  const sfMatch = fixtures.find(f =>
                    (f.team_a?.name === 'NM VII SHADOWS' || f.team_b?.name === 'NM VII SHADOWS') &&
                    (f.team_a?.name === 'NM TRAPLORDS' || f.team_b?.name === 'NM TRAPLORDS')
                  )

                  const getSFScore = (team: string) => {
                    if (!sfMatch) return '-'
                    if (sfMatch.status !== 'ft' && sfMatch.status !== 'live') return '-'
                    return sfMatch.team_a?.name === team ? (sfMatch.score_a ?? '-') : (sfMatch.score_b ?? '-')
                  }

                  const sfWinner = (() => {
                    if (!sfMatch || sfMatch.status !== 'ft') return null
                    const aScore = sfMatch.score_a ?? 0
                    const bScore = sfMatch.score_b ?? 0
                    if (aScore > bScore) return sfMatch.team_a?.name
                    if (bScore > aScore) return sfMatch.team_b?.name
                    return null // draw — shouldn't happen in SF
                  })()

                  const finalMatch = fixtures.find(f =>
                    (f.team_a?.name === 'NM INFERNO' || f.team_b?.name === 'NM INFERNO') &&
                    (f.bracket_type === 'final')
                  )

                  const getFinalScore = (team: string) => {
                    if (!finalMatch) return '?'
                    if (finalMatch.status !== 'ft' && finalMatch.status !== 'live') return '?'
                    return finalMatch.team_a?.name === team ? (finalMatch.score_a ?? '?') : (finalMatch.score_b ?? '?')
                  }

                  const finalOpponent = sfWinner || 'SF WINNER'

                  const champion = (() => {
                    if (!finalMatch || finalMatch.status !== 'ft') return null
                    const aScore = finalMatch.score_a ?? 0
                    const bScore = finalMatch.score_b ?? 0
                    if (aScore > bScore) return finalMatch.team_a?.name
                    if (bScore > aScore) return finalMatch.team_b?.name
                    return null
                  })()

                  return (
                    <div className="space-y-6">
                      <div className="flex items-center gap-4 mb-6">
                        <div className="h-0.5 flex-1 bg-white/5"></div>
                        <h3 className="font-headline font-black text-xs tracking-[0.4em] text-[#FFD700] uppercase">🏆 TOURNAMENT BRACKET</h3>
                        <div className="h-0.5 flex-1 bg-white/5"></div>
                      </div>

                      {/* CHAMPION BANNER — shows after final */}
                      {champion && (
                        <div className="relative overflow-hidden bg-gradient-to-r from-[#1a1200] via-[#2a1f00] to-[#1a1200] border-2 border-[#FFD700] shadow-[0_0_80px_rgba(255,215,0,0.3)] p-8 flex flex-col items-center text-center gap-4 animate-in zoom-in-95 duration-700">
                          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_rgba(255,215,0,0.1)_0%,_transparent_70%)]"></div>
                          <span className="material-symbols-outlined text-7xl text-[#FFD700] relative z-10" style={{fontVariationSettings: "'FILL' 1"}}>emoji_events</span>
                          <div className="relative z-10">
                            <p className="text-[10px] font-black text-[#FFD700]/60 tracking-[0.5em] uppercase mb-2">STRIKER CHAMPION</p>
                            <h2 className="font-headline font-black text-4xl md:text-7xl uppercase italic text-[#FFD700] tracking-tighter leading-none">{champion}</h2>
                            <p className="text-[10px] font-black text-[#FFD700]/40 tracking-[0.3em] uppercase mt-3">SEASON 2025 · COLLEGE FOOTBALL TOURNAMENT</p>
                          </div>
                        </div>
                      )}

                      <div className="w-full overflow-x-auto pb-4">
                        <div className="min-w-[720px] flex items-center justify-center gap-0 px-4" style={{minHeight: '320px'}}>

                          {/* === ELIMINATED === */}
                          <div className="flex flex-col gap-4 w-44">
                            <div className="text-center mb-1">
                              <span className="text-[8px] font-black tracking-[0.3em] text-secondary/30 uppercase">ELIMINATED</span>
                            </div>
                            {['NM CARTEL', 'NM LEGACY UNITED'].map((team, i) => (
                              <div key={team} className="bg-black/40 border border-white/5 p-3 opacity-25 grayscale">
                                <span className="text-[7px] font-black text-secondary uppercase tracking-widest block mb-1">{i === 0 ? '4TH PLACE' : '5TH PLACE'}</span>
                                <span className="font-headline font-black text-xs uppercase text-white line-through">{team}</span>
                              </div>
                            ))}
                          </div>

                          {/* gap */}
                          <div className="w-6"></div>

                          {/* === SEMI FINALS === */}
                          <div className="flex flex-col gap-4 w-52">
                            <div className="text-center mb-1">
                              <span className="text-[8px] font-black tracking-[0.3em] text-[#C0C0C0] uppercase">⚔️ SEMI FINAL</span>
                            </div>

                            {/* SF card */}
                            <div className={`relative bg-surface-container-high overflow-hidden border ${sfMatch?.status === 'live' ? 'border-primary-container shadow-[0_0_30px_rgba(230,33,39,0.2)]' : 'border-[#C0C0C0]/30'}`}>
                              <div className={`absolute top-0 left-0 w-1 h-full ${sfMatch?.status === 'live' ? 'bg-primary-container' : 'bg-[#C0C0C0]'}`}></div>
                              <div className="p-4 pl-5 space-y-2">
                                <div className="flex items-center justify-between mb-1">
                                  <span className="text-[7px] font-black text-[#C0C0C0] tracking-[0.3em] uppercase">SEMI FINAL</span>
                                  {sfMatch?.status === 'live' && <span className="text-[7px] font-black text-primary-container animate-pulse uppercase tracking-widest">● LIVE</span>}
                                  {sfMatch?.status === 'ft' && <span className="text-[7px] font-black text-tertiary uppercase tracking-widest">✓ FT</span>}
                                  {(!sfMatch || sfMatch.status === 'scheduled') && <span className="text-[7px] font-black text-secondary/40 uppercase tracking-widest">UPCOMING</span>}
                                </div>
                                {['NM VII SHADOWS', 'NM TRAPLORDS'].map(team => {
                                  const isWinner = sfWinner === team
                                  const isLoser = sfWinner && sfWinner !== team
                                  return (
                                    <div key={team} className={`flex items-center justify-between px-3 py-2 border transition-all ${
                                      isWinner ? 'bg-tertiary/10 border-tertiary/40' :
                                      isLoser ? 'bg-black/20 border-white/5 opacity-40' :
                                      'bg-black/40 border-white/5'
                                    }`}>
                                      <div className="flex items-center gap-2">
                                        {isWinner && <span className="material-symbols-outlined text-xs text-tertiary" style={{fontVariationSettings:"'FILL' 1"}}>arrow_forward</span>}
                                        <span className={`font-headline font-black text-xs uppercase tracking-tight ${isWinner ? 'text-tertiary' : 'text-white'}`}>{team}</span>
                                      </div>
                                      <span className={`font-headline font-black text-lg italic ${isWinner ? 'text-tertiary' : 'text-[#C0C0C0]'}`}>{getSFScore(team)}</span>
                                    </div>
                                  )
                                })}
                              </div>
                            </div>

                            {/* Inferno direct final */}
                            <div className="relative bg-surface-container-high border border-[#FFD700]/30 overflow-hidden mt-2">
                              <div className="absolute top-0 left-0 w-1 h-full bg-[#FFD700]"></div>
                              <div className="p-4 pl-5">
                                <span className="text-[7px] font-black text-[#FFD700] tracking-[0.3em] uppercase block mb-2">GROUP WINNERS · BYE</span>
                                <div className="flex items-center justify-between bg-black/40 px-3 py-2 border border-[#FFD700]/20">
                                  <div className="flex items-center gap-2">
                                    <span className="material-symbols-outlined text-xs text-[#FFD700]" style={{fontVariationSettings:"'FILL' 1"}}>arrow_forward</span>
                                    <span className="font-headline font-black text-xs uppercase text-[#FFD700] tracking-tight">NM INFERNO</span>
                                  </div>
                                  <span className="text-[7px] font-black text-[#FFD700]/60 uppercase tracking-widest">FINAL</span>
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* connector */}
                          <div className="flex flex-col justify-center w-12" style={{height: '260px'}}>
                            <div className="flex flex-col h-full items-end">
                              <div className="flex-1 border-r border-t border-white/10 w-6"></div>
                              <div className="w-6 border-b border-white/10"></div>
                              <div className="flex-1 border-r border-b border-white/10 w-6"></div>
                            </div>
                          </div>

                          {/* === FINAL === */}
                          <div className="flex flex-col gap-4 w-56">
                            <div className="text-center mb-1">
                              <span className="text-[8px] font-black tracking-[0.3em] text-[#FFD700] uppercase">🏆 THE FINAL</span>
                            </div>
                            <div className={`relative bg-surface-container-high overflow-hidden border-2 ${
                              finalMatch?.status === 'live' ? 'border-primary-container shadow-[0_0_50px_rgba(230,33,39,0.3)]' :
                              finalMatch?.status === 'ft' ? 'border-[#FFD700] shadow-[0_0_50px_rgba(255,215,0,0.2)]' :
                              'border-[#FFD700]/40 shadow-[0_0_30px_rgba(255,215,0,0.1)]'
                            }`}>
                              <div className={`absolute top-0 left-0 w-1.5 h-full ${finalMatch?.status === 'live' ? 'bg-primary-container' : 'bg-[#FFD700]'}`}></div>
                              <div className="p-5 pl-6 space-y-3">
                                <div className="flex items-center justify-between">
                                  <span className="text-[7px] font-black text-[#FFD700] tracking-[0.3em] uppercase">GRAND FINAL</span>
                                  {finalMatch?.status === 'live' && <span className="text-[7px] font-black text-primary-container animate-pulse uppercase tracking-widest">● LIVE</span>}
                                  {finalMatch?.status === 'ft' && <span className="text-[7px] font-black text-tertiary uppercase tracking-widest">✓ FT</span>}
                                  {!finalMatch && <span className="text-[7px] font-black text-secondary/40 uppercase tracking-widest">UPCOMING</span>}
                                </div>
                                {/* NM INFERNO */}
                                {(() => {
                                  const isWinner = champion === 'NM INFERNO'
                                  const isLoser = champion && champion !== 'NM INFERNO'
                                  return (
                                    <div className={`flex items-center justify-between px-3 py-3 border ${isWinner ? 'bg-[#FFD700]/10 border-[#FFD700]/50' : isLoser ? 'bg-black/20 border-white/5 opacity-40' : 'bg-black/60 border-[#FFD700]/20'}`}>
                                      <div className="flex items-center gap-2">
                                        {isWinner && <span className="material-symbols-outlined text-sm text-[#FFD700]" style={{fontVariationSettings:"'FILL' 1"}}>emoji_events</span>}
                                        <span className={`font-headline font-black text-sm uppercase tracking-tight ${isWinner ? 'text-[#FFD700]' : 'text-white'}`}>NM INFERNO</span>
                                      </div>
                                      <span className={`font-headline font-black text-2xl italic ${isWinner ? 'text-[#FFD700]' : 'text-white'}`}>{getFinalScore('NM INFERNO')}</span>
                                    </div>
                                  )
                                })()}
                                {/* SF Winner */}
                                {(() => {
                                  const isWinner = champion === finalOpponent
                                  const isLoser = champion && champion !== finalOpponent
                                  return (
                                    <div className={`flex items-center justify-between px-3 py-3 border ${isWinner ? 'bg-[#FFD700]/10 border-[#FFD700]/50' : isLoser ? 'bg-black/20 border-white/5 opacity-40' : 'bg-black/40 border-white/5'}`}>
                                      <div className="flex items-center gap-2">
                                        {isWinner && <span className="material-symbols-outlined text-sm text-[#FFD700]" style={{fontVariationSettings:"'FILL' 1"}}>emoji_events</span>}
                                        <span className={`font-headline font-black text-sm uppercase tracking-tight ${isWinner ? 'text-[#FFD700]' : sfWinner ? 'text-white' : 'text-secondary'}`}>{finalOpponent}</span>
                                      </div>
                                      <span className={`font-headline font-black text-2xl italic ${isWinner ? 'text-[#FFD700]' : sfWinner ? 'text-white' : 'text-secondary/40'}`}>{getFinalScore(finalOpponent)}</span>
                                    </div>
                                  )
                                })()}
                                {!finalMatch && !sfWinner && <span className="text-[7px] font-black text-secondary/30 uppercase tracking-widest">AWAITING SF RESULT</span>}
                              </div>
                            </div>

                            {/* Trophy / Champion */}
                            <div className={`flex flex-col items-center gap-2 pt-2 transition-all ${champion ? 'opacity-100' : 'opacity-30'}`}>
                              <span className="material-symbols-outlined text-6xl text-[#FFD700]" style={{fontVariationSettings: champion ? "'FILL' 1" : "'FILL' 0"}}>emoji_events</span>
                              {champion
                                ? <span className="font-headline font-black text-sm text-[#FFD700] uppercase tracking-[0.2em] text-center">{champion}</span>
                                : <span className="text-[8px] font-black text-[#FFD700]/30 uppercase tracking-[0.3em]">CHAMPION</span>
                              }
                            </div>
                          </div>

                        </div>
                      </div>
                    </div>
                  )
                })()}

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
                      const stats = standings.find(s => s.team.toLowerCase() === team.name.toLowerCase()) || { team: team.name, owner: team.owner_name, won: 0, lost: 0, played: 0, goals_for: 0 };
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
                                <div className="bg-black/60 p-4 border border-white/5 col-span-2">
                                   <span className="text-[8px] font-black text-secondary uppercase tracking-widest block mb-2 opacity-40">TOTAL GOALS</span>
                                   <span className="font-headline font-black text-4xl text-tertiary italic">{(stats as any).goals_for ?? 0}</span>
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
