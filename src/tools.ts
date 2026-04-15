import { getState, saveState, Booking, Slot } from "./storage";

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function newId(prefix: string, existing: { id: string }[]): string {
  const nums = existing
    .map((e) => parseInt(e.id.replace(prefix, ""), 10))
    .filter((n) => !isNaN(n));
  const next = nums.length > 0 ? Math.max(...nums) + 1 : 1;
  return `${prefix}${String(next).padStart(3, "0")}`;
}

// ─── list_desks ──────────────────────────────────────────────────────────────

export function list_desks({ date }: { date?: string }) {
  const d = date ?? today();
  const state = getState();
  const activeBookings = state.bookings.filter(
    (b) => b.date === d && !b.cancelledAt
  );

  return state.desks
    .filter((desk) => desk.active)
    .map((desk) => {
      const bookings = activeBookings.filter((b) => b.deskId === desk.id);
      const bookedSlots = bookings.map((b) => b.slot);
      const isFull =
        bookedSlots.includes("full") ||
        (bookedSlots.includes("am") && bookedSlots.includes("pm"));

      const member = bookings.length
        ? state.members.find((m) => m.id === bookings[0].memberId)
        : null;

      return {
        id: desk.id,
        label: desk.label,
        zone: desk.zone,
        features: desk.features,
        available: !isFull,
        bookedSlots,
        bookedBy: member?.name ?? null,
      };
    });
}

// ─── book_desk ───────────────────────────────────────────────────────────────

export function book_desk({
  deskId,
  memberId,
  date,
  slot,
}: {
  deskId: string;
  memberId: string;
  date?: string;
  slot?: Slot;
}) {
  const d = date ?? today();
  const s: Slot = slot ?? "full";
  const state = getState();

  const desk = state.desks.find((x) => x.id === deskId);
  if (!desk) return { error: `Desk ${deskId} not found.` };
  if (!desk.active) return { error: `Desk ${deskId} is not active.` };

  const member = state.members.find((x) => x.id === memberId);
  if (!member) return { error: `Member ${memberId} not found.` };

  // Conflict check
  const existing = state.bookings.filter(
    (b) => b.deskId === deskId && b.date === d && !b.cancelledAt
  );

  const conflicts = existing.filter((b) => {
    if (s === "full") return true;
    if (b.slot === "full") return true;
    return b.slot === s;
  });

  if (conflicts.length > 0) {
    return {
      error: `Desk ${deskId} is already booked for ${conflicts[0].slot === "full" ? "the full day" : conflicts[0].slot.toUpperCase()} on ${d}.`,
    };
  }

  const booking: Booking = {
    id: newId("B", state.bookings),
    deskId,
    memberId,
    date: d,
    slot: s,
    createdAt: new Date().toISOString(),
    cancelledAt: null,
  };

  state.bookings.push(booking);
  saveState(state);

  return {
    success: true,
    booking: {
      id: booking.id,
      desk: desk.label,
      member: member.name,
      date: d,
      slot: s,
    },
  };
}

// ─── cancel_booking ──────────────────────────────────────────────────────────

export function cancel_booking({
  bookingId,
  deskId,
  date,
}: {
  bookingId?: string;
  deskId?: string;
  date?: string;
}) {
  const state = getState();

  let booking: Booking | undefined;

  if (bookingId) {
    booking = state.bookings.find((b) => b.id === bookingId);
  } else if (deskId && date) {
    booking = state.bookings.find(
      (b) => b.deskId === deskId && b.date === date && !b.cancelledAt
    );
  }

  if (!booking) return { error: "Booking not found." };
  if (booking.cancelledAt) return { error: "Booking is already cancelled." };

  booking.cancelledAt = new Date().toISOString();
  saveState(state);

  const desk = state.desks.find((d) => d.id === booking!.deskId);
  const member = state.members.find((m) => m.id === booking!.memberId);

  return {
    success: true,
    cancelled: {
      id: booking.id,
      desk: desk?.label ?? booking.deskId,
      member: member?.name ?? booking.memberId,
      date: booking.date,
      slot: booking.slot,
    },
  };
}

