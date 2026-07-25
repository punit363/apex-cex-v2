import dotenv from "dotenv";
import path from "path";
dotenv.config({ path: path.resolve(__dirname, "../../.env") });

import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser"
import router from "./routes/routes";

const app = express();
app.use(
  cors({
    origin: process.env.CORS_ACCEPTED_ENDPOINT, 
    credentials: true,              
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "access_token", "refresh_token"],
  })
);
app.use(cookieParser());
app.use(express.json());
app.use("/api/v1", router);

app.listen(process.env.API_PORT, () => {
  console.log("listening app on port", process.env.API_PORT);
});
