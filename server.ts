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
  eventName: "Campeonato Brasileiro de BMX 2026",
  location: "Cuiaba / MS",
  date: "04 e 05 Julho de 2026",
  categories: ["Elite Men", "Elite Women", "Junior Men", "Cruiser 30-39"],
  riders: [
    // Elite Men
    { id: "em_1", name: "Renato Rezende", plate: "1", category: "Elite Men", club: "Curitiba BMX", points: [1, 1, 2], totalPoints: 4, rank: 1, status: "OK" },
    { id: "em_2", name: "Bruno Cogo", plate: "22", category: "Elite Men", club: "Americana Bicicross", points: [2, 2, 1], totalPoints: 5, rank: 2, status: "OK" },
    { id: "em_3", name: "Pedro Queiroz", plate: "45", category: "Elite Men", club: "Brusque BMX", points: [3, 4, 3], totalPoints: 10, rank: 3, status: "OK" },
    { id: "em_4", name: "Franklin Vasconcelos", plate: "109", category: "Elite Men", club: "SJC Bicicross", points: [4, 3, 4], totalPoints: 11, rank: 4, status: "OK" },
    { id: "em_5", name: "Guilherme Ribeiro", plate: "33", category: "Elite Men", club: "Sorocaba BMX Club", points: [5, 5, 5], totalPoints: 15, rank: 5, status: "OK" },
    { id: "em_6", name: "Lucas Moresco", plate: "87", category: "Elite Men", club: "Jaraguá do Sul", points: [6, 6, 6], totalPoints: 18, rank: 6, status: "OK" },
    { id: "em_7", name: "Gustavo Mesquita", plate: "50", category: "Elite Men", club: "Caraguatatuba", points: [7, 7, 7], totalPoints: 21, rank: 7, status: "OK" },
    { id: "em_8", name: "Ariel João", plate: "78", category: "Elite Men", club: "Balneário Camboriú", points: [8, 8, 8], totalPoints: 24, rank: 8, status: "OK" },

    // Elite Women
    { id: "ew_1", name: "Priscilla Carnaval", plate: "31", category: "Elite Women", club: "Sorocaba BMX Club", points: [1, 2, 1], totalPoints: 4, rank: 1, status: "OK" },
    { id: "ew_2", name: "Paola Reis", plate: "18", category: "Elite Women", club: "Salvador Bicicross", points: [2, 1, 2], totalPoints: 5, rank: 2, status: "OK" },
    { id: "ew_3", name: "Maitê Naves", plate: "5", category: "Elite Women", club: "Uberlândia BMX", points: [3, 3, 3], totalPoints: 9, rank: 3, status: "OK" },
    { id: "ew_4", name: "Letícia Martins", plate: "84", category: "Elite Women", club: "Betim Bicicross", points: [4, 4, 4], totalPoints: 12, rank: 4, status: "OK" },
    { id: "ew_5", name: "Ana Sofia", plate: "99", category: "Elite Women", club: "Pomerode SC", points: [5, 5, 5], totalPoints: 15, rank: 5, status: "OK" },
    { id: "ew_6", name: "Isabella Silveira", plate: "14", category: "Elite Women", club: "Joinville BMX", points: [6, 6, 6], totalPoints: 18, rank: 6, status: "OK" },

    // Junior Men
    { id: "jm_1", name: "Matheus Oliveira", plate: "210", category: "Junior Men", club: "Americana Bicicross", points: [1, 2, 1], totalPoints: 4, rank: 1, status: "OK" },
    { id: "jm_2", name: "Victor de Andrade", plate: "144", category: "Junior Men", club: "Leme BMX", points: [2, 1, 2], totalPoints: 5, rank: 2, status: "OK" },
    { id: "jm_3", name: "Kauê de Souza", plate: "112", category: "Junior Men", club: "Novo Hamburgo", points: [3, 3, 3], totalPoints: 9, rank: 3, status: "OK" },
    { id: "jm_4", name: "Felipe Ramos", plate: "155", category: "Junior Men", club: "Poços de Caldas", points: [4, 4, 4], totalPoints: 12, rank: 4, status: "OK" },

    // Cruiser 30-39
    { id: "cr_1", name: "Douglas Silva", plate: "400", category: "Cruiser 30-39", club: "Londrina BMX", points: [1, 1, 1], totalPoints: 3, rank: 1, status: "OK" },
    { id: "cr_2", name: "Alexandre Santos", plate: "323", category: "Cruiser 30-39", club: "Paulínia Racing", points: [2, 2, 2], totalPoints: 6, rank: 2, status: "OK" },
    { id: "cr_3", name: "Marcelo Albuquerque", plate: "354", category: "Cruiser 30-39", club: "Indaiatuba", points: [3, 3, 3], totalPoints: 9, rank: 3, status: "OK" },
    { id: "cr_4", name: "Rogerio de Lima", plate: "301", category: "Cruiser 30-39", club: "Caçapava BMX", points: [4, 4, 4], totalPoints: 12, rank: 4, status: "OK" }
  ],
  heats: [
    // Heats for Elite Men - MOTO 1
    {
      id: "heat_em_m1",
      heatNumber: 1,
      category: "Elite Men",
      round: "MOTO_1",
      status: "FINISHED",
      winnerTime: "31.954s",
      finishedAt: "2026-06-12T09:12:00Z",
      gateAssignments: [
        { riderId: "em_1", riderName: "Renato Rezende", plate: "1", gate: 1, time: "31.954s", motoPoints: 1, finishPosition: 1 },
        { riderId: "em_2", riderName: "Bruno Cogo", plate: "22", gate: 2, time: "32.124s", motoPoints: 2, finishPosition: 2 },
        { riderId: "em_3", riderName: "Pedro Queiroz", plate: "45", gate: 3, time: "32.890s", motoPoints: 3, finishPosition: 3 },
        { riderId: "em_4", riderName: "Franklin Vasconcelos", plate: "109", gate: 4, time: "33.210s", motoPoints: 4, finishPosition: 4 },
        { riderId: "em_5", riderName: "Guilherme Ribeiro", plate: "33", gate: 5, time: "33.910s", motoPoints: 5, finishPosition: 5 },
        { riderId: "em_6", riderName: "Lucas Moresco", plate: "87", gate: 6, time: "34.120s", motoPoints: 6, finishPosition: 6 },
        { riderId: "em_7", riderName: "Gustavo Mesquita", plate: "50", gate: 7, time: "34.887s", motoPoints: 7, finishPosition: 7 },
        { riderId: "em_8", riderName: "Ariel João", plate: "78", gate: 8, time: "35.250s", motoPoints: 8, finishPosition: 8 }
      ]
    },
    // Heats for Elite Men - MOTO 2
    {
      id: "heat_em_m2",
      heatNumber: 1,
      category: "Elite Men",
      round: "MOTO_2",
      status: "FINISHED",
      winnerTime: "31.840s",
      finishedAt: "2026-06-12T09:44:00Z",
      gateAssignments: [
        { riderId: "em_1", riderName: "Renato Rezende", plate: "1", gate: 3, time: "31.840s", motoPoints: 1, finishPosition: 1 },
        { riderId: "em_2", riderName: "Bruno Cogo", plate: "22", gate: 5, time: "32.010s", motoPoints: 2, finishPosition: 2 },
        { riderId: "em_4", riderName: "Franklin Vasconcelos", plate: "109", gate: 2, time: "32.880s", motoPoints: 3, finishPosition: 3 },
        { riderId: "em_3", riderName: "Pedro Queiroz", plate: "45", gate: 1, time: "33.150s", motoPoints: 4, finishPosition: 4 },
        { riderId: "em_5", riderName: "Guilherme Ribeiro", plate: "33", gate: 4, time: "33.620s", motoPoints: 5, finishPosition: 5 },
        { riderId: "em_6", riderName: "Lucas Moresco", plate: "87", gate: 8, time: "33.990s", motoPoints: 6, finishPosition: 6 },
        { riderId: "em_7", riderName: "Gustavo Mesquita", plate: "50", gate: 6, time: "34.502s", motoPoints: 7, finishPosition: 7 },
        { riderId: "em_8", riderName: "Ariel João", plate: "78", gate: 7, time: "35.340s", motoPoints: 8, finishPosition: 8 }
      ]
    },
    // Heats for Elite Men - MOTO 3
    {
      id: "heat_em_m3",
      heatNumber: 1,
      category: "Elite Men",
      round: "MOTO_3",
      status: "FINISHED",
      winnerTime: "31.620s",
      finishedAt: "2026-06-12T10:15:00Z",
      gateAssignments: [
        { riderId: "em_2", riderName: "Bruno Cogo", plate: "22", gate: 6, time: "31.620s", motoPoints: 1, finishPosition: 1 },
        { riderId: "em_1", riderName: "Renato Rezende", plate: "1", gate: 4, time: "31.902s", motoPoints: 2, finishPosition: 2 },
        { riderId: "em_3", riderName: "Pedro Queiroz", plate: "45", gate: 7, time: "32.610s", motoPoints: 3, finishPosition: 3 },
        { riderId: "em_4", riderName: "Franklin Vasconcelos", plate: "109", gate: 8, time: "32.950s", motoPoints: 4, finishPosition: 4 },
        { riderId: "em_5", riderName: "Guilherme Ribeiro", plate: "33", gate: 2, time: "33.450s", motoPoints: 5, finishPosition: 5 },
        { riderId: "em_6", riderName: "Lucas Moresco", plate: "87", gate: 1, time: "34.020s", motoPoints: 6, finishPosition: 6 },
        { riderId: "em_7", riderName: "Gustavo Mesquita", plate: "50", gate: 3, time: "34.401s", motoPoints: 7, finishPosition: 7 },
        { riderId: "em_8", riderName: "Ariel João", plate: "78", gate: 5, time: "35.100s", motoPoints: 8, finishPosition: 8 }
      ]
    },

    // Upcoming Elite Men FINAL
    {
      id: "heat_em_final",
      heatNumber: 1,
      category: "Elite Men",
      round: "FINAL",
      status: "UPCOMING",
      gateAssignments: [
        { riderId: "em_1", riderName: "Renato Rezende", plate: "1", gate: 1 },
        { riderId: "em_2", riderName: "Bruno Cogo", plate: "22", gate: 2 },
        { riderId: "em_3", riderName: "Pedro Queiroz", plate: "45", gate: 3 },
        { riderId: "em_4", riderName: "Franklin Vasconcelos", plate: "109", gate: 4 },
        { riderId: "em_5", riderName: "Guilherme Ribeiro", plate: "33", gate: 5 },
        { riderId: "em_6", riderName: "Lucas Moresco", plate: "87", gate: 6 },
        { riderId: "em_7", riderName: "Gustavo Mesquita", plate: "50", gate: 7 },
        { riderId: "em_8", riderName: "Ariel João", plate: "78", gate: 8 }
      ]
    },

    // Elite Women - MOTO 1
    {
      id: "heat_ew_m1",
      heatNumber: 1,
      category: "Elite Women",
      round: "MOTO_1",
      status: "FINISHED",
      winnerTime: "34.012s",
      finishedAt: "2026-06-12T09:20:00Z",
      gateAssignments: [
        { riderId: "ew_1", riderName: "Priscilla Carnaval", plate: "31", gate: 1, time: "34.012s", motoPoints: 1, finishPosition: 1 },
        { riderId: "ew_2", riderName: "Paola Reis", plate: "18", gate: 2, time: "34.520s", motoPoints: 2, finishPosition: 2 },
        { riderId: "ew_3", riderName: "Maitê Naves", plate: "5", gate: 3, time: "35.811s", motoPoints: 3, finishPosition: 3 },
        { riderId: "ew_4", riderName: "Letícia Martins", plate: "84", gate: 4, time: "36.250s", motoPoints: 4, finishPosition: 4 },
        { riderId: "ew_5", riderName: "Ana Sofia", plate: "99", gate: 5, time: "38.102s", motoPoints: 5, finishPosition: 5 },
        { riderId: "ew_6", riderName: "Isabella Silveira", plate: "14", gate: 6, time: "40.902s", motoPoints: 6, finishPosition: 6 }
      ]
    },
    // Elite Women - MOTO 2 (Active/Live currently ready)
    {
      id: "heat_ew_m2",
      heatNumber: 1,
      category: "Elite Women",
      round: "MOTO_2",
      status: "UPCOMING",
      gateAssignments: [
        { riderId: "ew_2", riderName: "Paola Reis", plate: "18", gate: 4 },
        { riderId: "ew_1", riderName: "Priscilla Carnaval", plate: "31", gate: 6 },
        { riderId: "ew_3", riderName: "Maitê Naves", plate: "5", gate: 2 },
        { riderId: "ew_4", riderName: "Letícia Martins", plate: "84", gate: 8 },
        { riderId: "ew_5", riderName: "Ana Sofia", plate: "99", gate: 1 },
        { riderId: "ew_6", riderName: "Isabella Silveira", plate: "14", gate: 3 }
      ]
    }
  ],
  live: {
    activeHeatId: "heat_ew_m2",
    status: "GATE_READY",
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

// Helper function to extract and parse BEM exported HTML tables directly, bypassing Gemini for flawless local processing
function parseBemHtml(html: string): any {
  const lower = html.toLowerCase();
  if (!lower.includes('<table') || !lower.includes('<td')) {
    return null;
  }

  // Event Name
  let eventName = "";
  const h1Match = html.match(/<H1[^>]*>([\s\S]*?)<\/H1>/i);
  if (h1Match) {
    eventName = h1Match[1].replace(/<[^>]*>/g, '').trim();
  }
  const h2Match = html.match(/<H2[^>]*>([\s\S]*?)<\/H2>/i);
  if (h2Match) {
    eventName += (eventName ? " - " : "") + h2Match[1].replace(/<[^>]*>/g, '').trim();
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

  // Match all tables
  const tableRegex = /<table[^>]*>([\s\S]*?)<\/table>/gi;
  let tableMatch;

  while ((tableMatch = tableRegex.exec(html)) !== null) {
    const tableContent = tableMatch[1];
    
    // Caption containing category
    const captionMatch = tableContent.match(/<caption[^>]*>([\s\S]*?)<\/caption>/i);
    if (!captionMatch) continue;

    const rawCategory = captionMatch[1].replace(/<[^>]*>/g, '').trim();
    const category = rawCategory.replace(/\s*\(\d+\s*Riders\)/i, '').trim();
    if (!category) continue;

    if (!categoriesList.includes(category)) {
      categoriesList.push(category);
    }

    // Capture each row inside the tbody or table
    const trRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
    let trMatch;

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

    while ((trMatch = trRegex.exec(tableContent)) !== null) {
      const rowContent = trMatch[1];
      if (rowContent.toLowerCase().includes('<th')) continue; // Skip headers

      // Parse TD columns
      const tdRegex = /<td[^>]*>([\s\S]*?)<\/td>/gi;
      let tdMatch;
      const tds: string[] = [];
      while ((tdMatch = tdRegex.exec(rowContent)) !== null) {
        tds.push(tdMatch[1]);
      }

      if (tds.length < 3) continue; // Invalid row

      // Column 0: Plate
      const plate = tds[0].replace(/<[^>]*>/g, '').trim();
      if (!plate) continue;

      // Column 1: Country / Club
      const club = tds[1].replace(/<[^>]*>/g, '').trim();

      // Column 2: Name
      // Extract from span style 125% or just general text
      let name = tds[2].replace(/<span[^>]*>([\s\S]*?)<\/span>/i, '$1');
      name = name.replace(/<[^>]*>/g, ' ').trim();
      // Remove license small text like (100 637 693 96)
      name = name.replace(/\s*\(\s*\d[\d\s]*\)\s*/g, '').trim();
      name = name.replace(/\s+/g, ' ').trim();

      // Column 3: Final (e.g. <b>1st</b><BR>38.403<BR>{2.530})
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

      // Column 5: M-PTS Total
      let totalPoints = 0;
      if (tds[5]) {
        const val = parseInt(tds[5].replace(/<[^>]*>/g, '').trim(), 10);
        if (!isNaN(val)) totalPoints = val;
      }

      // Parse Motos Helper
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

    // Now set accurate rank
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
  const lines = textContent.split('\n');
  
  if (parseType === 'RIDERS') {
    const riders: any[] = [];
    let currentCategory = 'Elite Men';
    
    for (let line of lines) {
      line = line.trim();
      if (!line) continue;
      
      // Look for Category headers
      const catMatch = line.match(/(?:CATEGORIA|CATEGORY|CLASS):\s*([^\n\|-]+)/i);
      if (catMatch) {
        currentCategory = catMatch[1].trim();
        continue;
      }
      
      // Look for rider lines e.g.: "1. #22 Bruno Cogo - Americana Bicicross (SP)"
      // Or "1 | 22 | Bruno Cogo | Americana"
      const riderMatch = line.match(/(?:(\d+)\.?\s*)?#?(\d+)\s+([^-\|]+)\s*[-\|]?\s*([^\n]+)?/i);
      
      if (riderMatch) {
        const plate = riderMatch[2].trim();
        const name = riderMatch[3].trim();
        const club = riderMatch[4] ? riderMatch[4].trim() : 'Clube Individual';
        
        if (plate && isNaN(Number(plate)) === false && name.length > 2) {
          riders.push({
            name,
            plate,
            category: currentCategory,
            club
          });
        }
      } else {
        const parts = line.split('|').map(p => p.trim());
        if (parts.length >= 2) {
          const name = parts[0];
          const plate = parts[1].replace('#', '');
          const club = parts[2] || 'Clube Individual';
          if (name.length > 2 && isNaN(Number(plate)) === false) {
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
      }
      
      const roundMatch = line.match(/(?:ROUND|RODADA|FASE):\s*([A-Za-z0-0_]+)/i);
      if (roundMatch) {
        const val = roundMatch[1].trim().toUpperCase();
        if (val.includes('MOTO_1') || val.includes('MOTO1')) round = 'MOTO_1';
        else if (val.includes('MOTO_2') || val.includes('MOTO2')) round = 'MOTO_2';
        else if (val.includes('MOTO_3') || val.includes('MOTO3')) round = 'MOTO_3';
        else if (val.includes('SEMI')) round = 'SEMI';
        else if (val.includes('FINAL')) round = 'FINAL';
      } else {
        if (line.toUpperCase().includes('MOTO_1') || line.toUpperCase().includes('MOTO 1')) round = 'MOTO_1';
        if (line.toUpperCase().includes('MOTO_2') || line.toUpperCase().includes('MOTO 2')) round = 'MOTO_2';
        if (line.toUpperCase().includes('MOTO_3') || line.toUpperCase().includes('MOTO 3')) round = 'MOTO_3';
        if (line.toUpperCase().includes('FINAL')) round = 'FINAL';
        if (line.toUpperCase().includes('SEMI')) round = 'SEMI';
      }
      
      const heatMatch = line.match(/(?:BAT|BATERIA|HEAT):\s*(\d+)/i);
      if (heatMatch) {
        heatNumber = parseInt(heatMatch[1], 10);
      }
      
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
          
          if (!isNaN(pos) && plate && isNaN(Number(plate)) === false) {
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
        const rMatch = line.match(/^(\d+)[\|\s]+([#\d]+)[\|\s]+([A-Za-zÀ-ÖØ-öø-ÿ\s]+?)[\|\s]+(\d+)?(?:[\|\s]+([0-9\:\.s]+))?$/i);
        if (rMatch) {
          const pos = parseInt(rMatch[1], 10);
          const plate = rMatch[2].replace('#', '').trim();
          const name = rMatch[3].trim();
          const gate = rMatch[4] ? parseInt(rMatch[4], 10) : 1;
          const time = rMatch[5] || '33.000s';
          
          if (!isNaN(pos) && plate && isNaN(Number(plate)) === false) {
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
  if (lowerText.includes('<table') || lowerText.includes('bmx event manager') || lowerText.includes('gridtable')) {
    try {
      const parsedFullState = parseBemHtml(textContent);
      if (parsedFullState && parsedFullState.categories.length > 0) {
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
      }
    } catch (parseHtmlErr: any) {
      console.error("Failed to parse native BEM HTML export locally:", parseHtmlErr);
      // Let it fall back to standard text parses if any
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
