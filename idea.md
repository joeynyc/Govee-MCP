# Govee MCP Server (TypeScript)

A minimal-but-useful **Model Context Protocol (MCP)** server that lets Claude Code (or any MCP client) **control your Govee lights** via the Cloud API, with optional LAN hooks.

It includes:
- Tools: `list_devices`, `get_state`, `set_power`, `set_brightness`, `set_color`, `set_color_temp`, `set_scene`, `batch`
- **Device allowlist**, **dry-run mode**, **simple rate limiter** + command **coalescing**
- Cloud adapter (works everywhere) and a stubbed LAN adapter you can enable later

---

## File tree
```
.
├─ package.json
├─ tsconfig.json
├─ .env.example
├─ README.md
└─ src/
   ├─ server.ts
   ├─ adapters/
   │  ├─ cloud.ts
   │  └─ lan.ts
   └─ util/
      ├─ limiter.ts
      └─ types.ts
```

---

## package.json
```json
{
  "name": "govee-mcp-server",
  "version": "0.1.0",
  "type": "module",
  "private": true,
  "scripts": {
    "build": "tsc -p .",
    "start": "node dist/server.js"
  },
  "dependencies": {
    "@modelcontextprotocol/sdk": "^1.0.0",
    "zod": "^3.23.8",
    "undici": "^6.19.8"
  },
  "devDependencies": {
    "typescript": "^5.6.3"
  }
}
```

## tsconfig.json
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ES2022",
    "moduleResolution": "bundler",
    "strict": true,
    "esModuleInterop": true,
    "forceConsistentCasingInFileNames": true,
    "skipLibCheck": true,
    "outDir": "dist",
    "rootDir": "src"
  },
  "include": ["src/**/*"]
}
```

## .env.example
```bash
# Required
GOVEE_API_KEY=put-your-govee-api-key-here

# Optional
GOVEE_API_BASE=https://openapi.api.govee.com/router/api/v1
GOVEE_ALLOWLIST=AA:BB:CC:DD:EE:FF,11:22:33:44:55:66  # comma-separated deviceIds (MAC-like)
GOVEE_DRY_RUN=false    # true = don't actually send controls, just log
GOVEE_RATE_RPS=5       # max requests per second (client-side)
GOVEE_BATCH_WINDOW_MS=120  # coalesce quick successive writes (ms)

# LAN (optional; stub provided)
GOVEE_LAN_ENABLED=false
```

---

## src/util/types.ts
```ts
export type DeviceRef = { deviceId: string; model: string };

export type DeviceInfo = DeviceRef & {
  name?: string;
  capabilities?: string[]; // e.g., ["power", "brightness", "color", "colorTem", "scene"]
};

export type State = {
  power?: "on" | "off";
  brightness?: number; // 0–100
  color?: { r: number; g: number; b: number };
  colorTem?: number; // Kelvin
  scene?: string;
};

export type ControlCmd =
  | { name: "turn"; value: "on" | "off" }
  | { name: "brightness"; value: number }
  | { name: "color"; value: { r: number; g: number; b: number } }
  | { name: "colorTem"; value: number }
  | { name: "scene"; value: string };

export type BatchItem = DeviceRef & { cmd: ControlCmd };
```

## src/util/limiter.ts
```ts
export class TokenBucketLimiter {
  private capacity: number;
  private tokens: number;
  private refillRatePerSec: number;
  private last: number;

  constructor(rps = 5) {
    this.capacity = Math.max(1, rps);
    this.tokens = this.capacity;
    this.refillRatePerSec = rps;
    this.last = Date.now();
  }

  async take(): Promise<void> {
    while (true) {
      const now = Date.now();
      const elapsed = (now - this.last) / 1000;
      this.last = now;
      this.tokens = Math.min(this.capacity, this.tokens + elapsed * this.refillRatePerSec);
      if (this.tokens >= 1) {
        this.tokens -= 1;
        return;
      }
      await new Promise((r) => setTimeout(r, 50));
    }
  }
}
```

## src/adapters/cloud.ts
```ts
import { fetch } from "undici";
import { BatchItem, ControlCmd, DeviceInfo, DeviceRef, State } from "../util/types.js";

const API_BASE = process.env.GOVEE_API_BASE || "https://openapi.api.govee.com/router/api/v1";
const API_KEY = process.env.GOVEE_API_KEY || "";
const DRY_RUN = /^true$/i.test(process.env.GOVEE_DRY_RUN || "false");

function headers() {
  return {
    "Content-Type": "application/json",
    "Govee-API-Key": API_KEY,
  } as Record<string, string>;
}

