import { Redis } from "ioredis";
import { config } from "../config/config";

export class RedisService {
  private redis: Redis;

  constructor() {
    const url = config.app.redis.url;

    if (url) {
      console.log({ url });

      this.redis = new Redis(url);
    } else {
      console.log({
        url: "No url " + url,
        port: config.app.redis.port,
        host: config.app.redis.host,
        password: config.app.redis.password,
        username: config.app.redis.username,
      });

      this.redis = new Redis({
        port: config.app.redis.port,
        host: config.app.redis.host,
        password: config.app.redis.password,
        username: config.app.redis.username,
      });
    }
  }

  getInstance() {
    return this.redis;
  }
}
