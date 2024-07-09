import { DtlsParameters } from "mediasoup/node/lib/fbs/web-rtc-transport";
import {
  Consumer,
  MediaKind,
  Producer,
  RtpCapabilities,
  RtpParameters,
  Transport,
} from "mediasoup/node/lib/types";
import { logger } from "../helpers/logger";
import { WebSocketEventType } from "../config/types";
import { Server } from "socket.io";

export default class Peer {
  id: string;
  name: string;
  transports: Map<string, Transport>;
  producers: Map<string, Producer>;
  consumers: Map<string, Consumer>;
  io: Server;

  constructor(id: string, name: string, io: Server) {
    this.id = id;
    this.name = name;
    this.transports = new Map();
    this.producers = new Map();
    this.consumers = new Map();
    this.io = io;
  }

  addTransport(transport: Transport) {
    this.transports.set(transport.id, transport);
  }

  async connectTransport(transportId: string, dtlsParameters: DtlsParameters) {
    const transport = this.transports.get(transportId);
    if (!transport) {
      logger("ERROR", "Couldn't find transport");
      return;
    }
    await transport.connect({ dtlsParameters });
  }

  async createProducer(
    producerTransportId: string,
    rtpParameters: RtpParameters,
    kind: MediaKind
  ) {
    let producer = await this.transports.get(producerTransportId)?.produce({
      kind,
      rtpParameters,
    })!;

    this.producers.set(producer?.id, producer);

    producer.on("transportclose", () => {
      logger("Producer Closed", { producer: producer.id });
      producer.close();
      this.producers.delete(producer.id);
    });

    return producer;
  }

  async createConsumer(
    consumer_transport_id: string,
    producer_id: string,
    rtpCapabilities: RtpCapabilities
  ) {
    let consumerTransport = this.transports.get(consumer_transport_id);
    if (!consumerTransport) {
      console.warn("Create a transport for the specified consumer first ");
      return;
    }

    let consumer: Consumer;

    try {
      consumer = await consumerTransport.consume({
        producerId: producer_id,
        rtpCapabilities,
        paused: false,
      });
    } catch (error) {
      console.error("Consume failed", error);
      return;
    }

    if (consumer.type === "simulcast") {
      await consumer.setPreferredLayers({
        spatialLayer: 2,
        temporalLayer: 2,
      });
    }

    this.consumers.set(consumer.id, consumer);

    consumer.on("transportclose", () => {
      console.log("Consumer transport close", {
        name: `${this.name}`,
        consumer_id: `${consumer.id}`,
      });
      this.consumers.delete(consumer.id);
    });

    return {
      consumer,
      params: {
        producerId: producer_id,
        id: consumer.id,
        kind: consumer.kind,
        rtpParameters: consumer.rtpParameters,
        type: consumer.type,
        producerPaused: consumer.producerPaused,
      },
    };
  }
  closeProducer(producer_id: string) {
    console.log(this.producers);

    try {
      this.producers.get(producer_id)!.close();
    } catch (e) {
      console.warn(e);
    }

    this.producers.delete(producer_id);

    this.io.emit(WebSocketEventType.PRODUCER_CLOSED, { producer_id });
  }

  getProducer(producer_id: string) {
    return this.producers.get(producer_id);
  }

  close() {
    this.transports.forEach((transport) => transport.close());
  }

  removeConsumer(consumerId: string) {
    this.consumers.delete(consumerId);
  }
}
