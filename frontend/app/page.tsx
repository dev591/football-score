'use client'

import { useEffect, useRef, useState } from 'react'
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/dist/ScrollTrigger'
import { Match, api } from '@/lib/api'
import Link from 'next/link'

// --- Navbar Component ---
const Navbar = () => (
  <header className="fixed top-0 w-full z-50 border-t-2 border-[#c7c6c6]/30 bg-[#1c1b1b]/80 backdrop-blur-md flex justify-between items-center px-6 py-4 shadow-[0_20px_50px_rgba(0,0,0,0.5)]">
    <div className="flex items-center gap-4">
      <span className="material-symbols-outlined text-[#E62127]">menu</span>
      <span className="text-2xl font-black italic text-[#E62127] tracking-widest font-headline">STRIKER</span>
    </div>
    <div className="flex items-center gap-6">
      <div className="hidden md:flex gap-8">
        <Link className="text-[#E62127] border-b-2 border-[#E62127] font-headline font-bold uppercase tracking-tighter" href="/watch?tab=live">LIVE</Link>
        <Link className="text-neutral-400 font-headline font-bold uppercase tracking-tighter hover:text-white transition-colors" href="/watch?tab=schedule">GAMES</Link>
        <Link className="text-neutral-400 font-headline font-bold uppercase tracking-tighter hover:text-white transition-colors" href="/watch?tab=leaderboard">STANDINGS</Link>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-tertiary">SEASON 2025</span>
        <div className="w-8 h-8 bg-surface-container-high border border-outline-variant/30 flex items-center justify-center">
          <span className="material-symbols-outlined text-sm text-secondary">person</span>
        </div>
      </div>
    </div>
  </header>
);

// --- Hero Section ---
const HeroSection = ({ canvasRef }: { canvasRef: React.RefObject<HTMLCanvasElement> }) => (
  <section className="relative h-[80svh] flex flex-col justify-center items-center overflow-hidden px-6">
    <div className="absolute inset-0 z-0">
      <canvas ref={canvasRef} className="w-full h-full opacity-60" />
      <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-background/50"></div>
    </div>
    <div className="relative z-10 text-center flex flex-col items-center">
      <div className="flex items-center gap-2 bg-black/60 px-4 py-1 mb-8 border border-outline-variant/20 backdrop-blur-sm">
        <span className="w-2 h-2 rounded-full bg-tertiary animate-pulse-live"></span>
        <span className="text-[10px] font-black tracking-[0.3em] text-on-surface">SEASON 2025 · IN PROGRESS</span>
      </div>
      <h1 className="hero-title font-headline text-[15vw] md:text-[12rem] font-black italic tracking-tighter leading-none text-white">
        STRIKER
      </h1>
      <p className="hero-sub font-headline text-xl md:text-3xl font-bold uppercase tracking-[0.1em] text-secondary mt-4 max-w-2xl">
        The Ultimate College Battleground
      </p>
      <div className="hero-btns mt-12 flex flex-col md:flex-row gap-4">
        <Link href="/watch" className="bg-gradient-to-tr from-primary-container to-on-primary-fixed-variant px-12 py-4 font-black uppercase tracking-widest text-white active:scale-95 transition-transform flex items-center justify-center">
          ENTER ARENA
        </Link>
        <Link href="/watch" className="bg-surface-container-high/40 backdrop-blur-md border border-secondary/30 px-12 py-4 font-black uppercase tracking-widest text-white hover:bg-surface-container-high/60 transition-all flex items-center justify-center">
          WATCH LIVE
        </Link>
      </div>
    </div>
  </section>
);

// --- Stats Section ---
const StatsSection = () => (
  <section id="stats" className="bg-surface-container-low border-y border-outline-variant/10">
    <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-outline-variant/10">
      <div className="flex flex-col items-center py-10">
        <span className="stat-count font-headline text-5xl font-black text-white italic" data-target="128">0</span>
        <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-secondary mt-2">TOTAL TEAMS</span>
      </div>
      <div className="flex flex-col items-center py-10">
        <span className="stat-count font-headline text-5xl font-black text-tertiary italic" data-target="2560">0</span>
        <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-secondary mt-2">TOTAL PLAYERS</span>
      </div>
      <div className="flex flex-col items-center py-10">
        <span className="stat-count font-headline text-5xl font-black text-white italic" data-target="500000">0</span>
        <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-secondary mt-2">PRIZE POOL</span>
      </div>
    </div>
  </section>
);

