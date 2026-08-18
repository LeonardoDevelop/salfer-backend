import "dotenv/config";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import rateLimit from "express-rate-limit";
import routes from "./routes";
import { errorHandler, notFoundHandler } from "./middlewares/errorHandler";

const app = express();
const PORT = process.env.PORT || 4000;

// Seguridad y utilidades base
app.use(helmet());
app.use(cors({ origin: process.env.FRONTEND_URL || "http://localhost:4200", credentials: true }));
app.use(express.json({ limit: "2mb" }));
app.use(morgan(process.env.NODE_ENV === "development" ? "dev" : "combined"));

// Rate limiting general (protección básica contra abuso/brute-force)
app.use(
  rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 300,
    standardHeaders: true,
    legacyHeaders: false,
  })
);

app.get("/health", (req, res) => {
  res.json({ status: "ok", proyecto: "SALFER API", timestamp: new Date().toISOString() });
});

app.use("/api", routes);

app.use(notFoundHandler);
app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`SALFER API corriendo en http://localhost:${PORT}`);
});
