import type { Express, Request, Response, NextFunction } from "express";
import { createServer } from "http";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import Stripe from "stripe";
import { storage } from "./storage";
import { registerSchema, loginSchema, insertMessageSchema, insertAppointmentSchema, insertTreatmentPlanSchema, insertLabResultSchema } from "@shared/schema";

const JWT_SECRET = process.env.JWT_SECRET || "primevitality_jwt_secret_2026";
const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || "";

const stripe = STRIPE_SECRET_KEY ? new Stripe(STRIPE_SECRET_KEY, { apiVersion: "2026-04-22.dahlia" as any }) : null;

// Stripe price IDs — these should be set via env vars in production
const STRIPE_PRICES: Record<string, string> = {
  starter: process.env.STRIPE_PRICE_STARTER || "price_starter",
  optimized: process.env.STRIPE_PRICE_OPTIMIZED || "price_optimized",
  elite: process.env.STRIPE_PRICE_ELITE || "price_elite",
};

// Auth middleware
function authMiddleware(req: Request, res: Response, next: NextFunction) {
  const token = req.headers.authorization?.replace("Bearer ", "");
  if (!token) return res.status(401).json({ error: "Unauthorized" });
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { userId: number; role: string };
    (req as any).userId = decoded.userId;
    (req as any).userRole = decoded.role;
    next();
  } catch {
    return res.status(401).json({ error: "Invalid token" });
  }
}

function adminOnly(req: Request, res: Response, next: NextFunction) {
  if ((req as any).userRole !== "admin") return res.status(403).json({ error: "Admin only" });
  next();
}