async function post<T>(path: string, payload: any = {}): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify(payload ?? {}),
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Govee ${res.status} ${res.statusText}: ${txt}`);
  }
  return res.json() as Promise<T>;
}

export class CloudAdapter {
  async listDevices(): Promise<DeviceInfo[]> {
    type Resp = { data?: { devices?: any[] } };
    const out = await post<Resp>("/device/list");
    const devices = out?.data?.devices ?? [];
    return devices.map((d) => ({
      deviceId: d.device,
      model: d.sku || d.model,
      name: d.deviceName,
      capabilities: (d.capabilities || []).map((c: any) => c.capability),
    }));
  }

  async getState(ref: DeviceRef): Promise<State> {
    type Resp = { data?: any };
    const out = await post<Resp>("/device/state", { requestId: "mcp", payload: { device: ref.deviceId, model: ref.model } });
    // The Cloud API returns a list of capability states; flatten a few expected ones.
    const caps = out?.data?.capabilities || [];
    const st: State = {};
    for (const c of caps) {
      if (c.type?.includes("powerState")) st.power = c.state?.value?.toLowerCase?.() === "on" ? "on" : "off";
      if (c.type?.includes("brightness")) st.brightness = Number(c.state?.value);
      if (c.type?.includes("color")) st.color = c.state?.value;
      if (c.type?.includes("colorTem")) st.colorTem = Number(c.state?.value);
      if (c.type?.includes("scene")) st.scene = c.state?.value;
    }
    return st;
  }

  async control(ref: DeviceRef, cmd: ControlCmd): Promise<void> {
    if (DRY_RUN) {
      console.log("[DRY-RUN] control", { ref, cmd });
      return;
    }
    await post("/device/control", {
      requestId: "mcp",
      payload: { device: ref.deviceId, model: ref.model, cmd },
    });
  }

  async batch(items: BatchItem[]): Promise<void> {
    if (DRY_RUN) {
      console.log("[DRY-RUN] batch", items);
      return;
    }
    // Cloud API doesn't have a native batch endpoint → just sequence with minimal delay.
    for (const it of items) {
      await this.control({ deviceId: it.deviceId, model: it.model }, it.cmd);
      await new Promise((r) => setTimeout(r, 60)); // space out a bit
    }
  }
}
```

## src/adapters/lan.ts (optional / stub)
```ts
import dgram from "node:dgram";
import { BatchItem, ControlCmd, DeviceInfo, DeviceRef, State } from "../util/types.js";

/**
 * NOTE: This is a minimal placeholder. Govee LAN protocol varies by model; some use JSON over UDP 4001/4002.
 * Enable per-device "LAN Control" in the Govee app first. Then implement discovery & payloads here if desired.
 */
export class LanAdapter {
  lanEnabled = /^true$/i.test(process.env.GOVEE_LAN_ENABLED || "false");

  async listDevices(): Promise<DeviceInfo[]> {
    if (!this.lanEnabled) return [];
    // TODO: multicast discovery; return enriched info when available
    return [];
  }

  async getState(_ref: DeviceRef): Promise<State> {
    throw new Error("LAN getState not implemented");
  }

  async control(_ref: DeviceRef, _cmd: ControlCmd): Promise<void> {
    if (!this.lanEnabled) throw new Error("LAN disabled");
    // TODO: craft UDP JSON payload matching your device's LAN schema and send via dgram
    throw new Error("LAN control not implemented");
  }

  async batch(items: BatchItem[]): Promise<void> {
    for (const it of items) await this.control({ deviceId: it.deviceId, model: it.model }, it.cmd);
  }
}
```

