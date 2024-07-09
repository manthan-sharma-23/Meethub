export const config = {
  ws: {
    url: "ws://localhost:5000",
  },
};
export enum WebSocketEventType {
  // ROOM EVENTS
  CREATE_ROOM = "createRoom",
  JOIN_ROOM = "joinRoom",
  EXIT_ROOM = "exitRoom",
  USER_LEFT = "userLeft",
  USER_JOINED = "userJoined",
  GET_IN_ROOM_USERS = "getInRoomUsers",

  ERROR = "error",
  DISCONNECT = "disconnect",

  CLOSE_PRODUCER = "closeProducer",

  // server side
  GET_PRODUCERS = "getProducers",
  GET_ROUTER_RTP_CAPABILITIES = "getRouterRtpCapabilities",
  CREATE_WEBRTC_TRANSPORT = "createWebRtcTransport",
  CONNECT_TRANSPORT = "connectTransport",
  PRODUCE = "produce",
  CONSUME = "consume",
  GET_MY_ROOM_INFO = "getMyRoomInfo",
  PRODUCER_CLOSED = "producerClosed",
  CONSUMER_CLOSED = "consumerClosed",

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

export interface Peer {
  id: string;
  name: string;
}
