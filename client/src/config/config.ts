import {
  DtlsParameters,
  IceCandidate,
  IceParameters,
  MediaKind,
  RtpParameters,
} from "mediasoup-client/lib/types";

export const config = {
  ws: {
    url: "ws://65.2.69.109:5000",
  },
  server: {
    url: "http://65.2.69.109:5000",
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

  // ROOM CHAT
  USER_CHAT = "userChatMessage",

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
export interface ConsumerResult {
  producerId: string;
  id: string;
  kind: MediaKind;
  rtpParameters: RtpParameters;
  type: any;
  producerPaused: boolean;
}

export interface ChatMessage {
  user: Peer;
  data: string;
  createdAt: Date;
}

export interface webRtcTransportParams {
  id: string;
  iceParameters: IceParameters;
  iceCandidates: IceCandidate[];
  dtlsParameters: DtlsParameters;
}

export interface BundledMessages {
  user: Peer;
  messages: { data: string; createdAt: Date }[];
}
export function sortAndBundleMessages(
  messages: ChatMessage[]
): BundledMessages[] {
  // Step 1: Sort messages by createdAt date in ascending order
  messages.sort((a, b) => {
    const a_time = new Date(a.createdAt).getTime();
    const b_time = new Date(b.createdAt).getTime();

    return a_time - b_time;
  });

  // Step 2: Bundle consecutive messages by user
  const bundledMessages: BundledMessages[] = [];
  let currentBundle: BundledMessages | null = null;

  for (const message of messages) {
    if (currentBundle && message.user.id === currentBundle.user.id) {
      // If the message is from the same user as the current bundle, add it to the current bundle
      currentBundle.messages.push({
        data: message.data,
        createdAt: message.createdAt,
      });
    } else {
      // If the message is from a different user, start a new bundle
      if (currentBundle) {
        bundledMessages.push(currentBundle);
      }
      currentBundle = {
        user: message.user,
        messages: [{ data: message.data, createdAt: message.createdAt }],
      };
    }
  }

  // Add the last bundle if it exists
  if (currentBundle) {
    bundledMessages.push(currentBundle);
  }

  return bundledMessages;
}
