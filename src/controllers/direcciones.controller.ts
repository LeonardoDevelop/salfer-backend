import { Request, Response, NextFunction } from "express";
import { z } from "zod";
import { prisma } from "../config/prisma";
import { ApiError } from "../middlewares/errorHandler";

const direccionSchema = z.object({
  etiqueta: z.string().optional(),
  destinatario: z.string().min(2),
  telefono: z.string().min(6),
  calle: z.string().min(2),
  numero: z.string().optional(),
  distrito: z.string().min(2),
  ciudad: z.string().min(2),
  region: z.string().min(2),
  codigoPostal: z.string().optional(),
  referencia: z.string().optional(),
  predeterminada: z.boolean().optional(),
});

// GET /api/direcciones — las del usuario autenticado
export async function listarDirecciones(req: Request, res: Response, next: NextFunction) {
  try {
    const direcciones = await prisma.direccion.findMany({
      where: { usuarioId: req.usuario!.id },
      orderBy: [{ predeterminada: "desc" }],
    });
    res.json(direcciones);
  } catch (err) {
    next(err);
  }
}

// POST /api/direcciones
export async function crearDireccion(req: Request, res: Response, next: NextFunction) {
  try {
    const datos = direccionSchema.parse(req.body);

    if (datos.predeterminada) {
      await prisma.direccion.updateMany({
        where: { usuarioId: req.usuario!.id },
        data: { predeterminada: false },
      });
    }

    const direccion = await prisma.direccion.create({
      data: { ...datos, usuarioId: req.usuario!.id },
    });
    res.status(201).json(direccion);
  } catch (err) {
    next(err);
  }
}

// PUT /api/direcciones/:id
export async function actualizarDireccion(req: Request, res: Response, next: NextFunction) {
  try {
    const datos = direccionSchema.partial().parse(req.body);

    const existente = await prisma.direccion.findUnique({ where: { id: req.params.id } });
    if (!existente || existente.usuarioId !== req.usuario!.id) {
      throw new ApiError(404, "Dirección no encontrada");
    }

    if (datos.predeterminada) {
      await prisma.direccion.updateMany({
        where: { usuarioId: req.usuario!.id },
        data: { predeterminada: false },
      });
    }

    const direccion = await prisma.direccion.update({
      where: { id: req.params.id },
      data: datos,
    });
    res.json(direccion);
  } catch (err) {
    next(err);
  }
}

// DELETE /api/direcciones/:id
export async function eliminarDireccion(req: Request, res: Response, next: NextFunction) {
  try {
    const existente = await prisma.direccion.findUnique({ where: { id: req.params.id } });
    if (!existente || existente.usuarioId !== req.usuario!.id) {
      throw new ApiError(404, "Dirección no encontrada");
    }

    await prisma.direccion.delete({ where: { id: req.params.id } });
    res.json({ mensaje: "Dirección eliminada" });
  } catch (err) {
    next(err);
  }
}
