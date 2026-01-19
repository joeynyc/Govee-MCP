import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const mockFetch = vi.fn();

vi.mock("undici", () => ({
  fetch: mockFetch,
}));

// Import after mock is set up
const { CloudAdapter } = await import("../../src/adapters/cloud.js");

describe("CloudAdapter", () => {
  let adapter: InstanceType<typeof CloudAdapter>;

  beforeEach(() => {
    vi.stubEnv("GOVEE_API_KEY", "test-key");
    vi.stubEnv("GOVEE_DRY_RUN", "false");
    adapter = new CloudAdapter();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("should list devices successfully", async () => {
    const mockDevices = [
      { device: "device-1", sku: "H6076", deviceName: "Lamp", capabilities: [{ type: "power" }] },
      { device: "device-2", sku: "H7094", deviceName: "Spotlight", capabilities: [] },
    ];

    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ data: mockDevices }),
    });

    const result = await adapter.listDevices();

    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({
      deviceId: "device-1",
      model: "H6076",
      name: "Lamp",
      capabilities: ["power"],
    });
  });

  it("should handle empty device list", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ data: [] }),
    });

    const result = await adapter.listDevices();

    expect(result).toEqual([]);
  });

  it("should get device state with all capabilities", async () => {
    const mockState = {
      capabilities: [
        { type: "devices.capabilities.on_off", state: { value: 1 } },
        { type: "devices.capabilities.range", instance: "brightness", state: { value: 80 } },
        { type: "devices.capabilities.color_setting", instance: "colorRgb", state: { value: 0xff00ff } },
        { type: "devices.capabilities.color_setting", instance: "colorTemperatureK", state: { value: 3000 } },
      ],
    };

    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ data: mockState }),
    });

    const result = await adapter.getState({ deviceId: "device-1", model: "H6076" });

    expect(result).toEqual({
      power: "on",
      brightness: 80,
      color: { r: 255, g: 0, b: 255 },
      colorTem: 3000,
    });
  });

  it("should get device state with minimal capabilities", async () => {
    const mockState = {
      capabilities: [
        { type: "devices.capabilities.on_off", state: { value: 0 } },
      ],
    };

    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ data: mockState }),
    });

    const result = await adapter.getState({ deviceId: "device-1", model: "H6076" });

    expect(result).toEqual({
      power: "off",
    });
  });

  it("should send power on command", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({}),
    });

    await adapter.control({ deviceId: "device-1", model: "H6076" }, { name: "turn", value: "on" });

    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining("/device/control"),
      expect.objectContaining({
        method: "POST",
        body: expect.stringContaining('"value":1'),
      })
    );
  });

  it("should send power off command", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({}),
    });

    await adapter.control({ deviceId: "device-1", model: "H6076" }, { name: "turn", value: "off" });

    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining("/device/control"),
      expect.objectContaining({
        method: "POST",
        body: expect.stringContaining('"value":0'),
      })
    );
  });

  it("should send brightness command", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({}),
    });

    await adapter.control({ deviceId: "device-1", model: "H6076" }, { name: "brightness", value: 50 });

    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining("/device/control"),
      expect.objectContaining({
        method: "POST",
        body: expect.stringContaining('"value":50'),
      })
    );
  });

  it("should send color command", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({}),
    });

    await adapter.control(
      { deviceId: "device-1", model: "H6076" },
      { name: "color", value: { r: 255, g: 128, b: 0 } }
    );

    const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(callBody.payload.capability.value).toBe(0xff8000);
  });

  it("should send color temperature command", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({}),
    });

    await adapter.control({ deviceId: "device-1", model: "H6076" }, { name: "colorTem", value: 4000 });

    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining("/device/control"),
      expect.objectContaining({
        method: "POST",
        body: expect.stringContaining('"value":4000'),
      })
    );
  });

  it("should send scene command", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({}),
    });

    await adapter.control({ deviceId: "device-1", model: "H6076" }, { name: "scene", value: "party" });

    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining("/device/control"),
      expect.objectContaining({
        method: "POST",
        body: expect.stringContaining('"value":"party"'),
      })
    );
  });

  it("should throw error for unsupported command", async () => {
    await expect(
      adapter.control({ deviceId: "device-1", model: "H6076" }, { name: "invalid" as any, value: "test" })
    ).rejects.toThrow("Unsupported command");
  });

  it("should skip API calls in dry-run mode", async () => {
    vi.stubEnv("GOVEE_DRY_RUN", "true");

    await adapter.control({ deviceId: "device-1", model: "H6076" }, { name: "turn", value: "on" });

    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("should handle API error response", async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 401,
      text: () => Promise.resolve("Unauthorized"),
    });

    await expect(adapter.listDevices()).rejects.toThrow("Govee API error 401");
  });

  it("should execute batch commands sequentially", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({}),
    });

    const items = [
      { deviceId: "device-1", model: "H6076", cmd: { name: "turn" as const, value: "on" as const } },
      { deviceId: "device-1", model: "H6076", cmd: { name: "brightness" as const, value: 50 } },
    ];

    await adapter.batch(items);

    expect(mockFetch).toHaveBeenCalledTimes(2);
  });
});
