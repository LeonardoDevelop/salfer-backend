import { Request, Response, NextFunction } from "express";
import { prisma } from "../config/prisma";
import { ApiError } from "../middlewares/errorHandler";

// GET /api/pagos/:pedidoId — estado del pago (para pantalla de "esperando confirmación")
export async function obtenerEstadoPago(req: Request, res: Response, next: NextFunction) {
  try {
    const pago = await prisma.pago.findUnique({
      where: { pedidoId: req.params.pedidoId },
      include: { pedido: { select: { usuarioId: true, numero: true, total: true, estado: true } } },
    });

    if (!pago) throw new ApiError(404, "Pago no encontrado");
    if (pago.pedido.usuarioId !== req.usuario!.id && req.usuario!.rol !== "ADMIN") {
      throw new ApiError(403, "No tienes acceso a este pago");
    }

    res.json(pago);
  } catch (err) {
    next(err);
  }
}

// PATCH /api/pagos/:pedidoId/confirmar
// NOTA: esto simula la confirmación de una pasarela real (Culqi/Mercado Pago).
// En la Fase 5 este endpoint se llama desde el webhook de la pasarela, no manualmente.
export async function confirmarPago(req: Request, res: Response, next: NextFunction) {
  try {
    const pago = await prisma.pago.findUnique({ where: { pedidoId: req.params.pedidoId } });
    if (!pago) throw new ApiError(404, "Pago no encontrado");
    if (pago.estado === "CONFIRMADO") throw new ApiError(409, "Este pago ya fue confirmado");

    const resultado = await prisma.$transaction(async (tx) => {
      const pagoActualizado = await tx.pago.update({
        where: { pedidoId: req.params.pedidoId },
        data: { estado: "CONFIRMADO", confirmadoEn: new Date(), referenciaExterna: `SIM-${Date.now()}` },
      });

      const pedidoActualizado = await tx.pedido.update({
        where: { id: req.params.pedidoId },
        data: {
          estado: "PAGADO",
          historial: { create: { estado: "PAGADO", nota: "Pago confirmado" } },
        },
        include: { items: true },
      });

      // El stock ya se descontó al crear el pedido (quedó "reservado");
      // al confirmar el pago, se libera la reserva porque ya es una venta firme.
      for (const item of pedidoActualizado.items) {
        await tx.producto.update({
          where: { id: item.productoId },
          data: {
            stockReservado: { decrement: item.cantidad },
            totalVentas: { increment: item.cantidad },
          },
        });
        await tx.movimientoInventario.create({
          data: {
            productoId: item.productoId,
            tipo: "SALIDA",
            cantidad: item.cantidad,
            motivo: `Venta confirmada — pedido ${pedidoActualizado.numero}`,
          },
        });
      }

      return { pago: pagoActualizado, pedido: pedidoActualizado };
    });

    res.json(resultado);
  } catch (err) {
    next(err);
  }
}
