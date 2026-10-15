import bcrypt from "bcryptjs";
import request from "supertest";

jest.mock("../src/lib/prisma", () => ({
  prisma: {
    user: { findUnique: jest.fn(), create: jest.fn(), findMany: jest.fn() },
    service: { findMany: jest.fn() },
    ticket: { findMany: jest.fn() },
  },
}));

import { app } from "../src/app";
import { signToken } from "../src/middleware/auth";
import { prisma } from "../src/lib/prisma";

const db = prisma as unknown as {
  user: { findUnique: jest.Mock; create: jest.Mock; findMany: jest.Mock };
  service: { findMany: jest.Mock };
};

const baseUser = {
  id: "11111111-1111-4111-8111-111111111111",
  name: "Test",
  email: "t@t.com",
  role: "CLIENT",
  avatarUrl: null,
  availability: [],
  mustChangePassword: false,
};

describe("API", () => {
  beforeEach(() => jest.clearAllMocks());

  it("health check", async () => {
    const res = await request(app).get("/health");
    expect(res.status).toBe(200);
  });

  it("rejects requests without token", async () => {
    expect((await request(app).get("/tickets")).status).toBe(401);
  });

  it("login succeeds with valid credentials and hides the hash", async () => {
    db.user.findUnique.mockResolvedValue({ ...baseUser, passwordHash: await bcrypt.hash("123456", 4) });
    const res = await request(app).post("/auth/login").send({ email: "t@t.com", password: "123456" });
    expect(res.status).toBe(200);
    expect(res.body.token).toBeDefined();
    expect(res.body.user.passwordHash).toBeUndefined();
  });

  it("login fails with wrong password", async () => {
    db.user.findUnique.mockResolvedValue({ ...baseUser, passwordHash: await bcrypt.hash("123456", 4) });
    const res = await request(app).post("/auth/login").send({ email: "t@t.com", password: "wrong" });
    expect(res.status).toBe(401);
  });

  it("validates register payload with zod", async () => {
    const res = await request(app).post("/auth/register").send({ name: "A", email: "bad", password: "1" });
    expect(res.status).toBe(400);
    expect(res.body.issues.length).toBeGreaterThan(0);
  });

  it("forbids a client from creating a technician", async () => {
    const token = signToken({ sub: baseUser.id, role: "CLIENT" });
    const res = await request(app)
      .post("/technicians")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "Tech", email: "x@x.com", password: "123456" });
    expect(res.status).toBe(403);
  });

  it("only lists active services to non-admins", async () => {
    db.service.findMany.mockResolvedValue([]);
    const token = signToken({ sub: baseUser.id, role: "CLIENT" });
    await request(app).get("/services").set("Authorization", `Bearer ${token}`);
    expect(db.service.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { active: true } }));
  });

  it("forbids a technician from creating tickets", async () => {
    const token = signToken({ sub: baseUser.id, role: "TECHNICIAN" });
    const res = await request(app).post("/tickets").set("Authorization", `Bearer ${token}`).send({});
    expect(res.status).toBe(403);
  });
});
