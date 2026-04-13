// ---------------------------------------------------------------------------
// Placet Channel Plugin – Channel Definition
// ---------------------------------------------------------------------------
// Defines the OpenClaw ChannelPlugin using createChatChannelPlugin from
// openclaw/plugin-sdk/channel-core. Handles account resolution, inspection,
// and outbound messaging to Placet.
// ---------------------------------------------------------------------------

import {
  createChatChannelPlugin,
} from 'openclaw/plugin-sdk/channel-core';
import { DEFAULT_ACCOUNT_ID } from 'openclaw/plugin-sdk/account-id';
import type { OpenClawConfig } from 'openclaw/plugin-sdk/channel-core';
import { PlacetClient } from './client.js';
import type { PlacetChannelConfig } from './types.js';

// ── Resolved account state ──────────────────────────────────────────────────

export type PlacetResolvedAccount = {
  accountId: string | null;
  instanceUrl: string;
  apiKey: string;
  agentName: string;
  agentId: string | undefined;
  client: PlacetClient;
};

// ── Config resolution helpers ───────────────────────────────────────────────

function getPlacetConfig(cfg: OpenClawConfig): PlacetChannelConfig | undefined {
  const channels = cfg.channels as Record<string, PlacetChannelConfig> | undefined;
  return channels?.placet;
}

function resolveAccount(
  cfg: OpenClawConfig,
  accountId?: string | null,
): PlacetResolvedAccount {
  const section = getPlacetConfig(cfg);

  // Support env var overrides
  const instanceUrl = process.env.PLACET_URL ?? section?.instanceUrl;
  const apiKey = process.env.PLACET_API_KEY ?? section?.apiKey;

  if (!instanceUrl) throw new Error('placet: instanceUrl is required (config or PLACET_URL env)');
  if (!apiKey) throw new Error('placet: apiKey is required (config or PLACET_API_KEY env)');

  return {
    accountId: accountId ?? null,
    instanceUrl,
    apiKey,
    agentName: section?.agentName ?? 'OpenClaw Agent',
    agentId: section?.agentId,
    client: new PlacetClient({ instanceUrl, apiKey }),
  };
}

// ── Channel plugin ──────────────────────────────────────────────────────────

export const placetPlugin = createChatChannelPlugin<PlacetResolvedAccount>({
  base: {
    id: 'placet',

    meta: {
      id: 'placet',
      label: 'Placet',
      selectionLabel: 'Placet',
      docsPath: '/channels/placet',
      docsLabel: 'placet',
      blurb: 'Human-in-the-loop reviews and messaging via Placet.',
      order: 200,
    },

    capabilities: {
      chatTypes: ['direct'],
      media: true,
    },

    reload: { configPrefixes: ['channels.placet'] },

    config: {
      listAccountIds: () => [DEFAULT_ACCOUNT_ID],
      resolveAccount,
      inspectAccount: (cfg, accountId) => {
        const section = getPlacetConfig(cfg);
        const hasUrl = Boolean(process.env.PLACET_URL ?? section?.instanceUrl);
        const hasKey = Boolean(process.env.PLACET_API_KEY ?? section?.apiKey);
        const enabled = section?.enabled !== false;
        return {
          enabled: enabled && hasUrl && hasKey,
          configured: hasUrl && hasKey,
          apiKeyStatus: hasKey ? 'available' : 'missing',
        };
      },
      isConfigured: (account) => Boolean(account.instanceUrl && account.apiKey),
    },

    setup: {
      applyAccountConfig: ({ cfg }) => cfg,
    },
  },

  threading: {
    topLevelReplyToMode: 'reply',
  },

  outbound: {
    base: {
      deliveryMode: 'direct',
    },
    attachedResults: {
      channel: 'placet',
      sendText: async (ctx) => {
        const account = resolveAccount(ctx.cfg, ctx.accountId);
        const result = await account.client.sendMessage({
          channelId: ctx.to,
          text: ctx.text,
        });
        return { messageId: result.id };
      },
      sendMedia: async (ctx) => {
        const account = resolveAccount(ctx.cfg, ctx.accountId);
        if (ctx.mediaUrl) {
          const fs = await import('node:fs/promises');
          const path = await import('node:path');
          const data = await fs.readFile(ctx.mediaUrl);
          const filename = path.basename(ctx.mediaUrl);
          const mimeType = guessMimeType(filename);

          const uploaded = await account.client.uploadFile(ctx.to, {
            filename,
            mimeType,
            data: new Uint8Array(data),
          });

          await account.client.sendMessage({
            channelId: ctx.to,
            attachmentIds: [uploaded.id],
          });
        }
        return { messageId: crypto.randomUUID() };
      },
    },
  },
});

// ── Helpers ─────────────────────────────────────────────────────────────────

function guessMimeType(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase();
  const mimeMap: Record<string, string> = {
    png: 'image/png',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    gif: 'image/gif',
    webp: 'image/webp',
    svg: 'image/svg+xml',
    pdf: 'application/pdf',
    json: 'application/json',
    txt: 'text/plain',
    md: 'text/markdown',
    html: 'text/html',
    css: 'text/css',
    js: 'application/javascript',
    ts: 'application/typescript',
  };
  return ext ? (mimeMap[ext] ?? 'application/octet-stream') : 'application/octet-stream';
}
