import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser"
import router from "./routes/routes";
import { CONFIG } from "./config/config";

const app = express();
app.use(
  cors({
    origin: CONFIG.CORS_ACCEPTED_ENDPOINT, 
    credentials: true,              
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "access_token", "refresh_token"],
  })
);
app.use(cookieParser());
app.use(express.json());
app.use("/api/v1", router);

app.listen(CONFIG.API_PORT, () => {
  console.log("listening app on port", CONFIG.API_PORT);
});
