import cors from "cors";
import express from "express";
import { env } from "./config";
import { errorHandler } from "./lib/errors";
import { authRouter } from "./routes/auth";
import { servicesRouter } from "./routes/services";
import { ticketsRouter } from "./routes/tickets";
import { usersRouter } from "./routes/users";

export const app = express();

app.use(cors({ origin: env.CORS_ORIGIN === "*" ? true : env.CORS_ORIGIN.split(",") }));
app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.use(authRouter);
app.use(usersRouter);
app.use(servicesRouter);
app.use(ticketsRouter);

app.use((_req, res) => {
  res.status(404).json({ message: "Route not found" });
});
app.use(errorHandler);
