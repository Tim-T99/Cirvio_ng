import express, { Application, Request, Response, NextFunction } from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";

import adminRoutes from "./src/routes/admin.routes";
import tenantRoutes from "./src/routes/tenant.routes";
import userRoutes from "./src/routes/user.routes";
import employeeRoutes from "./src/routes/employee.routes";
import visaRoutes from "./src/routes/visa.routes";
import wpsRoutes from "./src/routes/wps.routes";
import documentRoutes from "./src/routes/document.routes";

import { startVisaAlertJob } from "./src/jobs/visaAlert.job";
import { startWpsAlertJob } from "./src/jobs/wpsAlert.job";

const app: Application = express();

// ─── Security & Parsing ────────────────────────────────────────────────────
app.use(helmet());
app.use(
  cors({
    origin: process.env.ALLOWED_ORIGINS?.split(",") ?? "*",
    methods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Authorization", "Content-Type"],
  })
);
app.use(express.json({ limit: "1mb" }));
app.use(morgan(process.env.NODE_ENV === "production" ? "combined" : "dev"));

// ─── Health Check ──────────────────────────────────────────────────────────
app.get("/health", (_req: Request, res: Response) => {
  res.json({ status: "ok", ts: new Date().toISOString() });
});

// ─── Admin Portal Routes (no tenantId context) ─────────────────────────────
app.use("/api/admin", adminRoutes);

// ─── Tenant Portal Routes (all require tenantId from JWT) ──────────────────
app.use("/api/tenant", tenantRoutes);
app.use("/api/users", userRoutes);
app.use("/api/employees", employeeRoutes);
app.use("/api/visas", visaRoutes);
app.use("/api/wps", wpsRoutes);
app.use("/api/documents", documentRoutes);

// ─── 404 Handler ───────────────────────────────────────────────────────────
app.use((_req: Request, res: Response) => {
  res.status(404).json({ error: "Route not found." });
});

// ─── Global Error Handler ──────────────────────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error("[app] Unhandled error:", err);
  res.status(500).json({ error: "Internal server error." });
});

// ─── Cron Jobs ─────────────────────────────────────────────────────────────
if (process.env.ENABLE_JOBS !== "false") {
  startVisaAlertJob();
  startWpsAlertJob();
}

export default app;