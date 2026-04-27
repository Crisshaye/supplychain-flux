// Thin socket.io-client wrapper. Singleton; one socket per browser tab.

import { io, Socket } from 'socket.io-client';
import type {
  NodeView,
  PostMortem,
  NodeName,
  DemandProfile,
  ConveneResult,
} from './types';

let _socket: Socket | null = null;

export function getSocket(): Socket {
  if (_socket) return _socket;
  _socket = io({
    autoConnect: true,
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 500,
    reconnectionDelayMax: 5000,
  });
  return _socket;
}

function emitAck<T>(event: string, payload: unknown): Promise<T> {
  return new Promise((resolve, reject) => {
    getSocket().emit(event, payload, (resp: { ok: boolean; data?: T; error?: string }) => {
      if (!resp || !resp.ok) reject(new Error(resp?.error ?? 'unknown error'));
      else resolve(resp.data as T);
    });
  });
}

// ---- Commands ----

export function convene(input: {
  hostEmail: string;
  hostName?: string;
  T: number;
  demandProfile: DemandProfile;
  demandVector?: number[];
  decisionWindowSec: number;
}): Promise<ConveneResult> {
  return emitAck('convene', input);
}

export function joinSession(input: {
  code: string;
  node: NodeName;
  email: string;
  name?: string;
}): Promise<NodeView> {
  return emitAck('joinSession', input);
}

export function whereIsMyEmail(input: { code: string; email: string }): Promise<{ node: NodeName | null }> {
  return emitAck('whereIsMyEmail', input);
}

export function startSession(code: string): Promise<{ ok: true; t: number }> {
  return emitAck('startSession', { code });
}

export function submitSuggestion(code: string, quantity: number): Promise<{ ok: true }> {
  return emitAck('submitSuggestion', { code, quantity });
}

export function extendSession(
  code: string,
  additionalPeriods: number,
): Promise<{ T: number; status: string }> {
  return emitAck('extendSession', { code, additionalPeriods });
}

// ---- Subscriptions ----

export function onStateForNode(cb: (msg: { node: NodeName; state: NodeView }) => void) {
  const s = getSocket();
  s.on('stateForNode', cb);
  return () => s.off('stateForNode', cb);
}

export function onPostMortem(cb: (pm: PostMortem) => void) {
  const s = getSocket();
  s.on('postMortem', cb);
  return () => s.off('postMortem', cb);
}
