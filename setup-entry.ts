// ---------------------------------------------------------------------------
// Placet Channel Plugin – Setup Entry Point
// ---------------------------------------------------------------------------
// Lightweight entry loaded during onboarding and setup flows.
// Avoids pulling in heavy runtime deps (Socket.IO, etc.).
// ---------------------------------------------------------------------------

import { defineSetupPluginEntry } from 'openclaw/plugin-sdk/channel-core';
import { placetPlugin } from './src/channel.js';

export default defineSetupPluginEntry(placetPlugin);
