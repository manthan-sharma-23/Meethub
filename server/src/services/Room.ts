import {
  MediaKind,
  Router,
  RtpCapabilities,
  RtpParameters,
  Worker,
} from "mediasoup/node/lib/types";
import * as io from "socket.io";
import { Peer } from "./Peer";
import { config } from "../config/config";
import { DtlsParameters } from "mediasoup/node/lib/fbs/web-rtc-transport";
import { WebSocketEventType } from "../config/types";

export class Room {
  id: string;
  router: Router | null = null;
  io: io.Server;
  _peers: Map<string, Peer>;

  constructor(id: string, worker: Worker, io: io.Server) {
    this.id = id;
    const mediaCodecs = config.mediasoup.router.mediaCodecs;
    worker
      .createRouter({
        mediaCodecs,
      })
      .then((router) => {
        this.router = router;
      });

    this.io = io;
    this._peers = new Map();
  }

  getRouterRtpCapabilities() {
    return this.router!.rtpCapabilities;
  }

  removePeer = (socketId: string) => {
    this._peers.delete(socketId);
  };

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

  async createWebRtcTransport(socket_id: string) {
    const { maxIncomingBitrate, initialAvailableOutgoingBitrate, listenIps } =
      config.mediasoup.webRtcTransport;

    const peer = this.getPeer(socket_id);
    if (!peer) {
      console.log("No Peer found to add transport to");
      return;
    }

    const transport = await this.router!.createWebRtcTransport({
      listenIps,
      enableUdp: true,
      enableTcp: true,
      preferUdp: true,
      initialAvailableOutgoingBitrate,
    });
    if (maxIncomingBitrate) {
      try {
        await transport.setMaxIncomingBitrate(maxIncomingBitrate);
      } catch (error) {}
    }

    transport.on("dtlsstatechange", (state) => {
      if (state === "closed") {
        console.log("Transport Closed ", {
          name: peer.name,
        });
      }
    });

    transport.on("@close", () => {
      console.log("Transport Closed ", {
        name: peer.name,
      });
    });

    console.log("Adding Transport ", { transport_id: transport.id });

    peer.addTransport(transport);

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
    socket_id: string,
    transport_id: string,
    dtlsParameters: DtlsParameters
  ) {
    console.log("DTLS", dtlsParameters);

    const peer = this._peers.get(socket_id);
    if (!peer) {
      console.warn("No Peer Found with id");
      return;
    }
    await peer.connectTransport(transport_id, dtlsParameters);
  }

  async produce(
    socket_id: string,
    producerTransportId: string,
    rtpParameters: RtpParameters,
    kind: MediaKind
  ): Promise<string> {
    return new Promise<string>(async (resolve, reject) => {
      try {
        let producer = await this._peers
          .get(socket_id)!
          .createProducer(producerTransportId, rtpParameters, kind);
        resolve(producer.id);
        this.broadCast(socket_id, "newProducers", [
          {
            producer_id: producer.id,
            producer_socket_id: socket_id,
          },
        ]);
      } catch (error) {
        reject(error);
      }
    });
  }

  async consume(
    socket_id: string,
    consumer_transport_id: string,
    producer_id: string,
    rtpCapabilities: RtpCapabilities
  ) {
    const routerCanConsume = this.router?.canConsume({
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

  addPeer(peer: Peer) {
    this._peers.set(peer.id, peer);
  }

  getPeer(socketId: string) {
    return this._peers.get(socketId);
  }

  getPeers() {
    return this._peers;
  }

  broadCast(socket_id: string, name: string, data: any) {
    for (let otherID of Array.from(this._peers.keys()).filter(
      (id) => id !== socket_id
    )) {
      this.send(otherID, name, data);
    }
  }

  send(socket_id: string, name: string, data: any) {
    this.io.to(socket_id).emit(name, data);
  }

  toJson() {
    return {
      id: this.id,
      peers: JSON.stringify([...this._peers]),
    };
  }
}
