// ---------------------------------------------------------------------------
// Placet Channel Plugin – Main Entry Point
// ---------------------------------------------------------------------------
// Registered via openclaw.extensions in package.json.
// Boots the full channel plugin + background WebSocket service.
// ---------------------------------------------------------------------------

import { defineChannelPluginEntry } from 'openclaw/plugin-sdk/channel-core';
import type { OpenClawPluginApi, ChannelPlugin, ChannelConfigUiHint } from 'openclaw/plugin-sdk/channel-core';
import { placetPlugin } from './src/channel.js';
import { PlacetService } from './src/service.js';
import type { InboundDispatcher } from './src/inbound.js';
import type { PlacetChannelConfig } from './src/types.js';

// Explicit return type annotation to avoid TS2742 (non-portable inferred type).
type PluginEntry = {
  id: string;
  name: string;
  description: string;
  configSchema: unknown;
  register: (api: OpenClawPluginApi) => void;
  channelPlugin: ChannelPlugin;
  setChannelRuntime?: unknown;
};

const entry: PluginEntry = defineChannelPluginEntry({
  id: 'placet',
  name: 'Placet',
  description: 'Placet channel plugin – human-in-the-loop reviews and messaging.',
  plugin: placetPlugin,

  registerFull(api: OpenClawPluginApi) {
    let service: PlacetService | null = null;

    api.registerService({
      id: 'placet-ws',

      async start(ctx) {
        const cfg = ctx.config;
        const channels = cfg.channels as Record<string, PlacetChannelConfig> | undefined;
        const placetCfg = channels?.placet;

        if (!placetCfg?.instanceUrl || !placetCfg?.apiKey) {
          ctx.logger.info('[placet] Channel not configured – skipping service start');
          return;
        }

        if (placetCfg.enabled === false) {
          ctx.logger.info('[placet] Channel disabled – skipping service start');
          return;
        }

        // Resolve config with env var overrides
        const instanceUrl = process.env.PLACET_URL ?? placetCfg.instanceUrl;
        const apiKey = process.env.PLACET_API_KEY ?? placetCfg.apiKey;

        const dispatcher: InboundDispatcher = {
          async onUserMessage(message) {
            ctx.logger.info(`[placet] Inbound message from user ${message.senderId}: ${message.text?.slice(0, 80) ?? '(no text)'}`);

            // Dispatch inbound message via subagent – the canonical
            // way for channel plugins to trigger an agent turn.
            const sessionKey = `placet:${message.channelId}`;

            await api.runtime.subagent.run({
              sessionKey,
              message: message.text ?? '',
            });
          },

          onReviewResponded(message) {
            ctx.logger.info(`[placet] Review responded on message ${message.id}`);
          },

          onReviewExpired(event) {
            ctx.logger.warn(`[placet] Review expired for message ${event.messageId}`);
          },
        };

        const log = (...args: unknown[]) => ctx.logger.info(args.map(String).join(' '));

        service = new PlacetService({
          config: { ...placetCfg, instanceUrl, apiKey },
          dispatcher,
          log,
        });

        await service.start();
      },

      async stop() {
        await service?.stop();
        service = null;
      },
    });
  },
});

export default entry;