// ─── get_member ──────────────────────────────────────────────────────────────

export function get_member({ query }: { query: string }) {
  const state = getState();
  const q = query.toLowerCase();
  const member = state.members.find(
    (m) => m.id.toLowerCase() === q || m.name.toLowerCase().includes(q)
  );
  if (!member) return { error: `No member found matching "${query}".` };
  return member;
}

// ─── list_bookings ───────────────────────────────────────────────────────────

export function list_bookings({
  memberId,
  startDate,
  endDate,
}: {
  memberId?: string;
  startDate?: string;
  endDate?: string;
}) {
  const state = getState();
  let bookings = state.bookings.filter((b) => !b.cancelledAt);

  if (memberId) bookings = bookings.filter((b) => b.memberId === memberId);
  if (startDate) bookings = bookings.filter((b) => b.date >= startDate);
  if (endDate) bookings = bookings.filter((b) => b.date <= endDate);

  return bookings.map((b) => {
    const desk = state.desks.find((d) => d.id === b.deskId);
    const member = state.members.find((m) => m.id === b.memberId);
    return {
      id: b.id,
      desk: desk?.label ?? b.deskId,
      member: member?.name ?? b.memberId,
      date: b.date,
      slot: b.slot,
    };
  });
}

// ─── suggest_desk ────────────────────────────────────────────────────────────

export function suggest_desk({
  memberId,
  date,
  slot,
}: {
  memberId: string;
  date?: string;
  slot?: Slot;
}) {
  const d = date ?? today();
  const state = getState();
  const member = state.members.find((m) => m.id === memberId);
  if (!member) return { error: `Member ${memberId} not found.` };

  const available = list_desks({ date: d }).filter((desk) => {
    if (!desk.available) return false;
    if (slot === "am" && desk.bookedSlots.includes("am")) return false;
    if (slot === "pm" && desk.bookedSlots.includes("pm")) return false;
    return true;
  });

  if (available.length === 0)
    return { error: `No desks available on ${d}${slot ? ` for ${slot}` : ""}.` };

  // Score by how many preferences match
  const scored = available.map((desk) => {
    const score = member.preferences.filter(
      (p) => desk.zone === p || desk.features.includes(p)
    ).length;
    return { ...desk, score };
  });

  scored.sort((a, b) => b.score - a.score);
  return { suggested: scored[0], alternatives: scored.slice(1, 3) };
}

// ─── add_member ──────────────────────────────────────────────────────────────

export function add_member({
  name,
  email,
  preferences,
}: {
  name: string;
  email?: string;
  preferences?: string[];
}) {
  const state = getState();
  const existing = state.members.find(
    (m) => m.name.toLowerCase() === name.toLowerCase()
  );
  if (existing) return { error: `Member "${name}" already exists (${existing.id}).` };

  const member = {
    id: newId("M", state.members),
    name,
    email: email ?? "",
    preferences: preferences ?? [],
    createdAt: new Date().toISOString().slice(0, 10),
  };

  state.members.push(member);
  saveState(state);
  return { success: true, member };
}

// ─── set_map_date ────────────────────────────────────────────────────────────
// This mutates the shared mapDate reference used by the REPL.
// We export a holder object so index.ts can read the current date.

export const mapState = { date: new Date().toISOString().slice(0, 10) };

export function set_map_date({ date }: { date: string }) {
  mapState.date = date;
  return { success: true, date };
}

// ─── Tool dispatch ───────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const toolMap: Record<string, (input: any) => unknown> = {
  list_desks,
  book_desk,
  cancel_booking,
  get_member,
  list_bookings,
  suggest_desk,
  add_member,
  set_map_date,
};

export function dispatch(name: string, input: unknown): unknown {
  const fn = toolMap[name];
  if (!fn) return { error: `Unknown tool: ${name}` };
  return fn(input);
}
