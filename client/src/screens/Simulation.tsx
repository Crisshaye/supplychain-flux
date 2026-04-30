// Simulation dashboard (team mode).
// Three columns on desktop: Position | Decision Input + Team Vote | Period History.
// Sticky top bar shows session code, period t/T, your node, cumulative cost,
// and a live countdown to the period deadline.

import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Copy, Check, Repeat, Send, FileText, Plus, Clock, Users } from 'lucide-react';
import { Button, Card, Pill, Modal, Field, Input } from '@/components/ui';
import { RulesModal } from '@/components/RulesModal';
import { SupplyChainDiagram } from '@/components/SupplyChainDiagram';
import { COPY, NODE_LABEL } from '@/lib/copy';
import { fmtUSD, cn } from '@/lib/cn';
import * as api from '@/lib/socket';
import type { NodeView, NodeName, TeamMember } from '@/lib/types';

interface Props {
  isHost: boolean;
  code: string;
  node: NodeName;
  view: NodeView;
  myEmail: string;
}

export function Simulation({ isHost, code, node, view, myEmail }: Props) {
  const [orderQty, setOrderQty] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rulesOpen, setRulesOpen] = useState(false);
  const [extendOpen, setExtendOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const me = view.team.find((m) => m.email === myEmail) ?? null;
  const youSubmitted = !!me?.suggested;

  // Reset the input each new period.
  const lastTRef = useRef(view.t);
  useEffect(() => {
    if (view.t !== lastTRef.current) {
      lastTRef.current = view.t;
      setOrderQty('');
      setTimeout(() => inputRef.current?.focus(), 120);
    }
  }, [view.t]);

  // Keyboard: ? opens parameters modal.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === '?' && !(e.target as HTMLElement)?.matches('input, textarea')) {
        setRulesOpen((o) => !o);
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  function copyCode() {
    navigator.clipboard.writeText(code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    });
  }

  async function submit() {
    const q = Math.max(0, Math.floor(Number(orderQty) || 0));
    setSubmitting(true);
    setError(null);
    try {
      await api.submitSuggestion(code, q);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  function repeatLast() {
    if (view.you.lastExecutedDecision != null) {
      setOrderQty(String(view.you.lastExecutedDecision));
    }
  }

  return (
    <div className="space-y-6">
      <TopBar
        code={code}
        copied={copied}
        copy={copyCode}
        node={node}
        t={view.t}
        T={view.T}
        cost={view.you.cumulativeCost}
        deadlineAt={view.periodDeadlineAt}
        onParams={() => setRulesOpen(true)}
        isHost={isHost}
        onExtend={() => setExtendOpen(true)}
      />

      <SupplyChainDiagram view={view} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <DecisionPanel
          view={view}
          me={me}
          youSubmitted={youSubmitted}
          orderQty={orderQty}
          setOrderQty={setOrderQty}
          inputRef={inputRef}
          submit={submit}
          repeatLast={repeatLast}
          submitting={submitting}
          error={error}
        />
        <HistoryPanel view={view} />
      </div>

      <RulesModal open={rulesOpen} onClose={() => setRulesOpen(false)} config={view.config} />

      {extendOpen && (
        <ExtendModal
          code={code}
          currentT={view.T}
          onClose={() => setExtendOpen(false)}
        />
      )}
    </div>
  );
}

// ---------- Top bar with countdown ----------

function TopBar({
  code, copied, copy, node, t, T, cost, deadlineAt, onParams, isHost, onExtend,
}: {
  code: string; copied: boolean; copy: () => void;
  node: NodeName; t: number; T: number; cost: number;
  deadlineAt: number | null;
  onParams: () => void; isHost: boolean; onExtend: () => void;
}) {
  return (
    <header className="surface-deep p-5 sticky top-3 z-30">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-6 flex-wrap">
          <button
            onClick={copy}
            className="group inline-flex items-center gap-2 text-fg-onDeep/80 hover:text-fg-onDeep"
            aria-label="Copy session code"
          >
            <span className="text-[10px] uppercase tracking-widest opacity-70">Session</span>
            <span className="num font-display font-semibold tracking-widest text-lg">{code}</span>
            {copied ? <Check size={14} /> : <Copy size={14} />}
          </button>

          <div className="text-fg-onDeep">
            <span className="text-[10px] uppercase tracking-widest opacity-70">{COPY.sim.period}</span>
            <div className="num font-display font-semibold text-lg">
              <AnimatePresence mode="popLayout">
                <motion.span
                  key={t}
                  initial={{ y: -6, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  exit={{ y: 6, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="inline-block"
                >
                  {t}
                </motion.span>
              </AnimatePresence>
              <span className="opacity-60 ml-1">{COPY.sim.of} {T}</span>
            </div>
          </div>

          <div className="text-fg-onDeep">
            <span className="text-[10px] uppercase tracking-widest opacity-70">{COPY.sim.yourNode}</span>
            <div className="font-display font-semibold text-lg">{NODE_LABEL[node]}</div>
          </div>

          <Countdown deadlineAt={deadlineAt} />
        </div>

        <div className="flex items-center gap-4">
          <div className="text-right text-fg-onDeep">
            <span className="text-[10px] uppercase tracking-widest opacity-70">
              {COPY.sim.cumulativeCost}
            </span>
            <div className="num font-display font-semibold text-xl">{fmtUSD(cost)}</div>
          </div>
          {isHost && (
            <Button variant="secondary" size="sm" onClick={onExtend}>
              <Plus size={14} /> {COPY.sim.extend}
            </Button>
          )}
          <Button variant="secondary" size="sm" onClick={onParams}>
            <FileText size={14} /> {COPY.sim.parameters}
          </Button>
        </div>
      </div>
    </header>
  );
}

function Countdown({ deadlineAt }: { deadlineAt: number | null }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(id);
  }, []);
  if (!deadlineAt) return null;
  const remaining = Math.max(0, deadlineAt - now);
  const mm = Math.floor(remaining / 60000);
  const ss = Math.floor((remaining % 60000) / 1000);
  const tone = remaining < 30_000 ? 'text-amber' : 'text-fg-onDeep';
  return (
    <div className={cn('flex items-center gap-2', tone)}>
      <Clock size={14} className="opacity-80" />
      <div>
        <div className="text-[10px] uppercase tracking-widest opacity-70">{COPY.sim.timeRemaining}</div>
        <div className="num font-display font-semibold text-lg tabular-nums">
          {mm}:{ss.toString().padStart(2, '0')}
        </div>
      </div>
    </div>
  );
}

      <div className={cn('num font-display font-semibold text-2xl', tone === 'warn' ? 'text-amber' : 'text-fg')}>
        {value}
      </div>
    </div>
  );
}

// ---------- Decision (with Team Vote) ----------

function DecisionPanel({
  view, me, youSubmitted, orderQty, setOrderQty, inputRef,
  submit, repeatLast, submitting, error,
}: {
  view: NodeView; me: TeamMember | null; youSubmitted: boolean;
  orderQty: string; setOrderQty: (s: string) => void;
  inputRef: React.RefObject<HTMLInputElement>;
  submit: () => void; repeatLast: () => void;
  submitting: boolean; error: string | null;
}) {
  const teamConnected = view.team.filter((m) => m.connected);
  const teamSuggested = view.team.filter((m) => m.suggested);
  return (
    <Card
      title={`${COPY.sim.decisionPrompt} ${view.t}`}
      subtitle={
        view.you.lastExecutedDecision != null
          ? `Last period executed: ${view.you.lastExecutedDecision} units`
          : 'No prior decision yet'
      }
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <Field label={COPY.sim.yourSuggestion}>
          <Input
            ref={inputRef}
            type="number"
            min={0}
            value={orderQty}
            onChange={(e) => setOrderQty(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && orderQty) submit();
            }}
            autoFocus
            className="text-2xl font-display font-semibold tracking-tight"
          />
        </Field>

        <div className="mt-4 flex gap-2 flex-wrap">
          <Button type="submit" disabled={!orderQty || submitting} className="flex-1 min-w-[140px]">
            <Send size={14} /> {submitting ? 'Sending...' : (youSubmitted ? COPY.sim.update : COPY.sim.submit)}
          </Button>
          {view.you.lastExecutedDecision != null && (
            <Button type="button" variant="secondary" onClick={repeatLast}>
              <Repeat size={14} /> {view.you.lastExecutedDecision}
            </Button>
          )}
        </div>
        {error && <div className="mt-3 text-sm text-danger">{error}</div>}

        {youSubmitted && me && (
          <div className="mt-3 inline-flex items-center gap-2">
            <Pill tone="success">
              <Check size={12} /> Your suggestion: {me.suggestion}
            </Pill>
          </div>
        )}
      </form>

      <div className="hairline my-5" />

      <div>
        <div className="flex items-center justify-between mb-3">
          <div className="text-xs uppercase tracking-wider text-fg-muted flex items-center gap-2">
            <Users size={12} /> {COPY.sim.teamPanel}
          </div>
          <div className="text-xs text-fg-muted num">
            {teamSuggested.length} of {teamConnected.length} suggested
          </div>
        </div>
        <ul className="space-y-2 max-h-44 overflow-y-auto">
          {view.team.map((m) => (
            <li key={m.email} className="flex items-center justify-between gap-3 text-sm">
              <div className="min-w-0 flex items-center gap-2">
                <span className={cn(
                  'w-2 h-2 rounded-full',
                  m.connected ? 'bg-lime-700' : 'bg-amber',
                )} />
                <span className="text-fg truncate">{m.name ?? m.email}</span>
              </div>
              {m.suggested ? (
                <span className="num font-medium text-fg">{m.suggestion}</span>
              ) : (
                <span className="text-xs text-fg-muted">pending</span>
              )}
            </li>
          ))}
        </ul>
        <p className="mt-3 text-[11px] text-fg-muted leading-snug">
          The executed decision is the mode of the team's suggestions; ties are broken at random.
        </p>
      </div>
    </Card>
  );
}

