import React, { useCallback, useEffect, useRef } from "react";
import { useParams } from "react-router-dom";
import { Socket, io } from "socket.io-client";
import {
  WebSocketEventType,
  app_config,
  webRtcTransportParams,
} from "../config/types";
import { Button } from "@mui/material";
import { RtpCapabilities } from "mediasoup-client/lib/RtpParameters";
import { Device } from "mediasoup-client";
import { DtlsParameters, Transport } from "mediasoup-client/lib/Transport";
import { Producer } from "mediasoup-client/lib/Producer";

const Room = () => {
  const { roomId, name } = useParams();

  // Reference States
  const socketState = useRef<Socket | null>(null);
  const deviceRef = useRef<Device | null>(null);
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const producerTransportRef = useRef<Transport | null>(null);
  const videoProducer = useRef<Producer | null>(null);

  useEffect(() => {
    const socket = io("http://localhost:5000");

    socket.on("connect", () => {
      socketState.current = socket;
      createRoom();
      joinRoom();
    });

    return () => {
      socket.disconnect();
    };
  }, [roomId, name]);

  const createRoom = () => {
    if (socketState.current) {
      socketState.current.emit(
        WebSocketEventType.CREATE_ROOM,
        { _roomId: roomId },
        (resp: any) => {
          console.log(resp);
        }
      );
    }
  };
  const joinRoom = () => {
    if (socketState.current) {
      socketState.current.emit(
        WebSocketEventType.JOIN_ROOM,
        { _roomId: roomId, name },
        (resp: any) => {
          console.log(resp);
        }
      );
    }
  };

  const turnOnVideoCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });

      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }
    } catch (error) {
      console.log(error);
    }
  };

  const getRouterRtpCapabilities = useCallback(() => {
    if (socketState.current) {
      socketState.current.emit(
        WebSocketEventType.GET_ROUTER_RTP_CAPABILITIES,
        {},
        (resp: RtpCapabilities) => {
          loadDevice(resp);
        }
      );
    }
  }, [socketState, roomId, name]);

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

      console.log("--- Producer : ", producer);
    } catch (error) {
      console.error("Error in producer:", error);
    }
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
        <Button onClick={getRouterRtpCapabilities} variant="contained">
          Get Router RTP Capabilities
        </Button>
        <div className="h-auto w-full flex justify-center items-center gap-3">
          <Button
            onClick={createProduceTransport}
            variant="contained"
            sx={{ width: "50%" }}
          >
            Create Produce Transport
          </Button>
          <Button variant="contained" sx={{ width: "50%" }}>
            Connect Producer Transport
          </Button>
        </div>
        <Button variant="contained" onClick={produce}>
          Produce Media
        </Button>
      </div>
      <div className="w-1/2 h-full flex felx-col gap-3"></div>
    </div>
  );
};

export default Room;
