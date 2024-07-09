import { ChatMessage, config } from "../../config/config";

export const get_messages_chats_fromRedis = async (roomId: string) => {
  try {
    const rep = await fetch(config.server.url + "/api/chats", {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        roomid: roomId,
      },
    });

    const data = ((await rep.json()) || []) as { chats: ChatMessage[] };
    return data;
  } catch (error) {
    console.log(error);
    return null;
  }
};