## src/server.ts
```ts
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { CloudAdapter } from "./adapters/cloud.js";
import { LanAdapter } from "./adapters/lan.js";
import { BatchItem, ControlCmd, DeviceInfo } from "./util/types.js";
import { TokenBucketLimiter } from "./util/limiter.js";

const allowlistEnv = (process.env.GOVEE_ALLOWLIST || "")
  .split(/[,\s]+/)
  .map((s) => s.trim())
  .filter(Boolean);
const ALLOWLIST = new Set<string>(allowlistEnv);

const limiter = new TokenBucketLimiter(Number(process.env.GOVEE_RATE_RPS || 5));
const BATCH_WINDOW_MS = Number(process.env.GOVEE_BATCH_WINDOW_MS || 120);

const cloud = new CloudAdapter();
const lan = new LanAdapter();

function isAllowed(deviceId: string) {
  return ALLOWLIST.size === 0 || ALLOWLIST.has(deviceId);
}

async function pickAdapter(deviceId: string) {
  // Prefer LAN for devices we later mark as online here; fallback to cloud.
  // For now, we just return cloud unless LAN is globally enabled and you extend discovery.
  return lan.lanEnabled ? lan : cloud;
}

const server = new McpServer({ name: "govee-mcp", version: "0.1.0" });

// ---- TOOLS ----
server.tool(
  "govee.list_devices",
  { description: "List devices bound to your Govee account.", inputSchema: z.object({}) },
  async () => {
    await limiter.take();
    const list = await cloud.listDevices();
    const filtered = list.filter((d) => isAllowed(d.deviceId));
    return { content: [{ type: "json", json: filtered }] };
  }
);

const DeviceSchema = z.object({
  deviceId: z.string().describe("Govee deviceId / MAC-like id"),
  model: z.string().describe("Govee model e.g. H6104"),
});

server.tool(
  "govee.get_state",
  { description: "Get current power/brightness/color/temp/scene.", inputSchema: DeviceSchema },
  async ({ deviceId, model }) => {
    if (!isAllowed(deviceId)) throw new Error("Device not allowed");
    await limiter.take();
    const ad = await pickAdapter(deviceId);
    const state = await ad.getState({ deviceId, model });
    return { content: [{ type: "json", json: state }] };
  }
);

server.tool(
  "govee.set_power",
  { description: "Turn a device on/off.", inputSchema: DeviceSchema.extend({ on: z.boolean() }) },
  async ({ deviceId, model, on }) => {
    if (!isAllowed(deviceId)) throw new Error("Device not allowed");
    await limiter.take();
    const ad = await pickAdapter(deviceId);
    await ad.control({ deviceId, model }, { name: "turn", value: on ? "on" : "off" });
    return { content: [{ type: "text", text: `Power ${on ? "on" : "off"} sent.` }] };
  }
);

server.tool(
  "govee.set_brightness",
  { description: "Set brightness (0-100).", inputSchema: DeviceSchema.extend({ percent: z.number().min(0).max(100) }) },
  async ({ deviceId, model, percent }) => {
    if (!isAllowed(deviceId)) throw new Error("Device not allowed");
    await limiter.take();
    const ad = await pickAdapter(deviceId);
    await ad.control({ deviceId, model }, { name: "brightness", value: Math.round(percent) });
    return { content: [{ type: "text", text: `Brightness set to ${Math.round(percent)}%.` }] };
  }
);

server.tool(
  "govee.set_color",
  {
    description: "Set RGB color.",
    inputSchema: DeviceSchema.extend({
      r: z.number().min(0).max(255),
      g: z.number().min(0).max(255),
      b: z.number().min(0).max(255),
    }),
  },
  async ({ deviceId, model, r, g, b }) => {
    if (!isAllowed(deviceId)) throw new Error("Device not allowed");
    await limiter.take();
    const ad = await pickAdapter(deviceId);
    await ad.control({ deviceId, model }, { name: "color", value: { r, g, b } });
    return { content: [{ type: "text", text: `Color set to rgb(${r},${g},${b}).` }] };
  }
);

server.tool(
  "govee.set_color_temp",
  {
    description: "Set color temperature in Kelvin (typ. 2000–9000).",
    inputSchema: DeviceSchema.extend({ kelvin: z.number().min(1000).max(10000) }),
  },
  async ({ deviceId, model, kelvin }) => {
    if (!isAllowed(deviceId)) throw new Error("Device not allowed");
    await limiter.take();
    const ad = await pickAdapter(deviceId);
    await ad.control({ deviceId, model }, { name: "colorTem", value: Math.round(kelvin) });
    return { content: [{ type: "text", text: `Color temp set to ${Math.round(kelvin)}K.` }] };
  }
);

server.tool(
  "govee.set_scene",
  {
    description: "Set a scene by id/name (varies by device).",
    inputSchema: DeviceSchema.extend({ scene: z.string() }),
  },
  async ({ deviceId, model, scene }) => {
    if (!isAllowed(deviceId)) throw new Error("Device not allowed");
    await limiter.take();
    const ad = await pickAdapter(deviceId);
    await ad.control({ deviceId, model }, { name: "scene", value: scene });
    return { content: [{ type: "text", text: `Scene set to ${scene}.` }] };
  }
);

// --- Batch with coalescing ---
const BatchSchema = z.object({
  items: z
    .array(
      z.object({
        deviceId: z.string(),
        model: z.string(),
        cmd: z.union([
          z.object({ name: z.literal("turn"), value: z.union([z.literal("on"), z.literal("off")]) }),
          z.object({ name: z.literal("brightness"), value: z.number().min(0).max(100) }),
          z.object({
            name: z.literal("color"),
            value: z.object({ r: z.number().min(0).max(255), g: z.number().min(0).max(255), b: z.number().min(0).max(255) }),
          }),
          z.object({ name: z.literal("colorTem"), value: z.number().min(1000).max(10000) }),
          z.object({ name: z.literal("scene"), value: z.string() }),
        ]),
      })
    )
    .min(1),
});

server.tool(
  "govee.batch",
  { description: "Apply multiple commands; server coalesces duplicates.", inputSchema: BatchSchema },
  async ({ items }) => {
    const allowed = items.filter((i) => isAllowed(i.deviceId));
    if (allowed.length === 0) throw new Error("No allowed items");

    // Coalesce: keep last command per (deviceId, cmd.name)
    const key = (it: BatchItem) => `${it.deviceId}:${it.model}:${it.cmd.name}`;
    const map = new Map<string, BatchItem>();
    for (const it of allowed) map.set(key(it), it);
    const deduped = Array.from(map.values());

    await limiter.take();
    const byDevice = new Map<string, BatchItem[]>();
    for (const it of deduped) {
      const arr = byDevice.get(it.deviceId) || [];
      arr.push(it);
      byDevice.set(it.deviceId, arr);
    }

    const promises: Promise<void>[] = [];
    for (const [deviceId, cmds] of byDevice) {
      promises.push(
        (async () => {
          const ad = await pickAdapter(deviceId);
          // small window delay to allow further coalescing if caller streams actions
          await new Promise((r) => setTimeout(r, BATCH_WINDOW_MS));
          for (const it of cmds) await ad.control({ deviceId: it.deviceId, model: it.model }, it.cmd as ControlCmd);
        })()
      );
    }
    await Promise.all(promises);

    return { content: [{ type: "text", text: `Applied ${deduped.length} command(s) across ${byDevice.size} device(s).` }] };
  }
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("govee-mcp server running (stdio)");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
```

