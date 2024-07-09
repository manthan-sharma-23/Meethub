import { DtlsParameters } from "mediasoup/node/lib/fbs/web-rtc-transport";
import {
  MediaKind,
  Producer,
  RtpParameters,
  Transport,
} from "mediasoup/node/lib/types";
import { logger } from "../helpers/logger";

export default class Peer {
  id: string;
  name: string;
  transports: Map<string, Transport>;
  producers: Map<string, Producer>;

  constructor(id: string, name: string) {
    this.id = id;
    this.name = name;
    this.transports = new Map();
    this.producers = new Map();
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
}
