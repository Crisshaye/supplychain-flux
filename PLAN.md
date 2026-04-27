# SupplyChain Flux — Build & Deploy Plan (v4)

**Product name:** SupplyChain Flux — Operations Briefing
**Audience:** Exec-Ed only (single mode, no student variant).
**Goal:** Multiplayer Beer Distribution Game positioned as a serious supply-chain stress test, ~100 concurrent players, $0/month, no credit card, polished responsive UI.

---

## 1. Strategy: fork-the-logic, rebuild-the-UI *(confirmed)*

Use existing OSS Beer Game repos (`jordanow/Beer-Game` primary, `siemsene/beergame` and `lines-hr/beergame` as cross-checks) only as the **rules and mechanics reference**. Build a fresh thin Node + Socket.io backend and a polished React frontend that implements those rules. Small focused build, not a port.

---

## 2. Brand identity

**Name:** SupplyChain Flux
**Subtitle on chrome:** *Operations Briefing*
**Positioning:** A "high-stakes digital command center" — a strategic supply-chain simulation tool. Never call it a "game."

**Palette**
| Role | Hex | Use |
|---|---|---|
| Midnight Navy | `#1B263B` | Primary surfaces, top bar, headings |
| Industrial Grey | `#415A77` | Secondary surfaces, table dividers, inactive states |
| Cyber Lime | `#D8F3DC` | Restricted to data viz only — bullwhip chart series, positive deltas |
| Off-white | `#F8F9FA` | Page background |
| Slate text | `#0F172A` / `#475569` | Body / muted text |
| Alert amber | `#F59E0B` | Backlog warnings |
| Alert red | `#DC2626` | Stockout / critical |

Cyber Lime is intentionally rationed — chrome stays Navy + Grey so the surface reads as instrumentation, not gamification.

**Typography**
- **Display:** *Space Grotesk* — geometric, confident, fintech-adjacent.
- **UI / body:** *Inter* — neutral, screen-optimized.
- **Numerals:** Inter with `font-feature-settings: "tnum"` — tabular figures so columns of inventory/cost numbers align.

**Voice rules**
- Never: *game, play, win, score, beer, fun*.
- Always: *simulation, period, decision, node, position, lead time L, carrying cost i, stockout penalty p, on-hand inventory, on-order pipeline, total landed cost, bullwhip magnitude, amplification ratio*.
- No emoji in product copy. Lucide icons only.
- Density over hand-holding. Assume domain knowledge.

---

## 3. Surface-by-surface UX spec

### Lobby — "Operations Briefing"
- High-density dashboard, not a tour.
- Two actions: **Convene a session** (creates a room, you become the host) and **Join a session** (enter 6-char code).
- "Rules of Engagement" link top-right opens a one-screen parameter sheet (see below); also downloadable as PDF.
- Host picks node assignments (Retailer / Wholesaler / Distributor / Factory) and the demand profile (Standard MIT / Step / Custom).
- Visible at the bottom: theoretical-optimal benchmark cost for the chosen demand profile, so participants know what they're being measured against.

### Rules of Engagement (modal + downloadable PDF)
A single-screen parameter table:
| Variable | Symbol | Default | Notes |
|---|---|---|---|
| Order lead time | L_o | 1 period | Order placed at *t* arrives upstream at *t+1* |
| Shipment lead time | L_s | 2 periods | Shipment dispatched at *t* arrives downstream at *t+2* |
| Holding cost | h | $1.00 / unit / period | Applied to on-hand inventory at period close |
| Backlog cost | b | $2.00 / unit / period | Applied to unfulfilled demand at period close |
| Stockout penalty | p | included in b | No separate penalty in baseline mode |
| Starting inventory | I_0 | 12 units | Per node |
| Demand profile | D(t) | 4 for t∈[1,4]; 8 for t∈[5,T] | "Standard MIT step" |
| Total periods | T | 24 | Adjustable by host: 24 / 36 / 52 |

