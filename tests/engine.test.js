// SupplyChain Flux - engine validation tests (team mode)
// Run with: node --test tests/

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  NODES,
  createSession,
  joinSession,
  disconnectSocket,
  startSession,
  submitSuggestion,
  allConnectedSuggested,
  resolveTeamDecision,
  advancePeriod,
  serializeForNode,
  serializeForPostMortem,
  amplificationRatio,
  variance,
  buildDemandVector,
  extendSession,
  normalizeEmail,
  findNodeForEmail,
} from '../engine.js';

// ---------- Helpers ----------

function freshSession({ T = 24, demandProfile = 'mit_step' } = {}) {
  const s = createSession({
    code: 'TEST01',
    hostEmail: 'host@example.com',
    config: { T, demandProfile },
  });
  // One participant per node by default.
  for (const n of NODES) {
    joinSession(s, { node: n, email: `${n}@example.com`, name: n, socketId: `sock_${n}_1` });
  }
  startSession(s);
  return s;
}

// Naive policy: each member of each node suggests their incoming order from
// the previous period (or 4 at t=1). Solo teams, so executed = mode = that value.
function naivePeriod(state) {
  for (const n of NODES) {
    let q;
    if (state.history.length === 0) {
      q = 4;
    } else {
      const last = state.history[state.history.length - 1];
      q = last.perNode[n].incomingOrder;
    }
    submitSuggestion(state, { node: n, email: `${n}@example.com`, quantity: q });
  }
  assert.equal(allConnectedSuggested(state), true);
  advancePeriod(state);
}

// ---------- Tests ----------

test('demand profiles build correctly', () => {
  const mit24 = buildDemandVector('mit_step', 24);
  assert.equal(mit24.length, 24);
  assert.deepEqual(mit24.slice(0, 4), [4, 4, 4, 4]);
  assert.deepEqual(mit24.slice(4, 8), [8, 8, 8, 8]);

  const rw1 = buildDemandVector('random_walk', 10, null, 42);
  const rw2 = buildDemandVector('random_walk', 10, null, 42);
  assert.deepEqual(rw1, rw2);
});

test('normalizeEmail rejects bad input', () => {
  assert.equal(normalizeEmail('  Foo@BAR.com '), 'foo@bar.com');
  assert.throws(() => normalizeEmail('not-an-email'));
  assert.throws(() => normalizeEmail(''));
  assert.throws(() => normalizeEmail(null));
});

test('createSession sets steady-state initial conditions', () => {
  const s = createSession({ code: 'C', hostEmail: 'h@x.com' });
  for (const n of NODES) {
    assert.equal(s.nodes[n].onHand, 12);
    assert.equal(s.nodes[n].backlog, 0);
    assert.deepEqual(s.nodes[n].orderPipeline, [4]);
    assert.deepEqual(s.nodes[n].shipmentPipeline, [4, 4]);
    assert.deepEqual(s.nodes[n].participants, {});
  }
  assert.equal(s.status, 'lobby');
  assert.equal(s.t, 0);
  assert.equal(s.config.decisionWindowSec, 300);
});

test('cannot start session with empty teams', () => {
  const s = createSession({ code: 'C', hostEmail: 'h@x.com' });
  joinSession(s, { node: 'retailer', email: 'r@x.com' });
  assert.throws(() => startSession(s), /no participants/);
});

test('startSession opens a decision window', () => {
  const s = freshSession();
  assert.equal(s.status, 'running');
  assert.equal(s.t, 1);
  assert.ok(s.periodOpenedAt);
  assert.ok(s.periodDeadlineAt > s.periodOpenedAt);
  assert.equal(s.periodDeadlineAt - s.periodOpenedAt, 300_000);
});

test('email cannot occupy two nodes simultaneously', () => {
  const s = createSession({ code: 'C', hostEmail: 'h@x.com' });
  joinSession(s, { node: 'retailer', email: 'shared@x.com' });
  assert.throws(
    () => joinSession(s, { node: 'wholesaler', email: 'shared@x.com' }),
    /already joined/,
  );
});

