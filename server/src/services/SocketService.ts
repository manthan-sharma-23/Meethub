import * as io from "socket.io";
import * as http from "http";
import { Room } from "./Room";
import { WebSocketEventType } from "../config/types";
import { getMediasoupWorker } from "..";
import { Peer } from "./Peer";

export class SocketService {
  io: io.Server;
  _roomList: Map<string, Room>;

  constructor(server: http.Server) {
    this.io = new io.Server(server);
    this._roomList = new Map();

    this.listenWebSocketEvents(this.io);
  }

  private listenWebSocketEvents(io: io.Server) {
    io.on("connection", (socket) => {
      // Create a room
      socket.on(WebSocketEventType.CREATE_ROOM, ({ _roomId }, cb) => {
        if (this._roomList.has(_roomId)) {
          cb("Room Already Exists");
        } else {
          console.log("Create room ", { roomId: _roomId });
          const worker = getMediasoupWorker();
          this._roomList.set(_roomId, new Room(_roomId, worker, io));
          cb(_roomId);
        }
      });

      // Join a room
      socket.on(WebSocketEventType.JOIN_ROOM, ({ _roomId, name }, cb) => {
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
      });

      socket.on(WebSocketEventType.GET_PRODUCERS, () => {
        if (!this._roomList.has(socket.roomId!)) return;

        const room = this._roomList.get(socket.roomId!)!;

        this.name_logger(WebSocketEventType.GET_PRODUCERS, socket);

        let producerList = this._roomList
          .get(socket.roomId!)!
          .getProducerListForPeer();

        socket.emit(WebSocketEventType.NEW_PRODUCERS, producerList);
      });

      socket.on(WebSocketEventType.GET_ROUTER_RTP_CAPABILITIES, (_, cb) => {
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
      });

      socket.on(WebSocketEventType.CREATE_WEBRTC_TRANSPORT, async (_, cb) => {
        this.name_logger(WebSocketEventType.CREATE_WEBRTC_TRANSPORT, socket);

        try {
          const createdTransport = await this._roomList
            .get(socket.roomId!)
            ?.createWebRtcTransport(socket.id);

          cb(createdTransport!.params);
        } catch (error) {
          cb({ error });
        }
      });

      socket.on(
        WebSocketEventType.CONNECT_TRANSPORT,
        async ({ transport_id, dtlsParameters }, cb) => {
          this.name_logger(WebSocketEventType.CONNECT_TRANSPORT, socket);

          if (!this._roomList.has(socket.id)) return;
          await this._roomList
            .get(socket.id)
            ?.connectPeerTransport(socket.id, transport_id, dtlsParameters);

          cb(true);
        }
      );

      socket.on(
        WebSocketEventType.PRODUCE,
        async ({ kind, rtpParameters, producerTransportId }, cb) => {
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
    });
  }

  private name_logger(event: string, socket: io.Socket) {
    console.log(event, {
      name: this._roomList.get(socket.roomId!)!.getPeers().get(socket.id)?.name,
    });
  }
}
