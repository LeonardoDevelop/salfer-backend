import { Router } from "express";
import authRoutes from "./auth.routes";
import categoriasRoutes from "./categorias.routes";
import productosRoutes from "./productos.routes";

const router = Router();

router.use("/auth", authRoutes);
router.use("/categorias", categoriasRoutes);
router.use("/productos", productosRoutes);

// Próximas fases se agregan aquí:
// router.use("/carrito", carritoRoutes);
// router.use("/pedidos", pedidosRoutes);
// router.use("/pagos", pagosRoutes);
// router.use("/admin", adminRoutes);

export default router;