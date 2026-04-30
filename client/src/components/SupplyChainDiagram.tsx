// Supply chain pipeline diagram — the centerpiece of the simulation screen.
//
// Information hiding principle: each player can only see their own node's
// internal state. All other nodes show only name and team status.
//
// Own-node layout (3 columns):
//   LEFT  — downstream interface: Arrived (top) / Shipped (bottom)
//   CENTER — warehouse: on-hand (large) + team status
//   RIGHT — upstream interface: Ordered (top) / In Transit (bottom)

import { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Bot, User, AlertTriangle, ArrowLeft, ArrowRight, Factory as FactoryIcon, Lock } from 'lucide-react';
import { cn } from '@/lib/cn';
import { NODE_LABEL } from '@/lib/copy';
import type { NodeView, NodeName, YouView, PeriodHistoryRow } from '@/lib/types';

interface Props {
  view: NodeView;
}

export function SupplyChainDiagram({ view }: Props) {
  const lastT = useRef(view.t);
  const justAdvanced = view.t !== lastT.current;
  useEffect(() => { lastT.current = view.t; }, [view.t]);

  const last: PeriodHistoryRow | null = view.history.length > 0
    ? view.history[view.history.length - 1]
    : null;

  return (
    <section className="surface p-6">
      <header className="flex items-baseline justify-between mb-5">
        <div>
          <h2 className="font-display text-lg font-semibold">Supply chain pipeline</h2>
          <p className="text-sm text-fg-muted mt-0.5">
            You can only see your own node's internal state.
          </p>
        </div>
        <div className="text-xs text-fg-muted">
          Period <span className="num font-medium text-fg">{view.t}</span> of{' '}
          <span className="num font-medium text-fg">{view.T}</span>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-9 gap-3 items-stretch">
        <CustomerCell
          demand={last?.incomingOrder ?? null}
          firePulse={justAdvanced && view.yourNode === 'retailer'}
        />
        <ArrowGap pos="customer-to-retailer" />
        <NodeCell
          node="retailer"
          presence={view.presence.retailer}
          isYou={view.yourNode === 'retailer'}
          you={view.yourNode === 'retailer' ? view.you : null}
          last={view.yourNode === 'retailer' ? last : null}
          tKey={view.t}
        />
        <ArrowGap pos="retailer-to-wholesaler" />
        <NodeCell
          node="wholesaler"
          presence={view.presence.wholesaler}
          isYou={view.yourNode === 'wholesaler'}
          you={view.yourNode === 'wholesaler' ? view.you : null}
          last={view.yourNode === 'wholesaler' ? last : null}
          tKey={view.t}
        />
        <ArrowGap pos="wholesaler-to-distributor" />
        <NodeCell
          node="distributor"
          presence={view.presence.distributor}
          isYou={view.yourNode === 'distributor'}
          you={view.yourNode === 'distributor' ? view.you : null}
          last={view.yourNode === 'distributor' ? last : null}
          tKey={view.t}
        />
        <ArrowGap pos="distributor-to-factory" />
        <NodeCell
          node="factory"
          presence={view.presence.factory}
          isYou={view.yourNode === 'factory'}
          you={view.yourNode === 'factory' ? view.you : null}
          last={view.yourNode === 'factory' ? last : null}
          tKey={view.t}
        />
      </div>

      <Legend />
    </section>
  );
}

// ---------- Customer cell ----------

function CustomerCell({ demand, firePulse }: { demand: number | null; firePulse: boolean }) {
  return (
    <div className="surface-inset p-3 lg:p-4 flex flex-col items-center text-center justify-between min-h-[140px]">
      <div className="text-[10px] uppercase tracking-wider text-fg-muted">Customer</div>
      <div className="flex-1 flex items-center justify-center">
        <AnimatePresence mode="popLayout">
          <motion.div
            key={demand ?? 'idle'}
            initial={firePulse ? { scale: 0.4, opacity: 0 } : false}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.4, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 260, damping: 22 }}
            className="num font-display font-semibold text-3xl text-fg"
          >
            {demand ?? '—'}
          </motion.div>
        </AnimatePresence>
      </div>
      <div className="text-[10px] text-fg-muted">demand</div>
    </div>
  );
}

// ---------- Node cell ----------

