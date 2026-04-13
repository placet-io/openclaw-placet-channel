# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] - 2025-07-14

### Added

- Initial release of the OpenClaw Placet channel plugin
- Chat channel plugin with `sendText` and `sendMedia` support
- REST API client for Placet (agents, messages, reviews, files)
- Socket.IO WebSocket client with auto-reconnect and heartbeat
- Inbound message dispatch from Placet to OpenClaw agents
- HITL review type mapping (approval, text-input, selection, form)
- Background service with WebSocket lifecycle management
- Automatic agent creation on plugin start
- Loop prevention filtering (ignores non-user messages)