test('multiple sockets per email count as one participant', () => {
  const s = createSession({ code: 'C', hostEmail: 'h@x.com' });
  joinSession(s, { node: 'retailer', email: 'a@x.com', socketId: 'sock1' });
  joinSession(s, { node: 'retailer', email: 'a@x.com', socketId: 'sock2' });
  const team = s.nodes.retailer.participants;
  assert.equal(Object.keys(team).length, 1);
  assert.equal(team['a@x.com'].sockets.size, 2);
  assert.equal(team['a@x.com'].connected, true);

  // Disconnect one socket - still connected.
  disconnectSocket(s, 'sock1');
  assert.equal(team['a@x.com'].connected, true);
  // Disconnect the other - now disconnected.
  disconnectSocket(s, 'sock2');
  assert.equal(team['a@x.com'].connected, false);
});

test('first period under steady-state demand, solo teams, naive policy', () => {
  const s = freshSession();
  naivePeriod(s);
  for (const n of NODES) {
    const node = s.nodes[n];
    assert.equal(node.onHand, 12, `${n} onHand after t=1`);
    assert.equal(node.backlog, 0);
    assert.equal(node.cumulativeCost, 12);
    assert.equal(node.lastExecutedDecision, 4);
  }
});

test('full naive run shows monotone bullwhip amplification (factory >= retailer)', () => {
  const s = freshSession({ T: 36 });
  while (s.status === 'running') naivePeriod(s);
  const pm = serializeForPostMortem(s);
  const amps = NODES.map((n) => pm.perNode[n].amplification);
  for (const a of amps) assert.ok(a >= 1, `amp should be >= 1, got ${a}`);
  assert.ok(amps[3] >= amps[0], `factory amp ${amps[3]} should be >= retailer amp ${amps[0]}`);
});

test('team vote: mode resolution with clear majority', () => {
  const s = createSession({ code: 'V0TE01', hostEmail: 'h@x.com' });
  for (const n of NODES) {
    joinSession(s, { node: n, email: `${n}1@x.com`, socketId: `${n}1` });
  }
  // Add three more to the retailer team so we can vote.
  joinSession(s, { node: 'retailer', email: 'r2@x.com', socketId: 'r2' });
  joinSession(s, { node: 'retailer', email: 'r3@x.com', socketId: 'r3' });
  startSession(s);

  // Retailer team votes 8, 8, 5 -> mode 8
  submitSuggestion(s, { node: 'retailer', email: 'retailer1@x.com', quantity: 8 });
  submitSuggestion(s, { node: 'retailer', email: 'r2@x.com', quantity: 8 });
  submitSuggestion(s, { node: 'retailer', email: 'r3@x.com', quantity: 5 });
  // Other nodes solo, just submit 4
  for (const n of ['wholesaler', 'distributor', 'factory']) {
    submitSuggestion(s, { node: n, email: `${n}1@x.com`, quantity: 4 });
  }
  assert.equal(allConnectedSuggested(s), true);
  advancePeriod(s);

  const lastRetailer = s.history[0].perNode.retailer;
  assert.equal(lastRetailer.executedDecision, 8);
  assert.equal(lastRetailer.tied, false);
  assert.deepEqual(lastRetailer.suggestions, {
    'retailer1@x.com': 8,
    'r2@x.com': 8,
    'r3@x.com': 5,
  });
});

test('team vote: tie is broken deterministically by session seed', () => {
  function runWithCode(code) {
    const s = createSession({ code, hostEmail: 'h@x.com' });
    for (const n of NODES) joinSession(s, { node: n, email: `${n}1@x.com`, socketId: `${n}1` });
    joinSession(s, { node: 'retailer', email: 'r2@x.com', socketId: 'r2' });
    startSession(s);
    submitSuggestion(s, { node: 'retailer', email: 'retailer1@x.com', quantity: 6 });
    submitSuggestion(s, { node: 'retailer', email: 'r2@x.com', quantity: 9 });
    for (const n of ['wholesaler', 'distributor', 'factory']) {
      submitSuggestion(s, { node: n, email: `${n}1@x.com`, quantity: 4 });
    }
    advancePeriod(s);
    return s.history[0].perNode.retailer;
  }
  const a = runWithCode('TIE001');
  const b = runWithCode('TIE001');
  assert.equal(a.executedDecision, b.executedDecision); // determinism
  assert.equal(a.tied, true);
  assert.ok([6, 9].includes(a.executedDecision));

  // Different code -> independent draw (could match by chance, but tied is still true)
  const c = runWithCode('TIE002');
  assert.equal(c.tied, true);
});

