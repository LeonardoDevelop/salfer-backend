import { Request, Response, NextFunction } from "express";
import { z } from "zod";
import { prisma } from "../config/prisma";
import { ApiError } from "../middlewares/errorHandler";

const checkoutSchema = z.object({
  direccionId: z.string().optional(), // opcional si tipoEntrega es RECOJO_TIENDA
  tipoEntrega: z.enum(["ENVIO", "RECOJO_TIENDA"]).default("ENVIO"),
  metodoPago: z.enum(["TARJETA", "TRANSFERENCIA", "QR", "BILLETERA_DIGITAL"]),
  cuponCodigo: z.string().optional(),
});

async function generarNumeroPedido() {
  const anio = new Date().getFullYear();
  const total = await prisma.pedido.count();
  const correlativo = String(total + 1).padStart(6, "0");
  return `NEX-${anio}-${correlativo}`;
}

const COSTO_ENVIO = 15; // fijo por ahora; en fases futuras puede depender de la dirección

// POST /api/pedidos — checkout
export async function crearPedido(req: Request, res: Response, next: NextFunction) {
  try {
    const datos = checkoutSchema.parse(req.body);

    if (datos.tipoEntrega === "ENVIO" && !datos.direccionId) {
      throw new ApiError(400, "Debes indicar una dirección de envío");
    }

    if (datos.direccionId) {
      const direccion = await prisma.direccion.findUnique({ where: { id: datos.direccionId } });
      if (!direccion || direccion.usuarioId !== req.usuario!.id) {
        throw new ApiError(404, "Dirección no encontrada");
      }
    }

    const carrito = await prisma.carrito.findUnique({
      where: { usuarioId: req.usuario!.id },
      include: { items: { include: { producto: true } } },
    });

    if (!carrito || carrito.items.length === 0) {
      throw new ApiError(400, "El carrito está vacío");
    }

    // Validar stock disponible de cada producto antes de confirmar nada
    for (const item of carrito.items) {
      if (item.producto.estado !== "ACTIVO") {
        throw new ApiError(409, `"${item.producto.nombre}" ya no está disponible`);
      }
      if (item.cantidad > item.producto.stock) {
        throw new ApiError(409, `Solo hay ${item.producto.stock} unidades de "${item.producto.nombre}"`);
      }
    }

    const subtotal = carrito.items.reduce((acc, i) => acc + Number(i.producto.precio) * i.cantidad, 0);

    // Validar y aplicar cupón si vino uno
    let descuento = 0;
    let cuponId: string | undefined;
    if (datos.cuponCodigo) {
      const cupon = await prisma.cupon.findUnique({ where: { codigo: datos.cuponCodigo } });
      if (!cupon || !cupon.activo) throw new ApiError(400, "Cupón inválido");
      if (cupon.validoHasta && cupon.validoHasta < new Date()) throw new ApiError(400, "Cupón expirado");
      if (cupon.usosMaximos && cupon.usosActuales >= cupon.usosMaximos) {
        throw new ApiError(400, "Cupón agotado");
      }
      if (cupon.montoMinimo && subtotal < Number(cupon.montoMinimo)) {
        throw new ApiError(400, `El monto mínimo para este cupón es ${cupon.montoMinimo}`);
      }

      descuento =
        cupon.tipo === "PORCENTAJE"
          ? subtotal * (Number(cupon.valor) / 100)
          : cupon.tipo === "MONTO_FIJO"
          ? Number(cupon.valor)
          : 0;
      cuponId = cupon.id;
    }

    const costoEnvio = datos.tipoEntrega === "ENVIO" ? COSTO_ENVIO : 0;
    const total = Math.max(0, subtotal - descuento) + costoEnvio;
    const numero = await generarNumeroPedido();

    // Todo o nada: si algo falla, no se descuenta stock ni se crea nada a medias
    const pedido = await prisma.$transaction(async (tx) => {
      const nuevoPedido = await tx.pedido.create({
        data: {
          numero,
          usuarioId: req.usuario!.id,
          direccionId: datos.direccionId,
          tipoEntrega: datos.tipoEntrega,
          subtotal,
          costoEnvio,
          descuento,
          total,
          cuponId,
          estado: "PENDIENTE",
          items: {
            create: carrito.items.map((i) => ({
              productoId: i.productoId,
              nombreProducto: i.producto.nombre,
              precioUnitario: i.producto.precio,
              cantidad: i.cantidad,
              subtotal: Number(i.producto.precio) * i.cantidad,
            })),
          },
          historial: {
            create: { estado: "PENDIENTE", nota: "Pedido creado, esperando pago" },
          },
          pago: {
            create: {
              metodo: datos.metodoPago,
              estado: "PENDIENTE",
              monto: total,
            },
          },
        },
        include: { items: true, pago: true },
      });

      // Descontar stock y registrar movimiento de inventario
      for (const item of carrito.items) {
        await tx.producto.update({
          where: { id: item.productoId },
          data: { stock: { decrement: item.cantidad }, stockReservado: { increment: item.cantidad } },
        });
        await tx.movimientoInventario.create({
          data: {
            productoId: item.productoId,
            tipo: "RESERVA",
            cantidad: item.cantidad,
            motivo: `Pedido ${numero}`,
          },
        });
      }

      if (cuponId) {
        await tx.cupon.update({ where: { id: cuponId }, data: { usosActuales: { increment: 1 } } });
        await tx.cuponUsuario.create({ data: { cuponId, usuarioId: req.usuario!.id } });
      }

      // Vaciar el carrito
      await tx.itemCarrito.deleteMany({ where: { carritoId: carrito.id } });

      return nuevoPedido;
    });

    res.status(201).json(pedido);
  } catch (err) {
    next(err);
  }
}

