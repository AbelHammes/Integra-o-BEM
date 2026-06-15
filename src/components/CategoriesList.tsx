/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { motion } from 'motion/react';
import { 
  Users, 
  Award, 
  MapPin, 
  Flame, 
  ChevronRight, 
  Search, 
  Check, 
  ListOrdered,
  Layers,
  Sparkles,
  TrendingUp,
  Info
} from 'lucide-react';
import { 
  ResponsiveContainer, 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip as RechartsTooltip, 
  Legend 
} from 'recharts';
import { RaceState, Rider, Heat, RaceRound } from '../types';

interface CategoriesListProps {
  raceState: RaceState;
  onSelectHeat: (heatId: string) => void;
  selectedHeatId: string | null;
}

const CHART_COLORS = [
  '#38bdf8', // sky-400
  '#fbbf24', // amber-400
  '#34d399', // emerald-400
  '#c084fc', // purple-400
  '#f43f5e'  // rose-500
];

// Custom high-contrast tooltip for BMX points chart
const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-slate-950 border border-slate-800 p-3.5 rounded-lg shadow-2xl font-mono text-[11px] space-y-1.5 border-l-4 border-sky-500">
        <p className="text-slate-400 font-extrabold pb-1 border-b border-slate-900">{label}</p>
        <div className="space-y-1.5 font-mono">
          {payload.map((entry: any, index: number) => (
            <div key={index} className="flex justify-between items-center gap-6">
              <span style={{ color: entry.color }} className="font-bold">{entry.name}:</span>
              <span className="text-slate-200 font-black">{entry.value} pt</span>
            </div>
          ))}
        </div>
      </div>
    );
  }
  return null;
};

