// ---------------------------------------------------------------------------
// Placet Channel Plugin – HITL Review Mapping
// ---------------------------------------------------------------------------
// Maps between OpenClaw tool confirmations / input requests and
// Placet review types.
// ---------------------------------------------------------------------------

import type { ReviewType, SendMessageDto } from './types.js';

// ── OpenClaw → Placet ───────────────────────────────────────────────────────

export interface HitlApprovalRequest {
  title: string;
  description?: string;
  options?: string[];
}

export interface HitlTextInputRequest {
  prompt: string;
  placeholder?: string;
}

export interface HitlSelectionRequest {
  prompt: string;
  options: Array<{ id: string; label: string; description?: string }>;
  multiple?: boolean;
}

export function buildApprovalReview(
  request: HitlApprovalRequest,
  expiresInSeconds?: number,
): SendMessageDto['review'] {
  return {
    type: 'approval' as ReviewType,
    payload: {
      title: request.title,
      description: request.description,
      options: request.options ?? ['approve', 'reject'],
    },
    expiresInSeconds,
  };
}

export function buildTextInputReview(
  request: HitlTextInputRequest,
  expiresInSeconds?: number,
): SendMessageDto['review'] {
  return {
    type: 'text-input' as ReviewType,
    payload: {
      prompt: request.prompt,
      placeholder: request.placeholder,
    },
    expiresInSeconds,
  };
}

export function buildSelectionReview(
  request: HitlSelectionRequest,
  expiresInSeconds?: number,
): SendMessageDto['review'] {
  return {
    type: 'selection' as ReviewType,
    payload: {
      prompt: request.prompt,
      options: request.options,
      multiple: request.multiple ?? false,
    },
    expiresInSeconds,
  };
}

// ── Placet → OpenClaw ───────────────────────────────────────────────────────

export interface ResolvedApproval {
  approved: boolean;
  comment?: string;
}

export interface ResolvedTextInput {
  text: string;
}

export interface ResolvedSelection {
  selectedIds: string[];
}

export function resolveApprovalResponse(
  response: Record<string, unknown>,
): ResolvedApproval {
  return {
    approved: response.selectedOption === 'approve',
    comment: typeof response.comment === 'string' ? response.comment : undefined,
  };
}

export function resolveTextInputResponse(
  response: Record<string, unknown>,
): ResolvedTextInput {
  return {
    text: typeof response.text === 'string' ? response.text : '',
  };
}

export function resolveSelectionResponse(
  response: Record<string, unknown>,
): ResolvedSelection {
  const selectedIds = response.selectedIds;
  return {
    selectedIds: Array.isArray(selectedIds) ? (selectedIds as string[]) : [],
  };
}

export function resolveFormResponse(
  response: Record<string, unknown>,
): Record<string, unknown> {
  // Form responses are passed through as-is — they're already key-value pairs.
  return response;
}
