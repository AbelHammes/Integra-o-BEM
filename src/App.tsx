/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { 
  Tv2, 
  ChevronRight, 
  Radio, 
  Users, 
  Search, 
  Terminal, 
  Zap, 
  HelpCircle, 
  FileText,
  Activity,
  UserCheck
} from 'lucide-react';
import { RaceState } from './types';
import LiveTracker from './components/LiveTracker';
import CategoriesList from './components/CategoriesList';
import RiderSearch from './components/RiderSearch';
import AdminPanel from './components/AdminPanel';

export default function App() {
  const [raceState, setRaceState] = useState<RaceState | null>(null);
  const [activeTab, setActiveTab] = useState<'LIVE' | 'STANDINGS' | 'RIDERS' | 'INTEGRATION'>('LIVE');
  const [isAdminMode, setIsAdminMode] = useState<boolean>(false); // Default to false so public spectators see a clean, professional read-only view. Operators can toggle this with the button.
  const [isPollLoading, setIsPollLoading] = useState<boolean>(false);
  const [selectedHeatId, setSelectedHeatId] = useState<string | null>(null);

  // Core API poll function
  const fetchRaceState = async (silent = false) => {
    if (!silent) setIsPollLoading(true);
    try {
      const res = await fetch('/api/race/state');
      if (res.ok) {
        const data = (await res.json()) as RaceState;
        setRaceState(data);
        
        // Auto-select active live heat if none is selected
        if (!selectedHeatId && data.live.activeHeatId) {
          setSelectedHeatId(data.live.activeHeatId);
        }
      }
    } catch (err) {
      console.error("Failed to sync live results from backend:", err);
    } finally {
      setIsPollLoading(false);
    }
  };

  // Sync state on mount and run live poll every 3 seconds for immediate reflex
  useEffect(() => {
    fetchRaceState();
    const interval = setInterval(() => {
      fetchRaceState(true);
    }, 3050);
    return () => clearInterval(interval);
  }, [selectedHeatId]);

  const handleSelectHeat = (heatId: string) => {
    setSelectedHeatId(heatId);
    setActiveTab('LIVE');
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between" id="app-viewport">
      
      {/* 🇧🇷 🏁 Branded Brazilian BMX Championship Top Header Banner */}
      <header className="bg-gradient-to-r from-[#01804E] via-[#00525F] to-[#003366] sticky top-0 z-40 shadow-xl border-b-[4px] border-[#FEDD00]">
        
        {/* Main Banner Body */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5 flex flex-col items-center">
          
          {/* Main Title Styled Just Like the Image Banner */}
          <h1 className="text-white font-sans font-black italic text-xl sm:text-2xl md:text-3xl lg:text-4xl tracking-wider text-center select-none drop-shadow-md">
            CAMPEONATO BRASILEIRO DE BMX - 2026
          </h1>

          {/* Action Row - Inspired directly by the image's inputs and controls */}
          <div className="flex flex-wrap items-center justify-center gap-3 mt-4 w-full max-w-2xl">
            
            {/* ID DO EVENTO input mockup */}
            <div className="flex items-center bg-white rounded shadow-sm border border-slate-300 h-8 px-2">
              <span className="text-[9px] text-slate-500 font-bold font-sans tracking-wide uppercase mr-1.5 select-none">
                ID DO EVENTO:
              </span>
              <input
                type="text"
                readOnly
                value="BR-2026-LIVE"
                className="bg-transparent text-slate-900 border-none font-mono text-[11px] font-black w-24 focus:outline-none"
              />
            </div>

            {/* ONLINE ⚡ status button */}
            <button className="bg-[#E31C1A] hover:bg-[#C21513] text-white text-[10px] font-black px-3.5 h-8 rounded flex items-center space-x-1 uppercase transition shadow border border-red-700 select-none">
              <span className="h-2 w-2 rounded-full bg-white inline-block animate-pulse mr-1"></span>
              <span>ONLINE ⚡</span>
            </button>

            {/* BACKUP button */}
            <button className="bg-[#2435A9] hover:bg-[#1D2B91] text-white text-[10px] font-black px-3.5 h-8 rounded flex items-center space-x-1.5 uppercase transition shadow border border-blue-950 select-none">
              <span>💾 BACKUP</span>
            </button>

            {/* RESTAURAR button */}
            <button className="bg-[#2435A9] hover:bg-[#1D2B91] text-white text-[10px] font-black px-3.5 h-8 rounded flex items-center space-x-1.5 uppercase transition shadow border border-blue-950 select-none">
              <span>📂 RESTAURAR</span>
            </button>
          </div>

        </div>

        {/* 📋 Submenu of Tabs - Inspired directly by the gray navigation row below the yellow line */}
        <div className="bg-[#1A2331] border-t border-[#fedd00]/10 w-full">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex overflow-x-auto justify-start sm:justify-center py-1 gap-1 sm:gap-4 scrollbar-thin">
              
              <button
                onClick={() => setActiveTab('INTEGRATION')}
                className={`py-3 px-3.5 font-sans text-[11px] sm:text-xs font-black tracking-wider uppercase transition-all whitespace-nowrap flex items-center ${
                  activeTab === 'INTEGRATION'
                    ? 'text-[#FEDD00] border-b-[3px] border-[#FEDD00] font-extrabold'
                    : 'text-white hover:text-yellow-100 border-b-[3px] border-transparent'
                }`}
              >
                <span>1. CONFIG BEM</span>
              </button>

              <button
                onClick={() => setActiveTab('RIDERS')}
                className={`py-3 px-3.5 font-sans text-[11px] sm:text-xs font-black tracking-wider uppercase transition-all whitespace-nowrap flex items-center ${
                  activeTab === 'RIDERS'
                    ? 'text-[#FEDD00] border-b-[3px] border-[#FEDD00] font-extrabold'
                    : 'text-white hover:text-yellow-100 border-b-[3px] border-transparent'
                }`}
              >
                <span>2. BUSCA DE PILOTOS</span>
              </button>

              <button
                onClick={() => setActiveTab('STANDINGS')}
                className={`py-3 px-3.5 font-sans text-[11px] sm:text-xs font-black tracking-wider uppercase transition-all whitespace-nowrap flex items-center ${
                  activeTab === 'STANDINGS'
                    ? 'text-[#FEDD00] border-b-[3px] border-[#FEDD00] font-extrabold'
                    : 'text-white hover:text-yellow-100 border-b-[3px] border-transparent'
                }`}
              >
                <span>3. CLASSIFICAÇÃO</span>
              </button>

              <button
                onClick={() => setActiveTab('LIVE')}
                className={`py-3 px-3.5 font-sans text-[11px] sm:text-xs font-black tracking-wider uppercase transition-all whitespace-nowrap flex items-center ${
                  activeTab === 'LIVE'
                    ? 'text-[#FEDD00] border-b-[3px] border-[#FEDD00] font-extrabold'
                    : 'text-white hover:text-yellow-100 border-b-[3px] border-transparent'
                }`}
              >
                <span>4. RESULTADOS AO VIVO</span>
              </button>

            </div>
          </div>
        </div>

      </header>

      {/* Operator control floating bar or configuration badge */}
      <div className="max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 mt-4 flex items-center justify-between">
        <span className="text-[10px] text-slate-400 font-mono bg-slate-900 px-2.5 py-1 rounded border border-slate-800">
          OPERANDO VIA SISTEMA BEM DE BICICROSS
        </span>
        <div className="flex items-center space-x-2 bg-slate-900 px-3 py-1.5 rounded-lg border border-slate-800 pointer-events-auto">
          <span className="text-[10px] text-slate-400 font-bold font-sans">Modo Operador / Lançamento</span>
          <button
            onClick={() => setIsAdminMode(prev => !prev)}
            className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none ${
              isAdminMode ? 'bg-[#01804E]' : 'bg-slate-800'
            }`}
          >
            <span
              className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                isAdminMode ? 'translate-x-4.5' : 'translate-x-1'
              }`}
            />
          </button>
        </div>
      </div>

      {/* 🚀 Main Core viewport mapping */}
      <main className="flex-grow max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-4 space-y-6">
        
        {raceState && (
          <div className="bg-[#031d10]/40 p-4 rounded-xl border border-emerald-900/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs md:text-sm shadow-inner">
            <div className="flex items-center space-x-2.5 font-sans">
              <Activity className="h-5 w-5 text-emerald-400 animate-pulse" />
              <div>
                <span className="font-extrabold text-white block font-sans">{raceState.eventName}</span>
                <span className="text-[10px] text-slate-400 font-mono block mt-0.5">{raceState.location} • {raceState.date}</span>
              </div>
            </div>

            <div className="flex items-center space-x-2 text-[10px] text-slate-400 font-mono self-end sm:self-auto uppercase">
              <span className={`w-2 h-2 rounded-full inline-block ${isPollLoading ? 'bg-amber-400 animate-spin border-t-2 border-transparent' : 'bg-emerald-505 animate-pulse'}`} />
              <span className="text-emerald-400 font-bold">Transmissor Online</span>
            </div>
          </div>
        )}

        {/* Loading fallback state */}
        {!raceState ? (
          <div className="text-center py-24 bg-slate-900 border border-slate-800 rounded-xl space-y-3 shadow-2xl flex flex-col items-center justify-center">
            <div className="h-10 w-10 border-t-4 border-l-4 border-emerald-500 rounded-full animate-spin"></div>
            <p className="text-slate-300 font-mono text-sm">Aguardando feed de transmissão do SISTEMA BEM de BMX...</p>
          </div>
        ) : (
          <div className="space-y-6">
            
            {activeTab === 'LIVE' && (
              <LiveTracker 
                raceState={raceState} 
                onRefresh={() => fetchRaceState(true)}
                isAdminMode={isAdminMode}
              />
            )}

            {activeTab === 'STANDINGS' && (
              <CategoriesList 
                raceState={raceState}
                onSelectHeat={handleSelectHeat}
                selectedHeatId={selectedHeatId}
              />
            )}

            {activeTab === 'RIDERS' && (
              <RiderSearch 
                raceState={raceState}
                onSelectHeat={handleSelectHeat}
              />
            )}

            {activeTab === 'INTEGRATION' && (
              <AdminPanel 
                raceState={raceState}
                onRefresh={() => fetchRaceState(true)}
                selectedHeatId={selectedHeatId}
                onSelectHeat={handleSelectHeat}
              />
            )}

          </div>
        )}
      </main>

      {/* 🇧🇷 Elegant Footer featuring 'Created by Abel Hammes' as requested */}
      <footer className="bg-slate-950 border-t border-slate-900 py-8 text-center text-xs text-slate-500 font-sans mt-auto">
        <div className="max-w-7xl mx-auto px-4 flex flex-col md:flex-row items-center justify-between gap-4 font-mono">
          <div className="text-left space-y-1">
            <span className="block text-slate-400 font-bold">GP Bicicross Brasil • Sistema BEM 🇧🇷</span>
            <span className="text-slate-600 block text-[10px]">© 2026. Todos os direitos reservados.</span>
          </div>
          
          {/* Creator Credit Badge */}
          <div className="bg-[#031d10] border border-emerald-900/40 rounded-xl px-5 py-2.5 flex items-center space-x-2.5 shadow-md">
            <span className="flex h-2 w-2 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-yellow-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-yellow-500"></span>
            </span>
            <span className="text-slate-300 font-sans text-xs">
              Created by <strong className="text-[#fedd00] font-bold font-mono tracking-wide">Abel Hammes</strong>
            </span>
          </div>

          <div className="flex items-center space-x-2 text-right">
            <UserCheck className="h-4 w-4 text-slate-500" />
            <span className="text-slate-400">Transmissão oficial do regulamento brasileiro de BMX.</span>
          </div>
        </div>
      </footer>

    </div>
  );
}
