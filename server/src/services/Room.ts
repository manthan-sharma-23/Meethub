import * as io from "socket.io";
import Peer from "./Peer";
import {
  MediaKind,
  Router,
  RtpCapabilities,
  RtpParameters,
  Worker,
} from "mediasoup/node/lib/types";
import { config } from "../config/config";
import { DtlsParameters } from "mediasoup/node/lib/fbs/web-rtc-transport";
import { logger } from "../helpers/logger";
import { WebSocketEventType } from "../config/types";

export default class Room {
  id: string;
  io: io.Server;
  _peers: Map<string, Peer>;
  private _router: Router | null = null;

  constructor(id: string, io: io.Server, worker: Worker) {
    this.id = id;
    this.io = io;
    this._peers = new Map();
    const mediaCodecs = config.mediasoup.router.mediaCodecs;
    worker.createRouter({ mediaCodecs }).then((router) => {
      this._router = router;
    });
  }

  public createPeer(name: string, socketId: string) {
    if (this._peers.has(socketId)) {
      return;
    }
    this._peers.set(socketId, new Peer(socketId, name, this.io));
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

  public async createWebRtcTransport(socketId: string) {
    const { maxIncomingBitrate, initialAvailableOutgoingBitrate } =
      config.mediasoup.webRtcTransport;

    const transport = await this._router?.createWebRtcTransport({
      listenIps: config.mediasoup.webRtcTransport.listenIps,
      enableUdp: true,
      enableTcp: true,
      preferUdp: true,
      initialAvailableOutgoingBitrate,
    })!;

    if (maxIncomingBitrate) {
      try {
        await transport.setMaxIncomingBitrate(maxIncomingBitrate);
      } catch (error) {}
    }

    transport.on("dtlsstatechange", (dtlsState) => {
      if (dtlsState === "closed") {
        console.log("Transport close", {
          name: this._peers.get(socketId)?.name,
        });
        transport.close();
      }
    });

    transport.on("@close", () => {
      console.log("Transport close", { name: this._peers.get(socketId)?.name });
    });

    console.log("Adding transport", { transportId: transport.id });
    this._peers.get(socketId)?.addTransport(transport);

    return {
      params: {
        id: transport.id,
        iceParameters: transport.iceParameters,
        iceCandidates: transport.iceCandidates,
        dtlsParameters: transport.dtlsParameters,
      },
    };
  }

  public async connectPeerTransport(
    socketId: string,
    transportId: string,
    dtlsParameters: DtlsParameters
  ) {
    const peer = this._peers.get(socketId);
    if (!peer) {
      logger("ERROR", "NO PEER FOUND WITH SOCKET ID");
      return;
    }
    await peer.connectTransport(transportId, dtlsParameters);
  }

  public getRouterRtpCapabilties() {
    return this._router?.rtpCapabilities;
  }
  getProducerListForPeer() {
    let producerList: { producer_id: string }[] = [];
    this._peers.forEach((peer) => {
      peer.producers.forEach((producer) => {
        producerList.push({
          producer_id: producer.id,
        });
      });
    });
    return producerList;
  }

  public produce(
    socketId: string,
    producerTransportId: string,
    rtpParameters: RtpParameters,
    kind: MediaKind
  ) {
    return new Promise(async (resolve, reject) => {
      let producer = await this._peers
        .get(socketId)!
        .createProducer(producerTransportId, rtpParameters, kind);
      resolve(producer.id);
      this.broadCast(socketId, WebSocketEventType.NEW_PRODUCERS, [
        {
          producer_id: producer.id,
          producer_socket_id: socketId,
        },
      ]);
    });
  }

  async consume(
    socket_id: string,
    consumer_transport_id: string,
    producer_id: string,
    rtpCapabilities: RtpCapabilities
  ) {
    const routerCanConsume = this._router?.canConsume({
      producerId: producer_id,
      rtpCapabilities,
    });
    if (!routerCanConsume) {
      console.warn("Router cannot consume the given producer");
      return;
    }

    const peer = this._peers.get(socket_id);

    if (!peer) {
      console.warn("No Peer found with the given Id");
      return;
    }

    const consumer_created = await peer.createConsumer(
      consumer_transport_id,
      producer_id,
      rtpCapabilities
    );

    if (!consumer_created) {
      console.log("Couldn't create consumer");
      return;
    }

    const { consumer, params } = consumer_created;

    consumer.on("producerclose", () => {
      console.log("Consumer closed due to close event in producer id", {
        name: peer.name,
        consumer_id: consumer.id,
      });

      peer.removeConsumer(consumer.id);

      this.io.to(socket_id).emit(WebSocketEventType.CONSUMER_CLOSED, {
        consumer_id: consumer.id,
      });
    });

    return params;
  }

  broadCast(socket_id: string, name: string, data: any) {
    for (let otherID of Array.from(this._peers.keys()).filter(
      (id) => id !== socket_id
    )) {
      this.send(otherID, name, data);
    }
  }
  send(socketId: string, name: string, data: any) {
    this.io.to(socketId).emit(name, data);
  }
}
