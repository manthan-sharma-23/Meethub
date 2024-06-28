import { WebSocketServer } from "ws";
import { Server as httpServer } from "http";

interface WebSocketEvent {
  type: string;
  payload: any;
}

export class WebSocketService {
  private _wss: WebSocketServer;
  private _roomList = [];

  constructor(server: httpServer) {
    this._wss = new WebSocketServer({ server, path: "/ws" });
    this.listenWebSocketEvents(this._wss);
  }

  private listenWebSocketEvents(wss: WebSocketServer) {
    wss.on("connection", (socket) => {
      socket.on("message", (message) => {
        const event = JSON.parse(message.toString()) as WebSocketEvent;
        this.routeWebSocketEvents(event);
      });
    });
  }

  private routeWebSocketEvents(event: WebSocketEvent) {
    switch (event.type) {
      case "a":
        break;

      default:
        break;
    }
  }
}
