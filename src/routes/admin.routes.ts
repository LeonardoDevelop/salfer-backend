import { Router } from "express";
import { obtenerDashboard } from "../controllers/dashboard.controller";
import { obtenerInventario, ajustarStock, historialMovimientos } from "../controllers/inventario.controller";
import { listarClientes, obtenerClientePerfil } from "../controllers/clientes.controller";
import { requireAuth, requireRole } from "../middlewares/auth";

const router = Router();

router.use(requireAuth, requireRole("ADMIN"));

router.get("/dashboard", obtenerDashboard);

router.get("/inventario", obtenerInventario);
router.patch("/inventario/:productoId", ajustarStock);
router.get("/inventario/:productoId/movimientos", historialMovimientos);

router.get("/clientes", listarClientes);
router.get("/clientes/:id", obtenerClientePerfil);

export default router;
