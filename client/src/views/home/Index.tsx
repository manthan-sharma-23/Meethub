import { useState } from "react";
import cuid from "cuid";
import { useNavigate } from "react-router-dom";
import { Button, TextField } from "@mui/material";
import lander from "../../assets/icon.png";

const HomeIndex = () => {
  const [roomId, setRoomId] = useState(cuid());
  const [name, setName] = useState<string | null>(null);
  const navigate = useNavigate();

  const EnterRoom = () => {
    if (!roomId) {
      alert("Please Enter RoomId");
      return;
    }
    if (!name) {
      alert("Please Enter your name");
      return;
    }
    navigate(`/r/${roomId}/u/${name}`);
  };

  const onKeyEnter = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Enter") {
      EnterRoom();
    }
  };

  return (
    <div className="bg-white text-white h-screen w-screen flex flex-col gap-5 justify-center p-[3rem] items-center">
      <div className=" text-black flex justify-center items-center gap-2">
        <img src={lander} className="h-[2.5rem] w-[2.5rem]" />
        <p className="text-4xl text-blue/90 font-semibold font-poppins">
          Meethub
        </p>
      </div>
      <div className="w-[30vw] h-[45vh] rounded-lg bg-yellow-50/10 border flex justify-center items-center">
        <div className="flex flex-col justify-center items-center  text-2xl w-[60%] gap-5  ">
          <p className="font-semibold text-blue-600">Create or Join Room</p>
          <div className="flex justify-center h-auto items-center w-full gap-3">
            <TextField
              onKeyDown={(e) => onKeyEnter(e)}
              type="text"
              value={roomId}
              fullWidth
              onChange={(e) => setRoomId(e.target.value)}
              placeholder="Enter your roomId"
              label="RoomId"
            />
          </div>
          <TextField
            onKeyDown={(e) => onKeyEnter(e)}
            type="text"
            value={name || ""}
            fullWidth
            onChange={(e) => setName(e.target.value)}
            placeholder="Enter your name"
            label="Name"
          />
          <Button
            onClick={EnterRoom}
            variant="contained"
            size="medium"
            sx={{ fontWeight: 600, fontSize: ".9rem" }}
          >
            Join
          </Button>
        </div>
      </div>
    </div>
  );
};

export default HomeIndex;
