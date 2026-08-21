import { Router } from "express";
import {
  obtenerCarrito,
  agregarItem,
  actualizarCantidad,
  eliminarItem,
  vaciarCarrito,
} from "../controllers/carrito.controller";
import { requireAuth } from "../middlewares/auth";

const router = Router();

router.use(requireAuth);

router.get("/", obtenerCarrito);
router.post("/items", agregarItem);
router.put("/items/:productoId", actualizarCantidad);
router.delete("/items/:productoId", eliminarItem);
router.delete("/", vaciarCarrito);

export default router;
