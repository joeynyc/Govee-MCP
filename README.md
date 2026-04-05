# Govee MCP Server

Control your Govee smart lights from any MCP-compatible client using natural language.

A secure, production-ready MCP (Model Context Protocol) server that enables AI assistants to control your Govee lights through natural language commands. Compatible with Claude Desktop, Claude Code, and any MCP client. Built with TypeScript 6, Zod 4, and the MCP SDK.

## Features

- **Natural Language Control** - "Turn off the floor lamp", "Set bedroom lights to warm white at 30%"
- **Security-First** - Device allowlists, rate limiting, Zod input validation
- **Command Coalescing** - Batch operations with automatic deduplication
- **Structured Logging** - Pino-based JSON logging with request IDs
- **Retry with Backoff** - Automatic retry for transient API failures
- **Cloud + LAN Architecture** - Cloud adapter with LAN fallback pattern
- **Dry Run Mode** - Test safely without hitting real devices

## Quick Start

### 1. Get Govee API Key
Get your API key from the [Govee Developer Portal](https://developer.govee.com/).

### 2. Install & Configure
```bash
git clone https://github.com/joeynyc/Govee-MCP.git
cd Govee-MCP
npm install

# Copy and configure environment
cp .env.example .env
# Edit .env and add your GOVEE_API_KEY
```

### 3. Build & Run
```bash
npm run build
npm start
```

### 4. Add to MCP Client

#### Claude Code (CLI)
```bash
claude mcp add govee node dist/server.js \
  -e "GOVEE_API_KEY=your-api-key-here" \
  -e "GOVEE_ALLOWLIST=your-device-ids"
```

#### Claude Desktop
Add to your MCP server configuration:
```json
{
  "name": "govee",
  "command": "node",
  "args": ["path/to/dist/server.js"],
  "env": {
    "GOVEE_API_KEY": "your-api-key-here",
    "GOVEE_ALLOWLIST": "your-device-ids"
  }
}
```

#### Other MCP Clients
- **Command**: `node dist/server.js`
- **Protocol**: `stdio`
- **Environment**: `GOVEE_API_KEY` (required), `GOVEE_ALLOWLIST` (recommended)

## Security

### Device Allowlist
Restrict access to specific devices:

```bash
# In .env - replace with your actual device IDs
GOVEE_ALLOWLIST=CB:74:D1:35:33:33:02:47,21:70:DD:6E:03:46:5F:74
```

**Find your device IDs:**
1. Run the server with an empty allowlist
2. Ask your MCP client: "List my Govee devices"
3. Copy the device IDs you want to control
4. Add them to `GOVEE_ALLOWLIST` and restart

### Built-in Protections
- **API key isolation** - Environment-based, never in code
- **Rate limiting** - Token bucket prevents API abuse (5 RPS default)
- **Input validation** - All parameters validated with Zod 4 schemas
- **Error sanitization** - No sensitive data in error messages
- **Audit trail** - All commands logged with request IDs

## Usage Examples

```
"Turn on the living room lights"
"Set bedroom lights to 50% brightness" 
"Change the kitchen lights to blue"
"Set office lights to warm white at 3000K"
"Turn off all lights"
"List my Govee devices and their capabilities"
```

## Configuration

| Variable | Description | Default |
|----------|-------------|---------|
| `GOVEE_API_KEY` | **Required** - Your Govee API key | - |
| `GOVEE_ALLOWLIST` | **Recommended** - Comma-separated device IDs | All devices |
| `GOVEE_DRY_RUN` | Safe testing mode (logs only) | `false` |
| `GOVEE_RATE_RPS` | API requests per second limit | `5` |
| `GOVEE_BATCH_WINDOW_MS` | Command coalescing window (ms) | `120` |
| `GOVEE_LAN_ENABLED` | Enable LAN adapter | `false` |

## MCP Tools

| Tool | Description |
|------|-------------|
| `govee_list_devices` | List all your Govee devices |
| `govee_get_state` | Get device current state (power, brightness, color, temp) |
| `govee_set_power` | Turn devices on/off |
| `govee_set_brightness` | Set brightness (0-100%) |
| `govee_set_color` | Set RGB color (0-255 each) |
| `govee_set_color_temp` | Set color temperature in Kelvin |
| `govee_batch` | Execute multiple commands with automatic coalescing |

## Architecture

```
src/
├── server.ts           # Main MCP server (7 tools)
├── adapters/
│   ├── types.ts       # GoveeAdapter interface
│   ├── cloud.ts       # Govee Cloud API (native fetch)
│   └── lan.ts         # LAN adapter stub with cloud fallback
└── util/
    ├── types.ts       # TypeScript type definitions
    ├── limiter.ts     # Token bucket rate limiting
    ├── logger.ts      # Pino structured logging
    └── retry.ts       # Retry with exponential backoff

tests/                  # Unit and integration tests (vitest)
dashboard/              # Web dashboard (React + Express)
```

## Development

### Prerequisites
- Node.js 20+
- npm

### Commands
```bash
npm install              # Install dependencies
npm run build           # Compile TypeScript
npm start              # Run the server
npm test               # Run tests
npm run test:watch     # Watch mode
npm run test:coverage  # Coverage report
```

### Tech Stack
- **TypeScript 6** - Type-safe development
- **MCP SDK 1.29** - Model Context Protocol implementation
- **Zod 4** - Schema validation
- **Pino 10** - Structured logging
- **Vitest 4** - Testing framework
- **Node.js 20+** - Runtime (uses built-in fetch, no external HTTP client)

## Troubleshooting

### Authentication Issues
- **401/403 errors** - Verify your `GOVEE_API_KEY` is correct and active
- **404 errors** - Check `GOVEE_API_BASE` URL

### Device Control Issues  
- **"Device not allowed"** - Add device ID to `GOVEE_ALLOWLIST`
- **Commands ignored** - Check device capabilities with `govee_list_devices`
- **Some devices support color OR temperature** (not both simultaneously)

### Performance Issues
- **Rate limiting** - Adjust `GOVEE_RATE_RPS` if hitting limits
- **Use batch commands** to send multiple operations efficiently

## Contributing

1. Fork the repository
2. Create a feature branch
3. Add tests for new features
4. Ensure `npm test` passes
5. Submit a pull request

## License

MIT License - see LICENSE file for details.

## Acknowledgments

- Built on the [Model Context Protocol](https://modelcontextprotocol.io/) by Anthropic
- Uses the [Govee Developer API](https://developer.govee.com/)
- Input validation powered by [Zod](https://zod.dev/)

---

**Requirements**: Node.js 20+ | **License**: MIT | **Security**: Always use device allowlists in production
