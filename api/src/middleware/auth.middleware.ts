import { Request, Response, NextFunction } from "express";
import { verifyAccessToken, verifyRefreshToken } from "../utils/auth.utils.js";
import { JwtPayload } from "jsonwebtoken";

declare module "express-serve-static-core" {
  interface Request {
    user_id?: string;
  }
}

export const authMiddleware = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    let accessToken: string | undefined = undefined;
    const accessAuthHeader = req.headers.access_token as string;

    if (accessAuthHeader && accessAuthHeader.startsWith("Bearer ")) {
      accessToken = accessAuthHeader.split(" ")[1];
    } else if (req.cookies?.access_token) {
      accessToken = req.cookies.access_token;
    }
    if (!accessToken) {
      res.status(401).json({ message: "Unauthorized: missing access token" });
      return;
    }

    const payload = verifyAccessToken(accessToken) as JwtPayload;

    if (!payload.user_id) {
      res.status(401).json({ message: "Unauthorized: invalid token payload" });
      return;
    }

    req.user_id = payload.user_id;
    next();
  } catch (refreshErr: any) {
    if (refreshErr.message === "Token has expired") {
      res.status(401).json({ message: "Session expired: please log in again" });
      return;
    }
    res.status(401).json({ message: "Unauthorized: invalid refresh token" });
  }
};
