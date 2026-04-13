// ---------------------------------------------------------------------------
// Placet Channel Plugin – REST API Client
// ---------------------------------------------------------------------------
// Typed fetch wrapper for the Placet Agent API (v1).
// Uses native fetch (Node ≥ 22) — no external HTTP library needed.
// ---------------------------------------------------------------------------

import type {
  CreateAgentDto,
  PingStatusDto,
  PlacetAgent,
  PlacetMessage,
  SendMessageDto,
} from './types.js';

// ── Error ───────────────────────────────────────────────────────────────────

export class PlacetApiError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly body: string,
  ) {
    super(`Placet API error ${statusCode}: ${body}`);
    this.name = 'PlacetApiError';
  }
}

// ── Client ──────────────────────────────────────────────────────────────────

export class PlacetClient {
  private readonly baseUrl: string;
  private readonly headers: Record<string, string>;

  constructor(config: { instanceUrl: string; apiKey: string }) {
    // Strip trailing slash to avoid double-slash in URLs
    this.baseUrl = config.instanceUrl.replace(/\/+$/, '');
    this.headers = {
      'x-api-key': config.apiKey,
      'Content-Type': 'application/json',
    };
  }

  // ── Agents ──────────────────────────────────────────────────

  async listAgents(): Promise<PlacetAgent[]> {
    return this.get('/api/v1/agents');
  }

  async createAgent(dto: CreateAgentDto): Promise<PlacetAgent> {
    return this.post('/api/v1/agents', dto);
  }

  // ── Messages ────────────────────────────────────────────────

  async sendMessage(dto: SendMessageDto): Promise<PlacetMessage> {
    return this.post('/api/v1/messages', dto);
  }

  async acknowledgeMessage(id: string, channelId: string): Promise<{ acknowledged: boolean }> {
    return this.post(`/api/v1/messages/${enc(id)}/ack?channel=${enc(channelId)}`, {});
  }

  // ── Reviews ─────────────────────────────────────────────────

  async waitForReview(
    id: string,
    channelId: string,
    timeout = 30_000,
  ): Promise<{ status: 'completed' | 'expired' | 'timeout'; message?: PlacetMessage }> {
    return this.get(
      `/api/v1/reviews/${enc(id)}/wait?channel=${enc(channelId)}&timeout=${timeout}`,
    );
  }

  // ── Status ──────────────────────────────────────────────────

  async pingStatus(dto: PingStatusDto): Promise<Record<string, unknown>> {
    return this.post('/api/v1/status/ping', dto);
  }

  // ── Files ───────────────────────────────────────────────────

  async uploadFile(
    channelId: string,
    file: { filename: string; mimeType: string; data: Uint8Array },
  ): Promise<{ id: string }> {
    const formData = new FormData();
    formData.append('channel', channelId);
    formData.append('file', new Blob([file.data.buffer as ArrayBuffer], { type: file.mimeType }), file.filename);

    const res = await fetch(`${this.baseUrl}/api/v1/files/upload`, {
      method: 'POST',
      headers: { 'x-api-key': this.headers['x-api-key'] },
      body: formData,
    });
    return this.handleResponse(res);
  }

  async downloadFile(id: string): Promise<{ data: ArrayBuffer; mimeType: string }> {
    const res = await fetch(`${this.baseUrl}/api/v1/files/${enc(id)}/download`, {
      method: 'GET',
      headers: { 'x-api-key': this.headers['x-api-key'] },
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new PlacetApiError(res.status, text || res.statusText);
    }
    const mimeType = res.headers.get('content-type') ?? 'application/octet-stream';
    const data = await res.arrayBuffer();
    return { data, mimeType };
  }

  // ── HTTP helpers ────────────────────────────────────────────

  private async get<T>(path: string): Promise<T> {
    const res = await fetch(`${this.baseUrl}${path}`, {
      method: 'GET',
      headers: this.headers,
    });
    return this.handleResponse(res);
  }

  private async post<T>(path: string, body: unknown): Promise<T> {
    const res = await fetch(`${this.baseUrl}${path}`, {
      method: 'POST',
      headers: this.headers,
      body: JSON.stringify(body),
    });
    return this.handleResponse(res);
  }

  private async handleResponse<T>(res: Response): Promise<T> {
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new PlacetApiError(res.status, text || res.statusText);
    }
    return (await res.json()) as T;
  }
}

function enc(s: string): string {
  return encodeURIComponent(s);
}
