import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { CloudAdapter } from "./adapters/cloud.js";
import { LanAdapter } from "./adapters/lan.js";
import { BatchItem, ControlCmd, DeviceInfo } from "./util/types.js";
import { TokenBucketLimiter } from "./util/limiter.js";

const allowlistEnv = (process.env.GOVEE_ALLOWLIST || "")
  .split(/[,\s]+/)
  .map((s: string) => s.trim())
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

const DeviceSchema = z.object({
  deviceId: z.string().describe("Govee deviceId / MAC-like id"),
  model: z.string().describe("Govee model e.g. H6104"),
});

// ---- TOOLS ----
server.registerTool("govee_list_devices", {
  description: "List devices bound to your Govee account.",
  inputSchema: {}
}, async () => {
  await limiter.take();
  const list = await cloud.listDevices();
  const filtered = list.filter((d) => isAllowed(d.deviceId));
  return { content: [{ type: "text", text: JSON.stringify(filtered, null, 2) }] };
});

server.registerTool("govee_get_state", {
  description: "Get current power/brightness/color/temp/scene.",
  inputSchema: { deviceId: z.string(), model: z.string() }
}, async ({ deviceId, model }) => {
  if (!isAllowed(deviceId)) throw new Error("Device not allowed");
  await limiter.take();
  const ad = await pickAdapter(deviceId);
  const state = await ad.getState({ deviceId, model });
  return { content: [{ type: "text", text: JSON.stringify(state, null, 2) }] };
});

server.registerTool("govee_set_power", {
  description: "Turn a device on/off.",
  inputSchema: { deviceId: z.string(), model: z.string(), on: z.boolean() }
}, async ({ deviceId, model, on }) => {
  if (!isAllowed(deviceId)) throw new Error("Device not allowed");
  await limiter.take();
  const ad = await pickAdapter(deviceId);
  await ad.control({ deviceId, model }, { name: "turn", value: on ? "on" : "off" });
  return { content: [{ type: "text", text: `Power ${on ? "on" : "off"} sent.` }] };
});

server.registerTool("govee_set_brightness", {
  description: "Set brightness (0-100).",
  inputSchema: { deviceId: z.string(), model: z.string(), percent: z.number().min(0).max(100) }
}, async ({ deviceId, model, percent }) => {
  if (!isAllowed(deviceId)) throw new Error("Device not allowed");
  await limiter.take();
  const ad = await pickAdapter(deviceId);
  await ad.control({ deviceId, model }, { name: "brightness", value: Math.round(percent) });
  return { content: [{ type: "text", text: `Brightness set to ${Math.round(percent)}%.` }] };
});

server.registerTool("govee_set_color", {
  description: "Set RGB color.",
  inputSchema: {
    deviceId: z.string(),
    model: z.string(),
    r: z.number().min(0).max(255),
    g: z.number().min(0).max(255),
    b: z.number().min(0).max(255)
  }
}, async ({ deviceId, model, r, g, b }) => {
  if (!isAllowed(deviceId)) throw new Error("Device not allowed");
  await limiter.take();
  const ad = await pickAdapter(deviceId);
  await ad.control({ deviceId, model }, { name: "color", value: { r, g, b } });
  return { content: [{ type: "text", text: `Color set to rgb(${r},${g},${b}).` }] };
});

server.registerTool("govee_set_color_temp", {
  description: "Set color temperature in Kelvin (typ. 2000–9000).",
  inputSchema: { deviceId: z.string(), model: z.string(), kelvin: z.number().min(1000).max(10000) }
}, async ({ deviceId, model, kelvin }) => {
  if (!isAllowed(deviceId)) throw new Error("Device not allowed");
  await limiter.take();
  const ad = await pickAdapter(deviceId);
  await ad.control({ deviceId, model }, { name: "colorTem", value: Math.round(kelvin) });
  return { content: [{ type: "text", text: `Color temp set to ${Math.round(kelvin)}K.` }] };
});

server.registerTool("govee_set_scene", {
  description: "Set a scene by id/name (varies by device).",
  inputSchema: { deviceId: z.string(), model: z.string(), scene: z.string() }
}, async ({ deviceId, model, scene }) => {
  if (!isAllowed(deviceId)) throw new Error("Device not allowed");
  await limiter.take();
  const ad = await pickAdapter(deviceId);
  await ad.control({ deviceId, model }, { name: "scene", value: scene });
  return { content: [{ type: "text", text: `Scene set to ${scene}.` }] };
});

// --- Batch with coalescing ---
server.registerTool("govee_batch", {
  description: "Apply multiple commands; server coalesces duplicates.",
  inputSchema: {
    items: z.array(z.object({
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
    })).min(1)
  }
}, async ({ items }) => {
  const allowed = items.filter((i: any) => isAllowed(i.deviceId));
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
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("govee-mcp server running (stdio)");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});