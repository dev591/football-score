'use client'

import { useState, useEffect } from 'react'
import { api, Player, Team } from '@/lib/api'
import Link from 'next/link'

export default function PlayersPage() {
  const [players, setPlayers] = useState<Player[]>([])
  const [teams, setTeams] = useState<Team[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedTeam, setSelectedTeam] = useState('all')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([api.getPlayers(), api.getTeams()]).then(([playerData, teamData]) => {
      setPlayers(playerData)
      setTeams(teamData)
      setLoading(false)
    })
  }, [])

  const filteredPlayers = players.filter(player => {
    const matchesSearch = player.name.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesTeam = selectedTeam === 'all' || player.team_id === selectedTeam
    return matchesSearch && matchesTeam
  })

  return (
    <div className="bg-background text-on-surface font-body selection:bg-primary-container selection:text-white min-h-screen">
      {/* Header */}
      <header className="fixed top-0 w-full z-50 border-t-2 border-[#c7c6c6]/30 bg-[#1c1b1b]/80 backdrop-blur-md flex justify-between items-center px-6 py-4 shadow-[0_20px_50px_rgba(0,0,0,0.5)]">
        <div className="flex items-center gap-4">
          <Link href="/" className="material-symbols-outlined text-on-surface">arrow_back</Link>
          <h1 className="font-headline font-black italic text-[#E62127] tracking-widest text-2xl uppercase">PLAYER PROFILES</h1>
        </div>
        <div className="flex items-center gap-2 bg-black/40 px-3 py-1 border border-outline-variant/10">
          <span className="material-symbols-outlined text-[12px] text-tertiary">verified</span>
          <span className="text-[9px] font-black tracking-widest uppercase">SCOUTING DATABASE</span>
        </div>
      </header>

      <main className="pt-24 pb-24 max-w-7xl mx-auto px-4 md:px-8">
        {/* Search & Filter Hero */}
        <section className="mb-12 space-y-8">
           <div className="text-center space-y-4">
              <h2 className="font-headline font-black text-4xl md:text-6xl uppercase italic tracking-tighter text-white">RECRUIT LOOKUP</h2>
              <p className="text-[10px] md:text-xs font-bold text-secondary uppercase tracking-[0.4em]">FILTER BY PERFORMANCE METRICS AND TEAM AFFILIATION</p>
           </div>
           
           <div className="flex flex-col md:flex-row gap-4 items-center justify-center">
              <div className="w-full md:max-w-md relative group">
                 <input 
                   type="text" 
                   value={searchQuery}
                   onChange={(e) => setSearchQuery(e.target.value)}
                   placeholder="SEARCH PLAYER NAME..."
                   className="w-full bg-surface-container-high border border-outline-variant/10 text-white font-headline font-bold px-6 py-4 uppercase tracking-widest placeholder:text-secondary/30 focus:outline-none focus:border-primary-container transition-all"
                 />
                 <span className="absolute right-4 top-1/2 -translate-y-1/2 material-symbols-outlined text-secondary">search</span>
              </div>
              
              <select 
                value={selectedTeam}
                onChange={(e) => setSelectedTeam(e.target.value)}
                className="w-full md:w-64 bg-surface-container-high border border-outline-variant/10 text-white font-headline font-bold px-6 py-4 uppercase tracking-widest focus:outline-none focus:border-primary-container transition-all appearance-none cursor-pointer"
              >
                <option value="all">ALL TEAMS</option>
                {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
           </div>
        </section>

        {/* Players Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {filteredPlayers.map((player) => (
            <div key={player.id} className="group relative bg-surface-container-high inner-stroke-top transition-all hover:bg-surface-container-highest cursor-pointer overflow-hidden">
               {/* Player Image Placeholder (Grayscale transition) */}
               <div className="aspect-[4/5] bg-black relative overflow-hidden">
                  <div className="absolute inset-0 bg-gradient-to-t from-background to-transparent z-10"></div>
                  <div className="w-full h-full flex items-center justify-center opacity-20 filter grayscale group-hover:grayscale-0 group-hover:opacity-40 transition-all duration-500 scale-110 group-hover:scale-100">
                    <span className="material-symbols-outlined text-[120px]">person</span>
                  </div>
                  
                  {/* Overlay Info */}
                  <div className="absolute bottom-6 left-6 right-6 z-20 space-y-2">
                     <span className="text-[9px] font-black text-primary-container bg-white/10 px-2 py-0.5 uppercase tracking-widest border border-primary-container/30">
                        {player.position || 'RECRUIT'}
                     </span>
                     <h3 className="font-headline font-black text-2xl text-white uppercase italic tracking-tighter leading-tight group-hover:text-primary-container transition-colors">
                        {player.name}
                     </h3>
                     <p className="text-[10px] font-bold text-secondary uppercase tracking-widest">{player.team?.name}</p>
                  </div>
               </div>
               
               {/* Stats Row */}
               <div className="p-6 border-t border-outline-variant/10 space-y-4">
                  <div className="space-y-1">
                     <div className="flex justify-between items-center text-[9px] font-black text-secondary tracking-widest uppercase">
                        <span>ATTACK RATING</span>
                        <span>84.2</span>
                     </div>
                     <div className="w-full h-1 bg-black overflow-hidden">
                        <div className="h-full bg-primary-container group-hover:bg-tertiary transition-colors" style={{ width: '84%' }}></div>
                     </div>
                  </div>
                  <div className="space-y-1">
                     <div className="flex justify-between items-center text-[9px] font-black text-secondary tracking-widest uppercase">
                        <span>DEFENSE RATING</span>
                        <span>67.9</span>
                     </div>
                     <div className="w-full h-1 bg-black overflow-hidden">
                        <div className="h-full bg-outline-variant group-hover:bg-white transition-all" style={{ width: '67%' }}></div>
                     </div>
                  </div>
               </div>

               {/* View Full Profile CTA */}
               <div className="absolute inset-0 bg-primary-container/90 flex flex-col items-center justify-center translate-y-full group-hover:translate-y-0 transition-transform duration-300 z-30 p-8 text-center">
                  <span className="material-symbols-outlined text-4xl mb-4 text-white">analytics</span>
                  <h4 className="font-headline font-black text-xl text-white uppercase mb-4">OPEN PRO-MATRIX</h4>
                  <p className="text-[10px] font-bold text-white/70 uppercase tracking-widest mb-6">ACCESS FULL BIOMETRIC DATA AND HEATMAPS FOR {player.name.split(' ')[0]}</p>
                  <button className="w-full bg-white text-primary-container font-black py-3 uppercase tracking-widest text-xs active:scale-95">VIEW ANALYTICS</button>
               </div>
            </div>
          ))}
          
          {filteredPlayers.length === 0 && !loading && (
            <div className="col-span-full py-40 border-2 border-dashed border-outline-variant/10 text-center flex flex-col items-center justify-center opacity-30">
               <span className="material-symbols-outlined text-6xl mb-4">person_off</span>
               <h3 className="font-headline font-black text-2xl uppercase italic tracking-tighter">NO RECRUITS MATCH SEARCH</h3>
               <p className="text-[10px] font-bold uppercase tracking-widest mt-2">TRY ADJUSTING YOUR FILTERS OR SEARCH PARAMETERS</p>
            </div>
          )}
        </div>
      </main>

      {/* Mobile Bottom Nav */}
      <nav className="fixed bottom-0 left-0 w-full z-50 bg-[#131313] border-t border-[#c7c6c6]/15 flex justify-around items-center pb-safe md:hidden">
        <Link href="/watch" className="flex flex-col items-center justify-center text-neutral-500 p-2 flex-1 h-16 hover:text-white transition-all">
          <span className="material-symbols-outlined text-xl">sensors</span>
          <span className="font-body text-[10px] font-bold uppercase tracking-[0.05em] mt-1">LIVE</span>
        </Link>
        <Link href="/watch" className="flex flex-col items-center justify-center text-neutral-500 p-2 flex-1 h-16 hover:text-white transition-all">
          <span className="material-symbols-outlined text-xl">sports_football</span>
          <span className="font-body text-[10px] font-bold uppercase tracking-[0.05em] mt-1">GAMES</span>
        </Link>
        <Link href="/players" className="flex flex-col items-center justify-center text-[#E62127] bg-gradient-to-tr from-[#1c1b1b] to-[#2a2a2a] p-2 flex-1 h-16">
          <span className="material-symbols-outlined text-xl">person_search</span>
          <span className="font-body text-[10px] font-bold uppercase tracking-[0.05em] mt-1">RECRUITS</span>
        </Link>
        <Link href="/controller" className="flex flex-col items-center justify-center text-neutral-500 p-2 flex-1 h-16 hover:text-white transition-all">
          <span className="material-symbols-outlined text-xl">settings_applications</span>
          <span className="font-body text-[10px] font-bold uppercase tracking-[0.05em] mt-1">ADMIN</span>
        </Link>
      </nav>
    </div>
  )
}
