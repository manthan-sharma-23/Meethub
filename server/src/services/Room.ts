import {
  MediaKind,
  Producer,
  Router,
  RtpCapabilities,
  RtpParameters,
  Worker,
} from "mediasoup/node/lib/types";
import { WebSocketServer } from "ws";
import { config } from "../config/config";
import { Peer } from "./Peer";
import { DtlsParameters } from "mediasoup/node/lib/fbs/web-rtc-transport";

export class Room {
  id: string;
  wss: WebSocketServer;
  router: Router | null = null;
  peers: Map<number, Peer>;

  constructor(room_id: string, worker: Worker, wss: WebSocketServer) {
    this.id = room_id;
    this.wss = wss;

    const mediaCodecs = config.mediasoup.router.mediaCodecs;

    worker
      .createRouter({
        mediaCodecs: mediaCodecs,
      })
      .then((router) => {
        this.router = router;
      });

    this.peers = new Map();
  }

  addPeer(peer: Peer) {
    this.peers.set(peer.id, peer);
  }

  getProducersListForPeer() {
    let producerList: { producer_id: string }[] = [];
    this.peers.forEach((peer) => {
      peer.producers.forEach((producer) => {
        producerList.push({
          producer_id: producer.id,
        });
      });
    });

    return producerList;
  }

  async createWebRtcTransport(socketId: number) {
    const { maxIncomingBitrate, initialAvailableOutgoingBitrate } =
      config.mediasoup.webRtcTransport;

    const transport = await this.router?.createWebRtcTransport({
      listenIps: config.mediasoup.webRtcTransport.listenIps,
      enableUdp: true,
      enableTcp: true,
      preferUdp: true,
      initialAvailableOutgoingBitrate,
    });

    if (!transport) {
      console.log("Couldn't create transport for id ", socketId);
      return;
    }

    if (maxIncomingBitrate) {
      try {
        await transport?.setMaxIncomingBitrate(maxIncomingBitrate);
      } catch (error) {}
    }
    transport.on("dtlsstatechange", (dtlsState) => {
      if (dtlsState === "closed") {
        console.log("Transport close", {
          name: this.peers.get(socketId)!.name,
        });
        transport.close();
      }
    });

    transport.on("@close", () => {
      console.log("Transport close", { name: this.peers.get(socketId)!.name });
    });

    console.log(`Adding transport `, { name: this.peers.get(socketId)?.name });

    this.peers.get(socketId)?.addTransport(transport);
    return {
      params: {
        id: transport.id,
        iceParameters: transport.iceParameters,
        iceCandidates: transport.iceCandidates,
        dtlsParameters: transport.dtlsParameters,
      },
    };
  }

  async connectPeerTransport(
    socketId: number,
    transportId: string,
    dtlsParameters: DtlsParameters
  ) {
    if (!this.peers.has(socketId)) return;

    await this.peers
      .get(socketId)
      ?.connectTransport(transportId, dtlsParameters);
  }

  async produce(
    socketId: number,
    producerTransportId: string,
    rtpParameters: RtpParameters,
    kind: MediaKind
  ) {
    return new Promise(async (resolve, reject) => {
      let producer = await this.peers
        .get(socketId)!
        .createProducer(producerTransportId, rtpParameters, kind);

      resolve(producer.id);
    });
  }

  async consume(
    socketId: number,
    consumer_transport_id: string,
    producerId: string,
    rtpCapabilities: RtpCapabilities
  ) {
    if (
      !this.router?.canConsume({
        producerId,
        rtpCapabilities,
      })
    ) {
      console.log("Cannot consume");
      return;
    }

    let consumer = await this.peers
      .get(socketId)!
      .createConsumer(consumer_transport_id, producerId, rtpCapabilities)!;

    if (!consumer) {
      console.log("Consumer not defined");
      return;
    }

    consumer.consumer.on("producerclose", () => {
      console.log(
        `Consumer close due to producer close event , name : ${
          this.peers.get(socketId)?.name
        } consumerId : ${consumer.consumer.id}`
      );

      this.peers.get(socketId)?.removeConsumer(consumer.consumer.id);
    });
  }

  async removePeer(socketId: number) {
    this.peers.get(socketId)?.close();
    this.peers.delete(socketId);
  }

  closeProducer(socketId: number, producerId: string) {
    this.peers.get(socketId)?.closeProducer(producerId);
  }

  get getRtpCapabilties() {
    return this.router?.rtpCapabilities;
  }

  get getPeers() {
    return this.peers;
  }

  get toJson() {
    return {
      id: this.id,
      peers: JSON.stringify([...this.peers]),
    };
  }
}
