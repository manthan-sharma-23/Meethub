import { Consumer } from "mediasoup/node/lib/Consumer";
import { Producer } from "mediasoup/node/lib/Producer";
import {
  MediaKind,
  RtpCapabilities,
  RtpParameters,
} from "mediasoup/node/lib/RtpParameters";
import { Transport } from "mediasoup/node/lib/Transport";
import { DtlsParameters } from "mediasoup/node/lib/fbs/web-rtc-transport";
import { WebSocket } from "ws";

export class Peer {
  id: number;
  name: string;
  transports: Map<string, Transport>;
  producers: Map<string, Producer>;
  consumers: Map<string, Consumer>;
  socket: WebSocket;

  constructor(socket_id: number, name: string, socket: WebSocket) {
    this.id = socket_id;
    this.name = name;
    this.transports = new Map();
    this.producers = new Map();
    this.consumers = new Map();
    this.socket = socket;
  }

  addTransport(transport: Transport) {
    this.transports.set(transport.id, transport);
  }

  async connectTransport(transport_id: string, dtlsParamters: DtlsParameters) {
    if (!this.transports.has(transport_id)) return;

    await this.transports.get(transport_id)!.connect({ dtlsParamters });
  }

  async createProducer(
    producerTransportId: string,
    rtpParameters: RtpParameters,
    kind: MediaKind
  ) {
    let producer = await this.transports.get(producerTransportId)!.produce({
      rtpParameters: rtpParameters,
      kind,
    });

    this.producers.set(producer.id, producer);

    producer.on("transportclose", () => {
      console.log("Producer transport close", {
        name: `${this.name}`,
        consumer_id: `${producer.id}`,
      });
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
      console.log("Consumer Transport Absence");
      return;
    }

    let consumer = null;
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
      console.log(
        `Consumer transport close, name: ${this.name} consumer id: ${consumer.id}`
      );
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

  closeProducer(producerId: string) {
    try {
      this.producers.get(producerId)?.close();
    } catch (error) {
      console.warn(error);
    }

    this.producers.delete(producerId);
  }

  getProducer(producerId: string) {
    return this.producers.get(producerId);
  }

  close() {
    this.transports.forEach((transport) => {
      transport.close;
    });
  }

  removeConsumer(consumerId: string) {
    this.consumers.delete(consumerId);
  }
}
