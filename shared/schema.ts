import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Users (patients + admin/providers)
export const users = sqliteTable("users", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  email: text("email").notNull().unique(),
  password: text("password").notNull(),
  role: text("role").notNull().default("patient"), // "patient" | "admin"
  phone: text("phone"),
  dateOfBirth: text("date_of_birth"),
  stripeCustomerId: text("stripe_customer_id"),
  stripeSubscriptionId: text("stripe_subscription_id"),
  subscriptionPlan: text("subscription_plan"), // "starter" | "optimized" | "elite"
  subscriptionStatus: text("subscription_status").default("inactive"), // "active" | "inactive" | "cancelled" | "past_due"
  subscriptionCurrentPeriodEnd: text("subscription_current_period_end"),
  doxyRoomUrl: text("doxy_room_url").default("https://doxy.me/primevitality"),
  createdAt: text("created_at").notNull(),
});

// Lab results
export const labResults = sqliteTable("lab_results", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  patientId: integer("patient_id").notNull(),
  uploadedBy: integer("uploaded_by").notNull(),
  title: text("title").notNull(),
  date: text("date").notNull(),
  notes: text("notes"),
  results: text("results").notNull(), // JSON string of key/value lab values
  fileUrl: text("file_url"),
  createdAt: text("created_at").notNull(),
});

// Messages between patient and provider
export const messages = sqliteTable("messages", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  fromUserId: integer("from_user_id").notNull(),
  toUserId: integer("to_user_id").notNull(),
  subject: text("subject"),
  body: text("body").notNull(),
  isRead: integer("is_read").notNull().default(0),
  createdAt: text("created_at").notNull(),
});

// Appointments
export const appointments = sqliteTable("appointments", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  patientId: integer("patient_id").notNull(),
  providerId: integer("provider_id").notNull(),
  scheduledAt: text("scheduled_at").notNull(),
  type: text("type").notNull().default("consultation"), // "consultation" | "followup" | "lab_review"
  status: text("status").notNull().default("requested"), // "requested" | "confirmed" | "completed" | "cancelled"
  notes: text("notes"),
  doxyUrl: text("doxy_url").default("https://doxy.me/primevitality"),
  createdAt: text("created_at").notNull(),
});

// Treatment plans
export const treatmentPlans = sqliteTable("treatment_plans", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  patientId: integer("patient_id").notNull(),
  providerId: integer("provider_id").notNull(),
  title: text("title").notNull(),
  medications: text("medications").notNull(), // JSON string
  dosing: text("dosing").notNull(),
  instructions: text("instructions"),
  nextLabDate: text("next_lab_date"),
  isActive: integer("is_active").notNull().default(1),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

// Insert schemas
export const insertUserSchema = createInsertSchema(users).omit({ id: true, createdAt: true, stripeCustomerId: true, stripeSubscriptionId: true });
export const insertLabResultSchema = createInsertSchema(labResults).omit({ id: true, createdAt: true });
export const insertMessageSchema = createInsertSchema(messages).omit({ id: true, createdAt: true, isRead: true });
export const insertAppointmentSchema = createInsertSchema(appointments).omit({ id: true, createdAt: true });
export const insertTreatmentPlanSchema = createInsertSchema(treatmentPlans).omit({ id: true, createdAt: true, updatedAt: true });

// Register schema
export const registerSchema = z.object({
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  email: z.string().email("Valid email required"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  phone: z.string().optional(),
  dateOfBirth: z.string().optional(),
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

// Types
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type LabResult = typeof labResults.$inferSelect;
export type InsertLabResult = z.infer<typeof insertLabResultSchema>;
export type Message = typeof messages.$inferSelect;
export type InsertMessage = z.infer<typeof insertMessageSchema>;
export type Appointment = typeof appointments.$inferSelect;
export type InsertAppointment = z.infer<typeof insertAppointmentSchema>;
export type TreatmentPlan = typeof treatmentPlans.$inferSelect;
export type InsertTreatmentPlan = z.infer<typeof insertTreatmentPlanSchema>;
