// SupplyChain Flux - simulation engine (team mode + robots + node switching)
// Pure module. No network, no I/O, no globals. Each node hosts a TEAM of one
// or more participants identified by email, optionally augmented by a robot
// player that uses naive pass-through. The executed decision per node is the
// mode of suggestions, with random tie-break.
//
// See RULES.md for the spec this implements.

export const NODES = ['retailer', 'wholesaler', 'distributor', 'factory'];

const UPSTREAM = {
  retailer: 'wholesaler',
  wholesaler: 'distributor',
  distributor: 'factory',
  factory: null,
};
const DOWNSTREAM = {
  retailer: null,
  wholesaler: 'retailer',
  distributor: 'wholesaler',
  factory: 'distributor',
};

const DEFAULT_CONFIG = Object.freeze({
  T: 24,
  L_o: 1,
  L_s: 2,
  L_p: 2,
  I_0: 12,
  Pipe_0: 4,
  h: 1.0,
  b: 2.0,
  demandProfile: 'mit_step',
  demandVector: null,
  decisionWindowSec: 300,
});

const ROBOT_EMAIL = '__robot__@scf';

// ---------- Demand profiles ----------

export function buildDemandVector(profile, T, custom = null, seed = 1) {
  switch (profile) {
    case 'mit_step':
      return Array.from({ length: T }, (_, i) => (i < 4 ? 4 : 8));
    case 'step_early':
      return Array.from({ length: T }, (_, i) => (i < 2 ? 4 : 8));
    case 'pulse':
      return Array.from({ length: T }, (_, i) => (i >= 4 && i < 8 ? 12 : 4));
    case 'random_walk': {
      const rand = mulberry32(seed);
      const out = [];
      let prev = 4;
      for (let i = 0; i < T; i++) {
        const step = (rand() - 0.5) * 3.0;
        prev = Math.max(0, Math.round(prev + step));
        out.push(prev);
      }
      return out;
    }
    case 'custom':
      if (!Array.isArray(custom) || custom.length !== T) {
        throw new Error(`custom demand profile requires a vector of length ${T}`);
      }
      return custom.map((v) => Math.max(0, Math.round(v)));
    default:
      throw new Error(`unknown demand profile: ${profile}`);
  }
}

