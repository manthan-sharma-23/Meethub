import { Redis } from "ioredis";
import { config } from "../config/config";

export class RedisService {
  private redis: Redis;

  constructor() {
    this.redis = new Redis({ port: config.app.redis.port });
  }

  getInstance() {
    return this.redis;
  }
}
