// Supply chain pipeline diagram - the centerpiece of the simulation screen.
// Five cells (Customer -> Retailer -> Wholesaler -> Distributor -> Factory),
// with animated incoming-shipment and outgoing-order indicators between each
// pair. Period transitions trigger slide-in animations so the bullwhip is
// visible, not just numerical.

import { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Bot, User, Box, AlertTriangle, ArrowLeft, ArrowRight, Factory as FactoryIcon } from 'lucide-react';
import { cn } from '@/lib/cn';
import { NODE_LABEL } from '@/lib/copy';
import type { NodeView, NodeName, PeriodHistoryRow } from '@/lib/types';

interface Props {
  view: NodeView;
}

export function SupplyChainDiagram({ view }: Props) {
  const lastT = useRef(view.t);
  const justAdvanced = view.t !== lastT.current;
  useEffect(() => { lastT.current = view.t; }, [view.t]);

  // Most recent period record (for animations of last-period flows on this node).
  const last: PeriodHistoryRow | null = view.history.length > 0
    ? view.history[view.history.length - 1]
    : null;

  return (
    <section className="surface p-6">
      <header className="flex items-baseline justify-between mb-5">
        <div>
          <h2 className="font-display text-lg font-semibold">Supply chain pipeline</h2>
          <p className="text-sm text-fg-muted mt-0.5">
            Orders flow upstream (right). Shipments flow downstream (left).
          </p>
        </div>
        <div className="text-xs text-fg-muted">
          Period <span className="num font-medium text-fg">{view.t}</span> of{' '}
          <span className="num font-medium text-fg">{view.T}</span>
        </div>
      </header>

      {/* Customer + 4 nodes laid out horizontally on desktop, vertically on mobile */}
      <div className="grid grid-cols-1 lg:grid-cols-9 gap-3 items-stretch">
        <CustomerCell
          demand={last?.incomingOrder ?? null}
          isYou={false}
          firePulse={justAdvanced && view.yourNode === 'retailer'}
        />
        <ArrowGap last={last} myNode={view.yourNode} pos="customer-to-retailer" />
        <NodeCell
          node="retailer"
          presence={view.presence.retailer}
          isYou={view.yourNode === 'retailer'}
          tKey={view.t}
        />
        <ArrowGap last={null} myNode={view.yourNode} pos="retailer-to-wholesaler" />
        <NodeCell
          node="wholesaler"
          presence={view.presence.wholesaler}
          isYou={view.yourNode === 'wholesaler'}
          tKey={view.t}
        />
        <ArrowGap last={null} myNode={view.yourNode} pos="wholesaler-to-distributor" />
        <NodeCell
          node="distributor"
          presence={view.presence.distributor}
          isYou={view.yourNode === 'distributor'}
          tKey={view.t}
        />
        <ArrowGap last={null} myNode={view.yourNode} pos="distributor-to-factory" />
        <NodeCell
          node="factory"
          presence={view.presence.factory}
          isYou={view.yourNode === 'factory'}
          tKey={view.t}
        />
      </div>

      <Legend />
    </section>
  );
}

// ---------- Cells ----------

