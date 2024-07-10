// styles
import "../../styles/chat_scrollBar.css";

import { memo, useCallback, useEffect, useRef, useState } from "react";
import { BsPeopleFill } from "react-icons/bs";
import { FaVideo } from "react-icons/fa";
import { FaVideoSlash } from "react-icons/fa6";
import { PiChatsTeardropDuotone, PiTelevisionSimple } from "react-icons/pi";
import { TbMicrophoneFilled, TbMicrophoneOff } from "react-icons/tb";
import { useParams } from "react-router-dom";
import { io, Socket } from "socket.io-client";
import { twMerge } from "tailwind-merge";
import {
  ChatMessage,
  config,
  ConsumerResult,
  Peer,
  sortAndBundleMessages,
  webRtcTransportParams,
  WebSocketEventType,
} from "../../config/config";
import Avvvatars from "avvvatars-react";
import moment from "moment";
import { Dialog } from "@mui/material";
import { RxCross2 } from "react-icons/rx";
import { get_messages_chats_fromRedis } from "../../features/server_calls/get_message_redis";
import { post_message_toRedis } from "../../features/server_calls/post_message_redis";
import { MediaKind, RtpCapabilities } from "mediasoup-client/lib/RtpParameters";
import { Device } from "mediasoup-client";
import { Consumer, Transport } from "mediasoup-client/lib/types";
import { mergeData, MergedData } from "../../config/helpers/helpers";

export interface ProducerContainer {
  producer_id: string;
  userId: string;
}

export interface RemoteStream {
  consumer: Consumer;
  stream: MediaStream;
  kind: MediaKind;
  producerId: string;
}

