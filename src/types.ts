/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type RaceRound = 'MOTO_1' | 'MOTO_2' | 'MOTO_3' | 'SEMI' | 'FINAL';

export interface Rider {
  id: string;
  name: string;
  plate: string; // Número da Placa
  category: string; // Categoria (ex: Elite Men, Cruiser 30-34)
  club: string; // Clube/Cidade
  points: number[]; // Pontos em cada bateria classificatória (motos)
  totalPoints: number; // Soma dos pontos das motos (menor é melhor)
  rank: number; // Posição atual ou final
  status: 'OK' | 'DNS' | 'DNF' | 'DSQ';
}

export interface GateAssignment {
  riderId: string;
  riderName: string;
  plate: string;
  gate: number; // Gaiola/Raia (1-8)
  time?: string; // Tempo final (ex: "32.450")
  motoPoints?: number; // Pontificados nesta rodada (1-8)
  finishPosition?: number; // Posição de chegada (1-8)
}

export interface Heat {
  id: string;
  heatNumber: number; // Bateria 1, Bateria 2...
  category: string;
  round: RaceRound;
  gateAssignments: GateAssignment[];
  status: 'UPCOMING' | 'GATES_FULL' | 'RACING' | 'FINISHED';
  winnerTime?: string;
  finishedAt?: string;
}

export interface LiveState {
  activeHeatId: string | null;
  status: 'STANDBY' | 'GATE_READY' | 'ON_TRACK' | 'FINISHED';
  gateDroppedAt?: string | null;
  finishResults?: {
    riderId: string;
    gate: number;
    position: number;
    time: string;
  }[];
}

export interface RaceState {
  eventName: string;
  location: string;
  date: string;
  categories: string[];
  riders: Rider[];
  heats: Heat[];
  live: LiveState;
}
