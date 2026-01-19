import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { TokenBucketLimiter } from "../../src/util/limiter.js";

describe("TokenBucketLimiter", () => {
  describe("with default rate (5 RPS)", () => {
    let limiter: TokenBucketLimiter;

    beforeEach(() => {
      limiter = new TokenBucketLimiter(5);
    });

    it("should start with full bucket", async () => {
      const startTime = Date.now();
      await limiter.take();
      const endTime = Date.now();

      expect(endTime - startTime).toBeLessThan(100);
    });

    it("should allow 5 requests immediately", async () => {
      const startTime = Date.now();
      for (let i = 0; i < 5; i++) {
        await limiter.take();
      }
      const endTime = Date.now();

      expect(endTime - startTime).toBeLessThan(100);
    });

    it("should wait on 6th request", async () => {
      // Exhaust the bucket
      for (let i = 0; i < 5; i++) {
        await limiter.take();
      }

      const startTime = Date.now();
      await limiter.take();
      const endTime = Date.now();

      // Should wait at least 50ms (the setTimeout interval in the limiter)
      expect(endTime - startTime).toBeGreaterThanOrEqual(50);
    });

    it("should refill tokens over time", async () => {
      vi.useFakeTimers();

      for (let i = 0; i < 5; i++) {
        await limiter.take();
      }

      // Advance time by 250ms - should refill ~1.25 tokens
      vi.advanceTimersByTime(250);

      const startTime = Date.now();
      await limiter.take();
      const endTime = Date.now();

      expect(endTime - startTime).toBeLessThan(100);

      vi.useRealTimers();
    });

    it("should fully refill after 1 second", async () => {
      vi.useFakeTimers();

      for (let i = 0; i < 5; i++) {
        await limiter.take();
      }

      vi.advanceTimersByTime(1100);

      const startTime = Date.now();
      for (let i = 0; i < 5; i++) {
        await limiter.take();
      }
      const endTime = Date.now();

      expect(endTime - startTime).toBeLessThan(100);

      vi.useRealTimers();
    });
  });

  describe("with custom rate (2 RPS)", () => {
    let limiter: TokenBucketLimiter;

    beforeEach(() => {
      limiter = new TokenBucketLimiter(2);
    });

    it("should only allow 2 requests immediately", async () => {
      const startTime = Date.now();
      for (let i = 0; i < 2; i++) {
        await limiter.take();
      }
      const endTime = Date.now();

      expect(endTime - startTime).toBeLessThan(100);
    });

    it("should wait on 3rd request", async () => {
      for (let i = 0; i < 2; i++) {
        await limiter.take();
      }

      const startTime = Date.now();
      await limiter.take();
      const endTime = Date.now();

      expect(endTime - startTime).toBeGreaterThanOrEqual(50);
    });
  });

  describe("edge cases", () => {
    it("should handle rate of 1 RPS", async () => {
      const limiter = new TokenBucketLimiter(1);

      await limiter.take();

      const startTime = Date.now();
      await limiter.take();
      const endTime = Date.now();

      expect(endTime - startTime).toBeGreaterThanOrEqual(50);
    });

    it("should handle rate of 0 (clamped to 1)", async () => {
      const limiter = new TokenBucketLimiter(0);

      const startTime = Date.now();
      await limiter.take();
      const endTime = Date.now();

      expect(endTime - startTime).toBeLessThan(100);
    });

    it("should handle negative rate (clamped to 1)", async () => {
      const limiter = new TokenBucketLimiter(-5);

      const startTime = Date.now();
      await limiter.take();
      const endTime = Date.now();

      expect(endTime - startTime).toBeLessThan(100);
    });

    it("should handle large burst of requests", async () => {
      const limiter = new TokenBucketLimiter(10);

      for (let i = 0; i < 10; i++) {
        await limiter.take();
      }

      const startTime = Date.now();
      await limiter.take();
      const endTime = Date.now();

      expect(endTime - startTime).toBeGreaterThanOrEqual(50);
    });
  });
});