### Simulation dashboard (per node)
Three-column layout on desktop, collapses gracefully:
1. **Position** — On-hand inventory, backlog, on-order pipeline (queued upstream orders + queued shipments). Sparkline of last 8 periods.
2. **Decision input** — single field: "Order quantity for period *t*". Repeat-last-decision shortcut. Submit locks the input with "Awaiting: Distributor, Factory…" indicator.
3. **Period history** — table of every period's incoming demand, decision, fulfilled, ending inventory, period cost, cumulative cost. Tabular figures.

Sticky top bar: room code (click-to-copy), period *t* of *T*, your node, cumulative landed cost, "Parameters" button.

### Analytical Post-Mortem (end of session)
- Bullwhip chart: orders vs. demand across periods, one series per node, Cyber Lime for the demand baseline.
- **Amplification ratio** per stage: σ²(orders_node) / σ²(demand_customer). Single number per node, with the textbook "ratio > 1 = bullwhip" callout.
- **Cost decomposition** per node: holding vs. backlog cost as stacked bars.
- **Theoretical-optimal comparison**: dashed benchmark line on the cost chart showing what a perfect-information policy would have achieved against the same demand profile.
- **Export**: full per-period decision log as CSV. Full Post-Mortem as PDF.

---

## 4. Tech stack

**Backend / realtime**
- **Node.js + Express + Socket.io**, single process, in-memory `Map<roomCode, SessionState>`.
- `nanoid` for 6-char room codes.
- Serves the built React app as static files from the same Express instance — one URL, one deploy.

**Frontend**
- **React + Vite + TypeScript**.
- **Tailwind CSS** with the SupplyChain Flux palette wired into `tailwind.config.js` as semantic tokens (`bg-surface`, `bg-canvas`, `text-display`, `accent-progress`, etc.).
- **shadcn/ui** for Button, Card, Dialog, Input, Tabs, Toast, Tooltip — restyled to the brand.
- **Recharts** for bullwhip chart and Post-Mortem visualizations.
- **Framer Motion** restricted to data-driven transitions only (sparkline updates, chart draws). No decorative motion. Auto-disabled when `prefers-reduced-motion`.
- **Lucide** icons.
- **socket.io-client**.
- **react-to-pdf** (or print stylesheet) for the Post-Mortem PDF export.
- **papaparse** for CSV export.

---

## 5. Hosting (no credit card, supports WebSockets, ~100 concurrent users)

**Decision:** **Koyeb** primary, **Render** fallback.

Koyeb free tier: 1 web service, 512 MB RAM, 0.1 vCPU, 2 GB SSD, no card required, never expires, commercial use OK, native WebSocket support.

**Capacity sanity-check for 100 concurrent users on 0.1 vCPU / 512 MB:**
- Socket.io: ~5–10 KB per connection → 100 × 10 KB ≈ 1 MB.
- Session state: a few KB per active room. 25 rooms × 4 nodes ≈ negligible.
- CPU: one tiny message per node per period → sustained CPU well under 5%.
- Network: well below any free-tier egress limit.

You'll get `<slug>.koyeb.app`.

---

## 6. Step-by-step

### Phase A — Lift the rules
1. Read `jordanow/Beer-Game` README + source. Write `RULES.md` capturing the parameter table from §3 with citations to the OSS references. Cross-check against `siemsene/beergame` and `lines-hr/beergame`.

### Phase B — Backend
2. `npm init`, install `express`, `socket.io`, `nanoid`. Single `server.js`.
3. Implement `SessionState`: rooms keyed by 6-char code, players by node, period counter, per-node order/shipment pipelines, per-node inventory/backlog/cost, demand profile, total periods T.
4. Socket events: `convene(config)`, `joinSession(code, node)`, `submitDecision(quantity)`, `advancePeriod` (auto-fired when all 4 decisions are in), `sessionClose`.
5. Serve `client/dist/` as static files from Express.

