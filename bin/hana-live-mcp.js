#!/usr/bin/env node
'use strict';

// npx hana-live-mcp 入口：只做转发，逻辑都在 lib/server.js
require('../lib/server.js').main();