function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function seedFromCode(code) {
  let h = 2166136261;
  for (let i = 0; i < code.length; i++) {
    h ^= code.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

// ---------- Participant identity ----------

export function normalizeEmail(email) {
  if (typeof email !== 'string') throw new Error('email must be a string');
  const e = email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) throw new Error('invalid email');
  return e;
}

// ---------- Session lifecycle ----------

export function createSession({ code, hostEmail, hostName, config = {} } = {}) {
  if (!code) throw new Error('createSession: code is required');
  if (!hostEmail) throw new Error('createSession: hostEmail is required');
  const host = normalizeEmail(hostEmail);

  const cfg = { ...DEFAULT_CONFIG, ...config };
  if (cfg.T < 8 || cfg.T > 200) throw new Error(`T must be in [8, 200], got ${cfg.T}`);
  if (cfg.decisionWindowSec < 60 || cfg.decisionWindowSec > 1800) {
    throw new Error(`decisionWindowSec must be in [60, 1800], got ${cfg.decisionWindowSec}`);
  }
  if (!Number.isInteger(cfg.L_o) || cfg.L_o < 1 || cfg.L_o > 8) throw new Error(`L_o must be an integer in [1, 8], got ${cfg.L_o}`);
  if (!Number.isInteger(cfg.L_s) || cfg.L_s < 1 || cfg.L_s > 8) throw new Error(`L_s must be an integer in [1, 8], got ${cfg.L_s}`);
  if (!Number.isInteger(cfg.L_p) || cfg.L_p < 1 || cfg.L_p > 8) throw new Error(`L_p must be an integer in [1, 8], got ${cfg.L_p}`);
  if (cfg.h < 0 || cfg.h > 100) throw new Error(`h must be in [0, 100], got ${cfg.h}`);
  if (cfg.b < 0 || cfg.b > 100) throw new Error(`b must be in [0, 100], got ${cfg.b}`);
  cfg.demandVector = buildDemandVector(
    cfg.demandProfile,
    cfg.T,
    config.demandVector ?? null,
    config.seed ?? seedFromCode(code),
  );

  const nodes = {};
  for (const n of NODES) nodes[n] = makeNodeState(cfg, n === 'factory');

  return {
    code,
    seed: seedFromCode(code),
    hostEmail: host,
    hostName: hostName || null,
    config: cfg,
    status: 'lobby',
    t: 0,
    nodes,
    history: [],
    periodOpenedAt: null,
    periodDeadlineAt: null,
    createdAt: Date.now(),
    lastActivityAt: Date.now(),
  };
}

function makeNodeState(cfg, isFactory = false) {
  const shipLead = isFactory ? cfg.L_p : cfg.L_s;
  return {
    participants: {},
    onHand: cfg.I_0,
    backlog: 0,
    orderPipeline: Array(cfg.L_o).fill(cfg.Pipe_0),
    shipmentPipeline: Array(shipLead).fill(cfg.Pipe_0),
    suggestions: {},
    lastExecutedDecision: null,
    autoDecidedPeriods: [],
    cumulativeCost: 0,
    robot: false,
  };
}

// ---------- Joining / role assignment ----------

export function joinSession(state, { node, email, name, socketId }) {
  if (!NODES.includes(node)) throw new Error(`unknown node: ${node}`);
  if (state.status === 'closed') throw new Error('session is closed');
  const e = normalizeEmail(email);

  for (const n of NODES) {
    if (n !== node && state.nodes[n].participants[e]) {
      throw new Error(`email already joined as ${n}`);
    }
  }

  const team = state.nodes[node].participants;
  if (!team[e]) {
    team[e] = { email: e, name: name || null, sockets: new Set(), connected: false };
  }
  if (name && !team[e].name) team[e].name = name;
  if (socketId) team[e].sockets.add(socketId);
  team[e].connected = team[e].sockets.size > 0;

  state.lastActivityAt = Date.now();
  return state;
}

export function disconnectSocket(state, socketId) {
  for (const n of NODES) {
    for (const p of Object.values(state.nodes[n].participants)) {
      if (p.sockets.has(socketId)) {
        p.sockets.delete(socketId);
        p.connected = p.sockets.size > 0;
      }
    }
  }
  state.lastActivityAt = Date.now();
  return state;
}

export function findNodeForEmail(state, email) {
  const e = normalizeEmail(email);
  for (const n of NODES) {
    if (state.nodes[n].participants[e]) return n;
  }
  return null;
}

export function startSession(state, nowMs = Date.now()) {
  if (state.status !== 'lobby') throw new Error(`cannot start; status=${state.status}`);
  for (const n of NODES) {
    const team = state.nodes[n];
    if (Object.keys(team.participants).length === 0 && !team.robot) {
      throw new Error(`cannot start; node ${n} has no participants and no robot`);
    }
  }
  state.status = 'running';
  state.t = 1;
  openDecisionWindow(state, nowMs);
  return state;
}

// Switch a participant from one node to another. Lobby-only.
export function switchNode(state, { email, fromNode, toNode }) {
  if (state.status !== 'lobby') throw new Error('cannot switch nodes after lobby');
  if (!NODES.includes(toNode)) throw new Error(`unknown node: ${toNode}`);
  const e = normalizeEmail(email);
  const current = fromNode ?? findNodeForEmail(state, e);
  if (!current) throw new Error('participant not in any node');
  if (current === toNode) return state;
  const fromTeam = state.nodes[current].participants;
  const toTeam = state.nodes[toNode].participants;
  if (!fromTeam[e]) throw new Error(`email not on ${current}`);
  if (toTeam[e]) throw new Error(`email already on ${toNode}`);
  toTeam[e] = fromTeam[e];
  delete fromTeam[e];
  state.lastActivityAt = Date.now();
  return state;
}

// Toggle a robot on a node. Lobby-only.
export function setRobot(state, { node, enabled }) {
  if (state.status !== 'lobby') throw new Error('cannot toggle robot after lobby');
  if (!NODES.includes(node)) throw new Error(`unknown node: ${node}`);
  state.nodes[node].robot = !!enabled;
  state.lastActivityAt = Date.now();
  return state;
}

function openDecisionWindow(state, nowMs) {
  state.periodOpenedAt = nowMs;
  state.periodDeadlineAt = nowMs + state.config.decisionWindowSec * 1000;
  for (const n of NODES) state.nodes[n].suggestions = {};
  state.lastActivityAt = nowMs;
}

// Inject the robot's suggestion if a robot node has zero human suggestions.
// Naive pass-through: orders whatever was received last period (Pipe_0 at t=1).
function applyRobotSuggestions(state) {
  for (const n of NODES) {
    const node = state.nodes[n];
    if (!node.robot) continue;
    const humanCount = Object.keys(node.suggestions).filter((e) => e !== ROBOT_EMAIL).length;
    if (humanCount > 0) {
      delete node.suggestions[ROBOT_EMAIL];
      continue;
    }
    let q;
    if (state.history.length === 0) {
      q = state.config.Pipe_0;
    } else {
      q = state.history[state.history.length - 1].perNode[n].incomingOrder;
    }
    node.suggestions[ROBOT_EMAIL] = q;
  }
}

// ---------- Suggestions & period advance ----------

export function submitSuggestion(state, { node, email, quantity }) {
  if (state.status !== 'running') throw new Error(`cannot suggest; status=${state.status}`);
  if (!NODES.includes(node)) throw new Error(`unknown node: ${node}`);
  const e = normalizeEmail(email);
  const team = state.nodes[node].participants;
  if (!team[e]) throw new Error(`email is not on ${node}`);
  const q = Math.max(0, Math.floor(Number(quantity) || 0));
  state.nodes[node].suggestions[e] = q;
  state.lastActivityAt = Date.now();
  return state;
}

// Have all currently-connected humans on every node submitted at least one
// suggestion? Robot-only nodes (no humans + robot=true) count as ready.
export function allConnectedSuggested(state) {
  for (const n of NODES) {
    const node = state.nodes[n];
    const team = node.participants;
    const connectedEmails = Object.keys(team).filter((e) => team[e].connected);
    if (connectedEmails.length === 0) {
      if (!node.robot) return false;
      continue;
    }
    for (const e of connectedEmails) {
      if (!Number.isInteger(node.suggestions[e])) return false;
    }
  }
  return true;
}

export function resolveTeamDecision(node, period, sessionSeed) {
  const sugs = Object.values(node.suggestions);
  if (sugs.length === 0) {
    const fallback = node.lastExecutedDecision ?? 0;
    return { executed: fallback, mode: null, tied: false, fallback: true };
  }
  const counts = new Map();
  for (const v of sugs) counts.set(v, (counts.get(v) ?? 0) + 1);
  let max = 0;
  for (const c of counts.values()) if (c > max) max = c;
  const candidates = [...counts.entries()].filter(([, c]) => c === max).map(([v]) => v);
  candidates.sort((a, b) => a - b);
  let executed;
  let tied = candidates.length > 1;
  if (tied) {
    const rng = mulberry32(sessionSeed ^ period ^ candidates.length);
    executed = candidates[Math.floor(rng() * candidates.length)];
  } else {
    executed = candidates[0];
  }
  return { executed, mode: candidates[0], tied, fallback: false };
}

export function advancePeriod(state, nowMs = Date.now()) {
  if (state.status !== 'running') throw new Error(`cannot advance; status=${state.status}`);

  const t = state.t;
  const cfg = state.config;
  const customerDemand = cfg.demandVector[t - 1];
  const periodRecord = { t, demand: customerDemand, perNode: {} };

  applyRobotSuggestions(state);

  const resolved = {};
  for (const n of NODES) {
    resolved[n] = resolveTeamDecision(state.nodes[n], t, state.seed);
    if (resolved[n].fallback) state.nodes[n].autoDecidedPeriods.push(t);
  }

  const incoming = {};
  for (const n of NODES) {
    const node = state.nodes[n];
    const incomingShipment = node.shipmentPipeline.shift() ?? 0;
    node.onHand += incomingShipment;
    const incomingOrder = n === 'retailer'
      ? customerDemand
      : (node.orderPipeline.shift() ?? 0);
    incoming[n] = { shipment: incomingShipment, order: incomingOrder };
  }

  const fulfilled = {};
  for (const n of NODES) {
    const node = state.nodes[n];
    const totalDemand = incoming[n].order + node.backlog;
    const shipQty = Math.min(node.onHand, totalDemand);
    node.onHand -= shipQty;
    node.backlog = totalDemand - shipQty;
    fulfilled[n] = shipQty;
    const downstream = DOWNSTREAM[n];
    if (downstream) {
      ensureSlot(state.nodes[downstream].shipmentPipeline, cfg.L_s);
      state.nodes[downstream].shipmentPipeline[cfg.L_s - 1] += shipQty;
    }
  }

  for (const n of NODES) {
    const node = state.nodes[n];
    const decision = resolved[n].executed;
    node.lastExecutedDecision = decision;
    if (n === 'factory') {
      ensureSlot(node.shipmentPipeline, cfg.L_p);
      node.shipmentPipeline[cfg.L_p - 1] += decision;
    } else {
      const upstream = UPSTREAM[n];
      ensureSlot(state.nodes[upstream].orderPipeline, cfg.L_o);
      state.nodes[upstream].orderPipeline[cfg.L_o - 1] += decision;
    }
  }

  for (const n of NODES) {
    const node = state.nodes[n];
    const periodCost = cfg.h * node.onHand + cfg.b * node.backlog;
    node.cumulativeCost += periodCost;
    periodRecord.perNode[n] = {
      incomingShipment: incoming[n].shipment,
      incomingOrder: incoming[n].order,
      fulfilled: fulfilled[n],
      executedDecision: resolved[n].executed,
      tied: resolved[n].tied,
      autoDecided: resolved[n].fallback,
      suggestions: { ...node.suggestions },
      onHandClose: node.onHand,
      backlogClose: node.backlog,
      periodCost,
      cumulativeCost: node.cumulativeCost,
    };
  }

  state.history.push(periodRecord);
  state.t += 1;

  if (state.t > cfg.T) {
    state.status = 'closed';
    state.periodOpenedAt = null;
    state.periodDeadlineAt = null;
  } else {
    openDecisionWindow(state, nowMs);
  }
  state.lastActivityAt = nowMs;
  return state;
}

function ensureSlot(pipeline, lead) {
  while (pipeline.length < lead) pipeline.push(0);
}

// ---------- Mid-session extension ----------

export function extendSession(state, additionalPeriods, nowMs = Date.now()) {
  const add = Math.floor(Number(additionalPeriods) || 0);
  if (add <= 0) throw new Error('additionalPeriods must be a positive integer');
  const newT = state.config.T + add;
  if (newT > 200) throw new Error(`extending would exceed max T=200 (would be ${newT})`);
  state.config.T = newT;
  const tail = buildDemandVector(state.config.demandProfile, newT, null, state.seed)
    .slice(state.config.demandVector.length);
  state.config.demandVector = state.config.demandVector.concat(tail);
  if (state.status === 'closed') {
    state.status = 'running';
    openDecisionWindow(state, nowMs);
  }
  return state;
}

// ---------- Serialization for clients ----------

export function serializeForNode(state, node) {
  if (!NODES.includes(node)) throw new Error(`unknown node: ${node}`);
  const own = state.nodes[node];

  const teamRoster = Object.values(own.participants).map((p) => ({
    email: p.email,
    name: p.name,
    connected: p.connected,
    suggested: Number.isInteger(own.suggestions[p.email]),
    suggestion: own.suggestions[p.email] ?? null,
  }));

  const ownHistory = state.history.map((r) => ({
    t: r.t,
    incomingOrder: r.perNode[node].incomingOrder,
    incomingShipment: r.perNode[node].incomingShipment,
    executedDecision: r.perNode[node].executedDecision,
    fulfilled: r.perNode[node].fulfilled,
    onHandClose: r.perNode[node].onHandClose,
    backlogClose: r.perNode[node].backlogClose,
    periodCost: r.perNode[node].periodCost,
    cumulativeCost: r.perNode[node].cumulativeCost,
    autoDecided: r.perNode[node].autoDecided,
    tied: r.perNode[node].tied,
    suggestions: r.perNode[node].suggestions,
  }));

  return {
    code: state.code,
    status: state.status,
    t: state.t,
    T: state.config.T,
    config: {
      L_o: state.config.L_o,
      L_s: state.config.L_s,
      L_p: state.config.L_p,
      h: state.config.h,
      b: state.config.b,
      I_0: state.config.I_0,
      demandProfile: state.config.demandProfile,
      decisionWindowSec: state.config.decisionWindowSec,
    },
    yourNode: node,
    you: {
      onHand: own.onHand,
      backlog: own.backlog,
      onOrderPipeline: own.orderPipeline.reduce((a, c) => a + c, 0),
      onShipmentPipeline: own.shipmentPipeline.reduce((a, c) => a + c, 0),
      lastExecutedDecision: own.lastExecutedDecision,
      cumulativeCost: own.cumulativeCost,
    },
    team: teamRoster,
    presence: Object.fromEntries(
      NODES.map((n) => {
        const nd = state.nodes[n];
        const ps = Object.values(nd.participants);
        const connected = ps.filter((p) => p.connected).length;
        const suggested = ps.filter((p) => Number.isInteger(nd.suggestions[p.email])).length;
        const lastRecord = state.history.length > 0 ? state.history[state.history.length - 1] : null;
        const lastNode = lastRecord?.perNode[n] ?? null;
        return [n, {
          occupiedCount: ps.length,
          connectedCount: connected,
          suggestedCount: suggested,
          robot: nd.robot,
          onHand: nd.onHand,
          backlog: nd.backlog,
          // 4 flow cards (null before first period completes)
          lastArrived: lastNode ? lastNode.incomingShipment : null,
          lastShipped: lastNode ? lastNode.fulfilled : null,
          inTransit: nd.shipmentPipeline.reduce((a, c) => a + c, 0),
          lastOrdered: lastNode ? lastNode.executedDecision : null,
        }];
      }),
    ),
    periodOpenedAt: state.periodOpenedAt,
    periodDeadlineAt: state.periodDeadlineAt,
    history: ownHistory,
  };
}

export function serializeForPostMortem(state) {
  const perNode = {};
  for (const n of NODES) {
    perNode[n] = {
      cumulativeCost: state.nodes[n].cumulativeCost,
      autoDecidedPeriods: state.nodes[n].autoDecidedPeriods,
      orders: state.history.map((r) => r.perNode[n].executedDecision),
      onHandSeries: state.history.map((r) => r.perNode[n].onHandClose),
      backlogSeries: state.history.map((r) => r.perNode[n].backlogClose),
      periodCosts: state.history.map((r) => r.perNode[n].periodCost),
      cumulativeCostSeries: state.history.map((r) => r.perNode[n].cumulativeCost),
      tiedPeriods: state.history.filter((r) => r.perNode[n].tied).map((r) => r.t),
      suggestionsByPeriod: state.history.map((r) => ({ t: r.t, suggestions: r.perNode[n].suggestions })),
      teamRoster: Object.values(state.nodes[n].participants).map((p) => ({ email: p.email, name: p.name })),
      robot: state.nodes[n].robot,
      amplification: amplificationRatio(
        state.history.map((r) => r.perNode[n].executedDecision),
        state.config.demandVector.slice(0, state.history.length),
      ),
      serviceLevel: serviceLevel(
        state.history.map((r) => r.perNode[n].incomingOrder),
        state.history.map((r) => r.perNode[n].backlogClose),
      ),
    };
  }
  return {
    code: state.code,
    status: state.status,
    config: state.config,
    demandSeries: state.config.demandVector.slice(0, state.history.length),
    perNode,
    totalLandedCost: NODES.reduce((sum, n) => sum + state.nodes[n].cumulativeCost, 0),
    theoreticalOptimum: theoreticalOptimum(state),
  };
}

// ---------- Metrics ----------

export function variance(xs) {
  if (xs.length === 0) return 0;
  const mean = xs.reduce((a, c) => a + c, 0) / xs.length;
  return xs.reduce((a, c) => a + (c - mean) ** 2, 0) / xs.length;
}

export function amplificationRatio(orders, demand) {
  const dVar = variance(demand);
  if (dVar === 0) return null;
  return variance(orders) / dVar;
}

export function serviceLevel(incomingOrders, closingBacklogs) {
  const totalDemand = incomingOrders.reduce((a, c) => a + c, 0);
  if (totalDemand === 0) return 1;
  const totalBacklog = closingBacklogs.reduce((a, c) => a + c, 0);
  return Math.max(0, 1 - totalBacklog / totalDemand);
}

export function theoreticalOptimum(state) {
  const cfg = state.config;
  const T = state.history.length;
  if (T === 0) return 0;
  const demand = cfg.demandVector.slice(0, T);
  const meanD = demand.reduce((a, c) => a + c, 0) / T;
  const perNodePipeline = (cfg.L_o + cfg.L_s) * meanD;
  const factoryPipeline = cfg.L_p * meanD;
  const holdingPerPeriod = cfg.h * (3 * perNodePipeline + factoryPipeline);
  return holdingPerPeriod * T;
}
