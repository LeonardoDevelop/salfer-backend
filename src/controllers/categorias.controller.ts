import { Request, Response, NextFunction } from "express";
import { z } from "zod";
import { prisma } from "../config/prisma";
import { ApiError } from "../middlewares/errorHandler";

const categoriaSchema = z.object({
  nombre: z.string().min(2),
  slug: z.string().min(2).regex(/^[a-z0-9-]+$/, "El slug solo permite minúsculas, números y guiones"),
  icono: z.string().optional(),
  imagenUrl: z.string().url().optional(),
  descripcion: z.string().optional(),
  orden: z.number().int().optional(),
});

// GET /api/categorias — público, solo activas
export async function listarCategorias(req: Request, res: Response, next: NextFunction) {
  try {
    const categorias = await prisma.categoria.findMany({
      where: { activa: true },
      orderBy: { orden: "asc" },
      include: {
        _count: { select: { productos: { where: { estado: "ACTIVO" } } } },
      },
    });

    res.json(
      categorias.map((c) => ({
        id: c.id,
        nombre: c.nombre,
        slug: c.slug,
        icono: c.icono,
        imagenUrl: c.imagenUrl,
        totalProductos: c._count.productos,
      }))
    );
  } catch (err) {
    next(err);
  }
}

// GET /api/categorias/admin — admin, incluye inactivas
export async function listarCategoriasAdmin(req: Request, res: Response, next: NextFunction) {
  try {
    const categorias = await prisma.categoria.findMany({
      orderBy: { orden: "asc" },
      include: { _count: { select: { productos: true } } },
    });
    res.json(categorias);
  } catch (err) {
    next(err);
  }
}

// POST /api/categorias — admin
export async function crearCategoria(req: Request, res: Response, next: NextFunction) {
  try {
    const datos = categoriaSchema.parse(req.body);
    const existente = await prisma.categoria.findUnique({ where: { slug: datos.slug } });
    if (existente) throw new ApiError(409, "Ya existe una categoría con ese slug");

    const categoria = await prisma.categoria.create({ data: datos });
    res.status(201).json(categoria);
  } catch (err) {
    next(err);
  }
}

// PUT /api/categorias/:id — admin
export async function actualizarCategoria(req: Request, res: Response, next: NextFunction) {
  try {
    const datos = categoriaSchema.partial().parse(req.body);
    const categoria = await prisma.categoria.update({
      where: { id: req.params.id },
      data: datos,
    });
    res.json(categoria);
  } catch (err) {
    next(err);
  }
}

// DELETE /api/categorias/:id — admin (soft delete: la desactiva, no borra productos huérfanos)
export async function eliminarCategoria(req: Request, res: Response, next: NextFunction) {
  try {
    const categoria = await prisma.categoria.update({
      where: { id: req.params.id },
      data: { activa: false },
    });
    res.json({ mensaje: "Categoría desactivada", categoria });
  } catch (err) {
    next(err);
  }
}
