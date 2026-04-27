// SupplyChain Flux - server (team mode)
// Express + Socket.io. Thin wrapper around engine.js. Owns the live session
// registry, the per-period 5-minute deadline, and the static asset serving
// for the built React client.

import express from 'express';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Server as IOServer } from 'socket.io';
import { customAlphabet } from 'nanoid';

import {
  NODES,
  createSession,
  joinSession,
  disconnectSocket,
  findNodeForEmail,
  startSession,
  submitSuggestion,
  allConnectedSuggested,
  advancePeriod,
  extendSession,
  serializeForNode,
  serializeForPostMortem,
  normalizeEmail,
} from './engine.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT) || 7860;
const SESSION_IDLE_TTL_MS = Number(process.env.SESSION_IDLE_TTL_MS) || 30 * 60 * 1000;

// 6-char uppercase alphanumeric, no easily-confused characters (no 0/O/1/I).
const newCode = customAlphabet('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', 6);

const sessions = new Map(); // code -> SessionState
const decisionTimers = new Map(); // code -> Timeout

// ---------- Express ----------

const app = express();
app.use(express.json());

const clientDist = path.join(__dirname, 'client', 'dist');
app.use(express.static(clientDist));

app.get('/healthz', (_req, res) => {
  res.json({
    ok: true,
    sessions: sessions.size,
    uptimeSec: Math.round(process.uptime()),
  });
});

app.get('*', (req, res, next) => {
  if (req.path.startsWith('/socket.io')) return next();
  res.sendFile(path.join(clientDist, 'index.html'), (err) => {
    if (err) res.status(404).send('SupplyChain Flux client not built. Run `npm run build`.');
  });
});

const httpServer = http.createServer(app);
const io = new IOServer(httpServer, {
  cors: { origin: '*' },
});

// ---------- Socket.io ----------

io.on('connection', (socket) => {
  socket.data.attachment = null; // { code, node, email }

  socket.on('convene', (payload, ack) => safeAck(ack, () => {
    const { hostEmail, hostName, T, demandProfile, demandVector, decisionWindowSec } = payload || {};
    const code = uniqueCode();
    const state = createSession({
      code,
      hostEmail,
      hostName,
      config: {
        T: clampT(T),
        demandProfile: demandProfile || 'mit_step',
        demandVector: demandVector || null,
        decisionWindowSec: clampWindow(decisionWindowSec),
      },
    });
    sessions.set(code, state);
    return {
      code,
      T: state.config.T,
      demandProfile: state.config.demandProfile,
      decisionWindowSec: state.config.decisionWindowSec,
    };
  }));

  socket.on('joinSession', (payload, ack) => safeAck(ack, () => {
    const { code, node, email, name } = payload || {};
    const state = mustGet(code);

    // If this email is already on this node from another socket, this is a
    // multi-device or reconnect scenario - just attach the new socket.
    // If on a different node, joinSession itself throws.
    joinSession(state, { node, email, name, socketId: socket.id });

    socket.join(code);
    socket.data.attachment = { code, node, email: normalizeEmail(email) };
    broadcastNodeViews(state);
    return serializeForNode(state, node);
  }));

  socket.on('whereIsMyEmail', (payload, ack) => safeAck(ack, () => {
    // Lets a returning user discover which node their email is on, without
    // re-binding to a node yet. Used by the client's reconnect-from-cookie flow.
    const { code, email } = payload || {};
    const state = mustGet(code);
    const node = findNodeForEmail(state, email);
    return { node };
  }));

  socket.on('startSession', (payload, ack) => safeAck(ack, () => {
    const { code } = payload || {};
    const state = mustGet(code);
    if (!socketIsHost(state, socket)) throw new Error('only the host can start the session');
    startSession(state);
    armDecisionTimer(state);
    broadcastNodeViews(state);
    return { ok: true, t: state.t };
  }));

  socket.on('submitSuggestion', (payload, ack) => safeAck(ack, () => {
    const { code, quantity } = payload || {};
    const att = socket.data.attachment;
    if (!att || att.code !== code) throw new Error('socket not attached to this session');
    const state = mustGet(code);
    submitSuggestion(state, { node: att.node, email: att.email, quantity });
    broadcastNodeViews(state);
    if (allConnectedSuggested(state)) {
      clearDecisionTimer(state);
      advancePeriod(state);
      broadcastNodeViews(state);
      if (state.status === 'closed') {
        emitPostMortem(state);
      } else {
        armDecisionTimer(state);
      }
    }
    return { ok: true };
  }));

  socket.on('extendSession', (payload, ack) => safeAck(ack, () => {
    const { code, additionalPeriods } = payload || {};
    const state = mustGet(code);
    if (!socketIsHost(state, socket)) throw new Error('only the host can extend');
    extendSession(state, additionalPeriods);
    if (state.status === 'running') armDecisionTimer(state);
    broadcastNodeViews(state);
    return { T: state.config.T, status: state.status };
  }));

  socket.on('disconnect', () => {
    const att = socket.data.attachment;
    if (!att) return;
    const state = sessions.get(att.code);
    if (!state) return;
    disconnectSocket(state, socket.id);
    broadcastNodeViews(state);
  });
});

