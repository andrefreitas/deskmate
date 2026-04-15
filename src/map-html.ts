import fs from "fs";
import path from "path";
import { getState, getSpaceConfig, Booking, Member } from "./storage";

function getBookingsForDate(bookings: Booking[], date: string) {
  return bookings.filter((b) => b.date === date && !b.cancelledAt);
}

function getMember(members: Member[], id: string) {
  return members.find((m) => m.id === id);
}

export function generateHtml(date: string): string {
  const state = getState();
  const space = getSpaceConfig();
  const bookings = getBookingsForDate(state.bookings, date);

  const grid: { deskId: string; row: number; col: number }[] = space.grid;

  const cells = grid.map(({ deskId, row, col }) => {
    const desk = state.desks.find((d) => d.id === deskId);
    if (!desk) return null;

    const deskBookings = bookings.filter((b) => b.deskId === deskId);
    const isFull =
      deskBookings.some((b) => b.slot === "full") ||
      (deskBookings.some((b) => b.slot === "am") && deskBookings.some((b) => b.slot === "pm"));

    let status: "free" | "full" | "am" | "pm" | "inactive" = "free";
    let occupantName = "";
    let subscriptionType: "monthly" | "daypass" | null = null;

    if (!desk.active) {
      status = "inactive";
    } else if (isFull) {
      status = "full";
      const b = deskBookings.find((b) => b.slot === "full") ?? deskBookings[0];
      const member = getMember(state.members, b.memberId);
      occupantName = member?.name.split(" ")[0] ?? "?";
      subscriptionType = member?.subscriptionType ?? null;
    } else if (deskBookings.some((b) => b.slot === "am")) {
      status = "am";
      const b = deskBookings.find((b) => b.slot === "am")!;
      const member = getMember(state.members, b.memberId);
      occupantName = member?.name.split(" ")[0] ?? "?";
      subscriptionType = member?.subscriptionType ?? null;
    } else if (deskBookings.some((b) => b.slot === "pm")) {
      status = "pm";
      const b = deskBookings.find((b) => b.slot === "pm")!;
      const member = getMember(state.members, b.memberId);
      occupantName = member?.name.split(" ")[0] ?? "?";
      subscriptionType = member?.subscriptionType ?? null;
    }

    const zoneIcon: Record<string, string> = {
      quiet: "🔇",
      collab: "💬",
      "phone-ok": "📞",
    };

    return { deskId, row, col, status, occupantName, subscriptionType, zone: desk.zone, features: desk.features, zoneIcon: zoneIcon[desk.zone] ?? "", company: desk.company ?? null };
  }).filter(Boolean);

  const occupied = bookings.length;
  const total = state.desks.filter((d) => d.active).length;

  const rows = space.rows;
  const cols = space.cols;

  // Build grid rows
  let gridCells = "";
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const cell = cells.find((cell) => cell!.row === r && cell!.col === c);
      if (!cell) {
        gridCells += `<div class="desk empty"></div>`;
        continue;
      }

      const statusLabel: Record<string, string> = {
        free: "Livre",
        full: cell.occupantName,
        am: `${cell.occupantName} (manhã)`,
        pm: `${cell.occupantName} (tarde)`,
        inactive: cell.zone === "direção" ? "Direção" : "N/D",
      };

      const subBadge = cell.subscriptionType
        ? `<div class="sub-badge ${cell.subscriptionType}">${cell.subscriptionType === "monthly" ? "Mensal" : "Day Pass"}</div>`
        : "";

      const companyBadge = cell.company
        ? `<div class="company-badge">${cell.company}</div>`
        : "";

      gridCells += `
        <div class="desk ${cell.status}" title="${cell.deskId} · ${cell.zone}${cell.features.length ? " · " + cell.features.join(", ") : ""}">
          <div class="desk-id">${cell.deskId}</div>
          ${companyBadge}
          <div class="desk-status">${statusLabel[cell.status]}</div>
          ${subBadge}
        </div>`;
    }
  }

  return `<!DOCTYPE html>
<html lang="pt">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Deskmate — ${space.name}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }

    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      background: #f0f2f5;
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 2rem;
    }

    header {
      text-align: center;
      margin-bottom: 2rem;
    }

    header h1 {
      font-size: 1.8rem;
      color: #1a1a2e;
    }

    header p {
      color: #666;
      margin-top: 0.25rem;
      font-size: 0.95rem;
    }

    .stats {
      display: flex;
      gap: 1.5rem;
      margin-bottom: 2rem;
    }

    .stat {
      background: white;
      border-radius: 12px;
      padding: 1rem 1.5rem;
      text-align: center;
      box-shadow: 0 1px 4px rgba(0,0,0,0.08);
      min-width: 100px;
    }

    .stat-value {
      font-size: 2rem;
      font-weight: 700;
      color: #1a1a2e;
    }

    .stat-label {
      font-size: 0.8rem;
      color: #888;
      margin-top: 0.2rem;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }

    .grid {
      display: grid;
      grid-template-columns: repeat(${cols}, 120px);
      grid-template-rows: repeat(${rows}, 120px);
      gap: 1rem;
    }

    .desk {
      border-radius: 14px;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 0.75rem;
      gap: 0.3rem;
      cursor: default;
      transition: transform 0.15s, box-shadow 0.15s;
      box-shadow: 0 2px 8px rgba(0,0,0,0.08);
    }

    .desk:hover:not(.empty) {
      transform: translateY(-3px);
      box-shadow: 0 6px 16px rgba(0,0,0,0.14);
    }

    .desk.empty { background: transparent; box-shadow: none; }

    .desk.free    { background: #d4edda; border: 2px solid #28a745; }
    .desk.full    { background: #f8d7da; border: 2px solid #dc3545; }
    .desk.am      { background: #fff3cd; border: 2px solid #ffc107; }
    .desk.pm      { background: #fff3cd; border: 2px solid #ffc107; }
    .desk.inactive{ background: #e9ecef; border: 2px solid #adb5bd; color: #adb5bd; }

    .desk-id {
      font-size: 0.75rem;
      font-weight: 700;
      letter-spacing: 0.05em;
      color: inherit;
      opacity: 0.6;
    }

    .desk-zone { font-size: 1.5rem; }

    .desk-status {
      font-size: 0.8rem;
      font-weight: 600;
      color: #333;
      text-align: center;
    }

    .desk.full .desk-status  { color: #842029; }
    .desk.free .desk-status  { color: #155724; }
    .desk.am .desk-status,
    .desk.pm .desk-status    { color: #664d03; }

    .company-badge {
      font-size: 0.65rem;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      color: #1a1a2e;
      opacity: 0.5;
    }

    .sub-badge {
      font-size: 0.62rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      padding: 1px 5px;
      border-radius: 4px;
      margin-top: 2px;
    }

    .sub-badge.monthly  { background: rgba(0,0,0,0.08); color: #555; }
    .sub-badge.daypass  { background: #d0e8ff; color: #0057a8; border: 1px solid #90c4f5; }

    .legend {
      display: flex;
      gap: 1.5rem;
      margin-top: 2rem;
      font-size: 0.85rem;
      color: #555;
    }

    .legend-item { display: flex; align-items: center; gap: 0.4rem; }

    .dot {
      width: 12px; height: 12px;
      border-radius: 3px;
      border: 2px solid;
    }

    .dot.free     { background: #d4edda; border-color: #28a745; }
    .dot.full     { background: #f8d7da; border-color: #dc3545; }
    .dot.half     { background: #fff3cd; border-color: #ffc107; }
    .dot.inactive { background: #e9ecef; border-color: #adb5bd; }
  </style>
</head>
<body>
  <header>
    <h1>${space.name}</h1>
    <p>${date}</p>
  </header>

  <div class="stats">
    <div class="stat">
      <div class="stat-value">${total - occupied}</div>
      <div class="stat-label">Livres</div>
    </div>
    <div class="stat">
      <div class="stat-value">${occupied}</div>
      <div class="stat-label">Ocupadas</div>
    </div>
    <div class="stat">
      <div class="stat-value">${total}</div>
      <div class="stat-label">Total</div>
    </div>
  </div>

  <div class="grid">
    ${gridCells}
  </div>

  <div class="legend">
    <div class="legend-item"><div class="dot free"></div> Livre</div>
    <div class="legend-item"><div class="dot full"></div> Ocupada</div>
    <div class="legend-item"><div class="dot half"></div> Meio-dia</div>
    <div class="legend-item"><div class="dot inactive"></div> Inativa</div>
  </div>
</body>
</html>`;
}

// CLI entry
if (require.main === module) {
  const date = process.argv[2] ?? new Date().toISOString().slice(0, 10);
  const html = generateHtml(date);
  const outPath = path.join(__dirname, "../data/map.html");
  fs.writeFileSync(outPath, html);
  console.log(outPath);
}
