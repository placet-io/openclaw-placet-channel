// ---------------------------------------------------------------------------
// Placet Channel Plugin – WebSocket Client
// ---------------------------------------------------------------------------
// Socket.IO client that connects to the Placet /ws namespace.
// Handles authentication, channel subscriptions, auto-reconnect, and
// dispatches inbound events to registered listeners.
// ---------------------------------------------------------------------------

import { io, type Socket } from 'socket.io-client';
import type {
  MessageDeliveryEvent,
  PlacetMessage,
  ReviewExpiredEvent,
} from './types.js';

// ── Event types ─────────────────────────────────────────────────────────────

export type PlacetWsStatus = 'connected' | 'connecting' | 'disconnected' | 'error';

export interface PlacetWsEvents {
  'message:created': (message: PlacetMessage) => void;
  'review:responded': (message: PlacetMessage) => void;
  'review:expired': (event: ReviewExpiredEvent) => void;
  'message:delivery': (event: MessageDeliveryEvent) => void;
  statusChange: (status: PlacetWsStatus) => void;
}

type EventName = keyof PlacetWsEvents;

// ── Client ──────────────────────────────────────────────────────────────────

export class PlacetWsClient {
  private socket: Socket | null = null;
  private status: PlacetWsStatus = 'disconnected';
  private readonly listeners = new Map<EventName, Set<(...args: any[]) => void>>();
  private subscribedChannels = new Set<string>();

  private readonly instanceUrl: string;
  private readonly apiKey: string;

  constructor(config: { instanceUrl: string; apiKey: string }) {
    this.instanceUrl = config.instanceUrl.replace(/\/+$/, '');
    this.apiKey = config.apiKey;
  }

  // ── Lifecycle ───────────────────────────────────────────────

  connect(): void {
    if (this.socket?.connected) return;

    this.setStatus('connecting');

    this.socket = io(`${this.instanceUrl}/ws`, {
      auth: { apiKey: this.apiKey },
      transports: ['websocket'],
      reconnection: true,
      reconnectionDelay: 1_000,
      reconnectionDelayMax: 30_000,
      reconnectionAttempts: Infinity,
    });

    this.socket.on('connect', () => {
      this.setStatus('connected');
      // Resubscribe to channels after reconnection
      for (const channelId of this.subscribedChannels) {
        this.socket?.emit('subscribe:channel', channelId);
      }
    });

    this.socket.on('disconnect', () => {
      this.setStatus('disconnected');
    });

    this.socket.on('connect_error', () => {
      this.setStatus('error');
    });

    // Wire up Placet events
    this.socket.on('message:created', (message: PlacetMessage) => {
      this.emit('message:created', message);
    });

    this.socket.on('review:responded', (message: PlacetMessage) => {
      this.emit('review:responded', message);
    });

    this.socket.on('review:expired', (event: ReviewExpiredEvent) => {
      this.emit('review:expired', event);
    });

    this.socket.on('message:delivery', (event: MessageDeliveryEvent) => {
      this.emit('message:delivery', event);
    });
  }

  disconnect(): void {
    this.subscribedChannels.clear();
    if (this.socket) {
      this.socket.removeAllListeners();
      this.socket.disconnect();
      this.socket = null;
    }
    this.setStatus('disconnected');
  }

  // ── Channel subscriptions ───────────────────────────────────

  subscribeToChannel(channelId: string): void {
    this.subscribedChannels.add(channelId);
    if (this.socket?.connected) {
      this.socket.emit('subscribe:channel', channelId);
    }
  }

  unsubscribeFromChannel(channelId: string): void {
    this.subscribedChannels.delete(channelId);
    if (this.socket?.connected) {
      this.socket.emit('unsubscribe:channel', channelId);
    }
  }

  // ── Event emitter ───────────────────────────────────────────

  on<E extends EventName>(event: E, listener: PlacetWsEvents[E]): void {
    let set = this.listeners.get(event);
    if (!set) {
      set = new Set();
      this.listeners.set(event, set);
    }
    set.add(listener as (...args: any[]) => void);
  }

  off<E extends EventName>(event: E, listener: PlacetWsEvents[E]): void {
    this.listeners.get(event)?.delete(listener as (...args: any[]) => void);
  }

  getStatus(): PlacetWsStatus {
    return this.status;
  }

  // ── Internal ────────────────────────────────────────────────

  private emit<E extends EventName>(event: E, ...args: Parameters<PlacetWsEvents[E]>): void {
    const set = this.listeners.get(event);
    if (!set) return;
    for (const listener of set) {
      try {
        listener(...args);
      } catch {
        // Swallow listener errors to prevent breaking the event loop
      }
    }
  }

  private setStatus(status: PlacetWsStatus): void {
    if (this.status === status) return;
    this.status = status;
    this.emit('statusChange', status);
  }
}
