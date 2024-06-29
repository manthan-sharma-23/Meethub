import { WebSocket, WebSocketServer } from "ws";
import { Server as httpServer } from "http";
import { WebSocketEvent, WebSocketEventType } from "../config/types";
import { Room } from "./Room";
import { Worker } from "mediasoup/node/lib/Worker";
import { getMediasoupWorker } from "..";
import { Peer } from "./Peer";

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
    switch (event.type) {
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
        this.getRouterRtpCapabilities(event, socket);
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
      ?.addPeer(new Peer(event.socketId!, event.payload.name));
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

    socket.send(JSON.stringify(message));
  }

  private getRouterRtpCapabilities(event: WebSocketEvent, socket: WebSocket) {
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

    socket.send(JSON.stringify(message));
  }

  private broadcast(roomId: number, name: string, data: any) {}

  private send(event: WebSocketEvent, socket: WebSocket) {
    socket.send(JSON.stringify(event));
  }
}
