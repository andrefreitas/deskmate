# Deskmate — Coworking Space Manager

## What this is

A CLI tool for managing desk bookings in a coworking space. Data is stored in `data/state.json`. The space layout is in `data/space.json`.

## How to use the CLI

All commands run via `npm run deskmate -- <command> [args]` or directly with `npx ts-node src/cli.ts <command> [args]`.

### Commands

```bash
# Show visual desk map for a date (default: today)
npm run deskmate -- map
npm run deskmate -- map 2026-04-16

# List desks with availability
npm run deskmate -- list
npm run deskmate -- list 2026-04-16

# Book a desk
npm run deskmate -- book D02 "Ana" 2026-04-16 full
npm run deskmate -- book D05 "Bob" 2026-04-16 am

# Cancel a booking (by booking ID or desk + date)
npm run deskmate -- cancel B002
npm run deskmate -- cancel D02 2026-04-16

# List bookings (optionally filter by member and/or date range)
npm run deskmate -- bookings
npm run deskmate -- bookings "Ana"
npm run deskmate -- bookings "Ana" 2026-04-15 2026-04-20

# Suggest best desk for a member (uses their preferences)
npm run deskmate -- suggest "Carla"
npm run deskmate -- suggest "Carla" 2026-04-16 am

# List all members
npm run deskmate -- members

# Add a new member
npm run deskmate -- add-member "João" joao@example.com quiet,monitor
```

### Slots
- `full` — full day (default)
- `am` — morning only
- `pm` — afternoon only

### Desk zones
- `quiet` — focused work
- `collab` — open collaboration
- `phone-ok` — calls allowed

### Member preferences (used by `suggest`)
`quiet`, `collab`, `phone-ok`, `monitor`, `standing`, `near-window`

## Data files

- `data/state.json` — desks, members, bookings (mutated by CLI)
- `data/space.json` — physical grid layout of the space (static)

## Setup

```bash
npm install
npm run seed   # create initial data (12 desks, 5 members)
```
