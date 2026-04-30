// Operations Briefing - the entry surface.
// Two flows from here: Convene (host creates a session) and Join (participant enters a code).

import { useState } from 'react';
import { Building2, ChevronRight, Users, FileText, ArrowLeft } from 'lucide-react';
import { Button, Card, Field, Input, Select, Pill } from '@/components/ui';
import { Brand } from '@/components/Brand';
import { RulesModal } from '@/components/RulesModal';
import { COPY, DEMAND_LABEL, DEMAND_BLURB, NODE_LABEL, NODE_BLURB, PRODUCT } from '@/lib/copy';
import * as api from '@/lib/socket';
import type { DemandProfile, NodeName } from '@/lib/types';
import type { Action } from '@/lib/session';

type Mode = 'home' | 'convening' | 'joining';

interface Props {
  initialMode?: Mode;
  initialCode?: string;
  dispatch: (a: Action) => void;
}

export function Lobby({ initialMode = 'home', initialCode = '', dispatch }: Props) {
  const [mode, setMode] = useState<Mode>(initialMode);
  const [rulesOpen, setRulesOpen] = useState(false);

  return (
    <div className="space-y-8">
      <Hero onConvene={() => setMode('convening')} onJoin={() => setMode('joining')} onRules={() => setRulesOpen(true)} />

      {mode === 'convening' && (
        <ConveneCard onBack={() => setMode('home')} dispatch={dispatch} />
      )}
      {mode === 'joining' && (
        <JoinCard initialCode={initialCode} onBack={() => setMode('home')} dispatch={dispatch} />
      )}
      {mode === 'home' && <ContextStrip />}

      <RulesModal open={rulesOpen} onClose={() => setRulesOpen(false)} />
    </div>
  );
}

// ---------- Hero ----------

function Hero({ onConvene, onJoin, onRules }: { onConvene: () => void; onJoin: () => void; onRules: () => void }) {
  return (
    <section className="surface p-10">
      <Brand variant="lobby" className="mb-8" />
      <div className="max-w-2xl">
        <h1 className="font-display text-4xl font-semibold tracking-tight leading-tight text-fg">
          A four-stage supply chain.
          <br />
          <span className="text-fg-muted">Quantify the cost of imperfect information.</span>
        </h1>
        <p className="mt-5 text-fg-muted leading-relaxed">
          {PRODUCT.name} runs the canonical Beer Distribution Game as a
          90-minute stress test. Each node is operated by a team of one or
          more participants who suggest order quantities each period; the
          team's executed decision is the mode of those suggestions. Sessions
          close with an Analytical Post-Mortem benchmarking performance
          against the perfect-information optimum.
        </p>
      </div>
      <div className="mt-8 flex flex-wrap gap-3">
        <Button size="lg" onClick={onConvene}>
          <Building2 size={16} /> {COPY.lobby.convene}
        </Button>
        <Button size="lg" variant="secondary" onClick={onJoin}>
          <Users size={16} /> {COPY.lobby.join}
        </Button>
        <Button size="lg" variant="ghost" onClick={onRules}>
          <FileText size={16} /> {COPY.lobby.rules}
        </Button>
      </div>
    </section>
  );
}

// ---------- Convene ----------

