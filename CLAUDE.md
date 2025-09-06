# Claude Code Development Guide - Govee MCP Server

This file contains essential information for working with the Govee MCP Server project in Claude Code.

## 📋 Project Overview

**Govee MCP Server** - A secure TypeScript MCP server for controlling Govee smart lights through natural language in Claude Code.

- **Repository**: https://github.com/joeynyc/Govee-MCP.git
- **Language**: TypeScript
- **Runtime**: Node.js
- **Architecture**: MCP (Model Context Protocol) server with adapter pattern

## 🚀 Quick Development Commands

### Setup & Build
```bash
npm install              # Install dependencies
npm run build           # Build TypeScript to dist/
npm start              # Run the MCP server
```

### Testing & Development
```bash
# Test with dry run mode (safe testing)
GOVEE_DRY_RUN=true npm start

# Test MCP server health
claude mcp list

# Remove and re-add MCP server during development
claude mcp remove govee
claude mcp add govee node dist/server.js -e "GOVEE_API_KEY=your-key"
```

### Git Operations
```bash
git add .
git commit -m "feat: your feature description"
git push origin main
```

## 🔧 Key Configuration

### Environment Variables (.env)
- `GOVEE_API_KEY` - **REQUIRED** Your Govee API key
- `GOVEE_ALLOWLIST` - **SECURITY** Comma-separated device IDs (recommended)
- `GOVEE_DRY_RUN` - Set to `true` for safe testing
- `GOVEE_RATE_RPS` - API rate limit (default: 5)

### Device IDs (for allowlist)
Current known devices:
- Floor Lamp: `CB:74:D1:35:33:33:02:47` (H6076)
- Outdoor Spotlights: `21:70:DD:6E:03:46:5F:74` (H7094)
- Left Outdoor Spotlight: `12:1E:DD:6E:04:46:69:43` (H7093)
- Basic Group Control: `12349045` (BaseGroup)

## 🛠️ MCP Tools Available

1. **`govee.list_devices`** - List all Govee devices
2. **`govee.get_state`** - Get current device state  
3. **`govee.set_power`** - Turn devices on/off
4. **`govee.set_brightness`** - Set brightness (0-100%)
5. **`govee.set_color`** - Set RGB color (0-255 each)
6. **`govee.set_color_temp`** - Set color temperature (Kelvin)
7. **`govee.batch`** - Execute multiple commands

## 🎯 Natural Language Examples

```
"List my Govee devices"
"Turn off the floor lamp"
"Set bedroom lights to 50% brightness"
"Change kitchen lights to blue" 
"Set office lights to warm white at 3000K"
"Turn on all outdoor lights"
```

## 🏗️ Project Structure

```
src/
├── server.ts           # Main MCP server (7 tools)
├── adapters/
│   ├── cloud.ts       # Govee Cloud API integration  
│   └── lan.ts         # LAN adapter stub
└── util/
    ├── types.ts       # TypeScript definitions
    └── limiter.ts     # Rate limiting logic

dist/                   # Built JavaScript output
.env                   # Environment config (gitignored)
.env.example           # Safe template
```

## 🔒 Security Checklist

- [ ] API key in environment variables only
- [ ] Device allowlist configured for production
- [ ] `.env` file never committed to git
- [ ] Input validation via Zod schemas
- [ ] Rate limiting enabled
- [ ] Error messages sanitized

## 🐛 Common Issues & Solutions

### "Device not allowed" error
- Check device ID is in `GOVEE_ALLOWLIST` 
- Or comment out allowlist to allow all devices

### 401/403 API errors
- Verify `GOVEE_API_KEY` is correct
- Check API key is active in Govee Developer Portal

### Commands not working
- Check device capabilities with `list_devices`
- Some devices support color OR temperature (not both)
- Ensure device is powered and online

### MCP server not responding  
- Check `claude mcp list` shows server as connected
- Rebuild after code changes: `npm run build`
- Re-add server: `claude mcp remove govee && claude mcp add...`

## 🔄 Development Workflow

1. **Make changes** to TypeScript source in `src/`
2. **Build**: `npm run build` 
3. **Test locally** with dry run: `GOVEE_DRY_RUN=true npm start`
4. **Update MCP server**: Remove and re-add to Claude Code
5. **Test with real devices** (carefully!)
6. **Commit and push** to GitHub

## 📚 API Reference

### Govee Cloud API
- **Base URL**: `https://openapi.api.govee.com/router/api/v1`
- **Auth**: `Govee-API-Key` header
- **Device List**: `GET /user/devices`
- **Control**: `POST /device/control` (new capability format)
- **State**: `POST /device/state`

### New API Format (2024)
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

## 🎨 Extending the Server

### Adding New MCP Tools
1. Add tool definition in `src/server.ts`
2. Define Zod input schema
3. Add device allowlist check
4. Implement rate limiting
5. Add error handling
6. Update documentation

### Adding Device Types
1. Update `src/util/types.ts` 
2. Extend `CloudAdapter` methods
3. Add capability mappings
4. Test with real devices

## 📝 Testing Commands

```bash
# Check MCP server status
claude mcp list

# Test device listing (safe)
# Use in Claude: "List my Govee devices"

# Test control commands (use dry run first!)
GOVEE_DRY_RUN=true npm start
# Then: "Turn off floor lamp" 

# Direct API testing
curl -H "Govee-API-Key: your-key" \
  https://openapi.api.govee.com/router/api/v1/user/devices
```

## 🚀 Deployment Notes

- Always use device allowlists in production
- Set appropriate rate limits for your usage
- Monitor API usage to avoid hitting Govee limits
- Consider implementing LAN adapter for faster responses
- Use environment-specific configurations

## 📞 Support & Contributing

- **Issues**: https://github.com/joeynyc/Govee-MCP/issues
- **Contributions**: Fork, feature branch, pull request
- **Security**: Report privately for security issues

---

**Last Updated**: 2024-12-06
**Claude Code Version**: Compatible with latest MCP SDK
**Node.js Version**: 18+ recommended