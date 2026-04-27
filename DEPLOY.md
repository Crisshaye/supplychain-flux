# Deploying SupplyChain Flux to Koyeb

Cost: **$0/month**, no credit card required, native WebSocket support.

## One-time setup

1. **Push this repo to GitHub.**
   ```bash
   cd "Beer Game"
   git init
   git add .
   git commit -m "SupplyChain Flux v1"
   gh repo create supplychain-flux --public --source=. --push
   # (or use the GitHub web UI to create the repo and `git push`)
   ```

2. **Create a Koyeb account** at https://app.koyeb.com/auth/signup (no card).

3. **Create a Web Service** in the Koyeb dashboard:
   - Source: **GitHub** -> pick your `supplychain-flux` repo, `main` branch.
   - Build method: **Buildpack** (recommended) OR **Dockerfile** (fallback).
   - Build command: `npm run build`
   - Run command: `npm start`
   - Instance type: **Free** (eco, 0.1 vCPU, 512 MB RAM).
   - Region: pick the one closest to your audience (Washington DC or Frankfurt).
   - Port: `8080` (matches the default in `server.js`).
   - Health check: `GET /healthz` -> Koyeb auto-detects.

4. **Click Deploy.** First build takes ~3-5 minutes.

5. Open `https://<your-app>-<your-org>.koyeb.app`.

## Smoke test on production

1. Lobby loads, brand renders.
2. **Convene** a session with `T = 12`, decision window `2 min`.
3. Open four browser windows (or invite three colleagues). Each joins the
   same code with a different email and node.
4. Run a full 12-period session. Confirm:
   - Cumulative cost updates each period (own value only).
   - Live team panel shows other team members suggesting in real time.
   - Countdown ticks down; period advances early when all four nodes have submitted.
   - Post-Mortem appears at *t = 13* with bullwhip chart, amplification bars, cost decomposition.
   - "Export decision log (CSV)" downloads a CSV with one row per (period, node).
   - "Export Post-Mortem (PDF)" opens the print dialog with the chrome hidden.

## Monitor / debug

- Logs: Koyeb dashboard -> Service -> **Logs** tab. The app prints
  `SupplyChain Flux listening on :8080` on boot.
- Health: `GET https://<your-app>.koyeb.app/healthz` returns
  `{ "ok": true, "sessions": N, "uptimeSec": N }`.

## Known free-tier behavior

- **Sleep on idle.** The instance suspends after a quiet period and wakes
  on the next request (a few seconds of warm-up). For class sessions, hit
  the URL ~30 seconds before kickoff.
- **In-memory state.** A redeploy or wake-from-sleep mid-session wipes
  active sessions. Acceptable for v1; mitigation is documented in PLAN.md.
- **0.1 vCPU.** Plenty for ~100 concurrent participants under Beer Game
  traffic patterns (one tiny message per node per period).

## Fallback hosts (if Koyeb does not work for you)

All free-tier, no card:
- **Render**: same flow, 512 MB free web service. Sleeps after 15 min idle.
- **Glitch**: more aggressive sleep but instant boot.

To deploy on Render:
- New Web Service -> connect GitHub.
- Build: `npm run build`. Start: `npm start`.
- Plan: Free.
