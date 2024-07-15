import * as io from "socket.io";
import * as http from "http";
import { config } from "../config/config";
import { WebSocketEventType } from "../config/types";
import Room from "./Room";
import Peer from "./Peer";
import { getMediasoupWorker } from "..";
import { logger } from "../helpers/logger";
import { Redis } from "ioredis";
import { createAdapter } from "@socket.io/redis-adapter";
import { RedisService } from "./RedisService";

interface SocketCallback {
  (response: any): void;
}

export interface ChatMessage {
  user: Peer;
  data: string;
  createdAt: Date;
}

const pubClient = new RedisService().getInstance();

const subClient = pubClient.duplicate();

export class SocketService {
  private _io: io.Server;
  private _roomList: Map<string, Room>;

  constructor(server: http.Server) {
    console.log("Initializing socket server");

    this._io = new io.Server(server, {
      cors: {
        origin: "*",
      },
      adapter: createAdapter(pubClient, subClient),
    });
    this._roomList = new Map();
    try {
      this.listenToWebSockets(this._io);
    } catch (error) {
      console.log("ERROR in socket", error);
    }
  }

  private listenToWebSockets(io: io.Server) {
    io.on("connection", (socket) => {
      socket.on(
        WebSocketEventType.CREATE_ROOM,
        ({ roomId }, cb: SocketCallback) => {
          if (!roomId) {
            console.error("No room id provided to create room ", socket.id);
            cb({ error: "No room id provided to create room " });
            return;
          }

          const room = this._roomList.get(roomId);

          if (room) {
            console.log("Room already present");
            cb({ error: "Room already present" });
            return;
          } else {
            const worker = getMediasoupWorker();
            this._roomList.set(roomId, new Room(roomId, io, worker));
            console.log("Room created successfully ", { roomId });
            cb({ message: "Room created successfully" });
          }
        }
      );

      socket.on(WebSocketEventType.DISCONNECT, () => {
        console.log(`User disconnected`);
      });

      socket.on(
        WebSocketEventType.JOIN_ROOM,
        ({ roomId, name }, cb: SocketCallback) => {
          const room = this._roomList.get(roomId);

          if (!room) {
            cb({ error: "Room Doesn't exists" });
            return;
          }

          const peer = room.createPeer(name, socket.id);
          socket.roomId = roomId;
          socket.to(roomId).emit(WebSocketEventType.USER_JOINED, {
            message: `${name} joined the room`,
            user: peer,
          });

          socket.join(roomId);

          console.log("Room Joined Succesfully", { name, roomId });

          cb({ message: "Room Joined successfully" });
        }
      );

      socket.on(WebSocketEventType.EXIT_ROOM, (_, cb: SocketCallback) => {
        if (!socket.roomId) {
          cb({ error: "Not already in any room" });
          return;
        }

        const room = this._roomList.get(socket.roomId);
        if (!room) {
          cb({ error: "Exiting room doesn't exists" });
          return;
        }

        const peer = room.removePeer(socket.id);
        if (room._peers.size <= 0) {
          this._roomList.delete(room.id);
        }

        socket.to(room.id).emit(WebSocketEventType.USER_LEFT, {
          message: `${peer?.name} left the room.`,
          user: peer,
        });
      });

      socket.on(
        WebSocketEventType.GET_IN_ROOM_USERS,
        (_, cb: SocketCallback) => {
          const roomId = socket.roomId as string;
          const room = this._roomList.get(roomId);

          if (!room) {
            console.log("No room present with the id");
            return;
          }
          cb({ users: room.getCurrentPeers(socket.id) });
        }
      );

      socket.on(WebSocketEventType.USER_CHAT, (msg) => {
        socket.to(socket.roomId!).emit(WebSocketEventType.USER_CHAT, msg);
        return;
      });

      socket.on(WebSocketEventType.GET_PRODUCERS, (_, cb: SocketCallback) => {
        const room = this._roomList.get(socket.roomId!);

        if (!room) {
          logger("ERROR", "Couldn't find room");
          cb({ error: "No Room Found" });
          return;
        }

        logger(WebSocketEventType.GET_PRODUCERS, room._peers.get(socket.id));

        let producerList = room.getProducerListForPeer();

        cb(producerList);
        return;
      });

      socket.on(
        WebSocketEventType.GET_ROUTER_RTP_CAPABILITIES,
        (_, cb: SocketCallback) => {
          const room = this._roomList.get(socket.roomId!);
          logger(
            WebSocketEventType.GET_ROUTER_RTP_CAPABILITIES,
            room?._peers.get(socket.id)
          );
          if (!room) {
            logger("ERROR", "Couldn't find room");
            cb({ error: "No Room Found" });
            return;
          }

          const rtp = room?.getRouterRtpCapabilties();
          cb(rtp);
          return;
        }
      );

      socket.on(
        WebSocketEventType.CREATE_WEBRTC_TRANSPORT,
        async (_, cb: SocketCallback) => {
          const room = this._roomList.get(socket.roomId!);
          if (!room) {
            logger(WebSocketEventType.ERROR, "Couldn't find room");
            cb({ error: "Couldn't find room" });
            return;
          }
          logger(WebSocketEventType.CREATED_WEBRTC_TRANSPORT, {
            name: room._peers.get(socket.id)?.name,
          });

          const params = await room.createWebRtcTransport(socket.id);
          cb(params);
          return;
        }
      );

      socket.on(
        WebSocketEventType.CONNECT_TRANSPORT,
        async ({ transport_id, dtlsParameters }, cb: SocketCallback) => {
          const room = this._roomList.get(socket.roomId!);

          if (!room) {
            logger(WebSocketEventType.ERROR, "Couldn't find room");
            return;
          }
          logger(WebSocketEventType.CONNECT_TRANSPORT, {
            name: room._peers.get(socket.id),
          });
          await room.connectPeerTransport(
            socket.id,
            transport_id,
            dtlsParameters
          );

          cb("SUCCESS");
        }
      );

      socket.on(
        WebSocketEventType.PRODUCE,
        async (
          { kind, rtpParameters, producerTransportId },
          cb: SocketCallback
        ) => {
          console.log("IN PRODUCE EVENT");

          const room = this._roomList.get(socket.roomId!);

          if (!room) {
            return cb({ ERROR: "error couldn't find the room" });
          }

          let producer_id = (await room.produce(
            socket.id,
            producerTransportId,
            rtpParameters,
            kind
          )) as string;

          logger(WebSocketEventType.PRODUCE, {
            type: `${kind}`,
            name: `${room._peers.get(socket.id)!.name}`,
            id: `${producer_id}`,
          });

          cb({
            producer_id,
          });
        }
      );

      socket.on(
        WebSocketEventType.CLOSE_PRODUCER,
        ({ producer_id }, cb: SocketCallback) => {
          const room = this._roomList.get(socket.roomId!)!;
          console.log(WebSocketEventType.CLOSE_PRODUCER, producer_id);

          if (room) {
            room.closeProducer(producer_id, socket.id);
          }
        }
      );

      socket.on(
        WebSocketEventType.CONSUME,
        async (
          { consumerTransportId, producerId, rtpCapabilities },
          cb: SocketCallback
        ) => {
          const room = this._roomList.get(socket.roomId!);

          if (!room) {
            console.warn("No room associated with the id ");
            return;
          }

          const params = await room.consume(
            socket.id,
            consumerTransportId,
            producerId,
            rtpCapabilities
          );

          if (!params) {
            console.log("Consumer params couldn't be passed");

            return;
          }

          cb(params);
        }
      );
    });
  }
}
