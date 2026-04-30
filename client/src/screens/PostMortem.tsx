// Analytical Post-Mortem.
// Reveals: bullwhip chart (orders per node + customer demand), per-node
// amplification ratios, cost decomposition, theoretical-optimum line,
// CSV decision-log export, PDF export via browser print.

import { useMemo } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  BarChart,
  Bar,
  ReferenceLine,
} from 'recharts';
import { Download, Printer, RotateCcw } from 'lucide-react';
import Papa from 'papaparse';
import { Button, Card, Pill } from '@/components/ui';
import { Brand } from '@/components/Brand';
import { COPY, NODE_LABEL, DEMAND_LABEL } from '@/lib/copy';
import { fmtUSD, cn } from '@/lib/cn';
import type { PostMortem, NodeName } from '@/lib/types';

const NODE_ORDER: NodeName[] = ['retailer', 'wholesaler', 'distributor', 'factory'];

// Distinct stroke per node; uses brand-adjacent values so the chart stays
// on-brand without yelling.
const NODE_STROKE: Record<NodeName, string> = {
  retailer: '#1B263B',
  wholesaler: '#415A77',
  distributor: '#7C93AE',
  factory: '#2F7B53',
};
const DEMAND_STROKE = '#D8F3DC';

interface Props {
  pm: PostMortem;
  onRerun: () => void;
}

