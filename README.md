# SALFER — Backend

API REST del ecommerce SALFER. Node.js + Express + TypeScript + Prisma + PostgreSQL.

## Requisitos

- Node.js 20+
- PostgreSQL 14+ (local, Docker, o un servicio como Railway/Supabase)

## Puesta en marcha

```bash
# 1. Instalar dependencias
npm install

# 2. Configurar variables de entorno
cp .env.example .env
# edita .env con tu cadena de conexión real a PostgreSQL y un JWT_SECRET propio

# 3. Crear las tablas en la base de datos (primera migración)
npx prisma migrate dev --name init

# 4. Poblar datos base (categorías + usuario admin)
npm run prisma:seed

# 5. Levantar el servidor en modo desarrollo
npm run dev
```

El servidor corre por defecto en `http://localhost:4000`.
Verifica que está vivo en: `GET http://localhost:4000/health`

## Endpoints implementados (Fase 1)

| Método | Ruta                | Descripción                    |
|--------|---------------------|---------------------------------|
| POST   | /api/auth/registro  | Crea una cuenta de cliente      |
| POST   | /api/auth/login     | Inicia sesión, devuelve JWT     |

Usuario admin sembrado por el seed:
- email: `admin@salfer.com`
- password: `CambiarEstaClave123!` (cámbiala apenas tengas acceso)

## Estructura del proyecto

```
src/
  config/       → conexión a Prisma, configuración general
  controllers/  → lógica de cada endpoint
  routes/       → definición de rutas de la API
  middlewares/  → autenticación (JWT), manejo de errores, roles
  services/     → lógica de negocio reutilizable (se llena en próximas fases)
  utils/        → helpers
prisma/
  schema.prisma → modelo completo de datos
  seed.ts       → datos iniciales
```

## Próximas fases

2. Catálogo público: productos, categorías, filtros, búsqueda
3. Carrito y checkout
4. Panel administrativo (productos, pedidos, inventario, dashboard)
5. Integración de pasarela de pago real (QR + tarjeta)
6. Frontend Angular consumiendo esta API