// --- Matches Section ---
const MatchesSection = ({ matches, loading }: { matches: Match[], loading: boolean }) => (
  <section className="py-24 px-6 max-w-7xl mx-auto">
    <div className="flex flex-col md:flex-row md:items-end justify-between mb-12 gap-4">
      <div>
        <h2 className="text-[10px] font-bold uppercase tracking-[0.3em] text-primary-container mb-2">SCHEDULE</h2>
        <h3 className="font-headline text-5xl md:text-7xl font-black uppercase tracking-tighter italic">MATCH DAY</h3>
      </div>
    </div>
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-px bg-outline-variant/15 border border-outline-variant/15 shadow-2xl">
      {matches.slice(0, 2).map((match, i) => (
        <div key={match.id} className="bg-surface-container-low p-8 flex flex-col md:flex-row items-center gap-8 relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-4">
            {match.status === 'live' ? (
              <span className="bg-primary-container text-white text-[10px] font-black px-3 py-1 flex items-center gap-2">
                <span className="w-1.5 h-1.5 bg-white rounded-full animate-pulse-live"></span> LIVE NOW
              </span>
            ) : (
              <span className="text-secondary text-[10px] font-black px-3 py-1 border border-outline-variant/30 uppercase">
                {match.time}
              </span>
            )}
          </div>
          <div className="flex-1 flex items-center justify-between w-full md:w-auto gap-6 transition-opacity group-hover:opacity-100">
            <div className="flex flex-col items-center gap-4">
              <div className="w-20 h-20 bg-black flex items-center justify-center p-4 inner-stroke-top shadow-lg">
                <span className="font-headline font-black text-2xl text-tertiary">{match.team_a?.name?.substring(0, 1)}</span>
              </div>
              <span className="font-headline font-bold text-center uppercase tracking-tight truncate max-w-[120px]">{match.team_a?.name}</span>
            </div>
            <div className="flex flex-col items-center">
              <span className="font-headline text-4xl font-black italic text-tertiary">{match.score_a ?? 0} - {match.score_b ?? 0}</span>
              <span className="text-[10px] font-bold text-secondary uppercase mt-2">MATCH {i + 1}</span>
            </div>
            <div className="flex flex-col items-center gap-4">
              <div className="w-20 h-20 bg-black flex items-center justify-center p-4 inner-stroke-top shadow-lg">
                <span className="font-headline font-black text-2xl text-primary">{match.team_b?.name?.substring(0, 1)}</span>
              </div>
              <span className="font-headline font-bold text-center uppercase tracking-tight truncate max-w-[120px]">{match.team_b?.name}</span>
            </div>
          </div>
        </div>
      ))}
      {matches.length === 0 && !loading && (
        <div className="col-span-full py-20 text-center bg-surface-container-low font-headline text-2xl text-secondary italic">
          NO MATCHES SCHEDULED TODAY
        </div>
      )}
    </div>
  </section>
);

