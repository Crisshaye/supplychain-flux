// Centralized executive vocabulary. Every visible string lives here so
// tone consistency is auditable in one place. (See PLAN.md voice rules:
// never game/play/win/score/beer; always simulation/period/decision/node.)

import type { NodeName, DemandProfile } from './types';

export const PRODUCT = {
  name: 'SupplyChain Flux',
  subtitle: 'Operations Briefing',
  tagline: 'A high-stakes supply chain stress test.',
};

export const NODE_LABEL: Record<NodeName, string> = {
  retailer: 'Retailer',
  wholesaler: 'Wholesaler',
  distributor: 'Distributor',
  factory: 'Factory',
};

export const NODE_BLURB: Record<NodeName, string> = {
  retailer: 'Customer-facing node. Receives end-market demand each period.',
  wholesaler: 'Mid-stream node. Serves the Retailer; orders from the Distributor.',
  distributor: 'Upstream node. Serves the Wholesaler; orders from the Factory.',
  factory: 'Production node. Serves the Distributor; issues production orders against an L_p lead time.',
};

export const DEMAND_LABEL: Record<DemandProfile, string> = {
  mit_step: 'Standard MIT step',
  step_early: 'Early step shock',
  pulse: 'Demand pulse',
  random_walk: 'Stochastic random walk',
  custom: 'Custom vector',
};

export const DEMAND_BLURB: Record<DemandProfile, string> = {
  mit_step: 'Baseline 4 units for periods 1-4, then steps to 8. Canonical bullwhip exhibit.',
  step_early: 'Baseline 4 for periods 1-2, then steps to 8. Earlier shock, harsher response window.',
  pulse: 'Baseline 4 with a transient spike to 12 across periods 5-8.',
  random_walk: 'Stochastic process around a baseline of 4. Defeats memorization across cohorts.',
  custom: 'Host-supplied demand vector.',
};

export const COPY = {
  lobby: {
    convene: 'Convene a session',
    join: 'Join a session',
    rules: 'Rules of Engagement',
    nodeAssign: 'Node assignment',
    demandProfile: 'Demand profile',
    periods: 'Total periods (T)',
    benchmark: 'Theoretical-optimal benchmark',
    start: 'Open period 1',
  },
  sim: {
    period: 'Period',
    of: 'of',
    yourNode: 'Your node',
    cumulativeCost: 'Cumulative landed cost',
    onHand: 'On-hand inventory',
    backlog: 'Backlog',
    onOrder: 'On-order pipeline',
    decisionPrompt: 'Suggest order quantity for period',
    submit: 'Submit suggestion',
    update: 'Update suggestion',
    repeatLast: 'Repeat last decision',
    waiting: 'Awaiting suggestions from',
    history: 'Period history',
    autoDecided: 'Auto-decided',
    tieBreak: 'Tie-broken',
    parameters: 'Parameters',
    extend: 'Extend simulation',
    teamPanel: 'Team',
    timeRemaining: 'Decision window',
    executed: 'Executed',
    yourSuggestion: 'Your suggestion',
  },
  pm: {
    title: 'Analytical Post-Mortem',
    bullwhip: 'Bullwhip amplification',
    costDecomp: 'Cost decomposition',
    optimum: 'Theoretical optimum',
    serviceLevel: 'Service level',
    exportCsv: 'Export decision log (CSV)',
    exportPdf: 'Export Post-Mortem (PDF)',
    rerun: 'Convene another session',
  },
} as const;
