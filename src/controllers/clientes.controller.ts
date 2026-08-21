import { Request, Response, NextFunction } from "express";
import { prisma } from "../config/prisma";
import { ApiError } from "../middlewares/errorHandler";

const ESTADOS_VENTA_CONFIRMADA = ["PAGADO", "PREPARANDO", "ENVIADO", "ENTREGADO"] as const;

// GET /api/admin/clientes
export async function listarClientes(req: Request, res: Response, next: NextFunction) {
  try {
    const [clientes, gastos, ultimasCompras] = await Promise.all([
      prisma.usuario.findMany({
        where: { rol: "CLIENTE" },
        select: { id: true, nombre: true, email: true, activo: true, creadoEn: true },
        orderBy: { creadoEn: "desc" },
      }),
      prisma.pedido.groupBy({
        by: ["usuarioId"],
        where: { estado: { in: [...ESTADOS_VENTA_CONFIRMADA] } },
        _sum: { total: true },
        _count: { _all: true },
      }),
      prisma.pedido.groupBy({
        by: ["usuarioId"],
        _max: { creadoEn: true },
      }),
    ]);

    const gastosPorUsuario = new Map(gastos.map((g) => [g.usuarioId, g]));
    const ultimaCompraPorUsuario = new Map(ultimasCompras.map((u) => [u.usuarioId, u._max.creadoEn]));

    res.json(
      clientes.map((c) => ({
        ...c,
        totalPedidos: gastosPorUsuario.get(c.id)?._count._all ?? 0,
        totalGastado: gastosPorUsuario.get(c.id)?._sum.total ?? 0,
        ultimaCompra: ultimaCompraPorUsuario.get(c.id) ?? null,
      }))
    );
  } catch (err) {
    next(err);
  }
}

// GET /api/admin/clientes/:id
export async function obtenerClientePerfil(req: Request, res: Response, next: NextFunction) {
  try {
    const cliente = await prisma.usuario.findUnique({
      where: { id: req.params.id },
      select: {
        id: true,
        nombre: true,
        email: true,
        telefono: true,
        activo: true,
        creadoEn: true,
        direcciones: true,
        pedidos: {
          orderBy: { creadoEn: "desc" },
          select: { id: true, numero: true, total: true, estado: true, creadoEn: true },
        },
      },
    });

    if (!cliente) throw new ApiError(404, "Cliente no encontrado");

    res.json(cliente);
  } catch (err) {
    next(err);
  }
}
