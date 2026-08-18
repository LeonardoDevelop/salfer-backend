import { Request, Response, NextFunction } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { z } from "zod";
import { prisma } from "../config/prisma";
import { ApiError } from "../middlewares/errorHandler";

const registroSchema = z.object({
  nombre: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(8, "La contraseña debe tener al menos 8 caracteres"),
  telefono: z.string().optional(),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

function generarToken(id: string, rol: string) {
  const opciones: jwt.SignOptions = {
    expiresIn: (process.env.JWT_EXPIRES_IN || "7d") as jwt.SignOptions["expiresIn"],
  };
  return jwt.sign({ id, rol }, process.env.JWT_SECRET as string, opciones);
}

export async function registrar(req: Request, res: Response, next: NextFunction) {
  try {
    const datos = registroSchema.parse(req.body);

    const existente = await prisma.usuario.findUnique({ where: { email: datos.email } });
    if (existente) throw new ApiError(409, "Ya existe una cuenta con este email");

    const passwordHash = await bcrypt.hash(datos.password, 12);

    const usuario = await prisma.usuario.create({
      data: {
        nombre: datos.nombre,
        email: datos.email,
        passwordHash,
        telefono: datos.telefono,
      },
    });

    const token = generarToken(usuario.id, usuario.rol);

    res.status(201).json({
      token,
      usuario: { id: usuario.id, nombre: usuario.nombre, email: usuario.email, rol: usuario.rol },
    });
  } catch (err) {
    next(err);
  }
}

export async function login(req: Request, res: Response, next: NextFunction) {
  try {
    const datos = loginSchema.parse(req.body);

    const usuario = await prisma.usuario.findUnique({ where: { email: datos.email } });
    if (!usuario) throw new ApiError(401, "Credenciales inválidas");

    const passwordValido = await bcrypt.compare(datos.password, usuario.passwordHash);
    if (!passwordValido) throw new ApiError(401, "Credenciales inválidas");

    if (!usuario.activo) throw new ApiError(403, "Cuenta desactivada");

    const token = generarToken(usuario.id, usuario.rol);

    await prisma.logSeguridad.create({
      data: { usuarioId: usuario.id, accion: "LOGIN_OK", ip: req.ip },
    });

    res.json({
      token,
      usuario: { id: usuario.id, nombre: usuario.nombre, email: usuario.email, rol: usuario.rol },
    });
  } catch (err) {
    next(err);
  }
}
