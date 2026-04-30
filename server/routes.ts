import type { Express, Request, Response, NextFunction } from "express";
import express from "express";
import { createServer } from "http";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import Stripe from "stripe";
import multer from "multer";
import path from "path";
import fs from "fs";
import { storage } from "./storage";
import { registerSchema, loginSchema, insertMessageSchema, insertAppointmentSchema, insertTreatmentPlanSchema, insertLabResultSchema } from "@shared/schema";
import { parseLabCorpPdf, markersToResultsJson, markersToDisplayObject } from "./labParser";
import {
  sendPasswordResetEmail,
  sendLabUploadedEmail,
  sendNewMessageEmail,
  sendSubscriptionEmail,
} from "./email";
import crypto from "crypto";

// PDF upload dir — use persistent disk in prod
const UPLOAD_DIR = process.env.NODE_ENV === "production" ? "/data/uploads" : "uploads";
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const upload = multer({
  dest: UPLOAD_DIR,
  limits: { fileSize: 20 * 1024 * 1024 }, // 20MB
  fileFilter: (_req, file, cb) => {
    if (file.mimetype === "application/pdf") cb(null, true);
    else cb(new Error("Only PDF files are accepted"));
  },
});

const JWT_SECRET = process.env.JWT_SECRET || "primevitality_jwt_secret_2026";
const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || "";

const stripe = STRIPE_SECRET_KEY ? new Stripe(STRIPE_SECRET_KEY, { apiVersion: "2026-04-22.dahlia" as any }) : null;

