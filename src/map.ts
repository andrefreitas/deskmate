import chalk from "chalk";
import { getState, getSpaceConfig, Booking, Desk, Member } from "./storage";

function getBookingsForDate(bookings: Booking[], date: string): Booking[] {
  return bookings.filter((b) => b.date === date && !b.cancelledAt);
}

function getMemberName(members: Member[], memberId: string): string {
  const m = members.find((m) => m.id === memberId);
  return m ? m.name.split(" ")[0] : "?";
}

function slotLabel(slot: string): string {
  if (slot === "am") return "AM ";
  if (slot === "pm") return " PM";
  return "ALL";
}

function renderDeskCell(
  desk: Desk,
  bookings: Booking[],
  members: Member[]
): string[] {
  const deskBookings = bookings.filter((b) => b.deskId === desk.id);

  if (!desk.active) {
    return [
      chalk.dim("┌─────┐"),
      chalk.dim(`│${desk.id.padEnd(5)}│`),
      chalk.dim("│ N/A │"),
      chalk.dim("└─────┘"),
    ];
  }

  if (deskBookings.length === 0) {
    return [
      chalk.green("┌─────┐"),
      chalk.green(`│${desk.id.padEnd(5)}│`),
      chalk.green("│FREE │"),
      chalk.green("└─────┘"),
    ];
  }

  // Multiple bookings (AM + PM)
  if (deskBookings.length >= 2) {
    const amB = deskBookings.find((b) => b.slot === "am");
    const pmB = deskBookings.find((b) => b.slot === "pm");
    const amName = amB ? getMemberName(members, amB.memberId).slice(0, 3) : "---";
    const pmName = pmB ? getMemberName(members, pmB.memberId).slice(0, 3) : "---";
    return [
      chalk.yellow("┌─────┐"),
      chalk.yellow(`│${desk.id.padEnd(5)}│`),
      chalk.yellow(`│${amName.padEnd(3)}/${pmName.padStart(3).slice(0,3)}│`),
      chalk.yellow("└─────┘"),
    ];
  }

  const booking = deskBookings[0];
  const name = getMemberName(members, booking.memberId).slice(0, 5).padEnd(5);
  const slot = slotLabel(booking.slot);

  if (booking.slot === "full") {
    return [
      chalk.red("┌─────┐"),
      chalk.red(`│${desk.id.padEnd(5)}│`),
      chalk.red(`│${name}│`),
      chalk.red("└─────┘"),
    ];
  }

  // AM or PM only — yellow
  return [
    chalk.yellow("┌─────┐"),
    chalk.yellow(`│${desk.id.padEnd(5)}│`),
    chalk.yellow(`│${slot}  │`),
    chalk.yellow("└─────┘"),
  ];
}

export function renderMap(date: string): void {
  const state = getState();
  const space = getSpaceConfig();
  const bookings = getBookingsForDate(state.bookings, date);

  // Build grid
  const grid: (string[] | null)[][] = Array.from({ length: space.rows }, () =>
    Array(space.cols).fill(null)
  );

  for (const cell of space.grid) {
    const desk = state.desks.find((d) => d.id === cell.deskId);
    if (desk) {
      grid[cell.row][cell.col] = renderDeskCell(desk, bookings, state.members);
    }
  }

  // Header
  const occupied = bookings.filter((b) => b.deskId).length;
  const total = state.desks.filter((d) => d.active).length;
  console.log(chalk.bold(`\n  ${space.name} — ${date}`));
  console.log(chalk.gray(`  ${occupied} occupied / ${total} desks\n`));

  // Legend
  console.log(
    `  ${chalk.green("■")} free  ${chalk.red("■")} full  ${chalk.yellow("■")} half-day  ${chalk.dim("■")} inactive\n`
  );

  // Render rows
  for (let r = 0; r < space.rows; r++) {
    const rowLines = ["  ", "  ", "  ", "  "];
    for (let c = 0; c < space.cols; c++) {
      const cell = grid[r][c];
      if (cell) {
        for (let line = 0; line < 4; line++) {
          rowLines[line] += cell[line] + "  ";
        }
      } else {
        for (let line = 0; line < 4; line++) {
          rowLines[line] += "         ";
        }
      }
    }
    console.log(rowLines.join("\n"));
    console.log();
  }
}

// Allow running standalone: ts-node src/map.ts [date]
if (require.main === module) {
  const date = process.argv[2] ?? new Date().toISOString().slice(0, 10);
  renderMap(date);
}
