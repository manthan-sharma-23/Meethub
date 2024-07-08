import * as io from "socket.io";
import * as http from "http";
import RedisService from "./RedisService";
import { config } from "../config/config";

const publisher = new RedisService().redis;
const subscriber = new RedisService().redis;

subscriber.subscribe(config.app.redis.channel);

export class SocketService {
  private _io: io.Server;

  constructor(server: http.Server) {
    this._io = new io.Server(server, {
      cors: {
        origin: "*",
      },
    });
    this.listenToWebSockets(this._io);
  }

  private listenToWebSockets(io: io.Server) {
    io.on("connection", (socket) => {
      socket.onAny((event, args) => {
        publisher.publish(
          config.app.redis.channel,
          JSON.stringify({ event, args })
        );
      });
      subscriber.on("message", (_, msgs) => {
        socket.emit("message", JSON.parse(msgs));
      });
    });
  }
}
