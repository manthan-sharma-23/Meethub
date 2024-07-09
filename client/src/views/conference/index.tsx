import { useEffect, useRef, useState } from "react";
import { BsPeopleFill } from "react-icons/bs";
import { FaVideo } from "react-icons/fa";
import { FaVideoSlash } from "react-icons/fa6";
import { PiChatsTeardropDuotone, PiTelevisionSimple } from "react-icons/pi";
import { TbMicrophoneFilled, TbMicrophoneOff } from "react-icons/tb";
import { useParams } from "react-router-dom";
import { io, Socket } from "socket.io-client";
import { twMerge } from "tailwind-merge";
import { config, Peer, WebSocketEventType } from "../../config/config";
import Slider from "react-slick";
import Avvvatars from "avvvatars-react";

import "slick-carousel/slick/slick.css";
import "slick-carousel/slick/slick-theme.css";
import { Dialog } from "@mui/material";
import { RxCross2 } from "react-icons/rx";

const RoomIndex = () => {
  const { roomId, name } = useParams();
  const [IsVideoOn, setVideoOn] = useState(false);
  const [IsMicOn, setMicOn] = useState(false);
  const [IsWhiteBoardActive, setIsWhiteBoardActive] = useState(false);
  const [IsChatActive, setIsChatActive] = useState(false);
  const [showPeople, setShowPeople] = useState(false);
  const [usersInRoom, setUsersInRoom] = useState<Peer[]>([]);
  //references
  const socketRef = useRef<Socket | null>(null);

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

      default:
        break;
    }
  };

  const userLeft = (args: any) => {
    const user = args.user as Peer;
    setUsersInRoom((v) => v.filter((peer) => peer.id !== user.id));
  };
  const userJoined = (args: any) => {
    const user = args.user as Peer;
    setUsersInRoom((v) => [...v, user]);
  };

  const beforeunload = async () => {
    await sendRequest(WebSocketEventType.EXIT_ROOM, {});
    socketRef.current?.disconnect();
  };

  const loadEverything = async () => {
    await createRoom();
    await joinRoom();
    await getCurrentUsers();
  };

  const createRoom = async () => {
    await sendRequest(WebSocketEventType.CREATE_ROOM, { roomId });
  };
  const joinRoom = async () => {
    const resp = await sendRequest(WebSocketEventType.JOIN_ROOM, {
      roomId,
      name,
    });
    console.log(resp);
  };
  const getCurrentUsers = async () => {
    const users = (await sendRequest(
      WebSocketEventType.GET_IN_ROOM_USERS,
      {}
    )) as { users: Peer[] };
    setUsersInRoom(users.users);
  };

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
              " transition-all h-[3rem] w-[3rem] border-2 bg-white hover:bg-white/85 cursor-pointer hover:text-blue-600 text-black text-2xl flex justify-center items-center rounded-full",
              showPeople && "text-blue-600"
            )}
          >
            <BsPeopleFill />
          </div>
        </div>
        <UserCarousel usersInRoom={usersInRoom} />
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
            <div className="h-[90%] w-full px-7"></div>
          </div>
        </Dialog>
      </div>
    </div>
  );
};

const UserCarousel = ({ usersInRoom }: { usersInRoom: Peer[] }) => {
  return (
    <div className="h-full w-[95vw] p-3 overflow-hidden flex flex-wrap items-center justify-center gap-4">
      {usersInRoom.map((user) => (
        <div
          key={user.id}
          className=" overflow-hidden relative h-[40vh] w-[40vw] border border-white/30 bg-black/10 rounded-xl p-2 flex justify-center items-center"
        >
          <p className="absolute left-0 bottom-0 text-lg p-2 px-3 w-auto h-auto bg-black/20">
            {user.name}
          </p>
          <Avvvatars value={user.name} size={95} />
        </div>
      ))}
    </div>
  );
};

export default RoomIndex;