const RoomIndex = () => {
  const { roomId, name } = useParams();
  const [IsVideoOn, setVideoOn] = useState(false);
  const [IsMicOn, setMicOn] = useState(false);
  const [IsWhiteBoardActive, setIsWhiteBoardActive] = useState(false);
  const [IsChatActive, setIsChatActive] = useState(false);
  const [showPeople, setShowPeople] = useState(false);
  const [usersInRoom, setUsersInRoom] = useState<Peer[]>([]);
  const [roomChatValue, setRoomChatValue] = useState<string | null>(null);
  const [roomChat, setRoomChat] = useState<ChatMessage[]>([]);
  const [remoteStreams, setRemoteStreams] = useState<RemoteStream[]>([]);
  const [producers, setProducers] = useState<ProducerContainer[]>([]);

  const socketRef = useRef<Socket | null>(null);
  const DeviceRef = useRef<Device | null>(null);
  const ProducerRef = useRef<Transport | null>(null);
  const ConsumerRef = useRef<Transport | null>(null);
  const consumers = useRef<Map<string, Consumer>>(new Map());

  useEffect(() => {
    const socket = io(config.ws.url);
    socket.on("connect", () => {
      socketRef.current = socket;
      loadEverything();

      socket.onAny((event, args) => {
        routeIncommingEvents({ event, args });
      });
    });

    window.addEventListener("beforeunload", beforeunload);

    return () => {
      beforeunload();
      socket.disconnect();
    };
  }, [name, roomId]);

  useEffect(() => {
    getChatsFromServer();
  }, [name, roomId, IsChatActive]);

  useEffect(() => {
    if (IsVideoOn || IsMicOn) {
      produce();
    }
  }, [IsVideoOn, IsMicOn]);

  useEffect(() => {
    producers.forEach((producer) => {
      consume(producer.producer_id);
    });
  }, [producers, roomId, name]);

  const getChatsFromServer = async () => {
    const data = await get_messages_chats_fromRedis(roomId!);
    console.log(data);

    if (data?.chats) {
      setRoomChat(data.chats);
    } else {
      setRoomChat([]);
    }
  };
  const routeIncommingEvents = ({
    event,
    args,
  }: {
    event: WebSocketEventType;
    args: any;
  }) => {
    switch (event) {
      case WebSocketEventType.USER_JOINED:
        userJoined(args);
        break;

      case WebSocketEventType.USER_LEFT:
        userLeft(args);
        break;

      case WebSocketEventType.USER_CHAT:
        changeRoomChat(args);
        break;

      case WebSocketEventType.NEW_PRODUCERS:
        newProducers(args);
        break;

      default:
        break;
    }
  };

  const updateProducers = () => {};

  const newProducers = (args: ProducerContainer[]) => {
    console.log(args);

    setProducers((v) => [...v, ...args]);
  };

  const getProducers = async () => {
    const producers = (await sendRequest(
      WebSocketEventType.GET_PRODUCERS,
      {}
    )) as ProducerContainer[];
    setProducers(producers);
  };

  const userLeft = (args: any) => {
    const user = args.user as Peer;
    setUsersInRoom((v) => v.filter((peer) => peer.id !== user.id));
  };
  const userJoined = (args: any) => {
    const user = args.user as Peer;
    setUsersInRoom((v) => [...v, user]);
  };

  const changeRoomChat = (args: ChatMessage) => {
    console.log(args);

    setRoomChat((v) => [
      ...v,
      { ...args, createdAt: new Date(args.createdAt) },
    ]);
  };

  const beforeunload = async () => {
    await sendRequest(WebSocketEventType.EXIT_ROOM, {});
    socketRef.current?.disconnect();
  };

  const loadEverything = async () => {
    await createRoom();
    await joinRoom();
    await getCurrentUsers();
    await getRouterRTPCapabilties();
    await createConsumerTransport();
    await getProducers();
    await createProducerTransport();
  };

  const createRoom = async () => {
    await sendRequest(WebSocketEventType.CREATE_ROOM, { roomId });
  };
  const joinRoom = async () => {
    const resp = (await sendRequest(WebSocketEventType.JOIN_ROOM, {
      roomId,
      name,
    })) as { message: string };
    console.info(resp.message);
  };
  const getCurrentUsers = async () => {
    const users = (await sendRequest(
      WebSocketEventType.GET_IN_ROOM_USERS,
      {}
    )) as { users: Peer[] };
    setUsersInRoom(users.users);
  };

  const getRouterRTPCapabilties = async () => {
    const rtp = (await sendRequest(
      WebSocketEventType.GET_ROUTER_RTP_CAPABILITIES,
      {}
    )) as RtpCapabilities;
    if (!rtp) {
      console.error("Couldn't get RTP for device");
      return;
    }
    await loadDevice(rtp);
    return;
  };

  const loadDevice = async (rtp: RtpCapabilities) => {
    if (socketRef.current && !DeviceRef.current) {
      const device = new Device();
      await device.load({ routerRtpCapabilities: rtp });
      DeviceRef.current = device;
      console.log("--- Device Loaded successfully with RTP capabilities ---");
      return;
    } else {
      console.error(
        "Couldn't load device. check socket or theres current active device"
      );
      return;
    }
  };

  const createProducerTransport = async () => {
    if (DeviceRef.current && socketRef.current) {
      console.log("resp");

      const resp = (await sendRequest(
        WebSocketEventType.CREATE_WEBRTC_TRANSPORT,
        {
          forceTcp: false,
          rtpCapabilities: DeviceRef.current.rtpCapabilities,
        }
      )) as { params: webRtcTransportParams };
      console.log(resp);

      ProducerRef.current = DeviceRef.current.createSendTransport(resp.params);

      console.log("--- CREATE PRODUCER TRANSPORT ---");

      if (ProducerRef.current) {
        try {
          ProducerRef.current.on("connect", ({ dtlsParameters }, cb, eb) => {
            sendRequest(WebSocketEventType.CONNECT_TRANSPORT, {
              transport_id: ProducerRef.current!.id,
              dtlsParameters,
            })
              .then(cb)
              .catch(eb);
          });

          ProducerRef.current.on(
            "produce",
            async ({ kind, rtpParameters }, cb, eb) => {
              try {
                const { producer_id } = (await sendRequest(
                  WebSocketEventType.PRODUCE,
                  {
                    producerTransportId: ProducerRef.current!.id,
                    kind,
                    rtpParameters,
                  }
                )) as { producer_id: string };

                console.log(producer_id);

                cb({ id: producer_id });
              } catch (error) {
                console.log(error);

                eb(new Error(String(error)));
              }
            }
          );

          ProducerRef.current.on("connectionstatechange", (state) => {
            console.log(state);
            switch (state) {
              case "disconnected":
                console.log("Producer disconnected");
                break;
            }
          });

          return true;
        } catch (error) {
          console.log("Producer Creation error :: ", error);
        }
      }
    }
  };

  const createConsumerTransport = async () => {
    if (ConsumerRef.current) {
      console.log("Already initialized a consumer transport");
      return;
    }
    try {
      const data = (await sendRequest(
        WebSocketEventType.CREATE_WEBRTC_TRANSPORT,
        { forceTcp: false }
      )) as { params: webRtcTransportParams };

      if (!data) {
        throw new Error("No Transport created");
      }
      console.log("Consumer Transport :: ", data);
      if (!DeviceRef.current || !socketRef.current) {
        console.error("No devie or socket found");
        return;
      }
      ConsumerRef.current = DeviceRef.current.createRecvTransport(data.params);

      ConsumerRef.current.on("connect", async ({ dtlsParameters }, cb, eb) => {
        sendRequest(WebSocketEventType.CONNECT_TRANSPORT, {
          transport_id: ConsumerRef.current!.id,
          dtlsParameters,
        })
          .then(cb)
          .catch(eb);
      });

      ConsumerRef.current.on("connectionstatechange", (state) => {
        console.log("Consumer state", state);
        if (state === "connected") {
          console.log("--- Connected Consumer Transport ---");
        }
        if (state === "disconnected") {
          ConsumerRef.current?.close();
        }
      });

      const producers = (await sendRequest(
        WebSocketEventType.GET_PRODUCERS,
        {}
      )) as { producer_id: string }[];
    } catch (error) {
      console.log("error creating consumer transport", error);
    }
  };

  const produce = useCallback(async () => {
    if (!ProducerRef.current) {
      console.log("Producer transport not initialized");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: IsVideoOn,
        audio: IsMicOn,
      });

      const videoTrack = stream.getVideoTracks()[0];
      const audioTrack = stream.getAudioTracks()[0];

      if (IsVideoOn) {
        await ProducerRef.current.produce({ track: videoTrack });
      }

      if (IsMicOn) {
        await ProducerRef.current.produce({ track: audioTrack });
      }
    } catch (error) {
      console.error("Error in producing media", error);
      return;
    }
  }, [IsVideoOn, IsMicOn]);

  function sendRequest(type: WebSocketEventType, data: any) {
    return new Promise((resolve, reject) => {
      if (!socketRef.current) {
        alert("No socket state active");
        return;
      }
      socketRef.current.emit(type, data, (response: any, err: any) => {
        if (!err) {
          resolve(response);
        } else {
          reject(err);
        }
      });
    });
  }

  const sendRoomChat = (msg: ChatMessage) => {
    if (msg.data && roomId) {
      sendRequest(WebSocketEventType.USER_CHAT, {
        ...msg,
        data: msg.data,
      });
      setRoomChatValue(null);
      post_message_toRedis(msg, roomId);
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
        setRemoteStreams((v) => [...v, data]);
      }
    });
  };

  const getConsumerStream = async (producerId: string) => {
    if (!DeviceRef.current) {
      console.log("No device found");
      return;
    }
    if (!ConsumerRef.current) {
      console.warn("No current consumer transport");
      return;
    }
    const rtpCapabilities = DeviceRef.current.rtpCapabilities;
    const data = (await sendRequest(WebSocketEventType.CONSUME, {
      rtpCapabilities,
      consumerTransportId: ConsumerRef.current.id,
      producerId,
    })) as ConsumerResult;

    const { id, kind, rtpParameters } = data;
    let codecOptions = {};

    const consumer = await ConsumerRef.current.consume({
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
      producerId,
    };
  };

  return (
    <div className="h-screen w-screen bg-dark flex flex-col overflow-hidden text-white p-0">
      <div className="h-[100vh] w-full flex justify-center items-center p-1 ">
        <div className="h-full w-[5vw] flex flex-col justify-center items-center gap-3 transition-all">
          <div
            onClick={() => setVideoOn((v) => !v)}
            className={twMerge(
              " transition-all h-[3rem] w-[3rem] border-2 bg-white hover:bg-white/85 cursor-pointer text-gradient-to-r from-blue-500 to-blue-700 text-blue-500 text-xl flex justify-center items-center rounded-full",
              !IsVideoOn && "text-red-600"
            )}
          >
            {IsVideoOn ? <FaVideo /> : <FaVideoSlash />}
          </div>
          <div
            onClick={() => setMicOn((v) => !v)}
            className={twMerge(
              " transition-all h-[3rem] w-[3rem] border-2 bg-white hover:bg-white/85 cursor-pointer text-gradient-to-r from-blue-500 to-blue-700 text-blue-500 text-xl flex justify-center items-center rounded-full",
              !IsMicOn && "text-red-600"
            )}
          >
            {IsMicOn ? <TbMicrophoneFilled /> : <TbMicrophoneOff />}
          </div>
          <div
            onClick={() => setIsChatActive((v) => !v)}
            className={twMerge(
              " transition-all h-[3rem] w-[3rem] border-2 bg-white hover:bg-white/85 cursor-pointer hover:text-blue-600  text-black text-2xl flex justify-center items-center rounded-full",
              IsChatActive && "text-blue-600"
            )}
          >
            <PiChatsTeardropDuotone />
          </div>
          <div
            onClick={() => setIsWhiteBoardActive((v) => !v)}
            className={twMerge(
              " transition-all h-[3rem] w-[3rem] border-2 bg-white hover:bg-white/85 cursor-pointer hover:text-blue-600 text-black text-2xl flex justify-center items-center rounded-full",
              IsWhiteBoardActive && "text-blue-600"
            )}
          >
            <PiTelevisionSimple />
          </div>
          <div
            onClick={() => setShowPeople((v) => !v)}
            className={twMerge(
              "relative  transition-all h-[3rem] w-[3rem] border-2 bg-white hover:bg-white/85 cursor-pointer hover:text-blue-600 text-black text-2xl flex justify-center items-center rounded-full",
              showPeople && "text-blue-600"
            )}
          >
            <BsPeopleFill />
            <p className="h-5 w-5  flex items-center justify-center absolute -right-1 -top-1 text-sm bg-red-500 p-1 font-medium text-white rounded-full">
              {usersInRoom.length}
            </p>
          </div>
        </div>
        <UserCarousel
          usersInRoom={usersInRoom}
          remoteStreams={remoteStreams}
          producerContainer={producers}
        />
        <Dialog open={IsChatActive}>
          <div className="h-[35vw] w-[60vh] bg-black/95 text-white/80 flex py-2  flex-col items-center justify-center">
            <div className="h-[10%] w-full flex justify-between items-center px-7">
              <p className="font-poppins text-2xl font-semibold ">Chat</p>
              <p
                className="text-white/60 hover:text-white text-xl cursor-pointer"
                onClick={() => setIsChatActive(false)}
              >
                <RxCross2 />
              </p>
            </div>
            <div className="h-[90%] w-full px-7 flex flex-col items-center justify-center">
              <div className="h-[93%] w-full py-2">
                {roomChat && (
                  <RoomChat
                    roomChat={roomChat}
                    userId={socketRef.current?.id!}
                  />
                )}
              </div>
              <div className="h-[7%] w-full  flex justify-center items-center gap-3">
                <input
                  onKeyDown={(event: React.KeyboardEvent<HTMLInputElement>) => {
                    if (event.key === "Enter") {
                      const message = {
                        user: { id: socketRef.current!.id!, name: name! },
                        data: roomChatValue,
                        createdAt: new Date(),
                      };
                      if (message.data !== null) {
                        //@ts-ignore
                        setRoomChat((v) => [...v, message]);
                        //@ts-ignore
                        sendRoomChat(message);
                      }
                    }
                  }}
                  value={roomChatValue || ""}
                  onChange={(e) => {
                    setRoomChatValue(e.target.value);
                  }}
                  placeholder="Enter your message here"
                  className="placeholder:italic focus:border-2 focus:border-blue-500/30 placeholder:text-white/60 p-2 text-[1rem] outline-none border h-full w-[80%] border-white/50  focus-within:ring-[1.5px] focus:ring-blue-600 rounded-md bg-transparent  text-white/80"
                />
                <button
                  onClick={() => {
                    const message = {
                      user: { id: socketRef.current!.id!, name: name! },
                      data: roomChatValue?.trim(),
                      createdAt: new Date(),
                    };
                    if (message.data !== null) {
                      // @ts-ignore
                      setRoomChat((v) => [...v, message]);
                      // @ts-ignore
                      sendRoomChat(message);
                    }
                  }}
                  className="w-[15%] h-full bg-white/90 rounded-md text-black font-poppins font-medium hover:bg-white/70"
                >
                  Send
                </button>
              </div>
            </div>
          </div>
        </Dialog>
      </div>
    </div>
  );
};