// --- Leaders Section ---
const LeadersSection = ({ topScorers }: { topScorers: any[] }) => (
  <section className="py-32 px-6">
    <div className="max-w-7xl mx-auto">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-20">
        <div className="order-2 lg:order-1">
          <h3 className="font-headline text-4xl md:text-6xl font-black uppercase italic tracking-tighter mb-8 text-white">
            POINTS <br />
            <span className="text-tertiary">LEADERS</span>
          </h3>
          <div className="space-y-4">
            {topScorers.length > 0 ? topScorers.map((scorer, i) => (
              <div key={i} className="flex items-center justify-between p-6 bg-surface-container-high border-r-4 border-tertiary group hover:bg-surface-container-highest transition-all">
                <div className="flex items-center gap-6">
                  <span className="font-headline text-3xl font-black text-white/5 w-10 italic">{i+1}</span>
                  <div className="flex flex-col">
                    <span className="font-headline font-black text-lg text-white uppercase tracking-tight">{scorer.player}</span>
                    <span className="text-[9px] font-bold text-secondary uppercase tracking-widest">{scorer.team}</span>
                  </div>
                </div>
                <div className="text-right">
                  <span className="font-headline text-3xl font-black text-tertiary italic leading-none block">{scorer.goals}</span>
                  <span className="text-[8px] font-black text-secondary uppercase tracking-widest">POINTS</span>
                </div>
              </div>
            )) : (
              <div className="p-12 border border-dashed border-white/5 text-center text-[10px] font-bold uppercase tracking-widest opacity-20">
                LEADERBOARD DATA PENDING BROADCAST
              </div>
            )}
            <Link href="/watch?tab=leaderboard" className="block text-center py-4 bg-tertiary text-black text-[10px] font-black uppercase tracking-widest hover:brightness-110 transition-all">
              VIEW FULL STANDINGS
            </Link>
          </div>
        </div>
        <div className="order-1 lg:order-2 relative group overflow-hidden border border-white/5 aspect-[4/5] bg-surface-container-lowest flex items-center justify-center p-12">
          <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1579952363873-27f3bade9f55?q=80&w=1000')] bg-cover bg-center opacity-20 filter grayscale group-hover:scale-110 transition-transform duration-1000"></div>
          <div className="relative z-10 text-center">
            <span className="material-symbols-outlined text-9xl text-tertiary opacity-40 mb-8">workspace_premium</span>
            <h4 className="font-headline text-4xl font-black uppercase italic text-white mb-4">GOLDEN BOOT</h4>
            <p className="text-secondary text-[10px] font-bold uppercase tracking-[0.4em] max-w-xs mx-auto leading-loose">
              Awarded to the player with the highest points tally at the end of the season. 1 Goal = 1 Point.
            </p>
          </div>
        </div>
      </div>
    </div>
  </section>
);

// --- Prize Pool Section ---
const PrizePoolSection = () => (
  <section className="py-24 relative overflow-hidden bg-gradient-to-b from-surface-container-low to-background">
    <div className="absolute top-0 right-0 w-[50vw] h-[50vw] bg-primary-container/5 rounded-full blur-[120px] -translate-y-1/2 translate-x-1/2"></div>
    <div className="max-w-7xl mx-auto px-6 relative z-10">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
        <div className="lg:col-span-5 space-y-8 text-center md:text-left">
          <div className="inline-flex items-center gap-3 px-4 py-1.5 bg-tertiary/10 border border-tertiary/20 rounded-full mx-auto md:mx-0">
            <span className="w-2 h-2 rounded-full bg-tertiary animate-pulse"></span>
            <span className="text-[10px] font-black tracking-[0.3em] text-tertiary uppercase">CHAMPIONSHIP STAKES</span>
          </div>
          <h2 className="font-headline text-6xl md:text-8xl font-black uppercase italic leading-[0.85] tracking-tighter text-white">
            ELEVATE YOUR <br />
            <span className="text-primary-container">LEGACY.</span>
          </h2>
          <p className="text-secondary uppercase text-[10px] tracking-[0.2em] font-bold max-w-md leading-loose mx-auto md:mx-0">
            The highest collegiate prize pool in the circuit. Compete for more than just glory—dominate for the throne.
          </p>
        </div>
        <div className="lg:col-span-7 grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-[#121212] p-10 inner-stroke-top border-t-8 border-tertiary shadow-2xl group hover:-translate-y-2 transition-transform">
            <span className="text-[10px] font-black text-secondary tracking-[0.4em] uppercase mb-4 block">1ST PLACE / CHAMPION</span>
            <div className="flex items-baseline gap-2 mb-6">
              <span className="font-headline text-5xl font-black text-white italic">₹</span>
              <span className="font-headline text-7xl font-black text-tertiary italic">2.5L+</span>
            </div>
            <Link href="/watch" className="text-[10px] font-black text-white px-6 py-3 border border-white/10 group-hover:bg-tertiary group-hover:text-black transition-all inline-block">CLAIM THE THRONE</Link>
          </div>
          <div className="bg-[#121212] p-10 border border-white/5 shadow-2xl group hover:-translate-y-2 transition-transform">
            <span className="text-[10px] font-black text-secondary tracking-[0.4em] uppercase mb-4 block">2ND PLACE / RUNNER UP</span>
            <div className="flex items-baseline gap-2 mb-6">
              <span className="font-headline text-3xl font-black text-white italic">₹</span>
              <span className="font-headline text-5xl font-black text-white italic">1.2L+</span>
            </div>
            <span className="text-[9px] font-black text-secondary/40 uppercase tracking-widest">RUNNER UP BONUS INCLUDED</span>
          </div>
        </div>
      </div>
    </div>
  </section>
);

