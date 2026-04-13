// ---------------------------------------------------------------------------
// Placet Channel Plugin – Inbound Handler
// ---------------------------------------------------------------------------
// Listens to Placet WebSocket events and dispatches them into OpenClaw.
// Filters out agent-sent messages to prevent echo loops.
// ---------------------------------------------------------------------------

import type { PlacetWsClient } from './ws-client.js';
import type { PlacetMessage, ReviewExpiredEvent } from './types.js';

export interface InboundDispatcher {
  onUserMessage(message: PlacetMessage): void | Promise<void>;
  onReviewResponded(message: PlacetMessage): void | Promise<void>;
  onReviewExpired(event: ReviewExpiredEvent): void | Promise<void>;
}

export function attachInboundHandlers(
  ws: PlacetWsClient,
  dispatcher: InboundDispatcher,
): () => void {
  const onMessage = (message: PlacetMessage) => {
    // Loop prevention: only dispatch messages from human users, not from agents.
    if (message.senderType !== 'user') return;
    void dispatcher.onUserMessage(message);
  };

  const onReviewResponded = (message: PlacetMessage) => {
    void dispatcher.onReviewResponded(message);
  };

  const onReviewExpired = (event: ReviewExpiredEvent) => {
    void dispatcher.onReviewExpired(event);
  };

  ws.on('message:created', onMessage);
  ws.on('review:responded', onReviewResponded);
  ws.on('review:expired', onReviewExpired);

  // Return cleanup function
  return () => {
    ws.off('message:created', onMessage);
    ws.off('review:responded', onReviewResponded);
    ws.off('review:expired', onReviewExpired);
  };
}
