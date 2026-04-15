#!/usr/bin/env ts-node
import { renderMap } from "./map";
import {
  list_desks,
  book_desk,
  cancel_booking,
  get_member,
  list_bookings,
  suggest_desk,
  add_member,
} from "./tools";

const [, , command, ...args] = process.argv;

function out(data: unknown) {
  console.log(JSON.stringify(data, null, 2));
}

function fail(msg: string) {
  console.error(msg);
  process.exit(1);
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

switch (command) {
  // ── map [date] ──────────────────────────────────────────────────────────────
  case "map": {
    renderMap(args[0] ?? today());
    break;
  }

  // ── list [date] ─────────────────────────────────────────────────────────────
  case "list": {
    out(list_desks({ date: args[0] }));
    break;
  }

  // ── book <deskId> <memberNameOrId> [date] [slot] ────────────────────────────
  case "book": {
    const [deskId, memberQuery, date, slot] = args;
    if (!deskId || !memberQuery) fail("Usage: book <deskId> <memberNameOrId> [date] [slot]");

    const memberResult = get_member({ query: memberQuery });
    if ("error" in memberResult) fail(memberResult.error);

    const result = book_desk({
      deskId,
      memberId: (memberResult as { id: string }).id,
      date,
      slot: slot as "full" | "am" | "pm" | undefined,
    });
    out(result);
    break;
  }

  // ── cancel <bookingId>  OR  cancel <deskId> <date> ──────────────────────────
  case "cancel": {
    const [first, second] = args;
    if (!first) fail("Usage: cancel <bookingId>  OR  cancel <deskId> <date>");

    const result = first.startsWith("B")
      ? cancel_booking({ bookingId: first })
      : cancel_booking({ deskId: first, date: second });
    out(result);
    break;
  }

  // ── bookings [memberNameOrId] [startDate] [endDate] ─────────────────────────
  case "bookings": {
    const [memberQuery, startDate, endDate] = args;
    let memberId: string | undefined;

    if (memberQuery) {
      const m = get_member({ query: memberQuery });
      if ("error" in m) fail((m as { error: string }).error);
      memberId = (m as { id: string }).id;
    }

    out(list_bookings({ memberId, startDate, endDate }));
    break;
  }

  // ── suggest <memberNameOrId> [date] [slot] ──────────────────────────────────
  case "suggest": {
    const [memberQuery, date, slot] = args;
    if (!memberQuery) fail("Usage: suggest <memberNameOrId> [date] [slot]");

    const m = get_member({ query: memberQuery });
    if ("error" in m) fail((m as { error: string }).error);

    out(suggest_desk({
      memberId: (m as { id: string }).id,
      date,
      slot: slot as "full" | "am" | "pm" | undefined,
    }));
    break;
  }

  // ── members ─────────────────────────────────────────────────────────────────
  case "members": {
    const { getState } = require("./storage");
    out(getState().members);
    break;
  }

  // ── add-member <name> <monthly|daypass> [email] [pref1,pref2,...] ───────────
  case "add-member": {
    const [name, subscriptionType, email, prefsStr] = args;
    if (!name || !subscriptionType) fail("Usage: add-member <name> <monthly|daypass> [email] [prefs]");
    if (subscriptionType !== "monthly" && subscriptionType !== "daypass") fail("subscriptionType must be 'monthly' or 'daypass'");

    out(add_member({
      name,
      email,
      subscriptionType: subscriptionType as "monthly" | "daypass",
      preferences: prefsStr ? prefsStr.split(",") : [],
    }));
    break;
  }

  // ── help / default ──────────────────────────────────────────────────────────
  default: {
    console.log(`
Deskmate CLI

  map [date]                          Visual desk map (default: today)
  list [date]                         List desks with availability
  book <deskId> <member> [date] [slot]  Book a desk (slot: full|am|pm)
  cancel <bookingId|deskId> [date]    Cancel a booking
  bookings [member] [start] [end]     List bookings
  suggest <member> [date] [slot]      Suggest best desk for member
  members                             List all members
  add-member <name> <monthly|daypass> [email] [prefs]   Add a new member

Dates: YYYY-MM-DD   Member: name (partial) or ID like M01
`);
  }
}
