'use client'

import { useState, useEffect } from 'react'
import { api, Team, Match } from '@/lib/api'
import { format } from 'date-fns'

export default function FixturesTab() {
  const [teams, setTeams] = useState<Team[]>([])
  const [fixtures, setFixtures] = useState<Match[]>([])
  const [loading, setLoading] = useState(true)
  
  // Form State
  const [teamA, setTeamA] = useState('')
  const [teamB, setTeamB] = useState('')
  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [time, setTime] = useState('10:00')
  const [bracketType, setBracketType] = useState<'group' | 'qf' | 'sf' | 'final'>('group')

  useEffect(() => {
    Promise.all([api.getTeams(), api.getMatches()]).then(([teamData, matchData]) => {
      setTeams(teamData)
      setFixtures(matchData)
      setLoading(false)
    })
  }, [])

  const handleCreateMatch = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!teamA || !teamB || teamA === teamB) return alert('Select two distinct teams')
    
    await api.createMatch({
      team_a_id: teamA,
      team_b_id: teamB,
      date,
      time,
      status: 'scheduled',
      bracket_type: bracketType
    })
    
    // Refresh
    const matches = await api.getMatches()
    setFixtures(matches)
    setTeamA('')
    setTeamB('')
  }

  const handleDeleteMatch = async (id: string) => {
    if (confirm('Delete this fixture?')) {
      await api.deleteMatch(id)
      setFixtures(fixtures.filter(f => f.id !== id))
    }
  }

  return (
    <div className="space-y-12 max-w-7xl mx-auto">
      {/* Create Fixture Form */}
      <div className="bg-surface-container-high inner-stroke-top p-8">
        <h3 className="font-headline font-black text-xs tracking-[0.3em] text-primary-container uppercase mb-8 flex items-center gap-3">
          <span className="material-symbols-outlined text-sm">add_circle</span>
          GENERATE FIXTURE
        </h3>
        
        <form onSubmit={handleCreateMatch} className="grid grid-cols-1 md:grid-cols-4 gap-6 items-end">
          <div className="md:col-span-1">
             <label className="block text-[9px] font-black text-secondary tracking-widest uppercase mb-2">TEAM ALPHA</label>
             <select 
               value={teamA} 
               onChange={(e) => setTeamA(e.target.value)}
               className="w-full bg-black border border-outline-variant/10 p-3 font-headline font-bold text-xs uppercase tracking-widest text-white focus:outline-none focus:border-tertiary/50"
             >
               <option value="">SELECT TEAM</option>
               {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
             </select>
          </div>
          <div className="md:col-span-1">
             <label className="block text-[9px] font-black text-secondary tracking-widest uppercase mb-2">TEAM BETA</label>
             <select 
               value={teamB} 
               onChange={(e) => setTeamB(e.target.value)}
               className="w-full bg-black border border-outline-variant/10 p-3 font-headline font-bold text-xs uppercase tracking-widest text-white focus:outline-none focus:border-tertiary/50"
             >
               <option value="">SELECT TEAM</option>
               {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
             </select>
          </div>
          <div className="md:col-span-1 grid grid-cols-2 gap-4">
             <div>
                <label className="block text-[9px] font-black text-secondary tracking-widest uppercase mb-2">DATE</label>
                <input 
                   type="date" 
                   value={date} 
                   onChange={(e) => setDate(e.target.value)}
                   className="w-full bg-black border border-outline-variant/10 p-3 font-headline font-bold text-xs text-white focus:outline-none focus:border-tertiary/50"
                />
             </div>
             <div>
                <label className="block text-[9px] font-black text-secondary tracking-widest uppercase mb-2">TIME</label>
                <input 
                   type="time" 
                   value={time} 
                   onChange={(e) => setTime(e.target.value)}
                   className="w-full bg-black border border-outline-variant/10 p-3 font-headline font-bold text-xs text-white focus:outline-none focus:border-tertiary/50"
                />
             </div>
          </div>
          <div className="md:col-span-1">
             <label className="block text-[9px] font-black text-secondary tracking-widest uppercase mb-2">BRACKET / STAGE</label>
             <select 
               value={bracketType} 
               onChange={(e) => setBracketType(e.target.value as any)}
               className="w-full bg-black border border-outline-variant/10 p-3 font-headline font-bold text-xs uppercase tracking-widest text-white focus:outline-none focus:border-tertiary/50"
             >
               <option value="group">GROUP STAGE</option>
               <option value="qf">QUARTER FINAL</option>
               <option value="sf">SEMI FINAL</option>
               <option value="final">THE FINAL</option>
             </select>
          </div>
          <button 
            type="submit"
            className="bg-tertiary text-black font-black px-8 py-3 uppercase tracking-widest text-xs active:scale-95 transition-all"
          >
            CREATE MATCH
          </button>
        </form>
      </div>

      {/* Fixtures List */}
      <div className="space-y-6">
        <h3 className="font-headline font-black text-xs tracking-[0.3em] text-primary-container uppercase flex items-center gap-3">
          <span className="material-symbols-outlined text-sm">calendar_month</span>
          TOURNAMENT SCHEDULE
        </h3>
        
        <div className="grid grid-cols-1 gap-px bg-outline-variant/10 border border-outline-variant/10">
          {fixtures.map((m) => (
            <div key={m.id} className="bg-surface-container-low p-6 flex items-center justify-between group hover:bg-surface-container-high transition-colors">
              <div className="flex items-center gap-12">
                 <div className="flex flex-col items-center gap-2">
                    <div className="font-headline font-black text-sm text-secondary uppercase tracking-tighter">
                       {format(new Date(m.date), 'dd MMM')}
                    </div>
                    <div className="font-headline font-black text-xs text-tertiary">{m.time}</div>
                 </div>
                 
                 <div className="flex items-center gap-6">
                    <span className="font-headline font-bold text-sm uppercase tracking-widest min-w-[120px] text-right">{m.team_a?.name}</span>
                    <span className="font-headline font-black text-xs text-secondary italic">VS</span>
                    <span className="font-headline font-bold text-sm uppercase tracking-widest min-w-[120px]">{m.team_b?.name}</span>
                 </div>
              </div>
              
              <div className="flex items-center gap-6">
                 <div className="flex flex-col items-center gap-2 pr-6 border-r border-white/5">
                    <span className="text-[8px] font-black text-primary-container tracking-widest uppercase">{m.bracket_type || 'group'}</span>
                    <span className={`text-[9px] font-black tracking-widest px-2 py-0.5 border uppercase ${
                      m.status === 'live' ? 'text-white bg-primary-container border-primary-container animate-pulse-live' : 
                      m.status === 'ft' ? 'text-secondary border-outline-variant/30' : 
                      'text-tertiary border-tertiary/30'
                    }`}>
                      {m.status}
                    </span>
                 </div>
                 <button 
                   onClick={() => handleDeleteMatch(m.id)}
                   className="opacity-0 group-hover:opacity-100 p-2 text-error font-headline font-black text-[10px] tracking-widest uppercase"
                 >
                   DELETE
                 </button>
              </div>
            </div>
          ))}
          
          {fixtures.length === 0 && !loading && (
            <div className="py-20 text-center font-headline text-secondary uppercase text-xs tracking-widest italic">
              NO FIXTURES GENERATED YET
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
