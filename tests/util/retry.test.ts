import { describe, it, expect, vi, beforeEach } from "vitest";
import { withRetry, isRetryableError, calculateDelay } from "../../src/util/retry.js";
import { GoveeApiError } from "../../src/util/types.js";

describe("retry utility", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("isRetryableError", () => {
    it("should return true for GoveeApiError with 429", () => {
      const error = new GoveeApiError("Rate limited", 429);
      expect(isRetryableError(error)).toBe(true);
    });

    it("should return true for GoveeApiError with 503", () => {
      const error = new GoveeApiError("Service unavailable", 503);
      expect(isRetryableError(error)).toBe(true);
    });

    it("should return true for GoveeApiError with 500", () => {
      const error = new GoveeApiError("Internal server error", 500);
      expect(isRetryableError(error)).toBe(true);
    });

    it("should return false for GoveeApiError with 401", () => {
      const error = new GoveeApiError("Unauthorized", 401);
      expect(isRetryableError(error)).toBe(false);
    });

    it("should return false for GoveeApiError with 400", () => {
      const error = new GoveeApiError("Bad request", 400);
      expect(isRetryableError(error)).toBe(false);
    });

    it("should return true for TypeError (network error)", () => {
      const error = new TypeError("fetch failed");
      expect(isRetryableError(error)).toBe(true);
    });

    it("should return false for generic Error", () => {
      const error = new Error("Something went wrong");
      expect(isRetryableError(error)).toBe(false);
    });
  });

  describe("calculateDelay", () => {
    it("should calculate exponential delay", () => {
      const config = { maxRetries: 3, baseDelayMs: 1000, maxDelayMs: 30000, jitterMs: 0 };

      expect(calculateDelay(0, config)).toBe(1000); // 1000 * 2^0
      expect(calculateDelay(1, config)).toBe(2000); // 1000 * 2^1
      expect(calculateDelay(2, config)).toBe(4000); // 1000 * 2^2
      expect(calculateDelay(3, config)).toBe(8000); // 1000 * 2^3
    });

    it("should cap at maxDelayMs", () => {
      const config = { maxRetries: 3, baseDelayMs: 1000, maxDelayMs: 5000, jitterMs: 0 };

      expect(calculateDelay(10, config)).toBe(5000); // Would be 1024000, capped to 5000
    });

    it("should add jitter within bounds", () => {
      const config = { maxRetries: 3, baseDelayMs: 1000, maxDelayMs: 30000, jitterMs: 500 };
      const delay = calculateDelay(0, config);

      expect(delay).toBeGreaterThanOrEqual(1000);
      expect(delay).toBeLessThan(1500);
    });
  });

  describe("withRetry", () => {
    it("should return result on first successful call", async () => {
      const operation = vi.fn().mockResolvedValue("success");

      const result = await withRetry(operation, { maxRetries: 3 });

      expect(result).toBe("success");
      expect(operation).toHaveBeenCalledTimes(1);
    });

    it("should retry on retryable errors", async () => {
      const operation = vi
        .fn()
        .mockRejectedValueOnce(new GoveeApiError("Rate limited", 429))
        .mockResolvedValueOnce("success");

      const result = await withRetry(operation, { maxRetries: 3, baseDelayMs: 10, jitterMs: 0 });

      expect(result).toBe("success");
      expect(operation).toHaveBeenCalledTimes(2);
    });

    it("should retry multiple times", async () => {
      const operation = vi
        .fn()
        .mockRejectedValueOnce(new GoveeApiError("Error 1", 500))
        .mockRejectedValueOnce(new GoveeApiError("Error 2", 503))
        .mockResolvedValueOnce("success");

      const result = await withRetry(operation, { maxRetries: 3, baseDelayMs: 10, jitterMs: 0 });

      expect(result).toBe("success");
      expect(operation).toHaveBeenCalledTimes(3);
    });

    it("should throw after max retries", async () => {
      const operation = vi.fn().mockRejectedValue(new GoveeApiError("Always fails", 500));

      await expect(
        withRetry(operation, { maxRetries: 2, baseDelayMs: 10, jitterMs: 0 })
      ).rejects.toThrow("Always fails");

      expect(operation).toHaveBeenCalledTimes(3); // Initial + 2 retries
    });

    it("should not retry non-retryable errors", async () => {
      const operation = vi.fn().mockRejectedValue(new GoveeApiError("Unauthorized", 401));

      await expect(
        withRetry(operation, { maxRetries: 3, baseDelayMs: 10, jitterMs: 0 })
      ).rejects.toThrow("Unauthorized");

      expect(operation).toHaveBeenCalledTimes(1);
    });

    it("should retry TypeError (network errors)", async () => {
      const operation = vi
        .fn()
        .mockRejectedValueOnce(new TypeError("fetch failed"))
        .mockResolvedValueOnce("success");

      const result = await withRetry(operation, { maxRetries: 3, baseDelayMs: 10, jitterMs: 0 });

      expect(result).toBe("success");
      expect(operation).toHaveBeenCalledTimes(2);
    });

    it("should not retry generic errors", async () => {
      const operation = vi.fn().mockRejectedValue(new Error("Generic error"));

      await expect(
        withRetry(operation, { maxRetries: 3, baseDelayMs: 10, jitterMs: 0 })
      ).rejects.toThrow("Generic error");

      expect(operation).toHaveBeenCalledTimes(1);
    });

    it("should use default config values", async () => {
      const operation = vi.fn().mockResolvedValue("success");

      await withRetry(operation);

      expect(operation).toHaveBeenCalledTimes(1);
    });
  });
});
