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
  UserCheck,
  ChevronDown,
  ChevronUp,
  Maximize2,
  Minimize2
} from 'lucide-react';
import { RaceState } from './types';
import LiveTracker from './components/LiveTracker';
import CategoriesList from './components/CategoriesList';
import RiderSearch from './components/RiderSearch';
import AdminPanel from './components/AdminPanel';

function CopyLinkButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button
      onClick={handleCopy}
      className={`text-[9px] font-extrabold px-2 py-1 rounded transition-all flex items-center space-x-1 uppercase ${
        copied ? 'bg-emerald-600 text-white border-emerald-500' : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700'
      }`}
    >
      {copied ? '✓ Copiado!' : 'Copiar Link'}
    </button>
  );
}

export default function App() {
  const [raceState, setRaceState] = useState<RaceState | null>(null);
  const [activeTab, setActiveTab] = useState<'LIVE' | 'STANDINGS' | 'RIDERS' | 'INTEGRATION'>('LIVE');
  const [isAdminMode, setIsAdminMode] = useState<boolean>(false); // Default to false so public spectators see a clean, professional read-only view. Operators can toggle this with the button.
  const [isPollLoading, setIsPollLoading] = useState<boolean>(false);
  const [selectedHeatId, setSelectedHeatId] = useState<string | null>(null);
  const [isMobileLiveTrackerCollapsed, setIsMobileLiveTrackerCollapsed] = useState<boolean>(true);
  const [showShareLinks, setShowShareLinks] = useState<boolean>(false);

  // Parse URL query parameters to check if loaded with "?admin=true" or "?admin=1" & install fetch key interceptor
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('admin') === 'true' || params.get('admin') === '1') {
      setIsAdminMode(true);
    }

    // Intercept fetch calls globally to inject x-api-key if available in localStorage
    const originalFetch = window.fetch;
    window.fetch = async function (input, init) {
      const key = localStorage.getItem('BEM_API_KEY') || '';
      if (key) {
        if (!init) {
          init = { headers: {} };
        } else if (!init.headers) {
          init.headers = {};
        }

        if (init.headers instanceof Headers) {
          init.headers.set('x-api-key', key);
        } else if (Array.isArray(init.headers)) {
          init.headers.push(['x-api-key', key]);
        } else {
          (init.headers as any)['x-api-key'] = key;
        }
      }
      return originalFetch(input, init);
    };

    return () => {
      window.fetch = originalFetch;
    };
  }, []);

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

  const activeHeat = raceState ? raceState.heats.find(h => h.id === raceState.live.activeHeatId) : null;
  const activeStatus = raceState ? raceState.live.status : 'STANDBY';

  const getCleanRoundName = (round: string) => {
    switch(round) {
      case 'MOTO_1': return 'Moto Clas. 1';
      case 'MOTO_2': return 'Moto Clas. 2';
      case 'MOTO_3': return 'Moto Clas. 3';
      case 'SEMI': return 'Semi-Final';
      case 'FINAL': return 'Grande Final';
      default: return round;
    }
  };

  const getStatusLabelTextAndColor = () => {
    switch (activeStatus) {
      case 'STANDBY':
        return { text: 'Aguardando Alinhamento', bg: 'bg-slate-800 text-slate-300 border-slate-700', dot: 'bg-slate-400' };
      case 'GATE_READY':
        return { text: 'Pilotos Alinhados', bg: 'bg-amber-955 text-amber-400 border-amber-800/40', dot: 'bg-amber-500 animate-pulse' };
      case 'ON_TRACK':
        return { text: 'Corrida Em Andamento!', bg: 'bg-red-955 text-red-400 border-red-800/40', dot: 'bg-red-500 animate-ping' };
      case 'FINISHED':
        return { text: 'Corrida Finalizada', bg: 'bg-emerald-955 text-emerald-400 border-emerald-800/40', dot: 'bg-emerald-500' };
      default:
        return { text: 'Standby', bg: 'bg-slate-800 text-slate-300 border-slate-705', dot: 'bg-slate-400' };
    }
  };

  const statusStyle = getStatusLabelTextAndColor();

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
      <div className="max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 mt-4 flex flex-col space-y-3">
        
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <span className="text-[10px] text-slate-400 font-mono bg-slate-900 px-2.5 py-1.5 rounded border border-slate-800 w-full sm:w-auto text-center sm:text-left">
            OPERANDO VIA SISTEMA BEM DE BICICROSS
          </span>
          <div className="flex flex-wrap items-center gap-2.5 w-full sm:w-auto justify-between sm:justify-end">
            
            {/* Share Links Toggle */}
            <button
              onClick={() => setShowShareLinks(prev => !prev)}
              className="px-3 py-1.5 bg-[#101F30] hover:bg-[#162A42] border border-slate-805 text-[10px] font-bold rounded-lg text-yellow-400 flex items-center space-x-1.5 transition select-none"
            >
              <span>🔗 Links de Acesso (TV / Operador)</span>
              <span className="text-[9px] bg-yellow-950 px-1.5 py-0.1 rounded font-mono text-yellow-300">Share</span>
            </button>

            <div className="flex items-center space-x-2 bg-slate-900 px-3 py-1.5 rounded-lg border border-slate-800">
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
        </div>

        {/* Share Links expandable Card */}
        {showShareLinks && (
          <div className="bg-slate-900 border-2 border-yellow-500/30 rounded-xl p-4 sm:p-5 shadow-2xl animate-in slide-in-from-top-2 duration-200">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2.5 mb-4">
              <div className="flex items-center space-x-2">
                <span className="h-2 w-2 rounded-full bg-yellow-450 animate-pulse"></span>
                <h4 className="text-xs font-black uppercase text-yellow-400 font-mono">Links Oficiais para Compartilhamento</h4>
              </div>
              <button 
                onClick={() => setShowShareLinks(false)}
                className="text-xs text-slate-400 hover:text-white px-2 py-0.5 rounded bg-slate-950 border border-slate-850"
              >
                Fechar
              </button>
            </div>

            <p className="text-[11px] text-slate-350 leading-relaxed max-w-3xl mb-4 font-sans">
              Copie os links abaixo para divulgar a transmissão. O link de espectador abre uma versão de leitura limpa e otimizada para celulares na arquibancada. O link de administrador abre as funções de lançamento e edição via BEM.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Spectator Link Card */}
              <div className="bg-slate-950 border border-slate-850 rounded-lg p-3 flex flex-col space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] bg-emerald-500/10 text-emerald-400 font-bold px-2 py-0.5 rounded font-mono uppercase tracking-wider">
                    Link Espectador (Apenas Visualização)
                  </span>
                  <CopyLinkButton text={window.location.origin + window.location.pathname} />
                </div>
                <div className="bg-slate-900/60 p-2 rounded text-[11px] font-mono select-all text-slate-305 truncate border border-slate-950">
                  {window.location.origin + window.location.pathname}
                </div>
                <div className="text-[9px] text-slate-500 italic">
                  Ideal para telões, público geral, atletas verem no celular.
                </div>
              </div>

              {/* Admin Link Card */}
              <div className="bg-slate-950 border border-slate-850 rounded-lg p-3 flex flex-col space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] bg-red-500/10 text-red-400 font-bold px-2 py-0.5 rounded font-mono uppercase tracking-wider">
                    Link do Administrador (Com Lançamento)
                  </span>
                  <CopyLinkButton text={window.location.origin + window.location.pathname + "?admin=true"} />
                </div>
                <div className="bg-slate-900/60 p-2 rounded text-[11px] font-mono select-all text-yellow-450 truncate border border-slate-950">
                  {window.location.origin + window.location.pathname + "?admin=true"}
                </div>
                <div className="text-[9px] text-amber-500/80 italic font-medium">
                  Controle total sobre cronometragem e importação de relatórios.
                </div>
              </div>
            </div>
          </div>
        )}

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
          <div className="space-y-6" id="dashboard-core">
            
            {activeTab === 'LIVE' ? (
              // If specicically on 'LIVE' tab, render fully expanded Live Tracker
              <LiveTracker 
                raceState={raceState} 
                onRefresh={() => fetchRaceState(true)}
                isAdminMode={isAdminMode}
              />
            ) : (
              // Otherwise, render our high-fidelity layout: Dual-column on desktop/tablet, stacked collapsible on mobile
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                
                {/* 1. Live Tracker Section (Left on desktop, Top on mobile) */}
                <div className="col-span-12 lg:col-span-7 xl:col-span-8 space-y-4">
                  
                  {/* Collapsible Mobile Ticker Header Bar - VISIBLE ONLY ON MOBILE (lg:hidden) */}
                  <div 
                    onClick={() => setIsMobileLiveTrackerCollapsed(prev => !prev)}
                    className="lg:hidden bg-slate-900 border border-slate-800 rounded-xl p-4 flex items-center justify-between cursor-pointer hover:bg-slate-850/60 transition-colors select-none shadow-md"
                  >
                    <div className="flex items-center space-x-3 min-w-0 pr-2">
                      <span className="flex h-2.5 w-2.5 relative flex-shrink-0">
                        <span className={`absolute inline-flex h-full w-full rounded-full ${statusStyle.dot} opacity-75`}></span>
                        <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${statusStyle.dot.replace(' animate-ping', '').replace(' animate-pulse', '')}`}></span>
                      </span>
                      <div className="min-w-0 text-left">
                        <div className="flex items-center space-x-2">
                          <span className="text-white text-xs font-black tracking-wide uppercase font-sans">Ecrã de Corrida ao Vivo</span>
                          <span className={`text-[8.5px] font-mono tracking-tight font-extrabold px-1.5 py-0.5 rounded capitalize ${statusStyle.bg}`}>
                            {statusStyle.text}
                          </span>
                        </div>
                        {activeHeat ? (
                          <p className="text-[10px] text-slate-400 mt-0.5 truncate font-mono">
                            {activeHeat.category} • Bateria #{activeHeat.heatNumber} • {getCleanRoundName(activeHeat.round)}
                          </p>
                        ) : (
                          <p className="text-[10px] text-slate-500 mt-0.5 font-mono">Pronto para início de bateria</p>
                        )}
                      </div>
                    </div>
                    
                    <div className="flex items-center space-x-2 flex-shrink-0">
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          setActiveTab('LIVE');
                        }}
                        className="text-[9px] font-black bg-[#E31C1A] text-white hover:bg-[#C21513] px-2.5 py-1.5 rounded uppercase transition-all tracking-wider font-mono mr-1 shadow-sm"
                      >
                        Ver TV
                      </button>
                      <div className="p-1 rounded bg-slate-950 border border-slate-800 text-slate-400">
                        {isMobileLiveTrackerCollapsed ? (
                          <ChevronDown className="h-3.5 w-3.5" />
                        ) : (
                          <ChevronUp className="h-3.5 w-3.5" />
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Desktop Title & Sync Alert overlay (Visible ONLY on desktop screen, and only when inside subtabs) */}
                  <div className="hidden lg:flex items-center justify-between bg-slate-900 border border-slate-800 px-4 py-2.5 rounded-xl text-xs font-mono">
                    <div className="flex items-center space-x-2.5">
                      <Radio className="h-4 w-4 text-emerald-400 animate-pulse" />
                      <span className="text-slate-200 font-bold uppercase tracking-wider">Centro de Monitoramento Ativo (BEM)</span>
                    </div>
                    <span className="text-[9px] text-emerald-400 font-bold bg-[#031d10]/60 border border-emerald-950 px-2 py-0.5 rounded">Sincronizado</span>
                  </div>

                  {/* The Live Tracker Content: 
                      - Always visible raw block on desktop (lg:block).
                      - Dynamically collapsed or expanded on mobile (controlled by isMobileLiveTrackerCollapsed) */}
                  <div className={isMobileLiveTrackerCollapsed ? 'hidden lg:block' : 'block animate-in fade-in duration-300'}>
                    <LiveTracker 
                      raceState={raceState} 
                      onRefresh={() => fetchRaceState(true)}
                      isAdminMode={isAdminMode}
                    />
                  </div>

                </div>

                {/* 2. Sub-tab Contents Panel (Right on desktop, Bottom on mobile) */}
                <div className="col-span-12 lg:col-span-5 xl:col-span-4 space-y-4">
                  
                  {/* Dynamic Tab Identifier Tag (Visible ONLY on desktop) */}
                  <div className="hidden lg:flex items-center justify-between bg-[#142131]/95 px-4 py-2.5 border border-slate-805 rounded-xl">
                    <span className="text-[10px] font-bold uppercase text-slate-300 font-sans tracking-wide">
                      {activeTab === 'STANDINGS' && '📋 Quadro de Resultados / Classificação'}
                      {activeTab === 'RIDERS' && '🔍 Pesquisa rápida de pilotos'}
                      {activeTab === 'INTEGRATION' && '⚙️ Console de Integração BEM'}
                    </span>
                    <span className="text-[8.5px] font-mono font-bold bg-[#01804E] text-white px-2 py-0.5 rounded uppercase">
                      Menu Ativo
                    </span>
                  </div>

                  <div>
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

                </div>

              </div>
            )}

          </div>
        )}
      </main>

      {/* 🇧🇷 Elegant Footer featuring 'Created by Abel Hammes' as requested */}
      <footer className="bg-slate-950 border-t border-slate-900 py-8 text-center text-xs text-slate-500 font-sans mt-auto">
        <div className="max-w-7xl mx-auto px-4 flex flex-col md:flex-row items-center justify-between gap-4 font-mono">
          <div className="text-left space-y-1">
            <span className="block text-slate-400 font-bold">Campeonato Brasileiro de BMX • Sistema BEM 🇧🇷</span>
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
