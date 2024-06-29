export enum WebSocketEventType {
  ERROR = "error",

  // server side
  CREATE_ROOM = "createRoom",
  JOIN_ROOM = "joinRoom",
  GET_PRODUCERS = "getProducers",
  GET_ROUTER_RTP_CAPABILITIES = "getRouterRtpCapabilities",

  // client side
  ROOM_CREATED_MESSAGE = "createdRoom",
  NEW_PRODUCERS = "newProducers",
  ROUTER_RTP_CAPABILITIES = "routerRtpCapabilities",
}
export interface WebSocketEvent {
  type: WebSocketEventType;
  payload: any;
  socketId?: number;
}
