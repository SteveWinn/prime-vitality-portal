import { drizzle } from "drizzle-orm/better-sqlite3";
import Database from "better-sqlite3";
import { eq, and, or, desc } from "drizzle-orm";
import {
  users, labResults, messages, appointments, treatmentPlans,
  type User, type InsertUser, type LabResult, type InsertLabResult,
  type Message, type InsertMessage, type Appointment, type InsertAppointment,
  type TreatmentPlan, type InsertTreatmentPlan
} from "@shared/schema";
import bcrypt from "bcryptjs";

// Render paid tier: use persistent disk mounted at /data
// Render free tier fallback: /tmp (resets on redeploy)
// Local dev: project root
const DB_PATH = process.env.DB_PATH
  ? process.env.DB_PATH
  : process.env.NODE_ENV === "production"
    ? "/data/prime_vitality.db"
    : "prime_vitality.db";
const sqlite = new Database(DB_PATH);
export const db = drizzle(sqlite);

// Create tables
sqlite.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    password TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'patient',
    phone TEXT,
    date_of_birth TEXT,
    stripe_customer_id TEXT,
    stripe_subscription_id TEXT,
    subscription_plan TEXT,
    subscription_status TEXT DEFAULT 'inactive',
    subscription_current_period_end TEXT,
    doxy_room_url TEXT DEFAULT 'https://doxy.me/primevitality',
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS lab_results (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    patient_id INTEGER NOT NULL,
    uploaded_by INTEGER NOT NULL,
    title TEXT NOT NULL,
    date TEXT NOT NULL,
    notes TEXT,
    results TEXT NOT NULL,
    file_url TEXT,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    from_user_id INTEGER NOT NULL,
    to_user_id INTEGER NOT NULL,
    subject TEXT,
    body TEXT NOT NULL,
    is_read INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS appointments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    patient_id INTEGER NOT NULL,
    provider_id INTEGER NOT NULL,
    scheduled_at TEXT NOT NULL,
    type TEXT NOT NULL DEFAULT 'consultation',
    status TEXT NOT NULL DEFAULT 'requested',
    notes TEXT,
    doxy_url TEXT DEFAULT 'https://doxy.me/primevitality',
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS treatment_plans (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    patient_id INTEGER NOT NULL,
    provider_id INTEGER NOT NULL,
    title TEXT NOT NULL,
    medications TEXT NOT NULL,
    dosing TEXT NOT NULL,
    instructions TEXT,
    next_lab_date TEXT,
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
`);

// Safe column additions for existing databases
const addColumnIfNotExists = (table: string, column: string, definition: string) => {
  try {
    sqlite.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  } catch {
    // Column already exists — ignore
  }
};
addColumnIfNotExists("lab_results", "pdf_filename", "TEXT");
addColumnIfNotExists("users", "reset_token", "TEXT");
addColumnIfNotExists("users", "reset_token_expiry", "TEXT");

// Seed admin account if not exists
const adminExists = db.select().from(users).where(eq(users.email, "admin@myprimevitality.com")).get();
if (!adminExists) {
  const hash = bcrypt.hashSync("Admin1234!", 10);
  db.insert(users).values({
    firstName: "Admin",
    lastName: "Provider",
    email: "admin@myprimevitality.com",
    password: hash,
    role: "admin",
    createdAt: new Date().toISOString(),
  }).run();
}

export interface IStorage {
  // Users
  getUserById(id: number): User | undefined;
  getUserByEmail(email: string): User | undefined;
  storeResetToken(userId: number, token: string, expiry: string): void;
  getUserByResetToken(token: string): User | undefined;
  clearResetToken(userId: number): void;
  getUserByStripeCustomerId(customerId: string): User | undefined;
  createUser(data: Omit<InsertUser, "role"> & { role?: string }): User;
  updateUser(id: number, data: Partial<User>): User | undefined;
  getAllPatients(): User[];

  // Lab Results
  getLabResultsByPatient(patientId: number): LabResult[];
  createLabResult(data: InsertLabResult): LabResult;

  // Messages
  getMessagesByUser(userId: number): Message[];
  getUnreadCount(userId: number): number;
  createMessage(data: InsertMessage): Message;
  markMessageRead(id: number): void;

  // Appointments
  getAppointmentsByPatient(patientId: number): Appointment[];
  getAllAppointments(): Appointment[];
  createAppointment(data: InsertAppointment): Appointment;
  updateAppointmentStatus(id: number, status: string): Appointment | undefined;

  // Treatment Plans
  getTreatmentPlanByPatient(patientId: number): TreatmentPlan | undefined;
  createTreatmentPlan(data: InsertTreatmentPlan): TreatmentPlan;
  updateTreatmentPlan(id: number, data: Partial<TreatmentPlan>): TreatmentPlan | undefined;
}

export class Storage implements IStorage {
  getUserById(id: number) {
    return db.select().from(users).where(eq(users.id, id)).get();
  }

  getUserByEmail(email: string) {
    return db.select().from(users).where(eq(users.email, email)).get();
  }
  storeResetToken(userId: number, token: string, expiry: string) {
    db.update(users).set({ resetToken: token, resetTokenExpiry: expiry }).where(eq(users.id, userId)).run();
  }
  getUserByResetToken(token: string) {
    return db.select().from(users).where(eq(users.resetToken, token)).get();
  }
  clearResetToken(userId: number) {
    db.update(users).set({ resetToken: null, resetTokenExpiry: null }).where(eq(users.id, userId)).run();
  }
  getUserByStripeCustomerId(customerId: string) {
    return db.select().from(users).where(eq(users.stripeCustomerId, customerId)).get();
  }

  createUser(data: any): User {
    return db.insert(users).values({ ...data, createdAt: new Date().toISOString() }).returning().get();
  }

  updateUser(id: number, data: Partial<User>): User | undefined {
    return db.update(users).set(data).where(eq(users.id, id)).returning().get();
  }

  getAllPatients(): User[] {
    return db.select().from(users).where(eq(users.role, "patient")).all();
  }

  getLabResultsByPatient(patientId: number): LabResult[] {
    return db.select().from(labResults).where(eq(labResults.patientId, patientId)).all();
  }

  createLabResult(data: InsertLabResult): LabResult {
    return db.insert(labResults).values({ ...data, createdAt: new Date().toISOString() }).returning().get();
  }

  getMessagesByUser(userId: number): Message[] {
    return db.select().from(messages)
      .where(or(eq(messages.fromUserId, userId), eq(messages.toUserId, userId)))
      .orderBy(desc(messages.createdAt))
      .all();
  }

  getUnreadCount(userId: number): number {
    const rows = db.select().from(messages)
      .where(and(eq(messages.toUserId, userId), eq(messages.isRead, 0)))
      .all();
    return rows.length;
  }

  createMessage(data: InsertMessage): Message {
    return db.insert(messages).values({ ...data, createdAt: new Date().toISOString() }).returning().get();
  }

  markMessageRead(id: number): void {
    db.update(messages).set({ isRead: 1 }).where(eq(messages.id, id)).run();
  }

  getAppointmentsByPatient(patientId: number): Appointment[] {
    return db.select().from(appointments).where(eq(appointments.patientId, patientId)).orderBy(desc(appointments.scheduledAt)).all();
  }

  getAllAppointments(): Appointment[] {
    return db.select().from(appointments).orderBy(desc(appointments.scheduledAt)).all();
  }

  createAppointment(data: InsertAppointment): Appointment {
    return db.insert(appointments).values({ ...data, createdAt: new Date().toISOString() }).returning().get();
  }

  updateAppointmentStatus(id: number, status: string): Appointment | undefined {
    return db.update(appointments).set({ status }).where(eq(appointments.id, id)).returning().get();
  }

  getTreatmentPlanByPatient(patientId: number): TreatmentPlan | undefined {
    return db.select().from(treatmentPlans)
      .where(and(eq(treatmentPlans.patientId, patientId), eq(treatmentPlans.isActive, 1)))
      .get();
  }

  createTreatmentPlan(data: InsertTreatmentPlan): TreatmentPlan {
    const now = new Date().toISOString();
    return db.insert(treatmentPlans).values({ ...data, createdAt: now, updatedAt: now }).returning().get();
  }

  updateTreatmentPlan(id: number, data: Partial<TreatmentPlan>): TreatmentPlan | undefined {
    return db.update(treatmentPlans).set({ ...data, updatedAt: new Date().toISOString() }).where(eq(treatmentPlans.id, id)).returning().get();
  }
}

export const storage = new Storage();
