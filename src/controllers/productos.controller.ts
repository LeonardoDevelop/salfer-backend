import { Request, Response, NextFunction } from "express";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "../config/prisma";
import { ApiError } from "../middlewares/errorHandler";

// ------------------------------------------------------------
// Validaciones
// ------------------------------------------------------------

const productoSchema = z.object({
  sku: z.string().min(2),
  nombre: z.string().min(2),
  slug: z.string().min(2).regex(/^[a-z0-9-]+$/),
  descripcion: z.string().min(1),
  categoriaId: z.string(),
  marcaId: z.string().optional(),
  precio: z.number().positive(),
  precioAnterior: z.number().positive().optional(),
  stock: z.number().int().min(0).default(0),
  stockMinimo: z.number().int().min(0).default(5),
  destacado: z.boolean().optional(),
  etiqueta: z.enum(["NUEVO", "OFERTA", "DESTACADO"]).optional(),
  estado: z.enum(["ACTIVO", "INACTIVO", "BORRADOR"]).optional(),
  imagenes: z.array(z.object({ url: z.string().url(), esPrincipal: z.boolean().optional() })).optional(),
  caracteristicas: z.array(z.object({ clave: z.string(), valor: z.string() })).optional(),
});

const ORDEN_VALIDOS = [
  "relevancia",
  "mas_vendidos",
  "precio_menor",
  "precio_mayor",
  "mas_recientes",
  "mejor_valorados",
] as const;

function construirOrderBy(orden?: string): Prisma.ProductoOrderByWithRelationInput[] {
  switch (orden) {
    case "mas_vendidos":
      return [{ totalVentas: "desc" }];
    case "precio_menor":
      return [{ precio: "asc" }];
    case "precio_mayor":
      return [{ precio: "desc" }];
    case "mas_recientes":
      return [{ creadoEn: "desc" }];
    case "mejor_valorados":
      return [{ ratingPromedio: "desc" }];
    case "relevancia":
    default:
      return [{ destacado: "desc" }, { creadoEn: "desc" }];
  }
}

// ------------------------------------------------------------
// GET /api/productos — catálogo público con filtros
// ------------------------------------------------------------

export async function listarProductos(req: Request, res: Response, next: NextFunction) {
  try {
    const {
      categoria, // slug
      marca, // id
      precioMin,
      precioMax,
      buscar,
      destacado,
      etiqueta,
      soloDisponibles,
      orden,
      page = "1",
      limit = "12",
    } = req.query as Record<string, string>;

    const pageNum = Math.max(1, parseInt(page) || 1);
    const limitNum = Math.min(60, Math.max(1, parseInt(limit) || 12));

    const where: Prisma.ProductoWhereInput = {
      estado: "ACTIVO",
    };

    if (categoria) {
      where.categoria = { slug: categoria };
    }
    if (marca) {
      where.marcaId = marca;
    }
    if (precioMin || precioMax) {
      where.precio = {
        ...(precioMin ? { gte: new Prisma.Decimal(precioMin) } : {}),
        ...(precioMax ? { lte: new Prisma.Decimal(precioMax) } : {}),
      };
    }
    if (destacado === "true") {
      where.destacado = true;
    }
    if (etiqueta) {
      where.etiqueta = etiqueta;
    }
    if (soloDisponibles === "true") {
      where.stock = { gt: 0 };
    }
    if (buscar) {
      where.OR = [
        { nombre: { contains: buscar } },
        { descripcion: { contains: buscar } },
        { sku: { contains: buscar } },
      ];
    }

    const [productos, total] = await Promise.all([
      prisma.producto.findMany({
        where,
        orderBy: construirOrderBy(orden),
        skip: (pageNum - 1) * limitNum,
        take: limitNum,
        include: {
          categoria: { select: { nombre: true, slug: true } },
          marca: { select: { nombre: true } },
          imagenes: { where: { esPrincipal: true }, take: 1 },
        },
      }),
      prisma.producto.count({ where }),
    ]);

    res.json({
      productos: productos.map((p) => ({
        id: p.id,
        sku: p.sku,
        nombre: p.nombre,
        slug: p.slug,
        precio: p.precio,
        precioAnterior: p.precioAnterior,
        stock: p.stock,
        destacado: p.destacado,
        etiqueta: p.etiqueta,
        ratingPromedio: p.ratingPromedio,
        totalResenas: p.totalResenas,
        categoria: p.categoria.nombre,
        marca: p.marca?.nombre ?? null,
        imagenPrincipal: p.imagenes[0]?.url ?? null,
      })),
      paginacion: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPaginas: Math.ceil(total / limitNum),
      },
    });
  } catch (err) {
    next(err);
  }
}