interface NodeCellProps {
  node: NodeName;
  presence: NodeView['presence'][NodeName];
  isYou: boolean;
  you: YouView | null;           // non-null only when isYou
  last: PeriodHistoryRow | null; // non-null only when isYou and history exists
  tKey: number;
}

function NodeCell({ node, presence, isYou, you, last, tKey }: NodeCellProps) {
  const isFactory = node === 'factory';

  if (!isYou) {
    // Other nodes: opaque — show only role name and team status.
    return (
      <div className="surface-inset p-3 lg:p-4 flex flex-col items-center justify-center text-center gap-2 min-h-[140px]">
        <div className="flex items-center justify-center gap-1 text-[10px] uppercase tracking-wider text-fg-muted">
          {isFactory && <FactoryIcon size={11} className="opacity-70" />}
          {NODE_LABEL[node]}
          {presence.robot && <Bot size={11} className="text-steel-400" aria-label="Robot" />}
          {!presence.robot && presence.occupiedCount > 0 && (
            <User size={11} className="text-steel-400" aria-label="Human team" />
          )}
        </div>
        <Lock size={14} className="text-fg-muted opacity-40" aria-label="Information hidden" />
        <div className="text-[9px] text-fg-muted leading-tight">
          {presence.occupiedCount > 0
            ? `${presence.connectedCount}/${presence.occupiedCount} online`
            : presence.robot ? 'Robot' : 'Empty'}
        </div>
      </div>
    );
  }

  // Own node: 3-column layout.
  // Data sources:
  //   Arrived     = last?.incomingOrder  (demand received from downstream)
  //   Shipped     = last?.fulfilled      (sent downstream to fulfill demand)
  //   Ordered     = last?.executedDecision (order placed upstream)
  //   In Transit  = you.onShipmentPipeline (pipeline sum coming from upstream)
  const arrived   = last?.incomingOrder ?? null;
  const shipped   = last?.fulfilled ?? null;
  const ordered   = last?.executedDecision ?? null;
  const inTransit = you!.onShipmentPipeline;
  const onHand    = you!.onHand;
  const backlog   = you!.backlog;

  return (
    <div className="surface-inset ring-2 ring-navy bg-canvas p-3 lg:p-4 min-h-[140px]">
      {/* Node label */}
      <div className="flex items-center justify-center gap-1 text-[10px] uppercase tracking-wider text-fg-muted mb-2">
        {isFactory && <FactoryIcon size={11} className="opacity-70" />}
        {NODE_LABEL[node]}
        {presence.robot && <Bot size={11} className="text-steel-400" aria-label="Robot" />}
        {!presence.robot && presence.occupiedCount > 0 && (
          <User size={11} className="text-steel-400" aria-label="Human team" />
        )}
      </div>

      {/* 3-column body */}
      <div className="grid grid-cols-3 gap-2 items-center">

        {/* LEFT — downstream interface */}
        <div className="flex flex-col gap-2">
          <FlowStat
            arrow="right"
            label="Arrived"
            sublabel={isFactory ? 'orders in' : 'demand in'}
            value={arrived}
            tKey={tKey}
            animKey={`${node}-arrived-${tKey}`}
          />
          <div className="border-t border-line" />
          <FlowStat
            arrow="left"
            label="Shipped"
            sublabel="sent downstream"
            value={shipped}
            tKey={tKey}
            animKey={`${node}-shipped-${tKey}`}
          />
        </div>

        {/* CENTER — warehouse */}
        <div className="flex flex-col items-center text-center px-1">
          <AnimatePresence mode="popLayout">
            <motion.div
              key={`${node}-onhand-${tKey}-${onHand}`}
              initial={{ y: -4, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ duration: 0.25 }}
              className="num font-display font-semibold text-2xl lg:text-3xl text-fg leading-none"
            >
              {onHand}
            </motion.div>
          </AnimatePresence>
          <div className="text-[10px] text-fg-muted mt-0.5">on-hand</div>

          {backlog > 0 && (
            <motion.div
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-1 inline-flex items-center gap-1 text-[10px] font-medium text-amber"
            >
              <AlertTriangle size={10} />
              <span className="num">{backlog}</span>
            </motion.div>
          )}

          <div className="mt-2 text-[9px] text-fg-muted leading-tight">
            {presence.occupiedCount > 0
              ? `${presence.connectedCount}/${presence.occupiedCount} online`
              : presence.robot ? 'Robot' : 'Empty'}
          </div>
        </div>

        {/* RIGHT — upstream interface */}
        <div className="flex flex-col gap-2">
          <FlowStat
            arrow="right"
            label="Ordered"
            sublabel={isFactory ? 'production' : 'sent upstream'}
            value={ordered}
            tKey={tKey}
            animKey={`${node}-ordered-${tKey}`}
          />
          <div className="border-t border-line" />
          <FlowStat
            arrow="left"
            label="In Transit"
            sublabel="on its way here"
            value={inTransit}
            tKey={tKey}
            animKey={`${node}-transit-${tKey}`}
          />
        </div>

      </div>
    </div>
  );
}

