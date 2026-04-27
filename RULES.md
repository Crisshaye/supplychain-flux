# SupplyChain Flux — Rules of Engagement

**Version:** 1.0 (locked for v1 build)
**Source:** MIT Beer Distribution Game (Sterman, 1989), as implemented in the open-source references cited below.

This document is the contract between the rules and the simulation engine. The frontend Rules of Engagement modal is a presentation of §2; the backend `SessionState` machine is an implementation of §3–§5.

---

## 1. Topology

A four-node serial supply chain. Information (orders) flows upstream; product (shipments) flows downstream.

```
Customer  →  Retailer  →  Wholesaler  →  Distributor  →  Factory  →  (raw)
              ↑              ↑               ↑              ↑
         orders flow upstream                          production order
```

Each of the four nodes — **Retailer**, **Wholesaler**, **Distributor**, **Factory** — is operated by one participant. The Customer is simulated by the engine using the chosen demand profile. The Factory's "supplier" is an infinite raw-materials source: production orders are always honored, subject only to the production lead time.

---

## 2. Parameters (defaults)

| Symbol | Variable | Default | Notes |
|---|---|---|---|
| `T` | Total periods | **24** | Host-configurable to any integer in `[8, 200]` at convene time. Free-form numeric input, not a preset list. Host may also extend `T` mid-session via a "+N periods" control on the Operations Briefing host panel. |
| `L_o` | Order lead time | **1 period** | Order placed by node *n* at period *t* arrives at node *n+1* at period *t+1* |
| `L_s` | Shipment lead time | **2 periods** | Shipment dispatched by node *n+1* at period *t* arrives at node *n* at period *t+2* |
| `L_p` | Production lead time (Factory) | **2 periods** | Production order at *t* yields finished goods available at *t+2* |
| `I_0` | Starting inventory | **12 units** | Per node |
| `B_0` | Starting backlog | **0 units** | Per node |
| `Pipe_0` | Starting in-transit (per slot) | **4 units** | Pre-loads the shipment pipeline so the chain is in steady state at *t=1* under initial demand of 4 |
| `h` | Holding cost | **$1.00 / unit / period** | Charged on end-of-period on-hand inventory |
| `b` | Backlog cost | **$2.00 / unit / period** | Charged on end-of-period unfulfilled demand |
| `D(t)` | Demand profile | **Standard MIT step** | `D(t) = 4` for `t ∈ [1, 4]`; `D(t) = 8` for `t ∈ [5, T]` |

Round-trip delay between placing an order and having product available to ship downstream is therefore `L_o + L_s = 3 periods` for non-Factory nodes, and `L_p = 2 periods` for the Factory's own production decisions.

### Available demand profiles (host-selectable)

| Profile | `D(t)` | Use |
|---|---|---|
| **Standard MIT step** *(default)* | 4 for *t* ∈ [1,4]; 8 thereafter | Canonical bullwhip exhibit |
| **Step (early)** | 4 for *t* ∈ [1,2]; 8 thereafter | Earlier shock, harsher response window |
| **Pulse** | 4 baseline; 12 for *t* ∈ [5,8]; back to 4 | Transient demand spike |
| **Random walk** | `D(t) = max(0, round(D(t-1) + N(0, 1.5)))`, `D(0)=4` | Stochastic, defeats memorization |
| **Custom** | Host-supplied vector of length *T* | Bring-your-own scenario |

---

## 3. Per-period sequence

Every period executes in the following deterministic order. The frontend never advances until all four nodes have submitted a decision.

For period `t = 1, 2, ..., T`:

1. **Receive inbound shipment.** Each node *n* receives the shipment dispatched by node *n+1* at period `t - L_s`. Add to on-hand inventory. The Factory receives the production batch initiated at `t - L_p`.
2. **Receive inbound order.** Each node *n* receives the order placed by node *n-1* at period `t - L_o`. The Retailer receives `D(t)`.
3. **Fulfill demand.** Total demand to fulfill = `incoming_order + existing_backlog`. Ship `min(on_hand, total_demand)` to node *n-1* (or to the Customer, for the Retailer). The Factory satisfies the Distributor's order from its on-hand finished goods.
   - On-hand inventory decreases by the shipped amount.
   - Backlog updates to `total_demand - shipped`.
   - The shipped amount enters node *n-1*'s shipment pipeline with arrival at `t + L_s`.
4. **Place upstream order (decision).** The participant submits `O_n(t)`, an integer ≥ 0. This order enters node *n+1*'s order pipeline with arrival at `t + L_o`. For the Factory, the "order" is a production order that yields finished goods at `t + L_p`.
5. **Period close.** Compute period cost for each node:
   ```
   cost_n(t) = h · on_hand_n(t) + b · backlog_n(t)
   ```
   Add to cumulative cost. Increment `t`.

If `t > T`, transition to the Analytical Post-Mortem.

### Initial conditions at t = 1

Before the first period executes:
- `on_hand_n(0) = I_0 = 12` for all *n*.
- `backlog_n(0) = 0` for all *n*.
- Order pipeline: each node has one pending incoming order of `4` units, scheduled to arrive at *t = 1* (this is the order "in flight" from the previous period).
- Shipment pipeline: each node has two pending incoming shipments of `4` units each, scheduled to arrive at *t = 1* and *t = 2* respectively.

This pre-load puts the chain in steady-state equilibrium under demand = 4. The shock at *t = 5* (under the Standard MIT profile) is what triggers the bullwhip.

---

## 4. End-of-session metrics

Computed and surfaced in the Analytical Post-Mortem:

### 4.1 Total landed cost
Per node and aggregate:
```
TLC_n = Σ_{t=1}^{T} cost_n(t)
TLC   = Σ_n TLC_n
```

