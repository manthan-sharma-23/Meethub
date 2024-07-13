import { Redis } from "ioredis";
import { config } from "../config/config";

export class RedisService {
  private redis: Redis;

  constructor() {
    this.redis = new Redis(config.app.redis.url);
  }

  getInstance() {
    return this.redis;
  }
}