const RoomChat = ({
  roomChat,
  userId,
}: {
  roomChat: ChatMessage[];
  userId: string;
}) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const bundledChat = sortAndBundleMessages(roomChat);

  const scrollToBottom = () => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  };

  useEffect(() => {
    scrollToBottom();
  }, [roomChat]);
  return (
    <div
      ref={scrollRef}
      className="h-full w-full  flex flex-col overflow-y-scroll overflow-x-hidden chatScrollBar "
    >
      {bundledChat &&
        bundledChat.map((bundle, index) => (
          <div
            key={index}
            className="flex flex-col gap-2 items-start justify-center mb-3"
          >
            <div className=" flex justify-start items-center gap-2">
              <Avvvatars value={bundle.user.name} size={22} />
              <div className="flex flex-col justify-center items-start">
                <p
                  className={twMerge(
                    bundle.user.id === userId && "text-pink-500"
                  )}
                >
                  {bundle.user.id === userId ? "You" : bundle.user.name}
                </p>
                <p className="text-[9px] text-white/60 h-full  flex items-center justify-end">
                  {moment(bundle.messages[0].createdAt).format("LT")}
                </p>
              </div>
            </div>

            <div className="flex w-full flex-col ml-5">
              {bundle.messages.map((chat, index) => (
                <div
                  key={index}
                  className={
                    "h-auto w-full px-2 flex items-center justify-start mb-1"
                  }
                >
                  <div className="bg-blue-700 py-[3px] text-white w-auto inline-block pl-2 pr-4 rounded-md font-sans">
                    <p className="text-[1rem]">{chat.data}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
    </div>
  );
};

const UserCarousel = ({
  usersInRoom,
  remoteStreams,
  producerContainer,
}: {
  usersInRoom: Peer[];
  remoteStreams: RemoteStream[];
  producerContainer: ProducerContainer[];
}) => {
  const users = mergeData(usersInRoom, remoteStreams, producerContainer);
  console.log("USERS", users);

  return (
    <div className="h-full w-[95vw] p-3 overflow-hidden flex flex-wrap items-center justify-center gap-4">
      {users.map((user) => (
        <div
          key={user.userId}
          className={twMerge(
            "overflow-hidden relative h-[40vh] w-[40vw] border border-white/30 bg-black/10 rounded-xl p-2 flex justify-center items-center"
          )}
        >
          {user.producers.length <= 0 ? (
            <>
              <p className="absolute left-0 bottom-0 text-lg p-2 px-3 w-auto h-auto bg-black/20">
                {user.name}
              </p>
              <Avvvatars value={user.name} size={95} />
            </>
          ) : (
            <MemoizedUserPannel user={user} />
          )}
        </div>
      ))}
      {}
    </div>
  );
};

const UserPannel = ({ user }: { user: MergedData }) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    user.producers.forEach((producer) => {
      if (producer.kind === "video") {
        if (videoRef.current) {
          videoRef.current.srcObject = producer.stream;
          videoRef.current.play();
          videoRef.current.volume = 0;
          videoRef.current.autoplay = true;
        }
      }
      
    });
  }, [user]);

  return (
    <div className="h-full w-full">
      <video ref={videoRef} autoPlay playsInline className="h-full w-full" />
    </div>
  );
};

const MemoizedUserPannel = memo(UserPannel);

export default RoomIndex;
