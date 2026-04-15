import fs from "fs";
import path from "path";

const STATE_PATH = path.join(__dirname, "../data/state.json");
const SPACE_PATH = path.join(__dirname, "../data/space.json");

export type Slot = "full" | "am" | "pm";
export type Zone = "quiet" | "collab" | "phone-ok" | "direção" | "olisipo" | "central" | "standard";

export interface Desk {
  id: string;
  label: string;
  zone: Zone;
  features: string[];
  active: boolean;
  company?: string;
}

export type SubscriptionType = "monthly" | "daypass";

export interface Member {
  id: string;
  name: string;
  email: string;
  subscriptionType: SubscriptionType;
  subscriptionStart: string;   // YYYY-MM-DD
  subscriptionEnd?: string;    // YYYY-MM-DD, optional
  deskId?: string;             // permanent desk for monthly subscribers
  preferences: string[];
  createdAt: string;
}

export interface Booking {
  id: string;
  deskId: string;
  memberId: string;
  date: string; // YYYY-MM-DD
  slot: Slot;
  createdAt: string;
  cancelledAt: string | null;
}

export interface State {
  version: number;
  desks: Desk[];
  members: Member[];
  bookings: Booking[];
}

export interface GridCell {
  row: number;
  col: number;
  deskId: string;
}

export interface SpaceConfig {
  name: string;
  rows: number;
  cols: number;
  grid: GridCell[];
}

export function getState(): State {
  return JSON.parse(fs.readFileSync(STATE_PATH, "utf-8"));
}

export function saveState(state: State): void {
  fs.writeFileSync(STATE_PATH, JSON.stringify(state, null, 2));
}

export function getSpaceConfig(): SpaceConfig {
  return JSON.parse(fs.readFileSync(SPACE_PATH, "utf-8"));
}

export function ensureDataDir(): void {
  const dir = path.join(__dirname, "../data");
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}
