import fs from "fs";
import path from "path";
import { ensureDataDir, State, SpaceConfig } from "./storage";

ensureDataDir();

const today = new Date().toISOString().slice(0, 10);
const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);

const state: State = {
  version: 1,
  desks: [
    { id: "D01", label: "Desk 1", zone: "quiet", features: ["monitor"], active: true },
    { id: "D02", label: "Desk 2", zone: "quiet", features: ["monitor", "standing"], active: true },
    { id: "D03", label: "Desk 3", zone: "collab", features: [], active: true },
    { id: "D04", label: "Desk 4", zone: "collab", features: ["monitor"], active: true },
    { id: "D05", label: "Desk 5", zone: "quiet", features: ["near-window"], active: true },
    { id: "D06", label: "Desk 6", zone: "phone-ok", features: ["monitor", "near-window"], active: true },
    { id: "D07", label: "Desk 7", zone: "phone-ok", features: [], active: true },
    { id: "D08", label: "Desk 8", zone: "collab", features: ["standing"], active: true },
    { id: "D09", label: "Desk 9", zone: "quiet", features: ["monitor"], active: true },
    { id: "D10", label: "Desk 10", zone: "quiet", features: [], active: true },
    { id: "D11", label: "Desk 11", zone: "collab", features: ["monitor"], active: true },
    { id: "D12", label: "Desk 12", zone: "phone-ok", features: ["standing", "monitor"], active: true },
  ],
  members: [
    { id: "M01", name: "Ana Silva", email: "ana@example.com", preferences: ["quiet", "monitor"], createdAt: today },
    { id: "M02", name: "Bob Costa", email: "bob@example.com", preferences: ["collab"], createdAt: today },
    { id: "M03", name: "Carla Nunes", email: "carla@example.com", preferences: ["standing", "near-window"], createdAt: today },
    { id: "M04", name: "David Lopes", email: "david@example.com", preferences: ["phone-ok"], createdAt: today },
    { id: "M05", name: "Eva Moura", email: "eva@example.com", preferences: ["quiet", "near-window"], createdAt: today },
  ],
  bookings: [
    { id: "B001", deskId: "D01", memberId: "M01", date: today, slot: "full", createdAt: today, cancelledAt: null },
    { id: "B002", deskId: "D03", memberId: "M02", date: today, slot: "full", createdAt: today, cancelledAt: null },
    { id: "B003", deskId: "D06", memberId: "M04", date: today, slot: "am", createdAt: today, cancelledAt: null },
    { id: "B004", deskId: "D09", memberId: "M03", date: tomorrow, slot: "full", createdAt: today, cancelledAt: null },
  ],
};

const spaceConfig: SpaceConfig = {
  name: "Deskmate HQ",
  rows: 3,
  cols: 4,
  grid: [
    { row: 0, col: 0, deskId: "D01" },
    { row: 0, col: 1, deskId: "D02" },
    { row: 0, col: 2, deskId: "D03" },
    { row: 0, col: 3, deskId: "D04" },
    { row: 1, col: 0, deskId: "D05" },
    { row: 1, col: 1, deskId: "D06" },
    { row: 1, col: 2, deskId: "D07" },
    { row: 1, col: 3, deskId: "D08" },
    { row: 2, col: 0, deskId: "D09" },
    { row: 2, col: 1, deskId: "D10" },
    { row: 2, col: 2, deskId: "D11" },
    { row: 2, col: 3, deskId: "D12" },
  ],
};

const dataDir = path.join(__dirname, "../data");
fs.writeFileSync(path.join(dataDir, "state.json"), JSON.stringify(state, null, 2));
fs.writeFileSync(path.join(dataDir, "space.json"), JSON.stringify(spaceConfig, null, 2));

console.log("Seeded data/state.json and data/space.json");
console.log(`  ${state.desks.length} desks, ${state.members.length} members, ${state.bookings.length} bookings`);