function CustomerCell({ demand, firePulse }: { demand: number | null; isYou: boolean; firePulse: boolean }) {
  return (
    <div className="surface-inset p-3 lg:p-4 flex flex-col items-center text-center min-h-[120px] justify-between">
      <div className="text-[10px] uppercase tracking-wider text-fg-muted">Customer</div>
      <div className="my-2 flex items-center justify-center">
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

interface NodeCellProps {
  node: NodeName;
  presence: NodeView['presence'][NodeName];
  isYou: boolean;
  tKey: number;
}

function NodeCell({ node, presence, isYou, tKey }: NodeCellProps) {
  const isFactory = node === 'factory';
  const onHand = presence.onHand;
  const backlog = presence.backlog;

  // 4 flow card values sourced from presence (available for all nodes)
  const flowCards: { arrow: 'in' | 'out'; label: string; desc: string; value: number | null }[] = [
    {
      arrow: 'in',
      label: 'Arrived',
      desc: 'received this turn',
      value: presence.lastArrived,
    },
    {
      arrow: 'out',
      label: 'Shipped',
      desc: isFactory ? 'produced & sent' : 'fulfilled & sent',
      value: presence.lastShipped,
    },
    {
      arrow: 'in',
      label: 'In Transit',
      desc: 'on its way here',
      value: presence.inTransit,
    },
    {
      arrow: 'out',
      label: 'Ordered',
      desc: isFactory ? 'production started' : 'sent upstream',
      value: presence.lastOrdered,
    },
  ];

  return (
    <div
      className={cn(
        'surface-inset p-3 lg:p-4 flex flex-col items-center text-center transition-all',
        isYou && 'ring-2 ring-navy bg-canvas',
      )}
    >
      {/* Node label row */}
      <div className="flex items-center justify-center gap-1 text-[10px] uppercase tracking-wider text-fg-muted mb-2">
        {isFactory && <FactoryIcon size={11} className="opacity-70" />}
        {NODE_LABEL[node]}
        {presence.robot && <Bot size={11} className="text-steel-400" aria-label="Robot operator" />}
        {!presence.robot && presence.occupiedCount > 0 && (
          <User size={11} className="text-steel-400" aria-label="Human team" />
        )}
      </div>

      {/* On-hand inventory (big) */}
      <div className="flex flex-col items-center mb-1">
        <AnimatePresence mode="popLayout">
          <motion.div
            key={`${node}-${tKey}-${onHand}`}
            initial={isYou ? { y: -4, opacity: 0 } : { opacity: 0.3 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.25 }}
            className="num font-display font-semibold text-2xl lg:text-3xl text-fg"
          >
            {onHand}
          </motion.div>
        </AnimatePresence>
        <div className="text-[10px] text-fg-muted -mt-0.5">on-hand</div>

        {backlog > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-1 inline-flex items-center gap-1 text-[10px] font-medium text-amber"
          >
            <AlertTriangle size={10} />
            <span className="num">backlog {backlog}</span>
          </motion.div>
        )}
      </div>

      {/* 4 flow info cards */}
      <div className="mt-2 w-full grid grid-cols-2 gap-1">
        {flowCards.map((card) => (
          <FlowCard key={card.label} {...card} tKey={tKey} node={node} />
        ))}
      </div>

      {/* Team presence footer */}
      <div className="mt-2 text-[9px] text-fg-muted leading-tight">
        {presence.occupiedCount > 0
          ? `${presence.connectedCount}/${presence.occupiedCount} online`
          : presence.robot ? 'Robot' : 'Empty'}
      </div>
    </div>
  );
}

interface FlowCardProps {
  arrow: 'in' | 'out';
  label: string;
  desc: string;
  value: number | null;
  tKey: number;
  node: string;
}

function FlowCard({ arrow, label, desc, value, tKey, node }: FlowCardProps) {
  const isIn = arrow === 'in';
  return (
    <div className={cn(
      'rounded border border-line px-1.5 py-1 flex flex-col items-center text-center',
      isIn ? 'bg-canvas/60' : 'bg-canvas/30',
    )}>
      <div className="flex items-center gap-0.5 text-[9px] font-medium text-fg-muted mb-0.5">
        {isIn
          ? <ArrowRight size={9} className="text-steel-400 shrink-0" />
          : <ArrowLeft size={9} className="text-steel-400 shrink-0" />}
        <span className="truncate">{label}</span>
      </div>
      <AnimatePresence mode="popLayout">
        <motion.div
          key={`${node}-${label}-${tKey}-${value}`}
          initial={{ opacity: 0, y: -3 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2 }}
          className="num font-semibold text-sm text-fg leading-none"
        >
          {value ?? '—'}
        </motion.div>
      </AnimatePresence>
      <div className="text-[8px] text-fg-muted leading-tight mt-0.5 truncate w-full">{desc}</div>
    </div>
  );
}

// ---------- Animated arrow gap between cells ----------

interface ArrowGapProps {
  last: PeriodHistoryRow | null;
  myNode: NodeName;
  pos: string;
}

function ArrowGap({ pos }: ArrowGapProps) {
  // Each gap shows two stacked lanes:
  //   Top: shipments flowing right-to-left (downstream)
  //   Bottom: orders flowing left-to-right (upstream)
  // The dot animation runs continuously while the simulation is active so the
  // viewer always sees the directional flow even if no values just changed.
  return (
    <div className="hidden lg:flex flex-col justify-center items-center min-h-[120px]" aria-hidden>
      <div className="w-full relative h-5 mb-1">
        <ArrowLeft size={14} className="absolute right-0 top-1/2 -translate-y-1/2 text-steel-400" />
        <div className="absolute inset-x-2 top-1/2 -translate-y-1/2 h-0.5 bg-line-strong" />
        <FlowDot direction="left" delay={0} />
      </div>
      <div className="text-[9px] uppercase tracking-wider text-fg-muted py-0.5">{pos.includes('customer') ? 'demand' : 'flow'}</div>
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
      transition={{
        duration: 2.4,
        repeat: Infinity,
        ease: 'linear',
        delay,
      }}
    />
  );
}

// ---------- Legend ----------

function Legend() {
  return (
    <div className="mt-5 pt-4 border-t border-line flex flex-wrap items-center gap-4 text-[11px] text-fg-muted">
      <span className="inline-flex items-center gap-1.5">
        <Box size={12} /> on-hand inventory
      </span>
      <span className="inline-flex items-center gap-1.5 text-amber">
        <AlertTriangle size={12} /> backlog (unfilled demand)
      </span>
      <span className="inline-flex items-center gap-1.5">
        <User size={12} /> human team
      </span>
      <span className="inline-flex items-center gap-1.5">
        <Bot size={12} /> robot (naive pass-through)
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span className="w-3 h-0.5 bg-line-strong inline-block" />
        <ArrowLeft size={10} /> shipments downstream
      </span>
      <span className="inline-flex items-center gap-1.5">
        <ArrowRight size={10} />
        <span className="w-3 h-0.5 bg-line-strong inline-block" /> orders upstream
      </span>
      <span className="inline-flex items-center gap-1.5">
        <ArrowRight size={10} /> Arrived = received last period
      </span>
      <span className="inline-flex items-center gap-1.5">
        <ArrowLeft size={10} /> Shipped = fulfilled last period
      </span>
      <span className="inline-flex items-center gap-1.5">
        <ArrowRight size={10} /> In Transit = pipeline sum
      </span>
      <span className="inline-flex items-center gap-1.5">
        <ArrowLeft size={10} /> Ordered = last order placed
      </span>
    </div>
  );
}
