import { Role } from "@prisma/client";
import bcrypt from "bcryptjs";
import { Router } from "express";
import { z } from "zod";
import { AppError, asyncHandler } from "../lib/errors";
import { prisma } from "../lib/prisma";
import { DEFAULT_AVAILABILITY, freeSlots } from "../lib/schedule";
import { publicUser } from "../lib/serializers";
import { authenticate, authorize } from "../middleware/auth";

export const usersRouter = Router();
usersRouter.use(authenticate);

const timeSlot = z.string().regex(/^([01]\d|2[0-3]):00$/, "Use HH:00");

// ---------- Technicians ----------

// Any authenticated user can list technicians (clients choose one when opening a ticket).
usersRouter.get(
  "/technicians",
  asyncHandler(async (_req, res) => {
    const list = await prisma.user.findMany({ where: { role: Role.TECHNICIAN }, orderBy: { name: "asc" } });
    res.json(list.map(publicUser));
  }),
);

// Free hourly slots of a technician on a date (excludes slots used by non-closed tickets).
usersRouter.get(
  "/technicians/:id/slots",
  asyncHandler(async (req, res) => {
    const { date } = z.object({ date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) }).parse(req.query);
    const tech = await prisma.user.findFirst({ where: { id: String(req.params.id), role: Role.TECHNICIAN } });
    if (!tech) throw new AppError("Technician not found", 404);
    const busy = await prisma.ticket.findMany({
      where: { technicianId: tech.id, scheduledDate: date, status: { not: "CLOSED" } },
      select: { scheduledTime: true },
    });
    res.json({ date, slots: freeSlots(tech.availability, busy.map((b) => b.scheduledTime)) });
  }),
);

usersRouter.post(
  "/technicians",
  authorize(Role.ADMIN),
  asyncHandler(async (req, res) => {
    const data = z
      .object({
        name: z.string().trim().min(2),
        email: z.string().trim().toLowerCase().email(),
        password: z.string().min(6), // temporary password defined by the admin
        availability: z.array(timeSlot).min(1).default(DEFAULT_AVAILABILITY),
      })
      .parse(req.body);
    if (await prisma.user.findUnique({ where: { email: data.email } })) throw new AppError("E-mail already in use", 409);
    const user = await prisma.user.create({
      data: {
        name: data.name,
        email: data.email,
        passwordHash: await bcrypt.hash(data.password, 10),
        role: Role.TECHNICIAN,
        availability: data.availability,
        mustChangePassword: true,
      },
    });
    res.status(201).json(publicUser(user));
  }),
);

usersRouter.put(
  "/technicians/:id",
  authorize(Role.ADMIN),
  asyncHandler(async (req, res) => {
    const data = z
      .object({
        name: z.string().trim().min(2).optional(),
        email: z.string().trim().toLowerCase().email().optional(),
        availability: z.array(timeSlot).min(1).optional(),
      })
      .parse(req.body);
    const tech = await prisma.user.findFirst({ where: { id: String(req.params.id), role: Role.TECHNICIAN } });
    if (!tech) throw new AppError("Technician not found", 404);
    if (data.email) {
      const other = await prisma.user.findUnique({ where: { email: data.email } });
      if (other && other.id !== tech.id) throw new AppError("E-mail already in use", 409);
    }
    res.json(publicUser(await prisma.user.update({ where: { id: tech.id }, data })));
  }),
);

// ---------- Clients (admin) ----------

usersRouter.get(
  "/clients",
  authorize(Role.ADMIN),
  asyncHandler(async (_req, res) => {
    const list = await prisma.user.findMany({ where: { role: Role.CLIENT }, orderBy: { name: "asc" } });
    res.json(list.map(publicUser));
  }),
);

usersRouter.put(
  "/clients/:id",
  authorize(Role.ADMIN),
  asyncHandler(async (req, res) => {
    const data = z
      .object({ name: z.string().trim().min(2).optional(), email: z.string().trim().toLowerCase().email().optional() })
      .parse(req.body);
    const client = await prisma.user.findFirst({ where: { id: String(req.params.id), role: Role.CLIENT } });
    if (!client) throw new AppError("Client not found", 404);
    if (data.email) {
      const other = await prisma.user.findUnique({ where: { email: data.email } });
      if (other && other.id !== client.id) throw new AppError("E-mail already in use", 409);
    }
    res.json(publicUser(await prisma.user.update({ where: { id: client.id }, data })));
  }),
);

usersRouter.delete(
  "/clients/:id",
  authorize(Role.ADMIN),
  asyncHandler(async (req, res) => {
    const client = await prisma.user.findFirst({ where: { id: String(req.params.id), role: Role.CLIENT } });
    if (!client) throw new AppError("Client not found", 404);
    await prisma.user.delete({ where: { id: client.id } }); // tickets removed by cascade
    res.status(204).send();
  }),
);
