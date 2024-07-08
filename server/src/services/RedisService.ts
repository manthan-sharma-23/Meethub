import * as redis from "ioredis";
import { config } from "../config/config";

export default class RedisService {
  private _redis: redis.Redis;
  constructor() {
    this._redis = new redis.Redis({ port: config.app.redis.port });
  }

  publish(msg: any) {
    this._redis.publish(config.app.redis.channel, JSON.stringify(msg));
  }

  get redis() {
    return this._redis;
  }
}
