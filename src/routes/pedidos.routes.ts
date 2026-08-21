import { Router } from "express";
import {
  crearPedido,
  listarMisPedidos,
  obtenerPedido,
  listarPedidosAdmin,
  cambiarEstadoPedido,
} from "../controllers/pedidos.controller";
import { requireAuth, requireRole } from "../middlewares/auth";

const router = Router();

router.use(requireAuth);

router.post("/", crearPedido);
router.get("/", listarMisPedidos);
router.get("/admin/todos", requireRole("ADMIN"), listarPedidosAdmin);
router.get("/:id", obtenerPedido);
router.patch("/:id/estado", requireRole("ADMIN"), cambiarEstadoPedido);

export default router;
