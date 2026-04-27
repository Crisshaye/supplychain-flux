// SupplyChain Flux router.
// Single reducer in lib/session.ts drives screen transitions; this file wires
// socket subscriptions to dispatch state-update actions, and renders the
// matching screen.

import { useEffect, useReducer, useState } from 'react';
import { Brand } from '@/components/Brand';
import { ConnectionBanner } from '@/components/ConnectionBanner';
import { COPY, PRODUCT } from '@/lib/copy';
import { reducer, initial, type Action } from '@/lib/session';
import { Lobby } from '@/screens/Lobby';
import { Briefing } from '@/screens/Briefing';
import { Simulation } from '@/screens/Simulation';
import { PostMortem } from '@/screens/PostMortem';
import * as api from '@/lib/socket';

export default function App() {
  const [state, dispatch] = useReducer(reducer, initial);
  const [myEmail, setMyEmail] = useState<string>('');

  // Persist email so reconnects from the same device don't have to retype.
  useEffect(() => {
    const saved = sessionStorage.getItem('scf:email');
    if (saved) setMyEmail(saved);
  }, []);

  // Capture email when we successfully join a session.
  useEffect(() => {
    if (state.kind === 'briefing' || state.kind === 'simulation') {
      // The reducer doesn't carry email in its state; pluck from the join action's
      // dispatch site. Instead, intercept the convene/join inputs at the form level.
      // The Lobby already calls api.joinSession with the email; we mirror the email
      // into sessionStorage from the form. See the dispatchWithEmail helper below.
    }
  }, [state]);

  // Wrap dispatch so we can sniff the email from session-init actions.
  function dispatchAndCapture(a: Action) {
    if (a.type === 'sessionConvened' || a.type === 'sessionJoined') {
      // The lobby form sets email in api.joinSession; we also need it locally for
      // identifying "me" in the team panel. Read from session view if available.
      const teamSelf = a.view.team.find((m) => m.email !== undefined);
      // teamSelf here is whoever, not necessarily us. Better: have the Lobby pass
      // email along by writing it to sessionStorage directly. Done in Lobby below.
      void teamSelf;
      const stored = sessionStorage.getItem('scf:email');
      if (stored) setMyEmail(stored);
    }
    dispatch(a);
  }

  // Subscribe to socket events while we have an active code.
  useEffect(() => {
    const codeNode =
      state.kind === 'briefing' || state.kind === 'simulation'
        ? { code: state.code, node: state.kind === 'simulation' ? state.node : state.node }
        : null;
    if (!codeNode) return;

    const offState = api.onStateForNode(({ node, state: view }) => {
      if (codeNode.node && node !== codeNode.node) return;
      dispatch({ type: 'stateUpdate', view });
    });
    const offPM = api.onPostMortem((pm) => {
      dispatch({ type: 'postMortem', pm });
    });
    return () => {
      offState();
      offPM();
    };
  }, [state.kind, (state as any).code, (state as any).node]);

  // Render
  return (
    <div className="min-h-screen bg-canvas">
      <ConnectionBanner />
      <header className="border-b border-line bg-surface print:hidden">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <Brand variant="chrome" />
          {(state.kind === 'simulation' || state.kind === 'briefing') && (
            <span className="text-xs text-text-muted">
              {COPY.sim.parameters} - press <kbd className="px-1.5 py-0.5 rounded bg-surface-inset border border-line text-[10px] num">?</kbd>
            </span>
          )}
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-10">
        {state.kind === 'home' && <Lobby dispatch={dispatchAndCapture} />}
        {state.kind === 'convening' && <Lobby initialMode="convening" dispatch={dispatchAndCapture} />}
        {state.kind === 'joining' && (
          <Lobby initialMode="joining" initialCode={state.code} dispatch={dispatchAndCapture} />
        )}
        {state.kind === 'briefing' && (
          <Briefing
            isHost={state.isHost}
            code={state.code}
            node={state.node}
            view={state.view}
          />
        )}
        {state.kind === 'simulation' && (
          <Simulation
            isHost={state.isHost}
            code={state.code}
            node={state.node}
            view={state.view}
            myEmail={myEmail}
          />
        )}
        {state.kind === 'postmortem' && (
          <PostMortem pm={state.pm} onRerun={() => window.location.reload()} />
        )}
      </main>

      <footer className="border-t border-line mt-16 py-6 print:hidden">
        <div className="max-w-6xl mx-auto px-6 text-xs text-text-muted">
          {PRODUCT.name} - {PRODUCT.subtitle}
        </div>
      </footer>
    </div>
  );
}
