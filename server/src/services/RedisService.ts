import { Redis } from "ioredis";
import { config } from "../config/config";

export class RedisService {
  private redis: Redis;

  constructor() {
    console.log(config.app.redis.url);

    this.redis = new Redis({
      port: config.app.redis.port,
      host: config.app.redis.host,
      password: config.app.redis.password,
      username: config.app.redis.username,
    });
  }

  getInstance() {
    return this.redis;
  }
}
