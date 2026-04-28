import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { AppUser } from "../App";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import {
  LayoutDashboard, FlaskConical, MessageSquare, Calendar, Video,
  CreditCard, LogOut, User, CheckCircle, Clock, XCircle, ChevronRight,
  Pill, FileText, Send, AlertCircle, Activity, Stethoscope
} from "lucide-react";
import type { LabResult, Message, Appointment, TreatmentPlan } from "@shared/schema";

interface PatientDashboardProps {
  user: AppUser;
  onLogout: () => void;
  onUpdateUser: (u: AppUser) => void;
}

const PLAN_INFO: Record<string, { label: string; price: string; color: string; bgColor: string; features: string[] }> = {
  starter: {
    label: "Starter",
    price: "$149/mo",
    color: "text-blue-700",
    bgColor: "bg-blue-50 border-blue-100",
    features: ["Monthly TRT consultation", "Basic lab panel", "Secure messaging", "Standard shipping"],
  },
  optimized: {
    label: "Optimized",
    price: "$249/mo",
    color: "text-primary",
    bgColor: "bg-primary/8 border-primary/15",
    features: ["Bi-weekly consultations", "Comprehensive lab panel", "Priority messaging", "Expedited shipping", "Nutrition guidance"],
  },
  elite: {
    label: "Elite",
    price: "$399/mo",
    color: "text-amber-700",
    bgColor: "bg-amber-50 border-amber-100",
    features: ["Weekly consultations", "Full hormone panel + peptides", "24/7 priority access", "Same-day shipping", "Personalized protocol", "Body composition tracking"],
  },
};

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string; icon: JSX.Element }> = {
    active:    { label: "Active",     cls: "bg-emerald-50 text-emerald-700 border border-emerald-200",   icon: <CheckCircle className="w-3 h-3" /> },
    inactive:  { label: "Inactive",   cls: "bg-gray-100 text-gray-500 border border-gray-200",           icon: <Clock className="w-3 h-3" /> },
    cancelled: { label: "Cancelled",  cls: "bg-red-50 text-red-600 border border-red-200",               icon: <XCircle className="w-3 h-3" /> },
    past_due:  { label: "Past Due",   cls: "bg-amber-50 text-amber-700 border border-amber-200",         icon: <AlertCircle className="w-3 h-3" /> },
    requested: { label: "Requested",  cls: "bg-blue-50 text-blue-600 border border-blue-200",            icon: <Clock className="w-3 h-3" /> },
    confirmed: { label: "Confirmed",  cls: "bg-emerald-50 text-emerald-700 border border-emerald-200",   icon: <CheckCircle className="w-3 h-3" /> },
    completed: { label: "Completed",  cls: "bg-gray-100 text-gray-500 border border-gray-200",           icon: <CheckCircle className="w-3 h-3" /> },
  };
  const s = map[status] ?? { label: status, cls: "bg-gray-100 text-gray-500 border border-gray-200", icon: <Clock className="w-3 h-3" /> };
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold ${s.cls}`}>
      {s.icon} {s.label}
    </span>
  );
}

export default function PatientDashboard({ user, onLogout, onUpdateUser }: PatientDashboardProps) {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("overview");
  const [composeOpen, setComposeOpen] = useState(false);
  const [apptOpen, setApptOpen] = useState(false);
  const [msgSubject, setMsgSubject] = useState("");
  const [msgBody, setMsgBody] = useState("");
  const [apptType, setApptType] = useState("consultation");
  const [apptDate, setApptDate] = useState("");
  const [apptNotes, setApptNotes] = useState("");

  // Queries
  const { data: labs, isLoading: labsLoading } = useQuery<LabResult[]>({
    queryKey: ["/api/labs", user.id],
    queryFn: () => apiRequest("GET", `/api/labs/${user.id}`).then(r => r.json()),
  });

  const { data: messages, isLoading: msgsLoading } = useQuery<Message[]>({
    queryKey: ["/api/messages"],
    queryFn: () => apiRequest("GET", "/api/messages").then(r => r.json()),
  });

  const { data: appointments, isLoading: apptsLoading } = useQuery<Appointment[]>({
    queryKey: ["/api/appointments"],
    queryFn: () => apiRequest("GET", "/api/appointments").then(r => r.json()),
  });

  const { data: treatmentPlan } = useQuery<TreatmentPlan[]>({
    queryKey: ["/api/treatment", user.id],
    queryFn: () => apiRequest("GET", `/api/treatment/${user.id}`).then(r => r.json()),
  });

  // Mutations
  const sendMessageMutation = useMutation({
    mutationFn: (data: { subject: string; body: string }) =>
      apiRequest("POST", "/api/messages", { ...data, toUserId: 1 }).then(r => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/messages"] });
      setComposeOpen(false);
      setMsgSubject("");
      setMsgBody("");
      toast({ title: "Message sent", description: "Your care team will respond soon." });
    },
    onError: () => toast({ title: "Error", description: "Could not send message.", variant: "destructive" }),
  });

  const requestApptMutation = useMutation({
    mutationFn: (data: { scheduledAt: string; type: string; notes: string }) =>
      apiRequest("POST", "/api/appointments", { ...data, providerId: 1 }).then(r => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/appointments"] });
      setApptOpen(false);
      setApptDate("");
      setApptNotes("");
      toast({ title: "Appointment requested", description: "Your provider will confirm shortly." });
    },
    onError: () => toast({ title: "Error", description: "Could not request appointment.", variant: "destructive" }),
  });

  const checkoutMutation = useMutation({
    mutationFn: (plan: string) =>
      apiRequest("POST", "/api/stripe/create-checkout", { plan }).then(r => r.json()),
    onSuccess: (data) => {
      if (data.url) window.open(data.url, "_blank");
      else toast({ title: "Stripe not configured", description: "Contact care@myprimevitality.com to set up billing.", variant: "destructive" });
    },
    onError: (err: any) => toast({ title: "Billing unavailable", description: err?.message || "Contact care@myprimevitality.com.", variant: "destructive" }),
  });

  const portalMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/stripe/portal").then(r => r.json()),
    onSuccess: (data) => {
      if (data.url) window.open(data.url, "_blank");
      else toast({ title: "Stripe not configured", description: "Contact care@myprimevitality.com to manage billing.", variant: "destructive" });
    },
  });

  const activePlan = user.subscriptionPlan ? PLAN_INFO[user.subscriptionPlan] : null;
  const activeTreatment = treatmentPlan?.find(t => t.isActive);
  const unreadCount = messages?.filter(m => m.toUserId === user.id && !m.isRead).length ?? 0;
  const upcomingAppts = appointments?.filter(a => a.status !== "completed" && a.status !== "cancelled") ?? [];

  const navItems = [
    { id: "overview",     label: "Overview",       icon: LayoutDashboard },
    { id: "labs",         label: "Lab Results",    icon: FlaskConical },
    { id: "messages",     label: "Messages",       icon: MessageSquare, badge: unreadCount },
    { id: "appointments", label: "Appointments",   icon: Calendar },
    { id: "treatment",    label: "Treatment Plan", icon: Pill },
    { id: "subscription", label: "Subscription",   icon: CreditCard },
    { id: "telehealth",   label: "Video Visit",    icon: Video },
  ];

  return (
    <div className="min-h-screen bg-background flex">

      {/* ── Sidebar ── */}
      <aside className="w-64 flex flex-col shrink-0" style={{
        background: "hsl(0 55% 22%)",
        color: "hsl(0 0% 96%)",
        borderRight: "1px solid hsl(0 45% 27%)",
        boxShadow: "2px 0 16px rgba(90,26,26,0.18)",
      }}>

        {/* Logo */}
        <div className="sidebar-logo">
          <div className="sidebar-logo-mark">
            <Activity className="w-4 h-4 text-white" />
          </div>
          <div>
            <div className="font-extrabold text-sm leading-tight text-white" style={{ fontFamily: "'Cabinet Grotesk', sans-serif", letterSpacing: "-0.01em" }}>
              Prime Vitality
            </div>
            <div className="text-xs mt-0.5" style={{ color: "hsl(0 0% 96% / 0.55)" }}>Patient Portal</div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-0.5" data-testid="nav-sidebar">
          {navItems.map(item => (
            <button
              key={item.id}
              data-testid={`nav-${item.id}`}
              onClick={() => setActiveTab(item.id)}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all"
              style={{
                background: activeTab === item.id
                  ? "hsl(24 58% 51%)"
                  : "transparent",
                color: activeTab === item.id
                  ? "white"
                  : "hsl(0 0% 96% / 0.65)",
                fontWeight: activeTab === item.id ? 700 : 400,
                boxShadow: activeTab === item.id ? "0 2px 8px hsl(24 58% 51% / 0.4)" : "none",
              }}
              onMouseEnter={e => {
                if (activeTab !== item.id) {
                  (e.currentTarget as HTMLButtonElement).style.background = "hsl(0 45% 28%)";
                  (e.currentTarget as HTMLButtonElement).style.color = "hsl(0 0% 96%)";
                }
              }}
              onMouseLeave={e => {
                if (activeTab !== item.id) {
                  (e.currentTarget as HTMLButtonElement).style.background = "transparent";
                  (e.currentTarget as HTMLButtonElement).style.color = "hsl(0 0% 96% / 0.65)";
                }
              }}
            >
              <item.icon className="w-4 h-4 shrink-0" />
              <span className="flex-1 text-left">{item.label}</span>
              {item.badge ? (
                <span className="text-xs rounded-full px-1.5 py-0.5 min-w-[20px] text-center font-bold" style={{ background: "hsl(24 58% 51%)", color: "white" }}>
                  {item.badge}
                </span>
              ) : null}
            </button>
          ))}
        </nav>

        {/* User footer */}
        <div className="px-3 pb-4 pt-3" style={{ borderTop: "1px solid hsl(0 45% 27%)" }}>
          <div className="flex items-center gap-3 mb-2.5 px-1">
            <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0" style={{ background: "hsl(0 0% 96% / 0.12)" }}>
              <User className="w-4 h-4" style={{ color: "hsl(0 0% 96% / 0.8)" }} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold truncate text-white">{user.firstName} {user.lastName}</div>
              <div className="text-xs truncate" style={{ color: "hsl(0 0% 96% / 0.5)" }}>{user.email}</div>
            </div>
          </div>
          <button
            data-testid="button-logout"
            onClick={onLogout}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-all"
            style={{ color: "hsl(0 0% 96% / 0.55)" }}
            onMouseEnter={e => {
              (e.currentTarget as HTMLButtonElement).style.background = "hsl(0 45% 28%)";
              (e.currentTarget as HTMLButtonElement).style.color = "hsl(0 0% 96%)";
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLButtonElement).style.background = "transparent";
              (e.currentTarget as HTMLButtonElement).style.color = "hsl(0 0% 96% / 0.55)";
            }}
          >
            <LogOut className="w-4 h-4" /> Sign Out
          </button>
        </div>
      </aside>

      {/* ── Main content ── */}
      <main className="flex-1 overflow-auto">
        <div className="max-w-5xl mx-auto p-8">

          {/* OVERVIEW */}
          {activeTab === "overview" && (
            <div className="space-y-6">
              <div>
                <h1 className="text-xl font-extrabold text-foreground page-heading">
                  Welcome back, {user.firstName}
                </h1>
                <p className="text-sm text-muted-foreground mt-1">Here's a summary of your care</p>
              </div>

              {/* Status cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                  {
                    testId: "card-subscription-status",
                    icon: <CreditCard className="w-5 h-5 text-primary" />,
                    bg: "bg-primary/8",
                    label: "Plan",
                    value: activePlan ? activePlan.label : "No Plan",
                  },
                  {
                    testId: "card-subscription-status2",
                    icon: <CheckCircle className="w-5 h-5 text-emerald-600" />,
                    bg: "bg-emerald-50",
                    label: "Status",
                    valueBadge: user.subscriptionStatus ?? "inactive",
                  },
                  {
                    testId: "card-messages-count",
                    icon: <MessageSquare className="w-5 h-5 text-blue-600" />,
                    bg: "bg-blue-50",
                    label: "Messages",
                    value: unreadCount > 0 ? `${unreadCount} unread` : "Up to date",
                  },
                  {
                    testId: "card-appointments-count",
                    icon: <Calendar className="w-5 h-5 text-amber-600" />,
                    bg: "bg-amber-50",
                    label: "Appointments",
                    value: `${upcomingAppts.length} upcoming`,
                  },
                ].map(card => (
                  <Card
                    key={card.testId}
                    data-testid={card.testId}
                    className="shadow-[0_1px_6px_rgba(15,21,35,0.07)] hover:shadow-[0_4px_16px_rgba(15,21,35,0.10)] transition-shadow border-border/60"
                  >
                    <CardContent className="p-4">
                      <div className="flex items-center gap-3">
                        <div className={`stat-icon ${card.bg}`}>
                          {card.icon}
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground font-medium">{card.label}</p>
                          {card.valueBadge ? (
                            <div className="mt-0.5">
                              <StatusBadge status={card.valueBadge} />
                            </div>
                          ) : (
                            <p className="text-sm font-bold text-foreground">{card.value}</p>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              {/* Active treatment plan snippet */}
              {activeTreatment && (
                <Card className="shadow-[0_1px_6px_rgba(15,21,35,0.07)] border-border/60">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2" style={{ fontFamily: "'Cabinet Grotesk', sans-serif" }}>
                      <Pill className="w-4 h-4 text-primary" /> Current Treatment Protocol
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2 text-sm">
                      <p className="font-semibold">{activeTreatment.title}</p>
                      <p className="text-muted-foreground">{activeTreatment.dosing}</p>
                      {activeTreatment.nextLabDate && (
                        <p className="text-muted-foreground">Next labs: <span className="text-foreground font-semibold">{activeTreatment.nextLabDate}</span></p>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Quick actions */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {[
                  {
                    testId: "button-quick-compose",
                    icon: <MessageSquare className="w-5 h-5 text-primary shrink-0" />,
                    title: "Message Care Team",
                    sub: "Secure messaging",
                    onClick: () => { setActiveTab("messages"); setComposeOpen(true); },
                  },
                  {
                    testId: "button-quick-appointment",
                    icon: <Calendar className="w-5 h-5 text-primary shrink-0" />,
                    title: "Request Appointment",
                    sub: "Schedule a visit",
                    onClick: () => { setActiveTab("appointments"); setApptOpen(true); },
                  },
                  {
                    testId: "button-quick-video",
                    icon: <Video className="w-5 h-5 text-primary shrink-0" />,
                    title: "Join Video Visit",
                    sub: "via Doxy.me",
                    onClick: () => setActiveTab("telehealth"),
                  },
                ].map(action => (
                  <button
                    key={action.testId}
                    data-testid={action.testId}
                    onClick={action.onClick}
                    className="quick-action group"
                  >
                    {action.icon}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-foreground">{action.title}</p>
                      <p className="text-xs text-muted-foreground">{action.sub}</p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* LAB RESULTS */}
          {activeTab === "labs" && (
            <div className="space-y-6">
              <div>
                <h1 className="text-xl font-extrabold page-heading">Lab Results</h1>
                <p className="text-sm text-muted-foreground mt-1">Your most recent laboratory results from Prime Vitality</p>
              </div>
              {labsLoading ? (
                <div className="space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-24 w-full" />)}</div>
              ) : labs && labs.length > 0 ? (
                <div className="space-y-4">
                  {labs.map(lab => {
                    let parsed: Record<string, string> = {};
                    try { parsed = JSON.parse(lab.results); } catch {}
                    return (
                      <Card key={lab.id} data-testid={`card-lab-${lab.id}`} className="shadow-[0_1px_6px_rgba(15,21,35,0.07)] border-border/60">
                        <CardHeader className="pb-2">
                          <div className="flex items-start justify-between">
                            <div>
                              <CardTitle className="text-base" style={{ fontFamily: "'Cabinet Grotesk', sans-serif" }}>{lab.title}</CardTitle>
                              <CardDescription>{lab.date}</CardDescription>
                            </div>
                            <Badge variant="outline" className="text-xs">
                              <FileText className="w-3 h-3 mr-1" /> Report
                            </Badge>
                          </div>
                        </CardHeader>
                        <CardContent>
                          {Object.keys(parsed).length > 0 && (
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-3">
                              {Object.entries(parsed).map(([k, v]) => (
                                <div key={k} className="bg-muted/60 rounded-lg p-2.5 border border-border/40">
                                  <p className="text-xs text-muted-foreground">{k}</p>
                                  <p className="text-sm font-semibold">{v}</p>
                                </div>
                              ))}
                            </div>
                          )}
                          {lab.notes && <p className="text-sm text-muted-foreground">{lab.notes}</p>}
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              ) : (
                <Card className="shadow-[0_1px_6px_rgba(15,21,35,0.07)] border-border/60">
                  <CardContent className="py-14 text-center">
                    <div className="w-14 h-14 rounded-2xl bg-muted/60 flex items-center justify-center mx-auto mb-4">
                      <FlaskConical className="w-7 h-7 text-muted-foreground" />
                    </div>
                    <p className="text-sm font-semibold">No lab results yet</p>
                    <p className="text-xs text-muted-foreground mt-1.5">Your provider will upload results after your lab visit</p>
                  </CardContent>
                </Card>
              )}
            </div>
          )}

          {/* MESSAGES */}
          {activeTab === "messages" && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-xl font-extrabold page-heading">Messages</h1>
                  <p className="text-sm text-muted-foreground mt-1">Secure messaging with your care team</p>
                </div>
                <Dialog open={composeOpen} onOpenChange={setComposeOpen}>
                  <DialogTrigger asChild>
                    <Button data-testid="button-compose-message" size="sm" className="gap-2 font-semibold shadow-sm">
                      <Send className="w-4 h-4" /> New Message
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle style={{ fontFamily: "'Cabinet Grotesk', sans-serif" }}>Message Your Care Team</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 mt-2">
                      <div>
                        <Label className="font-semibold text-foreground/80">Subject</Label>
                        <Input
                          data-testid="input-msg-subject"
                          value={msgSubject}
                          onChange={e => setMsgSubject(e.target.value)}
                          placeholder="e.g. Question about my dosage"
                          className="mt-1.5 h-11"
                        />
                      </div>
                      <div>
                        <Label className="font-semibold text-foreground/80">Message</Label>
                        <Textarea
                          data-testid="input-msg-body"
                          value={msgBody}
                          onChange={e => setMsgBody(e.target.value)}
                          placeholder="Type your message here..."
                          rows={5}
                          className="mt-1.5"
                        />
                      </div>
                      <Button
                        data-testid="button-send-message"
                        className="w-full font-bold"
                        disabled={!msgSubject || !msgBody || sendMessageMutation.isPending}
                        onClick={() => sendMessageMutation.mutate({ subject: msgSubject, body: msgBody })}
                      >
                        {sendMessageMutation.isPending ? "Sending..." : "Send Message"}
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>

              {msgsLoading ? (
                <div className="space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-20 w-full" />)}</div>
              ) : messages && messages.length > 0 ? (
                <div className="space-y-3">
                  {messages.map(msg => {
                    const isFromMe = msg.fromUserId === user.id;
                    return (
                      <Card
                        key={msg.id}
                        data-testid={`card-message-${msg.id}`}
                        className={`shadow-[0_1px_6px_rgba(15,21,35,0.06)] transition-shadow ${
                          !msg.isRead && !isFromMe
                            ? "border-primary/25 bg-primary/4"
                            : "border-border/60"
                        }`}
                      >
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1.5">
                                <span className="text-xs font-semibold text-muted-foreground">
                                  {isFromMe ? "You → Care Team" : "Care Team → You"}
                                </span>
                                {!msg.isRead && !isFromMe && (
                                  <span className="text-xs rounded-full px-1.5 py-0.5 font-bold" style={{ background: "hsl(24 58% 51%)", color: "white" }}>New</span>
                                )}
                              </div>
                              {msg.subject && <p className="text-sm font-semibold">{msg.subject}</p>}
                              <p className="text-sm text-muted-foreground mt-1">{msg.body}</p>
                            </div>
                            <p className="text-xs text-muted-foreground shrink-0">
                              {new Date(msg.createdAt).toLocaleDateString()}
                            </p>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              ) : (
                <Card className="shadow-[0_1px_6px_rgba(15,21,35,0.07)] border-border/60">
                  <CardContent className="py-14 text-center">
                    <div className="w-14 h-14 rounded-2xl bg-muted/60 flex items-center justify-center mx-auto mb-4">
                      <MessageSquare className="w-7 h-7 text-muted-foreground" />
                    </div>
                    <p className="text-sm font-semibold">No messages yet</p>
                    <p className="text-xs text-muted-foreground mt-1.5">Use the button above to contact your care team</p>
                  </CardContent>
                </Card>
              )}
            </div>
          )}

          {/* APPOINTMENTS */}
          {activeTab === "appointments" && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-xl font-extrabold page-heading">Appointments</h1>
                  <p className="text-sm text-muted-foreground mt-1">Your telehealth consultations with Prime Vitality</p>
                </div>
                <Dialog open={apptOpen} onOpenChange={setApptOpen}>
                  <DialogTrigger asChild>
                    <Button data-testid="button-request-appointment" size="sm" className="gap-2 font-semibold shadow-sm">
                      <Calendar className="w-4 h-4" /> Request Appointment
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle style={{ fontFamily: "'Cabinet Grotesk', sans-serif" }}>Request an Appointment</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 mt-2">
                      <div>
                        <Label className="font-semibold text-foreground/80">Appointment Type</Label>
                        <Select value={apptType} onValueChange={setApptType}>
                          <SelectTrigger data-testid="select-appt-type" className="mt-1.5 h-11">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="consultation">Initial Consultation</SelectItem>
                            <SelectItem value="followup">Follow-up Visit</SelectItem>
                            <SelectItem value="lab_review">Lab Review</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label className="font-semibold text-foreground/80">Preferred Date & Time</Label>
                        <Input
                          data-testid="input-appt-date"
                          type="datetime-local"
                          value={apptDate}
                          onChange={e => setApptDate(e.target.value)}
                          className="mt-1.5 h-11"
                        />
                      </div>
                      <div>
                        <Label className="font-semibold text-foreground/80">Notes (optional)</Label>
                        <Textarea
                          data-testid="input-appt-notes"
                          value={apptNotes}
                          onChange={e => setApptNotes(e.target.value)}
                          placeholder="Any specific concerns or questions..."
                          rows={3}
                          className="mt-1.5"
                        />
                      </div>
                      <Button
                        data-testid="button-submit-appointment"
                        className="w-full font-bold"
                        disabled={!apptDate || requestApptMutation.isPending}
                        onClick={() => requestApptMutation.mutate({ scheduledAt: apptDate, type: apptType, notes: apptNotes })}
                      >
                        {requestApptMutation.isPending ? "Requesting..." : "Request Appointment"}
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>

              {apptsLoading ? (
                <div className="space-y-3">{[1,2].map(i => <Skeleton key={i} className="h-24 w-full" />)}</div>
              ) : appointments && appointments.length > 0 ? (
                <div className="space-y-4">
                  {appointments.map(appt => (
                    <Card key={appt.id} data-testid={`card-appt-${appt.id}`} className="shadow-[0_1px_6px_rgba(15,21,35,0.07)] border-border/60">
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex items-center gap-3">
                            <div className="stat-icon bg-primary/8">
                              <Stethoscope className="w-5 h-5 text-primary" />
                            </div>
                            <div>
                              <p className="text-sm font-semibold capitalize">{appt.type.replace("_", " ")}</p>
                              <p className="text-xs text-muted-foreground">
                                {new Date(appt.scheduledAt).toLocaleString()}
                              </p>
                              {appt.notes && <p className="text-xs text-muted-foreground mt-1">{appt.notes}</p>}
                            </div>
                          </div>
                          <div className="flex flex-col items-end gap-2">
                            <StatusBadge status={appt.status} />
                            {appt.status === "confirmed" && (
                              <a
                                href="https://doxy.me/primevitality"
                                target="_blank"
                                rel="noopener noreferrer"
                                data-testid={`link-join-appt-${appt.id}`}
                                className="text-xs flex items-center gap-1 font-semibold hover:underline"
                                style={{ color: "hsl(24 58% 51%)" }}
                              >
                                <Video className="w-3 h-3" /> Join Visit
                              </a>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <Card className="shadow-[0_1px_6px_rgba(15,21,35,0.07)] border-border/60">
                  <CardContent className="py-14 text-center">
                    <div className="w-14 h-14 rounded-2xl bg-muted/60 flex items-center justify-center mx-auto mb-4">
                      <Calendar className="w-7 h-7 text-muted-foreground" />
                    </div>
                    <p className="text-sm font-semibold">No appointments yet</p>
                    <p className="text-xs text-muted-foreground mt-1.5">Request an appointment to get started with your care</p>
                  </CardContent>
                </Card>
              )}
            </div>
          )}

          {/* TREATMENT PLAN */}
          {activeTab === "treatment" && (
            <div className="space-y-6">
              <div>
                <h1 className="text-xl font-extrabold page-heading">Treatment Plan</h1>
                <p className="text-sm text-muted-foreground mt-1">Your personalized TRT protocol from Prime Vitality</p>
              </div>
              {activeTreatment ? (
                <Card className="shadow-[0_1px_6px_rgba(15,21,35,0.07)] border-border/60">
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle className="text-base" style={{ fontFamily: "'Cabinet Grotesk', sans-serif" }}>{activeTreatment.title}</CardTitle>
                        <CardDescription>Active Protocol</CardDescription>
                      </div>
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                        <CheckCircle className="w-3 h-3" /> Active
                      </span>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-5">
                    <div>
                      <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-2.5">Medications</p>
                      <div className="flex flex-wrap gap-2">
                        {(() => {
                          let meds: string[] = [];
                          try { meds = JSON.parse(activeTreatment.medications); } catch {}
                          return meds.map((med, i) => (
                            <span key={i} className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold" style={{ background: "hsl(0 55% 22% / 0.08)", color: "hsl(0 55% 22%)" }}>
                              <Pill className="w-3 h-3" />{med}
                            </span>
                          ));
                        })()}
                      </div>
                    </div>
                    <div>
                      <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-1.5">Dosing Schedule</p>
                      <p className="text-sm">{activeTreatment.dosing}</p>
                    </div>
                    {activeTreatment.instructions && (
                      <div>
                        <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-1.5">Instructions</p>
                        <p className="text-sm">{activeTreatment.instructions}</p>
                      </div>
                    )}
                    {activeTreatment.nextLabDate && (
                      <div className="bg-amber-50 border border-amber-200 rounded-xl p-3.5">
                        <p className="text-sm font-semibold text-amber-800">
                          <FlaskConical className="w-4 h-4 inline mr-1.5" />
                          Next Labs Due: {activeTreatment.nextLabDate}
                        </p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ) : (
                <Card className="shadow-[0_1px_6px_rgba(15,21,35,0.07)] border-border/60">
                  <CardContent className="py-14 text-center">
                    <div className="w-14 h-14 rounded-2xl bg-muted/60 flex items-center justify-center mx-auto mb-4">
                      <Pill className="w-7 h-7 text-muted-foreground" />
                    </div>
                    <p className="text-sm font-semibold">No active treatment plan</p>
                    <p className="text-xs text-muted-foreground mt-1.5">Your provider will create a protocol after your initial consultation</p>
                  </CardContent>
                </Card>
              )}
            </div>
          )}

          {/* SUBSCRIPTION */}
          {activeTab === "subscription" && (
            <div className="space-y-6">
              <div>
                <h1 className="text-xl font-extrabold page-heading">Subscription</h1>
                <p className="text-sm text-muted-foreground mt-1">Manage your Prime Vitality care plan</p>
              </div>

              {activePlan && (
                <Card className="border-primary/25 bg-primary/4 shadow-[0_1px_6px_rgba(90,26,26,0.10)]">
                  <CardContent className="p-5">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs text-muted-foreground font-medium mb-1">Current Plan</p>
                        <p className="text-base font-extrabold" style={{ fontFamily: "'Cabinet Grotesk', sans-serif" }}>
                          {activePlan.label} — {activePlan.price}
                        </p>
                        <div className="mt-1.5">
                          <StatusBadge status={user.subscriptionStatus ?? "inactive"} />
                        </div>
                      </div>
                      <Button
                        data-testid="button-manage-billing"
                        variant="outline"
                        size="sm"
                        className="font-semibold shadow-sm"
                        onClick={() => portalMutation.mutate()}
                        disabled={portalMutation.isPending}
                      >
                        Manage Billing
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Plan cards */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {Object.entries(PLAN_INFO).map(([key, plan]) => {
                  const isCurrent = user.subscriptionPlan === key;
                  return (
                    <Card
                      key={key}
                      data-testid={`card-plan-${key}`}
                      className={`shadow-[0_1px_6px_rgba(15,21,35,0.07)] transition-shadow hover:shadow-[0_4px_16px_rgba(15,21,35,0.10)] ${
                        isCurrent ? "border-primary/40 ring-1 ring-primary/20" : "border-border/60"
                      }`}
                    >
                      <CardHeader className="pb-3">
                        <div className="flex items-center justify-between">
                          <span className={`pill-badge ${plan.bgColor} ${plan.color}`}>{plan.label}</span>
                          {isCurrent && (
                            <Badge variant="outline" className="text-xs font-semibold">Current</Badge>
                          )}
                        </div>
                        <p className="text-2xl font-extrabold mt-3" style={{ fontFamily: "'Cabinet Grotesk', sans-serif" }}>
                          {plan.price}
                        </p>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <ul className="space-y-2">
                          {plan.features.map((f, i) => (
                            <li key={i} className="flex items-start gap-2 text-xs text-muted-foreground">
                              <CheckCircle className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" /> {f}
                            </li>
                          ))}
                        </ul>
                        <Button
                          data-testid={`button-select-plan-${key}`}
                          className="w-full font-bold"
                          style={{ fontFamily: "'Cabinet Grotesk', sans-serif" }}
                          variant={isCurrent ? "outline" : "default"}
                          size="sm"
                          disabled={isCurrent || checkoutMutation.isPending}
                          onClick={() => !isCurrent && checkoutMutation.mutate(key)}
                        >
                          {isCurrent ? "Current Plan" : "Select Plan"}
                        </Button>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
              <p className="text-xs text-muted-foreground text-center">
                Questions about billing? Email{" "}
                <a href="mailto:care@myprimevitality.com" className="hover:underline font-semibold" style={{ color: "hsl(0 55% 22%)" }}>
                  care@myprimevitality.com
                </a>
              </p>
            </div>
          )}

          {/* TELEHEALTH */}
          {activeTab === "telehealth" && (
            <div className="space-y-6">
              <div>
                <h1 className="text-xl font-extrabold page-heading">Video Visit</h1>
                <p className="text-sm text-muted-foreground mt-1">Join your telehealth consultation via Doxy.me</p>
              </div>
              <Card className="shadow-[0_1px_6px_rgba(15,21,35,0.07)] border-border/60">
                <CardContent className="p-8 text-center space-y-5">
                  <div className="w-20 h-20 rounded-2xl flex items-center justify-center mx-auto" style={{ background: "hsl(0 55% 22% / 0.08)" }}>
                    <Video className="w-10 h-10 text-primary" />
                  </div>
                  <div>
                    <h2 className="text-base font-extrabold" style={{ fontFamily: "'Cabinet Grotesk', sans-serif" }}>
                      Prime Vitality Telehealth Room
                    </h2>
                    <p className="text-sm text-muted-foreground mt-1.5 max-w-sm mx-auto">
                      Your provider will be waiting in the virtual room at your scheduled appointment time.
                    </p>
                  </div>
                  <div className="bg-muted/60 border border-border/50 rounded-xl p-4 text-sm text-muted-foreground space-y-1.5 text-left max-w-sm mx-auto">
                    <p>• No downloads required — works in your browser</p>
                    <p>• Make sure your camera and microphone are enabled</p>
                    <p>• Join a few minutes early to test your connection</p>
                  </div>
                  <a
                    href="https://doxy.me/primevitality"
                    target="_blank"
                    rel="noopener noreferrer"
                    data-testid="link-join-doxy"
                  >
                    <Button className="w-full sm:w-auto font-bold gap-2" size="lg" style={{ fontFamily: "'Cabinet Grotesk', sans-serif" }}>
                      <Video className="w-5 h-5" /> Join Video Visit
                    </Button>
                  </a>
                  <p className="text-xs text-muted-foreground">
                    Room: <span className="font-mono text-foreground">doxy.me/primevitality</span>
                  </p>
                </CardContent>
              </Card>

              {upcomingAppts.length > 0 && (
                <Card className="shadow-[0_1px_6px_rgba(15,21,35,0.07)] border-border/60">
                  <CardHeader>
                    <CardTitle className="text-base" style={{ fontFamily: "'Cabinet Grotesk', sans-serif" }}>Upcoming Appointments</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {upcomingAppts.map(appt => (
                      <div key={appt.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-xl border border-border/40">
                        <div>
                          <p className="text-sm font-semibold capitalize">{appt.type.replace("_", " ")}</p>
                          <p className="text-xs text-muted-foreground">{new Date(appt.scheduledAt).toLocaleString()}</p>
                        </div>
                        <StatusBadge status={appt.status} />
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
