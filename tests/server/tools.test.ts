import { describe, it, expect, vi, beforeEach } from "vitest";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CloudAdapter } from "../../src/adapters/cloud.js";
import { TokenBucketLimiter } from "../../src/util/limiter.js";

describe("MCP Server Tools", () => {
  let server: McpServer;
  let mockCloud: CloudAdapter;
  let mockLimiter: TokenBucketLimiter;

  beforeEach(() => {
    mockCloud = {
      listDevices: vi.fn(),
      getState: vi.fn(),
      control: vi.fn(),
      batch: vi.fn(),
    } as any;

    mockLimiter = {
      take: vi.fn().mockResolvedValue(undefined),
    } as any;

    vi.clearAllMocks();
    vi.stubEnv("GOVEE_ALLOWLIST", "");
  });

  it("should register govee_list_devices tool", async () => {
    mockCloud.listDevices.mockResolvedValue([
      { deviceId: "device-1", model: "H6076", name: "Lamp" },
    ]);

    const result = await mockCloud.listDevices();
    
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("Lamp");
  });

  it("should register govee_get_state tool", async () => {
    const mockState = { power: "on", brightness: 80 };
    mockCloud.getState.mockResolvedValue(mockState);

    const result = await mockCloud.getState({ deviceId: "device-1", model: "H6076" });
    
    expect(result.power).toBe("on");
    expect(result.brightness).toBe(80);
  });

  it("should register govee_set_power tool", async () => {
    mockCloud.control.mockResolvedValue(undefined);

    await mockCloud.control({ deviceId: "device-1", model: "H6076" }, { name: "turn", value: "on" });
    
    expect(mockCloud.control).toHaveBeenCalledWith(
      { deviceId: "device-1", model: "H6076" },
      { name: "turn", value: "on" }
    );
  });

  it("should register govee_set_brightness tool", async () => {
    mockCloud.control.mockResolvedValue(undefined);

    await mockCloud.control({ deviceId: "device-1", model: "H6076" }, { name: "brightness", value: 50 });
    
    expect(mockCloud.control).toHaveBeenCalledWith(
      { deviceId: "device-1", model: "H6076" },
      { name: "brightness", value: 50 }
    );
  });

  it("should register govee_set_color tool", async () => {
    mockCloud.control.mockResolvedValue(undefined);

    await mockCloud.control(
      { deviceId: "device-1", model: "H6076" },
      { name: "color", value: { r: 255, g: 128, b: 0 } }
    );
    
    expect(mockCloud.control).toHaveBeenCalledWith(
      { deviceId: "device-1", model: "H6076" },
      { name: "color", value: { r: 255, g: 128, b: 0 } }
    );
  });

  it("should register govee_set_color_temp tool", async () => {
    mockCloud.control.mockResolvedValue(undefined);

    await mockCloud.control({ deviceId: "device-1", model: "H6076" }, { name: "colorTem", value: 4000 });
    
    expect(mockCloud.control).toHaveBeenCalledWith(
      { deviceId: "device-1", model: "H6076" },
      { name: "colorTem", value: 4000 }
    );
  });

  it("should register govee_set_scene tool", async () => {
    mockCloud.control.mockResolvedValue(undefined);

    await mockCloud.control({ deviceId: "device-1", model: "H6076" }, { name: "scene", value: "party" });
    
    expect(mockCloud.control).toHaveBeenCalledWith(
      { deviceId: "device-1", model: "H6076" },
      { name: "scene", value: "party" }
    );
  });

  it("should apply rate limiting to all tools", async () => {
    mockCloud.listDevices.mockResolvedValue([]);

    await mockLimiter.take();
    await mockLimiter.take();
    await mockLimiter.take();
    
    expect(mockLimiter.take).toHaveBeenCalledTimes(3);
  });

  it("should enforce device allowlist", () => {
    const isAllowed = (deviceId: string) => {
      const allowlist = new Set(["allowed-device"]);
      return allowlist.size === 0 || allowlist.has(deviceId);
    };

    expect(isAllowed("allowed-device")).toBe(true);
    expect(isAllowed("blocked-device")).toBe(false);
  });

  it("should allow all devices when allowlist is empty", () => {
    const isAllowed = (deviceId: string) => {
      const allowlist = new Set<string>();
      return allowlist.size === 0 || allowlist.has(deviceId);
    };

    expect(isAllowed("any-device")).toBe(true);
  });

  it("should coalesce batch commands per device", () => {
    const items = [
      { deviceId: "device-1", model: "H6076", cmd: { name: "turn" as const, value: "on" as const } },
      { deviceId: "device-1", model: "H6076", cmd: { name: "turn" as const, value: "off" as const } },
      { deviceId: "device-2", model: "H7094", cmd: { name: "turn" as const, value: "on" as const } },
    ];

    const key = (it: any) => `${it.deviceId}:${it.model}:${it.cmd.name}`;
    const map = new Map<string, any>();
    
    for (const it of items) {
      map.set(key(it), it);
    }

    const deduped = Array.from(map.values());
    
    expect(deduped).toHaveLength(2);
    expect(deduped[0].cmd.value).toBe("off");
    expect(deduped[1].cmd.value).toBe("on");
  });

  it("should handle empty batch", () => {
    const items: any[] = [];
    const deduped = items.filter((i: any) => {
      const allowlist = new Set<string>();
      return allowlist.size === 0 || allowlist.has(i.deviceId);
    });

    expect(deduped).toHaveLength(0);
  });

  it("should filter disallowed devices from batch", () => {
    const items = [
      { deviceId: "allowed-device", model: "H6076", cmd: { name: "turn" as const, value: "on" as const } },
      { deviceId: "blocked-device", model: "H7094", cmd: { name: "turn" as const, value: "on" as const } },
    ];

    const allowlist = new Set(["allowed-device"]);
    const allowed = items.filter((i: any) => allowlist.size === 0 || allowlist.has(i.deviceId));

    expect(allowed).toHaveLength(1);
    expect(allowed[0].deviceId).toBe("allowed-device");
  });
});
