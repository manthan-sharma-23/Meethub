import { WebSocket, WebSocketServer } from "ws";
import { Server as httpServer } from "http";
import { WebSocketEvent, WebSocketEventType } from "../config/types";
import { Room } from "./Room";
import { Worker } from "mediasoup/node/lib/Worker";
import { getMediasoupWorker } from "..";
import { Peer } from "./Peer";
import { DtlsParameters } from "mediasoup/node/lib/fbs/web-rtc-transport";
import {
  MediaKind,
  RtpCapabilities,
  RtpParameters,
} from "mediasoup/node/lib/RtpParameters";
export class WebSocketService {
  private _wss: WebSocketServer;
  private _roomList = new Map<string, Room>();
  private count = 0;

  constructor(server: httpServer) {
    this._wss = new WebSocketServer({ server, path: "/ws" });
    this.listenWebSocketEvents(this._wss);
  }

  private listenWebSocketEvents(wss: WebSocketServer) {
    wss.on("connection", (socket) => {
      const socketId = this.count++;
      socket.on("message", (message) => {
        const event = JSON.parse(message.toString()) as WebSocketEvent;
        this.routeWebSocketEvents(event, socket, socketId);
      });
    });
  }

  private routeWebSocketEvents(
    message: WebSocketEvent,
    socket: WebSocket,
    socketId: number
  ) {
    const event = { ...message, socketId };
    console.log(event);

    switch (event.type) {
      case WebSocketEventType.DISCONNECT:
        this.onDisconnect(event, socket);
        break;

      case WebSocketEventType.CREATE_ROOM:
        this.onCreateRoom(event, socket);
        break;

      case WebSocketEventType.JOIN_ROOM:
        this.onJoinRoom(event, socket);
        break;

      case WebSocketEventType.GET_PRODUCERS:
        this.onGetProducers(event, socket);
        break;

      case WebSocketEventType.GET_ROUTER_RTP_CAPABILITIES:
        this.onGetRouterRtpCapabilities(event, socket);
        break;

      case WebSocketEventType.CREATE_WEBRTC_TRANSPORT:
        this.onCreateWebRtcTransport(event, socket);
        break;

      case WebSocketEventType.CONNECT_TRANSPORT:
        this.onConnectTransport(event, socket);
        break;

      case WebSocketEventType.PRODUCE:
        this.onProduce(event, socket);
        break;

      case WebSocketEventType.CONSUME:
        this.onConsume(event, socket);
        break;

      case WebSocketEventType.GET_MY_ROOM_INFO:
        this.onGetMyRoomInfo(event, socket);
        break;

      case WebSocketEventType.PRODUCER_CLOSED:
        this.onProducerClosed(event, socket);
        break;

      case WebSocketEventType.EXIT_ROOM:
        this.onExitRoom(event, socket);
        break;

      default:
        break;
    }
  }

  private onCreateRoom(event: WebSocketEvent, socket: WebSocket) {
    const { roomId } = event.payload as { roomId: string };

    if (this._roomList.has(roomId)) {
      this.send(
        {
          type: WebSocketEventType.ERROR,
          payload: {
            data: "Room Already Created",
          },
        },
        socket
      );
    } else {
      console.log("Created room ", { roomId });
      let worker = getMediasoupWorker();
      this._roomList.set(roomId, new Room(roomId, worker, this._wss));
      this.send(
        {
          type: WebSocketEventType.ROOM_CREATED_MESSAGE,
          payload: {
            message: `Created Room ${roomId}`,
          },
        },
        socket
      );
    }
  }

  private onJoinRoom(event: WebSocketEvent, socket: WebSocket) {
    const roomId = event.payload.roomId as string;

    console.log("Joined room", roomId, event.socketId);
    if (!this._roomList.has(roomId)) {
      this.send(
        {
          type: WebSocketEventType.ERROR,
          payload: {
            message: "Room Doesn't Exists",
          },
        },
        socket
      );
    }
    this._roomList
      .get(roomId)
      ?.addPeer(new Peer(event.socketId!, event.payload.name, socket));

    const message: WebSocketEvent = {
      type: WebSocketEventType.JOINED_ROOM_MESSAGE,
      payload: {
        message: `Joined room ${roomId}`,
      },
    };

    this.send(message, socket);
  }

  private onGetProducers(event: WebSocketEvent, socket: WebSocket) {
    const roomId = event.payload.roomId as string;
    if (!this._roomList.has(roomId)) return;

    console.log("Get producers", {
      name: `${
        this._roomList.get(roomId)?.getPeers.get(event.socketId!)?.name
      }`,
    });

    let producerList = this._roomList.get(roomId)?.getProducersListForPeer();

    const message: WebSocketEvent = {
      type: WebSocketEventType.NEW_PRODUCERS,
      payload: {
        producerList,
      },
    };

    this.send(message, socket);
  }

  private onGetRouterRtpCapabilities(event: WebSocketEvent, socket: WebSocket) {
    console.log(`Get Router RTP Capabilties `, {
      name: `${
        this._roomList.get(event.payload.roomId)?.getPeers.get(event.socketId!)
          ?.name
      }`,
    });

    let message: WebSocketEvent;
    try {
      const rtpCapabilities = this._roomList.get(
        event.payload.roomId
      )?.getRtpCapabilties;

      message = {
        type: WebSocketEventType.ROUTER_RTP_CAPABILITIES,
        payload: {
          rtpCapabilities,
        },
      };
    } catch (error) {
      message = {
        type: WebSocketEventType.ERROR,
        payload: {
          error,
        },
      };
    }

    this.send(message, socket);
  }

