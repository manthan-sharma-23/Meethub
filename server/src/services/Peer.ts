import { Producer } from "mediasoup/node/lib/Producer";
import { DtlsParameters } from "mediasoup/node/lib/fbs/web-rtc-transport";
import {
  Consumer,
  MediaKind,
  RtpCapabilities,
  RtpParameters,
  Transport,
} from "mediasoup/node/lib/types";

export class Peer {
  name: string;
  id: string;
  transports: Map<string, Transport>;
  producers: Map<string, Producer>;
  consumers: Map<string, Consumer>;

  constructor(name: string, id: string) {
    this.name = name;
    this.id = id;
    this.producers = new Map();
    this.transports = new Map();
    this.consumers = new Map();
  }

  addTransport(transport: Transport) {
    this.transports.set(transport.id, transport);
  }

  async connectTransport(transport_id: string, dtlsParameters: DtlsParameters) {
    const transport = this.transports.get(transport_id);
    if (!transport) {
      console.log("No transport found");
      return;
    }
    await transport.connect({ dtlsParameters });
  }

  async createProducer(
    producerTransportId: string,
    rtpParameters: RtpParameters,
    kind: MediaKind
  ) {
    let producer = await this.transports.get(producerTransportId)!.produce({
      kind,
      rtpParameters: rtpParameters,
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
}
