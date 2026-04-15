import fs from "fs";
import path from "path";
import { ensureDataDir, State, SpaceConfig } from "./storage";

ensureDataDir();

const today = new Date().toISOString().slice(0, 10);

// ── Desks ────────────────────────────────────────────────────────────────────
// Layout from image (row 0 = top, cols left→right):
// Row 0: 25(DIREÇÃO), 20, 19, 14, 13, 7,  8,  2,  1
// Row 1: 26,          22, 21, 16, 15, 10, 9,  4,  3
// Row 2: 27,          24, 23, 18, 17, 12, 11, 6,  5

const allDeskIds = [
  1, 2, 3, 4, 5, 6, 7, 8, 9, 10,
  11, 12, 13, 14, 15, 16, 17, 18, 19, 20,
  21, 22, 23, 24, 25, 26, 27,
];

// Zone groupings based on vertical separators in image
function getZone(n: number): "direção" | "olisipo" | "central" | "standard" {
  if (n === 25) return "direção";
  if (n <= 6) return "olisipo";     // cols 7-8: desks 1-6
  if (n <= 12) return "central";    // cols 5-6: desks 7-12
  return "standard";                // cols 1-4: desks 13-24, 26-27
}

const olisipoDesks = new Set([1, 2, 3, 6]);

const desks = allDeskIds.map((n) => ({
  id: `D${String(n).padStart(2, "0")}`,
  label: n === 25 ? "Direção" : `Desk ${n}`,
  zone: getZone(n),
  features: [] as string[],
  active: n !== 25,
  ...(olisipoDesks.has(n) ? { company: "OLISIPO" } : {}),
}));

// ── Members ──────────────────────────────────────────────────────────────────
const memberData: { name: string; email: string; subscriptionType: "monthly" | "daypass"; deskId?: string }[] = [
  { name: "Fabiana",        email: "", subscriptionType: "monthly", deskId: "D01" },
  { name: "Diogo",          email: "", subscriptionType: "monthly", deskId: "D02" },
  { name: "Joana",          email: "", subscriptionType: "monthly", deskId: "D03" },
  { name: "Claudia",        email: "", subscriptionType: "monthly", deskId: "D06" },
  { name: "Munique",        email: "", subscriptionType: "monthly", deskId: "D07" },
  { name: "Winnie",         email: "", subscriptionType: "monthly", deskId: "D08" },
  { name: "Lian",           email: "", subscriptionType: "monthly", deskId: "D10" },
  { name: "Dan Philips",    email: "", subscriptionType: "monthly", deskId: "D11" },
  { name: "Golan",          email: "", subscriptionType: "monthly", deskId: "D12" },
  { name: "Mariana",        email: "", subscriptionType: "monthly", deskId: "D13" },
  { name: "Bruno",          email: "", subscriptionType: "monthly", deskId: "D14" },
  { name: "Dominik",        email: "", subscriptionType: "monthly", deskId: "D15" },
  { name: "Ivan",           email: "", subscriptionType: "monthly", deskId: "D16" },
  { name: "Valeria Yulia",  email: "", subscriptionType: "monthly", deskId: "D19" },
  { name: "David",          email: "", subscriptionType: "monthly", deskId: "D20" },
  { name: "Rui Silva",      email: "", subscriptionType: "monthly", deskId: "D21" },
  { name: "Pedro Monteiro", email: "", subscriptionType: "monthly", deskId: "D22" },
  { name: "Daniel",         email: "", subscriptionType: "monthly", deskId: "D26" },
  { name: "Willy",          email: "", subscriptionType: "monthly" }, // sem secretária
];

const members = memberData.map((m, i) => ({
  id: `M${String(i + 1).padStart(2, "0")}`,
  name: m.name,
  email: m.email,
  subscriptionType: m.subscriptionType,
  subscriptionStart: "2026-01-01",
  ...(m.deskId ? { deskId: m.deskId } : {}),
  preferences: [] as string[],
  createdAt: today,
}));

function memberId(name: string) {
  const m = members.find((m) => m.name === name);
  if (!m) throw new Error(`Member not found: ${name}`);
  return m.id;
}

function deskId(n: number) {
  return `D${String(n).padStart(2, "0")}`;
}

// ── Bookings — occupied desks from the image (full day) ──────────────────────
const occupiedDesks: [number, string][] = [
  [1,  "Fabiana"],
  [2,  "Diogo"],
  [3,  "Joana"],
  [6,  "Claudia"],
  [7,  "Munique"],
  [8,  "Winnie"],
  [10, "Lian"],
  [11, "Dan Philips"],
  [12, "Golan"],
  [13, "Mariana"],
  [14, "Bruno"],
  [15, "Dominik"],
  [16, "Ivan"],
  [19, "Valeria Yulia"],
  [20, "David"],
  [21, "Rui Silva"],
  [22, "Pedro Monteiro"],
  [26, "Daniel"],
  // Desk 25 (Direção) — reserved, no named member booking
];

const bookings = occupiedDesks.map(([n, name], i) => ({
  id: `B${String(i + 1).padStart(3, "0")}`,
  deskId: deskId(n),
  memberId: memberId(name),
  date: today,
  slot: "full" as const,
  createdAt: today,
  cancelledAt: null,
}));

const state: State = { version: 1, desks, members, bookings };

// ── Space layout ─────────────────────────────────────────────────────────────
// Grid: 3 rows × 9 cols
const gridLayout: [number, number, number][] = [
  // [row, col, deskNumber]
  // Row 0 (top)
  [0, 0, 25], [0, 1, 20], [0, 2, 19], [0, 3, 14], [0, 4, 13],
  [0, 5,  7], [0, 6,  8], [0, 7,  2], [0, 8,  1],
  // Row 1 (middle)
  [1, 0, 26], [1, 1, 22], [1, 2, 21], [1, 3, 16], [1, 4, 15],
  [1, 5, 10], [1, 6,  9], [1, 7,  4], [1, 8,  3],
  // Row 2 (bottom)
  [2, 0, 27], [2, 1, 24], [2, 2, 23], [2, 3, 18], [2, 4, 17],
  [2, 5, 12], [2, 6, 11], [2, 7,  6], [2, 8,  5],
];

const spaceConfig: SpaceConfig = {
  name: "Cowork 4400",
  rows: 3,
  cols: 9,
  grid: gridLayout.map(([row, col, n]) => ({
    row,
    col,
    deskId: deskId(n),
  })),
};

const dataDir = path.join(__dirname, "../data");
fs.writeFileSync(path.join(dataDir, "state.json"), JSON.stringify(state, null, 2));
fs.writeFileSync(path.join(dataDir, "space.json"), JSON.stringify(spaceConfig, null, 2));

console.log(`Seeded Cowork 4400:`);
console.log(`  ${state.desks.length} desks, ${state.members.length} members, ${state.bookings.length} bookings today`);
console.log(`  Free desks: ${state.desks.length - bookings.length - 1} (+ Direção reserved)`);
console.log(`  Willy has no desk assigned`);
