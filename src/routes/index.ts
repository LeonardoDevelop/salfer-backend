import { Router } from "express";
import authRoutes from "./auth.routes";
import categoriasRoutes from "./categorias.routes";
import productosRoutes from "./productos.routes";
import direccionesRoutes from "./direcciones.routes";
import carritoRoutes from "./carrito.routes";
import pedidosRoutes from "./pedidos.routes";
import pagosRoutes from "./pagos.routes";
import adminRoutes from "./admin.routes";

const router = Router();

router.use("/auth", authRoutes);
router.use("/categorias", categoriasRoutes);
router.use("/productos", productosRoutes);
router.use("/direcciones", direccionesRoutes);
router.use("/carrito", carritoRoutes);
router.use("/pedidos", pedidosRoutes);
router.use("/pagos", pagosRoutes);
router.use("/admin", adminRoutes);

export default router;
