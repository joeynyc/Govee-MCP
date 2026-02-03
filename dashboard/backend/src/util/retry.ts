import { GoveeApiError } from "./types.js";

export interface RetryConfig {
  /** Maximum number of retry attempts (default: 3) */
  maxRetries: number;
  /** Base delay in milliseconds (default: 1000) */
  baseDelayMs: number;
  /** Maximum delay in milliseconds (default: 30000) */
  maxDelayMs: number;
  /** Maximum random jitter in milliseconds (default: 500) */
  jitterMs: number;
}

const defaultConfig: RetryConfig = {
  maxRetries: Number(process.env.GOVEE_MAX_RETRIES) || 3,
  baseDelayMs: 1000,
  maxDelayMs: 30000,
  jitterMs: 500,
};

function isRetryableError(error: unknown): boolean {
  // GoveeApiError with retryable status codes
  if (error instanceof GoveeApiError) {
    return error.isRetryable;
  }

  // Network errors (fetch failures)
  if (error instanceof TypeError) {
    return true;
  }

  return false;
}

function calculateDelay(attempt: number, config: RetryConfig): number {
  // Exponential backoff: baseDelay * 2^attempt
  const exponentialDelay = config.baseDelayMs * Math.pow(2, attempt);
  // Cap at max delay
  const cappedDelay = Math.min(exponentialDelay, config.maxDelayMs);
  // Add random jitter
  const jitter = Math.random() * config.jitterMs;
  return cappedDelay + jitter;
}

export async function withRetry<T>(
  operation: () => Promise<T>,
  config: Partial<RetryConfig> = {}
): Promise<T> {
  const finalConfig = { ...defaultConfig, ...config };
  let lastError: unknown;

  for (let attempt = 0; attempt <= finalConfig.maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;

      if (attempt >= finalConfig.maxRetries) {
        console.error(`Max retries exceeded after ${attempt + 1} attempts`);
        throw error;
      }

      if (!isRetryableError(error)) {
        console.debug(`Non-retryable error, not retrying`);
        throw error;
      }

      const delay = calculateDelay(attempt, finalConfig);
      console.warn(`Retry attempt ${attempt + 1}/${finalConfig.maxRetries} after ${Math.round(delay)}ms`);

      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  throw lastError;
}

export { isRetryableError, calculateDelay };
