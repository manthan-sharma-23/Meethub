import { useState } from "react";
import cuid from "cuid";
import { useNavigate } from "react-router-dom";

const HomeIndex = () => {
  const [roomId, setRoomId] = useState(cuid());
  const [name, setName] = useState("");
  const navigate = useNavigate();
  return (
    <div className="bg-dark text-white h-screen w-screen flex justify-start p-[3rem] items-center">
      <div className="flex flex-col justify-center items-start  text-2xl min-w-[40%] gap-5">
        <p className="font-semibold">Create or Join Room</p>
        <input
          type="text"
          value={roomId}
          onChange={(e) => setRoomId(e.target.value)}
          className="outline-none text-lg text-black p-2 rounded-lg w-full"
          placeholder="Enter your roomId"
        />
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="outline-none text-lg text-black p-2 rounded-lg w-full"
          placeholder="Enter your name"
        />
        <button
          onClick={() => navigate(`/r/${roomId}/u/${name}`)}
          className="bg-white text-black p-2 w-[7rem] rounded-full text-lg flex items-center justify-center hover:bg-white/80 transition-all"
        >
          Join
        </button>
      </div>
    </div>
  );
};

export default HomeIndex;
