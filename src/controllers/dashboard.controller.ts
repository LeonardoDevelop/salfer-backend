import { Request, Response, NextFunction } from "express";
import { prisma } from "../config/prisma";

const ESTADOS_VENTA_CONFIRMADA = ["PAGADO", "PREPARANDO", "ENVIADO", "ENTREGADO"] as const;

function inicioDelDia() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function inicioDelMes() {
  const d = new Date();
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return d;
}

// GET /api/admin/dashboard
export async function obtenerDashboard(req: Request, res: Response, next: NextFunction) {
  try {
    const [
      ventasHoyResult,
      ventasMesResult,
      totalPedidos,
      totalClientes,
      totalProductos,
      stockBajoResult,
      productosMasVendidos,
      pedidosRecientes,
      metodosPago,
      ventasPorMes,
    ] = await Promise.all([
      prisma.pedido.aggregate({
        where: { estado: { in: [...ESTADOS_VENTA_CONFIRMADA] }, creadoEn: { gte: inicioDelDia() } },
        _sum: { total: true },
      }),
      prisma.pedido.aggregate({
        where: { estado: { in: [...ESTADOS_VENTA_CONFIRMADA] }, creadoEn: { gte: inicioDelMes() } },
        _sum: { total: true },
      }),
      prisma.pedido.count(),
      prisma.usuario.count({ where: { rol: "CLIENTE" } }),
      prisma.producto.count(),
      prisma.$queryRaw<{ total: bigint }[]>`
        SELECT COUNT(*) as total FROM Producto WHERE estado = 'ACTIVO' AND stock <= stockMinimo
      `,
      prisma.producto.findMany({
        orderBy: { totalVentas: "desc" },
        take: 5,
        select: { id: true, nombre: true, totalVentas: true },
      }),
      prisma.pedido.findMany({
        orderBy: { creadoEn: "desc" },
        take: 6,
        select: {
          id: true,
          numero: true,
          total: true,
          estado: true,
          creadoEn: true,
          usuario: { select: { nombre: true } },
          pago: { select: { metodo: true } },
        },
      }),
      prisma.pago.groupBy({
        by: ["metodo"],
        where: { estado: "CONFIRMADO" },
        _count: { _all: true },
      }),
      prisma.$queryRaw<{ mes: string; total: string }[]>`
        SELECT DATE_FORMAT(creadoEn, '%Y-%m') as mes, SUM(total) as total
        FROM Pedido
        WHERE estado IN ('PAGADO','PREPARANDO','ENVIADO','ENTREGADO')
          AND creadoEn >= DATE_SUB(CURDATE(), INTERVAL 8 MONTH)
        GROUP BY mes
        ORDER BY mes ASC
      `,
    ]);

    res.json({
      kpis: {
        ventasHoy: ventasHoyResult._sum.total ?? 0,
        ventasMes: ventasMesResult._sum.total ?? 0,
        totalPedidos,
        totalClientes,
        totalProductos,
        stockBajo: Number(stockBajoResult[0]?.total ?? 0),
      },
      graficos: {
        ventasPorMes: ventasPorMes.map((v) => ({ mes: v.mes, total: Number(v.total) })),
        productosMasVendidos,
        metodosPago: metodosPago.map((m) => ({ metodo: m.metodo, cantidad: m._count._all })),
      },
      pedidosRecientes: pedidosRecientes.map((p) => ({
        id: p.id,
        numero: p.numero,
        cliente: p.usuario.nombre,
        total: p.total,
        estado: p.estado,
        metodoPago: p.pago?.metodo ?? null,
        creadoEn: p.creadoEn,
      })),
    });
  } catch (err) {
    next(err);
  }
}
