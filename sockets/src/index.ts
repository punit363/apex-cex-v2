//@ts-ignore
import { WebSocketServer } from "ws";
import RedisHandler from "./redis";
import { CONFIG } from "./config";

const wss = new WebSocketServer({ port:CONFIG.WS_PORT});

wss.on("connection", (ws: any) => {
  console.log("🟢 Client connected to WS");

  ws.on("message", async (message: any) => {
    const data = JSON.parse(message.toString());

    const redis = await RedisHandler.createInstance();

    if (data.action === "SUBSCRIBE") {
      const market = data.market; 

      if (data.type === "BOOK") {
        redis.subscribeToOrderbook(market, (book_data) => {
          ws.send(JSON.stringify(book_data));
        });
      }

      if (data.type === "TRADE") {
        redis.subscribeToTrade(market, (trade_data) => {
          ws.send(JSON.stringify(trade_data));
        });
      }

      if (data.type === "TICKER") {
        redis.subscribeToTicker(market, (ticker_data) => {
          ws.send(JSON.stringify(ticker_data));
        });
      }

      if (data.type === "ORDER") {
        redis.subscribeToOrder(market, (order_data) => {
          ws.send(JSON.stringify(order_data));
        });
      }
    }
  });
});