// ---------- History ----------

function HistoryPanel({ view }: { view: NodeView }) {
  const rows = [...view.history].reverse().slice(0, 18);
  return (
    <Card title={COPY.sim.history} subtitle={`${view.history.length} of ${view.T} periods`}>
      {rows.length === 0 ? (
        <p className="text-sm text-fg-muted">No periods completed yet.</p>
      ) : (
        <div className="overflow-x-auto -mx-2">
          <table className="w-full text-xs num">
            <thead className="text-fg-muted">
              <tr className="border-b border-line">
                <th className="text-left font-medium px-2 py-2">t</th>
                <th className="text-right font-medium px-2 py-2">In</th>
                <th className="text-right font-medium px-2 py-2">{COPY.sim.executed}</th>
                <th className="text-right font-medium px-2 py-2">Ship</th>
                <th className="text-right font-medium px-2 py-2">On-hand</th>
                <th className="text-right font-medium px-2 py-2">B/log</th>
                <th className="text-right font-medium px-2 py-2">Cost</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.t} className="border-b border-line last:border-0">
                  <td className="px-2 py-1.5 text-fg-muted">{r.t}</td>
                  <td className="px-2 py-1.5 text-right">{r.incomingOrder}</td>
                  <td className="px-2 py-1.5 text-right font-medium">
                    {r.executedDecision}
                    {r.tied && <span className="ml-1 text-amber" title="tie-broken">*</span>}
                    {r.autoDecided && <span className="ml-1 text-amber" title="auto-decided">!</span>}
                  </td>
                  <td className="px-2 py-1.5 text-right">{r.fulfilled}</td>
                  <td className="px-2 py-1.5 text-right">{r.onHandClose}</td>
                  <td className={cn('px-2 py-1.5 text-right', r.backlogClose > 0 && 'text-amber')}>
                    {r.backlogClose}
                  </td>
                  <td className="px-2 py-1.5 text-right">{fmtUSD(r.periodCost)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {view.history.some((r) => r.tied || r.autoDecided) && (
        <p className="mt-3 text-[11px] text-fg-muted">
          <span className="text-amber">*</span> Tie-broken at random. <span className="text-amber">!</span> Auto-decided (no team suggestions).
        </p>
      )}
    </Card>
  );
}


// ---------- Extend modal ----------

function ExtendModal({ code, currentT, onClose }: { code: string; currentT: number; onClose: () => void }) {
  const [add, setAdd] = useState(6);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function go() {
    setSubmitting(true);
    setError(null);
    try {
      await api.extendSession(code, add);
      onClose();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="Extend simulation"
      size="md"
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button disabled={submitting || add < 1 || currentT + add > 200} onClick={go}>
            {submitting ? 'Extending...' : `Add ${add} periods`}
          </Button>
        </div>
      }
    >
      <p className="text-sm text-fg-muted mb-4">
        Increase the total number of periods. The demand vector is extended consistently with the original profile.
      </p>
      <Field label="Additional periods" hint={`New total will be ${currentT + add} (max 200).`}>
        <Input
          type="number"
          min={1}
          max={200 - currentT}
          value={add}
          onChange={(e) => setAdd(Math.max(1, Math.floor(Number(e.target.value) || 0)))}
        />
      </Field>
      {error && <div className="mt-3 text-sm text-danger">{error}</div>}
    </Modal>
  );
}
                                                     