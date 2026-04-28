import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { AppUser } from "../App";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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

const PLAN_INFO: Record<string, { label: string; price: string; color: string; features: string[] }> = {
  starter: {
    label: "Starter",
    price: "$149/mo",
    color: "bg-blue-100 text-blue-800",
    features: ["Monthly TRT consultation", "Basic lab panel", "Secure messaging", "Standard shipping"],
  },
  optimized: {
    label: "Optimized",
    price: "$249/mo",
    color: "bg-primary/10 text-primary",
    features: ["Bi-weekly consultations", "Comprehensive lab panel", "Priority messaging", "Expedited shipping", "Nutrition guidance"],
  },
  elite: {
    label: "Elite",
    price: "$399/mo",
    color: "bg-amber-100 text-amber-800",
    features: ["Weekly consultations", "Full hormone panel + peptides", "24/7 priority access", "Same-day shipping", "Personalized protocol", "Body composition tracking"],
  },
};

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string; icon: JSX.Element }> = {
    active: { label: "Active", cls: "bg-green-100 text-green-800", icon: <CheckCircle className="w-3 h-3" /> },
    inactive: { label: "Inactive", cls: "bg-gray-100 text-gray-600", icon: <Clock className="w-3 h-3" /> },
    cancelled: { label: "Cancelled", cls: "bg-red-100 text-red-700", icon: <XCircle className="w-3 h-3" /> },
    past_due: { label: "Past Due", cls: "bg-amber-100 text-amber-700", icon: <AlertCircle className="w-3 h-3" /> },
    requested: { label: "Requested", cls: "bg-blue-100 text-blue-700", icon: <Clock className="w-3 h-3" /> },
    confirmed: { label: "Confirmed", cls: "bg-green-100 text-green-700", icon: <CheckCircle className="w-3 h-3" /> },
    completed: { label: "Completed", cls: "bg-gray-100 text-gray-600", icon: <CheckCircle className="w-3 h-3" /> },
  };
  const s = map[status] ?? { label: status, cls: "bg-gray-100 text-gray-600", icon: <Clock className="w-3 h-3" /> };
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${s.cls}`}>
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
    { id: "overview", label: "Overview", icon: LayoutDashboard },
    { id: "labs", label: "Lab Results", icon: FlaskConical },
    { id: "messages", label: "Messages", icon: MessageSquare, badge: unreadCount },
    { id: "appointments", label: "Appointments", icon: Calendar },
    { id: "treatment", label: "Treatment Plan", icon: Pill },
    { id: "subscription", label: "Subscription", icon: CreditCard },
    { id: "telehealth", label: "Video Visit", icon: Video },
  ];

  return (
    <div className="min-h-screen bg-background flex">
      {/* Sidebar */}
      <aside className="w-64 bg-sidebar text-sidebar-foreground flex flex-col border-r border-sidebar-border shrink-0">
        {/* Logo */}
        <div className="p-6 border-b border-sidebar-border">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-primary flex items-center justify-center">
              <Activity className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="font-bold text-sm leading-tight">Prime Vitality</div>
              <div className="text-xs text-sidebar-foreground/60">Patient Portal</div>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 p-4 space-y-1" data-testid="nav-sidebar">
          {navItems.map(item => (
            <button
              key={item.id}
              data-testid={`nav-${item.id}`}
              onClick={() => setActiveTab(item.id)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                activeTab === item.id
                  ? "bg-sidebar-primary text-sidebar-primary-foreground font-medium"
                  : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              }`}
            >
              <item.icon className="w-4 h-4 shrink-0" />
              <span className="flex-1 text-left">{item.label}</span>
              {item.badge ? (
                <span className="bg-primary text-white text-xs rounded-full px-1.5 py-0.5 min-w-[20px] text-center">
                  {item.badge}
                </span>
              ) : null}
            </button>
          ))}
        </nav>

        {/* User footer */}
        <div className="p-4 border-t border-sidebar-border">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
              <User className="w-4 h-4 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium truncate">{user.firstName} {user.lastName}</div>
              <div className="text-xs text-sidebar-foreground/60 truncate">{user.email}</div>
            </div>
          </div>
          <Button
            data-testid="button-logout"
            variant="ghost"
            size="sm"
            className="w-full justify-start text-sidebar-foreground/70 hover:text-sidebar-foreground gap-2"
            onClick={onLogout}
          >
            <LogOut className="w-4 h-4" /> Sign Out
          </Button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto">
        <div className="max-w-5xl mx-auto p-8">

          {/* OVERVIEW */}
          {activeTab === "overview" && (
            <div className="space-y-6">
              <div>
                <h1 className="text-xl font-bold text-foreground">Welcome back, {user.firstName}</h1>
                <p className="text-sm text-muted-foreground mt-1">Here's a summary of your care</p>
              </div>

              {/* Status cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <Card data-testid="card-subscription-status">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                        <CreditCard className="w-5 h-5 text-primary" />
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Plan</p>
                        <p className="text-sm font-semibold">
                          {activePlan ? activePlan.label : "No Plan"}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card data-testid="card-subscription-status2">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-green-50 flex items-center justify-center">
                        <CheckCircle className="w-5 h-5 text-green-600" />
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Status</p>
                        <StatusBadge status={user.subscriptionStatus ?? "inactive"} />
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card data-testid="card-messages-count">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center">
                        <MessageSquare className="w-5 h-5 text-blue-600" />
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Messages</p>
                        <p className="text-sm font-semibold">{unreadCount > 0 ? `${unreadCount} unread` : "Up to date"}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card data-testid="card-appointments-count">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-amber-50 flex items-center justify-center">
                        <Calendar className="w-5 h-5 text-amber-600" />
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Appointments</p>
                        <p className="text-sm font-semibold">{upcomingAppts.length} upcoming</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Active treatment plan snippet */}
              {activeTreatment && (
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Pill className="w-4 h-4 text-primary" /> Current Treatment Protocol
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2 text-sm">
                      <p className="font-medium">{activeTreatment.title}</p>
                      <p className="text-muted-foreground">{activeTreatment.dosing}</p>
                      {activeTreatment.nextLabDate && (
                        <p className="text-muted-foreground">Next labs: <span className="text-foreground font-medium">{activeTreatment.nextLabDate}</span></p>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Quick actions */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <button
                  data-testid="button-quick-compose"
                  onClick={() => { setActiveTab("messages"); setComposeOpen(true); }}
                  className="flex items-center gap-3 p-4 rounded-xl border border-border bg-card hover:bg-accent transition-colors text-left"
                >
                  <MessageSquare className="w-5 h-5 text-primary shrink-0" />
                  <div>
                    <p className="text-sm font-medium">Message Care Team</p>
                    <p className="text-xs text-muted-foreground">Secure messaging</p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-muted-foreground ml-auto" />
                </button>
                <button
                  data-testid="button-quick-appointment"
                  onClick={() => { setActiveTab("appointments"); setApptOpen(true); }}
                  className="flex items-center gap-3 p-4 rounded-xl border border-border bg-card hover:bg-accent transition-colors text-left"
                >
                  <Calendar className="w-5 h-5 text-primary shrink-0" />
                  <div>
                    <p className="text-sm font-medium">Request Appointment</p>
                    <p className="text-xs text-muted-foreground">Schedule a visit</p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-muted-foreground ml-auto" />
                </button>
                <button
                  data-testid="button-quick-video"
                  onClick={() => setActiveTab("telehealth")}
                  className="flex items-center gap-3 p-4 rounded-xl border border-border bg-card hover:bg-accent transition-colors text-left"
                >
                  <Video className="w-5 h-5 text-primary shrink-0" />
                  <div>
                    <p className="text-sm font-medium">Join Video Visit</p>
                    <p className="text-xs text-muted-foreground">via Doxy.me</p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-muted-foreground ml-auto" />
                </button>
              </div>
            </div>
          )}

          {/* LAB RESULTS */}
          {activeTab === "labs" && (
            <div className="space-y-6">
              <div>
                <h1 className="text-xl font-bold">Lab Results</h1>
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
                      <Card key={lab.id} data-testid={`card-lab-${lab.id}`}>
                        <CardHeader className="pb-2">
                          <div className="flex items-start justify-between">
                            <div>
                              <CardTitle className="text-base">{lab.title}</CardTitle>
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
                                <div key={k} className="bg-muted/50 rounded-lg p-2">
                                  <p className="text-xs text-muted-foreground">{k}</p>
                                  <p className="text-sm font-medium">{v}</p>
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
                <Card>
                  <CardContent className="py-12 text-center">
                    <FlaskConical className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
                    <p className="text-sm font-medium">No lab results yet</p>
                    <p className="text-xs text-muted-foreground mt-1">Your provider will upload results after your lab visit</p>
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
                  <h1 className="text-xl font-bold">Messages</h1>
                  <p className="text-sm text-muted-foreground mt-1">Secure messaging with your care team</p>
                </div>
                <Dialog open={composeOpen} onOpenChange={setComposeOpen}>
                  <DialogTrigger asChild>
                    <Button data-testid="button-compose-message" size="sm">
                      <Send className="w-4 h-4 mr-2" /> New Message
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Message Your Care Team</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 mt-2">
                      <div>
                        <Label>Subject</Label>
                        <Input
                          data-testid="input-msg-subject"
                          value={msgSubject}
                          onChange={e => setMsgSubject(e.target.value)}
                          placeholder="e.g. Question about my dosage"
                          className="mt-1"
                        />
                      </div>
                      <div>
                        <Label>Message</Label>
                        <Textarea
                          data-testid="input-msg-body"
                          value={msgBody}
                          onChange={e => setMsgBody(e.target.value)}
                          placeholder="Type your message here..."
                          rows={5}
                          className="mt-1"
                        />
                      </div>
                      <Button
                        data-testid="button-send-message"
                        className="w-full"
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
                      <Card key={msg.id} data-testid={`card-message-${msg.id}`} className={!msg.isRead && !isFromMe ? "border-primary/30 bg-primary/5" : ""}>
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="text-xs font-medium text-muted-foreground">
                                  {isFromMe ? "You → Care Team" : "Care Team → You"}
                                </span>
                                {!msg.isRead && !isFromMe && (
                                  <span className="text-xs bg-primary text-white rounded-full px-1.5 py-0.5">New</span>
                                )}
                              </div>
                              {msg.subject && <p className="text-sm font-medium">{msg.subject}</p>}
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
                <Card>
                  <CardContent className="py-12 text-center">
                    <MessageSquare className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
                    <p className="text-sm font-medium">No messages yet</p>
                    <p className="text-xs text-muted-foreground mt-1">Use the button above to contact your care team</p>
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
                  <h1 className="text-xl font-bold">Appointments</h1>
                  <p className="text-sm text-muted-foreground mt-1">Your telehealth consultations with Prime Vitality</p>
                </div>
                <Dialog open={apptOpen} onOpenChange={setApptOpen}>
                  <DialogTrigger asChild>
                    <Button data-testid="button-request-appointment" size="sm">
                      <Calendar className="w-4 h-4 mr-2" /> Request Appointment
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Request an Appointment</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 mt-2">
                      <div>
                        <Label>Appointment Type</Label>
                        <Select value={apptType} onValueChange={setApptType}>
                          <SelectTrigger data-testid="select-appt-type" className="mt-1">
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
                        <Label>Preferred Date & Time</Label>
                        <Input
                          data-testid="input-appt-date"
                          type="datetime-local"
                          value={apptDate}
                          onChange={e => setApptDate(e.target.value)}
                          className="mt-1"
                        />
                      </div>
                      <div>
                        <Label>Notes (optional)</Label>
                        <Textarea
                          data-testid="input-appt-notes"
                          value={apptNotes}
                          onChange={e => setApptNotes(e.target.value)}
                          placeholder="Any specific concerns or questions..."
                          rows={3}
                          className="mt-1"
                        />
                      </div>
                      <Button
                        data-testid="button-submit-appointment"
                        className="w-full"
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
                    <Card key={appt.id} data-testid={`card-appt-${appt.id}`}>
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                              <Stethoscope className="w-5 h-5 text-primary" />
                            </div>
                            <div>
                              <p className="text-sm font-medium capitalize">{appt.type.replace("_", " ")}</p>
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
                                className="text-xs text-primary hover:underline flex items-center gap-1"
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
                <Card>
                  <CardContent className="py-12 text-center">
                    <Calendar className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
                    <p className="text-sm font-medium">No appointments yet</p>
                    <p className="text-xs text-muted-foreground mt-1">Request an appointment to get started with your care</p>
                  </CardContent>
                </Card>
              )}
            </div>
          )}

          {/* TREATMENT PLAN */}
          {activeTab === "treatment" && (
            <div className="space-y-6">
              <div>
                <h1 className="text-xl font-bold">Treatment Plan</h1>
                <p className="text-sm text-muted-foreground mt-1">Your personalized TRT protocol from Prime Vitality</p>
              </div>
              {activeTreatment ? (
                <Card>
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle className="text-base">{activeTreatment.title}</CardTitle>
                        <CardDescription>Active Protocol</CardDescription>
                      </div>
                      <Badge className="bg-green-100 text-green-800 border-0">Active</Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">Medications</p>
                      <div className="flex flex-wrap gap-2">
                        {(() => {
                          let meds: string[] = [];
                          try { meds = JSON.parse(activeTreatment.medications); } catch {}
                          return meds.map((med, i) => (
                            <span key={i} className="bg-primary/10 text-primary text-xs px-2.5 py-1 rounded-full font-medium">
                              <Pill className="w-3 h-3 inline mr-1" />{med}
                            </span>
                          ));
                        })()}
                      </div>
                    </div>
                    <div>
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">Dosing Schedule</p>
                      <p className="text-sm">{activeTreatment.dosing}</p>
                    </div>
                    {activeTreatment.instructions && (
                      <div>
                        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">Instructions</p>
                        <p className="text-sm">{activeTreatment.instructions}</p>
                      </div>
                    )}
                    {activeTreatment.nextLabDate && (
                      <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                        <p className="text-sm font-medium text-amber-800">
                          <FlaskConical className="w-4 h-4 inline mr-1.5" />
                          Next Labs Due: {activeTreatment.nextLabDate}
                        </p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ) : (
                <Card>
                  <CardContent className="py-12 text-center">
                    <Pill className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
                    <p className="text-sm font-medium">No active treatment plan</p>
                    <p className="text-xs text-muted-foreground mt-1">Your provider will create a protocol after your initial consultation</p>
                  </CardContent>
                </Card>
              )}
            </div>
          )}

          {/* SUBSCRIPTION */}
          {activeTab === "subscription" && (
            <div className="space-y-6">
              <div>
                <h1 className="text-xl font-bold">Subscription</h1>
                <p className="text-sm text-muted-foreground mt-1">Manage your Prime Vitality care plan</p>
              </div>

              {/* Current status */}
              {activePlan && (
                <Card className="border-primary/30">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs text-muted-foreground">Current Plan</p>
                        <p className="text-base font-bold">{activePlan.label} — {activePlan.price}</p>
                        <StatusBadge status={user.subscriptionStatus ?? "inactive"} />
                      </div>
                      <Button
                        data-testid="button-manage-billing"
                        variant="outline"
                        size="sm"
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
                    <Card key={key} data-testid={`card-plan-${key}`} className={isCurrent ? "border-primary ring-1 ring-primary" : ""}>
                      <CardHeader className="pb-3">
                        <div className="flex items-center justify-between">
                          <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${plan.color}`}>{plan.label}</span>
                          {isCurrent && <Badge variant="outline" className="text-xs">Current</Badge>}
                        </div>
                        <p className="text-2xl font-bold mt-2">{plan.price}</p>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <ul className="space-y-1.5">
                          {plan.features.map((f, i) => (
                            <li key={i} className="flex items-start gap-2 text-xs text-muted-foreground">
                              <CheckCircle className="w-3.5 h-3.5 text-green-600 shrink-0 mt-0.5" /> {f}
                            </li>
                          ))}
                        </ul>
                        <Button
                          data-testid={`button-select-plan-${key}`}
                          className="w-full"
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
                Questions about billing? Email <a href="mailto:care@myprimevitality.com" className="text-primary hover:underline">care@myprimevitality.com</a>
              </p>
            </div>
          )}

          {/* TELEHEALTH */}
          {activeTab === "telehealth" && (
            <div className="space-y-6">
              <div>
                <h1 className="text-xl font-bold">Video Visit</h1>
                <p className="text-sm text-muted-foreground mt-1">Join your telehealth consultation via Doxy.me</p>
              </div>
              <Card>
                <CardContent className="p-6 text-center space-y-4">
                  <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
                    <Video className="w-8 h-8 text-primary" />
                  </div>
                  <div>
                    <h2 className="text-base font-bold">Prime Vitality Telehealth Room</h2>
                    <p className="text-sm text-muted-foreground mt-1">
                      Your provider will be waiting in the virtual room at your scheduled appointment time.
                    </p>
                  </div>
                  <div className="bg-muted/50 rounded-lg p-3 text-sm text-muted-foreground space-y-1">
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
                    <Button className="w-full sm:w-auto" size="lg">
                      <Video className="w-5 h-5 mr-2" /> Join Video Visit
                    </Button>
                  </a>
                  <p className="text-xs text-muted-foreground">
                    Room: <span className="font-mono text-foreground">doxy.me/primevitality</span>
                  </p>
                </CardContent>
              </Card>

              {upcomingAppts.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Upcoming Appointments</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {upcomingAppts.map(appt => (
                      <div key={appt.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                        <div>
                          <p className="text-sm font-medium capitalize">{appt.type.replace("_", " ")}</p>
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
