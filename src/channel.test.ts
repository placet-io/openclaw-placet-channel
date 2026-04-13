import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PlacetClient, PlacetApiError } from './client.js';
import { PlacetWsClient } from './ws-client.js';
import { attachInboundHandlers } from './inbound.js';
import {
  buildApprovalReview,
  buildTextInputReview,
  buildSelectionReview,
  resolveApprovalResponse,
  resolveTextInputResponse,
  resolveSelectionResponse,
  resolveFormResponse,
} from './hitl.js';
import type { PlacetMessage, ReviewExpiredEvent } from './types.js';

// ── HITL Review Mapping ─────────────────────────────────────────────────────

describe('HITL mapping', () => {
  describe('buildApprovalReview', () => {
    it('creates an approval review with defaults', () => {
      const review = buildApprovalReview({ title: 'Deploy to production?' });
      expect(review).toEqual({
        type: 'approval',
        payload: {
          title: 'Deploy to production?',
          description: undefined,
          options: ['approve', 'reject'],
        },
        expiresInSeconds: undefined,
      });
    });

    it('respects custom options and expiry', () => {
      const review = buildApprovalReview(
        { title: 'Run tests?', description: 'All unit tests', options: ['yes', 'no', 'skip'] },
        3600,
      );
      expect(review!.payload!.options).toEqual(['yes', 'no', 'skip']);
      expect(review!.expiresInSeconds).toBe(3600);
    });
  });

  describe('buildTextInputReview', () => {
    it('creates a text-input review', () => {
      const review = buildTextInputReview({ prompt: 'Enter API key' });
      expect(review!.type).toBe('text-input');
      expect(review!.payload!.prompt).toBe('Enter API key');
    });
  });

  describe('buildSelectionReview', () => {
    it('creates a selection review', () => {
      const review = buildSelectionReview({
        prompt: 'Pick a model',
        options: [
          { id: 'gpt4', label: 'GPT-4' },
          { id: 'claude', label: 'Claude' },
        ],
      });
      expect(review!.type).toBe('selection');
      expect(review!.payload!.options).toHaveLength(2);
      expect(review!.payload!.multiple).toBe(false);
    });
  });

  describe('resolveApprovalResponse', () => {
    it('maps approve', () => {
      expect(resolveApprovalResponse({ selectedOption: 'approve' })).toEqual({
        approved: true,
        comment: undefined,
      });
    });

    it('maps reject with comment', () => {
      expect(
        resolveApprovalResponse({ selectedOption: 'reject', comment: 'Not ready' }),
      ).toEqual({
        approved: false,
        comment: 'Not ready',
      });
    });
  });

  describe('resolveTextInputResponse', () => {
    it('extracts text', () => {
      expect(resolveTextInputResponse({ text: 'hello' })).toEqual({ text: 'hello' });
    });

    it('defaults to empty string', () => {
      expect(resolveTextInputResponse({})).toEqual({ text: '' });
    });
  });

  describe('resolveSelectionResponse', () => {
    it('extracts selectedIds', () => {
      expect(resolveSelectionResponse({ selectedIds: ['a', 'b'] })).toEqual({
        selectedIds: ['a', 'b'],
      });
    });

    it('defaults to empty array', () => {
      expect(resolveSelectionResponse({})).toEqual({ selectedIds: [] });
    });
  });

  describe('resolveFormResponse', () => {
    it('passes through key-value pairs', () => {
      const response = { name: 'Kevin', age: 30, active: true };
      expect(resolveFormResponse(response)).toEqual(response);
    });
  });
});

// ── Inbound Handler ─────────────────────────────────────────────────────────