  private async onCreateWebRtcTransport(
    event: WebSocketEvent,
    socket: WebSocket
  ) {
    console.log("Creating");

    console.log("Create Web Rtc Transport ", {
      name: `${
        this._roomList.get(event.payload.roomId)?.getPeers.get(event.socketId!)
          ?.name
      }`,
      type: event.payload.type_of_transport,
    });

    let message: WebSocketEvent;
    try {
      const webRtcTransport = await this._roomList
        .get(event.payload.roomId)
        ?.createWebRtcTransport(event.socketId!);

      message = {
        type: WebSocketEventType.CREATED_WEBRTC_TRANSPORT,
        payload: {
          params: webRtcTransport?.params!,
          type_of_transport: event.payload.type_of_transport,
        },
      };
    } catch (error) {
      message = {
        type: WebSocketEventType.ERROR,
        payload: {
          error,
          type_of_transport: event.payload.type_of_transport,
        },
      };
    }

    this.send(message, socket);
  }

  private async onConnectTransport(event: WebSocketEvent, socket: WebSocket) {
    const dtlsParameters = event.payload.dtlsParameters as DtlsParameters;
    const transport_id = event.payload.transport_id as string;
    console.log("Connect Transport ", {
      name: `${
        this._roomList.get(event.payload.roomId)?.getPeers.get(event.socketId!)
          ?.name
      }`,
    });

    if (!this._roomList.has(event.payload.roomId)) return;

    await this._roomList
      .get(event.payload.roomId)
      ?.connectPeerTransport(event.socketId!, transport_id, dtlsParameters);
  }

  private async onProduce(event: WebSocketEvent, socket: WebSocket) {
    const kind = event.payload.kind as MediaKind;
    const rtpParameters = event.payload.rtpParameters as RtpParameters;
    const producerTransportId = event.payload.producerTransportId as string;
    console.log("produce");

    if (!this._roomList.has(event.payload.roomId)) return;

    let producerInfo = await this._roomList
      .get(event.payload.roomId)
      ?.produce(event.socketId!, producerTransportId, rtpParameters, kind);

    let message: WebSocketEvent = {
      type: WebSocketEventType.NEW_PRODUCERS,
      payload: {
        ...producerInfo,
      },
    };

    this.broadcast(event.payload.roomId, event.socketId!, message);

    console.log(`Produce`, {
      type: `${kind}`,
      name: `${
        this._roomList.get(event.payload.roomId)?.getPeers.get(event.socketId!)
          ?.name
      }`,
    });

    message = {
      type: WebSocketEventType.PRODUCED,
      payload: {
        producer_id: producerInfo?.producer_id,
      },
    };

    this.send(message, socket);
  }

  private async onConsume(event: WebSocketEvent, socket: WebSocket) {
    const consumerTransportId = event.payload.consumerTransportId as string;
    const producerId = event.payload.producerId as string;
    const rtpCapabilities = event.payload.rtpCapabilities as RtpCapabilities;

    let params = await this._roomList
      .get(event.payload.roomId)
      ?.consume(
        event.socketId!,
        consumerTransportId,
        producerId,
        rtpCapabilities
      );

    console.log("Consuming", {
      name: `${
        this._roomList.get(event.payload.roomId) &&
        this._roomList.get(event.payload.roomId)?.getPeers.get(event.socketId!)
          ?.name
      }`,
      producer_id: `${producerId}`,
      consumer_id: `${params!.id}`,
    });

    const message: WebSocketEvent = {
      type: WebSocketEventType.CONSUMED,
      payload: {
        params,
      },
    };

    this.send(message, socket);
  }

  private async onResume(_event: WebSocketEvent, socket: WebSocket) {}

  private onGetMyRoomInfo(event: WebSocketEvent, socket: WebSocket) {
    const room = this._roomList.get(event.payload.roomId)?.toJson;

    const message: WebSocketEvent = {
      type: WebSocketEventType.ROOM_INFO,
      payload: {
        room,
      },
    };

    this.send(message, socket);
  }

  private async onDisconnect(event: WebSocketEvent, socket: WebSocket) {
    const room = this._roomList.get(event.payload.roomId);
    console.log("Disconnecting ", {
      name: room?.getPeers.get(event.socketId!)?.name,
    });

    if (!room) return;

    room.removePeer(event.socketId!);
  }

  private async onProducerClosed(event: WebSocketEvent, socket: WebSocket) {
    const room = this._roomList.get(event.payload.roomId);
    console.log(event.type);
    const producerId = event.payload.producer_id as string;
    if (!room) return;

    room.closeProducer(event.socketId!, producerId);
  }

  private async onExitRoom(event: WebSocketEvent, socket: WebSocket) {
    console.log(event.type);

    const room = this._roomList.get(event.payload.roomId);

    if (!room) {
      console.log("NO ROOM FOUND");
      return;
    }

    await room.removePeer(event.socketId!);
    if (room.getPeers.size === 0) {
      this._roomList.delete(room.id);
    }

    console.log("Exited room successfully");
  }

  private broadcast(roomId: string, socketId: number, message: WebSocketEvent) {
    const room = this._roomList.get(roomId)!;
    Array.from(room.peers.keys())
      .filter((id) => id !== socketId)
      .forEach((peer) => {
        this.send(message, room.peers.get(peer)!.socket);
      });
  }

  private send(event: WebSocketEvent, socket: WebSocket) {
    socket.send(JSON.stringify(event));
  }
}