export default function CategoriesList({ raceState, onSelectHeat, selectedHeatId }: CategoriesListProps) {
  const { categories, riders, heats } = raceState;
  
  const [selectedCategory, setSelectedCategory] = useState<string>(categories[0] || 'Elite Men');
  const [activeTab, setActiveTab] = useState<'STANDINGS' | 'HEATS' | 'CHARTS'>('STANDINGS');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [chartMode, setChartMode] = useState<'CUMULATIVE' | 'INDIVIDUAL'>('CUMULATIVE');
  const [showChart, setShowChart] = useState<boolean>(true);

  // Filter riders by category and search query
  const filteredRiders = riders
    .filter(r => r.category === selectedCategory)
    .filter(r => r.name.toLowerCase().includes(searchQuery.toLowerCase()) || r.plate.includes(searchQuery))
    .sort((a, b) => a.rank - b.rank);

  // Filter heats by category
  const filteredHeats = heats.filter(h => h.category === selectedCategory);

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

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6" id="categories-list-root">
      
      {/* 📂 Left Sidebar: Category Selector */}
      <div className="lg:col-span-4 bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-xl space-y-4">
        <div className="flex items-center space-x-2 pb-3 border-b border-slate-800">
          <Layers className="h-5 w-5 text-[#01804E]" />
          <h2 className="text-base font-bold text-slate-100 font-sans">Menu de Categorias (BEM)</h2>
        </div>

        <div className="space-y-1.5 flex flex-col">
          {categories.map((cat) => {
            const count = riders.filter(r => r.category === cat).length;
            const isActive = selectedCategory === cat;
            return (
              <button
                key={cat}
                onClick={() => {
                  setSelectedCategory(cat);
                  setSearchQuery('');
                }}
                className={`w-full text-left px-4 py-3 rounded-lg flex items-center justify-between transition-all ${
                  isActive 
                    ? 'bg-[#01804E] font-bold text-white shadow-md shadow-emerald-950/40 border-l-4 border-[#FEDD00]' 
                    : 'bg-slate-950/65 text-slate-300 hover:bg-slate-800 border-l-4 border-transparent'
                }`}
              >
                <div className="flex items-center space-x-3">
                  <span className={`w-2 h-2 rounded-full ${isActive ? 'bg-[#FEDD00]' : 'bg-slate-500'}`} />
                  <span className="text-sm tracking-tight">{cat}</span>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full font-mono ${isActive ? 'bg-[#034423] text-emerald-200' : 'bg-slate-800 text-slate-400'}`}>
                  {count} Pilotos
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 📊 Main Content Area */}
      <div className="lg:col-span-8 bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-xl space-y-6">
        
        {/* Toggle selectors (Standings vs Heats vs Charts) */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-800 pb-4 gap-3">
          <div className="flex flex-wrap bg-slate-950 p-1.5 rounded-lg border border-slate-800 gap-1 sm:gap-0">
            <button
              onClick={() => setActiveTab('STANDINGS')}
              className={`px-3 py-2 rounded-md font-sans text-xs font-bold transition flex items-center space-x-1.5 ${
                activeTab === 'STANDINGS' 
                  ? 'bg-slate-900 text-white shadow shadow-black' 
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <ListOrdered className="h-4 w-4 text-emerald-400" />
              <span>Resultados Oficiais</span>
            </button>
            <button
              onClick={() => setActiveTab('HEATS')}
              className={`px-3 py-2 rounded-md font-sans text-xs font-bold transition flex items-center space-x-1.5 ${
                activeTab === 'HEATS' 
                  ? 'bg-slate-900 text-white shadow shadow-black' 
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Award className="h-4 w-4 text-sky-450" />
              <span>Baterias / Start Lists</span>
            </button>
            <button
              onClick={() => setActiveTab('CHARTS')}
              className={`px-3 py-2 rounded-md font-sans text-xs font-bold transition flex items-center space-x-1.5 ${
                activeTab === 'CHARTS' 
                  ? 'bg-slate-900 text-white shadow shadow-black' 
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <TrendingUp className="h-4 w-4 text-amber-400" />
              <span>Dashboard de Evolução</span>
            </button>
          </div>

          {/* Inline search bar */}
          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-500" />
            <input
              type="text"
              placeholder="Buscar piloto..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full sm:w-44 bg-slate-950/80 border border-slate-800 text-slate-300 placeholder-slate-500 text-xs px-3 pl-9 py-2 rounded-lg focus:outline-none focus:border-sky-500 font-mono"
            />
          </div>
        </div>

        {/* TAB 1: Clean Standings table based on BMX points */}
        {activeTab === 'STANDINGS' && (() => {
          return (
            <div className="space-y-4">
              <div className="bg-slate-950 border border-slate-800/80 p-3 rounded-lg flex items-center space-x-2.5">
                <span className="text-[9px] bg-emerald-500/10 text-emerald-400 uppercase font-mono font-bold border border-emerald-500/20 px-2 py-0.5 rounded">
                  REGULAMENTO MOTO INDIVIDUAL
                </span>
                <p className="text-[10px] text-slate-400 font-mono">
                  No Bicicross, a menor pontuação agregada (Moto 1 + Moto 2 + Moto 3) dita a classificação.
                </p>
              </div>

              <div className="overflow-x-auto rounded-lg border border-slate-950">
                <table className="w-full text-left text-xs font-mono">
                  <thead>
                    <tr className="bg-slate-950/70 text-slate-400 border-b border-slate-800 font-medium uppercase text-[10px]">
                      <th className="py-3 px-4">Ranque</th>
                      <th className="py-3">Placa</th>
                      <th className="py-3">Piloto</th>
                      <th className="py-3">Clube / Origem</th>
                      <th className="py-3 text-center">Moto 1</th>
                      <th className="py-3 text-center">Moto 2</th>
                      <th className="py-3 text-center">Moto 3</th>
                      <th className="py-3 text-right pr-4">Total Pts</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredRiders.length > 0 ? (
                      filteredRiders.map((rider, index) => {
                        const isPodium = index < 3;
                        return (
                           <tr 
                             key={rider.id}
                             className="border-b border-slate-950/45 hover:bg-slate-950/20 text-slate-300 transition-colors"
                           >
                             <td className="py-3.5 px-4 font-bold">
                               {isPodium ? (
                                 <span className={`inline-flex items-center justify-center w-5 h-5 rounded-full font-bold text-[10px] ${
                                   index === 0 ? 'bg-amber-500 text-black shadow shadow-amber-500/10' : 
                                   index === 1 ? 'bg-slate-450 text-black shadow shadow-slate-350/10' : 
                                   'bg-amber-700 text-white shadow shadow-amber-800/20'
                                 }`}>
                                   {index + 1}
                                 </span>
                               ) : (
                                 <span className="text-slate-500 pl-1.5">{index + 1}</span>
                               )}
                             </td>
                             <td className="py-3.5 font-bold text-yellow-500">#{rider.plate}</td>
                             <td className="py-3.5 font-bold text-slate-100">{rider.name}</td>
                             <td className="py-3.5 text-slate-450">{rider.club}</td>
                             <td className="py-3.5 text-center text-slate-400 font-semibold">{rider.points[0] ?? '-'} pt</td>
                             <td className="py-3.5 text-center text-slate-400 font-semibold">{rider.points[1] ?? '-'} pt</td>
                             <td className="py-3.5 text-center text-slate-400 font-semibold">{rider.points[2] ?? '-'} pt</td>
                             <td className="py-3.5 text-right font-black text-slate-100 pr-4">{rider.totalPoints} pt</td>
                           </tr>
                        );
                      })
                    ) : (
                      <tr>
                        <td colSpan={8} className="py-8 text-center text-slate-500 italic">
                          Nenhum piloto registrado para esta busca.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          );
        })()}

        {/* TAB 3: Isolated Dashboard containing Recharts Evolution Charts */}
        {activeTab === 'CHARTS' && (() => {
          const top5Riders = filteredRiders.slice(0, 5);
          
          const getPointsAtStage = (rider: Rider, stageIdx: number) => {
            const val = rider.points[stageIdx];
            return val !== null && val !== undefined ? val : 0;
          };

          const chartDataset = [
            {
              name: 'Moto Clas. 1',
              ...top5Riders.reduce((acc, r) => {
                const p1 = getPointsAtStage(r, 0);
                acc[r.name] = p1;
                return acc;
              }, {} as Record<string, number>)
            },
            {
              name: 'Moto Clas. 2',
              ...top5Riders.reduce((acc, r) => {
                const p1 = getPointsAtStage(r, 0);
                const p2 = getPointsAtStage(r, 1);
                acc[r.name] = chartMode === 'CUMULATIVE' ? (p1 + p2) : p2;
                return acc;
              }, {} as Record<string, number>)
            },
            {
              name: 'Moto Clas. 3',
              ...top5Riders.reduce((acc, r) => {
                const p1 = getPointsAtStage(r, 0);
                const p2 = getPointsAtStage(r, 1);
                const p3 = getPointsAtStage(r, 2);
                acc[r.name] = chartMode === 'CUMULATIVE' ? (p1 + p2 + p3) : p3;
                return acc;
              }, {} as Record<string, number>)
            }
          ];

          return (
            <div className="space-y-5">
              <div className="bg-slate-950 border border-slate-850 rounded-xl p-5 space-y-4 shadow-2xl">
                <div className="flex items-center justify-between border-b border-slate-900 pb-3">
                  <div className="flex items-center space-x-2">
                    <TrendingUp className="h-4 w-4 text-amber-400" />
                    <h3 className="text-xs font-extrabold text-slate-200 uppercase tracking-wider font-sans">
                      Evolução de Pontuação (Top 5 Pilotos) — {selectedCategory}
                    </h3>
                  </div>

                  <div className="flex items-center space-x-3">
                    {/* Mode selector */}
                    <div className="flex bg-slate-900 p-0.5 rounded border border-slate-800 text-[10px] font-mono">
                      <button
                        onClick={() => setChartMode('CUMULATIVE')}
                        className={`px-2 py-1 rounded transition font-bold ${
                          chartMode === 'CUMULATIVE' 
                            ? 'bg-sky-600 text-white' 
                            : 'text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        Acumulado
                      </button>
                      <button
                        onClick={() => setChartMode('INDIVIDUAL')}
                        className={`px-2 py-1 rounded transition font-bold ${
                          chartMode === 'INDIVIDUAL' 
                            ? 'bg-sky-600 text-white' 
                            : 'text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        Por Etapa
                      </button>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  {top5Riders.length > 0 ? (
                    <>
                      <div className="h-68 sm:h-76 w-full pr-4 text-xs font-mono">
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={chartDataset} margin={{ top: 8, right: 10, left: -25, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                            <XAxis 
                              dataKey="name" 
                              stroke="#64748b" 
                              fontSize={10} 
                              tickLine={false}
                            />
                            <YAxis 
                              stroke="#64748b" 
                              fontSize={10} 
                              tickLine={false}
                              domain={[0, 'auto']}
                              allowDecimals={false}
                            />
                            <RechartsTooltip content={<CustomTooltip />} />
                            <Legend 
                              iconType="circle" 
                              iconSize={8}
                              wrapperStyle={{ fontSize: 10, fontFamily: 'monospace', paddingTop: 10 }}
                            />
                            {top5Riders.map((rider, idx) => (
                              <Line
                                key={rider.id}
                                type="monotone"
                                dataKey={rider.name}
                                stroke={CHART_COLORS[idx % CHART_COLORS.length]}
                                strokeWidth={3}
                                activeDot={{ r: 6 }}
                                dot={{ r: 4, strokeWidth: 2 }}
                              />
                            ))}
                          </LineChart>
                        </ResponsiveContainer>
                      </div>

                      {/* Info block */}
                      <div className="bg-slate-900/60 p-3.5 rounded-lg border border-slate-900 flex items-start space-x-2.5">
                        <Info className="h-4 w-4 text-sky-400 mt-0.5 flex-shrink-0" />
                        <p className="text-[10px] text-slate-400 leading-normal font-sans">
                          <strong className="text-slate-300 font-semibold font-sans">🏁 Regulamento BMX de Pontuação:</strong> No Bicicross, os pontos equivalem à posição de chegada (1º colocado = 1 ponto, 2º colocado = 2 pontos). As **linhas mais baixas** no gráfico indicam melhor desempenho geral!
                        </p>
                      </div>
                    </>
                  ) : (
                    <p className="text-xs text-slate-500 italic text-center py-10">
                      Registre pilotos para exibir o gráfico de evolução de performance.
                    </p>
                  )}
                </div>
              </div>
            </div>
          );
        })()}

        {/* TAB 2: Heats list (Motos / Baterias) */}
        {activeTab === 'HEATS' && (
          <div className="space-y-6">
            {filteredHeats.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {filteredHeats.map((heat) => {
                  const isActiveLive = selectedHeatId === heat.id;
                  const isFinished = heat.status === 'FINISHED';
                  return (
                    <div 
                      key={heat.id} 
                      className={`border p-4 rounded-xl flex flex-col justify-between space-y-4 transition-all duration-350 shadow-md ${
                        isActiveLive 
                          ? 'bg-slate-950 border-sky-500 shadow-sky-950/20 ring-1 ring-sky-500' 
                          : 'bg-slate-950/45 border-slate-850 hover:bg-slate-950 hover:border-slate-800'
                      }`}
                    >
                      {/* Heat Header */}
                      <div className="flex items-start justify-between">
                        <div>
                          <span className="text-[10px] text-sky-400 uppercase font-mono font-bold tracking-widest block">
                            {getCleanRoundName(heat.round)}
                          </span>
                          <h4 className="text-sm font-extrabold text-slate-200 mt-0.5">Bateria #{heat.heatNumber}</h4>
                        </div>
                        <span className={`text-[9px] px-2 py-0.5 rounded font-mono font-medium border uppercase ${
                          isFinished 
                            ? 'bg-emerald-950/40 text-emerald-400 border-emerald-900/40' 
                            : heat.status === 'RACING' 
                              ? 'bg-red-950/55 animate-pulse text-red-400 border-red-900/40' 
                              : 'bg-slate-900 text-slate-400 border-slate-850'
                        }`}>
                          {heat.status === 'FINISHED' ? 'Encerrada' : heat.status === 'RACING' ? 'Pista' : 'Aguardando'}
                        </span>
                      </div>

                      {/* Lane Quick Peek Assignments */}
                      <div className="bg-slate-900/60 p-2.5 rounded-lg border border-slate-900/50 space-y-1">
                        <span className="text-[9px] text-slate-500 font-bold uppercase tracking-wider block mb-1">Grid de Gaiola</span>
                        {heat.gateAssignments.map((assign) => (
                          <div key={assign.riderId} className="flex justify-between items-center text-[10px] border-b border-slate-950 pb-1 last:border-0 last:pb-0 font-mono">
                            <span className="text-slate-400 truncate">
                              R{assign.gate} • <strong className="text-slate-300 font-bold">{assign.riderName.split(' ')[0]}</strong>
                            </span>
                            <span className="text-yellow-500 font-bold">#{assign.plate}</span>
                          </div>
                        ))}
                      </div>

                      {/* Action selector */}
                      <div className="flex items-center justify-between pt-1">
                        {isFinished ? (
                          <span className="text-[10px] text-slate-500 font-mono italic">
                            Vencedor: <strong className="text-slate-300 font-bold font-mono">{heat.gateAssignments.find(a => a.finishPosition === 1)?.riderName.split(' ')[0] || '--'}</strong>
                          </span>
                        ) : (
                          <span className="text-[10px] text-slate-500 font-mono italic">Motos de classificação</span>
                        )}

                        <button
                          onClick={() => onSelectHeat(heat.id)}
                          className={`text-[10px] font-bold px-2.5 py-1 rounded transition-all flex items-center space-x-1 ${
                            isActiveLive
                              ? 'bg-sky-600/30 text-sky-400 border border-sky-500/40'
                              : 'bg-slate-900 hover:bg-slate-850 text-slate-300 border border-slate-800'
                          }`}
                        >
                          <span>{isActiveLive ? 'Monitorando ao Vivo' : 'Carregar no Painel'}</span>
                          <ChevronRight className="h-3 w-3" />
                        </button>
                      </div>

                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-10 bg-slate-950/30 rounded-xl border border-slate-800">
                <p className="text-xs text-slate-500 italic">Nenhuma bateria classificada neste plano corporal.</p>
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  );
}
