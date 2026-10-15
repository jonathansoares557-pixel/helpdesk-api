import "dotenv/config";
import { PrismaClient, Role } from "@prisma/client";
import bcrypt from "bcryptjs";
import { buildSlots } from "../src/lib/schedule";

const prisma = new PrismaClient();

async function main() {
  const hash = (p: string) => bcrypt.hash(p, 10);

  await prisma.user.upsert({
    where: { email: "admin@helpdesk.com" },
    update: {},
    create: { name: "Administrador", email: "admin@helpdesk.com", passwordHash: await hash("123456"), role: Role.ADMIN },
  });

  const technicians = [
    { name: "Carlos Silva", email: "tecnico1@helpdesk.com", ranges: [[8, 12], [14, 18]] },
    { name: "Ana Souza", email: "tecnico2@helpdesk.com", ranges: [[10, 14], [16, 20]] },
    { name: "Marcos Lima", email: "tecnico3@helpdesk.com", ranges: [[12, 16], [18, 22]] },
  ] as const;
  for (const t of technicians) {
    const availability = buildSlots(t.ranges.map(([a, b]) => [a, b] as [number, number]));
    await prisma.user.upsert({
      where: { email: t.email },
      update: { availability },
      create: { name: t.name, email: t.email, passwordHash: await hash("123456"), role: Role.TECHNICIAN, availability },
    });
  }

  await prisma.user.upsert({
    where: { email: "cliente@helpdesk.com" },
    update: {},
    create: { name: "Cliente Exemplo", email: "cliente@helpdesk.com", passwordHash: await hash("123456"), role: Role.CLIENT },
  });

  const services = [
    ["Instalação e atualização de softwares", 8000],
    ["Instalação e atualização de hardwares", 15000],
    ["Diagnóstico e remoção de vírus", 12000],
    ["Suporte a impressoras", 7000],
    ["Suporte a periféricos", 5000],
    ["Solução de problemas de conectividade de internet", 10000],
    ["Backup e recuperação de dados", 18000],
    ["Otimização de desempenho do sistema operacional", 9000],
    ["Configuração de VPN e acesso remoto", 14000],
  ] as const;
  for (const [title, priceCents] of services) {
    if (!(await prisma.service.findFirst({ where: { title } }))) await prisma.service.create({ data: { title, priceCents } });
  }
  console.log("Seed completed");
}

main().finally(() => prisma.$disconnect());
