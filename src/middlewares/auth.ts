import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { ApiError } from "./errorHandler";

export interface AuthPayload {
  id: string;
  rol: "CLIENTE" | "ADMIN" | "VENDEDOR";
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      usuario?: AuthPayload;
    }
  }
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    return next(new ApiError(401, "No autenticado"));
  }

  const token = header.slice(7);
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET as string) as AuthPayload;
    req.usuario = payload;
    next();
  } catch {
    next(new ApiError(401, "Token inválido o expirado"));
  }
}

export function requireRole(...rolesPermitidos: AuthPayload["rol"][]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.usuario) return next(new ApiError(401, "No autenticado"));
    if (!rolesPermitidos.includes(req.usuario.rol)) {
      return next(new ApiError(403, "No tienes permisos para esta acción"));
    }
    next();
  };
}