describe('inbound handler', () => {
  let ws: PlacetWsClient;
  let dispatcher: {
    onUserMessage: ReturnType<typeof vi.fn>;
    onReviewResponded: ReturnType<typeof vi.fn>;
    onReviewExpired: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    ws = new PlacetWsClient({ instanceUrl: 'http://localhost:3001', apiKey: 'hp_test' });
    dispatcher = {
      onUserMessage: vi.fn(),
      onReviewResponded: vi.fn(),
      onReviewExpired: vi.fn(),
    };
  });

  it('dispatches user messages', () => {
    attachInboundHandlers(ws, dispatcher);

    const message: PlacetMessage = {
      id: 'msg-1',
      channelId: 'ch-1',
      senderType: 'user',
      senderId: 'user-1',
      text: 'Hello',
      createdAt: new Date().toISOString(),
    };

    // Simulate the WS event by calling the listener directly
    const listeners = (ws as any).listeners.get('message:created');
    if (listeners) {
      for (const listener of listeners) listener(message);
    }

    expect(dispatcher.onUserMessage).toHaveBeenCalledWith(message);
  });

  it('filters out agent messages (loop prevention)', () => {
    attachInboundHandlers(ws, dispatcher);

    const agentMessage: PlacetMessage = {
      id: 'msg-2',
      channelId: 'ch-1',
      senderType: 'agent',
      senderId: 'agent-1',
      text: 'Agent reply',
      createdAt: new Date().toISOString(),
    };

    const listeners = (ws as any).listeners.get('message:created');
    if (listeners) {
      for (const listener of listeners) listener(agentMessage);
    }

    expect(dispatcher.onUserMessage).not.toHaveBeenCalled();
  });

  it('dispatches review:responded events', () => {
    attachInboundHandlers(ws, dispatcher);

    const message: PlacetMessage = {
      id: 'msg-3',
      channelId: 'ch-1',
      senderType: 'agent',
      senderId: 'agent-1',
      text: 'Needs approval',
      review: {
        type: 'approval',
        status: 'completed',
        response: { selectedOption: 'approve' },
        payload: { title: 'Deploy?' },
        completedAt: new Date().toISOString(),
      },
      createdAt: new Date().toISOString(),
    };

    const listeners = (ws as any).listeners.get('review:responded');
    if (listeners) {
      for (const listener of listeners) listener(message);
    }

    expect(dispatcher.onReviewResponded).toHaveBeenCalledWith(message);
  });

  it('dispatches review:expired events', () => {
    attachInboundHandlers(ws, dispatcher);

    const event: ReviewExpiredEvent = { messageId: 'msg-4' };

    const listeners = (ws as any).listeners.get('review:expired');
    if (listeners) {
      for (const listener of listeners) listener(event);
    }

    expect(dispatcher.onReviewExpired).toHaveBeenCalledWith(event);
  });

  it('returns a cleanup function', () => {
    const cleanup = attachInboundHandlers(ws, dispatcher);
    cleanup();

    const message: PlacetMessage = {
      id: 'msg-5',
      channelId: 'ch-1',
      senderType: 'user',
      senderId: 'user-1',
      text: 'After cleanup',
      createdAt: new Date().toISOString(),
    };

    const listeners = (ws as any).listeners.get('message:created');
    // After cleanup, listeners should be empty or the handler removed
    if (listeners) {
      for (const listener of listeners) listener(message);
    }

    expect(dispatcher.onUserMessage).not.toHaveBeenCalled();
  });
});

// ── REST Client ─────────────────────────────────────────────────────────────

describe('PlacetClient', () => {
  it('creates with correct base URL (strips trailing slash)', () => {
    const client = new PlacetClient({ instanceUrl: 'http://localhost:3001/', apiKey: 'hp_test' });
    expect((client as any).baseUrl).toBe('http://localhost:3001');
  });

  it('PlacetApiError contains status code and body', () => {
    const err = new PlacetApiError(401, 'Unauthorized');
    expect(err.statusCode).toBe(401);
    expect(err.body).toBe('Unauthorized');
    expect(err.message).toContain('401');
    expect(err.name).toBe('PlacetApiError');
  });
});

// ── WebSocket Client ────────────────────────────────────────────────────────

describe('PlacetWsClient', () => {
  it('starts in disconnected state', () => {
    const ws = new PlacetWsClient({ instanceUrl: 'http://localhost:3001', apiKey: 'hp_test' });
    expect(ws.getStatus()).toBe('disconnected');
  });

  it('tracks subscribed channels', () => {
    const ws = new PlacetWsClient({ instanceUrl: 'http://localhost:3001', apiKey: 'hp_test' });
    ws.subscribeToChannel('ch-1');
    ws.subscribeToChannel('ch-2');
    expect((ws as any).subscribedChannels.has('ch-1')).toBe(true);
    expect((ws as any).subscribedChannels.has('ch-2')).toBe(true);

    ws.unsubscribeFromChannel('ch-1');
    expect((ws as any).subscribedChannels.has('ch-1')).toBe(false);
  });
});