export function registerRoutes(httpServer: any, app: Express) {

  // ─── AUTH ───────────────────────────────────────────────
  app.post("/api/auth/register", async (req, res) => {
    try {
      const data = registerSchema.parse(req.body);
      const existing = storage.getUserByEmail(data.email);
      if (existing) return res.status(400).json({ error: "Email already registered" });
      const hash = bcrypt.hashSync(data.password, 10);
      const user = storage.createUser({ ...data, password: hash, role: "patient" });
      const token = jwt.sign({ userId: user.id, role: user.role }, JWT_SECRET, { expiresIn: "7d" });
      const { password, ...safeUser } = user;
      res.json({ token, user: safeUser });
    } catch (e: any) {
      res.status(400).json({ error: e.message || "Registration failed" });
    }
  });

  app.post("/api/auth/login", async (req, res) => {
    try {
      const data = loginSchema.parse(req.body);
      const user = storage.getUserByEmail(data.email);
      if (!user || !bcrypt.compareSync(data.password, user.password)) {
        return res.status(401).json({ error: "Invalid email or password" });
      }
      const token = jwt.sign({ userId: user.id, role: user.role }, JWT_SECRET, { expiresIn: "7d" });
      const { password, ...safeUser } = user;
      res.json({ token, user: safeUser });
    } catch (e: any) {
      res.status(400).json({ error: e.message || "Login failed" });
    }
  });

  app.get("/api/auth/me", authMiddleware, (req, res) => {
    const user = storage.getUserById((req as any).userId);
    if (!user) return res.status(404).json({ error: "User not found" });
    const { password, ...safeUser } = user;
    res.json(safeUser);
  });

  // ─── PATIENTS ────────────────────────────────────────────
  app.get("/api/patients", authMiddleware, adminOnly, (req, res) => {
    const patients = storage.getAllPatients().map(({ password, ...p }) => p);
    res.json(patients);
  });

  app.get("/api/patients/:id", authMiddleware, (req, res) => {
    const id = parseInt(req.params.id);
    if ((req as any).userRole !== "admin" && (req as any).userId !== id) {
      return res.status(403).json({ error: "Forbidden" });
    }
    const user = storage.getUserById(id);
    if (!user) return res.status(404).json({ error: "Not found" });
    const { password, ...safeUser } = user;
    res.json(safeUser);
  });

  app.patch("/api/patients/:id", authMiddleware, (req, res) => {
    const id = parseInt(req.params.id);
    if ((req as any).userRole !== "admin" && (req as any).userId !== id) {
      return res.status(403).json({ error: "Forbidden" });
    }
    const { password, role, stripeCustomerId, stripeSubscriptionId, ...allowed } = req.body;
    const user = storage.updateUser(id, allowed);
    if (!user) return res.status(404).json({ error: "Not found" });
    const { password: pw, ...safeUser } = user;
    res.json(safeUser);
  });

  // ─── STRIPE SUBSCRIPTIONS ────────────────────────────────
  app.post("/api/stripe/create-checkout", authMiddleware, async (req, res) => {
    if (!stripe) return res.status(503).json({ error: "Stripe not configured" });
    const { plan } = req.body;
    const priceId = STRIPE_PRICES[plan];
    if (!priceId) return res.status(400).json({ error: "Invalid plan" });

    const user = storage.getUserById((req as any).userId);
    if (!user) return res.status(404).json({ error: "User not found" });

    try {
      let customerId = user.stripeCustomerId;
      if (!customerId) {
        const customer = await stripe.customers.create({
          email: user.email,
          name: `${user.firstName} ${user.lastName}`,
          metadata: { userId: String(user.id) }
        });
        customerId = customer.id;
        storage.updateUser(user.id, { stripeCustomerId: customerId });
      }

      const session = await stripe.checkout.sessions.create({
        customer: customerId,
        payment_method_types: ["card"],
        line_items: [{ price: priceId, quantity: 1 }],
        mode: "subscription",
        success_url: `${(process.env.FRONTEND_URL || req.headers.origin || "").replace(/\/+$/, "")}/#/subscription/success?plan=${plan}`,
        cancel_url: `${(process.env.FRONTEND_URL || req.headers.origin || "").replace(/\/+$/, "")}/#/subscription/cancelled`,
        metadata: { userId: String(user.id), plan }
      });

      res.json({ url: session.url });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/stripe/portal", authMiddleware, async (req, res) => {
    if (!stripe) return res.status(503).json({ error: "Stripe not configured" });
    const user = storage.getUserById((req as any).userId);
    if (!user?.stripeCustomerId) return res.status(400).json({ error: "No billing account found" });

    try {
      const session = await stripe.billingPortal.sessions.create({
        customer: user.stripeCustomerId,
        return_url: `${(process.env.FRONTEND_URL || req.headers.origin || "").replace(/\/+$/, "")}/#/`,
      });
      res.json({ url: session.url });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // Update subscription manually (for testing without real Stripe)
  app.post("/api/subscription/update", authMiddleware, (req, res) => {
    const { plan, status } = req.body;
    const user = storage.updateUser((req as any).userId, {
      subscriptionPlan: plan,
      subscriptionStatus: status || "active",
    });
    if (!user) return res.status(404).json({ error: "Not found" });
    const { password, ...safeUser } = user;
    res.json(safeUser);
  });

  // Admin: manually set patient subscription
  app.post("/api/admin/subscription", authMiddleware, adminOnly, (req, res) => {
    const { patientId, plan, status } = req.body;
    const user = storage.updateUser(patientId, {
      subscriptionPlan: plan,
      subscriptionStatus: status || "active",
    });
    if (!user) return res.status(404).json({ error: "Not found" });
    const { password, ...safeUser } = user;
    res.json(safeUser);
  });

  // ─── LAB RESULTS ─────────────────────────────────────────
  app.get("/api/labs/:patientId", authMiddleware, (req, res) => {
    const patientId = parseInt(req.params.patientId);
    if ((req as any).userRole !== "admin" && (req as any).userId !== patientId) {
      return res.status(403).json({ error: "Forbidden" });
    }
    res.json(storage.getLabResultsByPatient(patientId));
  });

  app.post("/api/labs", authMiddleware, adminOnly, (req, res) => {
    try {
      const data = insertLabResultSchema.parse(req.body);
      const lab = storage.createLabResult(data);
      res.json(lab);
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  // ─── MESSAGES ────────────────────────────────────────────
  app.get("/api/messages", authMiddleware, (req, res) => {
    res.json(storage.getMessagesByUser((req as any).userId));
  });

  app.get("/api/messages/unread", authMiddleware, (req, res) => {
    res.json({ count: storage.getUnreadCount((req as any).userId) });
  });

  app.post("/api/messages", authMiddleware, (req, res) => {
    try {
      const data = insertMessageSchema.parse({
        ...req.body,
        fromUserId: (req as any).userId,
      });
      const msg = storage.createMessage(data);
      res.json(msg);
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  app.patch("/api/messages/:id/read", authMiddleware, (req, res) => {
    storage.markMessageRead(parseInt(req.params.id));
    res.json({ success: true });
  });

  // ─── APPOINTMENTS ─────────────────────────────────────────
  app.get("/api/appointments", authMiddleware, (req, res) => {
    if ((req as any).userRole === "admin") {
      res.json(storage.getAllAppointments());
    } else {
      res.json(storage.getAppointmentsByPatient((req as any).userId));
    }
  });

  app.post("/api/appointments", authMiddleware, (req, res) => {
    try {
      const adminUser = storage.getUserByEmail("admin@myprimevitality.com");
      const data = insertAppointmentSchema.parse({
        ...req.body,
        patientId: (req as any).userRole === "admin" ? req.body.patientId : (req as any).userId,
        providerId: adminUser?.id || 1,
        doxyUrl: "https://doxy.me/primevitality",
      });
      const appt = storage.createAppointment(data);
      res.json(appt);
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  app.patch("/api/appointments/:id/status", authMiddleware, adminOnly, (req, res) => {
    const appt = storage.updateAppointmentStatus(parseInt(req.params.id), req.body.status);
    res.json(appt);
  });

  // ─── TREATMENT PLANS ──────────────────────────────────────
  app.get("/api/treatment/:patientId", authMiddleware, (req, res) => {
    const patientId = parseInt(req.params.patientId);
    if ((req as any).userRole !== "admin" && (req as any).userId !== patientId) {
      return res.status(403).json({ error: "Forbidden" });
    }
    res.json(storage.getTreatmentPlanByPatient(patientId));
  });

  app.post("/api/treatment", authMiddleware, adminOnly, (req, res) => {
    try {
      const adminUser = storage.getUserById((req as any).userId);
      const data = insertTreatmentPlanSchema.parse({
        ...req.body,
        providerId: adminUser?.id || 1,
      });
      const plan = storage.createTreatmentPlan(data);
      res.json(plan);
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  app.patch("/api/treatment/:id", authMiddleware, adminOnly, (req, res) => {
    const plan = storage.updateTreatmentPlan(parseInt(req.params.id), req.body);
    res.json(plan);
  });

  return httpServer;
}
