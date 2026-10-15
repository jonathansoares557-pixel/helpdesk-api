import { Role } from "@prisma/client";
import bcrypt from "bcryptjs";
import { Router } from "express";
import multer from "multer";
import { z } from "zod";
import { AppError, asyncHandler } from "../lib/errors";
import { prisma } from "../lib/prisma";
import { publicUser } from "../lib/serializers";
import { authenticate, authorize, signToken } from "../middleware/auth";

export const authRouter = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 1024 * 1024 },
  fileFilter: (_req, file, cb) =>
    /^image\/(png|jpe?g|webp|gif)$/.test(file.mimetype) ? cb(null, true) : cb(new AppError("Only images are allowed")),
});

const credentials = z.object({
  name: z.string().trim().min(2),
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(6),
});

authRouter.post(
  "/auth/register",
  asyncHandler(async (req, res) => {
    const data = credentials.parse(req.body);
    if (await prisma.user.findUnique({ where: { email: data.email } })) throw new AppError("E-mail already in use", 409);
    const user = await prisma.user.create({
      data: { name: data.name, email: data.email, passwordHash: await bcrypt.hash(data.password, 10), role: Role.CLIENT },
    });
    res.status(201).json({ token: signToken({ sub: user.id, role: user.role }), user: publicUser(user) });
  }),
);

authRouter.post(
  "/auth/login",
  asyncHandler(async (req, res) => {
    const { email, password } = z
      .object({ email: z.string().trim().toLowerCase().email(), password: z.string().min(1) })
      .parse(req.body);
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !(await bcrypt.compare(password, user.passwordHash))) throw new AppError("Invalid credentials", 401);
    res.json({ token: signToken({ sub: user.id, role: user.role }), user: publicUser(user) });
  }),
);

authRouter.use("/me", authenticate);

authRouter.get(
  "/me",
  asyncHandler(async (req, res) => {
    const user = await prisma.user.findUnique({ where: { id: req.auth!.sub } });
    if (!user) throw new AppError("User not found", 404);
    res.json(publicUser(user));
  }),
);

const timeSlot = z.string().regex(/^([01]\d|2[0-3]):00$/, "Use HH:00");

authRouter.put(
  "/me",
  asyncHandler(async (req, res) => {
    const data = z
      .object({
        name: z.string().trim().min(2).optional(),
        email: z.string().trim().toLowerCase().email().optional(),
        availability: z.array(timeSlot).optional(),
      })
      .parse(req.body);
    const id = req.auth!.sub;
    if (data.email) {
      const other = await prisma.user.findUnique({ where: { email: data.email } });
      if (other && other.id !== id) throw new AppError("E-mail already in use", 409);
    }
    // Only technicians may change availability
    if (data.availability && req.auth!.role !== Role.TECHNICIAN) delete data.availability;
    const user = await prisma.user.update({ where: { id }, data });
    res.json(publicUser(user));
  }),
);

authRouter.put(
  "/me/password",
  asyncHandler(async (req, res) => {
    const { currentPassword, newPassword } = z
      .object({ currentPassword: z.string().min(1), newPassword: z.string().min(6) })
      .parse(req.body);
    const user = await prisma.user.findUnique({ where: { id: req.auth!.sub } });
    if (!user || !(await bcrypt.compare(currentPassword, user.passwordHash))) throw new AppError("Current password is incorrect", 400);
    const updated = await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: await bcrypt.hash(newPassword, 10), mustChangePassword: false },
    });
    res.json(publicUser(updated));
  }),
);

authRouter.post(
  "/me/avatar",
  upload.single("avatar"),
  asyncHandler(async (req, res) => {
    if (!req.file) throw new AppError("Image file is required (field 'avatar')");
    const avatarUrl = `data:${req.file.mimetype};base64,${req.file.buffer.toString("base64")}`;
    const user = await prisma.user.update({ where: { id: req.auth!.sub }, data: { avatarUrl } });
    res.json(publicUser(user));
  }),
);

// A client may delete their own account (their tickets are removed by cascade).
authRouter.delete(
  "/me",
  authorize(Role.CLIENT),
  asyncHandler(async (req, res) => {
    await prisma.user.delete({ where: { id: req.auth!.sub } });
    res.status(204).send();
  }),
);
