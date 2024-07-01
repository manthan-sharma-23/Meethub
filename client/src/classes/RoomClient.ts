import * as mediasoup from "mediasoup-client";
import { RtpCapabilities } from "mediasoup-client/lib/RtpParameters";
import { WebSocketEvent, WebSocketEventType, mediaType } from "../config/types";
import {
  Consumer,
  DtlsParameters,
  IceCandidate,
  IceParameters,
  Producer,
  Transport,
} from "mediasoup-client/lib/types";

export interface TransportParams {
  id: string;
  iceParameters: IceParameters;
  iceCandidates: IceCandidate[];
  dtlsParameters: DtlsParameters;
}

export class RoomClient {
  ws: WebSocket;
  roomId: string;
  name: string;
  device: mediasoup.Device | null = null;
  producers: Map<string, Producer>;
  consumers: Map<string, Consumer>;
  producerTransport: Transport | null = null;
  consumerTransport: Transport | null = null;
  producerLabel: Map<string, string>;

  constructor(ws: WebSocket, roomId: string, name: string) {
    this.ws = ws;
    this.roomId = roomId;
    this.name = name;

    this.joinRoom();
    this.getRouterRtpCapabilties();

    this.producers = new Map();
    this.consumers = new Map();
    this.producerLabel = new Map();
  }

  private joinRoom() {
    let message: WebSocketEvent = {
      type: WebSocketEventType.CREATE_ROOM,
      payload: {
        roomId: this.roomId,
      },
    };

    this.send(message);

    message = {
      type: WebSocketEventType.JOIN_ROOM,
      payload: {
        name: this.name,
        roomId: this.roomId,
      },
    };

    this.send(message);
  }

  getRouterRtpCapabilties() {
    let message: WebSocketEvent = {
      type: WebSocketEventType.GET_ROUTER_RTP_CAPABILITIES,
      payload: {
        roomId: this.roomId,
      },
    };

    this.send(message);
  }

  async loadDevice(routerRtpCapabilities: RtpCapabilities) {
    try {
      this.device = new mediasoup.Device();
    } catch (error) {
      console.error("Error initializing the device", error);
      return;
    }
    await this.device.load({ routerRtpCapabilities });

    return this.device;
  }

  async createSendTransport() {
    this.send({
      type: WebSocketEventType.CREATE_WEBRTC_TRANSPORT,
      payload: {
        roomId: this.roomId,
        forceTcp: false,
        rtpCapabilities: this.device?.rtpCapabilities,
        type_of_transport: "produce",
      },
    });
  }

  async initSendTransport(params: TransportParams) {
    this.producerTransport = this.device?.createSendTransport(params)!;

    this.producerTransport.on("connect", ({ dtlsParameters }, cb, errb) => {
      const message: WebSocketEvent = {
        type: WebSocketEventType.CONNECT_TRANSPORT,
        payload: {
          roomId: this.roomId,
          transport_id: params.id,
          dtlsParameters,
          type_of_transport: "produce",
        },
      };

      this.send(message);
    });

    this.producerTransport.on("produce", ({ kind, rtpParameters }) => {
      const message: WebSocketEvent = {
        type: WebSocketEventType.PRODUCE,
        payload: {
          producerTransportId: this.producerTransport!.id,
          kind,
          rtpParameters,
          type_of_transport: "produce",
        },
      };

      this.send(message);
    });
  }

  createRecvTransport() {
    this.send({
      type: WebSocketEventType.CREATE_WEBRTC_TRANSPORT,
      payload: {
        roomId: this.roomId,
        forceTcp: false,
        rtpCapabilities: this.device?.rtpCapabilities,
        type_of_transport: "consume",
      },
    });
  }

  initConsumerTransport(params: TransportParams) {
    try {
      this.consumerTransport = this.device?.createRecvTransport(params)!;
    } catch (error) {
      console.log(error);
      return;
    }

    this.consumerTransport.on("connect", ({ dtlsParameters }) => {
      const message: WebSocketEvent = {
        type: WebSocketEventType.CONNECT_TRANSPORT,
        payload: {
          roomId: this.roomId,
          transport_id: params.id,
          dtlsParameters,
          type_of_transport: "consume",
        },
      };

      this.send(message);
    });
  }

  // helper functions to create / use / add streams

  // MAIN FUNCTIONS
  async produce(type: string, deviceId: string | null = null) {
    let mediaConstraints = {};
    let audio = false;
    let screen = false;

    switch (type) {
      case mediaType.audio:
        mediaConstraints = {
          audio: {
            deviceId: deviceId,
          },
          video: false,
        };
        audio = true;
        break;
      case mediaType.video:
        mediaConstraints = {
          audio: false,
          video: {
            width: {
              min: 640,
              ideal: 1920,
            },
            height: {
              min: 400,
              ideal: 1080,
            },
            deviceId: deviceId,
            /*aspectRatio: {
                          ideal: 1.7777777778
                      }*/
          },
        };
        break;
      case mediaType.screen:
        mediaConstraints = false;
        screen = true;
        break;
      default:
        break;
    }

    if (!this.device?.canProduce("video") && !audio) {
      console.log("Cannot produce video");
      return;
    }

    if (this.producerLabel.has(type)) {
      console.log("Producer already exists for this type " + type);
      return;
    }

    try {
      let stream: MediaStream;
      if (screen) {
        stream = await(navigator.mediaDevices as any).getDisplayMedia({
          video: true,
        });
      } else {
        stream = await navigator.mediaDevices.getUserMedia(mediaConstraints);
      }

      const track = audio
        ? stream.getAudioTracks()[0]
        : stream.getVideoTracks()[0];
      const params = { track };
      const producer = await this.producerTransport?.produce(params);

      producer!.on("transportclose", () => {
        console.log("transport for this producer closed");
        producer!.close();
        this.producers.delete(producer!.id);
      });

      this.producers.set(producer!.id, producer!);
      this.producerLabel.set(type, producer!.id);

      producer!.on("trackended", () => {
        console.log(type + " track ended");
        // this.closeProducer(type);
      });
    } catch (err) {
      console.log("Produce error:", err);
    }
  }

  private send(message: WebSocketEvent) {
    this.ws.send(JSON.stringify(message));
  }
}
