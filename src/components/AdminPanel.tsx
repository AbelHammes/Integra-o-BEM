/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { motion } from 'motion/react';
import { 
  Terminal, 
  Sparkles, 
  RefreshCcw, 
  HelpCircle, 
  Copy, 
  Check, 
  Cpu, 
  Upload, 
  Radio, 
  Database,
  Rocket,
  ShieldCheck,
  AlertTriangle,
  Flame,
  ArrowRight,
  Printer,
  Download,
  FileSpreadsheet,
  FileText
} from 'lucide-react';
import { RaceState, Heat } from '../types';
import { apiFetch } from '../api';

interface AdminPanelProps {
  raceState: RaceState;
  onRefresh: () => void;
  selectedHeatId: string | null;
  onSelectHeat: (heatId: string) => void;
}

export default function AdminPanel({ raceState, onRefresh, selectedHeatId, onSelectHeat }: AdminPanelProps) {
  const { heats, live, categories } = raceState;
  
  // States
  const [parseType, setParseType] = useState<'RIDERS' | 'RESULTS'>('RESULTS');
  const [rawText, setRawText] = useState<string>('');
  const [isParsing, setIsParsing] = useState<boolean>(false);
  const [parseFeedback, setParseFeedback] = useState<{ success: boolean; msg: string } | null>(null);
  const [localApiKey, setLocalApiKey] = useState<string>(() => localStorage.getItem('BEM_API_KEY') || '');
  
  const [copyingCurl, setCopyingCurl] = useState<boolean>(false);
  const [copyingPs, setCopyingPs] = useState<boolean>(false);

  const handleApiKeyChange = (val: string) => {
    setLocalApiKey(val);
    localStorage.setItem('BEM_API_KEY', val);
  };

  const selectedHeat = heats.find(h => h.id === selectedHeatId);

  // Set active live heat on track
  const handleSetActiveLiveHeat = async (heatId: string) => {
    const res = await apiFetch('/api/race/update-live', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ activeHeatId: heatId, status: 'STANDBY' })
    });
    if (res.ok) {
      onSelectHeat(heatId);
      onRefresh();
    }
  };

  // Reset database representation to default initial seed (now empty by design)
  const handleResetDatabase = async () => {
    if (window.confirm("Deseja limpar todo o banco de dados de pilotos e resultados para iniciar uma nova cronometragem do BEM zerada? Isso apagará todas as categorias atuais.")) {
      const res = await apiFetch('/api/race/reset', { method: 'POST' });
      if (res.ok) {
        onRefresh();
        alert("Banco de dados redefinido e limpo!");
      }
    }
  };

  // Run the unstructured copy-pasta parser through Gemini server-side!
  const handleAiTextParsing = async () => {
    if (!rawText.trim()) {
      alert("Por favor, cole um conteúdo textual do SISTEMA BEM antes de processar.");
      return;
    }

    setIsParsing(true);
    setParseFeedback(null);

    try {
      const res = await apiFetch('/api/race/upload-bem-text', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          textContent: rawText,
          parseType: parseType
        })
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setParseFeedback({
          success: true,
          msg: data.message || `Análise concluída com sucesso! ${parseType === 'RIDERS' ? 'Pilotos incorporados.' : 'Nova bateria oficial salva.'}`
        });
        setRawText('');
        onRefresh();
      } else {
        setParseFeedback({
          success: false,
          msg: data.error || "Ocorreu uma falha no processamento pela Inteligência Artificial. Verifique o formato."
        });
      }
    } catch (err: any) {
      setParseFeedback({
        success: false,
        msg: "Não foi possível conectar com o servidor para acionar o Gemini: " + err.message
      });
    } finally {
      setIsParsing(false);
    }
  };

  // Mock template examples for the admin to copy and play
  const loadExampleText = () => {
    if (parseType === 'RIDERS') {
      setRawText(
`CBMX - Relatório de Inscritos Oficial
CATEGORIA: Elite Men
1. #22 Bruno Cogo - Americana Bicicross (SP)
2. #1 Renato Rezende - Curitiba BMX (PR)
3. #55 Franklin Vasconcelos - SJC (SP)

CATEGORIA: Junior Men
1. #990 Leonardo Camargo - Sorocaba BMX (SP)
2. #122 Guilherme Dias - Paulínia Bicicross (SP)`
      );
    } else {
      setRawText(
`RESULTADOS DA BATERIA DE VELOCIDADE
CATEGORIA: Elite Men | ROUND: MOTO_2 | BAT: 1
Chegada | Placa | Nome do Piloto | Raia de Largada | Tempo
1 | 22 | Bruno Cogo | 3 | 31.980s
2 | 1 | Renato Rezende | 1 | 32.140s
3 | 45 | Pedro Queiroz | 6 | 32.890s
4 | 109 | Franklin Vasconcelos | 4 | 33.520s`
      );
    }
  };

  // Sync endpoint URLs
  const hostUrl = window.location.origin;
  const curlCommand = `curl -X POST "${hostUrl}/api/race/state" \\
  -H "Content-Type: application/json" \\
  -d @exported_state.json`;

  const powerShellScript = `$state = Get-Content -Raw -Path "./exported_state.json" | ConvertFrom-Json
$body = ConvertTo-Json -InputObject $state -Depth 100
Invoke-RestMethod -Method Post -Uri "${hostUrl}/api/race/state" -Body $body -ContentType "application/json"`;

  const handleCopy = (txt: string, flag: 'CURL' | 'PS') => {
    navigator.clipboard.writeText(txt);
    if (flag === 'CURL') {
      setCopyingCurl(true);
      setTimeout(() => setCopyingCurl(false), 2000);
    } else {
      setCopyingPs(true);
      setTimeout(() => setCopyingPs(false), 2000);
    }
  };

  // Export current results of all categories as a properly formatted, safe CSV
  const handleExportCSV = () => {
    if (raceState.riders.length === 0) return;

    let csvContent = "\uFEFF"; // UTF-8 BOM for Microsoft Excel accent compatibility
    csvContent += `Relatório Oficial de Resultados;${raceState.eventName || "Campeonato de Bicicross"}\n`;
    csvContent += `Pista / Local;${raceState.location || "Pista BMX"} | Data: ${raceState.date || ""}\n\n`;

    const categories = Array.from(new Set(raceState.riders.map(r => r.category)));
    
    categories.forEach(category => {
      csvContent += `CATEGORIA;${category.toUpperCase()}\n`;
      csvContent += "Ranque;Placa;Piloto;Clube;Moto 1;Moto 2;Moto 3;Soma Pontos;Status\n";
      
      const catRiders = raceState.riders
        .filter(r => r.category === category)
        .sort((a, b) => a.totalPoints - b.totalPoints);
        
      catRiders.forEach((rider, idx) => {
        const rank = idx + 1;
        const m1 = rider.points[0] !== null && rider.points[0] !== undefined ? `${rider.points[0]} pt` : "-";
        const m2 = rider.points[1] !== null && rider.points[1] !== undefined ? `${rider.points[1]} pt` : "-";
        const m3 = rider.points[2] !== null && rider.points[2] !== undefined ? `${rider.points[2]} pt` : "-";
        
        csvContent += `${rank};#${rider.plate};"${rider.name}";"${rider.club || ""}";${m1};${m2};${m3};${rider.totalPoints} pt;${rider.status}\n`;
      });
      csvContent += "\n";
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `resultados_bmx_${(raceState.eventName || "campeonato").replace(/[^a-zA-Z0-9]/g, "_")}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Generates and triggers downloading of a completely stylized standalone printable HTML page for PDF export
  const handleExportPDF = () => {
    if (raceState.riders.length === 0) return;

    const eventName = raceState.eventName || "Campeonato de Bicicross";
    const location = raceState.location || "Pista de BMX";
    const date = raceState.date || new Date().toLocaleDateString('pt-BR');

    let htmlContent = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Súmula Oficial - ${eventName}</title>
  <style>
    body {
      font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
      color: #1e293b;
      margin: 0;
      padding: 40px 30px;
      background: #ffffff;
    }
    .header {
      text-align: center;
      border-bottom: 3px double #cbd5e1;
      padding-bottom: 20px;
      margin-bottom: 30px;
    }
    .header h1 {
      font-size: 24px;
      margin: 0 0 5px 0;
      color: #0f172a;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .header h2 {
      font-size: 14px;
      font-weight: 600;
      margin: 0 0 15px 0;
      color: #64748b;
    }
    .meta-grid {
      display: flex;
      justify-content: center;
      gap: 30px;
      font-size: 12px;
      font-family: monospace;
      color: #475569;
    }
    .category-section {
      margin-bottom: 40px;
      page-break-inside: avoid;
    }
    .category-title {
      font-size: 16px;
      font-weight: bold;
      color: #0284c7;
      border-bottom: 2px solid #0284c7;
      padding-bottom: 6px;
      margin-bottom: 15px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 12.5px;
      margin-bottom: 20px;
    }
    th {
      background-color: #f8fafc;
      color: #475569;
      font-weight: 700;
      text-transform: uppercase;
      font-size: 10px;
      border-bottom: 2px solid #cbd5e1;
      padding: 10px 12px;
      text-align: left;
    }
    td {
      padding: 10px 12px;
      border-bottom: 1px solid #e2e8f0;
      color: #334155;
    }
    tr:nth-child(even) td {
      background-color: #f8fafc;
    }
    .font-mono {
      font-family: monospace;
    }
    .text-center {
      text-align: center;
    }
    .text-right {
      text-align: right;
    }
    .text-bold {
      font-weight: bold;
    }
    .plate-badge {
      color: #d97706;
      font-weight: bold;
    }
    .rank-badge {
      display: inline-block;
      width: 22px;
      height: 22px;
      line-height: 22px;
      text-align: center;
      border-radius: 50%;
      background-color: #e2e8f0;
      color: #334155;
      font-weight: bold;
      font-size: 11px;
    }
    .rank-1 { background-color: #fef08a; color: #854d0e; }
    .rank-2 { background-color: #e2e8f0; color: #475569; }
    .rank-3 { background-color: #ffedd5; color: #9a3412; }
    
    .footer {
      margin-top: 60px;
      border-top: 1px solid #e2e8f0;
      padding-top: 15px;
      text-align: center;
      font-size: 10px;
      color: #94a3b8;
    }
    .signatures {
      display: flex;
      justify-content: space-around;
      margin-top: 50px;
      margin-bottom: 10px;
    }
    .sig-line {
      width: 200px;
      border-top: 1px solid #64748b;
      text-align: center;
      font-size: 11px;
      padding-top: 5px;
      color: #475569;
    }
    @media print {
      body {
        padding: 0;
      }
      .category-section {
        page-break-inside: avoid;
      }
    }
  </style>
</head>
<body onload="window.print()">
  <div class="header">
    <h1>Súmula de Resultados Oficiais</h1>
    <h2>${eventName}</h2>
    <div class="meta-grid">
      <span><strong>LOCAL:</strong> ${location}</span>
      <span><strong>DATA:</strong> ${date}</span>
      <span><strong>GERADO PELO PORTAL ONLINE BMX</strong></span>
    </div>
  </div>
`;

    const categories = Array.from(new Set(raceState.riders.map(r => r.category)));

    categories.forEach(category => {
      const catRiders = raceState.riders
        .filter(r => r.category === category)
        .sort((a, b) => a.totalPoints - b.totalPoints);

      htmlContent += `
  <div class="category-section">
    <div class="category-title">${category}</div>
    <table>
      <thead>
        <tr>
          <th style="width: 10%;">Ranque</th>
          <th style="width: 12%;">Placa</th>
          <th style="width: 33%;">Piloto</th>
          <th style="width: 20%;">Clube / Origem</th>
          <th class="text-center" style="width: 8%;">Moto 1</th>
          <th class="text-center" style="width: 8%;">Moto 2</th>
          <th class="text-center" style="width: 8%;">Moto 3</th>
          <th class="text-right" style="width: 11%;">Total Pts</th>
        </tr>
      </thead>
      <tbody>`;

      catRiders.forEach((rider, idx) => {
        const rank = idx + 1;
        const rankClass = rank <= 3 ? `rank-${rank}` : '';
        const m1 = rider.points[0] !== null && rider.points[0] !== undefined ? `${rider.points[0]} pt` : "-";
        const m2 = rider.points[1] !== null && rider.points[1] !== undefined ? `${rider.points[1]} pt` : "-";
        const m3 = rider.points[2] !== null && rider.points[2] !== undefined ? `${rider.points[2]} pt` : "-";

        htmlContent += `
        <tr>
          <td><span class="rank-badge ${rankClass}">${rank}</span></td>
          <td class="plate-badge font-mono">#${rider.plate}</td>
          <td class="text-bold">${rider.name}</td>
          <td>${rider.club || ""}</td>
          <td class="text-center font-mono">${m1}</td>
          <td class="text-center font-mono">${m2}</td>
          <td class="text-center font-mono">${m3}</td>
          <td class="text-right text-bold font-mono">${rider.totalPoints} pt</td>
        </tr>`;
      });

      htmlContent += `
      </tbody>
    </table>
  </div>`;
    });

    htmlContent += `
  <div class="signatures">
    <div class="sig-line">Diretor de Prova (Súmula)</div>
    <div class="sig-line">Cronometrista Oficial (BEM)</div>
  </div>

  <div class="footer">
    Relatório Oficial emitido pelo Módulo de Cronometragem Integrado em ${new Date().toLocaleString('pt-BR')}.
  </div>
</body>
</html>`;

    // Download the self-contained printable package
    const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `sumula_oficial_bmx_${eventName.replace(/[^a-zA-Z0-9]/g, "_")}.html`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6" id="admin-panel-root">
      
      {/* Cockpit Title block */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-slate-800 pb-4 gap-3">
          <div className="flex items-center space-x-3">
            <div className="bg-sky-650 h-10 w-10 rounded-lg flex items-center justify-center text-sky-400">
              <Terminal className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-extrabold text-slate-100 font-sans">Módulo Operador de Cronometragem</h2>
              <p className="text-xs text-slate-400 font-mono">Central de Integrações Offline/Online para o "SISTEMA BEM de BMX" de pista.</p>
            </div>
          </div>

          <div className="flex space-x-2.5">
            <button
              onClick={handleResetDatabase}
              className="bg-slate-950 hover:bg-slate-800 text-slate-400 hover:text-slate-200 text-xs font-mono font-bold px-3 py-1.5 rounded-lg border border-slate-850 flex items-center space-x-1.5 transition"
              id="admin-reset-db-btn"
            >
              <RefreshCcw className="h-3.5 w-3.5" />
              <span>Zerar / Limpar Banco</span>
            </button>
          </div>
        </div>

        {/* Instructions */}
        <p className="text-slate-300 text-xs mt-4 leading-relaxed">
          O <strong>SISTEMA BEM</strong> é a aplicação local que gerencia as súmulas de corrida e tempos das lombadas e portões. Abaixo, você tem duas formas de integrar este site aos resultados da pista: instantaneamente via <strong>Gemini AI (Digitado/Colado)</strong> ou programático via <strong>Chamadas de Webhook (Push API)</strong> no final de cada bateria.
        </p>
      </div>

      {/* Visual Link Sharing Box inside Admin Panel */}
      <div className="bg-gradient-to-br from-[#101F30] to-[#0A1420] border-2 border-yellow-500/20 rounded-xl p-5 shadow-xl space-y-4">
        <div className="flex items-center space-x-2 pb-2 border-b border-slate-800">
          <span className="flex h-2.5 w-2.5 relative">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-yellow-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-yellow-500"></span>
          </span>
          <h3 className="text-sm font-extrabold text-yellow-400 font-sans uppercase tracking-wider">
            Links Oficiais de Transmissão / Divulgação
          </h3>
        </div>

        <p className="text-xs text-slate-300 leading-relaxed font-sans">
          Utilize estes links para que espectadores acompanhem os resultados ao vivo em tempo real pelas arquibancadas (smartphones/tablets/computadores), ou para outros operadores controlarem a cronometragem.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-slate-950 border border-slate-800 p-3 rounded-lg flex flex-col justify-between space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded font-mono uppercase">
                Público (Apenas Visualização)
              </span>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(window.location.origin + window.location.pathname);
                  alert("Link do Espectador copiado para a área de transferência!");
                }}
                className="text-[9px] bg-slate-850 text-slate-300 px-2.5 py-1 rounded font-bold hover:bg-slate-705 transition"
              >
                Copiar Link
              </button>
            </div>
            <div className="text-xs font-mono text-slate-350 bg-slate-900 px-2 py-1.5 rounded truncate select-all">
              {window.location.origin + window.location.pathname}
            </div>
            <p className="text-[10px] text-slate-500 font-mono">
              Otimizado para celulares de atletas e público na arquibancada.
            </p>
          </div>

          <div className="bg-slate-950 border border-slate-800 p-3 rounded-lg flex flex-col justify-between space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-red-400 bg-red-450/10 px-2 py-0.5 rounded font-mono uppercase">
                Administrador (Modo Operador)
              </span>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(window.location.origin + window.location.pathname + "?admin=true");
                  alert("Link do Administrador copiado para a área de transferência!");
                }}
                className="text-[9px] bg-slate-850 text-slate-300 px-2.5 py-1 rounded font-bold hover:bg-slate-705 transition"
              >
                Copiar Link
              </button>
            </div>
            <div className="text-xs font-mono text-yellow-450 bg-slate-900 px-2 py-1.5 rounded truncate select-all">
              {window.location.origin + window.location.pathname}?admin=true
            </div>
            <p className="text-[10px] text-slate-500 font-mono">
              Permite lançar tempos, trocar baterias e redefinir o banco de dados.
            </p>
          </div>
        </div>

        {/* API Key management */}
        <div className="pt-3 border-t border-slate-800/80">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-slate-950 p-3 rounded-lg border border-slate-850">
            <div className="space-y-1">
              <label className="text-[10px] uppercase font-bold text-slate-400 block font-mono">
                Chave de API / Token de Segurança (Configurado no Render)
              </label>
              <p className="text-[10px] text-slate-500 font-sans leading-tight">
                Se você definiu a variável <code className="text-yellow-500/80 font-mono">API_KEY</code> no Render, insira o valor abaixo para salvar no seu navegador e autenticar as operações do BEM.
              </p>
            </div>
            <div className="flex items-center space-x-2">
              <input
                type="password"
                placeholder="Ex: brbmx2026..."
                value={localApiKey}
                onChange={(e) => handleApiKeyChange(e.target.value)}
                className="bg-slate-900 border border-slate-800 rounded px-2.5 py-1 text-xs text-slate-200 outline-none focus:border-yellow-500/40 w-48 font-mono"
              />
              {localApiKey ? (
                <span className="text-[10px] text-emerald-400 font-bold bg-emerald-500/10 px-2 py-1 rounded border border-emerald-950 flex items-center space-x-1">
                  <ShieldCheck className="h-3 w-3" />
                  <span>Configurado</span>
                </span>
              ) : (
                <span className="text-[10px] text-slate-400 font-bold bg-slate-900 px-2 py-1 rounded border border-slate-800">
                  Sem Chave
                </span>
              )}
            </div>
          </div>
        </div>

      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* SECTION 1: Active Race Controller (Control Pit) */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-xl space-y-4">
          <div className="flex items-center space-x-2 border-b border-slate-800 pb-3">
            <Radio className="h-4 w-4 text-emerald-400 animate-pulse" />
            <h3 className="text-sm font-bold text-slate-200">Gaiola de Controle Live (Operador)</h3>
          </div>

          <div className="space-y-4">
            <span className="text-[10px] bg-emerald-500/10 text-emerald-400 uppercase font-mono font-bold border border-emerald-500/20 px-2 py-0.5 rounded leading-normal">
              Acionador de Pista
            </span>
            <p className="text-xs text-slate-400 leading-relaxed font-mono">
              Selecione do banco qual Bateria oficial do SISTEMA BEM está alinhando no portão para que as arquibancadas e telespectadores assistam à telemetria de largada ao vivo.
            </p>

            <div className="max-h-56 overflow-y-auto divide-y divide-slate-950 border border-slate-950 rounded-lg">
              {heats.map((heat) => {
                const isActive = live.activeHeatId === heat.id;
                const isFinished = heat.status === 'FINISHED';
                return (
                  <div 
                    key={heat.id} 
                    className={`p-3 flex items-center justify-between transition text-xs font-mono ${
                      isActive ? 'bg-sky-600/15 border-l-4 border-sky-450' : 'bg-slate-950/30 hover:bg-slate-950'
                    }`}
                  >
                    <div>
                      <span className="text-[9px] text-slate-550 block font-bold uppercase">{heat.category}</span>
                      <span className="text-slate-300 font-bold block">{heat.round === 'FINAL' ? 'Grande Final' : `Moto #${heat.heatNumber}`} ({heat.round})</span>
                    </div>

                    <div className="flex items-center space-x-2.5">
                      <span className={`text-[9px] px-1.5 py-0.5 rounded ${isFinished ? 'bg-emerald-950 text-emerald-400' : 'bg-slate-800 text-slate-400'}`}>
                        {isFinished ? 'Pronto' : 'Aberto'}
                      </span>
                      {!isActive ? (
                        <button
                          onClick={() => handleSetActiveLiveHeat(heat.id)}
                          className="bg-sky-600 hover:bg-sky-500 text-white font-bold font-sans text-[10px] px-2.5 py-1 rounded transition"
                        >
                          Enviar para Geral
                        </button>
                      ) : (
                        <span className="text-[10px] text-sky-400 font-bold flex items-center space-x-1">
                          <Check className="h-3 w-3" />
                          <span>Monitorando</span>
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {selectedHeat && (
              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2">
                <span className="text-[10px] text-slate-400 font-mono block">Monitor de Telemetria Selecionado:</span>
                <span className="text-sm font-extrabold text-slate-200 block truncate">{selectedHeat.category} (Moto {selectedHeat.heatNumber})</span>
                <div className="flex space-x-2 pt-1.5">
                  <span className="text-xs text-slate-500 font-mono">Bateria status atual:</span>
                  <span className="text-xs text-yellow-400 font-bold uppercase font-mono">{selectedHeat.status}</span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* SECTION 2: AI Parser (Gemini Cloud parsing) */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-xl space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div className="flex items-center space-x-2">
              <Sparkles className="h-4 w-4 text-sky-400 animate-pulse" />
              <h3 className="text-sm font-bold text-slate-200">Importador Inteligente SISTEMA BEM (Gemini IA)</h3>
            </div>
            <span className="text-[9px] bg-sky-950 text-sky-300 px-2 py-0.5 border border-sky-850 rounded font-mono font-bold">GEMINI 3.5 FLASH</span>
          </div>

          <div className="space-y-4">
            <p className="text-xs text-slate-400 leading-relaxed font-sans">
              O cronometrista do SISTEMA BEM de BMX pode copiar a tabela de resultados brutos ou a lista de inscritos e colá-la aqui. A nossa Inteligência Artificial lerá o texto bagunçado e atualizará os pontos e rankings do site automaticamente!
            </p>

            <div className="flex space-x-3">
              <button
                onClick={() => { setParseType('RESULTS'); setParseFeedback(null); }}
                className={`flex-1 text-center py-2.5 rounded-lg text-xs font-bold font-sans border transition ${
                  parseType === 'RESULTS' 
                    ? 'bg-sky-600 text-white border-sky-500 shadow shadow-sky-950' 
                    : 'bg-slate-950/80 text-slate-400 border-slate-800/80 hover:text-slate-200'
                }`}
              >
                Resultados de Baterias
              </button>
              <button
                onClick={() => { setParseType('RIDERS'); setParseFeedback(null); }}
                className={`flex-1 text-center py-2.5 rounded-lg text-xs font-bold font-sans border transition ${
                  parseType === 'RIDERS' 
                    ? 'bg-sky-600 text-white border-sky-500 shadow shadow-sky-950' 
                    : 'bg-slate-950/80 text-slate-400 border-slate-800/80 hover:text-slate-200'
                }`}
              >
                Lista de Inscritos
              </button>
            </div>

            {/* Input area */}
            <div className="space-y-1">
              <div className="flex justify-between items-center text-[10px] text-slate-500 font-mono">
                <button 
                  onClick={loadExampleText} 
                  className="text-sky-400 hover:underline flex items-center space-x-1"
                >
                  <Cpu className="h-3 w-3" />
                  <span>Carregar Amostra SISTEMA BEM</span>
                </button>
                <span>Cole o texto bruto abaixo:</span>
              </div>
              <textarea
                value={rawText}
                onChange={(e) => setRawText(e.target.value)}
                placeholder={
                  parseType === 'RESULTS' 
                    ? "Cole os tempos ou sumários das baterias... ex:\n1 | #22 Bruno Cogo | Raia 3 | 31.98s" 
                    : "Cole a lista de inscritos em qualquer formato aqui..."
                }
                rows={4}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 text-slate-200 text-xs focus:outline-none focus:border-sky-500 font-mono leading-relaxed"
                id="admin-ai-raw-textarea"
              />
            </div>

            {/* Parse button */}
            <button
              onClick={handleAiTextParsing}
              disabled={isParsing}
              className={`w-full py-2.5 rounded-lg font-bold font-sans text-xs transition flex items-center justify-center space-x-2 ${
                isParsing 
                  ? 'bg-slate-800 text-slate-550 cursor-not-allowed border border-slate-755' 
                  : 'bg-gradient-to-r from-sky-600 to-indigo-600 hover:from-sky-500 hover:to-indigo-500 text-white shadow-lg shadow-sky-950/40'
              }`}
              id="admin-ai-parse-btn"
            >
              {isParsing ? (
                <>
                  <RefreshCcw className="h-4 w-4 animate-spin text-sky-400" />
                  <span className="font-mono">Analisando Relatório BEM com IA...</span>
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4 text-yellow-300 animate-pulse" />
                  <span>Processar e Atualizar Rankings</span>
                </>
              )}
            </button>

            {/* Feedbacks */}
            {parseFeedback && (
              <div className={`p-3 rounded-lg text-xs font-mono flex items-start space-x-2 ${
                parseFeedback.success 
                  ? 'bg-emerald-950/30 text-emerald-400 border border-emerald-900/40' 
                  : 'bg-red-950/30 text-red-400 border border-red-900/40'
              }`}>
                {parseFeedback.success ? (
                  <ShieldCheck className="h-4 w-4 mt-0.5 flex-shrink-0" />
                ) : (
                  <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                )}
                <span>{parseFeedback.msg}</span>
              </div>
            )}
          </div>
        </div>

      </div>

      {/* SECTION EXPORT: Official Reports Generator */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-xl space-y-4" id="admin-export-section">
        <div className="flex items-center space-x-2 border-b border-slate-800 pb-3">
          <FileText className="h-4 w-4 text-sky-400" />
          <h3 className="text-sm font-bold text-slate-200">Painel de Geração de Súmulas e Relatórios Oficiais</h3>
        </div>

        <p className="text-slate-300 text-xs leading-relaxed font-sans">
          Gere e baixe instantaneamente os relatórios consolidados do campeonato para divulgação offline, homologação de súmulas junto à confederação ou arquivamento oficial da prova.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
          {/* Option A: CSV Spreadsheets */}
          <div className="bg-slate-950 p-5 rounded-lg border border-slate-900 space-y-3.5 flex flex-col justify-between">
            <div className="space-y-1.5 font-sans">
              <div className="flex items-center space-x-2">
                <FileSpreadsheet className="h-4 w-4 text-emerald-400" />
                <h4 className="text-xs font-bold text-slate-200 uppercase font-mono">Planilha de Classificação (CSV)</h4>
              </div>
              <p className="text-[11px] text-slate-400 leading-relaxed font-sans">
                Exporta a classificação geral acumulada de todos os pilotos divididos por suas respectivas categorias, contendo pontuação detalhada rodada por rodada em formato perfeito para Microsoft Excel e Google Planilhas.
              </p>
            </div>
            
            <button
              onClick={handleExportCSV}
              disabled={raceState.riders.length === 0}
              className={`w-full py-2 px-4 rounded-lg font-bold text-xs transition flex items-center justify-center space-x-2 font-sans ${
                raceState.riders.length === 0
                  ? 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-850'
                  : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow shadow-emerald-950/20'
              }`}
            >
              <Download className="h-4 w-4" />
              <span>Baixar Excel / CSV (.csv)</span>
            </button>
          </div>

          {/* Option B: printable PDF/HTML report */}
          <div className="bg-slate-950 p-5 rounded-lg border border-slate-900 space-y-3.5 flex flex-col justify-between">
            <div className="space-y-1.5 font-sans">
              <div className="flex items-center space-x-2">
                <Printer className="h-4 w-4 text-sky-400" />
                <h4 className="text-xs font-bold text-slate-200 uppercase font-mono">Súmula de Resultados Impressionável (PDF)</h4>
              </div>
              <p className="text-[11px] text-slate-400 leading-relaxed font-sans">
                Gera um documento de prestação de contas com assinaturas oficiais prontinho para visualização ou para **Salvar como PDF** usando a ferramenta de impressão nativa do seu navegador, com quebras de página por categoria.
              </p>
            </div>
            
            <button
              onClick={handleExportPDF}
              disabled={raceState.riders.length === 0}
              className={`w-full py-2 px-4 rounded-lg font-bold text-xs transition flex items-center justify-center space-x-2 font-sans ${
                raceState.riders.length === 0
                  ? 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-850'
                  : 'bg-sky-600 hover:bg-sky-500 text-white shadow shadow-sky-950/20'
              }`}
            >
              <Printer className="h-4 w-4" />
              <span>Imprimir / Gerar PDF Oficial</span>
            </button>
          </div>
        </div>
      </div>

      {/* SECTION 3: Webhook Developers documentation details */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-xl space-y-4">
        <div className="flex items-center space-x-2 border-b border-slate-800 pb-3">
          <Database className="h-4 w-4 text-sky-450" />
          <h3 className="text-sm font-bold text-slate-200">Integração Direta em Tempo Real (Webhook de Súmula Geral)</h3>
        </div>

        <p className="text-slate-300 text-xs leading-relaxed font-sans">
          Para que o <strong>SISTEMA BEM de BMX</strong> sincronize de forma automática no plano de fundo sem precisar colar dados manualmente, configure o utilitário de rede local na torre de cronometragem para fazer requisições <code>POST JSON</code> a cada fechamento de prova na súmula local.
        </p>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 pt-1">
          {/* Curl implementation */}
          <div className="bg-slate-950 p-4.5 rounded-lg border border-slate-900 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-slate-400 font-mono font-bold">LINUX / MAC WEBHOOK (CURL)</span>
              <button
                onClick={() => handleCopy(curlCommand, 'CURL')}
                className="text-[10px] bg-slate-900 hover:bg-slate-850 border border-slate-800 text-slate-300 px-2.5 py-1 rounded inline-flex items-center space-x-1 font-mono transition"
              >
                {copyingCurl ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
                <span>{copyingCurl ? 'Copiado!' : 'Copiar'}</span>
              </button>
            </div>
            <pre className="text-[10px] text-sky-350 p-3 bg-slate-1000 rounded font-mono overflow-x-auto whitespace-pre leading-normal border border-slate-950 select-all">
              {curlCommand}
            </pre>
          </div>

          {/* PowerShell implementation */}
          <div className="bg-slate-950 p-4.5 rounded-lg border border-slate-900 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-slate-400 font-mono font-bold">WINDOWS PC OPERATOR (POWERSHELL)</span>
              <button
                onClick={() => handleCopy(powerShellScript, 'PS')}
                className="text-[10px] bg-slate-900 hover:bg-slate-850 border border-slate-800 text-slate-300 px-2.5 py-1 rounded inline-flex items-center space-x-1 font-mono transition"
              >
                {copyingPs ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
                <span>{copyingPs ? 'Copiado!' : 'Copiar'}</span>
              </button>
            </div>
            <pre className="text-[10px] text-sky-350 p-3 bg-slate-1000 rounded font-mono overflow-x-auto whitespace-pre leading-normal border border-slate-950 select-all">
              {powerShellScript}
            </pre>
          </div>
        </div>

        <div className="bg-slate-950 p-4.5 rounded-lg border border-slate-850 flex items-start space-x-3">
          <Rocket className="h-5 w-5 text-sky-450 mt-0.5" />
          <div>
            <h4 className="text-xs font-bold text-slate-200">Como funciona a decodificação da API?</h4>
            <p className="text-[11px] text-slate-450 leading-relaxed font-sans mt-0.5">
              O payload sincronizado deve conter uma lista hierarquizada de pilotos e baterias. Após receber o upload, a nossa API recalcula todos os desempates olímpicos por baterias, soma e ordena as classificações de tempos, liberando as atualizações para todos os navegadores simultaneamente sem precisar recarregar a tela.
            </p>
          </div>
        </div>

      </div>

    </div>
  );
}
