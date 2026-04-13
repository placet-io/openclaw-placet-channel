// ---------------------------------------------------------------------------
// Placet Channel Plugin – Background Service
// ---------------------------------------------------------------------------
// Manages the persistent Socket.IO connection lifecycle, agent auto-creation,
// and periodic heartbeat pings. Registered via api.registerService().
// ---------------------------------------------------------------------------

import { PlacetClient } from './client.js';
import { PlacetWsClient } from './ws-client.js';
import { attachInboundHandlers, type InboundDispatcher } from './inbound.js';
import type { PlacetChannelConfig, PlacetAgent } from './types.js';

export interface PlacetServiceOptions {
  config: PlacetChannelConfig;
  dispatcher: InboundDispatcher;
  log?: (...args: unknown[]) => void;
}

export class PlacetService {
  private readonly client: PlacetClient;
  private readonly ws: PlacetWsClient;
  private readonly config: PlacetChannelConfig;
  private readonly dispatcher: InboundDispatcher;
  private readonly log: (...args: unknown[]) => void;

  private agent: PlacetAgent | null = null;
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private detachInbound: (() => void) | null = null;

  constructor(opts: PlacetServiceOptions) {
    this.config = opts.config;
    this.dispatcher = opts.dispatcher;
    this.log = opts.log ?? console.log;

    this.client = new PlacetClient({
      instanceUrl: opts.config.instanceUrl,
      apiKey: opts.config.apiKey,
    });

    this.ws = new PlacetWsClient({
      instanceUrl: opts.config.instanceUrl,
      apiKey: opts.config.apiKey,
    });
  }

  // ── Public API ──────────────────────────────────────────────

  async start(): Promise<void> {
    // 1. Resolve or create the Placet agent
    this.agent = await this.resolveAgent();
    this.log(`[placet] Using agent "${this.agent.name}" (${this.agent.id})`);

    // 2. Attach inbound event handlers
    this.detachInbound = attachInboundHandlers(this.ws, this.dispatcher);

    // 3. Connect WebSocket and subscribe to the agent channel
    this.ws.connect();
    this.ws.subscribeToChannel(this.agent.id);

    // 4. Start heartbeat (every 60 seconds)
    await this.ping('active');
    this.heartbeatTimer = setInterval(() => {
      void this.ping('active');
    }, 60_000);
  }

  async stop(): Promise<void> {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }

    this.detachInbound?.();
    this.detachInbound = null;

    // Best-effort offline ping before disconnecting
    if (this.agent) {
      await this.ping('offline').catch(() => {});
    }

    this.ws.disconnect();
    this.agent = null;
  }

  getClient(): PlacetClient {
    return this.client;
  }

  getAgent(): PlacetAgent | null {
    return this.agent;
  }

  getAgentId(): string {
    if (!this.agent) throw new Error('[placet] Service not started — no agent available');
    return this.agent.id;
  }

  // ── Internal ────────────────────────────────────────────────

  private async resolveAgent(): Promise<PlacetAgent> {
    // If agentId is provided, use it directly (we trust the user's config)
    if (this.config.agentId) {
      const agents = await this.client.listAgents();
      const existing = agents.find((a) => a.id === this.config.agentId);
      if (existing) return existing;
      this.log(`[placet] Configured agentId "${this.config.agentId}" not found, creating new agent`);
    }

    // Look for an existing agent by name
    const agentName = this.config.agentName ?? 'OpenClaw Agent';
    const agents = await this.client.listAgents();
    const byName = agents.find((a) => a.name === agentName);
    if (byName) return byName;

    // Create a new agent
    this.log(`[placet] Creating agent "${agentName}"`);
    return this.client.createAgent({
      name: agentName,
      description: 'Auto-created by OpenClaw Placet channel plugin',
    });
  }

  private async ping(status: 'active' | 'offline'): Promise<void> {
    if (!this.agent) return;
    try {
      await this.client.pingStatus({
        agentId: this.agent.id,
        status,
        message: status === 'active' ? 'OpenClaw connected' : 'OpenClaw disconnected',
      });
    } catch (err) {
      this.log('[placet] Heartbeat ping failed:', err);
    }
  }
}
