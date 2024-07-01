// src/Room.tsx
import React, { useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { Device } from "mediasoup-client";
import { WebSocketEvent, WebSocketEventType } from "../config/types";
import { RtpCapabilities } from "mediasoup-client/lib/RtpParameters";

const Room = () => {
  const { roomId, name } = useParams();
  const [socket, setSocket] = useState<WebSocket | null>(null);
  const [device, setDevice] = useState<Device | null>(null);
  const [joined, setJoined] = useState<boolean>(false);
  const localVideoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const newSocket = new WebSocket("ws://localhost:5000/ws");
    setSocket(newSocket);

    newSocket.onopen = () => {
      console.log("WebSocket connection established");
      joinRoom(newSocket);
    };

    newSocket.onmessage = (message) => {
      const event: WebSocketEvent = JSON.parse(message.data);
      handleSocketMessage(event);
    };

    return () => {
      newSocket.close();
    };
  }, [roomId, name]);

  const handleSocketMessage = async (event: WebSocketEvent) => {
    switch (event.type) {
      case WebSocketEventType.ROUTER_RTP_CAPABILITIES:
        await loadDevice(event.payload.rtpCapabilities);
        break;
      case WebSocketEventType.NEW_PRODUCERS:
        break;
      default:
        break;
    }
  };

  const loadDevice = async (rtpCapabilities: any) => {
    try {
      const newDevice = new Device();
      await newDevice.load({ routerRtpCapabilities: rtpCapabilities });
      setDevice(newDevice);
    } catch (error) {
      console.error("Error loading device", error);
    }
  };

  const joinRoom = (newSocket: WebSocket) => {
    if (roomId && name) {
      const message: WebSocketEvent = {
        type: WebSocketEventType.CREATE_ROOM,
        payload: {
          roomId,
        },
      };
      newSocket.send(JSON.stringify(message));

      newSocket.send(
        JSON.stringify({
          type: WebSocketEventType.JOIN_ROOM,
          payload: { roomId, name },
        })
      );

      setTimeout(() => {
        const message: WebSocketEvent = {
          type: WebSocketEventType.GET_ROUTER_RTP_CAPABILITIES,
          payload: {
            roomId,
          },
        };
        newSocket.send(JSON.stringify(message));
      }, 200);
      setJoined(true);
    }
  };

  const handleStartStreaming = async () => {
    if (device && socket) {
      console.log("Device ", device);

      const transportData = await createTransport("send");
      console.log(transportData);

      await produce(transportData);
    } else {
      alert("No device or socket");
    }
  };

  const createTransport = async (direction: "send" | "recv") => {};

  const produce = async ({
    id,
    iceParameters,
    iceCandidates,
    dtlsParameters,
    sctpParameters,
  }: any) => {
    if (device) {
      const transport = device.createSendTransport({
        id,
        iceParameters,
        iceCandidates,
        dtlsParameters,
        sctpParameters,
      });

      transport.on("connect", ({ dtlsParameters }, callback, errback) => {
        if (socket) {
          socket.send(
            JSON.stringify({
              type: "CONNECT_TRANSPORT",
              payload: { roomId, dtlsParameters, transport_id: transport.id },
            })
          );
          callback();
        }
      });

      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      });
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }

      const track = stream.getVideoTracks()[0];
      const params = { track };
      await transport.produce(params);
    }
  };

  console.log(device);
  return (
    <div>
      <div>
        Room ID: {roomId}
        <br />
        Name: {name}
      </div>
      {joined && (
        <button onClick={handleStartStreaming}>Start Streaming</button>
      )}
      <video ref={localVideoRef} autoPlay playsInline />
    </div>
  );
};

export default Room;
