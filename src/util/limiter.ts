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