import { Server } from "@modelcontextprotocol/sdk/server/index.js";
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

const server = new Server({ 
  name: "govee-mcp", 
  version: "0.1.0" 
}, {
  capabilities: {
    tools: {}
  }
});

const DeviceSchema = z.object({
  deviceId: z.string().describe("Govee deviceId / MAC-like id"),
  model: z.string().describe("Govee model e.g. H6104"),
});

// Handle tools/list request
server.setRequestHandler(z.object({ method: z.literal("tools/list") }), async () => {
  return {
    tools: [
      {
        name: "govee.list_devices",
        description: "List devices bound to your Govee account.",
        inputSchema: {}
      },
      {
        name: "govee.get_state", 
        description: "Get current power/brightness/color/temp/scene.",
        inputSchema: {
          type: "object",
          properties: {
            deviceId: { type: "string", description: "Govee deviceId / MAC-like id" },
            model: { type: "string", description: "Govee model e.g. H6104" }
          },
          required: ["deviceId", "model"]
        }
      },
      {
        name: "govee.set_power",
        description: "Turn a device on/off.",
        inputSchema: {
          type: "object", 
          properties: {
            deviceId: { type: "string", description: "Govee deviceId / MAC-like id" },
            model: { type: "string", description: "Govee model e.g. H6104" },
            on: { type: "boolean" }
          },
          required: ["deviceId", "model", "on"]
        }
      },
      {
        name: "govee.set_brightness",
        description: "Set brightness (0-100).",
        inputSchema: {
          type: "object",
          properties: {
            deviceId: { type: "string", description: "Govee deviceId / MAC-like id" },
            model: { type: "string", description: "Govee model e.g. H6104" },
            percent: { type: "number", minimum: 0, maximum: 100 }
          },
          required: ["deviceId", "model", "percent"]
        }
      },
      {
        name: "govee.set_color",
        description: "Set RGB color.",
        inputSchema: {
          type: "object",
          properties: {
            deviceId: { type: "string", description: "Govee deviceId / MAC-like id" },
            model: { type: "string", description: "Govee model e.g. H6104" },
            r: { type: "number", minimum: 0, maximum: 255 },
            g: { type: "number", minimum: 0, maximum: 255 },
            b: { type: "number", minimum: 0, maximum: 255 }
          },
          required: ["deviceId", "model", "r", "g", "b"]
        }
      },
      {
        name: "govee.set_color_temp",
        description: "Set color temperature in Kelvin (typ. 2000–9000).",
        inputSchema: {
          type: "object",
          properties: {
            deviceId: { type: "string", description: "Govee deviceId / MAC-like id" },
            model: { type: "string", description: "Govee model e.g. H6104" },
            kelvin: { type: "number", minimum: 1000, maximum: 10000 }
          },
          required: ["deviceId", "model", "kelvin"]
        }
      },
      {
        name: "govee.set_scene",
        description: "Set a scene by id/name (varies by device).",
        inputSchema: {
          type: "object",
          properties: {
            deviceId: { type: "string", description: "Govee deviceId / MAC-like id" },
            model: { type: "string", description: "Govee model e.g. H6104" },
            scene: { type: "string" }
          },
          required: ["deviceId", "model", "scene"]
        }
      },
      {
        name: "govee.batch",
        description: "Apply multiple commands; server coalesces duplicates.",
        inputSchema: {
          type: "object",
          properties: {
            items: {
              type: "array",
              minItems: 1,
              items: {
                type: "object",
                properties: {
                  deviceId: { type: "string" },
                  model: { type: "string" },
                  cmd: {
                    oneOf: [
                      {
                        type: "object",
                        properties: {
                          name: { type: "string", enum: ["turn"] },
                          value: { type: "string", enum: ["on", "off"] }
                        },
                        required: ["name", "value"]
                      },
                      {
                        type: "object", 
                        properties: {
                          name: { type: "string", enum: ["brightness"] },
                          value: { type: "number", minimum: 0, maximum: 100 }
                        },
                        required: ["name", "value"]
                      },
                      {
                        type: "object",
                        properties: {
                          name: { type: "string", enum: ["color"] },
                          value: {
                            type: "object",
                            properties: {
                              r: { type: "number", minimum: 0, maximum: 255 },
                              g: { type: "number", minimum: 0, maximum: 255 },
                              b: { type: "number", minimum: 0, maximum: 255 }
                            },
                            required: ["r", "g", "b"]
                          }
                        },
                        required: ["name", "value"]
                      },
                      {
                        type: "object",
                        properties: {
                          name: { type: "string", enum: ["colorTem"] },
                          value: { type: "number", minimum: 1000, maximum: 10000 }
                        },
                        required: ["name", "value"]
                      },
                      {
                        type: "object",
                        properties: {
                          name: { type: "string", enum: ["scene"] },
                          value: { type: "string" }
                        },
                        required: ["name", "value"]
                      }
                    ]
                  }
                },
                required: ["deviceId", "model", "cmd"]
              }
            }
          },
          required: ["items"]
        }
      }
    ]
  };
});

