'use client'

import { useState, useRef } from 'react'
import { api } from '@/lib/api'
import * as XLSX from 'xlsx'

interface ParsedPlayer {
  name: string
  team: string
  is_captain: boolean
  owner_name?: string
}

export default function ImportTab() {
  const [previewData, setPreviewData] = useState<ParsedPlayer[]>([])
  const [status, setStatus] = useState('')
  const [dragActive, setDragActive] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileUpload = (file: File) => {
    setStatus(`Processing binary stream: ${file.name}...`)
    const reader = new FileReader()
    
    reader.onload = (e) => {
      try {
        const data = e.target?.result
        const workbook = XLSX.read(data, { type: 'binary' })
        
        // 1. Identify Sheets
        // User specifies Sheet 1 for Meta and Sheet 2 for Players
        // We'll use names if they exist, else indices
        const sheetNames = workbook.SheetNames
        const metaSheet = workbook.Sheets[sheetNames[0]] // Sheet 1: Team Names
        const purseSheet = workbook.Sheets['Purse'] || workbook.Sheets[sheetNames[2]] // Sheet 3: Purse
        
        if (!metaSheet || !purseSheet) {
          setStatus('ERROR: MISSING SHEETS. EXPECTED "Team Names" AND "Purse".')
          return
        }
        
        const metaRows = XLSX.utils.sheet_to_json(metaSheet, { header: 1 }) as any[][]
        const purseRows = XLSX.utils.sheet_to_json(purseSheet, { header: 1 }) as any[][]

        // 2. Build Legacy Metadata Map (Sheet 1)
        // This maps "TEAM NO.1" -> Owner Name
        const ownerMap = new Map<string, string>()
        metaRows.slice(1).forEach(row => {
          const teamLabel = String(row[1] || '').trim().toLowerCase() // e.g. "team no.1"
          const owner = String(row[2] || '').trim()
          if (teamLabel) ownerMap.set(teamLabel, owner)
        })

        const mappedData: ParsedPlayer[] = []
        
        // 3. Process Purse Grid (Sheet 3) - DYNAMIC SCANNING
        // Instead of hardcoded coordinates, we scan the whole sheet for "NM " headers.
        // This handles layout shifts and varying player counts perfectly.
        
        for (let r = 0; r < purseRows.length; r++) {
          const rowValues = purseRows[r] || []
          for (let c = 0; c < rowValues.length; c++) {
            const val = String(rowValues[c] || '').trim()
            
            // Check if this cell is a Team Franchise Header (e.g. "NM CARTEL")
            if (val.toUpperCase().startsWith('NM ') && val.length > 3) {
              const franchiseName = val
              
              // 3a. Search Nearby for "TEAM NO. X" to link the Owner
              let owner = ''
              const searchRadiusRows = 5
              const searchRadiusCols = 2
              
              outer: for (let or = Math.max(0, r - searchRadiusRows); or <= r; or++) {
                const searchRow = purseRows[or] || []
                for (let oc = Math.max(0, c - searchRadiusCols); oc <= c + searchRadiusCols; oc++) {
                  const label = String(searchRow[oc] || '').trim().toLowerCase()
                  if (label.includes('team no')) {
                    owner = ownerMap.get(label) || ''
                    break outer
                  }
                }
              }

              // 3b. Read Players below this header
              let emptyRowCount = 0
              for (let pr = r + 1; pr < r + 20; pr++) {
                let playerName = String(purseRows[pr]?.[c] || '').trim()
                
                // If we hit another team header, stop immediately
                if (playerName.toUpperCase().startsWith('NM ')) break

                // Stop if we hit 2 empty rows in a row (end of squad)
                if (!playerName || playerName === '0' || playerName === '0.0') {
                  emptyRowCount++
                  if (emptyRowCount >= 2) break
                  continue
                }
                emptyRowCount = 0 // Reset on data

                // SKIP NOISE: Ignore if the cell is just a number (e.g. price, count, or 'Amount')
                if (!isNaN(Number(playerName)) || playerName.toLowerCase().includes('amount') || playerName.toLowerCase().includes('purse')) {
                   continue
                }

                if (playerName === '-') continue

                let isCaptain = false
                if (playerName.toLowerCase().includes('(c)')) {
                  isCaptain = true
                  playerName = playerName.replace(/\(c\)/i, '').trim()
                }

                mappedData.push({
                  name: playerName,
                  team: franchiseName,
                  is_captain: isCaptain,
                  owner_name: owner
                })
              }
            }
          }
        }
        
        setPreviewData(mappedData)
        const teamsDetected = new Set(mappedData.map(p => p.team.toLowerCase())).size
        const captainsDetected = mappedData.filter(p => p.is_captain).length
        
        setStatus(`SUCCESS: Parsed ${mappedData.length} players across ${teamsDetected} teams. All headers starting with 'NM ' were scanned.`)
        
        if (teamsDetected < 5) {
           setStatus(prev => `${prev} WARNING: Only ${teamsDetected}/5 teams found. Check "NM " prefix in Excel.`)
        }

      } catch (err) {
        setStatus('ERROR: EXTRACTION FAILED')
        console.error(err)
      }
    }
    
    reader.readAsBinaryString(file)
  }

  const handleExecuteImport = async () => {
    if (previewData.length === 0) return
    
    setStatus('SYNCING DATABASE...')
    try {
      const result = await api.importAuctionResults(previewData)
      if (result.players_imported !== undefined) {
        setStatus(`SUCCESS: ${result.players_imported} PLAYERS IMPORTED. ${result.teams_created} NEW TEAMS CREATED.`)
        setPreviewData([])
      } else {
        setStatus('SYNC FAILED: ' + (result.errors?.join(', ') || 'SERVER ERROR'))
      }
    } catch (err) {
      setStatus('CRITICAL: BACKEND UNREACHABLE')
    }
  }

  const onDragToggle = (e: React.DragEvent) => {
    e.preventDefault()
    setDragActive(e.type === 'dragenter' || e.type === 'dragover')
  }

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragActive(false)
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileUpload(e.dataTransfer.files[0])
    }
  }

  const handleNuke = async () => {
    if (!window.confirm('⚠️ WARNING: This will PERMANENTLY DELETE all teams, players, matches, and events. This cannot be undone.')) return
    
    const confirmText = window.prompt('Type RESET to confirm absolute deletion:')
    if (confirmText !== 'RESET') {
      alert('Action cancelled.')
      return
    }

    try {
      setStatus('SIGNALING NUCLEAR RESET...')
      await api.nukeTournament()
      setStatus('SUCCESS: DATABANK PURGED. READY FOR CLEAN IMPORT.')
      setPreviewData([])
    } catch (err) {
      setStatus('ERROR: PURGE SEQUENCE FAILED.')
    }
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Upload Zone */}
      <div 
        onDragEnter={onDragToggle}
        onDragOver={onDragToggle}
        onDragLeave={onDragToggle}
        onDrop={onDrop}
        className={`relative bg-surface-container-high border-2 border-dashed transition-all p-12 flex flex-col items-center justify-center text-center ${
          dragActive ? 'border-primary-container bg-primary-container/5' : 'border-outline-variant/20'
        }`}
      >
        <input 
          ref={fileInputRef}
          type="file" 
          accept=".xlsx, .xls, .csv" 
          onChange={(e) => e.target.files?.[0] && handleFileUpload(e.target.files[0])}
          className="hidden"
        />
        
        <span className="material-symbols-outlined text-6xl text-primary-container mb-4 opacity-50">
          linked_services
        </span>
        
        <h3 className="font-headline font-black text-2xl uppercase italic tracking-tighter mb-2">
          MASTER DATA SYNC
        </h3>
        <p className="text-[10px] font-bold text-secondary uppercase tracking-[0.2em] mb-8 max-w-md">
          TARGET: SHEET 1 (TEAMS) + SHEET 2 (PLAYERS). <br/>
          COLUMNS: [B, C, D] ON SHEET 1 | [B, F] ON SHEET 2.
        </p>
        
        <button 
          onClick={() => fileInputRef.current?.click()}
          className="bg-on-surface text-background font-black px-8 py-3 uppercase tracking-widest text-[10px] active:scale-95 transition-all"
        >
          UPLOAD EXCEL SOURCE
        </button>
      </div>

      {/* Status Strip */}
      {status && (
        <div className={`bg-surface-container-low border-l-4 p-4 flex items-center gap-4 transition-all ${
          status.includes('SUCCESS') ? 'border-tertiary shadow-[0_0_20px_rgba(30,190,135,0.1)]' : 
          status.includes('SIGNALING') ? 'border-primary-container animate-pulse' :
          'border-primary-container'
        }`}>
           <span className={`w-2 h-2 rounded-full animate-pulse-live ${status.includes('SUCCESS') ? 'bg-tertiary' : 'bg-primary-container'}`}></span>
           <span className="text-[10px] font-black tracking-widest uppercase text-on-surface">{status}</span>
        </div>
      )}

      {/* Preview Table */}
      {previewData.length > 0 && (
        <div className="bg-surface-container-low border border-outline-variant/10 shadow-2xl animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="p-6 border-b border-outline-variant/10 flex justify-between items-center bg-surface-container-high">
             <h4 className="font-headline font-black text-xs tracking-widest uppercase">DATA SYNC PREVIEW</h4>
             <button 
               onClick={handleExecuteImport}
               className="bg-primary-container text-white font-black px-10 py-3 uppercase tracking-widest text-[10px] active:scale-95 transition-all"
             >
               EXECUTE DATABASE COMMIT
             </button>
          </div>
          
          <div className="max-h-[500px] overflow-y-auto">
            <table className="w-full text-left font-headline">
              <thead className="sticky top-0 bg-surface-container-lowest border-b border-outline-variant/10 z-10">
                <tr>
                  <th className="px-6 py-4 text-[9px] font-black tracking-[0.3em] uppercase opacity-50">#</th>
                  <th className="px-6 py-4 text-[9px] font-black tracking-[0.3em] uppercase">PLAYER</th>
                  <th className="px-6 py-4 text-[9px] font-black tracking-[0.3em] uppercase">TEAM</th>
                  <th className="px-6 py-4 text-[9px] font-black tracking-[0.3em] uppercase">OWNER</th>
                  <th className="px-6 py-4 text-[9px] font-black tracking-[0.3em] uppercase text-center">ROLE</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant/5">
                {previewData.map((player, i) => (
                  <tr key={i} className="hover:bg-white/[0.02] transition-colors">
                    <td className="px-6 py-3 text-[10px] font-bold text-secondary">{i + 1}</td>
                    <td className="px-6 py-3 text-[11px] font-black uppercase text-white">{player.name}</td>
                    <td className="px-6 py-3 text-[11px] font-bold uppercase text-tertiary">{player.team}</td>
                    <td className="px-6 py-3 text-[10px] font-bold uppercase text-secondary/60 italic">{player.owner_name || '---'}</td>
                    <td className="px-6 py-3 text-center">
                       {player.is_captain && (
                         <span className="bg-tertiary/20 text-tertiary text-[9px] font-black px-2 py-0.5 border border-tertiary/30">CAPTAIN</span>
                       )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* DANGER ZONE */}
      <div className="mt-20 pt-10 border-t border-primary-container/20">
         <div className="flex items-center gap-3 mb-6 opacity-40">
            <span className="material-symbols-outlined text-primary-container">warning</span>
            <span className="text-[10px] font-black tracking-[0.4em] text-primary-container uppercase">MAINTENANCE_DANGER_ZONE</span>
         </div>
         <div className="bg-primary-container/[0.03] border border-primary-container/20 p-8 flex flex-col md:flex-row items-center justify-between gap-8 group hover:bg-primary-container/[0.06] transition-all">
            <div className="flex-1">
               <h4 className="font-headline font-black text-xl uppercase italic text-primary-container mb-2">WIPE ENTIRE TOURNAMENT</h4>
               <p className="text-[10px] font-bold text-secondary uppercase tracking-widest leading-relaxed max-w-sm">
                  THIS WILL DELETE ALL TEAMS, PLAYERS, AND MATCH RECORDS. USE THIS ONLY TO RESET FOR THE MAIN EVENT OR TO FIX MAJOR DATA ERRORS.
               </p>
            </div>
            <button 
              onClick={handleNuke}
              className="bg-primary-container text-white font-black px-12 py-5 uppercase tracking-widest text-[11px] hover:bg-white hover:text-primary-container transition-all shadow-[0_0_30px_rgba(230,33,39,0.2)]"
            >
              NUCLEAR RESET
            </button>
         </div>
      </div>
    </div>
  )
}
