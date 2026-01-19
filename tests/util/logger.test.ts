import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

describe("logger", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("should export a logger instance", async () => {
    const { logger } = await import("../../src/util/logger.js");
    expect(logger).toBeDefined();
    expect(typeof logger.info).toBe("function");
    expect(typeof logger.error).toBe("function");
    expect(typeof logger.debug).toBe("function");
    expect(typeof logger.warn).toBe("function");
  });

  it("should create child loggers with bindings", async () => {
    const { createChildLogger } = await import("../../src/util/logger.js");
    const childLogger = createChildLogger({ module: "test-module" });
    expect(childLogger).toBeDefined();
    expect(typeof childLogger.info).toBe("function");
  });

  it("should respect LOG_LEVEL environment variable", async () => {
    vi.stubEnv("LOG_LEVEL", "debug");
    const { logger } = await import("../../src/util/logger.js");
    expect(logger.level).toBe("debug");
  });

  it("should default to info level", async () => {
    vi.stubEnv("LOG_LEVEL", "");
    const { logger } = await import("../../src/util/logger.js");
    expect(logger.level).toBe("info");
  });
});
