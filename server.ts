/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express from 'express';
import path from 'path';
import fs from 'fs';
import { GoogleGenAI, Type } from '@google/genai';
import { RaceState, Rider, Heat, RaceRound, GateAssignment } from './src/types';

// State path for lightweight JSON persistence
const STATE_FILE = path.join(process.cwd(), 'race_state.json');

// Initialize Express
const app = express();
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Initialize Lazy Gemini Client Helper
let aiClient: GoogleGenAI | null = null;
function getGemini(): GoogleGenAI {
  if (!aiClient) {
    const key = process.env.GEMINI_API_KEY;
    if (!key || key === "MY_GEMINI_API_KEY") {
      throw new Error('GEMINI_API_KEY is not configured in your Secrets/Environment.');
    }
    aiClient = new GoogleGenAI({
      apiKey: key,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  }
  return aiClient;
}

// Full, realistic INITIAL Mock database of Brazilian BMX (Bicicross) Championship
const DEFAULT_RACE_STATE: RaceState = {
  eventName: "Sem Evento Ativo",
  location: "Aguardando sincronização do BEM",
  date: "",
  categories: [],
  riders: [],
  heats: [],
  live: {
    activeHeatId: null,
    status: "STANDBY",
    gateDroppedAt: null,
    finishResults: undefined
  }
};

// Global in-memory controller state
let currentRaceState: RaceState = { ...DEFAULT_RACE_STATE };

// Try loading saved state
if (fs.existsSync(STATE_FILE)) {
  try {
    currentRaceState = JSON.parse(fs.readFileSync(STATE_FILE, 'utf-8'));
    console.log("State restored successfully from race_state.json");
    if (currentRaceState.riders && currentRaceState.riders.some(r => r.id && (r.id.startsWith("em_") || r.id.startsWith("ew_") || r.id.startsWith("jm_")))) {
      console.log("Mock data detected in restored state, resetting to empty slate as requested by operator.");
      currentRaceState = { ...DEFAULT_RACE_STATE };
      fs.writeFileSync(STATE_FILE, JSON.stringify(currentRaceState, null, 2), 'utf-8');
    }
  } catch (err) {
    console.error("Error reading race_state.json, starting with default mock:", err);
  }
}

// Function to synchronously write state to local file as backup
function saveState() {
  try {
    fs.writeFileSync(STATE_FILE, JSON.stringify(currentRaceState, null, 2), 'utf-8');
  } catch (err) {
    console.error("Failed to persist race state locally:", err);
  }
}

// Function to recount points and sort riders
function recalculateRankings() {
  const ridersByCategory: Record<string, Rider[]> = {};

  // Group riders by category
  for (const rider of currentRaceState.riders) {
    if (!ridersByCategory[rider.category]) {
      ridersByCategory[rider.category] = [];
    }
    ridersByCategory[rider.category].push(rider);
  }

  // Clear points lists for all riders to recount dynamically
  for (const r of currentRaceState.riders) {
    r.points = [];
  }

  // Iterate all finished heats and update rider points
  for (const heat of currentRaceState.heats) {
    if (heat.status === 'FINISHED') {
      for (const assign of heat.gateAssignments) {
        if (assign.motoPoints !== undefined && (heat.round === 'MOTO_1' || heat.round === 'MOTO_2' || heat.round === 'MOTO_3')) {
          const r = currentRaceState.riders.find(x => x.id === assign.riderId);
          if (r) {
            const idx = heat.round === 'MOTO_1' ? 0 : heat.round === 'MOTO_2' ? 1 : 2;
            r.points[idx] = assign.motoPoints;
          }
        }
      }
    }
  }

  // Re-sum total points and sort
  for (const cat of Object.keys(ridersByCategory)) {
    const list = ridersByCategory[cat];
    for (const r of list) {
      // fill blank moto points with 8 (DNS/DNF equivalent max penalty point)
      for (let i = 0; i < 3; i++) {
        if (r.points[i] === undefined) {
          r.points[i] = 8;
        }
      }
      r.totalPoints = r.points[0] + r.points[1] + r.points[2];
    }

    // Sort: lower totalPoints first
    list.sort((a, b) => a.totalPoints - b.totalPoints);

    // Apply ranking numbers
    list.forEach((rider, index) => {
      rider.rank = index + 1;
    });
  }

  saveState();
}

// REST API DEFINITIONS
const checkApiKey = (req: any, res: any, next: any) => {
  const secret = process.env.API_KEY;
  if (!secret) {
    return next(); // API key not set in environment (e.g., local dev), allow write access
  }
  
  const clientKey = req.headers['x-api-key'] || req.headers['x-api-token'] || (req.headers['authorization'] as string)?.replace(/^Bearer\s+/i, '');
  
  if (clientKey === secret) {
    return next();
  }
  
  return res.status(401).json({ error: "Chave de acesso (API Key) não fornecida ou incorreta para esta operação." });
};

// 1. Get entire current BMX state
app.get('/api/race/state', (req, res) => {
  res.json(currentRaceState);
});

// 2. Full manual state replace (Allows custom integrations or file push)
app.post('/api/race/state', checkApiKey, (req, res) => {
  try {
    const newState = req.body as RaceState;
    if (newState && newState.eventName && Array.isArray(newState.riders) && Array.isArray(newState.heats)) {
      currentRaceState = {
        eventName: newState.eventName,
        location: newState.location || currentRaceState.location,
        date: newState.date || currentRaceState.date,
        categories: newState.categories || currentRaceState.categories,
        riders: newState.riders,
        heats: newState.heats,
        live: newState.live || currentRaceState.live
      };
      recalculateRankings();
      res.json({ success: true, message: "Estado de corrida sincronizado com sucesso!" });
    } else {
      res.status(400).json({ error: "Estrutura do estado da corrida inválida." });
    }
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 3. Reset to default Brazilian BMX simulation database
app.post('/api/race/reset', checkApiKey, (req, res) => {
  currentRaceState = JSON.parse(JSON.stringify(DEFAULT_RACE_STATE));
  saveState();
  res.json({ success: true, message: "Banco de dados redefinido para a simulação padrão." });
});

// 4. Update the active tracker/live status on track
app.post('/api/race/update-live', checkApiKey, (req, res) => {
  const { activeHeatId, status, gateDroppedAt, finishResults } = req.body;

  if (activeHeatId !== undefined) {
    currentRaceState.live.activeHeatId = activeHeatId;
    // Set status of that heat
    const heat = currentRaceState.heats.find(h => h.id === activeHeatId);
    if (heat) {
      if (status === 'ON_TRACK') {
        heat.status = 'RACING';
      } else if (status === 'FINISHED') {
        heat.status = 'FINISHED';
      } else if (status === 'GATE_READY') {
        heat.status = 'GATES_FULL';
      } else {
        heat.status = 'UPCOMING';
      }
    }
  }
  if (status !== undefined) currentRaceState.live.status = status;
  if (gateDroppedAt !== undefined) currentRaceState.live.gateDroppedAt = gateDroppedAt;
  if (finishResults !== undefined) currentRaceState.live.finishResults = finishResults;

  saveState();
  res.json({ success: true, live: currentRaceState.live });
});

// 5. Submit live finish results & bind them directly back into the official heat rankings
app.post('/api/race/submit-live-results', checkApiKey, (req, res) => {
  const { heatId, results, winnerTime } = req.body as {
    heatId: string;
    winnerTime: string;
    results: { riderId: string; position: number; time: string }[];
  };

  const heat = currentRaceState.heats.find(h => h.id === heatId);
  if (!heat) {
    return res.status(404).json({ error: "Bateria não encontrada" });
  }

  // Update Heat assignments with official finisher positions and times
  heat.status = 'FINISHED';
  heat.winnerTime = winnerTime;
  heat.finishedAt = new Date().toISOString();

  for (const assign of heat.gateAssignments) {
    const riderRes = results.find(r => r.riderId === assign.riderId);
    if (riderRes) {
      assign.finishPosition = riderRes.position;
      assign.time = riderRes.time;
      assign.motoPoints = riderRes.position; // In BMX rounds, finish rank = points scored
    }
  }

  // Check if all Moto rounds are done, maybe create next matches
  recalculateRankings();

  // Reset Live status back to STANDBY
  currentRaceState.live.status = 'FINISHED';
  currentRaceState.live.finishResults = results.map(r => {
    const assignee = heat.gateAssignments.find(x => x.riderId === r.riderId);
    return {
      riderId: r.riderId,
      gate: assignee ? assignee.gate : 0,
      position: r.position,
      time: r.time
    };
  });

  saveState();
  res.json({ success: true, heat, live: currentRaceState.live });
});

// Helper to safely extract HTML tag contents without index-based catastrophic backtracking or CPU blocks
function extractTagContentByTagName(html: string, tagName: string): { content: string }[] {
  const results: { content: string }[] = [];
  const lowerHtml = html.toLowerCase();
  const openTagPrefix = `<${tagName.toLowerCase()}`;
  const closeTag = `</${tagName.toLowerCase()}>`;
  
  let pos = 0;
  while (true) {
    const idx = lowerHtml.indexOf(openTagPrefix, pos);
    if (idx === -1) break;
    
    // Ensure accurate tag start
    const nextChar = lowerHtml[idx + openTagPrefix.length];
    if (nextChar !== undefined && nextChar !== ' ' && nextChar !== '>' && nextChar !== '\r' && nextChar !== '\n' && nextChar !== '\t') {
      pos = idx + openTagPrefix.length;
      continue;
    }
    
    // Find open tag closing bracket
    const openCloseIdx = lowerHtml.indexOf('>', idx);
    if (openCloseIdx === -1) break;
    
    // Find close tag
    const endIdx = lowerHtml.indexOf(closeTag, openCloseIdx);
    if (endIdx === -1) {
      pos = openCloseIdx + 1;
      continue;
    }
    
    const content = html.substring(openCloseIdx + 1, endIdx);
    results.push({ content });
    
    pos = endIdx + closeTag.length;
  }
  return results;
}

// Helper function to extract and parse BEM exported HTML tables directly, bypassing Gemini for flawless local processing
function parseBemHtml(html: string): any {
  const lower = html.toLowerCase();
  if (!lower.includes('<table') || !lower.includes('<td')) {
    return null;
  }

  // Event Name
  let eventName = "";
  const h1Content = extractTagContentByTagName(html, 'h1');
  if (h1Content.length > 0) {
    eventName = h1Content[0].content.replace(/<[^>]*>/g, '').trim();
  }
  const h2Content = extractTagContentByTagName(html, 'h2');
  if (h2Content.length > 0) {
    eventName += (eventName ? " - " : "") + h2Content[0].content.replace(/<[^>]*>/g, '').trim();
  }
  if (!eventName) {
    eventName = "Campeonato BEM Importado";
  }

  // Date
  let date = "Recém Importado";
  const dateMatch = html.match(/Report Created\s+([^<\n\r]+)/i);
  if (dateMatch) {
    date = dateMatch[1].trim();
  }

  const ridersList: any[] = [];
  const heatsList: any[] = [];
  const categoriesList: string[] = [];

  const tables = extractTagContentByTagName(html, 'table');
  for (const table of tables) {
    const tableContent = table.content;
    
    // Caption containing category
    const captions = extractTagContentByTagName(tableContent, 'caption');
    let category = "";
    if (captions.length > 0) {
      const rawCategory = captions[0].content.replace(/<[^>]*>/g, '').trim();
      category = rawCategory.replace(/\s*\(\d+\s*Riders\)/i, '').trim();
    }
    
    if (!category) {
      // Look for any potential column name in cells or first row or make default
      category = "BEM Categoria Geral";
    }

    if (!categoriesList.includes(category)) {
      categoriesList.push(category);
    }

    interface RiderExtract {
      id: string;
      name: string;
      plate: string;
      category: string;
      club: string;
      points: number[];
      totalPoints: number;
      rank: number;
      status: 'OK';
      m1Pos?: number; m1Time?: string;
      m2Pos?: number; m2Time?: string;
      m3Pos?: number; m3Time?: string;
      finalPos?: number; finalTime?: string;
    }

    const tableRiders: RiderExtract[] = [];
    const rows = extractTagContentByTagName(tableContent, 'tr');

    for (const row of rows) {
      const rowContent = row.content;
      if (rowContent.toLowerCase().includes('<th')) continue; // Skip headers

      const cells = extractTagContentByTagName(rowContent, 'td');
      if (cells.length < 3) continue; // Invalid row

      const tds = cells.map(c => c.content);

      // Column 0: Plate
      const plate = tds[0].replace(/<[^>]*>/g, '').trim();
      if (!plate) continue;

      // Column 1: Country / Club
      const club = tds[1].replace(/<[^>]*>/g, '').trim();

      // Column 2: Name
      let name = tds[2].replace(/<span[^>]*>([\s\S]*?)<\/span>/i, '$1');
      name = name.replace(/<[^>]*>/g, ' ').trim();
      // Remove license codes e.g. (100...)
      name = name.replace(/\s*\(\s*\d[\d\s]*\)\s*/g, '').trim();
      name = name.replace(/\s+/g, ' ').trim();

      // Column 3: Final
      let finalPos: number | undefined;
      let finalTime: string | undefined;
      if (tds[3] && tds[3].trim()) {
        const text = tds[3].replace(/<[^>]*>/g, ' ').trim().toUpperCase();
        if (text && text !== '-' && text !== 'DNS' && text !== 'DNF') {
          const finalPosMatch = text.match(/(\d+)(?:ST|ND|RD|TH)/i);
          if (finalPosMatch) {
            finalPos = parseInt(finalPosMatch[1], 10);
          } else {
            const digitMatch = text.match(/^(\d+)/);
            if (digitMatch) finalPos = parseInt(digitMatch[1], 10);
          }
          const timeMatch = text.match(/(\d+\.\d+)/);
          if (timeMatch) {
            finalTime = timeMatch[1] + "s";
          }
        }
      }

      // Column 5: total points
      let totalPoints = 0;
      if (tds[5]) {
        const val = parseInt(tds[5].replace(/<[^>]*>/g, '').trim(), 10);
        if (!isNaN(val)) totalPoints = val;
      }

      // Convert individual Moto columns
      const parseMotoColumn = (colText: string | undefined) => {
        if (!colText) return undefined;
        const text = colText.replace(/<[^>]*>/g, ' ').trim().toUpperCase();
        if (text === '-' || text === '') return undefined;

        let pos = 8;
        const posMatch = text.match(/(\d+)(?:ST|ND|RD|TH)/i);
        if (posMatch) {
          pos = parseInt(posMatch[1], 10);
        } else if (text.includes("CR:") || text.includes("CR")) {
          const digit = text.match(/(?:CR:?\s*)(\d+)/i) || text.match(/(\d+)/);
          pos = digit ? parseInt(digit[1], 10) : 9;
        } else if (text.includes("DNS")) {
          pos = 8;
        } else if (text.includes("DNF")) {
          pos = 8;
        } else {
          const digit = text.match(/^(\d+)/);
          if (digit) pos = parseInt(digit[1], 10);
        }

        let time = "33.000s";
        const timeMatch = text.match(/(\d+\.\d+)/);
        if (timeMatch) {
          time = timeMatch[1] + "s";
        }

        return { pos, time };
      };

      const m1 = parseMotoColumn(tds[6]);
      const m2 = parseMotoColumn(tds[7]);
      const m3 = parseMotoColumn(tds[8]);

      const points = [
        m1 ? m1.pos : 8,
        m2 ? m2.pos : 8,
        m3 ? m3.pos : 8
      ];

      tableRiders.push({
        id: `bem_${category.replace(/[^a-zA-Z0-9]/g, '_')}_${plate}`,
        name,
        plate,
        category,
        club: club || 'Clube BEM',
        points,
        totalPoints: totalPoints || (points[0] + points[1] + points[2]),
        rank: 99,
        status: 'OK',
        m1Pos: m1?.pos,
        m1Time: m1?.time,
        m2Pos: m2?.pos,
        m2Time: m2?.time,
        m3Pos: m3?.pos,
        m3Time: m3?.time,
        finalPos,
        finalTime
      });
    }

    if (tableRiders.length === 0) continue;

    // Rank of the table
    tableRiders.sort((a, b) => a.totalPoints - b.totalPoints);
    tableRiders.forEach((r, idx) => {
      r.rank = idx + 1;
      
      ridersList.push({
        id: r.id,
        name: r.name,
        plate: r.plate,
        category: r.category,
        club: r.club,
        points: r.points,
        totalPoints: r.totalPoints,
        rank: idx + 1,
        status: 'OK'
      });
    });

    // Create Heats
    const buildRoundHeat = (round: RaceRound, selectPropPos: 'm1Pos'|'m2Pos'|'m3Pos', selectPropTime: 'm1Time'|'m2Time'|'m3Time') => {
      const activeRiders = tableRiders.filter(r => r[selectPropPos] !== undefined);
      if (activeRiders.length === 0) return;

      const assignments = activeRiders.map((r, listIdx) => ({
        riderId: r.id,
        riderName: r.name,
        plate: r.plate,
        gate: listIdx + 1,
        time: r[selectPropTime] || "33.000s",
        finishPosition: r[selectPropPos],
        motoPoints: r[selectPropPos]
      }));

      assignments.sort((a,b) => (a.finishPosition || 8) - (b.finishPosition || 8));

      heatsList.push({
        id: `heat_bem_${category.replace(/[^a-zA-Z0-9]/g, '_')}_${round}`,
        heatNumber: 1,
        category,
        round,
        gateAssignments: assignments,
        status: 'FINISHED',
        winnerTime: assignments[0]?.time || "32.000s",
        finishedAt: new Date().toISOString()
      });
    };

    buildRoundHeat('MOTO_1', 'm1Pos', 'm1Time');
    buildRoundHeat('MOTO_2', 'm2Pos', 'm2Time');
    buildRoundHeat('MOTO_3', 'm3Pos', 'm3Time');

    const finalRiders = tableRiders.filter(r => r.finalPos !== undefined);
    if (finalRiders.length > 0) {
      const finalAssignments = finalRiders.map((r, listIdx) => ({
        riderId: r.id,
        riderName: r.name,
        plate: r.plate,
        gate: listIdx + 1,
        time: r.finalTime || "33.000s",
        finishPosition: r.finalPos,
        motoPoints: r.finalPos
      }));

      finalAssignments.sort((a,b) => (a.finishPosition || 8) - (b.finishPosition || 8));

      heatsList.push({
        id: `heat_bem_${category.replace(/[^a-zA-Z0-9]/g, '_')}_FINAL`,
        heatNumber: 1,
        category,
        round: 'FINAL',
        gateAssignments: finalAssignments,
        status: 'FINISHED',
        winnerTime: finalAssignments[0]?.time || "32.000s",
        finishedAt: new Date().toISOString()
      });
    }
  }

  return {
    eventName,
    location: "Campeonato BMX Event Manager",
    date,
    categories: categoriesList,
    riders: ridersList,
    heats: heatsList,
    live: {
      activeHeatId: null,
      status: 'STANDBY',
      gateDroppedAt: null
    }
  };
}

// Helper function for smart local BMX text parsing fallback when Gemini is busy or offline
function fallbackParseBMXText(textContent: string, parseType: 'RIDERS' | 'RESULTS'): any {
  // If text is HTML or has HTML tags, strip them first safely to keep line parsing simple, fast, and secure
  let text = textContent;
  if (text.toLowerCase().includes('<table') || text.toLowerCase().includes('<tr') || text.includes('</')) {
    text = text.replace(/<[^>]*>/g, ' ');
  }

  const lines = text.split('\n');
  
  if (parseType === 'RIDERS') {
    const riders: any[] = [];
    let currentCategory = 'Elite Men';
    
    for (let line of lines) {
      line = line.trim();
      if (!line) continue;
      
      // Category detection
      const catMatch = line.match(/(?:CATEGORIA|CATEGORY|CLASS):\s*([^\n\|-]+)/i);
      if (catMatch) {
        currentCategory = catMatch[1].trim();
        continue;
      }
      
      // Safe, backtrack-free programmatic parser for rider lines
      // Let's strip numbering from the beginning like "1. ", "02 -", "12 |"
      const cleanLine = line.replace(/^\s*\d+[\s\.\-\)|]+\s*/, '').trim();
      if (!cleanLine) continue;

      // Handle custom CSV/Pipe formats
      if (cleanLine.includes('|')) {
        const parts = cleanLine.split('|').map(p => p.trim());
        if (parts.length >= 2) {
          const name = parts[0];
          const plate = parts[1].replace('#', '').trim();
          const club = parts[2] || 'Clube Individual';
          if (name.length > 2 && /^\d+$/.test(plate)) {
            riders.push({
              name,
              plate,
              category: currentCategory,
              club
            });
          }
        }
        continue;
      }

      // Handle simple space separated words e.g. "22 Bruno Cogo Americana"
      const parts = cleanLine.split(/\s+/);
      if (parts.length >= 2) {
        const firstPart = parts[0].replace('#', '').trim();
        if (/^\d+$/.test(firstPart)) {
          const plate = firstPart;
          const remainingText = parts.slice(1).join(' ');
          
          // Separate name and club by dash or comma
          const separatorMatch = remainingText.split(/[-\(,]/);
          const name = separatorMatch[0].trim();
          const club = separatorMatch[1] ? separatorMatch[1].replace(/[\)\s]+/g, ' ').trim() : 'Clube Individual';
          
          if (name.length > 2) {
            riders.push({
              name,
              plate,
              category: currentCategory,
              club
            });
          }
        }
      }
    }
    return { riders };
  } else {
    // parseType === 'RESULTS'
    let category = 'Elite Men';
    let round: RaceRound = 'MOTO_1';
    let heatNumber = 1;
    const results: any[] = [];
    
    for (let line of lines) {
      line = line.trim();
      if (!line) continue;
      
      const catMatch = line.match(/(?:CATEGORIA|CATEGORY):\s*([^\n\|]+)/i);
      if (catMatch) {
        category = catMatch[1].trim();
        continue;
      }
      
      const roundMatch = line.match(/(?:ROUND|RODADA|FASE):\s*([A-Za-z0-0_]+)/i);
      if (roundMatch) {
        const val = roundMatch[1].trim().toUpperCase();
        if (val.includes('MOTO_1') || val.includes('MOTO1')) round = 'MOTO_1';
        else if (val.includes('MOTO_2') || val.includes('MOTO2')) round = 'MOTO_2';
        else if (val.includes('MOTO_3') || val.includes('MOTO3')) round = 'MOTO_3';
        else if (val.includes('SEMI')) round = 'SEMI';
        else if (val.includes('FINAL')) round = 'FINAL';
        continue;
      } else {
        const upper = line.toUpperCase();
        if (upper.includes('MOTO_1') || upper.includes('MOTO 1')) round = 'MOTO_1';
        if (upper.includes('MOTO_2') || upper.includes('MOTO 2')) round = 'MOTO_2';
        if (upper.includes('MOTO_3') || upper.includes('MOTO 3')) round = 'MOTO_3';
        if (upper.includes('FINAL')) round = 'FINAL';
        if (upper.includes('SEMI')) round = 'SEMI';
      }
      
      const heatMatch = line.match(/(?:BAT|BATERIA|HEAT):\s*(\d+)/i);
      if (heatMatch) {
        heatNumber = parseInt(heatMatch[1], 10);
        continue;
      }
      
      // Parse results line by splitting by | or spaces manually and safely
      if (line.includes('|')) {
        const parts = line.split('|').map(p => p.trim());
        if (parts.length >= 3) {
          const pos = parseInt(parts[0], 10);
          const plate = parts[1].replace('#', '').trim();
          const name = parts[2];
          let gate = 1;
          let time = '33.000s';
          
          if (parts.length >= 4) {
            const gateVal = parts[3].replace(/[^\d]/g, '');
            if (gateVal) gate = parseInt(gateVal, 10);
          }
          if (parts.length >= 5) {
            time = parts[4];
            if (!time.endsWith('s') && !isNaN(Number(time))) time += 's';
          }
          
          if (!isNaN(pos) && plate && /^\d+$/.test(plate)) {
            results.push({
              plate,
              name,
              gate,
              position: pos,
              time
            });
          }
        }
      } else {
        // Space separation: pos plate name [gate] [time]
        const parts = line.split(/\s+/);
        if (parts.length >= 3) {
          const pos = parseInt(parts[0], 10);
          const plate = parts[1].replace('#', '').trim();
          const name = parts[2];
          
          if (!isNaN(pos) && /^\d+$/.test(plate) && name.length > 2) {
            let gate = 1;
            let time = '33.000s';
            if (parts.length >= 4) {
              const val = parts[3];
              if (/^\d$/.test(val)) gate = parseInt(val, 10);
            }
            if (parts.length >= 5) {
              const val = parts[4];
              if (/\d+\.\d+/.test(val)) {
                time = val;
                if (!time.endsWith('s')) time += 's';
              }
            }
            results.push({
              plate,
              name,
              gate,
              position: pos,
              time
            });
          }
        }
      }
    }
    
    return {
      category,
      round,
      heatNumber,
      results
    };
  }
}

// 6. Gemini-powered unstructured file parsing!
// Process ugly raw outputs from local "SISTEMA BEM" text files or reports copy-pastas
app.post('/api/race/upload-bem-text', checkApiKey, async (req, res) => {
  const { textContent, parseType } = req.body;

  if (!textContent || !textContent.trim()) {
    return res.status(400).json({ error: "Conteúdo textual não fornecido." });
  }

  // Detect HTML BEM report and run fast local HTML parser
  const lowerText = textContent.toLowerCase();
  const isHtml = lowerText.includes('<table') || lowerText.includes('bmx event manager') || lowerText.includes('gridtable') || lowerText.includes('</html>') || lowerText.includes('<html');
  if (isHtml) {
    try {
      const parsedFullState = parseBemHtml(textContent);
      if (parsedFullState && (parsedFullState.categories.length > 0 || parsedFullState.riders.length > 0)) {
        // Enforce high-fidelity sync of the race state!
        currentRaceState = {
          eventName: parsedFullState.eventName,
          location: parsedFullState.location,
          date: parsedFullState.date,
          categories: parsedFullState.categories,
          riders: parsedFullState.riders,
          heats: parsedFullState.heats,
          live: parsedFullState.live
        };
        recalculateRankings();
        return res.json({
          success: true,
          type: 'FULL_HTML_REPORT',
          message: `Relatório exportado do BEM integrado com sucesso online! Carregado: "${parsedFullState.eventName}", ${parsedFullState.categories.length} categoria(s), ${parsedFullState.riders.length} piloto(s) e suas baterias/finais ranqueadas!`,
          data: currentRaceState
        });
      } else {
        return res.status(422).json({
          error: "Não conseguimos extrair nenhuma tabela ou dados válidos de pilotos e baterias deste HTML local do SISTEMA BEM. Por favor, verifique se selecionou o arquivo de exportação correto."
        });
      }
    } catch (parseHtmlErr: any) {
      console.error("Failed to parse native BEM HTML export locally:", parseHtmlErr);
      return res.status(400).json({
        error: "Erro de decodificação do HTML local do SISTEMA BEM: " + parseHtmlErr.message
      });
    }
  }

  let parsedData: any = null;
  let usedFallback = false;

  try {
    try {
      const ai = getGemini();

      const result = await ai.models.generateContent({
        model: 'gemini-3.5-flash',
        contents: `Você é um robô de integração para o SISTEMA BEM de BMX Racing (cronometragem de Bicicross).
Seu papel é analisar um texto bruto com relatórios ou tabelas copiadas do programa SISTEMA BEM e converter em um formato JSON estrito adequado.

O tipo de dados que você está analisando é do tipo: "${parseType}" (pode ser "RIDERS" para lista de inscritos, ou "RESULTS" para tabelas de resultados de baterias).

INTRUÇÕES DE MAPEAMENTO:
Se "RIDERS": extraia uma lista de ciclistas. Retorne um objeto com a chave "riders" que contém um array de objetos:
{
  "name": "Nome Completo do Piloto",
  "plate": "Número da Placa (ex: 22, 109, 31)",
  "category": "Mapear para uma destas mais parecidas: 'Elite Men', 'Elite Women', 'Junior Men', 'Cruiser 30-39'",
  "club": "Clube, Equipe ou Cidade (ex: Americana, Brusque, Sorocaba)"
}

Se "RESULTS": extraia uma lista com a classificação da bateria esportiva. Retorne um objeto com as chaves:
"category", "round" ("MOTO_1", "MOTO_2", "MOTO_3" ou "FINAL"), "heatNumber" (número da bateria, default 1) e uma lista no campo "results" de objetos com:
{
  "plate": "Número da placa de quem correu",
  "name": "Nome do piloto",
  "gate": "Raia/Gaiola em que largou (1 a 8 se existir, faça chute inteligente se omitido)",
  "position": "Colocação final de chegada (1 a 8)",
  "time": "Tempo de volta aproximado no texto ou chute compatível de BMX ex '32.145s'"
}

O texto a ser analisado é:
"""
${textContent}
"""

Retorne APENAS um JSON puro que atenda ao esquema acima. Não use markdown \`\`\`json ou qualquer explicação textual adicional.`,
        config: {
          responseMimeType: 'application/json',
        }
      });

      const parsedJsonText = result.text || '{}';
      parsedData = JSON.parse(parsedJsonText);
    } catch (apiErr: any) {
      console.warn("Gemini connection issue or 503 busy, falling back to local regex decoder:", apiErr.message);
      usedFallback = true;
      parsedData = fallbackParseBMXText(textContent, parseType);
    }

    // Integrates the parsed data straight into our global memory database!
    if (parsedData && parseType === 'RIDERS' && Array.isArray(parsedData.riders)) {
      const addedRiders: Rider[] = [];
      parsedData.riders.forEach((p: any, idx: number) => {
        const id = `extra_${Date.now()}_${idx}`;
        const newRider: Rider = {
          id,
          name: p.name,
          plate: p.plate ? String(p.plate) : String(idx + 100),
          category: p.category || 'Elite Men',
          club: p.club || 'Piloto Avulso',
          points: [0, 0, 0],
          totalPoints: 0,
          rank: 99,
          status: 'OK'
        };
        currentRaceState.riders.push(newRider);
        addedRiders.push(newRider);

        // Ensure category exists
        if (!currentRaceState.categories.includes(newRider.category)) {
          currentRaceState.categories.push(newRider.category);
        }
      });

      recalculateRankings();
      return res.json({
        success: true,
        type: 'RIDERS',
        message: usedFallback
          ? `${addedRiders.length} pilotos importados via Analisador de Segurança Local (Gemini de backup ativo devido à alta demanda!).`
          : `${addedRiders.length} pilotos importados do SISTEMA BEM com IA Gemini!`,
        data: addedRiders
      });
    } else if (parsedData && parseType === 'RESULTS' && Array.isArray(parsedData.results) && parsedData.results.length > 0) {
      // Find matching battery or create a new mock heat on-the-fly and finish it!
      const finalCategory = parsedData.category || 'Elite Men';
      const round: RaceRound = parsedData.round || 'MOTO_1';
      const heatNum = parsedData.heatNumber || 1;

      // Create heat entries
      const assignments: GateAssignment[] = parsedData.results.map((r: any) => {
        // Encontre ou crie piloto se não existir
        let rider = currentRaceState.riders.find(x => x.plate === String(r.plate) && x.category === finalCategory);
        if (!rider) {
          rider = {
            id: `indiv_${Date.now()}_${r.plate}`,
            name: r.name || `Piloto #${r.plate}`,
            plate: String(r.plate),
            category: finalCategory,
            club: 'Importado BEM',
            points: [0,0,0],
            totalPoints: 0,
            rank: 99,
            status: 'OK'
          };
          currentRaceState.riders.push(rider);
        }

        return {
          riderId: rider.id,
          riderName: rider.name,
          plate: rider.plate,
          gate: Number(r.gate) || 1,
          time: r.time || "33.500s",
          finishPosition: Number(r.position) || 1,
          motoPoints: Number(r.position) || 1
        };
      });

      // Insert or overwrite Heat
      const existingHeatIndex = currentRaceState.heats.findIndex(h => h.category === finalCategory && h.round === round && h.heatNumber === heatNum);
      const newHeat: Heat = {
        id: existingHeatIndex >= 0 ? currentRaceState.heats[existingHeatIndex].id : `heat_ai_${Date.now()}`,
        heatNumber: heatNum,
        category: finalCategory,
        round,
        status: 'FINISHED',
        winnerTime: assignments.find(a => a.finishPosition === 1)?.time || '32.100s',
        finishedAt: new Date().toISOString(),
        gateAssignments: assignments
      };

      if (existingHeatIndex >= 0) {
        currentRaceState.heats[existingHeatIndex] = newHeat;
      } else {
        currentRaceState.heats.push(newHeat);
      }

      // Ensure category exists
      if (!currentRaceState.categories.includes(finalCategory)) {
        currentRaceState.categories.push(finalCategory);
      }

      recalculateRankings();
      return res.json({
        success: true,
        type: 'RESULTS',
        message: usedFallback
          ? `Bateria (${round}) de ${finalCategory} importada com sucesso pelo decodificador de segurança local (IA ocupada)!`
          : `Bateria (${round}) de ${finalCategory} importada e ranqueada com sucesso via IA Gemini!`,
        data: newHeat
      });
    } else {
      return res.status(422).json({ error: "O decodificador local e a IA não identificaram pilotos válidos nesse texto. Certifique-se de carregar a amostra ou seguir o padrão de colagem." });
    }
  } catch (err: any) {
    console.error("Critical Parsing error:", err);
    res.status(500).json({ error: "Erro de processamento na importação: " + err.message });
  }
});

// START EXPRESS + VITE DEV / PRODUCTION FLOW
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

async function startServer() {
  // If we are not in web production, mount Vite development pipeline
  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    // Serve production static assets compiled inside /dist with robust fallback
    let distPath = path.join(process.cwd(), 'dist');
    if (!fs.existsSync(distPath) || !fs.existsSync(path.join(distPath, 'index.html'))) {
      distPath = __dirname;
    }
    
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      const indexPath = path.join(distPath, 'index.html');
      if (fs.existsSync(indexPath)) {
        res.sendFile(indexPath);
      } else {
        res.status(404).send(`[BMX-Live BEM Error] O arquivo index.html não foi encontrado na pasta compilada de produção (${distPath}). Por favor, certifique-se de que o build rodou.`);
      }
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[BMX-Live BEM Server] running on exclusive access port http://localhost:${PORT}`);
  });
}

startServer();
