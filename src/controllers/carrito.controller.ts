import { Request, Response, NextFunction } from "express";
import { z } from "zod";
import { prisma } from "../config/prisma";
import { ApiError } from "../middlewares/errorHandler";

async function obtenerOCrearCarrito(usuarioId: string) {
  let carrito = await prisma.carrito.findUnique({ where: { usuarioId } });
  if (!carrito) {
    carrito = await prisma.carrito.create({ data: { usuarioId } });
  }
  return carrito;
}

function calcularResumen(items: { cantidad: number; producto: { precio: unknown } }[]) {
  const subtotal = items.reduce((acc, item) => acc + Number(item.producto.precio) * item.cantidad, 0);
  return { subtotal: Number(subtotal.toFixed(2)), totalItems: items.reduce((a, i) => a + i.cantidad, 0) };
}

// GET /api/carrito
export async function obtenerCarrito(req: Request, res: Response, next: NextFunction) {
  try {
    const carrito = await obtenerOCrearCarrito(req.usuario!.id);

    const items = await prisma.itemCarrito.findMany({
      where: { carritoId: carrito.id },
      include: {
        producto: {
          include: { imagenes: { where: { esPrincipal: true }, take: 1 } },
        },
      },
    });

    res.json({
      items: items.map((i) => ({
        id: i.id,
        productoId: i.productoId,
        nombre: i.producto.nombre,
        slug: i.producto.slug,
        precio: i.producto.precio,
        stock: i.producto.stock,
        cantidad: i.cantidad,
        subtotal: Number(i.producto.precio) * i.cantidad,
        imagen: i.producto.imagenes[0]?.url ?? null,
      })),
      resumen: calcularResumen(items),
    });
  } catch (err) {
    next(err);
  }
}

const agregarItemSchema = z.object({
  productoId: z.string(),
  cantidad: z.number().int().positive().default(1),
});

// POST /api/carrito/items
export async function agregarItem(req: Request, res: Response, next: NextFunction) {
  try {
    const { productoId, cantidad } = agregarItemSchema.parse(req.body);

    const producto = await prisma.producto.findUnique({ where: { id: productoId } });
    if (!producto || producto.estado !== "ACTIVO") throw new ApiError(404, "Producto no disponible");

    const carrito = await obtenerOCrearCarrito(req.usuario!.id);

    const itemExistente = await prisma.itemCarrito.findUnique({
      where: { carritoId_productoId: { carritoId: carrito.id, productoId } },
    });

    const cantidadFinal = (itemExistente?.cantidad ?? 0) + cantidad;
    if (cantidadFinal > producto.stock) {
      throw new ApiError(409, `Solo hay ${producto.stock} unidades disponibles`);
    }

    const item = await prisma.itemCarrito.upsert({
      where: { carritoId_productoId: { carritoId: carrito.id, productoId } },
      update: { cantidad: cantidadFinal },
      create: { carritoId: carrito.id, productoId, cantidad },
    });

    res.status(201).json(item);
  } catch (err) {
    next(err);
  }
}

const actualizarCantidadSchema = z.object({
  cantidad: z.number().int().min(0),
});

// PUT /api/carrito/items/:productoId
export async function actualizarCantidad(req: Request, res: Response, next: NextFunction) {
  try {
    const { cantidad } = actualizarCantidadSchema.parse(req.body);
    const carrito = await obtenerOCrearCarrito(req.usuario!.id);

    if (cantidad === 0) {
      await prisma.itemCarrito.deleteMany({
        where: { carritoId: carrito.id, productoId: req.params.productoId },
      });
      return res.json({ mensaje: "Producto quitado del carrito" });
    }

    const producto = await prisma.producto.findUnique({ where: { id: req.params.productoId } });
    if (!producto) throw new ApiError(404, "Producto no encontrado");
    if (cantidad > producto.stock) throw new ApiError(409, `Solo hay ${producto.stock} unidades disponibles`);

    const item = await prisma.itemCarrito.update({
      where: { carritoId_productoId: { carritoId: carrito.id, productoId: req.params.productoId } },
      data: { cantidad },
    });

    res.json(item);
  } catch (err) {
    next(err);
  }
}

// DELETE /api/carrito/items/:productoId
export async function eliminarItem(req: Request, res: Response, next: NextFunction) {
  try {
    const carrito = await obtenerOCrearCarrito(req.usuario!.id);
    await prisma.itemCarrito.deleteMany({
      where: { carritoId: carrito.id, productoId: req.params.productoId },
    });
    res.json({ mensaje: "Producto quitado del carrito" });
  } catch (err) {
    next(err);
  }
}

// DELETE /api/carrito
export async function vaciarCarrito(req: Request, res: Response, next: NextFunction) {
  try {
    const carrito = await obtenerOCrearCarrito(req.usuario!.id);
    await prisma.itemCarrito.deleteMany({ where: { carritoId: carrito.id } });
    res.json({ mensaje: "Carrito vaciado" });
  } catch (err) {
    next(err);
  }
}
