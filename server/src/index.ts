import express from "express";
import cors from "cors";
import http from "http";
import { config } from "./config/config";
import { Worker } from "mediasoup/node/lib/Worker";
import * as mediasoup from "mediasoup";
import { SocketService } from "./services/SocketService";
import ChatRouter from "./api/chat.api";

const app = express();
app.use(cors({
  origin: "*",  
}));
app.use(express.json());

app.get('/', (req, res) => {
  res.redirect('/api/test');
});

app.use("/api", ChatRouter);

let workers: Worker[] = [];
export let nextMediasoupWorkerIdx = 0;

(async () => {
  await createWorkers();
})();

async function createWorkers() {
  let { numWorkers } = config.mediasoup;
  for (let i = 0; i < numWorkers; i++) {
    let worker = await mediasoup.createWorker({
      logLevel: config.mediasoup.worker.logLevel,
      logTags: config.mediasoup.worker.logTags,
      rtcMinPort: config.mediasoup.worker.rtcMinPort,
      rtcMaxPort: config.mediasoup.worker.rtcMaxPort,
    });
    worker.on("died", () => {
      console.error(
        "mediasoup worker died, exiting in 2 seconds... [pid:%d]",
        worker.pid
      );
      setTimeout(() => process.exit(1), 2000);
    });
    workers.push(worker);
  }
}

const httpServer = http.createServer(app);
new SocketService(httpServer);

httpServer.listen(config.app.port, () => {
  console.log(`Server running on port ${config.app.port}`);
});

export function getMediasoupWorker() {
  const worker = workers[nextMediasoupWorkerIdx];
  if (++nextMediasoupWorkerIdx === workers.length) nextMediasoupWorkerIdx = 0;
  return worker;
}
