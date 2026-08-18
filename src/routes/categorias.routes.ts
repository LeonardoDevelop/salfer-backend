import { Router } from "express";
import {
  listarCategorias,
  listarCategoriasAdmin,
  crearCategoria,
  actualizarCategoria,
  eliminarCategoria,
} from "../controllers/categorias.controller";
import { requireAuth, requireRole } from "../middlewares/auth";

const router = Router();

// Públicas
router.get("/", listarCategorias);

// Admin
router.get("/admin", requireAuth, requireRole("ADMIN"), listarCategoriasAdmin);
router.post("/", requireAuth, requireRole("ADMIN"), crearCategoria);
router.put("/:id", requireAuth, requireRole("ADMIN"), actualizarCategoria);
router.delete("/:id", requireAuth, requireRole("ADMIN"), eliminarCategoria);

export default router;