test('empty team falls back to last decision (or 0 at t=1)', () => {
  const s = freshSession();
  // Disconnect the retailer's only participant before they suggest.
  disconnectSocket(s, 'sock_retailer_1');
  // Other three vote.
  for (const n of ['wholesaler', 'distributor', 'factory']) {
    submitSuggestion(s, { node: n, email: `${n}@example.com`, quantity: 4 });
  }
  // allConnectedSuggested should be false - retailer team has zero connected.
  assert.equal(allConnectedSuggested(s), false);
  // Force advance (simulating timeout)
  advancePeriod(s);
  const r = s.history[0].perNode.retailer;
  assert.equal(r.executedDecision, 0); // no prior, no suggestion
  assert.equal(r.autoDecided, true);
  assert.deepEqual(s.nodes.retailer.autoDecidedPeriods, [1]);
});

test('serializeForNode keeps own team transparent and others opaque', () => {
  const s = freshSession();
  for (let i = 0; i < 3; i++) naivePeriod(s);
  const view = serializeForNode(s, 'retailer');
  assert.equal(view.yourNode, 'retailer');
  assert.ok('cumulativeCost' in view.you);
  assert.ok(Array.isArray(view.team));
  assert.equal(view.team.length, 1);
  // Other nodes' presence shows counts only, no cost/suggestion content.
  for (const n of NODES) {
    const p = view.presence[n];
    assert.ok('occupiedCount' in p);
    assert.ok('connectedCount' in p);
    assert.ok('suggestedCount' in p);
    assert.ok(!('cumulativeCost' in p));
  }
  // History rows include own team's full suggestions (transparency within team).
  for (const h of view.history) {
    assert.ok('suggestions' in h);
    assert.ok('executedDecision' in h);
  }
});

test('serializeForPostMortem reveals all teams and includes suggestions per period', () => {
  const s = freshSession({ T: 12 });
  while (s.status === 'running') naivePeriod(s);
  const pm = serializeForPostMortem(s);
  for (const n of NODES) {
    assert.ok(pm.perNode[n].cumulativeCost >= 0);
    assert.equal(pm.perNode[n].orders.length, 12);
    assert.ok(Array.isArray(pm.perNode[n].suggestionsByPeriod));
    assert.equal(pm.perNode[n].suggestionsByPeriod.length, 12);
    assert.ok(Array.isArray(pm.perNode[n].teamRoster));
  }
  const sum = NODES.reduce((a, n) => a + pm.perNode[n].cumulativeCost, 0);
  assert.equal(pm.totalLandedCost, sum);
  assert.ok(pm.theoreticalOptimum > 0);
});

test('extendSession lengthens T and reopens decision window', () => {
  const s = freshSession({ T: 10 });
  for (let i = 0; i < 10; i++) naivePeriod(s);
  assert.equal(s.status, 'closed');
  extendSession(s, 4);
  assert.equal(s.config.T, 14);
  assert.equal(s.status, 'running');
  assert.ok(s.periodDeadlineAt > Date.now());
  for (let i = 0; i < 4; i++) naivePeriod(s);
  assert.equal(s.history.length, 14);
});

test('decisionWindowSec validation', () => {
  assert.throws(
    () => createSession({ code: 'X', hostEmail: 'h@x.com', config: { decisionWindowSec: 30 } }),
    /decisionWindowSec/,
  );
  assert.throws(
    () => createSession({ code: 'X', hostEmail: 'h@x.com', config: { decisionWindowSec: 5000 } }),
    /decisionWindowSec/,
  );
});

test('findNodeForEmail returns the right node or null', () => {
  const s = freshSession();
  assert.equal(findNodeForEmail(s, 'retailer@example.com'), 'retailer');
  assert.equal(findNodeForEmail(s, 'nobody@example.com'), null);
});

test('resolveTeamDecision direct call', () => {
  const node = { suggestions: { 'a': 5, 'b': 5, 'c': 7 }, lastExecutedDecision: null };
  const r = resolveTeamDecision(node, 1, 12345);
  assert.equal(r.executed, 5);
  assert.equal(r.fallback, false);
  assert.equal(r.tied, false);
});

test('variance and amplificationRatio basics', () => {
  assert.equal(variance([4, 4, 4, 4]), 0);
  const amp2 = amplificationRatio([2, 6, 2, 6], [3, 5, 3, 5]);
  assert.equal(amp2, 4);
});
