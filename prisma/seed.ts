import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("Sembrando categorías base...");

  const categorias = [
    { nombre: "Tecnología", slug: "tecnologia", icono: "cpu" },
    { nombre: "Computación", slug: "computacion", icono: "monitor" },
    { nombre: "Gaming", slug: "gaming", icono: "gamepad" },
    { nombre: "Audio", slug: "audio", icono: "headphones" },
    { nombre: "Entretenimiento", slug: "entretenimiento", icono: "tv" },
    { nombre: "Hogar", slug: "hogar", icono: "home" },
    { nombre: "Accesorios", slug: "accesorios", icono: "watch" },
    { nombre: "Otros", slug: "otros", icono: "grid" },
  ];

  for (const [index, cat] of categorias.entries()) {
    await prisma.categoria.upsert({
      where: { slug: cat.slug },
      update: {},
      create: { ...cat, orden: index },
    });
  }

  console.log("Creando usuario administrador...");
  const passwordHash = await bcrypt.hash("CambiarEstaClave123!", 12);

  await prisma.usuario.upsert({
    where: { email: "admin@salfer.com" },
    update: {},
    create: {
      nombre: "Admin SALFER",
      email: "admin@salfer.com",
      passwordHash,
      rol: "ADMIN",
      emailVerificado: true,
    },
  });

  console.log("Seed completado.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
