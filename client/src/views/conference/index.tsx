import { useEffect, useRef, useState } from "react";
import { BsPeopleFill } from "react-icons/bs";
import { FaVideo } from "react-icons/fa";
import { FaVideoSlash } from "react-icons/fa6";
import { PiChatsTeardropDuotone, PiTelevisionSimple } from "react-icons/pi";
import { TbMicrophoneFilled, TbMicrophoneOff } from "react-icons/tb";
import { useParams } from "react-router-dom";
import { io, Socket } from "socket.io-client";
import { twMerge } from "tailwind-merge";
import { config } from "../../config/config";

const RoomIndex = () => {
  const { roomId, name } = useParams();
  const [IsVideoOn, setVideoOn] = useState(false);
  const [IsMicOn, setMicOn] = useState(false);
  const [IsWhiteBoardActive, setIsWhiteBoardActive] = useState(false);
  const [IsChatActive, setIsChatActive] = useState(false);
  const [showPeople, setShowPeople] = useState(false);

  //references
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    const socket = io(config.ws.url);
    socket.on("connect", () => {
      socketRef.current = socket;
      socket.emit("change", { new: "new" });
      socket.on("message", (msg) => {
        console.log(msg);
      });
    });
  }, []);

  const loadEverything = () => {};

  const createRoom = () => {};

  return (
    <div className="h-screen w-screen bg-dark flex flex-col overflow-hidden text-white p-0">
      <div className="font-mono font-bold text-lg h-[6vh] w-full flex justify-center items-center shadow-sm drop-shadow-sm shadow-white">
        {roomId}
      </div>
      <div className="h-[94vh] w-full flex justify-center items-center p-1 ">
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
        <div className="h-full w-[95vw]"></div>
      </div>
    </div>
  );
};

export default RoomIndex;
