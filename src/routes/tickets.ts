import { Role, TicketStatus } from "@prisma/client";
import { Router } from "express";
import { z } from "zod";
import { AppError, asyncHandler } from "../lib/errors";
import { prisma } from "../lib/prisma";
import { canTransition } from "../lib/schedule";
import { serializeTicket, ticketInclude } from "../lib/serializers";
import { authenticate, authorize } from "../middleware/auth";

export const ticketsRouter = Router();
ticketsRouter.use(authenticate);

async function loadTicket(id: string, auth: NonNullable<Express.Request["auth"]>) {
  const ticket = await prisma.ticket.findUnique({ where: { id }, include: ticketInclude });
  if (!ticket) throw new AppError("Ticket not found", 404);
  const allowed =
    auth.role === Role.ADMIN ||
    (auth.role === Role.CLIENT && ticket.clientId === auth.sub) ||
    (auth.role === Role.TECHNICIAN && ticket.technicianId === auth.sub);
  if (!allowed) throw new AppError("Forbidden", 403);
  return ticket;
}

// Admin: all. Technician: assigned to them. Client: own history.
ticketsRouter.get(
  "/tickets",
  asyncHandler(async (req, res) => {
    const { role, sub } = req.auth!;
    const where = role === Role.ADMIN ? {} : role === Role.TECHNICIAN ? { technicianId: sub } : { clientId: sub };
    const list = await prisma.ticket.findMany({ where, include: ticketInclude, orderBy: { createdAt: "desc" } });
    res.json(list.map(serializeTicket));
  }),
);

ticketsRouter.get(
  "/tickets/:id",
  asyncHandler(async (req, res) => {
    res.json(serializeTicket(await loadTicket(String(req.params.id), req.auth!)));
  }),
);

ticketsRouter.post(
  "/tickets",
  authorize(Role.CLIENT),
  asyncHandler(async (req, res) => {
    const data = z
      .object({
        title: z.string().trim().min(3),
        description: z.string().trim().min(3),
        serviceId: z.string().uuid(),
        technicianId: z.string().uuid(),
        scheduledDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        scheduledTime: z.string().regex(/^([01]\d|2[0-3]):00$/),
      })
      .parse(req.body);

    const [service, tech] = await Promise.all([
      prisma.service.findUnique({ where: { id: data.serviceId } }),
      prisma.user.findFirst({ where: { id: data.technicianId, role: Role.TECHNICIAN } }),
    ]);
    if (!service || !service.active) throw new AppError("Service not available", 400);
    if (!tech) throw new AppError("Technician not found", 404);
    if (!tech.availability.includes(data.scheduledTime)) throw new AppError("Technician is not available at this time", 400);
    const conflict = await prisma.ticket.findFirst({
      where: {
        technicianId: tech.id,
        scheduledDate: data.scheduledDate,
        scheduledTime: data.scheduledTime,
        status: { not: TicketStatus.CLOSED },
      },
    });
    if (conflict) throw new AppError("This time slot is already booked", 409);

    const ticket = await prisma.ticket.create({
      data: {
        title: data.title,
        description: data.description,
        scheduledDate: data.scheduledDate,
        scheduledTime: data.scheduledTime,
        clientId: req.auth!.sub,
        technicianId: tech.id,
        services: { create: { serviceId: service.id, priceCents: service.priceCents } },
      },
      include: ticketInclude,
    });
    res.status(201).json(serializeTicket(ticket));
  }),
);

ticketsRouter.patch(
  "/tickets/:id/status",
  authorize(Role.ADMIN, Role.TECHNICIAN),
  asyncHandler(async (req, res) => {
    const { status } = z.object({ status: z.nativeEnum(TicketStatus) }).parse(req.body);
    const ticket = await loadTicket(String(req.params.id), req.auth!);
    // The admin may set any status; the technician only moves the ticket forward.
    if (req.auth!.role === Role.TECHNICIAN && !canTransition(ticket.status, status)) {
      throw new AppError(`Cannot change status from ${ticket.status} to ${status}`, 400);
    }
    const updated = await prisma.ticket.update({ where: { id: ticket.id }, data: { status }, include: ticketInclude });
    res.json(serializeTicket(updated));
  }),
);

ticketsRouter.post(
  "/tickets/:id/services",
  authorize(Role.TECHNICIAN),
  asyncHandler(async (req, res) => {
    const { serviceId } = z.object({ serviceId: z.string().uuid() }).parse(req.body);
    const ticket = await loadTicket(String(req.params.id), req.auth!);
    if (ticket.status === TicketStatus.CLOSED) throw new AppError("Ticket is closed", 400);
    const service = await prisma.service.findUnique({ where: { id: serviceId } });
    if (!service || !service.active) throw new AppError("Service not available", 400);
    await prisma.ticketService.create({
      data: { ticketId: ticket.id, serviceId, priceCents: service.priceCents, additional: true },
    });
    res.status(201).json(serializeTicket(await loadTicket(ticket.id, req.auth!)));
  }),
);