// Stripe price IDs — these should be set via env vars in production
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET || "";
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

  // ─── STRIPE WEBHOOK ──────────────────────────────────────────────
  // Must use express.raw() — Stripe signature verification requires the raw body
  app.post("/api/stripe/webhook",
    express.raw({ type: "application/json" }),
    async (req, res) => {
      if (!stripe) return res.status(503).json({ error: "Stripe not configured" });

      let event: any;
      if (STRIPE_WEBHOOK_SECRET) {
        const sig = req.headers["stripe-signature"] as string;
        try {
          event = stripe.webhooks.constructEvent(req.body, sig, STRIPE_WEBHOOK_SECRET);
        } catch (err: any) {
          console.error("Webhook signature verification failed:", err.message);
          return res.status(400).send(`Webhook Error: ${err.message}`);
        }
      } else {
        try { event = JSON.parse(req.body.toString()); }
        catch { return res.status(400).json({ error: "Invalid JSON" }); }
      }

      try {
        switch (event.type) {
          case "checkout.session.completed": {
            const session = event.data.object;
            const customerId = session.customer as string;
            const subscriptionId = session.subscription as string;
            const user = storage.getUserByStripeCustomerId(customerId);
            if (user) {
              const plan = session.metadata?.plan || "starter";
              storage.updateUser(user.id, {
                stripeSubscriptionId: subscriptionId,
                subscriptionPlan: plan,
                subscriptionStatus: "active",
              });
              await sendSubscriptionEmail(user.email, user.firstName, "activated");
            }
            break;
          }
          case "customer.subscription.updated": {
            const sub = event.data.object;
            const user = storage.getUserByStripeCustomerId(sub.customer as string);
            if (user) {
              const newStatus = sub.status === "active" ? "active"
                : sub.status === "past_due" ? "past_due"
                : sub.status === "canceled" ? "cancelled"
                : sub.status;
              storage.updateUser(user.id, {
                subscriptionStatus: newStatus,
                subscriptionCurrentPeriodEnd: sub.current_period_end
                  ? new Date(sub.current_period_end * 1000).toISOString()
                  : undefined,
              });
              if (newStatus === "cancelled") {
                await sendSubscriptionEmail(user.email, user.firstName, "cancelled");
              }
            }
            break;
          }
          case "customer.subscription.deleted": {
            const sub = event.data.object;
            const user = storage.getUserByStripeCustomerId(sub.customer as string);
            if (user) {
              storage.updateUser(user.id, { subscriptionStatus: "cancelled" });
              await sendSubscriptionEmail(user.email, user.firstName, "cancelled");
            }
            break;
          }
          case "invoice.payment_succeeded": {
            const invoice = event.data.object;
            const user = storage.getUserByStripeCustomerId(invoice.customer as string);
            if (user && invoice.billing_reason === "subscription_cycle") {
              storage.updateUser(user.id, { subscriptionStatus: "active" });
              await sendSubscriptionEmail(user.email, user.firstName, "renewed");
            }
            break;
          }
          case "invoice.payment_failed": {
            const invoice = event.data.object;
            const user = storage.getUserByStripeCustomerId(invoice.customer as string);
            if (user) {
              storage.updateUser(user.id, { subscriptionStatus: "past_due" });
              await sendSubscriptionEmail(user.email, user.firstName, "payment_failed");
            }
            break;
          }
        }
      } catch (err) {
        console.error("Webhook handler error:", err);
      }
      res.json({ received: true });
    }
  );

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

  // ─── PASSWORD RESET ──────────────────────────────────────────────────────
  app.post("/api/auth/forgot-password", async (req, res) => {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: "Email required" });
    const user = storage.getUserByEmail(email);
    // Always respond OK — don't reveal whether email exists
    if (!user) return res.json({ ok: true });
    const token = crypto.randomBytes(32).toString("hex");
    const expiry = new Date(Date.now() + 60 * 60 * 1000).toISOString(); // 1 hour
    storage.storeResetToken(user.id, token, expiry);
    try {
      await sendPasswordResetEmail(user.email, user.firstName, token);
    } catch (err) {
      console.error("Failed to send reset email:", err);
    }
    return res.json({ ok: true });
  });

  app.post("/api/auth/reset-password", async (req, res) => {
    const { token, password } = req.body;
    if (!token || !password) return res.status(400).json({ error: "Token and password required" });
    if (password.length < 8) return res.status(400).json({ error: "Password must be at least 8 characters" });
    const user = storage.getUserByResetToken(token);
    if (!user) return res.status(400).json({ error: "Invalid or expired reset link" });
    if (!user.resetTokenExpiry || new Date(user.resetTokenExpiry) < new Date()) {
      storage.clearResetToken(user.id);
      return res.status(400).json({ error: "Reset link has expired. Please request a new one." });
    }
    const hashed = await bcrypt.hash(password, 10);
    storage.updateUser(user.id, { password: hashed });
    storage.clearResetToken(user.id);
    return res.json({ ok: true });
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
        success_url: `${(process.env.FRONTEND_URL || req.headers.origin || "").replace(/\/+$/, "")}/subscription/success?plan=${plan}`,
        cancel_url: `${(process.env.FRONTEND_URL || req.headers.origin || "").replace(/\/+$/, "")}/subscription/cancelled`,
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

  // ─── PDF LAB UPLOAD ────────────────────────────────────────────────────────
  app.post("/api/labs/upload-pdf", authMiddleware, adminOnly, upload.single("pdf"), async (req, res) => {
    try {
      if (!req.file) return res.status(400).json({ error: "No PDF file uploaded" });
      const patientId = parseInt(req.body.patientId);
      const title = req.body.title || "Lab Report";
      const notes = req.body.notes || "";
      if (!patientId) return res.status(400).json({ error: "patientId required" });

      // Read the file buffer
      const fileBuffer = fs.readFileSync(req.file.path);

      // Parse LabCorp markers from buffer (uses pdftotext internally)
      const report = parseLabCorpPdf(fileBuffer);
      console.log(`[Lab Parser] Found ${report.markers.length} markers for patient ${patientId}`);
      const resultsJson = markersToResultsJson(report.markers);
      const markers: Record<string, string> = JSON.parse(resultsJson);

      // Keep the PDF file on disk with its original name
      const filename = req.file.filename + ".pdf";
      fs.renameSync(req.file.path, path.join(UPLOAD_DIR, filename));

      // Use date parsed from PDF, or fall back to today
      const labDate = report.dateCollected || new Date().toISOString().split("T")[0];

      const lab = storage.createLabResult({
        patientId,
        uploadedBy: (req as any).userId,
        title,
        date: labDate,
        notes,
        results: resultsJson,
        pdfFilename: filename,
      } as any);

      const displayMarkers = markersToDisplayObject(report.markers);
      res.json({ lab, markers: displayMarkers, pdfFilename: filename });
      // Notify patient by email
      try {
        const patient = storage.getUser(patientId);
        if (patient) await sendLabUploadedEmail(patient.email, patient.firstName, title);
      } catch (emailErr) {
        console.error("Lab notification email failed:", emailErr);
      }
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // Serve uploaded PDFs
  app.get("/api/labs/pdf/:filename", authMiddleware, (req, res) => {
    const filename = path.basename(req.params.filename); // prevent path traversal
    const filePath = path.join(UPLOAD_DIR, filename);
    if (!fs.existsSync(filePath)) return res.status(404).json({ error: "File not found" });
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename="${filename}"`);
    res.sendFile(path.resolve(filePath));
  });

  // ─── MESSAGES ────────────────────────────────────────────
  app.get("/api/messages", authMiddleware, (req, res) => {
    res.json(storage.getMessagesByUser((req as any).userId));
  });

  app.get("/api/messages/unread", authMiddleware, (req, res) => {
    res.json({ count: storage.getUnreadCount((req as any).userId) });
  });

  app.post("/api/messages", authMiddleware, async (req, res) => {
    try {
      const data = insertMessageSchema.parse({
        ...req.body,
        fromUserId: (req as any).userId,
      });
      const msg = storage.createMessage(data);
      res.json(msg);
      // Email notification to patient when provider/admin replies
      try {
        const senderRole = (req as any).userRole;
        if (senderRole === "admin" || senderRole === "provider") {
          const recipient = storage.getUser(data.toUserId);
          if (recipient && recipient.role === "patient") {
            await sendNewMessageEmail(recipient.email, recipient.firstName, data.content);
          }
        }
      } catch (emailErr) {
        console.error("Message notification email failed:", emailErr);
      }
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
