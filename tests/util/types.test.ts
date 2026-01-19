import { describe, it, expect } from "vitest";
import type { DeviceInfo, State, ControlCmd, BatchItem } from "../../src/util/types.js";
import { GoveeApiError } from "../../src/util/types.js";

describe("Type Definitions", () => {
  describe("DeviceInfo", () => {
    it("should accept valid device info", () => {
      const device: DeviceInfo = {
        deviceId: "device-1",
        model: "H6076",
        name: "Lamp",
        capabilities: ["power", "brightness", "color"],
      };

      expect(device).toBeDefined();
    });

    it("should allow optional name and capabilities", () => {
      const device: DeviceInfo = {
        deviceId: "device-1",
        model: "H6076",
      };

      expect(device.name).toBeUndefined();
      expect(device.capabilities).toBeUndefined();
    });
  });

  describe("State", () => {
    it("should accept full state object", () => {
      const state: State = {
        power: "on",
        brightness: 80,
        color: { r: 255, g: 128, b: 0 },
        colorTem: 4000,
        scene: "party",
      };

      expect(state).toBeDefined();
    });

    it("should accept partial state", () => {
      const state: State = {
        power: "off",
      };

      expect(state.power).toBe("off");
      expect(state.brightness).toBeUndefined();
    });

    it("should limit power values", () => {
      const onState: State = { power: "on" };
      const offState: State = { power: "off" };

      expect(onState.power).toBe("on");
      expect(offState.power).toBe("off");
    });
  });

  describe("ControlCmd", () => {
    it("should accept turn command", () => {
      const cmd: ControlCmd = { name: "turn", value: "on" };
      expect(cmd.name).toBe("turn");
      expect(cmd.value).toBe("on");
    });

    it("should accept brightness command", () => {
      const cmd: ControlCmd = { name: "brightness", value: 50 };
      expect(cmd.name).toBe("brightness");
      expect(cmd.value).toBe(50);
    });

    it("should accept color command", () => {
      const cmd: ControlCmd = { name: "color", value: { r: 255, g: 128, b: 0 } };
      expect(cmd.name).toBe("color");
      expect(cmd.value).toEqual({ r: 255, g: 128, b: 0 });
    });

    it("should accept color temperature command", () => {
      const cmd: ControlCmd = { name: "colorTem", value: 4000 };
      expect(cmd.name).toBe("colorTem");
      expect(cmd.value).toBe(4000);
    });

    it("should accept scene command", () => {
      const cmd: ControlCmd = { name: "scene", value: "party" };
      expect(cmd.name).toBe("scene");
      expect(cmd.value).toBe("party");
    });
  });

  describe("BatchItem", () => {
    it("should combine device reference and command", () => {
      const item: BatchItem = {
        deviceId: "device-1",
        model: "H6076",
        cmd: { name: "turn", value: "on" },
      };

      expect(item.deviceId).toBe("device-1");
      expect(item.model).toBe("H6076");
      expect(item.cmd).toEqual({ name: "turn", value: "on" });
    });
  });

  describe("GoveeApiError", () => {
    it("should create error with status code", () => {
      const error = new GoveeApiError("Test error", 401);
      expect(error.message).toBe("Test error");
      expect(error.statusCode).toBe(401);
      expect(error.name).toBe("GoveeApiError");
    });

    it("should mark 429 as retryable", () => {
      const error = new GoveeApiError("Rate limited", 429);
      expect(error.isRetryable).toBe(true);
    });

    it("should mark 503 as retryable", () => {
      const error = new GoveeApiError("Service unavailable", 503);
      expect(error.isRetryable).toBe(true);
    });

    it("should mark 500-599 as retryable", () => {
      const error500 = new GoveeApiError("Internal server error", 500);
      const error502 = new GoveeApiError("Bad gateway", 502);
      const error504 = new GoveeApiError("Gateway timeout", 504);

      expect(error500.isRetryable).toBe(true);
      expect(error502.isRetryable).toBe(true);
      expect(error504.isRetryable).toBe(true);
    });

    it("should mark 400 as not retryable", () => {
      const error = new GoveeApiError("Bad request", 400);
      expect(error.isRetryable).toBe(false);
    });

    it("should mark 401 as not retryable", () => {
      const error = new GoveeApiError("Unauthorized", 401);
      expect(error.isRetryable).toBe(false);
    });

    it("should mark 403 as not retryable", () => {
      const error = new GoveeApiError("Forbidden", 403);
      expect(error.isRetryable).toBe(false);
    });

    it("should mark 404 as not retryable", () => {
      const error = new GoveeApiError("Not found", 404);
      expect(error.isRetryable).toBe(false);
    });

    it("should be an instance of Error", () => {
      const error = new GoveeApiError("Test", 500);
      expect(error).toBeInstanceOf(Error);
    });
  });
});