// Handle tools/call request  
server.setRequestHandler(z.object({ method: z.literal("tools/call") }), async (request) => {
  const { name, arguments: args } = (request as any).params;
  
  try {
    switch (name) {
      case "govee.list_devices":
        await limiter.take();
        const list = await cloud.listDevices();
        const filtered = list.filter((d) => isAllowed(d.deviceId));
        return {
          content: [{ type: "text", text: JSON.stringify(filtered, null, 2) }]
        };

      case "govee.get_state": {
        const { deviceId, model } = args as { deviceId: string; model: string };
        if (!isAllowed(deviceId)) throw new Error("Device not allowed");
        await limiter.take();
        const ad = await pickAdapter(deviceId);
        const state = await ad.getState({ deviceId, model });
        return {
          content: [{ type: "text", text: JSON.stringify(state, null, 2) }]
        };
      }

      case "govee.set_power": {
        const { deviceId, model, on } = args as { deviceId: string; model: string; on: boolean };
        if (!isAllowed(deviceId)) throw new Error("Device not allowed");
        await limiter.take();
        const ad = await pickAdapter(deviceId);
        await ad.control({ deviceId, model }, { name: "turn", value: on ? "on" : "off" });
        return {
          content: [{ type: "text", text: `Power ${on ? "on" : "off"} sent.` }]
        };
      }

      case "govee.set_brightness": {
        const { deviceId, model, percent } = args as { deviceId: string; model: string; percent: number };
        if (!isAllowed(deviceId)) throw new Error("Device not allowed");
        await limiter.take();
        const ad = await pickAdapter(deviceId);
        await ad.control({ deviceId, model }, { name: "brightness", value: Math.round(percent) });
        return {
          content: [{ type: "text", text: `Brightness set to ${Math.round(percent)}%.` }]
        };
      }

      case "govee.set_color": {
        const { deviceId, model, r, g, b } = args as { deviceId: string; model: string; r: number; g: number; b: number };
        if (!isAllowed(deviceId)) throw new Error("Device not allowed");
        await limiter.take();
        const ad = await pickAdapter(deviceId);
        await ad.control({ deviceId, model }, { name: "color", value: { r, g, b } });
        return {
          content: [{ type: "text", text: `Color set to rgb(${r},${g},${b}).` }]
        };
      }

      case "govee.set_color_temp": {
        const { deviceId, model, kelvin } = args as { deviceId: string; model: string; kelvin: number };
        if (!isAllowed(deviceId)) throw new Error("Device not allowed");
        await limiter.take();
        const ad = await pickAdapter(deviceId);
        await ad.control({ deviceId, model }, { name: "colorTem", value: Math.round(kelvin) });
        return {
          content: [{ type: "text", text: `Color temp set to ${Math.round(kelvin)}K.` }]
        };
      }

      case "govee.set_scene": {
        const { deviceId, model, scene } = args as { deviceId: string; model: string; scene: string };
        if (!isAllowed(deviceId)) throw new Error("Device not allowed");
        await limiter.take();
        const ad = await pickAdapter(deviceId);
        await ad.control({ deviceId, model }, { name: "scene", value: scene });
        return {
          content: [{ type: "text", text: `Scene set to ${scene}.` }]
        };
      }

      case "govee.batch": {
        const { items } = args as { items: BatchItem[] };
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

        return {
          content: [{ type: "text", text: `Applied ${deduped.length} command(s) across ${byDevice.size} device(s).` }]
        };
      }

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (error) {
    return {
      content: [{ 
        type: "text", 
        text: `Error: ${error instanceof Error ? error.message : 'Unknown error'}` 
      }],
      isError: true
    };
  }
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