import { Router } from "express";
import { obtenerEstadoPago, confirmarPago } from "../controllers/pagos.controller";
import { requireAuth } from "../middlewares/auth";

const router = Router();

router.use(requireAuth);

router.get("/:pedidoId", obtenerEstadoPago);
router.patch("/:pedidoId/confirmar", confirmarPago);

export default router;
