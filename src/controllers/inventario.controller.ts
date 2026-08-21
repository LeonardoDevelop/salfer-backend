import { Request, Response, NextFunction } from "express";
import { z } from "zod";
import { prisma } from "../config/prisma";
import { ApiError } from "../middlewares/errorHandler";

// GET /api/admin/inventario
export async function obtenerInventario(req: Request, res: Response, next: NextFunction) {
  try {
    const productos = await prisma.producto.findMany({
      where: { estado: { not: "BORRADOR" } },
      orderBy: { stock: "asc" },
      select: {
        id: true,
        nombre: true,
        sku: true,
        stock: true,
        stockReservado: true,
        stockMinimo: true,
        estado: true,
      },
    });

    const agotados = productos.filter((p) => p.stock === 0);
    const criticos = productos.filter((p) => p.stock > 0 && p.stock <= p.stockMinimo);

    res.json({
      resumen: {
        totalProductos: productos.length,
        agotados: agotados.length,
        stockCritico: criticos.length,
      },
      alertasAgotados: agotados,
      alertasCriticas: criticos,
      productos,
    });
  } catch (err) {
    next(err);
  }
}

const ajusteSchema = z.object({
  cantidad: z.number().int(), // positivo = entrada, negativo = salida/ajuste
  motivo: z.string().min(3),
});

// PATCH /api/admin/inventario/:productoId
export async function ajustarStock(req: Request, res: Response, next: NextFunction) {
  try {
    const { cantidad, motivo } = ajusteSchema.parse(req.body);

    const producto = await prisma.producto.findUnique({ where: { id: req.params.productoId } });
    if (!producto) throw new ApiError(404, "Producto no encontrado");

    const nuevoStock = producto.stock + cantidad;
    if (nuevoStock < 0) throw new ApiError(400, "El ajuste dejaría el stock en negativo");

    const [productoActualizado] = await prisma.$transaction([
      prisma.producto.update({
        where: { id: req.params.productoId },
        data: { stock: nuevoStock },
      }),
      prisma.movimientoInventario.create({
        data: {
          productoId: req.params.productoId,
          tipo: cantidad >= 0 ? "ENTRADA" : "AJUSTE",
          cantidad: Math.abs(cantidad),
          motivo,
        },
      }),
    ]);

    res.json(productoActualizado);
  } catch (err) {
    next(err);
  }
}

// GET /api/admin/inventario/:productoId/movimientos
export async function historialMovimientos(req: Request, res: Response, next: NextFunction) {
  try {
    const movimientos = await prisma.movimientoInventario.findMany({
      where: { productoId: req.params.productoId },
      orderBy: { creadoEn: "desc" },
      take: 50,
    });
    res.json(movimientos);
  } catch (err) {
    next(err);
  }
}
