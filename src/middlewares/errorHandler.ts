import { Request, Response, NextFunction } from "express";
import { Prisma } from "@prisma/client";
 
export class ApiError extends Error {
  statusCode: number;
  constructor(statusCode: number, message: string) {
    super(message);
    this.statusCode = statusCode;
  }
}
 
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function errorHandler(err: unknown, req: Request, res: Response, next: NextFunction) {
  if (err instanceof ApiError) {
    return res.status(err.statusCode).json({ error: err.message });
  }
 
  // Errores conocidos de Prisma (registro no encontrado, valor duplicado, etc.)
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === "P2025") {
      return res.status(404).json({ error: "El registro no existe o ya fue eliminado" });
    }
    if (err.code === "P2002") {
      return res.status(409).json({ error: "Ya existe un registro con ese valor único" });
    }
    if (err.code === "P2003") {
      return res.status(409).json({ error: "No se puede completar: hay datos relacionados que dependen de este registro" });
    }
  }
 
  console.error("[ERROR]", err);
  return res.status(500).json({ error: "Error interno del servidor" });
}
 
export function notFoundHandler(req: Request, res: Response) {
  res.status(404).json({ error: `Ruta no encontrada: ${req.method} ${req.originalUrl}` });
}