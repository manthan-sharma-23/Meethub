import {
  DtlsParameters,
  IceCandidate,
  IceParameters,
} from "mediasoup-client/lib/types";

export enum WebSocketEventType {
  ERROR = "error",
  DISCONNECT = "disconnect",
  EXIT_ROOM = "exitRoom",

  // server side
  CREATE_ROOM = "createRoom",
  JOIN_ROOM = "joinRoom",
  GET_PRODUCERS = "getProducers",
  GET_ROUTER_RTP_CAPABILITIES = "getRouterRtpCapabilities",
  CREATE_WEBRTC_TRANSPORT = "createWebRtcTransport",
  CONNECT_TRANSPORT = "connectTransport",
  PRODUCE = "produce",
  CONSUME = "consume",
  GET_MY_ROOM_INFO = "getMyRoomInfo",
  PRODUCER_CLOSED = "producerClosed",

  // client side
  ROOM_CREATED_MESSAGE = "createdRoom",
  NEW_PRODUCERS = "newProducers",
  PRODUCED = "produced",
  ROUTER_RTP_CAPABILITIES = "routerRtpCapabilities",
  CREATED_WEBRTC_TRANSPORT = "createdWebRtcTransport",
  CONSUMED = "consumed",
  ROOM_INFO = "roomInfo",
  JOINED_ROOM_MESSAGE = "joinedRoom",
}
export interface WebSocketEvent {
  type: WebSocketEventType;
  payload: any;
  socketId?: number;
}

export interface RoomDetails {
  roomId: string;
  name: string;
}
export const mediaType = {
  audio: "audioType",
  video: "videoType",
  screen: "screenType",
};

export const app_config = {
  server_port: 5000,
};

export interface webRtcTransportParams {
  id: string;
  iceParameters: IceParameters;
  iceCandidates: IceCandidate[];
  dtlsParameters: DtlsParameters;
}