### Phase C — Frontend skeleton
6. `npm create vite@latest client -- --template react-ts`. Install Tailwind, shadcn/ui, recharts, framer-motion, lucide-react, socket.io-client, papaparse, react-to-pdf.
7. Wire the SupplyChain Flux palette into `tailwind.config.js` as semantic tokens. Set up Inter + Space Grotesk via Google Fonts. Configure tabular-figures for numeric columns.

### Phase D — Screens
8. **Lobby (Operations Briefing)** — Convene / Join, demand profile picker, theoretical-optimal benchmark display, Rules of Engagement modal + PDF download.
9. **Simulation dashboard** — three-column desktop layout, responsive collapse, sticky top bar, decision input with optimistic lock + "Awaiting…" indicator, period history table.
10. **Analytical Post-Mortem** — bullwhip chart, amplification ratios, cost decomposition, theoretical-optimal benchmark line, CSV + PDF export.

### Phase E — Polish
11. Pixel-walk every screen at 375 px (iPhone SE), 768 px (iPad), 1440 px (laptop). Fix cramped/stretched states.
12. Add: click-to-copy room code, "Repeat last decision," reconnect banner, `?` opens Parameters modal, `prefers-reduced-motion` handling.
13. Lighthouse + axe pass. Target ≥ 95 on Accessibility and Best Practices.

### Phase F — Deploy to Koyeb
14. Root `package.json`: `"build": "cd client && npm install && npm run build"`, `"start": "node server.js"`. `server.js` reads `process.env.PORT`.
15. Push to GitHub.
16. Sign up for Koyeb (no card). Create Web Service → connect GitHub → repo. Build: `npm run build`. Run: `npm start`. Region closest to your audience.
17. Open `https://<slug>.koyeb.app`, run a 4-tab full session to verify.

### Phase G — Verify
18. Two-network test: laptop on wifi, phone on cellular, two colleagues on their own machines. Run a full 24-period session.
19. Stress-check: open 20 tabs, join 5 rooms × 4 nodes, play a few periods. Confirm CPU/memory in Koyeb dashboard stay green.
20. Lighthouse + axe accessibility audit on production URL.
21. Validate the bullwhip math: feed a known demand profile, confirm the amplification ratios match a hand-calculated reference.

---

## 7. Cost summary

| Item | Monthly cost |
|---|---|
| Koyeb hosting | $0 |
| `*.koyeb.app` subdomain | $0 |
| GitHub | $0 |
| Google Fonts CDN | $0 |
| **Total** | **$0** |

No credit card given to anyone.

---

## 8. Risks / things to watch

- **Sleep on idle.** Koyeb's free service sleeps after a quiet period. First connection of a session triggers a wake (a few seconds). Hit the URL ~30s before kickoff if you need it warm.
- **In-memory state.** A redeploy or wake-from-sleep mid-session wipes that session. For ≤100-user playtests this is fine; if it bites, swap the `Map` for SQLite on disk (~30 lines of change).
- **0.1 vCPU.** Plenty for Beer Game traffic, but keep heavy bullwhip math on the client.
- **Region lock.** Koyeb's free tier is one region (Washington D.C. or Frankfurt). Pick the one closer to most of your participants.
- **Bullwhip math correctness.** The Post-Mortem is the value proposition for this audience. Phase G step 21 (hand-calculated validation) is non-negotiable.

---

## 9. Build order

If you give me the go-ahead, the build sequence:

1. `RULES.md` — locked rules and parameter table from the OSS references.
2. Backend (`server.js`) — session engine + socket events.
3. Frontend skeleton — Vite + Tailwind + the SupplyChain Flux palette and typography wired up.
4. Lobby + Simulation + Post-Mortem screens.
5. Polish pass + accessibility audit + bullwhip math validation.
6. Koyeb deploy + verification.

Roughly 5–6 focused work sessions.
