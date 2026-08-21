import { Router } from "express";
import {
  listarDirecciones,
  crearDireccion,
  actualizarDireccion,
  eliminarDireccion,
} from "../controllers/direcciones.controller";
import { requireAuth } from "../middlewares/auth";

const router = Router();

router.use(requireAuth); // todas requieren estar logueado

router.get("/", listarDirecciones);
router.post("/", crearDireccion);
router.put("/:id", actualizarDireccion);
router.delete("/:id", eliminarDireccion);

export default router;
