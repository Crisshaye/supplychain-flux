// SupplyChain Flux - rigorous math validation harness
// (RULES.md section 7)
//
// Locks numerical behavior of the engine against a deterministic scenario
// so that any regression in pipeline routing, decision timing, or cost
// calculation will fail loudly. Run with: node --test tests/validation.test.js

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  NODES,
  createSession,
  joinSession,
  startSession,
  submitSuggestion,
  advancePeriod,
  serializeForPostMortem,
  variance,
} from '../engine.js';

// ---------- Fixture: solo teams, naive pass-through, MIT step demand ----------

function buildFixture({ T = 36 } = {}) {
  const s = createSession({
    code: 'VALID1',
    hostEmail: 'host@example.com',
    config: { T, demandProfile: 'mit_step', decisionWindowSec: 300 },
  });
  for (const n of NODES) {
    joinSession(s, { node: n, email: n + '@x.com', name: n, socketId: 's_' + n });
  }
  startSession(s);
  return s;
}

// Naive policy: every team member orders exactly what they received as
// incoming demand last period. At t=1 there is no prior history so order 4
// (the steady-state value).
function naivePolicy(state) {
  for (const n of NODES) {
    let q;
    if (state.history.length === 0) {
      q = 4;
    } else {
      q = state.history[state.history.length - 1].perNode[n].incomingOrder;
    }
    submitSuggestion(state, { node: n, email: n + '@x.com', quantity: q });
  }
  advancePeriod(state);
}

// ---------- Tests: per-period numerical contract ----------

test('Period 1: steady-state, all nodes hold 12 units, cost = $12 each', () => {
  const s = buildFixture();
  naivePolicy(s);
  for (const n of NODES) {
    const node = s.nodes[n];
    assert.equal(node.onHand, 12, n + '.onHand');
    assert.equal(node.backlog, 0, n + '.backlog');
    assert.equal(node.cumulativeCost, 12, n + '.cost');
    assert.equal(node.lastExecutedDecision, 4, n + '.decision');
  }
});

test('Period 4: still steady, each cost = $48', () => {
  const s = buildFixture();
  for (let i = 0; i < 4; i++) naivePolicy(s);
  for (const n of NODES) {
    const node = s.nodes[n];
    assert.equal(node.cumulativeCost, 48, n + ' cumulative after t=4');
    assert.equal(node.onHand, 12, n + '.onHand');
    assert.equal(node.backlog, 0, n + '.backlog');
  }
});

test('Period 5: customer demand jumps to 8; retailer onHand drops, upstream still steady', () => {
  const s = buildFixture();
  for (let i = 0; i < 5; i++) naivePolicy(s);
  // At t=5: retailer receives shipment (4) and the new demand (8).
  //   onHand = 12 + 4 - 8 = 8; backlog = 0.
  assert.equal(s.nodes.retailer.onHand, 8, 'retailer onHand at t=5');
  assert.equal(s.nodes.retailer.backlog, 0, 'retailer backlog at t=5');
  // Naive policy submits based on PREVIOUS period incoming demand. At t=5 that
  // was D(4) = 4, so retailer ordered 4. The shock is not yet reflected in the
  // outgoing order; this lag is what produces the bullwhip.
  assert.equal(s.nodes.retailer.lastExecutedDecision, 4);
  for (const n of ['wholesaler', 'distributor', 'factory']) {
    assert.equal(s.nodes[n].onHand, 12, n + ' onHand at t=5');
    assert.equal(s.nodes[n].backlog, 0, n + ' backlog at t=5');
  }
});

test('Period 6: retailer feels follow-on shock, wholesaler still steady (lag)', () => {
  const s = buildFixture();
  for (let i = 0; i < 6; i++) naivePolicy(s);
  // Retailer at t=6: receives wholesaler t=4 ship (4) + D(6)=8.
  //   onHand = 8 + 4 - 8 = 4. Naive order = 8 (echoing t=5 incoming).
  assert.equal(s.nodes.retailer.onHand, 4, 'retailer onHand at t=6');
  assert.equal(s.nodes.retailer.lastExecutedDecision, 8);
  // Wholesaler at t=6 receives retailer t=5 order = 4 (naive lag).
  // The shock has not yet propagated. onHand = 12 + 4 - 4 = 12.
  assert.equal(s.nodes.wholesaler.onHand, 12, 'wholesaler onHand at t=6');
});

