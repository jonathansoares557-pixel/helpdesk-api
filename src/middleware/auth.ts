import { Role } from "@prisma/client";
import { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { env } from "../config";
import { AppError } from "../lib/errors";

export interface AuthPayload {
  sub: string;
  role: Role;
}

declare global {
  namespace Express {
    interface Request {
      auth?: AuthPayload;
    }
  }
}

export function signToken(payload: AuthPayload) {
  return jwt.sign(payload, env.JWT_SECRET, { expiresIn: env.JWT_EXPIRES_IN as jwt.SignOptions["expiresIn"] });
}

export function authenticate(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) return next(new AppError("Token not provided", 401));
  try {
    const decoded = jwt.verify(header.slice(7), env.JWT_SECRET) as AuthPayload;
    req.auth = { sub: decoded.sub, role: decoded.role };
    next();
  } catch {
    next(new AppError("Invalid or expired token", 401));
  }
}

export const authorize =
  (...roles: Role[]) =>
  (req: Request, _res: Response, next: NextFunction) => {
    if (!req.auth || !roles.includes(req.auth.role)) return next(new AppError("Forbidden", 403));
    next();
  };
