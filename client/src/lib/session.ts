// Client-side session/router state. One reducer for the whole app:
// - 'home': lobby is showing both Convene and Join entry points.
// - 'convening': filling out the Convene form.
// - 'joining': entered a code, picking a node.
// - 'briefing': session created and host is reviewing config; waiting for participants.
// - 'simulation': T >= 1, status === 'running'.
// - 'postmortem': session closed, post-mortem received.

import type { NodeView, PostMortem, NodeName } from './types';

export type Screen =
  | { kind: 'home' }
  | { kind: 'convening' }
  | { kind: 'joining'; code: string }
  | { kind: 'briefing'; isHost: boolean; code: string; node: NodeName | null; view: NodeView }
  | { kind: 'simulation'; code: string; node: NodeName; view: NodeView; isHost: boolean }
  | { kind: 'postmortem'; pm: PostMortem; isHost: boolean };

export type Action =
  | { type: 'goConvene' }
  | { type: 'goJoin'; code?: string }
  | { type: 'goHome' }
  | { type: 'sessionConvened'; code: string; node: NodeName; view: NodeView }
  | { type: 'sessionJoined'; code: string; node: NodeName; view: NodeView; isHost: boolean }
  | { type: 'stateUpdate'; view: NodeView }
  | { type: 'postMortem'; pm: PostMortem };

export const initial: Screen = { kind: 'home' };

export function reducer(state: Screen, action: Action): Screen {
  switch (action.type) {
    case 'goConvene':
      return { kind: 'convening' };
    case 'goJoin':
      return { kind: 'joining', code: action.code ?? '' };
    case 'goHome':
      return { kind: 'home' };
    case 'sessionConvened':
      return {
        kind: 'briefing',
        isHost: true,
        code: action.code,
        node: action.node,
        view: action.view,
      };
    case 'sessionJoined':
      if (action.view.status === 'running') {
        return {
          kind: 'simulation',
          code: action.code,
          node: action.node,
          view: action.view,
          isHost: action.isHost,
        };
      }
      return {
        kind: 'briefing',
        isHost: action.isHost,
        code: action.code,
        node: action.node,
        view: action.view,
      };
    case 'stateUpdate': {
      const v = action.view;
      if (state.kind === 'briefing' && v.status === 'running') {
        return {
          kind: 'simulation',
          code: state.code,
          node: state.node!,
          view: v,
          isHost: state.isHost,
        };
      }
      if (state.kind === 'simulation') {
        return { ...state, view: v };
      }
      if (state.kind === 'briefing') {
        return { ...state, view: v };
      }
      return state;
    }
    case 'postMortem': {
      const isHost = state.kind === 'simulation' ? state.isHost
        : state.kind === 'briefing' ? state.isHost
        : false;
      return { kind: 'postmortem', pm: action.pm, isHost };
    }
    default:
      return state;
  }
}
