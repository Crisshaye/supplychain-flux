// Mirror of the engine's serializer output. Keep in sync with engine.js.

export type NodeName = 'retailer' | 'wholesaler' | 'distributor' | 'factory';
export const NODES: NodeName[] = ['retailer', 'wholesaler', 'distributor', 'factory'];

export type DemandProfile =
  | 'mit_step'
  | 'step_early'
  | 'pulse'
  | 'random_walk'
  | 'custom';

export type SessionStatus = 'lobby' | 'running' | 'closed';

export interface NodePresence {
  occupiedCount: number;
  connectedCount: number;
  suggestedCount: number;
  robot: boolean;
  onHand: number;
  backlog: number;
}

export interface TeamMember {
  email: string;
  name: string | null;
  connected: boolean;
  suggested: boolean;
  suggestion: number | null;
}

export interface PeriodHistoryRow {
  t: number;
  incomingOrder: number;
  incomingShipment: number;
  executedDecision: number | null;
  fulfilled: number;
  onHandClose: number;
  backlogClose: number;
  periodCost: number;
  cumulativeCost: number;
  autoDecided: boolean;
  tied: boolean;
  suggestions: Record<string, number>;
}

export interface YouView {
  onHand: number;
  backlog: number;
  onOrderPipeline: number;
  onShipmentPipeline: number;
  lastExecutedDecision: number | null;
  cumulativeCost: number;
}

export interface NodeView {
  code: string;
  status: SessionStatus;
  t: number;
  T: number;
  config: {
    L_o: number;
    L_s: number;
    L_p: number;
    h: number;
    b: number;
    I_0: number;
    demandProfile: DemandProfile;
    decisionWindowSec: number;
  };
  yourNode: NodeName;
  you: YouView;
  team: TeamMember[];
  presence: Record<NodeName, NodePresence>;
  periodOpenedAt: number | null;
  periodDeadlineAt: number | null;
  history: PeriodHistoryRow[];
}

export interface PostMortemPerNode {
  cumulativeCost: number;
  autoDecidedPeriods: number[];
  orders: number[];
  onHandSeries: number[];
  backlogSeries: number[];
  periodCosts: number[];
  cumulativeCostSeries: number[];
  tiedPeriods: number[];
  suggestionsByPeriod: Array<{ t: number; suggestions: Record<string, number> }>;
  teamRoster: Array<{ email: string; name: string | null }>;
  amplification: number | null;
  serviceLevel: number;
}

export interface PostMortem {
  code: string;
  status: SessionStatus;
  config: {
    T: number;
    L_o: number;
    L_s: number;
    L_p: number;
    h: number;
    b: number;
    I_0: number;
    demandProfile: DemandProfile;
    demandVector: number[];
    decisionWindowSec: number;
  };
  demandSeries: number[];
  perNode: Record<NodeName, PostMortemPerNode>;
  totalLandedCost: number;
  theoreticalOptimum: number;
}

export interface ConveneResult {
  code: string;
  T: number;
  demandProfile: DemandProfile;
  decisionWindowSec: number;
}