### 4.2 Bullwhip amplification ratio
For each non-Customer node *n*, where `O_n(t)` is the order placed at period *t*:
```
Amp_n = Var(O_n) / Var(D)
```
Computed over `t ∈ [1, T]`. Values >> 1 demonstrate the bullwhip effect; the canonical MIT result climbs from Retailer (~2–4×) to Factory (often 10–20×+).

### 4.3 Service level
Per node:
```
ServiceLevel_n = 1 - (Σ_t backlog_n(t) / Σ_t demand_received_n(t))
```

### 4.4 Theoretical-optimal benchmark
For the chosen demand profile, compute the cost a perfect-information base-stock policy would have achieved:
- Each node knows the true downstream demand `D(t)` and the lead times.
- Order policy: `O_n(t) = D(t)` (straight pass-through, since with perfect information no safety stock buildup is required beyond pipeline replenishment).
- Resulting cost is dominated by unavoidable holding cost on the steady-state pipeline.

This benchmark is rendered as a dashed line on the Post-Mortem cost chart so participants can quantify the gap between their realized performance and the information-symmetric optimum.

---

## 5. Team mode

Each of the four nodes is operated by a **team** of one or more participants who each authenticate by email. The same email rejoining counts as the same participant; a participant connected from multiple devices is still one vote.

### Per-period vote
Each period, every connected team member submits one suggested order quantity. Suggestions can be revised any time before the period closes. Within a team, members see each other's current suggestions in real time. Across teams, suggestions remain private.

### Period close trigger
The period advances when **either**:
1. Every connected participant on every node has submitted at least one suggestion, **or**
2. The decision window expires.

Default decision window: **5 minutes** per period. Host-configurable at convene time, integer seconds in `[60, 1800]`.

### Resolution
At period close, each node's executed decision is computed as:
1. **Mode** of the team's suggestions (the most frequently suggested value).
2. **Random tie-break** if multiple values are tied for most-frequent. The session's PRNG is seeded so that any given (sessionCode, period, suggestions) tuple resolves deterministically — important for reproducibility in instructor debriefs.
3. **Empty team fallback.** If a node has zero connected participants who suggested anything, the engine uses the team's previous executed decision (or `0` at *t = 1*). This is recorded as an auto-decision and flagged in the Post-Mortem.

Every team's full suggestion vector for every period is recorded and exposed in the Analytical Post-Mortem (e.g., "Wholesaler period 12: suggestions {a@x.com: 8, b@x.com: 12, c@x.com: 8} → executed 8").

## 6. Edge cases & engine guarantees

- **Negative orders are rejected.** The decision input is an integer ≥ 0. The frontend clamps to 0 if a negative value is entered.
- **No active player on a node.** If everyone on a node has disconnected before the period closes, the engine repeats the team's previous executed decision (or `0` at *t = 1*). Flagged in the Post-Mortem.
- **Host disconnect.** Session state is preserved server-side; any joiner with the room code can rejoin within the auto-cleanup window (default: 30 minutes idle).
- **Server restart mid-session.** In-memory state is lost. Acceptable for v1 per PLAN.md §8. Mitigation deferred to v2.
- **Period 0 behavior.** No decisions are taken at *t = 0*; the system simply renders the initial conditions in the dashboard so participants can familiarize themselves before *t = 1* opens.
- **Integer arithmetic only.** All quantities are integers. No fractional units are shipped, ordered, or held.

---

## 7. Validation harness

Phase E (PLAN.md §6) requires hand-calculated validation. The fixture for that validation:

**Scenario:** Standard MIT step demand, all four nodes apply the naive policy `O_n(t) = max(0, demand_received_n(t))` for all *t*. Run for `T = 36` periods.

**Expected output (to match within ±1 unit per period due to integer arithmetic):**
- Retailer amplification ratio ≈ **2.5–3.5×**
- Wholesaler ≈ **5–8×**
- Distributor ≈ **8–12×**
- Factory ≈ **15–25×**
- Inventory oscillation visible in all nodes, peak around *t* ∈ [15, 25].

The naive-policy run is not exposed to participants; it lives in `tests/validation.spec.ts` and runs in CI (or locally) before each deploy.

---

## 8. References

- **jordanow/Beer-Game** — primary reference for cost structure ($1 holding, $2 backlog), session/admin separation, and decision-input UX patterns. https://github.com/jordanow/Beer-Game
- **siemsene/beergame** — secondary cross-check on rules and pipeline mechanics. https://github.com/siemsene/beergame
- **lines-hr/beergame** — tertiary reference, alternative implementation of the same MIT rules. https://github.com/lines-hr/beergame
- Sterman, J. D. (1989). *Modeling managerial behavior: Misperceptions of feedback in a dynamic decision-making experiment.* Management Science, 35(3), 321–339. — the canonical academic source for the bullwhip amplification phenomenon and the Standard MIT step-demand profile used here.

---

## 9. Confirmed decisions (locked 2026-04-26)

1. **Total periods.** Default `T = 24`. Host-configurable to any integer in `[8, 200]` at convene time via free-form numeric input. Host may also extend `T` mid-session via a "+N periods" control.
2. **Decision window.** Default 5 minutes per period. Host-configurable in `[60, 1800]` seconds at convene. Period closes early when all connected participants have suggested.
3. **Team mode.** Each node hosts 1+ participants. Per-period executed decision = mode of team suggestions, random tie-break. Empty team falls back to previous decision (or 0 at *t = 1*).
4. **Identity.** Participants identify by email. Same email rejoining = same participant. Same email cannot occupy two different nodes simultaneously.
5. **Cost visibility during play.** Each team sees only their own node's cumulative cost. Other nodes' costs are revealed only at the Analytical Post-Mortem.
