import jwt, { SignOptions, JwtPayload } from "jsonwebtoken";

const ACCESS_TOKEN_SECRET = process.env.ACCESS_TOKEN_SECRET;
const REFRESH_TOKEN_SECRET = process.env.REFRESH_TOKEN_SECRET;

if (!ACCESS_TOKEN_SECRET) throw new Error("ACCESS_TOKEN_SECRET is not defined");
if (!REFRESH_TOKEN_SECRET)
  throw new Error("REFRESH_TOKEN_SECRET is not defined");

const ACCESS_TOKEN_EXPIRES_IN = (process.env.ACCESS_TOKEN_EXPIRES_IN ??
  "1h") as SignOptions["expiresIn"];
  const REFRESH_TOKEN_EXPIRES_IN = (process.env.REFRESH_TOKEN_EXPIRES_IN ??
    "7d") as SignOptions["expiresIn"];

const generateToken = (
  userId: string,
  secret: string,
  expiresIn: SignOptions["expiresIn"]
): string => {
  return jwt.sign({ user_id: userId }, secret, { expiresIn });}

const verifyToken = (token: string, secret: string): JwtPayload | string =>
  jwt.verify(token, secret);

const generateAccessToken = (userId: string) =>
  generateToken(userId, ACCESS_TOKEN_SECRET, ACCESS_TOKEN_EXPIRES_IN);
const generateRefreshToken = (userId: string) =>
  generateToken(userId, REFRESH_TOKEN_SECRET, REFRESH_TOKEN_EXPIRES_IN);
const verifyAccessToken = (token: string): any =>
  verifyToken(token, ACCESS_TOKEN_SECRET);
const verifyRefreshToken = (token: string): any =>
  verifyToken(token, REFRESH_TOKEN_SECRET);

export {
  generateAccessToken,
  generateRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
};