// ---------- Flow stat (used inside own node card) ----------

interface FlowStatProps {
  arrow: 'left' | 'right';
  label: string;
  sublabel: string;
  value: number | null;
  tKey: number;
  animKey: string;
}

function FlowStat({ arrow, label, sublabel, value, animKey }: FlowStatProps) {
  return (
    <div className="flex flex-col items-center text-center gap-0.5">
      <div className="flex items-center gap-0.5 text-[9px] text-fg-muted">
        {arrow === 'right'
          ? <ArrowRight size={9} className="text-steel-400 shrink-0" />
          : <ArrowLeft size={9} className="text-steel-400 shrink-0" />}
        <span className="font-medium text-fg">{label}</span>
      </div>
      <AnimatePresence mode="popLayout">
        <motion.div
          key={animKey}
          initial={{ opacity: 0, y: -3 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2 }}
          className="num font-semibold text-base text-fg leading-none"
        >
          {value ?? '—'}
        </motion.div>
      </AnimatePresence>
      <div className="text-[8px] text-fg-muted leading-tight">{sublabel}</div>
    </div>
  );
}

// ---------- Animated arrow gap between cells ----------

function ArrowGap({ pos }: { pos: string }) {
  return (
    <div className="hidden lg:flex flex-col justify-center items-center min-h-[140px]" aria-hidden>
      <div className="w-full relative h-5 mb-1">
        <ArrowLeft size={14} className="absolute right-0 top-1/2 -translate-y-1/2 text-steel-400" />
        <div className="absolute inset-x-2 top-1/2 -translate-y-1/2 h-0.5 bg-line-strong" />
        <FlowDot direction="left" delay={0} />
      </div>
      <div className="text-[9px] uppercase tracking-wider text-fg-muted py-0.5">
        {pos.includes('customer') ? 'demand' : 'flow'}
      </div>
      <div className="w-full relative h-5 mt-1">
        <ArrowRight size={14} className="absolute left-0 top-1/2 -translate-y-1/2 text-steel-400" />
        <div className="absolute inset-x-2 top-1/2 -translate-y-1/2 h-0.5 bg-line-strong" />
        <FlowDot direction="right" delay={0.6} />
      </div>
    </div>
  );
}

function FlowDot({ direction, delay }: { direction: 'left' | 'right'; delay: number }) {
  const fromX = direction === 'left' ? '100%' : '0%';
  const toX = direction === 'left' ? '0%' : '100%';
  return (
    <motion.div
      className="absolute top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-navy"
      style={{ left: 0 }}
      initial={{ left: fromX, opacity: 0 }}
      animate={{ left: toX, opacity: [0, 1, 1, 0] }}
      transition={{ duration: 2.4, repeat: Infinity, ease: 'linear', delay }}
    />
  );
}

// ---------- Legend ----------

function Legend() {
  return (
    <div className="mt-5 pt-4 border-t border-line flex flex-wrap items-center gap-4 text-[11px] text-fg-muted">
      <span className="inline-flex items-center gap-1.5">
        <ArrowRight size={10} /> Arrived — demand received from downstream
      </span>
      <span className="inline-flex items-center gap-1.5">
        <ArrowLeft size={10} /> Shipped — inventory sent downstream
      </span>
      <span className="inline-flex items-center gap-1.5">
        <ArrowRight size={10} /> Ordered — order sent upstream
      </span>
      <span className="inline-flex items-center gap-1.5">
        <ArrowLeft size={10} /> In Transit — stock on its way to you
      </span>
      <span className="inline-flex items-center gap-1.5">
        <AlertTriangle size={12} className="text-amber" /> backlog
      </span>
      <span className="inline-flex items-center gap-1.5">
        <Lock size={11} /> other nodes hidden
      </span>
    </div>
  );
}
