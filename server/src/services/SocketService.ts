import * as io from "socket.io";
import * as http from "http";
import { config } from "../config/config";
import { WebSocketEventType } from "../config/types";
import Room from "./Room";
import Peer from "./Peer";

interface SocketCallback {
  (response: any): void;
}

interface ChatMessage {
  user: Peer;
  data: string;
  createdAt: Date;
}

export class SocketService {
  private _io: io.Server;
  private _roomList: Map<string, Room>;

  constructor(server: http.Server) {
    this._io = new io.Server(server, {
      cors: {
        origin: "*",
      },
    });
    this._roomList = new Map();
    try {
      this.listenToWebSockets(this._io);
    } catch (error) {
      console.log(error);
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
            this._roomList.set(roomId, new Room(roomId, io));
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
          cb({ users: room.getCurrentPeers() });
        }
      );

      socket.on(WebSocketEventType.USER_CHAT, (msg) => {
        socket.to(socket.roomId!).emit(WebSocketEventType.USER_CHAT, msg);
      });
    });
  }
}
