import { memo, useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { Socket, io } from "socket.io-client";
import {
  ConsumerResult,
  WebSocketEventType,
  webRtcTransportParams,
} from "../config/types";
import { Button } from "@mui/material";
import { MediaKind, RtpCapabilities } from "mediasoup-client/lib/RtpParameters";
import { Device } from "mediasoup-client";
import { Transport } from "mediasoup-client/lib/Transport";
import { Producer } from "mediasoup-client/lib/Producer";
import { Consumer } from "mediasoup-client/lib/Consumer";

const Room = () => {
  const { roomId, name } = useParams();

  // Reference States
  const socketState = useRef<Socket | null>(null);
  const deviceRef = useRef<Device | null>(null);
  const producerTransportRef = useRef<Transport | null>(null);
  const consumerTransportRef = useRef<Transport | null>(null);
  const videoProducer = useRef<Producer | null>(null);
  const consumers = useRef<Map<string, Consumer>>(new Map());

  // video references
  const localVideoRef = useRef<HTMLVideoElement>(null);

  // Remote videos
  const [videoStreams, setVideoStreams] = useState<
    { consumer: Consumer; stream: MediaStream; kind: MediaKind }[]
  >([]);

  useEffect(() => {
    const socket = io("http://localhost:5000");

    socket.on("connect", () => {
      socketState.current = socket;
      loadeVerything();
    });

    socket.on(
      WebSocketEventType.NEW_PRODUCERS,
      (data: { producer_id: string }[]) => {
        if (!data) {
          console.log("No new producers");
          return;
        }
        console.log(data);
        data.forEach(({ producer_id }) => {
          consume(producer_id);
        });
      }
    );

    return () => {
      socket.disconnect();
    };
  }, [roomId, name]);

  const loadeVerything = async () => {
    await createRoom();
    await joinRoom();

    await getRouterRtpCapabilities();

    await createConsumerTransport();
  };

  // Create or join a socket room
  const createRoom = async () => {
    await sendRequest(WebSocketEventType.CREATE_ROOM, { _roomId: roomId });
  };
  const joinRoom = async () => {
    await sendRequest(WebSocketEventType.JOIN_ROOM, { _roomId: roomId, name });
  };

  // turn on the video cam functionality
  const turnOnVideoCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });

      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }

      await createProduceTransport();
      produce();
    } catch (error) {
      console.log(error);
    }
  };

  const getRouterRtpCapabilities = async () => {
    const rtp = (await sendRequest(
      WebSocketEventType.GET_ROUTER_RTP_CAPABILITIES,
      {}
    )) as RtpCapabilities;
    await loadDevice(rtp);
  };

  const loadDevice = async (rtp: RtpCapabilities) => {
    try {
      const device = new Device();
      console.log(rtp);

      await device.load({ routerRtpCapabilities: rtp });
      deviceRef.current = device;
      console.log("Device Loaded Successfully");
    } catch (error) {
      console.log(error);
    }
  };

  const createProduceTransport = async () => {
    if (socketState.current && deviceRef.current) {
      console.log("Produce");

      const resp = (await sendRequest(
        WebSocketEventType.CREATE_WEBRTC_TRANSPORT,
        {
          forceTcp: false,
          rtpCapabilities: deviceRef.current.rtpCapabilities,
        }
      )) as webRtcTransportParams;

      producerTransportRef.current =
        deviceRef.current!.createSendTransport(resp);

      console.log("--- Created Producer Transport --- ");

      if (producerTransportRef.current) {
        try {
          producerTransportRef.current.on(
            "connect",
            async ({ dtlsParameters }, cb, eb) => {
              sendRequest(WebSocketEventType.CONNECT_TRANSPORT, {
                transport_id: producerTransportRef.current!.id,
                dtlsParameters,
              })
                .then(cb)
                .catch(eb);
            }
          );
          producerTransportRef.current.on(
            "produce",
            async ({ kind, rtpParameters }, cb, eb) => {
              try {
                const { producer_id } = (await sendRequest(
                  WebSocketEventType.PRODUCE,
                  {
                    producerTransportId: producerTransportRef.current!.id,
                    kind,
                    rtpParameters,
                  }
                )) as { producer_id: string };

                cb({ id: producer_id });
              } catch (error) {
                eb(new Error(String(error)));
              }
            }
          );

          producerTransportRef.current.on("connectionstatechange", (state) => {
            console.log(state);
          });

          return true;
        } catch (error) {
          console.log(error);
        }
      }
    }
  };

  function sendRequest(type: any, data: any) {
    return new Promise((resolve, reject) => {
      if (!socketState.current) {
        alert("No socket state active");
        return;
      }
      socketState.current.emit(type, data, (response: any, err: any) => {
        if (!err) {
          resolve(response);
        } else {
          reject(err);
        }
      });
    });
  }

  const produce = async () => {
    if (!producerTransportRef.current) {
      console.log("Producer transport not initialized");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      // Extract the video track from the media stream
      const videoTrack = stream.getVideoTracks()[0];
      const producer = await producerTransportRef.current.produce({
        track: videoTrack,
      });
      videoProducer.current = producer;
      console.log("--- Producer --- ", producer);
    } catch (error) {
      console.error("Error in producer:", error);
    }
  };

  const createConsumerTransport = async () => {
    if (consumerTransportRef.current) {
      console.log("Consumer Transport already created");
      return;
    }
    try {
      const data = (await sendRequest(
        WebSocketEventType.CREATE_WEBRTC_TRANSPORT,
        { forceTcp: false }
      )) as webRtcTransportParams;

      console.log("Consumer Transport :: ", data);

      if (!data) {
        throw new Error("No Transport created");
      }
      if (!deviceRef.current || !socketState.current) {
        console.error("No devie or socket found");
        return;
      }
      consumerTransportRef.current =
        deviceRef.current.createRecvTransport(data);

      consumerTransportRef.current.on(
        "connect",
        async ({ dtlsParameters }, cb, eb) => {
          sendRequest(WebSocketEventType.CONNECT_TRANSPORT, {
            transport_id: consumerTransportRef.current!.id,
            dtlsParameters,
          })
            .then(cb)
            .catch(eb);
        }
      );

      consumerTransportRef.current.on("connectionstatechange", (state) => {
        console.log("Consumer state", state);
        if (state === "disconnected") {
          consumerTransportRef.current?.close();
        }
      });

      console.log("--- Connected Consumer Transport ---");

      const producers = (await sendRequest(
        WebSocketEventType.GET_PRODUCERS,
        {}
      )) as { producer_id: string }[];

      producers.forEach((producer) => {
        console.log("Remote producer: ", producer);

        consume(producer.producer_id);
      });
    } catch (error) {
      console.error("Consume Function Error Client :: ", error);
      return;
    }
  };

  const consume = (producerId: string) => {
    getConsumerStream(producerId).then((data) => {
      if (!data) {
        console.log("Couldn't load stream");
        return;
      }
      const { consumer, stream, kind } = data;
      consumers.current.set(consumer.id, consumer);
      if (kind === "video") {
        setVideoStreams((v) => [...v, data]);
      }
    });
  };

  const getConsumerStream = async (producerId: string) => {
    if (!deviceRef.current) {
      console.log("No device found");
      return;
    }
    if (!consumerTransportRef.current) {
      console.warn("No current consumer transport");
      return;
    }
    const rtpCapabilities = deviceRef.current.rtpCapabilities;
    const data = (await sendRequest(WebSocketEventType.CONSUME, {
      rtpCapabilities,
      consumerTransportId: consumerTransportRef.current.id,
      producerId,
    })) as ConsumerResult;

    const { id, kind, rtpParameters } = data;
    let codecOptions = {};

    const consumer = await consumerTransportRef.current.consume({
      id,
      producerId,
      kind,
      rtpParameters,
    });

    const stream = new MediaStream();
    stream.addTrack(consumer.track);

    return {
      consumer,
      stream,
      kind,
    };
  };

  return (
    <div className="h-screen w-screen p-3 flex justify-center items-center">
      <div className="w-1/2 h-full flex flex-col gap-3 ">
        <video
          ref={localVideoRef}
          autoPlay
          playsInline
          className="h-1/2 w-full border-2"
        ></video>
        <div className="h-auto w-full flex justify-center items-center gap-3">
          <Button
            onClick={turnOnVideoCamera}
            variant="contained"
            sx={{ width: "50%" }}
          >
            Turn on Video
          </Button>
          <Button variant="contained" sx={{ width: "50%" }}>
            Turn On Audio
          </Button>
        </div>
      </div>
      <div className="w-1/2 h-full flex flex-wrap ml-3 gap-3 border-3 border-red-500">
        {videoStreams &&
          videoStreams.map(({ stream }, index) => (
            <MemoizedRemoteStream stream={stream} key={index} />
          ))}
      </div>
    </div>
  );
};

const RemoteVideo = ({ stream }: { stream: MediaStream }) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.srcObject = stream;
      videoRef.current.play();
      videoRef.current.volume = 0;
      videoRef.current.autoplay = true;
    }
  }, [stream]);

  return (
    <video
      ref={videoRef}
      autoPlay
      playsInline
      className="h-1/4 w-auto border-2"
    />
  );
};

const MemoizedRemoteStream = memo(RemoteVideo);

export default Room;