// --- Roadmap Section ---
const RoadmapSection = () => (
  <section className="py-24 bg-surface-container-lowest">
    <div className="max-w-7xl mx-auto px-6">
      <div className="text-center mb-16">
        <h2 className="font-headline text-5xl md:text-7xl font-black italic uppercase tracking-tighter text-white">THE ROAD TO GLORY</h2>
        <p className="text-secondary mt-4 max-w-xl mx-auto uppercase text-xs tracking-widest leading-loose">Master the process, claim the crown. Built for the elite.</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        <div className="bg-[#121212] p-10 flex flex-col items-center text-center group border-t-4 border-transparent hover:border-tertiary transition-all">
          <div className="w-20 h-20 flex items-center justify-center bg-background mb-8 group-hover:scale-110 transition-transform">
            <span className="material-symbols-outlined text-5xl text-tertiary">person_add</span>
          </div>
          <span className="text-[10px] font-black text-secondary tracking-[0.4em] mb-4 uppercase">01. THE CALL</span>
          <h4 className="font-headline text-3xl font-black uppercase italic mb-4 text-white">RECRUIT</h4>
          <p className="text-secondary text-sm leading-relaxed">Enter the registry. Build your profile and get scouted by the tournament leads.</p>
        </div>
        <div className="bg-[#121212] p-10 flex flex-col items-center text-center group border-t-4 border-transparent hover:border-tertiary transition-all">
          <div className="w-20 h-20 flex items-center justify-center bg-background mb-8 group-hover:scale-110 transition-transform">
            <span className="material-symbols-outlined text-5xl text-tertiary">sports_football</span>
          </div>
          <span className="text-[10px] font-black text-secondary tracking-[0.4em] mb-4 uppercase">02. THE ARENA</span>
          <h4 className="font-headline text-3xl font-black uppercase italic mb-4 text-white">COMPETE</h4>
          <p className="text-secondary text-sm leading-relaxed">High-stakes brackets. Every match broadcast live to the tournament platform.</p>
        </div>
        <div className="bg-[#121212] p-10 flex flex-col items-center text-center group border-t-4 border-transparent hover:border-tertiary transition-all">
          <div className="w-20 h-20 flex items-center justify-center bg-background mb-8 group-hover:scale-110 transition-transform">
            <span className="material-symbols-outlined text-5xl text-tertiary">trophy</span>
          </div>
          <span className="text-[10px] font-black text-secondary tracking-[0.4em] mb-4 uppercase">03. THE THRONE</span>
          <h4 className="font-headline text-3xl font-black uppercase italic mb-4 text-white">GLORY</h4>
          <p className="text-secondary text-sm leading-relaxed">Win the championship title and prove your dominance on the college stage.</p>
        </div>
      </div>
    </div>
  </section>
);

// --- Footer Component ---
const Footer = () => (
  <footer className="bg-surface-container-lowest py-16 px-6 border-t border-outline-variant/10 pb-32 md:pb-16">
    <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-start md:items-center gap-8">
      <div>
        <span className="text-4xl font-black italic text-[#E62127] tracking-widest font-headline">STRIKER</span>
        <p className="text-secondary text-xs uppercase tracking-widest mt-4 max-w-xs">The premier collegiate sports infrastructure and broadcasting network.</p>
      </div>
      <nav className="flex gap-8">
        <Link href="#" className="flex flex-col items-center text-on-surface hover:text-primary transition-colors">
          <span className="material-symbols-outlined mb-1">home</span>
          <span className="font-body text-[10px] font-bold uppercase tracking-[0.05em]">HOME</span>
        </Link>
        <Link href="/watch" className="flex flex-col items-center text-neutral-500 hover:text-white transition-colors">
          <span className="material-symbols-outlined mb-1">live_tv</span>
          <span className="font-body text-[10px] font-bold uppercase tracking-[0.05em]">WATCH</span>
        </Link>
        <Link href="/controller" className="flex flex-col items-center text-neutral-500 hover:text-white transition-colors">
          <span className="material-symbols-outlined mb-1">settings_applications</span>
          <span className="font-body text-[10px] font-bold uppercase tracking-[0.05em]">ADMIN</span>
        </Link>
      </nav>
    </div>
  </footer>
);

