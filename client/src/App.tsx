import React from "react";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import Home from "./views/Home";
import Room from "./views/Room";

const App = () => {
  return (
    <div>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/r/:roomId/u/:name" element={<Room />} />
        </Routes>
      </BrowserRouter>
    </div>
  );
};

export default App;
