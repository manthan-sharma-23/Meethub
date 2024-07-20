import { ChatMessage, config } from "../../config/config";

export const post_message_toRedis = async (
  msg: ChatMessage,
  roomId: string,
) => {
  try {
    await fetch(config.server.url + "/api/chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        ...msg,
        roomId,
      }),
    });
  } catch (error) {
    console.log(error);
  }
};
