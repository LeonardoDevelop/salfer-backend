import { Router } from "express";
import authRoutes from "./auth.routes";
import categoriasRoutes from "./categorias.routes";
import productosRoutes from "./productos.routes";
import direccionesRoutes from "./direcciones.routes";
import carritoRoutes from "./carrito.routes";
import pedidosRoutes from "./pedidos.routes";
import pagosRoutes from "./pagos.routes";

const router = Router();

router.use("/auth", authRoutes);
router.use("/categorias", categoriasRoutes);
router.use("/productos", productosRoutes);
router.use("/direcciones", direccionesRoutes);
router.use("/carrito", carritoRoutes);
router.use("/pedidos", pedidosRoutes);
router.use("/pagos", pagosRoutes);

// Próximas fases se agregan aquí:
// router.use("/admin", adminRoutes); // dashboard, reportes

export default router;
