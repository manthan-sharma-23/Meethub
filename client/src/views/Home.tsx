import { Button, TextField } from "@mui/material";
import React, { useState } from "react";
import { RoomDetails } from "../config/types";
import { useNavigate } from "react-router-dom";

const Home = () => {
  const [details, setDetails] = useState<Partial<RoomDetails>>({
    roomId: "1234",
    name: "user1234",
  });
  const navigate = useNavigate();

  const handleJoinRoom = () => {
    if (!details.name || !details.roomId) {
      alert("Fill Complete details");
      return;
    }
    navigate(`/r/${details.roomId}/u/${details.name}`);
  };

  return (
    <div className="h-screen w-screen bg-white text-black flex flex-col  items-start justify-center p-10 gap-7 px-[5rem]">
      <div className="text-7xl text-black font-bold w-1/2">
        Join or Create a Room
      </div>
      <div className="w-1/2 h-auto flex gap-3">
        <TextField
          value={details.roomId}
          placeholder="Enter Room ID"
          label="Room ID"
          onChange={(e) => {
            setDetails((v) => ({ ...v, roomId: e.target.value }));
          }}
        />
        <TextField
          value={details.name}
          placeholder="Enter your meeting name"
          label="Name"
          onChange={(e) => {
            setDetails((v) => ({ ...v, name: e.target.value }));
          }}
        />
        <Button
          variant="contained"
          size="large"
          sx={{ fontSize: "1rem" }}
          onClick={handleJoinRoom}
        >
          Join
        </Button>
      </div>
    </div>
  );
};

export default Home;
