// Your node card — the only card shown during simulation.
// Information hiding: other nodes are not rendered at all.
//
// Layout (3 columns, full-width):
//   LEFT   — downstream: Arrived (top) / Shipped (bottom)
//   CENTER — warehouse:  on-hand (large) + backlog + team status
//   RIGHT  — upstream:   Ordered (top) / In Transit (bottom)

import { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Bot, User, AlertTriangle, ArrowLeft, ArrowRight, Factory as FactoryIcon } from 'lucide-react';
import { NODE_LABEL } from '@/lib/copy';
import type { NodeView, PeriodHistoryRow } from '@/lib/types';

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

  const node     = view.yourNode;
  const isFactory = node === 'factory';
  const presence = view.presence[node];
  const you      = view.you;

  const arrived   = last?.incomingOrder   ?? null;
  const shipped   = last?.fulfilled       ?? null;
  const ordered   = last?.executedDecision ?? null;
  const inTransit = you.onShipmentPipeline;

  return (
    <section className="surface p-6">

      {/* Header */}
      <header className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          {isFactory && <FactoryIcon size={16} className="text-fg-muted" />}
          <h2 className="font-display text-lg font-semibold">
            {NODE_LABEL[node]}
          </h2>
          {presence.robot
            ? <Bot size={14} className="text-steel-400" aria-label="Robot" />
            : presence.occupiedCount > 0
              ? <User size={14} className="text-steel-400" aria-label="Human team" />
              : null}
          <span className="text-xs text-fg-muted ml-1">
            {presence.occupiedCount > 0
              ? `${presence.connectedCount}/${presence.occupiedCount} online`
              : presence.robot ? 'Robot' : 'Empty'}
          </span>
        </div>
        <div className="text-sm text-fg-muted">
          Period{' '}
          <span className="num font-semibold text-fg">{view.t}</span>
          {' '}of{' '}
          <span className="num font-semibold text-fg">{view.T}</span>
        </div>
      </header>

      {/* Main card — 3 columns */}
      <div className="grid grid-cols-3 divide-x divide-line min-h-[220px]">

        {/* ── LEFT: downstream ── */}
        <div className="flex flex-col divide-y divide-line">
          <FlowPanel
            arrow="right"
            label="Arrived"
            description={isFactory ? 'Orders received from distributor' : 'Demand received from your customer'}
            value={arrived}
            animKey={`arrived-${view.t}`}
            className="flex-1"
          />
          <FlowPanel
            arrow="left"
            label="Shipped"
            description={isFactory ? 'Production sent to distributor' : 'Inventory sent to your customer'}
            value={shipped}
            animKey={`shipped-${view.t}`}
            className="flex-1"
          />
        </div>

        {/* ── CENTER: warehouse ── */}
        <div className="flex flex-col items-center justify-center gap-3 px-6 py-6 text-center">
          <div>
            <div className="text-xs uppercase tracking-widest text-fg-muted mb-1">On-hand inventory</div>
            <AnimatePresence mode="popLayout">
              <motion.div
                key={`onhand-${view.t}-${you.onHand}`}
                initial={{ y: -8, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ duration: 0.3, ease: 'easeOut' }}
                className="num font-display font-bold text-6xl text-fg leading-none"
              >
                {you.onHand}
              </motion.div>
            </AnimatePresence>
          </div>

          {you.backlog > 0 && (
            <motion.div
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber/10 text-amber text-sm font-medium"
            >
              <AlertTriangle size={13} />
              <span className="num">backlog {you.backlog}</span>
            </motion.div>
          )}

          {justAdvanced && (
            <motion.div
              key={`pulse-${view.t}`}
              initial={{ opacity: 0.6, scale: 0.95 }}
              animate={{ opacity: 0, scale: 1.1 }}
              transition={{ duration: 0.5 }}
              className="absolute inset-0 rounded pointer-events-none ring-2 ring-navy"
            />
          )}
        </div>

        {/* ── RIGHT: upstream ── */}
        <div className="flex flex-col divide-y divide-line">
          <FlowPanel
            arrow="right"
            label="Ordered"
            description={isFactory ? 'Production order started' : 'Order placed to your supplier'}
            value={ordered}
            animKey={`ordered-${view.t}`}
            className="flex-1"
          />
          <FlowPanel
            arrow="left"
            label="In Transit"
            description="Stock on its way to your warehouse"
            value={inTransit}
            animKey={`transit-${view.t}`}
            className="flex-1"
          />
        </div>

      </div>

      {/* Legend */}
      <div className="mt-5 pt-4 border-t border-line flex flex-wrap gap-x-6 gap-y-1 text-[11px] text-fg-muted">
        <span className="inline-flex items-center gap-1"><ArrowRight size={10} /> Arrived — demand in</span>
        <span className="inline-flex items-center gap-1"><ArrowLeft size={10} /> Shipped — sent downstream</span>
        <span className="inline-flex items-center gap-1"><ArrowRight size={10} /> Ordered — sent upstream</span>
        <span className="inline-flex items-center gap-1"><ArrowLeft size={10} /> In Transit — coming to you</span>
      </div>

    </section>
  );
}

// ---------- Flow panel (one quadrant of the card) ----------

interface FlowPanelProps {
  arrow: 'left' | 'right';
  label: string;
  description: string;
  value: number | null;
  animKey: string;
  className?: string;
}

function FlowPanel({ arrow, label, description, value, animKey, className = '' }: FlowPanelProps) {
  return (
    <div className={`flex flex-col items-center justify-center gap-2 px-5 py-5 text-center ${className}`}>
      {/* Arrow + label */}
      <div className="flex items-center gap-1.5 text-fg-muted">
        {arrow === 'right'
          ? <ArrowRight size={13} className="text-steel-400" />
          : <ArrowLeft size={13} className="text-steel-400" />}
        <span className="text-xs font-semibold uppercase tracking-wider">{label}</span>
      </div>

      {/* Value */}
      <AnimatePresence mode="popLayout">
        <motion.div
          key={animKey}
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.22 }}
          className="num font-display font-bold text-4xl text-fg leading-none"
        >
          {value ?? '—'}
        </motion.div>
      </AnimatePresence>

      {/* Description */}
      <p className="text-xs text-fg-muted leading-snug max-w-[120px]">{description}</p>
    </div>
  );
}
