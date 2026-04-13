# openclaw-placet-channel

OpenClaw channel plugin for [Placet](https://placet.io) — human-in-the-loop reviews and messaging.

## Installation

```bash
openclaw plugins install openclaw-placet-channel
openclaw gateway restart
```

## Configuration

Add to `~/.openclaw/openclaw.json`:

```json
{
  "channels": {
    "placet": {
      "instanceUrl": "https://app.placet.io",
      "apiKey": "hp_your-api-key",
      "enabled": true,
      "agentName": "OpenClaw Agent"
    }
  }
}
```

### Config Options

| Option | Required | Description |
|---|---|---|
| `instanceUrl` | Yes | Placet instance URL |
| `apiKey` | Yes | Placet API key (starts with `hp_`) |
| `agentName` | No | Name for the auto-created agent (default: `OpenClaw Agent`) |
| `agentId` | No | Use an existing Placet agent instead of auto-creating |
| `enabled` | No | Enable/disable the channel (default: `true`) |

### Environment Variables

You can override config values with environment variables:

- `PLACET_URL` — overrides `instanceUrl`
- `PLACET_API_KEY` — overrides `apiKey`

## How It Works

1. **Outbound**: OpenClaw sends messages to Placet via the REST API (`POST /api/v1/messages`)
2. **Inbound**: A background Socket.IO connection listens for user messages and review responses from Placet
3. **HITL**: OpenClaw tool confirmations are mapped to Placet review types (approval, text-input, selection)

### Message Flow

```
Placet User                              OpenClaw Agent
    |                                          |
    |--- types message ----------------------->|  (Socket.IO → message:created)
    |                                          |--- processes...
    |<--- agent responds ----------------------|  (REST → POST /api/v1/messages)
    |                                          |
    |<--- needs approval (HITL) ---------------|  (REST → message with review)
    |    (Placet review UI appears)            |
    |--- approves/rejects -------------------->|  (Socket.IO → review:responded)
```

## Development

```bash
npm install
npm test
npm run typecheck
```

## Troubleshooting

- **"Channel not configured"**: Ensure `instanceUrl` and `apiKey` are set in config or env vars
- **WebSocket disconnects**: The plugin auto-reconnects with exponential backoff (1s → 30s max)
- **Agent not found**: If `agentId` is set but doesn't exist, the plugin creates a new agent by name

## License

MIT
