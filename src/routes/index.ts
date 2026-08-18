import { Router } from "express";
import authRoutes from "./auth.routes";

const router = Router();

router.use("/auth", authRoutes);

// Próximas fases se agregan aquí:
// router.use("/productos", productosRoutes);
// router.use("/categorias", categoriasRoutes);
// router.use("/carrito", carritoRoutes);
// router.use("/pedidos", pedidosRoutes);
// router.use("/pagos", pagosRoutes);
// router.use("/admin", adminRoutes);

export default router;
