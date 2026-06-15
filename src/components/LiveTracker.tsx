/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Play, 
  Flag, 
  Timer, 
  Zap, 
  Clock, 
  RotateCcw, 
  CheckCircle, 
  Award, 
  AlertCircle,
  TrendingUp,
  CircleAlert
} from 'lucide-react';
import { RaceState, Heat, Rider } from '../types';

interface LiveTrackerProps {
  raceState: RaceState;
  onRefresh: () => void;
  isAdminMode: boolean;
}

export default function LiveTracker({ raceState, onRefresh, isAdminMode }: LiveTrackerProps) {
  const { live, heats, riders } = raceState;
  
  // Find current heat
  const activeHeat = heats.find(h => h.id === live.activeHeatId);

  // Simulation parameters
  const [racingProgress, setRacingProgress] = useState<Record<string, number>>({});
  const [elapsedTime, setElapsedTime] = useState<number>(0);
  const [timerInterval, setTimerInterval] = useState<NodeJS.Timeout | null>(null);
  const timerRef = useRef<number>(0);

  // Status mapping
  const activeStatus = live.status; // 'STANDBY' | 'GATE_READY' | 'ON_TRACK' | 'FINISHED'

  // Reset racing metrics if active heat changes
  useEffect(() => {
    setRacingProgress({});
    setElapsedTime(0);
    if (timerInterval) {
      clearInterval(timerInterval);
      setTimerInterval(null);
    }
  }, [live.activeHeatId]);

  // Run a client-side race simulation
  const simulateLiveRace = async () => {
    if (!activeHeat) return;

    // 1. Move gate state to READY
    await fetch('/api/race/update-live', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'GATE_READY' })
    });
    onRefresh();

    // Small delay before gate drops
    setTimeout(async () => {
      // 2. Drop gate -> ON_TRACK
      await fetch('/api/race/update-live', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          status: 'ON_TRACK',
          gateDroppedAt: new Date().toISOString()
        })
      });
      onRefresh();

      // Start active timer
      timerRef.current = 0;
      setElapsedTime(0);
      const progress: Record<string, number> = {};
      activeHeat.gateAssignments.forEach(a => {
        progress[a.riderId] = 0;
      });
      setRacingProgress(progress);

      const interval = setInterval(() => {
        timerRef.current += 100;
        setElapsedTime(timerRef.current / 1000);

        // Advance riders randomly
        let allFinished = true;
        setRacingProgress(prev => {
          const next = { ...prev };
          activeHeat.gateAssignments.forEach(a => {
            if (next[a.riderId] < 100) {
              // Random speed burst
              const inc = Math.random() * 8 + 4;
              next[a.riderId] = Math.min(100, next[a.riderId] + inc);
              allFinished = false;
            }
          });
          return next;
        });

        // Trigger finish order once all hit 100%
        if (Object.keys(progress).length > 0 && allFinished) {
          clearInterval(interval);
          setTimerInterval(null);
          submitSimulatedResults();
        }
      }, 100);

      setTimerInterval(interval);
    }, 2000);
  };

  const submitSimulatedResults = async () => {
    if (!activeHeat) return;

    // Create realistic finishing results
    // Faster riders randomly, with Renato and Bruno typically leading
    const times = activeHeat.gateAssignments.map(a => {
      let baseTime = 31.500;
      // Introduce minor variance (Renato (#1) and Bruno (#2) slightly faster)
      if (a.riderId === "em_1") baseTime = 31.400;
      if (a.riderId === "em_2") baseTime = 31.600;
      const finalVal = baseTime + Math.random() * 3.5;
      return {
        riderId: a.riderId,
        time: finalVal.toFixed(3) + 's',
        timeNum: finalVal
      };
    });

    // Sort by finish time
    times.sort((a, b) => a.timeNum - b.timeNum);

    const resultsPayload = times.map((t, index) => ({
      riderId: t.riderId,
      position: index + 1,
      time: t.time
    }));

    // Post final results back to the server
    const res = await fetch('/api/race/submit-live-results', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        heatId: activeHeat.id,
        winnerTime: times[0].time,
        results: resultsPayload
      })
    });
    if (res.ok) {
      onRefresh();
    }
  };

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

  const resetLiveTracker = async () => {
    await fetch('/api/race/update-live', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'STANDBY', activeHeatId: activeHeat?.id || null })
    });
    setRacingProgress({});
    setElapsedTime(0);
    onRefresh();
  };

  return (
    <div className="bg-slate-900 text-white rounded-xl shadow-2xl p-6 border border-slate-800" id="live-tracker-root">
      
      {/* ⚠️ Header section with Live badge */}
      <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-black pb-4 mb-6">
        <div className="flex items-center space-x-3 mb-2 md:mb-0">
          <div className="relative flex h-3 w-3">
            <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${activeStatus === 'ON_TRACK' ? 'bg-red-500' : 'bg-emerald-500'} opacity-75`}></span>
            <span className={`relative inline-flex rounded-full h-3 w-3 ${activeStatus === 'ON_TRACK' ? 'bg-red-600' : 'bg-emerald-600'}`}></span>
          </div>
          <div>
            <h1 className="text-xl font-bold font-sans tracking-tight">Ecrã de Corrida ao Vivo</h1>
            <p className="text-xs text-slate-400 font-mono">INTEGRAÇÃO SISTEMA BEM • REAL-TIME FEED</p>
          </div>
        </div>

        {/* Current status display */}
        <div className="flex items-center space-x-3">
          <div className="px-3 py-1 rounded bg-slate-800 text-slate-300 font-mono text-sm border border-slate-700">
            Status: <span className="font-bold text-yellow-400">{activeStatus}</span>
          </div>

          {isAdminMode && (
            <div className="flex space-x-2">
              {activeStatus === 'STANDBY' && (
                <button
                  onClick={simulateLiveRace}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs px-3 py-1.5 rounded transition flex items-center space-x-1 shadow-md shadow-emerald-950"
                  id="admin-start-sim-btn"
                >
                  <Play className="h-3 w-3" />
                  <span>Liberar Grid</span>
                </button>
              )}
              {activeStatus !== 'STANDBY' && (
                <button
                  onClick={resetLiveTracker}
                  className="bg-slate-700 hover:bg-slate-600 text-slate-200 font-semibold text-xs px-3 py-1.5 rounded transition flex items-center space-x-1 border border-slate-600"
                  id="admin-reset-sim-btn"
                >
                  <RotateCcw className="h-3 w-3" />
                  <span>Resetar</span>
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {activeHeat ? (
        <div className="space-y-6">
          {/* Active Heat Meta Info */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 bg-slate-950 p-4 rounded-lg border border-slate-800">
            <div>
              <span className="text-xs text-slate-400 block font-mono">CATEGORIA</span>
              <span className="font-semibold text-slate-200 block text-sm lg:text-base">{activeHeat.category}</span>
            </div>
            <div>
              <span className="text-xs text-slate-400 block font-mono">Fase da Competição</span>
              <span className="font-semibold text-sky-400 block text-sm lg:text-base">{getCleanRoundName(activeHeat.round)}</span>
            </div>
            <div>
              <span className="text-xs text-slate-400 block font-mono">BATERIA Nº</span>
              <span className="font-semibold text-slate-200 block text-sm lg:text-base">MOTO #{activeHeat.heatNumber}</span>
            </div>
            <div>
              <span className="text-xs text-slate-400 block font-mono">TEMPO DE CRONÔMETRO</span>
              <div className="flex items-center space-x-1.5">
                <Clock className="h-4 w-4 text-emerald-400" />
                <span className="font-semibold text-emerald-400 font-mono text-sm lg:text-base">
                  {elapsedTime > 0 ? `${elapsedTime.toFixed(2)}s` : activeHeat.status === 'FINISHED' ? activeHeat.winnerTime || '--' : '0.00s'}
                </span>
              </div>
            </div>
          </div>

          {/* 1. STANDBY - Waiting to summon of riders and starting grid */}
          {activeStatus === 'STANDBY' && (
            <div className="text-center py-12 px-6 bg-slate-950/40 rounded-xl border border-slate-800/60 flex flex-col items-center">
              <Timer className="h-12 w-12 text-slate-500 mb-3 animate-pulse" />
              <h3 className="text-lg font-bold text-slate-300">Aguardando Confirmação do Portão</h3>
              <p className="text-sm text-slate-400 max-w-lg mt-1">
                O operador do SISTEMA BEM de BMX na pista está prestes a alinhar os pilotos no portão de largada. Os tempos e raias serão alimentados de forma automática em tempo real.
              </p>
              {isAdminMode && (
                <button
                  onClick={simulateLiveRace}
                  className="mt-4 bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold px-4 py-2 rounded-lg transition"
                >
                  Acionar Simulação de Largada Automática
                </button>
              )}
            </div>
          )}

          {/* 2. GATE_READY - Pilots are positioned on the gates (gaiola), red lights are ON */}
          {activeStatus === 'GATE_READY' && (
            <div className="relative overflow-hidden bg-slate-950 p-6 rounded-xl border border-amber-900/30">
              <div className="absolute top-0 right-0 p-4">
                <div className="flex space-x-2">
                  <div className="h-4 w-4 rounded-full bg-red-600 shadow shadow-red-500 animate-pulse"></div>
                  <div className="h-4 w-4 rounded-full bg-red-600 shadow shadow-red-500 animate-pulse"></div>
                  <div className="h-4 w-4 rounded-full bg-slate-800"></div>
                </div>
              </div>
              <div className="mb-4">
                <span className="bg-amber-500/15 text-amber-400 text-xs px-2 py-0.5 rounded font-mono font-medium border border-amber-500/20 uppercase tracking-widest">
                  PILOTOS ALINHADOS
                </span>
                <h3 className="text-lg font-bold mt-2 text-slate-100">"PILOTOS PRONTOS... ATENÇÃO AO PORTÃO..."</h3>
                <p className="text-xs text-slate-400 font-mono">Sinal sonoro de 4 batidas (Random Gate Sequence) ativo no local.</p>
              </div>

              {/* Grid of 8 Gates */}
              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
                {Array.from({ length: 8 }).map((_, index) => {
                  const assignment = activeHeat.gateAssignments.find(a => a.gate === (index + 1));
                  return (
                    <div 
                      key={index} 
                      className={`border p-3 rounded-lg flex flex-col justify-between h-28 ${
                        assignment 
                          ? 'bg-slate-900/50 border-amber-500/30 shadow-sm shadow-amber-500/5' 
                          : 'bg-slate-950 border-slate-900 opacity-40'
                      }`}
                    >
                      <span className="text-xs text-slate-500 font-mono font-bold">RAIA {index+1}</span>
                      {assignment ? (
                        <>
                          <div className="my-1">
                            <span className="text-sm font-bold text-slate-200 line-clamp-1">{assignment.riderName.split(' ')[0]}</span>
                            <span className="text-slate-400 text-[10px] block truncate">{assignment.plate ? `#${assignment.plate}` : '-'}</span>
                          </div>
                          <span className="bg-amber-950 border border-amber-900/40 text-[10px] text-amber-400 text-center rounded py-0.5 uppercase font-medium">Ready</span>
                        </>
                      ) : (
                        <span className="text-[10px] text-slate-700 italic">Vazia</span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* 3. ON_TRACK - Racers are fully running. Shows visual telemetry tracking progress */}
          {activeStatus === 'ON_TRACK' && (
            <div className="bg-slate-950 p-6 rounded-xl border border-red-950/40 space-y-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <span className="flex h-2.5 w-2.5 relative">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500"></span>
                  </span>
                  <span className="text-red-400 text-xs font-bold font-mono tracking-widest uppercase">CORRIDA EM ANDAMENTO!</span>
                </div>
                <div className="flex items-center space-x-1 font-mono text-xs text-slate-400 bg-slate-900 px-2 py-1 rounded">
                  <Zap className="h-3 w-3 text-yellow-400" />
                  <span>Velocidade Média Estimada: 42 km/h</span>
                </div>
              </div>

              {/* Lane telemetry view */}
              <div className="space-y-3.5">
                {activeHeat.gateAssignments.map((assignment) => {
                  const progress = racingProgress[assignment.riderId] || 0;
                  return (
                    <div key={assignment.riderId} className="space-y-1">
                      <div className="flex justify-between text-xs font-mono">
                        <span className="text-slate-300 font-bold select-none">{assignment.finishPosition ? `${assignment.finishPosition}º` : ''} Raia {assignment.gate} • {assignment.riderName} <span className="text-slate-500">#{assignment.plate}</span></span>
                        <span className="text-slate-400 font-bold">{Math.round(progress)}%</span>
                      </div>
                      <div className="w-full bg-slate-900 rounded-full h-3 overflow-hidden p-0.5 border border-slate-800">
                        <motion.div 
                          className="bg-gradient-to-r from-red-600 via-orange-500 to-yellow-400 h-full rounded-full"
                          style={{ width: `${progress}%` }}
                          animate={{ width: `${progress}%` }}
                          transition={{ type: 'tween', ease: 'linear', duration: 0.1 }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Checkered flag finish graphics */}
              <div className="border-t border-slate-900 pt-3 flex justify-between items-center text-xs text-slate-500">
                <span className="flex items-center space-x-1"><Flag className="h-3 w-3 text-slate-500" /> <span>Portão</span></span>
                <span className="flex items-center space-x-1"><span>Curva 1</span></span>
                <span className="flex items-center space-x-1"><span>Pro-Section</span></span>
                <span className="flex items-center space-x-1"><span>Curva 3</span></span>
                <span className="flex items-center space-x-1 text-slate-400 font-bold"><Flag className="h-3.5 w-3.5 text-white" /> <span>Chegada</span></span>
              </div>
            </div>
          )}

          {/* 4. FINISHED (Live complete or finished state) */}
          {activeStatus === 'FINISHED' && (
            <div className="bg-slate-950 p-6 rounded-xl border border-emerald-950/40 space-y-5">
              <div className="flex items-center justify-between border-b border-slate-900 pb-3">
                <div className="flex items-center space-x-2">
                  <CheckCircle className="h-5 w-5 text-emerald-500" />
                  <div>
                    <h3 className="font-bold text-slate-100 font-sans">BATERIA FINALIZADA</h3>
                    <p className="text-[10px] text-slate-500 font-mono">FOTO-CÉLULA DO SISTEMA BEM VALIDADA</p>
                  </div>
                </div>

                <div className="bg-emerald-950/50 border border-emerald-900 px-3 py-1 rounded text-right">
                  <span className="text-[10px] text-slate-400 block font-mono">tempo do vencedor:</span>
                  <span className="text-emerald-400 font-bold font-mono text-sm">{activeHeat.winnerTime || live.finishResults?.[0]?.time || '--'}</span>
                </div>
              </div>

              {/* Rank results */}
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="text-slate-500 uppercase font-mono border-b border-slate-900">
                      <th className="py-2 px-3">Class.</th>
                      <th className="py-2">Placa</th>
                      <th className="py-2">Piloto</th>
                      <th className="py-2 hidden md:table-cell">Clube / Origem</th>
                      <th className="py-2">Raia</th>
                      <th className="py-2 text-right">Tempo Oficial</th>
                      <th className="py-2 text-right">Pontos</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activeHeat.gateAssignments
                      .slice()
                      .sort((a, b) => (a.finishPosition || 8) - (b.finishPosition || 8))
                      .map((assignment, idx) => {
                        const riderFull = riders.find(r => r.id === assignment.riderId);
                        const isPodium = idx < 3;
                        return (
                          <motion.tr 
                            key={assignment.riderId}
                            initial={{ opacity: 0, y: 5 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: idx * 0.05 }}
                            className="border-b border-slate-900 hover:bg-slate-900/40 text-slate-300 font-mono"
                          >
                            <td className="py-3 px-3 font-bold">
                              <div className="flex items-center space-x-1.5">
                                {isPodium ? (
                                  <span className={`w-5 h-5 rounded-full flex items-center justify-center font-bold text-[10px] ${
                                    idx === 0 ? 'bg-amber-500 text-black' : idx === 1 ? 'bg-slate-300 text-black' : 'bg-amber-700 text-white'
                                  }`}>
                                    {idx + 1}
                                  </span>
                                ) : (
                                  <span className="w-5 text-center text-slate-500 font-mono">{idx + 1}</span>
                                )}
                              </div>
                            </td>
                            <td className="py-3 font-bold text-yellow-500">#{assignment.plate}</td>
                            <td className="py-3 font-semibold text-slate-200">
                              {assignment.riderName}
                            </td>
                            <td className="py-3 hidden md:table-cell text-slate-400">{riderFull?.club || 'Piloto Importado'}</td>
                            <td className="py-3 text-slate-400">Raia {assignment.gate}</td>
                            <td className="py-3 text-right text-emerald-400 font-bold">{assignment.time || '--'}</td>
                            <td className="py-3 text-right font-bold text-slate-200">{assignment.motoPoints || assignment.finishPosition || '-'} pt</td>
                          </motion.tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

        </div>
      ) : (
        <div className="text-center py-12 px-6 bg-slate-950/40 rounded-xl border border-slate-800">
          <CircleAlert className="h-10 w-10 text-slate-600 mb-3 mx-auto" />
          <h3 className="text-lg font-bold text-slate-400">Nenhuma Bateria Ativa Selecionada</h3>
          <p className="text-sm text-slate-500 mt-1">
            Escolha uma bateria na lista abaixo ou configure uma nova corrida para alimentar o ecrã ao vivo do SISTEMA BEM.
          </p>
        </div>
      )}
    </div>
  );
}
