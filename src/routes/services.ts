import { Role } from "@prisma/client";
import { Router } from "express";
import { z } from "zod";
import { AppError, asyncHandler } from "../lib/errors";
import { prisma } from "../lib/prisma";
import { authenticate, authorize } from "../middleware/auth";

export const servicesRouter = Router();
servicesRouter.use(authenticate);

const body = z.object({
  title: z.string().trim().min(2),
  description: z.string().trim().optional(),
  priceCents: z.number().int().positive(),
});

// Admin sees every service (including inactive); others only active ones.
servicesRouter.get(
  "/services",
  asyncHandler(async (req, res) => {
    const where = req.auth!.role === Role.ADMIN ? {} : { active: true };
    res.json(await prisma.service.findMany({ where, orderBy: { title: "asc" } }));
  }),
);

servicesRouter.post(
  "/services",
  authorize(Role.ADMIN),
  asyncHandler(async (req, res) => {
    res.status(201).json(await prisma.service.create({ data: body.parse(req.body) }));
  }),
);

servicesRouter.put(
  "/services/:id",
  authorize(Role.ADMIN),
  asyncHandler(async (req, res) => {
    const data = body.partial().extend({ active: z.boolean().optional() }).parse(req.body);
    if (!(await prisma.service.findUnique({ where: { id: String(req.params.id) } }))) throw new AppError("Service not found", 404);
    res.json(await prisma.service.update({ where: { id: String(req.params.id) }, data }));
  }),
);

// Soft delete: the service stays on existing tickets but is no longer offered.
servicesRouter.patch(
  "/services/:id/deactivate",
  authorize(Role.ADMIN),
  asyncHandler(async (req, res) => {
    if (!(await prisma.service.findUnique({ where: { id: String(req.params.id) } }))) throw new AppError("Service not found", 404);
    res.json(await prisma.service.update({ where: { id: String(req.params.id) }, data: { active: false } }));
  }),
);
