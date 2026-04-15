import express from "express";
import { getState, getSpaceConfig } from "./storage";
import { getMonthlyOccupancy } from "./tools";

const app = express();
const PORT = 3000;

// ── API ───────────────────────────────────────────────────────────────────────

function computeMapData(date: string) {
  const state = getState();
  const space = getSpaceConfig();

  const dayBookings = state.bookings.filter((b) => b.date === date && !b.cancelledAt);
  const monthlyByDesk = getMonthlyOccupancy(date);

  const desks = space.grid.map(({ deskId, row, col }) => {
    const desk = state.desks.find((d) => d.id === deskId);
    if (!desk) return null;

    type SlotInfo = { name: string; subscriptionType: string | null; subscriptionStart: string | null; subscriptionEnd: string | null } | null;
    let amSlot: SlotInfo = null;
    let pmSlot: SlotInfo = null;
    let inactive = false;

    if (!desk.active) {
      inactive = true;
    } else {
      const deskBookings = dayBookings.filter((b) => b.deskId === deskId);
      const cancelled = state.bookings.find((b) => b.deskId === deskId && b.date === date && b.cancelledAt);

      const toSlotInfo = (memberId: string): SlotInfo => {
        const m = state.members.find((m) => m.id === memberId);
        return m ? { name: m.name, subscriptionType: m.subscriptionType, subscriptionStart: m.subscriptionStart ?? null, subscriptionEnd: m.subscriptionEnd ?? null } : null;
      };

      if (deskBookings.length > 0) {
        const fullB = deskBookings.find((b) => b.slot === "full");
        const amB = deskBookings.find((b) => b.slot === "am");
        const pmB = deskBookings.find((b) => b.slot === "pm");
        if (fullB) { amSlot = toSlotInfo(fullB.memberId); pmSlot = amSlot; }
        else { if (amB) amSlot = toSlotInfo(amB.memberId); if (pmB) pmSlot = toSlotInfo(pmB.memberId); }
      } else if (!cancelled && monthlyByDesk.has(deskId)) {
        const m = monthlyByDesk.get(deskId)!;
        amSlot = { name: m.name, subscriptionType: m.subscriptionType, subscriptionStart: m.subscriptionStart ?? null, subscriptionEnd: m.subscriptionEnd ?? null };
        pmSlot = amSlot;
      }
    }

    const isFull = amSlot !== null && pmSlot !== null && amSlot === pmSlot;
    const status = inactive ? "inactive" : isFull ? "full" : (amSlot && pmSlot) ? "split" : amSlot ? "am" : pmSlot ? "pm" : "free";

    return {
      deskId: desk.id,
      label: desk.label,
      row,
      col,
      status,
      am: amSlot,
      pm: pmSlot,
      zone: desk.zone,
      company: desk.company ?? null,
    };
  }).filter(Boolean);

  const activeDesks = state.desks.filter((d) => d.active).length;
  const occupied = desks.filter((d) => d!.status !== "free" && d!.status !== "inactive").length;

  return {
    spaceName: space.name,
    rows: space.rows,
    cols: space.cols,
    date,
    occupied,
    total: activeDesks,
    desks,
  };
}

app.get("/api/map/:date", (req, res) => {
  res.json(computeMapData(req.params.date));
});

// ── Frontend ──────────────────────────────────────────────────────────────────

app.get("/", (_req, res) => {
  res.send(HTML);
});

// ── Start ─────────────────────────────────────────────────────────────────────

app.listen(PORT, () => {
  console.log(`Deskmate running at http://localhost:${PORT}`);
});

// ── HTML ──────────────────────────────────────────────────────────────────────

