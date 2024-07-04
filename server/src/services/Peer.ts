import { Producer } from "mediasoup/node/lib/Producer";
import { DtlsParameters } from "mediasoup/node/lib/fbs/web-rtc-transport";
import { MediaKind, RtpParameters, Transport } from "mediasoup/node/lib/types";

export class Peer {
  name: string;
  id: string;
  transports: Map<string, Transport>;
  producers: Map<string, Producer>;

  constructor(name: string, id: string) {
    this.name = name;
    this.id = id;
    this.producers = new Map();
    this.transports = new Map();
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
}
