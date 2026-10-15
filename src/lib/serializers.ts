import { Prisma, User } from "@prisma/client";
import { sumCents } from "./schedule";

export function publicUser(u: User) {
  const { passwordHash: _p, ...rest } = u;
  return rest;
}

export const ticketInclude = {
  client: true,
  technician: true,
  services: { include: { service: true }, orderBy: { createdAt: "asc" } },
} satisfies Prisma.TicketInclude;

export type TicketFull = Prisma.TicketGetPayload<{ include: typeof ticketInclude }>;

export function serializeTicket(t: TicketFull) {
  return {
    id: t.id,
    title: t.title,
    description: t.description,
    status: t.status,
    scheduledDate: t.scheduledDate,
    scheduledTime: t.scheduledTime,
    createdAt: t.createdAt,
    updatedAt: t.updatedAt,
    client: { id: t.client.id, name: t.client.name, email: t.client.email, avatarUrl: t.client.avatarUrl },
    technician: {
      id: t.technician.id,
      name: t.technician.name,
      email: t.technician.email,
      avatarUrl: t.technician.avatarUrl,
    },
    services: t.services.map((s) => ({
      id: s.id,
      serviceId: s.serviceId,
      title: s.service.title,
      priceCents: s.priceCents,
      additional: s.additional,
    })),
    totalCents: sumCents(t.services),
  };
}