function ConveneCard({ onBack, dispatch }: { onBack: () => void; dispatch: (a: Action) => void }) {
  const [hostEmail, setHostEmail] = useState('');
  const [hostName, setHostName] = useState('');
  const [T, setT] = useState(24);
  const [windowMin, setWindowMin] = useState(5);
  const [demandProfile, setDemandProfile] = useState<DemandProfile>('mit_step');
  const [hostNode, setHostNode] = useState<NodeName>('retailer');
  // Lead times
  const [Lo, setLo] = useState(1);
  const [Ls, setLs] = useState(2);
  const [Lp, setLp] = useState(2);
  // Cost parameters
  const [hCost, setHCost] = useState(1.0);
  const [bCost, setBCost] = useState(2.0);
  const [I0, setI0] = useState(12);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setSubmitting(true);
    setError(null);
    try {
      const res = await api.convene({
        hostEmail,
        hostName: hostName || undefined,
        T,
        demandProfile,
        decisionWindowSec: Math.max(60, Math.min(1800, Math.round(windowMin * 60))),
        L_o: Lo,
        L_s: Ls,
        L_p: Lp,
        h: hCost,
        b: bCost,
        I_0: I0,
      });
      const view = await api.joinSession({
        code: res.code,
        node: hostNode,
        email: hostEmail,
        name: hostName || undefined,
      });
      sessionStorage.setItem('scf:email', hostEmail.trim().toLowerCase());
      dispatch({ type: 'sessionConvened', code: res.code, node: hostNode, view });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  const tValid = T >= 8 && T <= 200;
  const windowValid = windowMin >= 1 && windowMin <= 30;
  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(hostEmail);
  const loValid = Number.isInteger(Lo) && Lo >= 1 && Lo <= 8;
  const lsValid = Number.isInteger(Ls) && Ls >= 1 && Ls <= 8;
  const lpValid = Number.isInteger(Lp) && Lp >= 1 && Lp <= 8;
  const hValid = hCost >= 0 && hCost <= 100;
  const bValid = bCost >= 0 && bCost <= 100;
  const i0Valid = Number.isInteger(I0) && I0 >= 0 && I0 <= 200;

  return (
    <Card
      title={
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="text-fg-muted hover:text-fg" aria-label="Back">
            <ArrowLeft size={18} />
          </button>
          {COPY.lobby.convene}
        </div>
      }
      subtitle="Configure simulation parameters and reserve a node position. A six-character session code will be generated for participants."
    >
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <Field
          label="Your email"
          hint="Used as your participant identity. Hosts can rejoin from any device with the same email."
          error={hostEmail && !emailValid ? 'Invalid email' : undefined}
        >
          <Input
            type="email"
            placeholder="you@company.com"
            value={hostEmail}
            onChange={(e) => setHostEmail(e.target.value)}
            autoFocus
          />
        </Field>

        <Field label="Your display name (optional)">
          <Input
            placeholder="e.g., Cristobal H."
            value={hostName}
            onChange={(e) => setHostName(e.target.value)}
            maxLength={40}
          />
        </Field>

        <Field
          label={COPY.lobby.periods}
          hint="Any integer between 8 and 200. You can extend mid-session."
          error={!tValid ? 'Must be between 8 and 200' : undefined}
        >
          <Input
            type="number"
            min={8}
            max={200}
            value={T}
            onChange={(e) => setT(Math.floor(Number(e.target.value) || 0))}
          />
        </Field>

        <Field
          label="Decision window (minutes per period)"
          hint="Period closes early if every connected participant has suggested. 1 to 30 minutes."
          error={!windowValid ? 'Must be between 1 and 30' : undefined}
        >
          <Input
            type="number"
            min={1}
            max={30}
            value={windowMin}
            onChange={(e) => setWindowMin(Math.max(1, Math.floor(Number(e.target.value) || 0)))}
          />
        </Field>

        <Field label={COPY.lobby.demandProfile} hint={DEMAND_BLURB[demandProfile]}>
          <Select value={demandProfile} onChange={(e) => setDemandProfile(e.target.value as DemandProfile)}>
            {(['mit_step', 'step_early', 'pulse', 'random_walk'] as DemandProfile[]).map((p) => (
              <option key={p} value={p}>{DEMAND_LABEL[p]}</option>
            ))}
          </Select>
        </Field>

        <Field label="Your node assignment" hint={NODE_BLURB[hostNode]}>
          <Select value={hostNode} onChange={(e) => setHostNode(e.target.value as NodeName)}>
            {(['retailer', 'wholesaler', 'distributor', 'factory'] as NodeName[]).map((n) => (
              <option key={n} value={n}>{NODE_LABEL[n]}</option>
            ))}
          </Select>
        </Field>
      </div>

      {/* Lead times + cost parameters */}
      <div className="mt-5 border-t border-line pt-5">
        <p className="text-xs font-medium text-fg-muted uppercase tracking-wider mb-4">Lead times &amp; cost parameters</p>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <Field
            label="Order lead time L_o (periods)"
            hint="Periods for an order to reach the upstream node. Default: 1."
            error={!loValid ? 'Integer 1–8' : undefined}
          >
            <Input
              type="number"
              min={1}
              max={8}
              value={Lo}
              onChange={(e) => setLo(Math.floor(Number(e.target.value) || 1))}
            />
          </Field>

          <Field
            label="Shipment lead time L_s (periods)"
            hint="Periods for goods to travel downstream. Default: 2."
            error={!lsValid ? 'Integer 1–8' : undefined}
          >
            <Input
              type="number"
              min={1}
              max={8}
              value={Ls}
              onChange={(e) => setLs(Math.floor(Number(e.target.value) || 2))}
            />
          </Field>

          <Field
            label="Production lead time L_p (periods)"
            hint="Factory-only: periods to produce goods. Default: 2."
            error={!lpValid ? 'Integer 1–8' : undefined}
          >
            <Input
              type="number"
              min={1}
              max={8}
              value={Lp}
              onChange={(e) => setLp(Math.floor(Number(e.target.value) || 2))}
            />
          </Field>

          <Field
            label="Holding cost h ($/unit/period)"
            hint="Cost per unit held in inventory each period. Default: $1.00."
            error={!hValid ? 'Must be 0–100' : undefined}
          >
            <Input
              type="number"
              min={0}
              max={100}
              step={0.1}
              value={hCost}
              onChange={(e) => setHCost(Number(e.target.value) || 0)}
            />
          </Field>

          <Field
            label="Backlog cost b ($/unit/period)"
            hint="Penalty per unfilled unit of demand each period. Default: $2.00."
            error={!bValid ? 'Must be 0–100' : undefined}
          >
            <Input
              type="number"
              min={0}
              max={100}
              step={0.1}
              value={bCost}
              onChange={(e) => setBCost(Number(e.target.value) || 0)}
            />
          </Field>

          <Field
            label="Starting inventory I_0 (units)"
            hint="Initial on-hand inventory at each node. Default: 12."
            error={!i0Valid ? 'Integer 0–200' : undefined}
          >
            <Input
              type="number"
              min={0}
              max={200}
              value={I0}
              onChange={(e) => setI0(Math.floor(Number(e.target.value) || 0))}
            />
          </Field>
        </div>
      </div>

      {error && <div className="mt-4 text-sm text-danger">{error}</div>}

      <div className="mt-6 flex justify-end gap-3">
        <Button variant="ghost" onClick={onBack}>Cancel</Button>
        <Button
          disabled={!tValid || !windowValid || !emailValid || !loValid || !lsValid || !lpValid || !hValid || !bValid || !i0Valid || submitting}
          onClick={submit}
        >
          {submitting ? 'Convening...' : 'Convene'} <ChevronRight size={14} />
        </Button>
      </div>
    </Card>
  );
}

// ---------- Join ----------

function JoinCard({ initialCode, onBack, dispatch }: { initialCode: string; onBack: () => void; dispatch: (a: Action) => void }) {
  const [code, setCode] = useState(initialCode.toUpperCase());
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [node, setNode] = useState<NodeName>('retailer');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setSubmitting(true);
    setError(null);
    try {
      const view = await api.joinSession({ code, node, email, name: name || undefined });
      sessionStorage.setItem('scf:email', email.trim().toLowerCase());
      dispatch({ type: 'sessionJoined', code, node, view, isHost: false });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  const codeValid = /^[A-Z2-9]{6}$/.test(code);
  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

  return (
    <Card
      title={
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="text-fg-muted hover:text-fg" aria-label="Back">
            <ArrowLeft size={18} />
          </button>
          {COPY.lobby.join}
        </div>
      }
      subtitle="Enter the six-character session code provided by the host, your email, and the node your team will operate."
    >
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <Field
          label="Session code"
          hint="Six characters, uppercase letters and digits."
          error={code && !codeValid ? 'Invalid format' : undefined}
        >
          <Input
            placeholder="ABCXYZ"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6))}
            maxLength={6}
            autoFocus
            className="uppercase tracking-widest text-lg"
          />
        </Field>

        <Field
          label="Your email"
          hint="Used as your participant identity. You can rejoin from any device with the same email."
          error={email && !emailValid ? 'Invalid email' : undefined}
        >
          <Input
            type="email"
            placeholder="you@company.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </Field>

        <Field label="Display name (optional)">
          <Input
            placeholder="e.g., Cristobal H."
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={40}
          />
        </Field>

        <Field label="Node" hint={NODE_BLURB[node]}>
          <Select value={node} onChange={(e) => setNode(e.target.value as NodeName)}>
            {(['retailer', 'wholesaler', 'distributor', 'factory'] as NodeName[]).map((n) => (
              <option key={n} value={n}>{NODE_LABEL[n]}</option>
            ))}
          </Select>
        </Field>
      </div>

      {error && <div className="mt-4 text-sm text-danger">{error}</div>}

      <div className="mt-6 flex justify-end gap-3">
        <Button variant="ghost" onClick={onBack}>Cancel</Button>
        <Button disabled={!codeValid || !emailValid || submitting} onClick={submit}>
          {submitting ? 'Joining...' : 'Take node position'} <ChevronRight size={14} />
        </Button>
      </div>
    </Card>
  );
}

// ---------- Context strip ----------

function ContextStrip() {
  const items = [
    { label: 'Origin', body: 'Forrester / Sterman beer distribution game, MIT Sloan, 1960s.' },
    { label: 'Cohort', body: 'Up to 25 concurrent four-node sessions. Teams of any size per node.' },
    { label: 'Deliverable', body: 'Analytical Post-Mortem with bullwhip ratios and a perfect-information benchmark.' },
  ];
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {items.map((it) => (
        <div key={it.label} className="surface p-5">
          <Pill tone="info" className="mb-3">{it.label}</Pill>
          <p className="text-sm text-fg-muted leading-relaxed">{it.body}</p>
        </div>
      ))}
    </div>
  );
}
