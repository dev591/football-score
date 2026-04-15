'use client'

import { useState, useEffect } from 'react'
import { api } from '@/lib/api'
import Link from 'next/link'
import ImportTab from './components/ImportTab'
import SquadsTab from './components/SquadsTab'
import FixturesTab from './components/FixturesTab'
import LiveScoreTab from './components/LiveScoreTab'

export default function ControllerDashboard() {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [activeTab, setActiveTab] = useState('live')

  useEffect(() => {
    const auth = localStorage.getItem('controller_authed')
    if (auth === 'true') {
      setIsAuthenticated(true)
    }
  }, [])

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    
    try {
      const result = await api.login(password)
      if (result.success) {
        setIsAuthenticated(true)
        localStorage.setItem('controller_authed', 'true')
      } else {
        setError('UNAUTHORIZED ACCESS DETECTED')
      }
    } catch (err) {
      setError('ENCRYPTION FAILURE: CHECK SYSTEM STATUS')
    }
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6">
        <div className="w-full max-w-md space-y-12">
          <div className="text-center space-y-4">
             <div className="flex items-center justify-center gap-2 mb-8">
               <span className="w-3 h-3 bg-primary-container animate-pulse-live"></span>
               <span className="text-[10px] font-black tracking-[0.5em] text-on-surface uppercase border-l border-white/20 pl-4 ml-2">SESSION TERMINATED</span>
             </div>
             <h1 className="font-headline font-black italic text-[#E62127] tracking-tighter text-6xl md:text-8xl lg:text-9xl uppercase leading-none">STRIKER</h1>
             <p className="font-headline font-bold text-xs text-secondary uppercase tracking-[0.3em]">TOURNAMENT COMMAND & CONTROL SYSTEM</p>
          </div>
          
          <form onSubmit={handleLogin} className="space-y-6">
            <div className="relative group">
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="ENTER SYSTEM KEY"
                className="w-full bg-surface-container-high border border-outline-variant/10 text-white font-headline font-black text-center text-xl md:text-2xl px-6 py-4 uppercase tracking-widest placeholder:text-secondary/30 focus:outline-none focus:border-primary-container transition-all"
              />
              <div className="absolute inset-0 border-t-2 border-white/10 pointer-events-none group-focus-within:border-white/20"></div>
            </div>
            
            {error && (
              <div className="text-center font-headline font-bold text-[10px] text-primary-container animate-pulse uppercase tracking-[0.3em]">
                {error}
              </div>
            )}
            
            <button
              type="submit"
              className="w-full bg-primary-container text-white font-black py-4 uppercase tracking-[0.2em] text-sm active:scale-95 hover:bg-on-primary-fixed-variant transition-all flex items-center justify-center gap-3"
            >
              INITIALIZE SESSION
              <span className="material-symbols-outlined text-sm">login</span>
            </button>
          </form>
          
          <div className="text-center">
             <Link href="/" className="text-[10px] font-bold text-secondary uppercase tracking-[0.2em] hover:text-white transition-colors">RETURN TO STRIKER FRONTEND</Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background text-on-surface font-body overflow-x-hidden">
      {/* Top Bar */}
      <header className="fixed top-0 w-full z-50 border-t-2 border-[#c7c6c6]/30 bg-[#1c1b1b]/80 backdrop-blur-md flex justify-between items-center px-6 py-4 shadow-[0_20px_50px_rgba(0,0,0,0.5)]">
        <div className="flex items-center gap-4">
          <Link href="/" className="material-symbols-outlined text-on-surface">account_circle</Link>
          <h1 className="font-headline font-black italic text-[#E62127] tracking-widest text-2xl uppercase">COMMAND CENTER</h1>
        </div>
        <div className="flex items-center gap-4">
           <div className="hidden md:flex flex-col items-end">
             <span className="text-[10px] font-black tracking-widest uppercase">OPERATOR ACTIVE</span>
             <span className="text-[8px] font-bold text-secondary uppercase tracking-widest">ENCRYPTION: AES-256</span>
           </div>
           <button 
             onClick={() => { localStorage.removeItem('controller_authed'); setIsAuthenticated(false); }}
             className="w-10 h-10 border border-outline-variant/10 flex items-center justify-center hover:bg-error/10 hover:text-error transition-all"
           >
             <span className="material-symbols-outlined text-xl">power_settings_new</span>
           </button>
        </div>
      </header>

      {/* Main Tab Navigation */}
      <nav className="fixed top-[72px] w-full z-40 flex bg-surface-container-low border-b border-outline-variant/10 backdrop-blur-md">
        {['live', 'fixtures', 'squads', 'import'].map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex-1 py-4 font-headline text-[10px] md:text-[11px] font-bold tracking-[0.2em] transition-all border-b-2 ${
              activeTab === tab 
                ? 'border-primary-container text-primary-container' 
                : 'border-transparent text-secondary hover:text-on-surface'
            }`}
          >
            {tab.toUpperCase()}
          </button>
        ))}
      </nav>

      {/* Content Area */}
      <main className="pt-40 pb-20 px-4 md:px-8">
        {activeTab === 'import' && <ImportTab />}
        {activeTab === 'squads' && <SquadsTab />}
        {activeTab === 'fixtures' && <FixturesTab />}
        {activeTab === 'live' && <LiveScoreTab />}
      </main>

      {/* Background Ambience */}
      <div className="fixed inset-0 pointer-events-none opacity-[0.02] z-0 overflow-hidden">
         <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_center,_var(--primary-container)_0%,_transparent_70%)]"></div>
         <div className="absolute inset-0 flex items-center justify-center font-headline font-black text-[20vw] opacity-10 select-none">COMMAND</div>
      </div>
    </div>
  )
}