export function PostMortem({ pm, onRerun }: Props) {
  const orderSeries = useMemo(() => {
    const T = pm.demandSeries.length;
    return Array.from({ length: T }, (_, i) => {
      const row: Record<string, number> = { t: i + 1, demand: pm.demandSeries[i] };
      for (const n of NODE_ORDER) row[n] = pm.perNode[n].orders[i] ?? 0;
      return row;
    });
  }, [pm]);

  const cumulativeSeries = useMemo(() => {
    const T = pm.demandSeries.length;
    return Array.from({ length: T }, (_, i) => {
      const row: Record<string, number> = { t: i + 1 };
      for (const n of NODE_ORDER) row[n] = pm.perNode[n].cumulativeCostSeries[i] ?? 0;
      const optShare = (pm.theoreticalOptimum / T) * (i + 1);
      row.optimum = optShare;
      return row;
    });
  }, [pm]);

  const ampBars = useMemo(
    () => NODE_ORDER.map((n) => ({
      node: NODE_LABEL[n],
      amp: pm.perNode[n].amplification ?? 0,
    })),
    [pm],
  );

  const costDecomp = useMemo(
    () => NODE_ORDER.map((n) => {
      const onHand = pm.perNode[n].onHandSeries.reduce((a, c) => a + c * pm.config.h, 0);
      const back = pm.perNode[n].backlogSeries.reduce((a, c) => a + c * pm.config.b, 0);
      return { node: NODE_LABEL[n], holding: onHand, backlog: back };
    }),
    [pm],
  );

  function exportCsv() {
    const T = pm.demandSeries.length;
    const rows: Array<Record<string, string | number>> = [];
    for (let i = 0; i < T; i++) {
      for (const n of NODE_ORDER) {
        const sugs = pm.perNode[n].suggestionsByPeriod[i]?.suggestions ?? {};
        rows.push({
          period: i + 1,
          customer_demand: pm.demandSeries[i],
          node: n,
          executed: pm.perNode[n].orders[i],
          on_hand_close: pm.perNode[n].onHandSeries[i],
          backlog_close: pm.perNode[n].backlogSeries[i],
          period_cost: pm.perNode[n].periodCosts[i],
          cumulative_cost: pm.perNode[n].cumulativeCostSeries[i],
          tied: pm.perNode[n].tiedPeriods.includes(i + 1) ? 1 : 0,
          auto_decided: pm.perNode[n].autoDecidedPeriods.includes(i + 1) ? 1 : 0,
          team_size: pm.perNode[n].teamRoster.length,
          suggestions: Object.entries(sugs).map(([e, q]) => `${e}=${q}`).join('; '),
        });
      }
    }
    const csv = Papa.unparse(rows);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `supplychain_flux_${pm.code}_log.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function exportPdf() {
    window.print();
  }

  return (
    <div className="space-y-6">
      <div className="surface p-8 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <Brand variant="lobby" />
          <h1 className="font-display text-3xl font-semibold mt-4">{COPY.pm.title}</h1>
          <p className="text-fg-muted mt-2">
            Session <span className="num font-medium">{pm.code}</span> -{' '}
            {DEMAND_LABEL[pm.config.demandProfile]}, {pm.config.T} periods.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={exportCsv}>
            <Download size={14} /> {COPY.pm.exportCsv}
          </Button>
          <Button variant="secondary" onClick={exportPdf}>
            <Printer size={14} /> {COPY.pm.exportPdf}
          </Button>
          <Button onClick={onRerun}>
            <RotateCcw size={14} /> {COPY.pm.rerun}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <HeadlineMetric label="Total landed cost" value={fmtUSD(pm.totalLandedCost)} />
        <HeadlineMetric
          label={COPY.pm.optimum}
          value={fmtUSD(pm.theoreticalOptimum)}
          sub={`Realized / optimum: ${(pm.totalLandedCost / pm.theoreticalOptimum).toFixed(2)}x`}
        />
        <HeadlineMetric
          label="Highest amplification"
          value={maxAmpLabel(pm)}
          sub="Bullwhip ratio peak"
        />
        <HeadlineMetric
          label="Service level (avg)"
          value={`${(avgServiceLevel(pm) * 100).toFixed(1)}%`}
          sub="Across all four nodes"
        />
      </div>

      <Card title="Order trajectories vs. customer demand" subtitle="Orders amplify upstream - this is the bullwhip effect.">
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={orderSeries}>
              <CartesianGrid stroke="#E2E8F0" strokeDasharray="3 3" />
              <XAxis dataKey="t" stroke="#475569" fontSize={12} />
              <YAxis stroke="#475569" fontSize={12} />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#FFFFFF',
                  border: '1px solid #CBD5E1',
                  borderRadius: 8,
                  fontSize: 12,
                }}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Line type="monotone" dataKey="demand" name="Customer demand" stroke={DEMAND_STROKE} strokeWidth={3} dot={false} />
              {NODE_ORDER.map((n) => (
                <Line
                  key={n}
                  type="monotone"
                  dataKey={n}
                  name={NODE_LABEL[n]}
                  stroke={NODE_STROKE[n]}
                  strokeWidth={2}
                  dot={false}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card title={COPY.pm.bullwhip} subtitle="Var(orders) / Var(demand). Values above 1 = amplification.">
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={ampBars}>
                <CartesianGrid stroke="#E2E8F0" strokeDasharray="3 3" />
                <XAxis dataKey="node" stroke="#475569" fontSize={12} />
                <YAxis stroke="#475569" fontSize={12} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#FFFFFF',
                    border: '1px solid #CBD5E1',
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                  formatter={(v: number) => v.toFixed(2)}
                />
                <ReferenceLine y={1} stroke="#475569" strokeDasharray="4 4" />
                <Bar dataKey="amp" name="Amplification" fill="#1B263B" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card title={COPY.pm.costDecomp} subtitle="Holding vs. backlog cost per node.">
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={costDecomp}>
                <CartesianGrid stroke="#E2E8F0" strokeDasharray="3 3" />
                <XAxis dataKey="node" stroke="#475569" fontSize={12} />
                <YAxis stroke="#475569" fontSize={12} tickFormatter={(v) => `$${v}`} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#FFFFFF',
                    border: '1px solid #CBD5E1',
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                  formatter={(v: number) => fmtUSD(v)}
                />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="holding" name="Holding cost" stackId="cost" fill="#415A77" />
                <Bar dataKey="backlog" name="Backlog cost" stackId="cost" fill="#F59E0B" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      <Card title="Cumulative landed cost by node" subtitle="Dashed line: linear share of the perfect-information benchmark.">
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={cumulativeSeries}>
              <CartesianGrid stroke="#E2E8F0" strokeDasharray="3 3" />
              <XAxis dataKey="t" stroke="#475569" fontSize={12} />
              <YAxis stroke="#475569" fontSize={12} tickFormatter={(v) => `$${v}`} />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#FFFFFF',
                  border: '1px solid #CBD5E1',
                  borderRadius: 8,
                  fontSize: 12,
                }}
                formatter={(v: number) => fmtUSD(v)}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              {NODE_ORDER.map((n) => (
                <Line key={n} type="monotone" dataKey={n} name={NODE_LABEL[n]} stroke={NODE_STROKE[n]} strokeWidth={2} dot={false} />
              ))}
              <Line type="monotone" dataKey="optimum" name="Optimum" stroke="#475569" strokeDasharray="6 4" strokeWidth={1.5} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {NODE_ORDER.map((n) => (
          <NodeBreakdown key={n} pm={pm} node={n} />
        ))}
      </div>
    </div>
  );
}

function HeadlineMetric({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="surface p-5">
      <div className="text-xs uppercase tracking-wider text-fg-muted">{label}</div>
      <div className="num font-display font-semibold text-3xl text-fg mt-1">{value}</div>
      {sub && <div className="text-xs text-fg-muted mt-1">{sub}</div>}
    </div>
  );
}

function NodeBreakdown({ pm, node }: { pm: PostMortem; node: NodeName }) {
  const data = pm.perNode[node];
  const tiedCount = data.tiedPeriods.length;
  const autoCount = data.autoDecidedPeriods.length;
  return (
    <Card
      title={NODE_LABEL[node]}
      subtitle={`Team of ${data.teamRoster.length} - ${fmtUSD(data.cumulativeCost)} total cost`}
      trailing={
        <div className="flex flex-col items-end gap-1">
          <Pill tone="info">amp {data.amplification?.toFixed(2) ?? 'n/a'}x</Pill>
          <Pill tone={data.serviceLevel > 0.95 ? 'success' : 'warn'}>
            service {(data.serviceLevel * 100).toFixed(1)}%
          </Pill>
        </div>
      }
    >
      {data.teamRoster.length > 0 && (
        <div className="mb-4">
          <div className="text-xs uppercase tracking-wider text-fg-muted mb-2">Team members</div>
          <div className="flex flex-wrap gap-1.5">
            {data.teamRoster.map((m) => (
              <span key={m.email} className="text-xs bg-surface-inset rounded px-2 py-1">
                {m.name ?? m.email}
              </span>
            ))}
          </div>
        </div>
      )}
      {(tiedCount > 0 || autoCount > 0) && (
        <div className="text-xs text-fg-muted space-y-1">
          {tiedCount > 0 && <div><span className="text-amber">*</span> {tiedCount} tie-broken period{tiedCount === 1 ? '' : 's'}: {data.tiedPeriods.join(', ')}</div>}
          {autoCount > 0 && <div><span className="text-amber">!</span> {autoCount} auto-decided period{autoCount === 1 ? '' : 's'}: {data.autoDecidedPeriods.join(', ')}</div>}
        </div>
      )}
      <div className="mt-3 grid grid-cols-3 gap-3 text-center">
        <MiniStat label="Mean order" value={mean(data.orders).toFixed(1)} />
        <MiniStat label="Order σ" value={Math.sqrt(variance(data.orders)).toFixed(1)} />
        <MiniStat label="Avg on-hand" value={mean(data.onHandSeries).toFixed(1)} />
      </div>
    </Card>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="surface-inset p-2.5">
      <div className="text-[10px] uppercase tracking-wider text-fg-muted">{label}</div>
      <div className={cn('num font-display font-semibold text-lg text-fg')}>{value}</div>
    </div>
  );
}

// ---- helpers (kept local to avoid bloating the lib) ----

function mean(xs: number[]) {
  if (xs.length === 0) return 0;
  return xs.reduce((a, c) => a + c, 0) / xs.length;
}
function variance(xs: number[]) {
  if (xs.length === 0) return 0;
  const m = mean(xs);
  return xs.reduce((a, c) => a + (c - m) ** 2, 0) / xs.length;
}
function maxAmpLabel(pm: PostMortem) {
  let best: NodeName = 'retailer';
  let bestVal = -Infinity;
  for (const n of NODE_ORDER) {
    const a = pm.perNode[n].amplification ?? 0;
    if (a > bestVal) { bestVal = a; best = n; }
  }
  return `${bestVal.toFixed(2)}x (${NODE_LABEL[best]})`;
}
function avgServiceLevel(pm: PostMortem) {
  return mean(NODE_ORDER.map((n) => pm.perNode[n].serviceLevel));
}
