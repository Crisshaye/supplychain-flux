# SupplyChain Flux

**Operations Briefing.** A multiplayer Beer Distribution Game replica positioned as a strategic supply chain stress test for executive education.

- Four-node serial supply chain (Retailer, Wholesaler, Distributor, Factory).
- Each node hosts a **team** of one or more participants who suggest order quantities each period; the executed decision is the mode of suggestions, with random tie-break.
- 5-minute decision window per period (host-configurable). Period closes early when every connected participant has voted.
- Analytical Post-Mortem at session close: bullwhip amplification ratios per node, cost decomposition, theoretical-optimum benchmark, CSV / PDF export.

See `PLAN.md` for the build plan, `RULES.md` for the simulation spec.

## Run locally

Requires Node 20+.

```bash
npm install
cd client && npm install && cd ..
npm run build      # builds the React client into client/dist
npm start          # serves the API + static client on :8080
```

Then open http://localhost:8080.

For a tighter dev loop:
```bash
npm run dev        # in one terminal: Node server with --watch
cd client && npm run dev   # in another: Vite at :5173 with /socket.io proxy
```

## Test

```bash
npm test
```

30 tests across `tests/engine.test.js` (engine API, team voting, serialization)
and `tests/validation.test.js` (per-period numerical contract, cost identities,
bullwhip amplification on a known fixture).

## Deploy (Koyeb free tier, no credit card)

1. Push this repo to GitHub.
2. Sign up for [Koyeb](https://koyeb.com) (no card required).
3. Create a new **Web Service** -> connect your GitHub repo.
4. Build command: `npm run build`
5. Run command: `npm start`
6. Region: closest to your audience (Washington DC or Frankfurt).
7. Open `https://<your-app>.koyeb.app` and run a 4-tab session.

The free tier is 512 MB RAM / 0.1 vCPU, native WebSocket support, never expires.
Comfortably handles ~100 concurrent participants since Beer Game traffic is one
small message per node per period.

## Environment variables

| Variable | Default | Notes |
|---|---|---|
| `PORT` | 8080 | HTTP port |
| `SESSION_IDLE_TTL_MS` | 1800000 (30 min) | Auto-cleanup interval for idle sessions |

## Project layout

```
engine.js                 # pure simulation module (testable, no I/O)
server.js                 # Express + Socket.io wrapper
tests/                    # node:test specs
client/
  src/
    App.tsx               # screen router + socket subscriptions
    lib/                  # types, copy dictionary, socket wrapper, session reducer
    components/           # Brand, RulesModal, ConnectionBanner, shared UI
    screens/              # Lobby, Briefing, Simulation, PostMortem
  tailwind.config.js      # SupplyChain Flux palette as semantic tokens
PLAN.md                   # build plan
RULES.md                  # simulation spec
```
