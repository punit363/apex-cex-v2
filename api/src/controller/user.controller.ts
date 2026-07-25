import { Request, Response } from "express";
import { generateTransactionId, generateUserId } from "../utils";
import { EngineResponse, UserData } from "../types/types";
import bcrypt from "bcrypt";
import { prisma, UserRepo } from "@exchange/db";
import RedisHandler from "../redis";
import { generateAPIResponse, generateErrorResponse } from "../helper";
import { AppError } from "../helper/error";

const registerUser = async (req: Request, res: Response): Promise<any> => {
  try {
    const { firstname, lastname, age, email, phone, password } = req.body;

    if (!firstname || !lastname || !age || !email || !phone || !password) {
      throw new AppError(`Missing required request parameters`, 400);
    }

    const user_id = generateUserId();

    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    const userdata: UserData = {
      user_id,
      first_name: firstname,
      last_name: lastname,
      age: Number(age),
      email: email,
      phone: phone,
      password: hashedPassword,
    };

    const user = {
      user_id,
    };

    const redis = await RedisHandler.createInstance();
    const engine_response = (await redis.sendAndAwait({
      type: "USER",
      user,
    })) as EngineResponse;

    if (engine_response.eng_status_code === 0) {
      throw new AppError(engine_response.message, 400);
    }

    const newUser = (await prisma.user.create({
      data: userdata,
    })) as UserData;

    if (!newUser) {
      throw new AppError(`Error creating user. Please try again`, 400);
    }

    const { password: _, ...userWithoutPassword } = newUser;

    return res
      .status(200)
      .send(
        generateAPIResponse(
          userWithoutPassword,
          "User registered successfully",
          "SUCCESS",
          1
        )
      );
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    console.error("Error in user/registerUser:", error);
    return res
      .status((error as { status_code?: number })?.status_code || 500)
      .send(
        generateErrorResponse(
          err.message || "An unexpected error occurred while log out.",
          "FAILED",
          0
        )
      );
  }
};

const updateBalance = async (req: Request, res: Response): Promise<any> => {
  try {
    const { amount, asset, type } = req.body;
    const user_id = req.user_id;

    if (!user_id || !amount || !asset || !type) {
      throw new AppError(`Missing required request parameters`, 400);
    }

    const user = await prisma.user.findFirst({
      where: {
        user_id,
      },
    });

    if (!user) {
      throw new AppError(`User not found`, 404);
    }

    const depositAmount = Number(amount);

    if (isNaN(depositAmount) || depositAmount <= 0) {
      throw new AppError(`Amount must be a valid positive number`, 400);
    }

    const transaction = {
      action: "UPDATE_BALANCE",
      user_id,
      transaction_data: { tx_id: generateTransactionId(), asset, type, amount },
    };

    const redis = await RedisHandler.createInstance();
    const engine_response = (await redis.sendAndAwait({
      type: "BALANCE",
      transaction,
    })) as EngineResponse;

    if (!engine_response.data) {
      throw new AppError(engine_response.message, 400);
    }

    return res
      .status(200)
      .send(
        generateAPIResponse(
          engine_response.data,
          engine_response.message,
          engine_response.status,
          1
        )
      );
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    console.error("Error in user/updateBalance:", error);
    return res
      .status((error as { status_code?: number })?.status_code || 500)
      .send(
        generateErrorResponse(
          err.message || "An unexpected error occurred while log out.",
          "FAILED",
          0
        )
      );
  }
};

const fetchUserBalance = async (req: Request, res: Response): Promise<any> => {
  try {
    const user_id = req.user_id;

    if (!user_id) {
      throw new AppError(`Missing required request parameters`, 400);
    }

    const redis = await RedisHandler.createInstance();

    const engine_response = (await redis.sendAndAwait({
      type: "BALANCE",
      transaction: {
        action: "FETCH_BALANCE",
        user_id,
      },
    })) as EngineResponse;

    if (engine_response.eng_status_code === 0) {
      throw new AppError(engine_response.message, 400);
    }

    return res
      .status(200)
      .send(
        generateAPIResponse(
          engine_response.data,
          engine_response.message,
          engine_response.status,
          1
        )
      );
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    console.error("Error in user/fetchUserBalance:", error);
    return res
      .status((error as { status_code?: number })?.status_code || 500)
      .send(
        generateErrorResponse(
          err.message || "An unexpected error occurred while log out.",
          "FAILED",
          0
        )
      );
  }
};

const fetchAllAssets = async (req: Request, res: Response): Promise<any> => {
  try {
    const redis = await RedisHandler.createInstance();

    const engine_response = (await redis.sendAndAwait({
      type: "MARKET",
      market: {
        action: "FETCH_ALL_ASSET",
      },
    })) as EngineResponse;

    if (engine_response.eng_status_code === 0) {
      throw new AppError(engine_response.message, 400);
    }

    return res
      .status(200)
      .send(
        generateAPIResponse(
          engine_response.data,
          engine_response.message,
          engine_response.status,
          1
        )
      );
  } catch (error: any) {
    console.error("Error in user/fetchAllAssets:", error);
    return res
      .status(500)
      .send(
        generateErrorResponse(
          error.message ||
            "An unexpected error occurred while fetching assets.",
          "FAILED",
          0
        )
      );
  }
};

const fetchUserDetails = async (req: Request, res: Response): Promise<any> => {
  try {
    const user_id = req.user_id as string;

    const user_data = await UserRepo.findById(user_id);

    if (!user_data) {
      throw Error(`User data does not exist for User ID: ${user_id}`);
    }
    const { password, ...user } = user_data;

    return res
      .status(200)
      .send(
        generateAPIResponse(
          user,
          `User data found for User ID: ${user_id}`,
          "SUCCESS",
          1
        )
      );
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    console.error("Error in user/fetchUserDetail:", error);
    return res
      .status((error as { status_code?: number })?.status_code || 500)
      .send(
        generateErrorResponse(
          err.message || "An unexpected error occurred while log out.",
          "FAILED",
          0
        )
      );
  }
};

export {
  registerUser,
  updateBalance,
  fetchUserBalance,
  fetchAllAssets,
  fetchUserDetails,
};
