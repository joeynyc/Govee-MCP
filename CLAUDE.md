# Claude Code Development Guide - Govee MCP Server

This file contains essential information for developing and using the Govee MCP Server specifically with Claude Code. 

**Note**: While this MCP server works with any MCP-compatible client (Claude Desktop, custom clients, etc.), this guide focuses on Claude Code-specific workflows and commands.

## Project Overview

**Govee MCP Server** - A secure TypeScript MCP server for controlling Govee smart lights through natural language. Compatible with all MCP clients including Claude Desktop, Claude Code, and custom implementations.

- **Repository**: https://github.com/joeynyc/Govee-MCP.git
- **Language**: TypeScript 6
- **Runtime**: Node.js 20+
- **Architecture**: MCP (Model Context Protocol) server with adapter pattern
- **MCP SDK**: @modelcontextprotocol/sdk 1.29+
- **Validation**: Zod 4

## Quick Development Commands

### Setup & Build
```bash
npm install              # Install dependencies
npm run build           # Build TypeScript to dist/
npm start              # Run the MCP server
```

### Testing
```bash
npm test               # Run all tests (vitest)
npm run test:watch     # Watch mode
npm run test:coverage  # With coverage report

# Test with dry run mode (safe, no real API calls)
GOVEE_DRY_RUN=true npm start
```

### MCP Server Management
```bash
# Check server status
claude mcp list

# Remove and re-add MCP server during development
claude mcp remove govee
claude mcp add govee node dist/server.js -e "GOVEE_API_KEY=your-key"
```

## Key Configuration

### Environment Variables (.env)
- `GOVEE_API_KEY` - **REQUIRED** Your Govee API key
- `GOVEE_ALLOWLIST` - **SECURITY** Comma-separated device IDs (recommended)
- `GOVEE_DRY_RUN` - Set to `true` for safe testing
- `GOVEE_RATE_RPS` - API rate limit (default: 5)
- `GOVEE_BATCH_WINDOW_MS` - Command coalescing window (default: 120)
- `GOVEE_LAN_ENABLED` - Enable LAN adapter stub (default: false)

### Device IDs (for allowlist)
Current known devices:
- Floor Lamp: `CB:74:D1:35:33:33:02:47` (H6076)
- Outdoor Spotlights: `21:70:DD:6E:03:46:5F:74` (H7094)
- Left Outdoor Spotlight: `12:1E:DD:6E:04:46:69:43` (H7093)
- Basic Group Control: `12349045` (BaseGroup)

## MCP Tools Available

1. **`govee_list_devices`** - List all Govee devices
2. **`govee_get_state`** - Get current device state  
3. **`govee_set_power`** - Turn devices on/off
4. **`govee_set_brightness`** - Set brightness (0-100%)
5. **`govee_set_color`** - Set RGB color (0-255 each)
6. **`govee_set_color_temp`** - Set color temperature (Kelvin)
7. **`govee_batch`** - Execute multiple commands with coalescing

## Natural Language Examples

```
"List my Govee devices"
"Turn off the floor lamp"
"Set bedroom lights to 50% brightness"
"Change kitchen lights to blue" 
"Set office lights to warm white at 3000K"
"Turn on all outdoor lights"
```

## Project Structure

```
src/
├── server.ts           # Main MCP server (7 tools)
├── adapters/
│   ├── types.ts       # GoveeAdapter interface
│   ├── cloud.ts       # Govee Cloud API (uses native fetch)
│   └── lan.ts         # LAN adapter stub with cloud fallback
└── util/
    ├── types.ts       # TypeScript type definitions
    ├── limiter.ts     # Token bucket rate limiting
    ├── logger.ts      # Pino-based structured logging
    └── retry.ts       # Retry with exponential backoff

tests/
├── adapters/          # Adapter unit tests
├── server/            # Server integration tests
└── util/              # Utility unit tests

dashboard/             # Web dashboard (React frontend + Express backend)
dist/                  # Built JavaScript output
.env                   # Environment config (gitignored)
.env.example           # Safe template
```

## Key Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| @modelcontextprotocol/sdk | ^1.29.0 | MCP protocol implementation |
| zod | ^4.3.6 | Input schema validation |
| pino | ^10.3.1 | Structured JSON logging |
| uuid | ^13.0.0 | Request ID generation |
| typescript | ^6.0.2 | Type checking and compilation |
| vitest | ^4.1.2 | Test runner |

**Note**: HTTP requests use Node.js built-in `fetch` (no external HTTP client needed with Node 20+).

## Security Checklist

- [ ] API key in environment variables only
- [ ] Device allowlist configured for production
- [ ] `.env` file never committed to git
- [ ] Input validation via Zod schemas
- [ ] Rate limiting enabled
- [ ] Error messages sanitized

## Common Issues & Solutions

### "Device not allowed" error
- Check device ID is in `GOVEE_ALLOWLIST` 
- Or remove allowlist to allow all devices

### 401/403 API errors
- Verify `GOVEE_API_KEY` is correct
- Check API key is active in Govee Developer Portal

### Commands not working
- Check device capabilities with `govee_list_devices`
- Some devices support color OR temperature (not both)
- Ensure device is powered and online

### MCP server not responding  
- Check `claude mcp list` shows server as connected
- Rebuild after code changes: `npm run build`
- Re-add server: `claude mcp remove govee && claude mcp add...`

## Development Workflow

1. **Make changes** to TypeScript source in `src/`
2. **Build**: `npm run build` 
3. **Test**: `npm test`
4. **Test locally** with dry run: `GOVEE_DRY_RUN=true npm start`
5. **Update MCP server**: Remove and re-add to Claude Code
6. **Test with real devices** (carefully!)
7. **Commit and push** to GitHub

## API Reference

### Govee Cloud API
- **Base URL**: `https://openapi.api.govee.com/router/api/v1`
- **Auth**: `Govee-API-Key` header
- **Device List**: `GET /user/devices`
- **Control**: `POST /device/control` (capability format)
- **State**: `POST /device/state`

### Capability Format
```json
{
  "requestId": "unique-id",
  "payload": {
    "sku": "H6076", 
    "device": "device-id",
    "capability": {
      "type": "devices.capabilities.on_off",
      "instance": "powerSwitch", 
      "value": 0
    }
  }
}
```

## Extending the Server

### Adding New MCP Tools
1. Add tool definition in `src/server.ts`
2. Define Zod input schema
3. Add device allowlist check
4. Implement rate limiting
5. Add error handling
6. Add tests
7. Update documentation

### Adding Device Types
1. Update `src/util/types.ts` 
2. Extend `CloudAdapter` methods
3. Add capability mappings
4. Test with real devices

## Testing

```bash
npm test                    # Run all tests
npm run test:watch          # Watch mode
npm run test:coverage       # Coverage report

# Direct API testing
curl -H "Govee-API-Key: your-key" \
  https://openapi.api.govee.com/router/api/v1/user/devices
```

## Deployment Notes

- Always use device allowlists in production
- Set appropriate rate limits for your usage
- Monitor API usage to avoid hitting Govee limits
- Use environment-specific configurations

---

**Last Updated**: 2026-04-05
**Node.js Version**: 20+ required
**TypeScript Version**: 6.0+
**MCP SDK Version**: 1.29+
