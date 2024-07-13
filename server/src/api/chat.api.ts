import { Router } from "express";
import { RedisService } from "../services/RedisService";
import { ChatMessage } from "../services/SocketService";

const router: Router = Router();

const instance = new RedisService();
const redis = instance.getInstance();

router.get("/chats", async (req, res) => {
  try {
    const roomId = req.headers.roomid;
    console.log(req.headers, roomId);

    const data = await redis.get("chat_" + roomId);

    return res.json({ chats: JSON.parse(data || "[]") });
  } catch (error) {
    console.log(error);
  }
});

router.post("/chat", async (req, res) => {
  try {
    console.log(req.body);

    const msg = req.body as ChatMessage;

    let resp = await redis.get("chat_" + req.body.roomId);
    if (resp) {
      let data = JSON.parse(resp) as ChatMessage[];
      data = [...data, msg];

      await redis.set(
        "chat_" + req.body.roomId,
        JSON.stringify(data),
        "EX",
        2 * 60 * 60
      );
    } else {
      let data = [msg];

      await redis.set(
        "chat_" + req.body.roomId,
        JSON.stringify(data),
        "EX",
        2 * 60 * 60
      );
    }

    return res.send("Message uploaded");
  } catch (error) {
    console.log(error);
  }
});

router.get("/test", (req, res) => {
  return res.send({ test: "In Working condition" });
});

export default router;
