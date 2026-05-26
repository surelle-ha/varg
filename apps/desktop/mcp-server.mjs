#!/usr/bin/env node
/**
 * Varg MCP stdio server
 *
 * Claude Desktop spawns this script directly. It proxies JSON-RPC requests
 * to the Varg HTTP MCP server running inside the Tauri app.
 *
 * Claude Desktop config (claude_desktop_config.json):
 * {
 *   "mcpServers": {
 *     "varg": {
 *       "command": "node",
 *       "args": ["C:\\path\\to\\apps\\desktop\\mcp-server.mjs"],
 *       "env": { "VARG_PORT": "3700" }
 *     }
 *   }
 * }
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js'

const VARG_URL = `http://127.0.0.1:${process.env.VARG_PORT ?? 3700}/mcp`

// ── Helpers ────────────────────────────────────────────────────────────────

async function callVarg(method, params = {}) {
  const res = await fetch(VARG_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
  })
  if (!res.ok) throw new Error(`Varg HTTP error ${res.status}`)
  const json = await res.json()
  if (json.error) throw new Error(json.error.message)
  return json.result
}

async function vargRunning() {
  try {
    const res = await fetch(`http://127.0.0.1:${process.env.VARG_PORT ?? 3700}/health`, { signal: AbortSignal.timeout(2000) })
    return res.ok
  } catch {
    return false
  }
}

// ── Server ─────────────────────────────────────────────────────────────────

const server = new Server(
  { name: 'varg-mcp', version: '0.2.0' },
  { capabilities: { tools: {} } },
)

server.setRequestHandler(ListToolsRequestSchema, async () => {
  if (!await vargRunning()) {
    return {
      tools: [{
        name: 'varg_status',
        description: 'Varg is not running. Open the Varg desktop app and enable the MCP server to use TTS tools.',
        inputSchema: { type: 'object', properties: {} },
      }],
    }
  }

  const result = await callVarg('tools/list')
  return result
})

server.setRequestHandler(CallToolRequestSchema, async (req) => {
  if (!await vargRunning()) {
    return {
      content: [{
        type: 'text',
        text: 'Varg is not running. Open the Varg desktop app and start the MCP server from the MCP page, then try again.',
      }],
      isError: true,
    }
  }

  const result = await callVarg('tools/call', {
    name: req.params.name,
    arguments: req.params.arguments ?? {},
  })
  return result
})

// ── Start ──────────────────────────────────────────────────────────────────

const transport = new StdioServerTransport()
await server.connect(transport)