test('Period 7: shock finally arrives at wholesaler', () => {
  const s = buildFixture();
  for (let i = 0; i < 7; i++) naivePolicy(s);
  // Wholesaler at t=7 receives retailer t=6 order = 8.
  //   onHand = 12 + 4 - 8 = 8.
  assert.equal(s.nodes.wholesaler.onHand, 8, 'wholesaler onHand at t=7');
  assert.equal(s.nodes.distributor.onHand, 12, 'distributor onHand at t=7');
});

test('After T=36 periods: bullwhip amplification ratios, factory exceeds retailer', () => {
  const s = buildFixture({ T: 36 });
  while (s.status === 'running') naivePolicy(s);
  const pm = serializeForPostMortem(s);
  const amps = NODES.map((n) => pm.perNode[n].amplification);
  for (let i = 0; i < amps.length; i++) {
    assert.ok(amps[i] >= 1, NODES[i] + ' amp should be >= 1, got ' + amps[i]);
  }
  assert.ok(amps[3] > amps[0], 'factory ' + amps[3] + ' should exceed retailer ' + amps[0]);
  const sum = NODES.reduce((a, n) => a + pm.perNode[n].cumulativeCost, 0);
  assert.equal(pm.totalLandedCost, sum);
});

test('Cost identity: per-period cost = h*onHand + b*backlog at close', () => {
  const s = buildFixture({ T: 18 });
  while (s.status === 'running') naivePolicy(s);
  for (const n of NODES) {
    let running = 0;
    for (const r of s.history) {
      const expected = s.config.h * r.perNode[n].onHandClose + s.config.b * r.perNode[n].backlogClose;
      assert.equal(r.perNode[n].periodCost, expected, n + ' t=' + r.t + ' period cost identity');
      running += expected;
      assert.equal(r.perNode[n].cumulativeCost, running, n + ' t=' + r.t + ' cumulative identity');
    }
    assert.equal(s.nodes[n].cumulativeCost, running);
  }
});

test('Material conservation: shipped + closing backlog == total demand received', () => {
  const s = buildFixture({ T: 12 });
  while (s.status === 'running') naivePolicy(s);
  for (const n of NODES) {
    const totalDemand = s.history.reduce((a, r) => a + r.perNode[n].incomingOrder, 0);
    const totalFulfilled = s.history.reduce((a, r) => a + r.perNode[n].fulfilled, 0);
    const finalBacklog = s.history[s.history.length - 1].perNode[n].backlogClose;
    assert.equal(totalFulfilled + finalBacklog, totalDemand, n + ' demand conservation');
  }
});

test('Customer demand identity: retailer incomingOrder(t) === demandSeries[t-1]', () => {
  const s = buildFixture({ T: 12 });
  while (s.status === 'running') naivePolicy(s);
  const pm = serializeForPostMortem(s);
  for (let i = 0; i < pm.demandSeries.length; i++) {
    assert.equal(
      s.history[i].perNode.retailer.incomingOrder,
      pm.demandSeries[i],
      'period ' + (i + 1) + ' demand identity',
    );
  }
});

test('Theoretical optimum scales with session length', () => {
  const a = buildFixture({ T: 12 });
  while (a.status === 'running') naivePolicy(a);
  const b = buildFixture({ T: 24 });
  while (b.status === 'running') naivePolicy(b);
  const optA = serializeForPostMortem(a).theoreticalOptimum;
  const optB = serializeForPostMortem(b).theoreticalOptimum;
  assert.ok(optB > optA, 'longer run should accumulate more holding cost');
});

test('Variance helper: known input', () => {
  // Population variance of [2,4,4,4,5,5,7,9] is 4
  assert.equal(variance([2, 4, 4, 4, 5, 5, 7, 9]), 4);
  assert.equal(variance([]), 0);
  assert.equal(variance([5]), 0);
});
