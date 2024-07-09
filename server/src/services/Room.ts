import * as io from "socket.io";
import Peer from "./Peer";

export default class Room {
  id: string;
  io: io.Server;
  _peers: Map<string, Peer>;

  constructor(id: string, io: io.Server) {
    this.id = id;
    this.io = io;
    this._peers = new Map();
  }

  public createPeer(name: string, socketId: string) {
    if (this._peers.has(socketId)) {
      return;
    }
    this._peers.set(socketId, new Peer(socketId, name));
    return this._peers.get(socketId)!;
  }

  public removePeer(socketId: string) {
    const peer = this._peers.get(socketId);
    if (!peer) {
      return;
    }
    this._peers.delete(socketId);
    return peer;
  }

  public getCurrentPeers() {
    const peers: Peer[] = [];
    Array.from(this._peers.keys()).forEach((peerId) => {
      if (this._peers.has(peerId)) {
        peers.push(this._peers.get(peerId)!);
      }
    });

    return peers;
  }
}
