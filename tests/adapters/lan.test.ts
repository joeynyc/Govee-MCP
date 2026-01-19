import { describe, it, expect, beforeEach, vi } from "vitest";
import { LanAdapter } from "../../src/adapters/lan.js";
import type { GoveeAdapter } from "../../src/adapters/types.js";

describe("LanAdapter", () => {
  let adapter: LanAdapter;

  beforeEach(() => {
    vi.stubEnv("GOVEE_LAN_ENABLED", "false");
    adapter = new LanAdapter();
  });

  describe("without fallback", () => {
    it("should return empty device list when LAN disabled and no fallback", async () => {
      await expect(adapter.listDevices()).rejects.toThrow("No fallback adapter configured");
    });

    it("should throw error when trying to get state without fallback", async () => {
      await expect(adapter.getState({ deviceId: "device-1", model: "H6076" })).rejects.toThrow(
        "No fallback adapter configured"
      );
    });

    it("should throw error when trying to control device without fallback", async () => {
      await expect(
        adapter.control({ deviceId: "device-1", model: "H6076" }, { name: "turn", value: "on" })
      ).rejects.toThrow("No fallback adapter configured");
    });
  });

  describe("with fallback", () => {
    let mockFallback: GoveeAdapter;

    beforeEach(() => {
      mockFallback = {
        listDevices: vi.fn().mockResolvedValue([{ deviceId: "device-1", model: "H6076", name: "Test" }]),
        getState: vi.fn().mockResolvedValue({ power: "on", brightness: 50 }),
        control: vi.fn().mockResolvedValue(undefined),
        batch: vi.fn().mockResolvedValue(undefined),
      };
      adapter.setFallback(mockFallback);
    });

    it("should fallback to cloud for listDevices when LAN disabled", async () => {
      const result = await adapter.listDevices();
      expect(result).toHaveLength(1);
      expect(mockFallback.listDevices).toHaveBeenCalled();
    });

    it("should fallback to cloud for getState when LAN disabled", async () => {
      const result = await adapter.getState({ deviceId: "device-1", model: "H6076" });
      expect(result).toEqual({ power: "on", brightness: 50 });
      expect(mockFallback.getState).toHaveBeenCalledWith({ deviceId: "device-1", model: "H6076" });
    });

    it("should fallback to cloud for control when LAN disabled", async () => {
      await adapter.control({ deviceId: "device-1", model: "H6076" }, { name: "turn", value: "on" });
      expect(mockFallback.control).toHaveBeenCalledWith(
        { deviceId: "device-1", model: "H6076" },
        { name: "turn", value: "on" }
      );
    });

    it("should fallback to cloud for batch when LAN disabled", async () => {
      const items = [
        { deviceId: "device-1", model: "H6076", cmd: { name: "turn" as const, value: "on" as const } },
      ];
      await adapter.batch(items);
      expect(mockFallback.batch).toHaveBeenCalledWith(items);
    });

    it("should fallback when LAN operation fails", async () => {
      vi.stubEnv("GOVEE_LAN_ENABLED", "true");
      const enabledAdapter = new LanAdapter();
      enabledAdapter.setFallback(mockFallback);

      // LAN is enabled but operations will fail (not implemented) and fallback
      const result = await enabledAdapter.listDevices();
      expect(result).toHaveLength(1);
      expect(mockFallback.listDevices).toHaveBeenCalled();
    });
  });

  describe("environment variable handling", () => {
    it("should respect GOVEE_LAN_ENABLED environment variable", () => {
      vi.stubEnv("GOVEE_LAN_ENABLED", "true");
      const enabledAdapter = new LanAdapter();
      expect(enabledAdapter.lanEnabled).toBe(true);

      vi.stubEnv("GOVEE_LAN_ENABLED", "false");
      const disabledAdapter = new LanAdapter();
      expect(disabledAdapter.lanEnabled).toBe(false);
    });

    it("should handle case-insensitive enabled value", () => {
      vi.stubEnv("GOVEE_LAN_ENABLED", "TRUE");
      const upperCaseAdapter = new LanAdapter();
      expect(upperCaseAdapter.lanEnabled).toBe(true);

      vi.stubEnv("GOVEE_LAN_ENABLED", "True");
      const mixedCaseAdapter = new LanAdapter();
      expect(mixedCaseAdapter.lanEnabled).toBe(true);
    });

    it("should treat empty string as disabled", () => {
      vi.stubEnv("GOVEE_LAN_ENABLED", "");
      const emptyAdapter = new LanAdapter();
      expect(emptyAdapter.lanEnabled).toBe(false);
    });
  });
});
