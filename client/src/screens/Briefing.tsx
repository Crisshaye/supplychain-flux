// Briefing screen: shown after Convene/Join and before period 1 opens.
// Host sees the start control; non-hosts see a waiting indicator.
// Each node can have a team of multiple participants.

import { useState } from 'react';
import { Copy, Check, Play, FileText } from 'lucide-react';
import { Button, Card, Pill } from '@/components/ui';
import { Brand } from '@/components/Brand';
import { RulesModal } from '@/components/RulesModal';
import { COPY, NODE_LABEL, NODE_BLURB, DEMAND_LABEL } from '@/lib/copy';
import * as api from '@/lib/socket';
import type { NodeView, NodeName } from '@/lib/types';

interface Props {
  isHost: boolean;
  code: string;
  node: NodeName | null;
  view: NodeView;
}

const NODE_ORDER: NodeName[] = ['retailer', 'wholesaler', 'distributor', 'factory'];

export function Briefing({ isHost, code, view }: Props) {
  const [copied, setCopied] = useState(false);
  const [rulesOpen, setRulesOpen] = useState(false);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function copyCode() {
    navigator.clipboard.writeText(code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    });
  }

  async function start() {
    setStarting(true);
    setError(null);
    try {
      await api.startSession(code);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setStarting(false);
    }
  }

  const nodesWithMembers = NODE_ORDER.filter((n) => view.presence[n].occupiedCount > 0).length;
  const allFilled = nodesWithMembers === 4;
  const totalParticipants = NODE_ORDER.reduce((sum, n) => sum + view.presence[n].occupiedCount, 0);
  const decisionMin = Math.round(view.config.decisionWindowSec / 60);

  return (
    <div className="space-y-6">
      <div className="surface p-8 flex flex-col md:flex-row md:items-center md:justify-between gap-6">
        <Brand variant="lobby" />
        <div className="flex items-center gap-3">
          <Pill tone="info">Briefing</Pill>
          <button
            onClick={copyCode}
            className="group inline-flex items-center gap-3 px-4 py-2.5 rounded-md bg-surface-inset hover:bg-line transition-colors"
            aria-label="Copy session code"
          >
            <span className="text-xs uppercase tracking-wider text-text-muted">Session</span>
            <span className="num font-display font-semibold text-2xl tracking-widest text-text">
              {code}
            </span>
            <span className="text-text-muted group-hover:text-text">
              {copied ? <Check size={16} /> : <Copy size={16} />}
            </span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card title="Configuration" className="lg:col-span-2">
          <dl className="grid grid-cols-2 md:grid-cols-4 gap-y-5 gap-x-4 text-sm">
            <ConfigItem label="Total periods" value={String(view.T)} />
            <ConfigItem label="Decision window" value={`${decisionMin} min`} />
            <ConfigItem label="Demand profile" value={DEMAND_LABEL[view.config.demandProfile]} />
            <ConfigItem label="Resolution" value="Mode of team" />
            <ConfigItem label="Order lead time" value={`L_o = ${view.config.L_o}`} />
            <ConfigItem label="Shipment lead time" value={`L_s = ${view.config.L_s}`} />
            <ConfigItem label="Holding cost" value={`h = $${view.config.h.toFixed(2)}`} />
            <ConfigItem label="Backlog cost" value={`b = $${view.config.b.toFixed(2)}`} />
          </dl>
          <div className="mt-6 flex gap-3">
            <Button variant="secondary" onClick={() => setRulesOpen(true)}>
              <FileText size={14} /> {COPY.lobby.rules}
            </Button>
          </div>
        </Card>

        <Card title="Your team" subtitle={`${NODE_LABEL[view.yourNode]} - ${view.team.length} member${view.team.length === 1 ? '' : 's'}`}>
          <ul className="space-y-2">
            {view.team.map((m) => (
              <li key={m.email} className="flex items-center justify-between gap-3 text-sm">
                <div className="min-w-0">
                  <div className="text-text font-medium truncate">{m.name ?? m.email}</div>
                  {m.name && <div className="text-xs text-text-muted truncate">{m.email}</div>}
                </div>
                <PresenceDot connected={m.connected} occupied />
              </li>
            ))}
          </ul>
          <p className="mt-4 text-xs text-text-muted leading-relaxed">{NODE_BLURB[view.yourNode]}</p>
        </Card>
      </div>

      <Card title="Node positions" subtitle={`${nodesWithMembers} of 4 nodes have at least one participant. ${totalParticipants} participants total.`}>
        <ul className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {NODE_ORDER.map((n) => {
            const p = view.presence[n];
            const isYours = view.yourNode === n;
            return (
              <li key={n} className="flex items-center justify-between gap-3 surface-inset p-4">
                <div>
                  <div className="text-sm font-medium text-text flex items-center gap-2">
                    {NODE_LABEL[n]}
                    {isYours && <Pill tone="success">You</Pill>}
                  </div>
                  <div className="text-xs text-text-muted">
                    {p.occupiedCount === 0
                      ? 'No participants yet'
                      : `${p.connectedCount} of ${p.occupiedCount} connected`}
                  </div>
                </div>
                <div className="text-right">
                  <div className="num text-2xl font-display font-semibold text-text">{p.occupiedCount}</div>
                  <div className="text-[10px] uppercase tracking-wider text-text-muted">members</div>
                </div>
              </li>
            );
          })}
        </ul>
      </Card>

      <div className="surface p-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="text-sm text-text-muted">
          {isHost
            ? allFilled
              ? 'All four nodes have participants. You can open period 1 when ready.'
              : `Waiting for participants on ${4 - nodesWithMembers} more node${4 - nodesWithMembers === 1 ? '' : 's'}.`
            : 'Waiting for the host to open period 1.'}
        </div>
        {isHost && (
          <Button size="lg" disabled={!allFilled || starting} onClick={start}>
            <Play size={16} /> {starting ? 'Opening...' : COPY.lobby.start}
          </Button>
        )}
      </div>

      {error && <div className="text-sm text-danger">{error}</div>}

      <RulesModal
        open={rulesOpen}
        onClose={() => setRulesOpen(false)}
        config={view.config}
      />
    </div>
  );
}

function ConfigItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wider text-text-muted">{label}</dt>
      <dd className="num text-text font-medium mt-0.5">{value}</dd>
    </div>
  );
}

function PresenceDot({ occupied, connected }: { occupied: boolean; connected: boolean }) {
  if (!occupied) return <span className="block w-2.5 h-2.5 rounded-full bg-line-strong" aria-label="Unassigned" />;
  if (connected) return <span className="block w-2.5 h-2.5 rounded-full bg-lime-700 animate-pulse-soft" aria-label="Connected" />;
  return <span className="block w-2.5 h-2.5 rounded-full bg-amber" aria-label="Disconnected" />;
}
