import express, { Application, Request, Response, NextFunction } from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";

import adminRoutes from "./src/routes/admin.routes";
import tenantRoutes from "./src/routes/tenant.routes";
import userRoutes from "./src/routes/user.routes";
import oauthRoutes from "./src/routes/oauth.routes";
import employeeRoutes from "./src/routes/employee.routes";
import visaRoutes from "./src/routes/visa.routes";
import wpsRoutes from "./src/routes/wps.routes";
import documentRoutes from "./src/routes/document.routes";
import uploadRoutes from "./src/routes/upload.routes";

import {
  globalLimiter,
  apiLimiter,
} from "./src/middleware/rateLimit.middleware";

import { startVisaAlertJob } from "./src/jobs/visaAlert.job";
import { startWpsAlertJob } from "./src/jobs/wpsAlert.job";

const app: Application = express();

// ─── Trust proxy ───────────────────────────────────────────────────────────
// Required so req.ip reflects the real client IP when behind nginx/Cloudflare.
// Set TRUST_PROXY=1 in production; leave unset in local dev (no proxy).
if (process.env.TRUST_PROXY) {
  app.set("trust proxy", parseInt(process.env.TRUST_PROXY, 10) || 1);
}

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

// ─── Global rate limit (all /api/* routes) ────────────────────────────────
// 300 req / 15 min per IP — catches runaway clients before any route logic.
// Route-specific limiters below add a second tighter layer on sensitive paths.
app.use("/api", globalLimiter);

// ─── Health Check (excluded from global limiter — used by load balancers) ──
app.get("/health", (_req: Request, res: Response) => {
  res.json({ status: "ok", ts: new Date().toISOString() });
});

// ─── Admin Portal Routes ───────────────────────────────────────────────────
app.use("/api/admin", adminRoutes);

// ─── OAuth / Passkey ──────────────────────────────────────────────────────
app.use("/api/auth", oauthRoutes);

// ─── Tenant Portal Routes ─────────────────────────────────────────────────
// apiLimiter (100 req/15 min) applied to all tenant routes as a group.
// Sensitive sub-paths get their own tighter limiter inside the route files.
app.use("/api/tenant", apiLimiter, tenantRoutes);
app.use("/api/users",  apiLimiter, userRoutes);
app.use("/api/employees", apiLimiter, employeeRoutes);
app.use("/api/visas",     apiLimiter, visaRoutes);
app.use("/api/wps",       apiLimiter, wpsRoutes);
app.use("/api/documents", apiLimiter, documentRoutes);
app.use("/api/uploads",   apiLimiter, uploadRoutes);

// ─── 404 Handler ──────────────────────────────────────────────────────────
app.use((_req: Request, res: Response) => {
  res.status(404).json({ error: "Route not found." });
});

// ─── Global Error Handler ─────────────────────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error("[app] Unhandled error:", err);
  res.status(500).json({ error: "Internal server error." });
});

// ─── Cron Jobs ────────────────────────────────────────────────────────────
if (process.env.ENABLE_JOBS !== "false") {
  startVisaAlertJob();
  startWpsAlertJob();
}

export default app;
