/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Search, User, Compass, HelpCircle, ArrowRight, Flag, Calendar } from 'lucide-react';
import { RaceState, Rider, Heat, GateAssignment } from '../types';

interface RiderSearchProps {
  raceState: RaceState;
  onSelectHeat: (heatId: string) => void;
}

export default function RiderSearch({ raceState, onSelectHeat }: RiderSearchProps) {
  const { riders, heats } = raceState;
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [selectedRider, setSelectedRider] = useState<Rider | null>(null);

  if (riders.length === 0) {
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-8 py-10 text-center space-y-4 max-w-2xl mx-auto shadow-2xl" id="empty-riders-view">
        <Search className="h-10 w-10 text-emerald-400 mx-auto animate-pulse" />
        <h3 className="text-base font-bold text-slate-100 font-sans uppercase tracking-wider">Busca de Pilotos</h3>
        <p className="text-xs text-slate-350 leading-relaxed font-sans max-w-md mx-auto">
          Nenhum piloto cadastrado no sistema atualmente. Os inscritos e resultados aparecerão assim que a transmissão do sistema BEM for recebida com sucesso.
        </p>
      </div>
    );
  }

  // Search filter
  const searchResults = searchTerm.trim() === '' 
    ? [] 
    : riders.filter(r => 
        r.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
        r.plate.includes(searchTerm)
      ).slice(0, 5);

  // Find all heats for the selected rider
  const getRiderHeats = (riderId: string) => {
    const list: { heat: Heat; assignment: GateAssignment }[] = [];
    for (const heat of heats) {
      const match = heat.gateAssignments.find(a => a.riderId === riderId);
      if (match) {
        list.push({ heat, assignment: match });
      }
    }
    // Sort chronologically (MOTO_1 -> MOTO_2 -> MOTO_3 -> SEMI -> FINAL)
    const weight = (r: string) => {
      if (r === 'MOTO_1') return 1;
      if (r === 'MOTO_2') return 2;
      if (r === 'MOTO_3') return 3;
      if (r === 'SEMI') return 4;
      return 5;
    };
    return list.sort((a, b) => weight(a.heat.round) - weight(b.heat.round));
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

  const riderHeatsList = selectedRider ? getRiderHeats(selectedRider.id) : [];

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-xl space-y-6" id="rider-search-root">
      
      <div className="border-b border-slate-800 pb-4">
        <h2 className="text-lg font-extrabold text-slate-100 font-sans">Busca de Piloto • Gaiolas e Horários</h2>
        <p className="text-xs text-slate-400 font-mono">Consulte em qual raia (gate) você vai largar nas baterias de classificação e finais.</p>
      </div>

      {/* Search Input bar */}
      <div className="max-w-xl relative">
        <label className="text-xs font-bold text-slate-400 font-sans block mb-2">Digite o Nome ou Número da Placa:</label>
        <div className="relative">
          <Search className="absolute left-3.5 top-3 h-4 w-4 text-slate-500" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              // Clear selection if input changes substantially
              if (selectedRider && !e.target.value.includes(selectedRider.name.substring(0, 3))) {
                setSelectedRider(null);
              }
            }}
            placeholder="Ex: Rezende, Bruno ou Placa '22'..."
            className="w-full bg-slate-950 border border-slate-800 text-slate-200 placeholder-slate-500 rounded-lg px-4 pl-10 py-2.5 focus:outline-none focus:border-sky-500 text-sm font-mono"
            id="rider-search-input"
          />
        </div>

        {/* Search Suggestion popover */}
        {searchResults.length > 0 && !selectedRider && (
          <div className="absolute z-10 w-full mt-2 bg-slate-950 border border-slate-800 rounded-lg shadow-2xl overflow-hidden divide-y divide-slate-900">
            {searchResults.map((r) => (
              <button
                key={r.id}
                onClick={() => {
                  setSelectedRider(r);
                  setSearchTerm(r.name);
                }}
                className="w-full text-left px-4 py-3 hover:bg-slate-900 transition flex items-center justify-between"
              >
                <div>
                  <span className="text-sm font-bold text-slate-200 block">{r.name}</span>
                  <span className="text-[10px] text-slate-500 font-mono">{r.category} • {r.club}</span>
                </div>
                <div className="flex items-center space-x-2 font-mono">
                  <span className="text-xs text-yellow-400 font-bold">Placa #{r.plate}</span>
                  <ArrowRight className="h-3 w-3 text-slate-500" />
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Selected Rider Details Panel */}
      {selectedRider ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-2">
          
          {/* Rider Profile Card */}
          <div className="bg-slate-950 p-6 rounded-xl border border-slate-850 flex flex-col justify-between space-y-4">
            <div className="space-y-3">
              <div className="flex items-center space-x-3.5">
                <div className="w-12 h-12 rounded-full bg-sky-950 border border-sky-850 flex items-center justify-center text-sky-400 font-bold shadow-lg shadow-black">
                  <User className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-slate-100">{selectedRider.name}</h3>
                  <p className="text-[10px] text-slate-400 font-mono tracking-tight">{selectedRider.club}</p>
                </div>
              </div>

              <div className="border-t border-slate-900 pt-3 space-y-2 text-xs font-mono">
                <div className="flex justify-between">
                  <span className="text-slate-500">Categoria:</span>
                  <span className="text-slate-300 font-bold">{selectedRider.category}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Nº Placa Oficial:</span>
                  <span className="text-yellow-500 font-black">#{selectedRider.plate}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Rank no Evento:</span>
                  <span className="text-slate-300 font-bold">{selectedRider.rank}º Lugar</span>
                </div>
              </div>
            </div>

            <div className="bg-slate-900 border border-slate-850/50 p-3 rounded-lg text-center">
              <span className="text-[10px] text-slate-400 block font-mono">ACUMULADO DAS MOTOS</span>
              <span className="text-xl font-black text-sky-400 font-mono block">{selectedRider.totalPoints} pts</span>
              <span className="text-[9px] text-slate-500 block leading-tight mt-0.5">*(menor é melhor)*</span>
            </div>
          </div>

          {/* Rider Gate Assignments Schedule */}
          <div className="md:col-span-2 bg-slate-950 p-5 rounded-xl border border-slate-850 space-y-4">
            <h3 className="text-sm font-extrabold text-slate-200 font-sans border-b border-slate-900 pb-2">
              Agenda e Portões (Gaiolas de Largada)
            </h3>

            <div className="space-y-3.5">
              {riderHeatsList.length > 0 ? (
                riderHeatsList.map(({ heat, assignment }) => {
                  const hasFinished = heat.status === 'FINISHED';
                  return (
                    <div 
                      key={heat.id}
                      className="bg-slate-900/60 p-3.5 rounded-lg border border-slate-900 hover:border-slate-800 transition flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
                    >
                      <div>
                        <div className="flex items-center space-x-2">
                          <span className="text-[10px] text-sky-400 font-mono font-bold tracking-widest uppercase">
                            {getCleanRoundName(heat.round)}
                          </span>
                          <span className="text-slate-500">•</span>
                          <span className="text-xs text-slate-300 font-bold">Bateria #{heat.heatNumber}</span>
                        </div>
                        <div className="flex items-center space-x-1 mt-1 text-xs text-slate-400 font-mono">
                          <Flag className="h-3 w-3 text-slate-500" />
                          <span>Largará na <strong className="text-white font-bold font-mono">Raia {assignment.gate}</strong></span>
                        </div>
                      </div>

                      {/* Display performance metric */}
                      <div className="flex items-center space-x-3.5">
                        <div className="text-right font-mono">
                          {hasFinished ? (
                            <>
                              <span className="text-[10px] text-slate-500 block">Tempo: <strong className="text-slate-300 font-semibold">{assignment.time || 'N/A'}</strong></span>
                              <span className="text-xs text-emerald-400 font-bold block">{assignment.finishPosition}º Colocado</span>
                            </>
                          ) : (
                            <span className="text-xs text-yellow-500 font-semibold animate-pulse block">Confirmado no Portão</span>
                          )}
                        </div>

                        <button
                          onClick={() => onSelectHeat(heat.id)}
                          className="bg-slate-950 hover:bg-slate-900 text-[10px] font-bold text-slate-300 border border-slate-800 px-2.5 py-1.5 rounded"
                        >
                          Ver Pista
                        </button>
                      </div>
                    </div>
                  );
                })
              ) : (
                <p className="text-xs text-slate-500 italic">Nenhum evento agendado para o competidor atual.</p>
              )}
            </div>
          </div>

        </div>
      ) : (
        <div className="text-center py-10 bg-slate-950/20 border border-slate-950 rounded-xl max-w-xl">
          <HelpCircle className="h-8 w-8 text-slate-600 mb-2 mx-auto" />
          <h4 className="text-sm font-bold text-slate-400">Nenhum piloto ativo carregado</h4>
          <p className="text-xs text-slate-500 mt-1">Insira uma busca válida acima para detalhar o grid de corrida individual.</p>
        </div>
      )}

    </div>
  );
}
