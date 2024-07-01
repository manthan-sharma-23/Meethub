// src/Room.tsx
import { useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { Device } from "mediasoup-client";
import { WebSocketEvent, WebSocketEventType } from "../config/types";
import { TransportParams } from "../classes/RoomClient";
import { Transport } from "mediasoup-client/lib/types";
import { create } from "@mui/material/styles/createTransitions";

const Room = () => {
  const { roomId, name } = useParams();
  const [socket, setSocket] = useState<WebSocket | null>(null);
  const [device, setDevice] = useState<Device | null>(null);
  const [joined, setJoined] = useState<boolean>(false);
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const producerTransport = useRef<Transport | null>(null);
  const consumerTransport = useRef<Transport | null>(null);
  const [videoOn, setVideoOn] = useState(false);

  const getLocalMedia = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: false,
      });
      if (localVideoRef.current && producerTransport.current) {
        localVideoRef.current.srcObject = stream;

        stream.getTracks().forEach(async (track) => {
          try {
            console.log("Producing track:", track);
            console.log("Producer Transport:", producerTransport.current);

            const producer = await producerTransport.current!.produce({
              track,
            });
            console.log("Producer created:", producer);
          } catch (produceError) {
            console.error("Error during producing track:", produceError);
          }
        });
      }
    } catch (mediaError) {
      console.error("Error accessing local media:", mediaError);
    }
  };
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

    newSocket.onerror = (error) => {
      console.error("WebSocket error:", error);
    };

    newSocket.onclose = (event) => {
      console.log("WebSocket connection closed:", event);
    };

    return () => {
      newSocket.close();
    };
  }, [roomId, name]);

  useEffect(() => {}, [producerTransport, videoOn]);

  const handleSocketMessage = async (event: WebSocketEvent) => {
    console.log(event);

    switch (event.type) {
      case WebSocketEventType.ROUTER_RTP_CAPABILITIES:
        await loadDevice(event.payload.rtpCapabilities);
        break;
      case WebSocketEventType.NEW_PRODUCERS:
        break;

      case WebSocketEventType.CREATED_WEBRTC_TRANSPORT:
        await createdWebRtcTransport(event);
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

      await createTransport("recv");
    } catch (error) {
      console.error("Error loading device", error);
    }
  };

  const createdWebRtcTransport = async (event: WebSocketEvent) => {
    try {
      if (device && socket) {
        const params = event.payload.params as TransportParams;
        const type_of_transport = event.payload.type_of_transport as
          | "send"
          | "recv";
        if (type_of_transport === "send") {
          try {
            const prod_transport = device.createSendTransport(params);
            producerTransport.current = prod_transport;
            console.log("New produce transport", producerTransport.current);

            producerTransport.current.on("connect", ({ dtlsParameters }) => {
              console.log("dtls", dtlsParameters);

              const message: WebSocketEvent = {
                type: WebSocketEventType.CONNECT_TRANSPORT,
                payload: {
                  roomId: roomId,
                  transport_id: prod_transport.id,
                  dtlsParameters,
                  type_of_transport: "send",
                },
              };

              socket.send(JSON.stringify(message));

              if (videoOn) {
                console.log("Second useEffect - videoOn:", videoOn);
                getLocalMedia();
              }
            });

            producerTransport.current.on(
              "produce",
              ({ kind, rtpParameters }) => {
                console.log("kind", kind);

                const message: WebSocketEvent = {
                  type: WebSocketEventType.PRODUCE,
                  payload: {
                    producerTransportId: prod_transport.id,
                    kind,
                    rtpParameters,
                    type_of_transport: "produce",
                  },
                };
                socket.send(JSON.stringify(message));
              }
            );

            console.log(prod_transport);
            setVideoOn(true);
          } catch (error) {
            setVideoOn(false);
            console.error("error", error);
          }
        } else {
          const recv_transport = device.createRecvTransport(params);
          consumerTransport.current = recv_transport;

          recv_transport.on("connect", ({ dtlsParameters }) => {
            const message: WebSocketEvent = {
              type: WebSocketEventType.CONNECT_TRANSPORT,
              payload: {
                roomId: roomId,
                transport_id: recv_transport.id,
                dtlsParameters,
                type_of_transport: "recv",
              },
            };
            socket.send(JSON.stringify(message));
          });

          recv_transport.on("connectionstatechange", ({}) => {});
        }
      }
    } catch (error) {
      console.log("ERROR", error);
      return;
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

      //   await produce(transportData);
    } else {
      alert("No device or socket");
    }
  };

  const createTransport = async (direction: "send" | "recv") => {
    const message: WebSocketEvent = {
      type: WebSocketEventType.CREATE_WEBRTC_TRANSPORT,
      payload: {
        roomId,
        type_of_transport: direction,
      },
    };
    console.log(socket);

    socket!.send(JSON.stringify(message));
  };

  return (
    <div>
      <div>
        Room ID: {roomId}
        <br />
        Name: {name}
        <br />
        {String(videoOn)}
      </div>
      {joined && (
        <button onClick={handleStartStreaming}>Start Streaming</button>
      )}
      <video ref={localVideoRef} autoPlay playsInline />
    </div>
  );
};

export default Room;
