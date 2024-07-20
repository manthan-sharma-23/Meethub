import { BrowserRouter, Route, Routes } from "react-router-dom";
import HomeIndex from "./views/home/Index";
import RoomIndex from "./views/conference";

const App = () => {
  return (
    <div className="h-screen w-screen">
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<HomeIndex />} />
          <Route path="/r/:roomId/u/:name" element={<RoomIndex />} />
        </Routes>
      </BrowserRouter>
    </div>
  );
};

export default App;