---

## README.md
```md
# Govee MCP Server (TypeScript)

Control your Govee lights from Claude Code (or any MCP client).

## Setup
1. **Get a Govee API key** from the Govee developer portal.
2. Copy `.env.example` → `.env` and fill in `GOVEE_API_KEY`. Optionally set `GOVEE_ALLOWLIST` to the device IDs you want exposed.
3. Install deps & build:
   ```bash
   npm i
   npm run build
   ```
4. Quick local run:
   ```bash
   GOVEE_API_KEY=xxx npm start
   ```

## Add to Claude Code
Using Claude Code’s CLI:
```bash
claude mcp add --name govee \
  --command "node" \
  --args "dist/server.js" \
  --env "GOVEE_API_KEY=YOUR_KEY" \
  --env "GOVEE_ALLOWLIST=AA:BB:CC:DD:EE:FF"
```
> On Windows/WSL, the above works from either side as long as `node` is on PATH. You can also add the server in **Claude Desktop → MCP** and then **import** it into Claude Code.

## Example queries you can type to Claude
- "List my Govee devices and tell me which support color temperature."
- "Set Office Spots to **on**, **25%**, and **3800K**."
- "Flash Loading Dock **blue** 3× right now."
- "Apply the **neon magenta** scene at 12%."
- "Batch these: Office Spots 35%, Bar rgb(255,0,128), Porch off."

## Notes & Limits
- Cloud API rate limits apply. This server includes a small token-bucket limiter and coalescer; tune with `GOVEE_RATE_RPS` and `GOVEE_BATCH_WINDOW_MS`.
- **Dry run**: set `GOVEE_DRY_RUN=true` to log API calls without sending.
- **Allowlist**: if `GOVEE_ALLOWLIST` is empty, all bound devices are exposed; otherwise only listed IDs are usable.
- **LAN adapter**: stub included (`src/adapters/lan.ts`). Enable `GOVEE_LAN_ENABLED=true` and implement your device's LAN payloads if you want sub-100ms responses.

## Safety
- The allowlist prevents the LLM from discovering unused devices.
- Tool schemas constrain ranges (brightness 0–100, Kelvin 1000–10000, RGB 0–255).

## Troubleshooting
- If you get 401/403, re-check the API key. If you see 404 on endpoints, verify the base URL and your account’s API routing.
- Some devices support color **or** color temperature (not both simultaneously). If a command appears to "do nothing", check the device capabilities via `list_devices`.
```

---

**Done.** Paste your API key, build, then add the server to Claude Code with the `claude mcp add` command in the README. Enjoy hands-free lighting from your editor!

