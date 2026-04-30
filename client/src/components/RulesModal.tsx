// Rules of Engagement: dense parameter table, executive tone.
// Mirrors RULES.md section 2.

import { Modal, Button } from './ui';
import { Download } from 'lucide-react';

interface Props {
  open: boolean;
  onClose: () => void;
  config?: {
    L_o: number;
    L_s: number;
    L_p: number;
    h: number;
    b: number;
    I_0: number;
  };
}

const DEFAULT_CONFIG = { L_o: 1, L_s: 2, L_p: 2, h: 1, b: 2, I_0: 12 };

export function RulesModal({ open, onClose, config = DEFAULT_CONFIG }: Props) {
  const handlePrint = () => window.print();

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Rules of Engagement"
      size="xl"
      footer={
        <div className="flex justify-between items-center">
          <p className="text-xs text-fg-muted">
            Reference parameters for this simulation. Print or export PDF to brief participants.
          </p>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={handlePrint}>
              <Download size={14} /> Export PDF
            </Button>
            <Button onClick={onClose}>Close</Button>
          </div>
        </div>
      }
    >
      <div className="space-y-6">
        <p className="text-sm text-fg-muted leading-relaxed">
          A four-node serial supply chain. Information (orders) flows upstream;
          product (shipments) flows downstream. Each node decides how much to
          order from its upstream supplier each period, observing only its own
          incoming orders and inventory position.
        </p>

        <div>
          <h3 className="text-sm font-display font-semibold mb-3 text-fg">
            Parameters
          </h3>
          <div className="overflow-hidden rounded-md border border-line">
            <table className="w-full text-sm">
              <thead className="bg-surface-inset text-fg-muted">
                <tr>
                  <th className="text-left font-medium px-4 py-2">Variable</th>
                  <th className="text-left font-medium px-4 py-2">Symbol</th>
                  <th className="text-right font-medium px-4 py-2">Value</th>
                  <th className="text-left font-medium px-4 py-2">Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                <Row name="Order lead time" sym="L_o" value={`${config.L_o} period`}
                  note="Order placed at t arrives upstream at t+1." />
                <Row name="Shipment lead time" sym="L_s" value={`${config.L_s} periods`}
                  note="Shipment dispatched at t arrives downstream at t+2." />
                <Row name="Production lead time" sym="L_p" value={`${config.L_p} periods`}
                  note="Factory production order at t yields finished goods at t+2." />
                <Row name="Holding cost" sym="h" value={`$${config.h.toFixed(2)} / unit / period`}
                  note="Charged on end-of-period on-hand inventory." />
                <Row name="Backlog cost" sym="b" value={`$${config.b.toFixed(2)} / unit / period`}
                  note="Charged on end-of-period unfulfilled demand." />
                <Row name="Starting inventory" sym="I_0" value={`${config.I_0} units`}
                  note="Per node. Plus 1 in-flight order and 2 in-flight shipments at steady state." />
              </tbody>
            </table>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          <div className="surface-inset p-4">
            <div className="font-display font-semibold mb-1">Decision space</div>
            <p className="text-fg-muted">
              Each period, you submit one integer order quantity (zero or above)
              for your upstream supplier. The simulation advances once all four
              nodes have submitted.
            </p>
          </div>
          <div className="surface-inset p-4">
            <div className="font-display font-semibold mb-1">Cost objective</div>
            <p className="text-fg-muted">
              Minimize your node&apos;s total landed cost,{' '}
              <span className="num">TLC = sum of (h * onHand + b * backlog)</span>{' '}
              across all periods. Cumulative cost is private during play and
              revealed at Post-Mortem.
            </p>
          </div>
          <div className="surface-inset p-4">
            <div className="font-display font-semibold mb-1">Bullwhip metric</div>
            <p className="text-fg-muted">
              Per-node amplification ratio Var(orders) / Var(demand). Values
              above 1 demonstrate the bullwhip effect.
            </p>
          </div>
          <div className="surface-inset p-4">
            <div className="font-display font-semibold mb-1">Disconnect policy</div>
            <p className="text-fg-muted">
              If a node misses the 90-second decision window, the engine repeats
              the previous period&apos;s decision automatically. The Post-Mortem
              flags any auto-decided periods.
            </p>
          </div>
        </div>
      </div>
    </Modal>
  );
}

function Row({ name, sym, value, note }: { name: string; sym: string; value: string; note: string }) {
  return (
    <tr>
      <td className="px-4 py-2 text-fg">{name}</td>
      <td className="px-4 py-2 text-fg-muted font-mono text-xs">{sym}</td>
      <td className="px-4 py-2 text-right num text-fg font-medium">{value}</td>
      <td className="px-4 py-2 text-fg-muted">{note}</td>
    </tr>
  );
}