// GET /api/pedidos — pedidos del usuario autenticado
export async function listarMisPedidos(req: Request, res: Response, next: NextFunction) {
  try {
    const pedidos = await prisma.pedido.findMany({
      where: { usuarioId: req.usuario!.id },
      orderBy: { creadoEn: "desc" },
      include: { items: true, pago: true },
    });
    res.json(pedidos);
  } catch (err) {
    next(err);
  }
}

// GET /api/pedidos/:id
export async function obtenerPedido(req: Request, res: Response, next: NextFunction) {
  try {
    const pedido = await prisma.pedido.findUnique({
      where: { id: req.params.id },
      include: {
        items: true,
        pago: true,
        historial: { orderBy: { creadoEn: "asc" } },
        direccion: true,
      },
    });

    if (!pedido) throw new ApiError(404, "Pedido no encontrado");
    if (pedido.usuarioId !== req.usuario!.id && req.usuario!.rol !== "ADMIN") {
      throw new ApiError(403, "No tienes acceso a este pedido");
    }

    res.json(pedido);
  } catch (err) {
    next(err);
  }
}

// GET /api/pedidos/admin/todos — admin
export async function listarPedidosAdmin(req: Request, res: Response, next: NextFunction) {
  try {
    const { estado } = req.query as { estado?: string };
    const pedidos = await prisma.pedido.findMany({
      where: estado ? { estado: estado as never } : undefined,
      orderBy: { creadoEn: "desc" },
      include: { items: true, pago: true, usuario: { select: { nombre: true, email: true } } },
    });
    res.json(pedidos);
  } catch (err) {
    next(err);
  }
}

const cambiarEstadoSchema = z.object({
  estado: z.enum(["PENDIENTE", "PAGADO", "PREPARANDO", "ENVIADO", "ENTREGADO", "CANCELADO", "REEMBOLSADO"]),
  nota: z.string().optional(),
});

// PATCH /api/pedidos/:id/estado — admin
export async function cambiarEstadoPedido(req: Request, res: Response, next: NextFunction) {
  try {
    const { estado, nota } = cambiarEstadoSchema.parse(req.body);

    const pedido = await prisma.pedido.update({
      where: { id: req.params.id },
      data: {
        estado,
        historial: { create: { estado, nota } },
      },
    });

    res.json(pedido);
  } catch (err) {
    next(err);
  }
}