// ---------- Broadcast helpers ----------

function broadcastNodeViews(state) {
  for (const n of NODES) {
    const view = serializeForNode(state, n);
    io.to(state.code).emit('stateForNode', { node: n, state: view });
  }
}

function emitPostMortem(state) {
  const pm = serializeForPostMortem(state);
  io.to(state.code).emit('postMortem', pm);
}

// ---------- Decision timer ----------

function armDecisionTimer(state) {
  clearDecisionTimer(state);
  const remaining = Math.max(0, (state.periodDeadlineAt ?? 0) - Date.now());
  const t = setTimeout(() => onDecisionTimeout(state), remaining);
  decisionTimers.set(state.code, t);
}

function clearDecisionTimer(state) {
  const t = decisionTimers.get(state.code);
  if (t) clearTimeout(t);
  decisionTimers.delete(state.code);
}

function onDecisionTimeout(state) {
  if (state.status !== 'running') return;
  // Force-advance with whatever suggestions exist; teams with no suggestions
  // fall back to last decision (engine handles this).
  advancePeriod(state);
  broadcastNodeViews(state);
  if (state.status === 'closed') {
    emitPostMortem(state);
  } else {
    armDecisionTimer(state);
  }
}

// ---------- Idle session cleanup ----------

setInterval(() => {
  const now = Date.now();
  for (const [code, state] of sessions.entries()) {
    if (now - state.lastActivityAt > SESSION_IDLE_TTL_MS) {
      clearDecisionTimer(state);
      sessions.delete(code);
    }
  }
}, 60_000).unref();

// ---------- Utilities ----------

function uniqueCode() {
  for (let i = 0; i < 8; i++) {
    const c = newCode();
    if (!sessions.has(c)) return c;
  }
  throw new Error('failed to generate unique session code');
}

function mustGet(code) {
  const state = sessions.get(code);
  if (!state) throw new Error(`no session with code ${code}`);
  return state;
}

function socketIsHost(state, socket) {
  const att = socket.data.attachment;
  if (!att) return false;
  return att.email === state.hostEmail;
}

function clampT(T) {
  const n = Math.floor(Number(T) || 24);
  if (n < 8) return 8;
  if (n > 200) return 200;
  return n;
}

function clampWindow(secs) {
  const n = Math.floor(Number(secs) || 300);
  if (n < 60) return 60;
  if (n > 1800) return 1800;
  return n;
}

function safeAck(ack, fn) {
  try {
    const result = fn();
    if (typeof ack === 'function') ack({ ok: true, data: result });
  } catch (err) {
    if (typeof ack === 'function') ack({ ok: false, error: err.message });
  }
}

// ---------- Boot ----------

httpServer.listen(PORT, () => {
  console.log(`SupplyChain Flux listening on :${PORT}`);
});
