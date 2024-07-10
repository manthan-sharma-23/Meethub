import { Consumer } from "mediasoup-client/lib/Consumer";
import { ProducerContainer, RemoteStream } from "../../views/conference";
import { Peer } from "../config";
import { MediaKind } from "mediasoup-client/lib/RtpParameters";

export interface MergedData {
  userId: string;
  name: string;
  producers: ProducerInfo[];
}

export interface ProducerInfo {
  producerId: string;
  consumer: Consumer;
  stream: MediaStream;
  kind: MediaKind;
}
export function mergeData(
  usersInRoom: Peer[],
  remoteStreams: RemoteStream[],
  producerContainer: ProducerContainer[]
): MergedData[] {
  const userMap = new Map(usersInRoom.map((user) => [user.id, user.name]));
  const producerMap = new Map<string, ProducerContainer[]>(
    producerContainer.map((prod) => [prod.userId, []])
  );

  producerContainer.forEach((prod) => {
    if (producerMap.has(prod.userId)) {
      producerMap.get(prod.userId)!.push(prod);
    } else {
      producerMap.set(prod.userId, [prod]);
    }
  });

  const userStreamMap = new Map<string, ProducerInfo[]>();

  remoteStreams.forEach((stream) => {
    const producer = producerContainer.find(
      (prod) => prod.producer_id === stream.producerId
    );
    if (producer) {
      const userId = producer.userId;
      const producerInfo: ProducerInfo = {
        producerId: stream.producerId,
        consumer: stream.consumer,
        stream: stream.stream,
        kind: stream.kind,
      };

      if (userStreamMap.has(userId)) {
        userStreamMap.get(userId)!.push(producerInfo);
      } else {
        userStreamMap.set(userId, [producerInfo]);
      }
    }
  });

  return usersInRoom.map((user) => ({
    userId: user.id,
    name: user.name,
    producers: userStreamMap.get(user.id) || [],
  }));
}
