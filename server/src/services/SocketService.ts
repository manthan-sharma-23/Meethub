import * as io from "socket.io";
import * as http from "http";
import { Room } from "./Room";
import { WebSocketEventType } from "../config/types";
import { getMediasoupWorker } from "..";
import { Peer } from "./Peer";

export interface CreateSocketCallback {
  (response: any): void;
}
export class SocketService {
  io: io.Server;
  _roomList: Map<string, Room>;

  constructor(server: http.Server) {
    this.io = new io.Server(server, {
      cors: {
        origin: "*",
      },
    });
    this._roomList = new Map();

    try {
      this.listenWebSocketEvents(this.io);
    } catch (error) {
      console.log(error);
    }
  }

  private listenWebSocketEvents(io: io.Server) {
    io.on("connection", (socket) => {
      console.log("user connected");

      // Create a room
      socket.on(
        WebSocketEventType.CREATE_ROOM,
        ({ _roomId }, cb: CreateSocketCallback) => {
          if (this._roomList.has(_roomId)) {
            cb("Room Already Exists");
          } else {
            console.log("Create room ", { roomId: _roomId });
            const worker = getMediasoupWorker();
            this._roomList.set(_roomId, new Room(_roomId, worker, io));
            cb(_roomId);
          }
        }
      );

      // Join a room
      socket.on(
        WebSocketEventType.JOIN_ROOM,
        (
          { _roomId, name }: { _roomId: string; name: string },
          cb: CreateSocketCallback
        ) => {
          console.log("User joined", {
            name,
            _roomId,
          });

          if (!this._roomList.has(_roomId)) {
            return cb({
              error: "Room Doesn't Exists",
            });
          }
          this._roomList.get(_roomId)!.addPeer(new Peer(name, socket.id));
          socket.roomId = _roomId;
        }
      );

      socket.on(WebSocketEventType.GET_PRODUCERS, () => {
        if (!this._roomList.has(socket.roomId!)) return;

        const room = this._roomList.get(socket.roomId!)!;

        this.name_logger(WebSocketEventType.GET_PRODUCERS, socket);

        let producerList = this._roomList
          .get(socket.roomId!)!
          .getProducerListForPeer();

        socket.emit(WebSocketEventType.NEW_PRODUCERS, producerList);
      });

      socket.on(
        WebSocketEventType.GET_ROUTER_RTP_CAPABILITIES,
        (_, cb: CreateSocketCallback) => {
          this.name_logger(
            WebSocketEventType.GET_ROUTER_RTP_CAPABILITIES,
            socket
          );

          try {
            const rtpCaps = this._roomList
              .get(socket.roomId!)
              ?.getRouterRtpCapabilities();
            cb(rtpCaps);
          } catch (error) {
            cb({
              error,
            });
          }
        }
      );

      socket.on(
        WebSocketEventType.CREATE_WEBRTC_TRANSPORT,
        async (_, cb: CreateSocketCallback) => {
          this.name_logger(WebSocketEventType.CREATE_WEBRTC_TRANSPORT, socket);

          try {
            const createdTransport = await this._roomList
              .get(socket.roomId!)
              ?.createWebRtcTransport(socket.id);
            console.log("Created transport");

            cb(createdTransport!.params);
          } catch (error) {
            cb({ error });
          }
        }
      );

      socket.on(
        WebSocketEventType.CONNECT_TRANSPORT,
        async ({ transport_id, dtlsParameters }, cb: CreateSocketCallback) => {
          this.name_logger(WebSocketEventType.CONNECT_TRANSPORT, socket);

          const room = this._roomList.get(socket.roomId!);
          if (!room) {
            console.warn("No room room found");
            return;
          }

          await room.connectPeerTransport(
            socket.id,
            transport_id,
            dtlsParameters
          );
          console.log("Connected transport : ", transport_id);

          cb({});
        }
      );

      socket.on(
        WebSocketEventType.PRODUCE,
        async (
          { kind, rtpParameters, producerTransportId },
          cb: CreateSocketCallback
        ) => {
          console.log("Producer Server");

          if (!this._roomList.has(socket.roomId!))
            return cb({ error: "Room doesn't exists " });

          let producer_id = await this._roomList
            .get(socket.roomId!)
            ?.produce(socket.id, producerTransportId, rtpParameters, kind);

          console.log("Produce", {
            type: `${kind}`,
            name: `${
              this._roomList.get(socket.roomId!)?.getPeers().get(socket.id)
                ?.name
            }`,
            id: `${producer_id}`,
          });

          cb({ producer_id });
        }
      );

      socket.on(WebSocketEventType.CONSUME, () => {
        const room = this._roomList.get(socket.roomId!);

        if (!room) {
          console.warn("No room associated with the id ");
          return;
        }


      });
    });
  }

  private name_logger(event: string, socket: io.Socket) {
    console.log(event, {
      name: this._roomList.get(socket.roomId!)!.getPeers().get(socket.id)?.name,
    });
  }
}
