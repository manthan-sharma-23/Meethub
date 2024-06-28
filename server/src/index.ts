import express from "express";
import cors from "cors";
import http from "http";
import { config } from "./config/config";

const app = express();
app.use(cors());

const httpServer = http.createServer(app);

httpServer.listen(config.app.port, () => {
  console.log(`Server running on port ${config.app.port}`);
});