// ------------------------------------------------------------
// GET /api/productos/:slug — detalle público
// ------------------------------------------------------------

export async function obtenerProductoPorSlug(req: Request, res: Response, next: NextFunction) {
  try {
    const producto = await prisma.producto.findUnique({
      where: { slug: req.params.slug },
      include: {
        categoria: true,
        marca: true,
        imagenes: { orderBy: { orden: "asc" } },
        caracteristicas: true,
        resenas: {
          include: { usuario: { select: { nombre: true } } },
          orderBy: { creadoEn: "desc" },
          take: 20,
        },
      },
    });

    if (!producto || producto.estado !== "ACTIVO") {
      throw new ApiError(404, "Producto no encontrado");
    }

    res.json(producto);
  } catch (err) {
    next(err);
  }
}

// ------------------------------------------------------------
// Admin: crear / actualizar / eliminar / cambiar estado
// ------------------------------------------------------------

export async function crearProducto(req: Request, res: Response, next: NextFunction) {
  try {
    const datos = productoSchema.parse(req.body);

    const existente = await prisma.producto.findFirst({
      where: { OR: [{ sku: datos.sku }, { slug: datos.slug }] },
    });
    if (existente) throw new ApiError(409, "Ya existe un producto con ese SKU o slug");

    const producto = await prisma.producto.create({
      data: {
        sku: datos.sku,
        nombre: datos.nombre,
        slug: datos.slug,
        descripcion: datos.descripcion,
        categoriaId: datos.categoriaId,
        marcaId: datos.marcaId,
        precio: datos.precio,
        precioAnterior: datos.precioAnterior,
        stock: datos.stock,
        stockMinimo: datos.stockMinimo,
        destacado: datos.destacado ?? false,
        etiqueta: datos.etiqueta,
        estado: datos.estado ?? "BORRADOR",
        imagenes: datos.imagenes ? { create: datos.imagenes } : undefined,
        caracteristicas: datos.caracteristicas ? { create: datos.caracteristicas } : undefined,
      },
      include: { imagenes: true, caracteristicas: true },
    });

    res.status(201).json(producto);
  } catch (err) {
    next(err);
  }
}

export async function actualizarProducto(req: Request, res: Response, next: NextFunction) {
  try {
    const datos = productoSchema.partial().parse(req.body);
    const { imagenes, caracteristicas, ...resto } = datos;

    const producto = await prisma.producto.update({
      where: { id: req.params.id },
      data: resto,
    });

    res.json(producto);
  } catch (err) {
    next(err);
  }
}

export async function cambiarEstadoProducto(req: Request, res: Response, next: NextFunction) {
  try {
    const { estado } = z.object({ estado: z.enum(["ACTIVO", "INACTIVO", "BORRADOR"]) }).parse(req.body);
    const producto = await prisma.producto.update({
      where: { id: req.params.id },
      data: { estado },
    });
    res.json(producto);
  } catch (err) {
    next(err);
  }
}

export async function eliminarProducto(req: Request, res: Response, next: NextFunction) {
  try {
    await prisma.producto.delete({ where: { id: req.params.id } });
    res.json({ mensaje: "Producto eliminado" });
  } catch (err) {
    next(err);
  }
}

// GET /api/productos/admin/todos — admin, incluye inactivos/borradores, sin filtro de estado
export async function listarProductosAdmin(req: Request, res: Response, next: NextFunction) {
  try {
    const productos = await prisma.producto.findMany({
      orderBy: { creadoEn: "desc" },
      include: {
        categoria: { select: { nombre: true } },
        imagenes: { where: { esPrincipal: true }, take: 1 },
      },
    });
    res.json(productos);
  } catch (err) {
    next(err);
  }
}
