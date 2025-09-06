# Govee MCP Server (TypeScript)

🏠 **Control your Govee smart lights from any MCP-compatible client using natural language!**

A secure, production-ready MCP (Model Context Protocol) server that enables AI assistants to control your Govee lights through natural language commands. Compatible with Claude Desktop, Claude Code, and any future MCP clients. Built with TypeScript and includes comprehensive safety features.

## ✨ Features

- **🎯 Natural Language Control**: "Turn off the floor lamp", "Set bedroom lights to warm white at 30%"
- **🛡️ Security-First Design**: Device allowlists, rate limiting, input validation
- **⚡ Performance**: Command coalescing, token bucket rate limiting
- **🔧 Production Ready**: Comprehensive error handling, logging, dry-run mode
- **🏗️ Extensible**: Clean architecture with Cloud/LAN adapter support

## 🚀 Quick Start

### 1. Get Govee API Key
Get your API key from the [Govee Developer Portal](https://developer.govee.com/).

### 2. Install & Configure
```bash
git clone https://github.com/yourusername/govee-mcp-server.git
cd govee-mcp-server
npm install

# Copy and configure environment
cp .env.example .env
# Edit .env and add your GOVEE_API_KEY
```

### 3. Build & Run
```bash
npm run build
npm start  # Test locally first
```

### 4. Add to MCP Client

#### Claude Code (CLI)
```bash
claude mcp add govee node dist/server.js \
  -e "GOVEE_API_KEY=your-api-key-here" \
  -e "GOVEE_ALLOWLIST=your-device-ids"
```

#### Claude Desktop
1. Open Claude Desktop settings
2. Go to **MCP** tab
3. Add server configuration:
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
Follow your client's MCP server configuration process using:
- **Command**: `node dist/server.js`
- **Protocol**: `stdio`
- **Environment**: `GOVEE_API_KEY` and optional `GOVEE_ALLOWLIST`

## 🔒 Security Configuration

### **Critical: Configure Device Allowlist**
For security, restrict access to specific devices:

```bash
# In .env - Replace with your actual device IDs
GOVEE_ALLOWLIST=CB:74:D1:35:33:33:02:47,21:70:DD:6E:03:46:5F:74
```

**Find your device IDs:**
1. Run the server with empty allowlist initially
2. Ask your MCP client: "List my Govee devices"
3. Copy the device IDs you want to control
4. Add them to `GOVEE_ALLOWLIST` and restart

### **Environment Security**
- ✅ **`.env` is gitignored** - Your API key won't be committed
- ✅ **Rate limiting** - Prevents API abuse (5 RPS default)
- ✅ **Input validation** - All parameters validated with Zod schemas
- ✅ **Dry run mode** - Test safely with `GOVEE_DRY_RUN=true`

## 🎮 Usage Examples

Once configured, use natural language with any MCP client:

```
"Turn on the living room lights"
"Set bedroom lights to 50% brightness" 
"Change the kitchen lights to blue"
"Set office lights to warm white at 3000K"
"Turn off all lights" (if using group control)
"List my Govee devices and their capabilities"
```

## 🔧 Configuration Options

| Variable | Description | Default |
|----------|-------------|---------|
| `GOVEE_API_KEY` | **Required** - Your Govee API key | - |
| `GOVEE_ALLOWLIST` | **Recommended** - Comma-separated device IDs | All devices |
| `GOVEE_DRY_RUN` | Safe testing mode (logs only) | `false` |
| `GOVEE_RATE_RPS` | API requests per second limit | `5` |
| `GOVEE_BATCH_WINDOW_MS` | Command coalescing window | `120` |
| `GOVEE_LAN_ENABLED` | Enable LAN adapter (stub) | `false` |

## 🛡️ Security Features

- **🔐 API Key Protection**: Environment-based, never in code
- **🎯 Device Allowlists**: Restrict to specific devices only  
- **⚡ Rate Limiting**: Token bucket prevents API abuse
- **✅ Input Validation**: Zod schemas validate all inputs
- **🔍 Error Sanitization**: No sensitive data in error messages
- **📝 Audit Trail**: All commands logged with request IDs

## 🏗️ Architecture

```
src/
├── server.ts           # Main MCP server with 7 tools
├── adapters/
│   ├── cloud.ts       # Govee Cloud API integration
│   └── lan.ts         # LAN adapter (stub for future)
└── util/
    ├── types.ts       # TypeScript definitions
    └── limiter.ts     # Rate limiting implementation
```

## 🔧 Available MCP Tools

1. **`govee.list_devices`** - List all your Govee devices
2. **`govee.get_state`** - Get device current state
3. **`govee.set_power`** - Turn devices on/off
4. **`govee.set_brightness`** - Set brightness (0-100%)
5. **`govee.set_color`** - Set RGB color (0-255 each)
6. **`govee.set_color_temp`** - Set color temperature (Kelvin)
7. **`govee.batch`** - Execute multiple commands efficiently

## 🐛 Troubleshooting

### Authentication Issues
- **401/403 errors**: Verify your `GOVEE_API_KEY` is correct
- **404 errors**: Check `GOVEE_API_BASE` URL is correct

### Device Control Issues  
- **Commands ignored**: Check device capabilities with `list_devices`
- **Some devices support color OR temperature** (not both simultaneously)
- **Verify device is in allowlist** if configured

### Performance Issues
- **Rate limiting**: Adjust `GOVEE_RATE_RPS` if hitting limits
- **Slow responses**: Consider implementing LAN adapter for local devices

## 📋 Development

### Running Tests
```bash
# Test with dry run mode
GOVEE_DRY_RUN=true npm start

# Test specific device
curl -X POST localhost:3000 -d '{"method": "govee.list_devices"}'
```

### Contributing
1. Fork the repository
2. Create feature branch
3. Add tests for new features
4. Ensure security review for any changes
5. Submit pull request

## 📜 License

MIT License - see LICENSE file for details.

## 🌐 MCP Ecosystem

This server is built on the **Model Context Protocol (MCP)**, an open standard for connecting AI assistants to external tools and data sources.

### Compatible MCP Clients
- **Claude Desktop** - Anthropic's desktop application
- **Claude Code** - CLI and VS Code integration
- **Custom MCP clients** - Any application implementing the MCP protocol

### MCP Benefits
- **Universal compatibility** - Works with current and future MCP clients
- **Standardized interface** - Consistent tool definitions across clients  
- **Future-proof** - Benefits from growing MCP ecosystem
- **Open source** - Built on open standards

## 🙏 Acknowledgments

- Built on the [Model Context Protocol](https://modelcontextprotocol.io/) by Anthropic
- Uses the [Govee Developer API](https://developer.govee.com/)
- TypeScript validation powered by [Zod](https://zod.dev/)
- Compatible with all MCP-compliant AI assistants

---

**⚠️ Security Notice**: This server controls physical devices. Always use device allowlists in production and never share your API keys.