// --- Main LandingPage Orchestrator ---
export default function LandingPage() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [matches, setMatches] = useState<Match[]>([])
  const [topScorers, setTopScorers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // 1. Three.js background
    let cleanupThree: () => void = () => {};
    if (canvasRef.current && typeof window !== 'undefined') {
      const THREE = require('three');
      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
      const renderer = new THREE.WebGLRenderer({ canvas: canvasRef.current, alpha: true, antialias: true });
      renderer.setSize(window.innerWidth, window.innerHeight);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
      const geometry = new THREE.IcosahedronGeometry(2, 1);
      const material = new THREE.MeshBasicMaterial({ color: 0xE62127, wireframe: true, transparent: true, opacity: 0.1 });
      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.x = 1.5;
      scene.add(mesh);
      camera.position.z = 5;
      const handleResize = () => {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
      };
      window.addEventListener('resize', handleResize);
      let isVisible = true;
      const observer = new IntersectionObserver(([entry]) => { isVisible = entry.isIntersecting; }, { threshold: 0.1 });
      observer.observe(canvasRef.current);
      const tickerListener = () => {
        if (!isVisible) return;
        mesh.rotation.x += 0.001; mesh.rotation.y += 0.002;
        renderer.render(scene, camera);
      };
      gsap.ticker.add(tickerListener);
      cleanupThree = () => {
        window.removeEventListener('resize', handleResize);
        observer.disconnect();
        gsap.ticker.remove(tickerListener);
        geometry.dispose(); material.dispose(); renderer.dispose();
      };
    }

    // 2. Data Fetching
    Promise.all([api.getMatches(), api.getTopScorers()])
      .then(([matchesData, scorersData]) => {
        setMatches(matchesData);
        setTopScorers(scorersData.slice(0, 3));
        setLoading(false);
        setTimeout(() => ScrollTrigger.refresh(), 100);
      }).catch(() => setLoading(false));

    // 3. GSAP Global Animations
    if (typeof window !== 'undefined') {
      gsap.timeline()
        .from(".hero-title", { opacity: 0, scale: 0.9, duration: 1.5, ease: "power4.out" }, 0.1)
        .from(".hero-sub", { opacity: 0, y: 30, duration: 1, ease: "power4.out" }, 0.5)
        .from(".hero-btns", { opacity: 0, y: 30, duration: 1, ease: "power4.out" }, 0.7);
      
      gsap.utils.toArray(".stat-count").forEach((stat: any) => {
        const target = parseInt(stat.dataset.target || '0');
        ScrollTrigger.create({
          trigger: "#stats",
          start: "top 80%",
          onEnter: () => {
            gsap.to(stat, {
              innerText: target, duration: 2, ease: "power2.out", snap: { innerText: 1 },
              onUpdate: function(this: any) {
                stat.innerText = Math.floor(this.targets()[0].innerText).toLocaleString();
              }
            });
          }
        });
      });
    }

    return () => { cleanupThree(); ScrollTrigger.getAll().forEach(t => t.kill()); };
  }, []);

  return (
    <div className="bg-background selection:bg-primary-container selection:text-white overflow-x-hidden">
      <Navbar />
      <main className="pt-[72px] pb-20">
        <HeroSection canvasRef={canvasRef} />
        <StatsSection />
        <MatchesSection matches={matches} loading={loading} />
        <PrizePoolSection />
        <LeadersSection topScorers={topScorers} />
        <RoadmapSection />
      </main>
      <Footer />
    </div>
  );
}