const HTML = `<!DOCTYPE html>
<html lang="pt">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Deskmate</title>
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
      margin-bottom: 1.5rem;
    }

    header h1 { font-size: 1.8rem; color: #1a1a2e; }

    .date-nav {
      display: flex;
      align-items: center;
      gap: 1rem;
      margin-top: 0.75rem;
    }

    .date-nav button {
      background: white;
      border: 1px solid #ddd;
      border-radius: 8px;
      padding: 0.4rem 0.9rem;
      font-size: 1rem;
      cursor: pointer;
      transition: background 0.15s;
    }

    .date-nav button:hover { background: #e9ecef; }

    .date-nav input[type="date"] {
      border: 1px solid #ddd;
      border-radius: 8px;
      padding: 0.4rem 0.75rem;
      font-size: 0.95rem;
      background: white;
      cursor: pointer;
    }

    .stats {
      display: flex;
      gap: 1.5rem;
      margin-bottom: 2rem;
    }

    .stat {
      background: white;
      border-radius: 12px;
      padding: 0.9rem 1.4rem;
      text-align: center;
      box-shadow: 0 1px 4px rgba(0,0,0,0.08);
      min-width: 90px;
    }

    .stat-value { font-size: 1.8rem; font-weight: 700; color: #1a1a2e; }
    .stat-label { font-size: 0.75rem; color: #888; margin-top: 0.15rem; text-transform: uppercase; letter-spacing: 0.05em; }

    #grid {
      display: grid;
      gap: 0.85rem;
    }

    .desk {
      border-radius: 14px;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 0.6rem 0.4rem;
      gap: 0.2rem;
      box-shadow: 0 2px 8px rgba(0,0,0,0.08);
      transition: transform 0.15s, box-shadow 0.15s;
      width: 110px;
      height: 110px;
      cursor: default;
    }

    .desk:hover:not(.inactive) {
      transform: translateY(-3px);
      box-shadow: 0 6px 16px rgba(0,0,0,0.14);
    }

    .desk.free     { background: #d4edda; border: 2px solid #28a745; }
    .desk.full     { background: #f8d7da; border: 2px solid #dc3545; }
    .desk.am       { background: linear-gradient(to bottom, #f8d7da 50%, #d4edda 50%); border: 2px solid #ffc107; }
    .desk.pm       { background: linear-gradient(to bottom, #d4edda 50%, #f8d7da 50%); border: 2px solid #ffc107; }
    .desk.split    { background: #f8d7da; border: 2px solid #dc3545; }
    .desk.inactive { background: #e9ecef; border: 2px solid #adb5bd; color: #adb5bd; }

    .desk-id { font-size: 0.7rem; font-weight: 700; opacity: 0.5; letter-spacing: 0.04em; }
    .desk-slots { display: flex; flex-direction: column; width: 100%; flex: 1; }
    .desk-slot  { display: flex; flex-direction: column; align-items: center; justify-content: center; flex: 1; padding: 1px 4px; }
    .desk-slot + .desk-slot { border-top: 1px solid rgba(0,0,0,0.1); }
    .slot-period { font-size: 0.55rem; font-weight: 800; text-transform: uppercase; letter-spacing: 0.06em; opacity: 0.5; }
    .slot-name   { font-size: 0.75rem; font-weight: 600; text-align: center; max-width: 88px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .slot-name.occ  { color: #842029; }
    .slot-name.free { color: #155724; font-style: italic; opacity: 0.7; }
    .desk.inactive .slot-name { color: #6c757d; }

    .company-badge {
      font-size: 0.6rem;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      color: #1a1a2e;
      opacity: 0.45;
    }

    .sub-badge {
      font-size: 0.6rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      padding: 1px 5px;
      border-radius: 4px;
    }

    .sub-badge.monthly  { background: rgba(0,0,0,0.07); color: #555; }
    .sub-badge.daypass  { background: #d0e8ff; color: #0057a8; border: 1px solid #90c4f5; }
    .sub-badge.expiring { background: #fff3cd; color: #856404; border: 1px solid #ffc107; }
    .sub-badge.expired  { background: #f8d7da; color: #842029; border: 1px solid #dc3545; }

    .legend {
      display: flex;
      gap: 1.5rem;
      margin-top: 2rem;
      font-size: 0.82rem;
      color: #555;
    }

    .legend-item { display: flex; align-items: center; gap: 0.4rem; }
    .dot { width: 11px; height: 11px; border-radius: 3px; border: 2px solid; }
    .dot.free     { background: #d4edda; border-color: #28a745; }
    .dot.full     { background: #f8d7da; border-color: #dc3545; }
    .dot.half     { background: #fff3cd; border-color: #ffc107; }
    .dot.inactive { background: #e9ecef; border-color: #adb5bd; }

    .desk.selected { outline: 3px solid #4a6cf7; outline-offset: 2px; }

    /* ── Side panel ── */
    #panel {
      position: fixed;
      top: 0; right: 0;
      width: 300px;
      height: 100vh;
      background: white;
      box-shadow: -4px 0 24px rgba(0,0,0,0.12);
      display: flex;
      flex-direction: column;
      transform: translateX(100%);
      transition: transform 0.25s ease;
      z-index: 100;
    }

    #panel.open { transform: translateX(0); }

    #panel-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 1.25rem 1.25rem 1rem;
      border-bottom: 1px solid #eee;
    }

    #panel-header h2 { font-size: 1rem; color: #1a1a2e; }

    #panel-close {
      background: none;
      border: none;
      font-size: 1.3rem;
      cursor: pointer;
      color: #888;
      line-height: 1;
      padding: 0.2rem 0.4rem;
      border-radius: 6px;
    }

    #panel-close:hover { background: #f0f2f5; color: #333; }

    #panel-body {
      padding: 1.25rem;
      flex: 1;
      overflow-y: auto;
      display: flex;
      flex-direction: column;
      gap: 1.25rem;
    }

    .panel-section { display: flex; flex-direction: column; gap: 0.4rem; }

    .panel-label {
      font-size: 0.7rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      color: #aaa;
    }

    .panel-value {
      font-size: 0.95rem;
      font-weight: 500;
      color: #1a1a2e;
    }

    .panel-badge {
      display: inline-flex;
      align-self: flex-start;
      font-size: 0.75rem;
      font-weight: 700;
      padding: 3px 10px;
      border-radius: 6px;
    }

    .panel-badge.free     { background: #d4edda; color: #155724; }
    .panel-badge.full     { background: #f8d7da; color: #842029; }
    .panel-badge.am,
    .panel-badge.pm       { background: #fff3cd; color: #664d03; }
    .panel-badge.inactive { background: #e9ecef; color: #6c757d; }
    .panel-badge.monthly  { background: rgba(0,0,0,0.06); color: #444; }
    .panel-badge.daypass  { background: #d0e8ff; color: #0057a8; }
    .panel-badge.expiring { background: #fff3cd; color: #856404; }
    .panel-badge.expired  { background: #f8d7da; color: #842029; }

    .panel-divider { border: none; border-top: 1px solid #eee; margin: 0; }
  </style>
</head>
<body>
  <header>
    <h1 id="space-name">Deskmate</h1>
    <div class="date-nav">
      <button id="prev">&#8592;</button>
      <input type="date" id="date-picker" />
      <button id="next">&#8594;</button>
    </div>
  </header>

  <div class="stats">
    <div class="stat"><div class="stat-value" id="stat-free">-</div><div class="stat-label">Livres</div></div>
    <div class="stat"><div class="stat-value" id="stat-occ">-</div><div class="stat-label">Ocupadas</div></div>
    <div class="stat"><div class="stat-value" id="stat-total">-</div><div class="stat-label">Total</div></div>
  </div>

  <div id="grid"></div>

  <div class="legend">
    <div class="legend-item"><div class="dot free"></div> Livre</div>
    <div class="legend-item"><div class="dot full"></div> Ocupada</div>
    <div class="legend-item"><div class="dot half"></div> Meio-dia</div>
    <div class="legend-item"><div class="dot inactive"></div> Inativa</div>
  </div>

  <div id="panel">
    <div id="panel-header">
      <h2 id="panel-title">Secretária</h2>
      <button id="panel-close">&#x2715;</button>
    </div>
    <div id="panel-body"></div>
  </div>

  <script>
    let currentDate = new Date().toISOString().slice(0, 10);
    let selectedDeskId = null;
    let lastMapData = null;
    const picker = document.getElementById('date-picker');
    picker.value = currentDate;

    function offsetDate(date, days) {
      const d = new Date(date + 'T12:00:00');
      d.setDate(d.getDate() + days);
      return d.toISOString().slice(0, 10);
    }

    async function loadMap(date) {
      currentDate = date;
      picker.value = date;
      const res = await fetch('/api/map/' + date);
      lastMapData = await res.json();
      render(lastMapData);
    }

    function subBadgeClass(desk) {
      const today = new Date().toISOString().slice(0, 10);
      if (!desk.subscriptionType) return null;
      if (desk.subscriptionEnd) {
        const daysLeft = Math.ceil((new Date(desk.subscriptionEnd) - new Date(today)) / 86400000);
        if (daysLeft < 0) return 'expired';
        if (daysLeft <= 30) return 'expiring';
      }
      return desk.subscriptionType;
    }

    function render(data) {
      document.getElementById('space-name').textContent = data.spaceName;
      document.getElementById('stat-free').textContent = data.total - data.occupied;
      document.getElementById('stat-occ').textContent = data.occupied;
      document.getElementById('stat-total').textContent = data.total;

      const grid = document.getElementById('grid');
      grid.style.gridTemplateColumns = 'repeat(' + data.cols + ', 110px)';
      grid.style.gridTemplateRows = 'repeat(' + data.rows + ', 110px)';
      grid.innerHTML = '';

      const cells = {};
      for (const d of data.desks) cells[d.row + ',' + d.col] = d;

      for (let r = 0; r < data.rows; r++) {
        for (let c = 0; c < data.cols; c++) {
          const desk = cells[r + ',' + c];
          const el = document.createElement('div');

          if (!desk) {
            el.className = 'desk';
            el.style.visibility = 'hidden';
            grid.appendChild(el);
            continue;
          }

          el.className = 'desk ' + desk.status + (desk.deskId === selectedDeskId ? ' selected' : '');
          el.style.cursor = 'pointer';

          const companyLabel = desk.company
            ? '<div class="company-badge">' + desk.company + '</div>'
            : '';

          function slotHtml(slot, label) {
            if (!slot) return '<div class="desk-slot"><div class="slot-period">' + label + '</div><div class="slot-name free">Livre</div></div>';
            return '<div class="desk-slot"><div class="slot-period">' + label + '</div><div class="slot-name occ">' + slot.name.split(' ')[0] + '</div></div>';
          }

          let slotsHtml;
          if (desk.status === 'inactive') {
            slotsHtml = '<div class="desk-slots"><div class="desk-slot"><div class="slot-name">' + (desk.zone === 'direção' ? 'Direção' : 'N/D') + '</div></div></div>';
          } else if (desk.status === 'full') {
            slotsHtml = '<div class="desk-slots"><div class="desk-slot"><div class="slot-name occ">' + (desk.am ? desk.am.name.split(' ')[0] : '') + '</div></div></div>';
          } else {
            slotsHtml = '<div class="desk-slots">' + slotHtml(desk.am, 'Manhã') + slotHtml(desk.pm, 'Tarde') + '</div>';
          }

          el.innerHTML = '<div class="desk-id">' + desk.deskId + '</div>' + companyLabel + slotsHtml;

          el.addEventListener('click', () => openPanel(desk));
          grid.appendChild(el);
        }
      }

      // Refresh panel if open
      if (selectedDeskId) {
        const desk = Object.values(cells).find(d => d && d.deskId === selectedDeskId);
        if (desk) openPanel(desk); else closePanel();
      }
    }

    function slotSection(slot, label) {
      if (!slot) return \`
        <div class="panel-section">
          <span class="panel-label">\${label}</span>
          <span class="panel-badge free">Livre</span>
        </div>\`;

      const today = new Date().toISOString().slice(0, 10);
      let badgeClass = slot.subscriptionType || 'monthly';
      if (slot.subscriptionEnd) {
        const daysLeft = Math.ceil((new Date(slot.subscriptionEnd) - new Date(today)) / 86400000);
        if (daysLeft < 0) badgeClass = 'expired';
        else if (daysLeft <= 30) badgeClass = 'expiring';
      }
      const badgeText = { monthly: 'Mensal', daypass: 'Day Pass', expired: 'Expirado', expiring: 'A expirar' }[badgeClass] || badgeClass;
      const daysInfo = slot.subscriptionEnd ? (() => {
        const d = Math.ceil((new Date(slot.subscriptionEnd) - new Date(today)) / 86400000);
        return d >= 0 ? ' (' + d + ' dias)' : '';
      })() : '';

      return \`
        <div class="panel-section">
          <span class="panel-label">\${label}</span>
          <span class="panel-value">\${slot.name}</span>
          <span class="panel-badge \${badgeClass}">\${badgeText}</span>
          \${slot.subscriptionStart ? '<span style="font-size:0.75rem;color:#888">Início: ' + slot.subscriptionStart + '</span>' : ''}
          \${slot.subscriptionEnd ? '<span style="font-size:0.75rem;color:#888">Fim: ' + slot.subscriptionEnd + daysInfo + '</span>' : ''}
        </div>\`;
    }

    function openPanel(desk) {
      selectedDeskId = desk.deskId;

      document.querySelectorAll('.desk').forEach(el => el.classList.remove('selected'));
      document.querySelectorAll('.desk').forEach(el => {
        if (el.querySelector('.desk-id')?.textContent === desk.deskId) el.classList.add('selected');
      });

      const statusLabels = { free: 'Livre', full: 'Ocupada', am: 'Manhã ocupada', pm: 'Tarde ocupada', split: 'Manhã + Tarde', inactive: 'Inativa' };

      const companySection = desk.company ? \`
        <div class="panel-section">
          <span class="panel-label">Empresa</span>
          <span class="panel-value">\${desk.company}</span>
        </div>\` : '';

      let slotsHtml = '';
      if (desk.status === 'inactive') {
        slotsHtml = '';
      } else if (desk.status === 'full') {
        slotsHtml = '<hr class="panel-divider"/>' + slotSection(desk.am, 'Dia completo');
      } else {
        slotsHtml = '<hr class="panel-divider"/>' + slotSection(desk.am, 'Manhã') + slotSection(desk.pm, 'Tarde');
      }

      document.getElementById('panel-title').textContent = desk.label;
      document.getElementById('panel-body').innerHTML = \`
        <div class="panel-section">
          <span class="panel-label">Estado</span>
          <span class="panel-badge \${desk.status}">\${statusLabels[desk.status] || desk.status}</span>
        </div>
        \${companySection}
        \${slotsHtml}
      \`;

      document.getElementById('panel').classList.add('open');
    }

    function closePanel() {
      selectedDeskId = null;
      document.getElementById('panel').classList.remove('open');
      document.querySelectorAll('.desk.selected').forEach(el => el.classList.remove('selected'));
    }

    document.getElementById('panel-close').addEventListener('click', closePanel);
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closePanel(); });

    document.getElementById('prev').addEventListener('click', () => loadMap(offsetDate(currentDate, -1)));
    document.getElementById('next').addEventListener('click', () => loadMap(offsetDate(currentDate, +1)));
    picker.addEventListener('change', (e) => loadMap(e.target.value));

    loadMap(currentDate);
  </script>
</body>
</html>`;
