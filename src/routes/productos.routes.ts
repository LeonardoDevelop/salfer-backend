import { Router } from "express";
import {
  listarProductos,
  obtenerProductoPorSlug,
  crearProducto,
  actualizarProducto,
  cambiarEstadoProducto,
  eliminarProducto,
  listarProductosAdmin,
} from "../controllers/productos.controller";
import { requireAuth, requireRole } from "../middlewares/auth";

const router = Router();

// Públicas
router.get("/", listarProductos);
router.get("/admin/todos", requireAuth, requireRole("ADMIN"), listarProductosAdmin);
router.get("/:slug", obtenerProductoPorSlug);

// Admin
router.post("/", requireAuth, requireRole("ADMIN"), crearProducto);
router.put("/:id", requireAuth, requireRole("ADMIN"), actualizarProducto);
router.patch("/:id/estado", requireAuth, requireRole("ADMIN"), cambiarEstadoProducto);
router.delete("/:id", requireAuth, requireRole("ADMIN"), eliminarProducto);

export default router;
