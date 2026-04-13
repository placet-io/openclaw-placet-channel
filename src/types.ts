// ---------------------------------------------------------------------------
// Placet Channel Plugin – Types
// ---------------------------------------------------------------------------
// Self-contained types mirroring the Placet API shapes.
// No @placet/shared dependency — kept in sync manually.
// ---------------------------------------------------------------------------

// ── Config ──────────────────────────────────────────────────────────────────

export interface PlacetChannelConfig {
  instanceUrl: string;
  apiKey: string;
  agentName?: string;
  agentId?: string;
  enabled?: boolean;
}

// ── Enums ───────────────────────────────────────────────────────────────────

export type MessageSenderType = 'agent' | 'user';
export type MessageStatus = 'info' | 'success' | 'warning' | 'error';
export type ReviewStatus = 'pending' | 'completed' | 'expired';
export type ReviewType = 'approval' | 'selection' | 'form' | 'text-input' | 'freeform';
export type AgentStatus = 'active' | 'busy' | 'error' | 'offline';
export type DeliveryStatus = 'sent' | 'webhook_delivered' | 'webhook_failed' | 'agent_received';

// ── Review ──────────────────────────────────────────────────────────────────

export interface ReviewCallback {
  url: string;
  method?: string;
  headers?: Record<string, string>;
}

export interface Review {
  type: ReviewType;
  payload?: Record<string, unknown>;
  status: ReviewStatus;
  response?: Record<string, unknown> | null;
  callback?: ReviewCallback | null;
  expiresAt?: string | null;
  expiresInSeconds?: number;
  completedAt?: string | null;
  feedback?: string | null;
  modifiedFileIds?: Record<string, string> | null;
}

// ── Attachment ──────────────────────────────────────────────────────────────

export interface Attachment {
  id: string;
  messageId?: string | null;
  channelId: string;
  pluginType: string;
  filename: string;
  mimeType: string;
  size: number;
  storageKey: string;
  pluginData?: Record<string, unknown> | null;
  createdAt: string;
}

// ── Message ─────────────────────────────────────────────────────────────────

export interface PlacetMessage {
  id: string;
  channelId: string;
  senderType: MessageSenderType;
  senderId: string;
  text?: string | null;
  status?: MessageStatus | null;
  review?: Review | null;
  metadata?: Record<string, unknown> | null;
  deliveryStatus?: DeliveryStatus;
  iterationGroupId?: string | null;
  iteration?: number | null;
  createdAt: string;
  attachments?: Attachment[];
}

// ── Agent ───────────────────────────────────────────────────────────────────

export interface PlacetAgent {
  id: string;
  ownerId: string;
  name: string;
  description?: string | null;
  avatarUrl?: string | null;
  webhookUrl?: string | null;
  status: AgentStatus;
  statusMessage?: string | null;
  lastActiveAt?: string | null;
  createdAt: string;
}

// ── Request DTOs ────────────────────────────────────────────────────────────

export interface SendMessageDto {
  channelId: string;
  text?: string;
  status?: MessageStatus;
  review?: {
    type: ReviewType;
    payload?: Record<string, unknown>;
    expiresInSeconds?: number;
    expiresAt?: string;
    callback?: ReviewCallback;
  };
  metadata?: Record<string, unknown>;
  webhookUrl?: string;
  attachmentIds?: string[];
  iterationOf?: string;
}

export interface CreateAgentDto {
  name: string;
  description?: string;
  webhookUrl?: string;
}

export interface PingStatusDto {
  agentId: string;
  status: AgentStatus;
  message?: string;
}

// ── WebSocket Events ────────────────────────────────────────────────────────

export interface ReviewRespondedEvent {
  /** Full message with review.status='completed' and review.response set. */
  message: PlacetMessage;
}

export interface ReviewExpiredEvent {
  messageId: string;
}

export interface MessageDeliveryEvent {
  messageId: string;
  deliveryStatus: DeliveryStatus;
}
