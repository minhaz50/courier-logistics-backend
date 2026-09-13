import Redis from "ioredis";
import { config } from "../config";

class CacheService {
  private client: Redis | null = null;
  private connected = false;

  constructor() {
    if (!config.redisUrl) {
      console.warn(
        "[redis] REDIS_URL not set — caching, rate limiting, and assignment locks are disabled.",
      );
      return;
    }

    this.client = new Redis(config.redisUrl, {
      maxRetriesPerRequest: 2,
      lazyConnect: true,

      retryStrategy: (attempts) =>
        attempts > 3 ? null : Math.min(attempts * 200, 1000),
    });

    let hasLoggedError = false;
    this.client.on("error", (err) => {
      this.connected = false;
      if (!hasLoggedError) {
        console.error(
          `[redis] could not connect (${err.message}). Caching/locks will no-op until it's reachable.`,
        );
        hasLoggedError = true;
      }
    });

    this.client.on("connect", () => {
      this.connected = true;
      hasLoggedError = false;
    });

    this.client.connect().catch(() => {
      console.warn("[redis] failed to connect — falling back to no-op cache.");
    });
  }

  private get ready() {
    return this.client !== null && this.connected;
  }

  async get<T = string>(key: string): Promise<T | null> {
    if (!this.ready) return null;
    const value = await this.client!.get(key);
    if (value === null) return null;
    try {
      return JSON.parse(value) as T;
    } catch {
      return value as unknown as T;
    }
  }

  async set(key: string, value: unknown, ttlSeconds?: number): Promise<void> {
    if (!this.ready) return;
    const payload = typeof value === "string" ? value : JSON.stringify(value);
    if (ttlSeconds) {
      await this.client!.set(key, payload, "EX", ttlSeconds);
    } else {
      await this.client!.set(key, payload);
    }
  }

  async del(key: string): Promise<void> {
    if (!this.ready) return;
    await this.client!.del(key);
  }

  async acquireLock(
    key: string,
    ttlMs = 5000,
  ): Promise<(() => Promise<void>) | null> {
    if (!this.ready) return null;
    const token = `${Date.now()}-${Math.random()}`;
    const result = await this.client!.set(key, token, "PX", ttlMs, "NX");
    if (result !== "OK") return null;

    return async () => {
      const current = await this.client!.get(key);
      if (current === token) {
        await this.client!.del(key);
      }
    };
  }

  async incr(key: string, ttlSeconds?: number): Promise<number> {
    if (!this.ready) return 0;
    const value = await this.client!.incr(key);
    if (value === 1 && ttlSeconds) {
      await this.client!.expire(key, ttlSeconds);
    }
    return value;
  }
}

export const cache = new CacheService();
