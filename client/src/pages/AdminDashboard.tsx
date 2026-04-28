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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import {
  LayoutDashboard, Users, FlaskConical, MessageSquare, Calendar, LogOut,
  User, CheckCircle, Clock, XCircle, AlertCircle, Send, Pill, Shield,
  Activity, Upload, Plus, Search, ChevronDown, ChevronUp
} from "lucide-react";
import type { Message, Appointment } from "@shared/schema";

interface AdminDashboardProps {
  user: AppUser;
  onLogout: () => void;
  onUpdateUser: (u: AppUser) => void;
}

type Patient = {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  dateOfBirth?: string;
  subscriptionPlan?: string;
  subscriptionStatus?: string;
  createdAt: string;
};

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    active: { label: "Active", cls: "bg-green-100 text-green-800" },
    inactive: { label: "Inactive", cls: "bg-gray-100 text-gray-600" },
    cancelled: { label: "Cancelled", cls: "bg-red-100 text-red-700" },
    past_due: { label: "Past Due", cls: "bg-amber-100 text-amber-700" },
    requested: { label: "Requested", cls: "bg-blue-100 text-blue-700" },
    confirmed: { label: "Confirmed", cls: "bg-green-100 text-green-700" },
    completed: { label: "Completed", cls: "bg-gray-100 text-gray-600" },
  };
  const s = map[status] ?? { label: status, cls: "bg-gray-100 text-gray-600" };
  return <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${s.cls}`}>{s.label}</span>;
}

export default function AdminDashboard({ user, onLogout }: AdminDashboardProps) {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("overview");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [patientDetailOpen, setPatientDetailOpen] = useState(false);

  // Message compose state
  const [composeOpen, setComposeOpen] = useState(false);
  const [msgTo, setMsgTo] = useState<number | null>(null);
  const [msgSubject, setMsgSubject] = useState("");
  const [msgBody, setMsgBody] = useState("");

  // Lab upload state
  const [labOpen, setLabOpen] = useState(false);
  const [labPatientId, setLabPatientId] = useState<number | null>(null);
  const [labTitle, setLabTitle] = useState("");
  const [labDate, setLabDate] = useState("");
  const [labNotes, setLabNotes] = useState("");
  const [labResults, setLabResults] = useState("");

  // Appointment confirm state
  const [apptConfirmId, setApptConfirmId] = useState<number | null>(null);

  // Treatment plan state
  const [treatOpen, setTreatOpen] = useState(false);
  const [treatPatientId, setTreatPatientId] = useState<number | null>(null);
  const [treatTitle, setTreatTitle] = useState("");
  const [treatMeds, setTreatMeds] = useState("");
  const [treatDosing, setTreatDosing] = useState("");
  const [treatInstructions, setTreatInstructions] = useState("");
  const [treatNextLab, setTreatNextLab] = useState("");

  // Subscription state
  const [subPatientId, setSubPatientId] = useState<number | null>(null);
  const [subPlan, setSubPlan] = useState("starter");
  const [subStatus, setSubStatus] = useState("active");
  const [subDialogOpen, setSubDialogOpen] = useState(false);

  // Queries
  const { data: patients, isLoading: patientsLoading } = useQuery<Patient[]>({
    queryKey: ["/api/patients"],
    queryFn: () => apiRequest("GET", "/api/patients").then(r => r.json()),
  });

  const { data: allMessages, isLoading: msgsLoading } = useQuery<Message[]>({
    queryKey: ["/api/messages"],
    queryFn: () => apiRequest("GET", "/api/messages").then(r => r.json()),
  });

  const { data: allAppointments, isLoading: apptsLoading } = useQuery<Appointment[]>({
    queryKey: ["/api/appointments"],
    queryFn: () => apiRequest("GET", "/api/appointments").then(r => r.json()),
  });

  // Mutations
  const sendMessageMutation = useMutation({
    mutationFn: (data: { toUserId: number; subject: string; body: string }) =>
      apiRequest("POST", "/api/messages", data).then(r => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/messages"] });
      setComposeOpen(false);
      setMsgSubject(""); setMsgBody(""); setMsgTo(null);
      toast({ title: "Message sent" });
    },
    onError: () => toast({ title: "Error", description: "Could not send message.", variant: "destructive" }),
  });

  const uploadLabMutation = useMutation({
    mutationFn: (data: any) =>
      apiRequest("POST", "/api/labs", data).then(r => r.json()),
    onSuccess: () => {
      setLabOpen(false);
      setLabTitle(""); setLabDate(""); setLabNotes(""); setLabResults(""); setLabPatientId(null);
      toast({ title: "Lab results uploaded" });
    },
    onError: () => toast({ title: "Error", description: "Upload failed.", variant: "destructive" }),
  });

  const confirmApptMutation = useMutation({
    mutationFn: (id: number) =>
      apiRequest("PATCH", `/api/appointments/${id}/status`, { status: "confirmed" }).then(r => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/appointments"] });
      toast({ title: "Appointment confirmed" });
    },
    onError: () => toast({ title: "Error", description: "Could not confirm appointment.", variant: "destructive" }),
  });

  const cancelApptMutation = useMutation({
    mutationFn: (id: number) =>
      apiRequest("PATCH", `/api/appointments/${id}/status`, { status: "cancelled" }).then(r => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/appointments"] });
      toast({ title: "Appointment cancelled" });
    },
  });

  const createTreatmentMutation = useMutation({
    mutationFn: (data: any) =>
      apiRequest("POST", "/api/treatment", data).then(r => r.json()),
    onSuccess: () => {
      setTreatOpen(false);
      setTreatTitle(""); setTreatMeds(""); setTreatDosing(""); setTreatInstructions(""); setTreatNextLab(""); setTreatPatientId(null);
      toast({ title: "Treatment plan created" });
    },
    onError: () => toast({ title: "Error", description: "Could not create plan.", variant: "destructive" }),
  });

  const updateSubscriptionMutation = useMutation({
    mutationFn: (data: { patientId: number; plan: string; status: string }) =>
      apiRequest("POST", "/api/admin/subscription", data).then(r => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/patients"] });
      setSubDialogOpen(false);
      toast({ title: "Subscription updated" });
    },
    onError: () => toast({ title: "Error", description: "Could not update subscription.", variant: "destructive" }),
  });

  const filteredPatients = patients?.filter(p =>
    [p.firstName, p.lastName, p.email].join(" ").toLowerCase().includes(searchQuery.toLowerCase())
  ) ?? [];

  const pendingAppts = allAppointments?.filter(a => a.status === "requested") ?? [];
  const unreadMessages = allMessages?.filter(m => m.toUserId === user.id && !m.isRead) ?? [];

  const navItems = [
    { id: "overview", label: "Overview", icon: LayoutDashboard },
    { id: "patients", label: "Patients", icon: Users, badge: patients?.length },
    { id: "messages", label: "Messages", icon: MessageSquare, badge: unreadMessages.length || undefined },
    { id: "appointments", label: "Appointments", icon: Calendar, badge: pendingAppts.length || undefined },
    { id: "labs", label: "Upload Labs", icon: FlaskConical },
    { id: "treatment", label: "Treatment Plans", icon: Pill },
  ];

  return (
    <div className="min-h-screen bg-background flex">
      {/* Sidebar */}
      <aside className="w-64 bg-sidebar text-sidebar-foreground flex flex-col border-r border-sidebar-border shrink-0">
        <div className="p-6 border-b border-sidebar-border">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-primary flex items-center justify-center">
              <Activity className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="font-bold text-sm leading-tight">Prime Vitality</div>
              <div className="text-xs text-sidebar-foreground/60 flex items-center gap-1">
                <Shield className="w-3 h-3" /> Admin Panel
              </div>
            </div>
          </div>
        </div>

        <nav className="flex-1 p-4 space-y-1" data-testid="nav-admin-sidebar">
          {navItems.map(item => (
            <button
              key={item.id}
              data-testid={`nav-admin-${item.id}`}
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

        <div className="p-4 border-t border-sidebar-border">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
              <Shield className="w-4 h-4 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium truncate">{user.firstName} {user.lastName}</div>
              <div className="text-xs text-sidebar-foreground/60">Administrator</div>
            </div>
          </div>
          <Button
            data-testid="button-admin-logout"
            variant="ghost"
            size="sm"
            className="w-full justify-start text-sidebar-foreground/70 hover:text-sidebar-foreground gap-2"
            onClick={onLogout}
          >
            <LogOut className="w-4 h-4" /> Sign Out
          </Button>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 overflow-auto">
        <div className="max-w-5xl mx-auto p-8">

          {/* OVERVIEW */}
          {activeTab === "overview" && (
            <div className="space-y-6">
              <div>
                <h1 className="text-xl font-bold">Admin Overview</h1>
                <p className="text-sm text-muted-foreground mt-1">Prime Vitality practice dashboard</p>
              </div>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                  { label: "Total Patients", value: patients?.length ?? "—", icon: Users, color: "bg-blue-50 text-blue-600" },
                  { label: "Active Plans", value: patients?.filter(p => p.subscriptionStatus === "active").length ?? "—", icon: CheckCircle, color: "bg-green-50 text-green-600" },
                  { label: "Pending Appts", value: pendingAppts.length, icon: Calendar, color: "bg-amber-50 text-amber-600" },
                  { label: "Unread Messages", value: unreadMessages.length, icon: MessageSquare, color: "bg-red-50 text-red-600" },
                ].map((stat, i) => (
                  <Card key={i} data-testid={`card-stat-${i}`}>
                    <CardContent className="p-4">
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${stat.color}`}>
                          <stat.icon className="w-5 h-5" />
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">{stat.label}</p>
                          <p className="text-lg font-bold">{stat.value}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              {/* Recent activity */}
              {pendingAppts.length > 0 && (
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 text-amber-500" /> Appointments Needing Confirmation
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {pendingAppts.slice(0, 5).map(appt => {
                      const patient = patients?.find(p => p.id === appt.patientId);
                      return (
                        <div key={appt.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                          <div>
                            <p className="text-sm font-medium">
                              {patient ? `${patient.firstName} ${patient.lastName}` : `Patient #${appt.patientId}`}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {new Date(appt.scheduledAt).toLocaleString()} · {appt.type.replace("_", " ")}
                            </p>
                          </div>
                          <div className="flex gap-2">
                            <Button
                              data-testid={`button-confirm-appt-${appt.id}`}
                              size="sm"
                              onClick={() => confirmApptMutation.mutate(appt.id)}
                              disabled={confirmApptMutation.isPending}
                            >
                              Confirm
                            </Button>
                            <Button
                              data-testid={`button-cancel-appt-${appt.id}`}
                              size="sm"
                              variant="outline"
                              onClick={() => cancelApptMutation.mutate(appt.id)}
                            >
                              Cancel
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </CardContent>
                </Card>
              )}
            </div>
          )}

          {/* PATIENTS */}
          {activeTab === "patients" && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-xl font-bold">Patients</h1>
                  <p className="text-sm text-muted-foreground mt-1">{patients?.length ?? 0} registered patients</p>
                </div>
              </div>

              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  data-testid="input-patient-search"
                  placeholder="Search by name or email..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>

              {patientsLoading ? (
                <div className="space-y-3">{[1,2,3,4].map(i => <Skeleton key={i} className="h-16 w-full" />)}</div>
              ) : filteredPatients.length > 0 ? (
                <div className="space-y-2">
                  {filteredPatients.map(patient => (
                    <Card key={patient.id} data-testid={`card-patient-${patient.id}`} className="hover:border-primary/30 transition-colors cursor-pointer"
                      onClick={() => { setSelectedPatient(patient); setPatientDetailOpen(true); }}>
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center">
                              <User className="w-4 h-4 text-primary" />
                            </div>
                            <div>
                              <p className="text-sm font-medium">{patient.firstName} {patient.lastName}</p>
                              <p className="text-xs text-muted-foreground">{patient.email}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {patient.subscriptionPlan && (
                              <Badge variant="outline" className="text-xs capitalize">{patient.subscriptionPlan}</Badge>
                            )}
                            <StatusBadge status={patient.subscriptionStatus ?? "inactive"} />
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <Card>
                  <CardContent className="py-12 text-center">
                    <Users className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
                    <p className="text-sm font-medium">No patients found</p>
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
                  <p className="text-sm text-muted-foreground mt-1">Patient communications</p>
                </div>
                <Dialog open={composeOpen} onOpenChange={setComposeOpen}>
                  <DialogTrigger asChild>
                    <Button data-testid="button-admin-compose" size="sm">
                      <Send className="w-4 h-4 mr-2" /> New Message
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Message a Patient</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 mt-2">
                      <div>
                        <Label>Patient</Label>
                        <Select onValueChange={v => setMsgTo(parseInt(v))}>
                          <SelectTrigger data-testid="select-msg-patient" className="mt-1">
                            <SelectValue placeholder="Select a patient" />
                          </SelectTrigger>
                          <SelectContent>
                            {patients?.map(p => (
                              <SelectItem key={p.id} value={String(p.id)}>
                                {p.firstName} {p.lastName}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label>Subject</Label>
                        <Input data-testid="input-admin-msg-subject" value={msgSubject} onChange={e => setMsgSubject(e.target.value)} className="mt-1" placeholder="Message subject" />
                      </div>
                      <div>
                        <Label>Message</Label>
                        <Textarea data-testid="input-admin-msg-body" value={msgBody} onChange={e => setMsgBody(e.target.value)} rows={5} className="mt-1" placeholder="Your message..." />
                      </div>
                      <Button
                        data-testid="button-admin-send-message"
                        className="w-full"
                        disabled={!msgTo || !msgSubject || !msgBody || sendMessageMutation.isPending}
                        onClick={() => msgTo && sendMessageMutation.mutate({ toUserId: msgTo, subject: msgSubject, body: msgBody })}
                      >
                        {sendMessageMutation.isPending ? "Sending..." : "Send"}
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>

              {msgsLoading ? (
                <div className="space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-20 w-full" />)}</div>
              ) : allMessages && allMessages.length > 0 ? (
                <div className="space-y-3">
                  {allMessages.map(msg => {
                    const fromPatient = patients?.find(p => p.id === msg.fromUserId);
                    const toPatient = patients?.find(p => p.id === msg.toUserId);
                    const isFromAdmin = msg.fromUserId === user.id;
                    return (
                      <Card key={msg.id} data-testid={`card-admin-msg-${msg.id}`} className={!msg.isRead && msg.toUserId === user.id ? "border-primary/30 bg-primary/5" : ""}>
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="text-xs font-medium text-muted-foreground">
                                  {isFromAdmin
                                    ? `You → ${toPatient ? `${toPatient.firstName} ${toPatient.lastName}` : "Patient"}`
                                    : `${fromPatient ? `${fromPatient.firstName} ${fromPatient.lastName}` : "Patient"} → You`}
                                </span>
                                {!msg.isRead && msg.toUserId === user.id && (
                                  <span className="text-xs bg-primary text-white rounded-full px-1.5 py-0.5">Unread</span>
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
                  </CardContent>
                </Card>
              )}
            </div>
          )}

          {/* APPOINTMENTS */}
          {activeTab === "appointments" && (
            <div className="space-y-6">
              <div>
                <h1 className="text-xl font-bold">Appointments</h1>
                <p className="text-sm text-muted-foreground mt-1">All scheduled consultations</p>
              </div>

              <Tabs defaultValue="pending">
                <TabsList>
                  <TabsTrigger value="pending">Pending ({pendingAppts.length})</TabsTrigger>
                  <TabsTrigger value="all">All</TabsTrigger>
                </TabsList>
                <TabsContent value="pending" className="space-y-3 mt-4">
                  {pendingAppts.length > 0 ? pendingAppts.map(appt => {
                    const patient = patients?.find(p => p.id === appt.patientId);
                    return (
                      <Card key={appt.id} data-testid={`card-appt-admin-${appt.id}`}>
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between gap-4">
                            <div>
                              <p className="text-sm font-medium">
                                {patient ? `${patient.firstName} ${patient.lastName}` : `Patient #${appt.patientId}`}
                              </p>
                              <p className="text-xs text-muted-foreground capitalize">
                                {appt.type.replace("_", " ")} · {new Date(appt.scheduledAt).toLocaleString()}
                              </p>
                              {appt.notes && <p className="text-xs text-muted-foreground mt-1">{appt.notes}</p>}
                            </div>
                            <div className="flex gap-2 shrink-0">
                              <Button
                                data-testid={`button-confirm-appt-tab-${appt.id}`}
                                size="sm"
                                onClick={() => confirmApptMutation.mutate(appt.id)}
                                disabled={confirmApptMutation.isPending}
                              >
                                Confirm
                              </Button>
                              <Button
                                data-testid={`button-cancel-appt-tab-${appt.id}`}
                                size="sm"
                                variant="outline"
                                onClick={() => cancelApptMutation.mutate(appt.id)}
                              >
                                Cancel
                              </Button>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  }) : (
                    <Card>
                      <CardContent className="py-12 text-center">
                        <Calendar className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
                        <p className="text-sm font-medium">No pending appointments</p>
                      </CardContent>
                    </Card>
                  )}
                </TabsContent>
                <TabsContent value="all" className="space-y-3 mt-4">
                  {apptsLoading ? (
                    <div className="space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-20 w-full" />)}</div>
                  ) : allAppointments && allAppointments.length > 0 ? allAppointments.map(appt => {
                    const patient = patients?.find(p => p.id === appt.patientId);
                    return (
                      <Card key={appt.id} data-testid={`card-appt-all-${appt.id}`}>
                        <CardContent className="p-4">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-sm font-medium">
                                {patient ? `${patient.firstName} ${patient.lastName}` : `Patient #${appt.patientId}`}
                              </p>
                              <p className="text-xs text-muted-foreground capitalize">
                                {appt.type.replace("_", " ")} · {new Date(appt.scheduledAt).toLocaleString()}
                              </p>
                            </div>
                            <StatusBadge status={appt.status} />
                          </div>
                        </CardContent>
                      </Card>
                    );
                  }) : (
                    <Card>
                      <CardContent className="py-12 text-center">
                        <p className="text-sm font-medium">No appointments</p>
                      </CardContent>
                    </Card>
                  )}
                </TabsContent>
              </Tabs>
            </div>
          )}

          {/* LABS */}
          {activeTab === "labs" && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-xl font-bold">Upload Lab Results</h1>
                  <p className="text-sm text-muted-foreground mt-1">Add lab results to a patient's record</p>
                </div>
                <Dialog open={labOpen} onOpenChange={setLabOpen}>
                  <DialogTrigger asChild>
                    <Button data-testid="button-upload-lab" size="sm">
                      <Upload className="w-4 h-4 mr-2" /> Upload Results
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Upload Lab Results</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 mt-2">
                      <div>
                        <Label>Patient</Label>
                        <Select onValueChange={v => setLabPatientId(parseInt(v))}>
                          <SelectTrigger data-testid="select-lab-patient" className="mt-1">
                            <SelectValue placeholder="Select a patient" />
                          </SelectTrigger>
                          <SelectContent>
                            {patients?.map(p => (
                              <SelectItem key={p.id} value={String(p.id)}>
                                {p.firstName} {p.lastName}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label>Report Title</Label>
                        <Input data-testid="input-lab-title" value={labTitle} onChange={e => setLabTitle(e.target.value)} className="mt-1" placeholder="e.g. Comprehensive Hormone Panel" />
                      </div>
                      <div>
                        <Label>Date</Label>
                        <Input data-testid="input-lab-date" type="date" value={labDate} onChange={e => setLabDate(e.target.value)} className="mt-1" />
                      </div>
                      <div>
                        <Label>Results (JSON key:value, e.g. Testosterone:450 ng/dL, LH:3.2 mIU/mL)</Label>
                        <Textarea
                          data-testid="input-lab-results"
                          value={labResults}
                          onChange={e => setLabResults(e.target.value)}
                          className="mt-1 font-mono text-xs"
                          rows={4}
                          placeholder={'{"Testosterone": "450 ng/dL", "LH": "3.2 mIU/mL", "FSH": "2.1 mIU/mL"}'}
                        />
                      </div>
                      <div>
                        <Label>Provider Notes (optional)</Label>
                        <Textarea data-testid="input-lab-notes" value={labNotes} onChange={e => setLabNotes(e.target.value)} rows={3} className="mt-1" placeholder="Clinical interpretation..." />
                      </div>
                      <Button
                        data-testid="button-submit-lab"
                        className="w-full"
                        disabled={!labPatientId || !labTitle || !labDate || !labResults || uploadLabMutation.isPending}
                        onClick={() => {
                          if (!labPatientId) return;
                          let parsed: Record<string, string> = {};
                          try { parsed = JSON.parse(labResults); } catch { toast({ title: "Invalid JSON", description: "Results must be valid JSON.", variant: "destructive" }); return; }
                          uploadLabMutation.mutate({
                            patientId: labPatientId,
                            uploadedBy: user.id,
                            title: labTitle,
                            date: labDate,
                            notes: labNotes,
                            results: JSON.stringify(parsed),
                          });
                        }}
                      >
                        {uploadLabMutation.isPending ? "Uploading..." : "Upload Results"}
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>

              <Card>
                <CardContent className="py-12 text-center">
                  <FlaskConical className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
                  <p className="text-sm font-medium">Upload lab results to patients</p>
                  <p className="text-xs text-muted-foreground mt-1">Use the button above to add lab results to any patient's record</p>
                </CardContent>
              </Card>
            </div>
          )}

          {/* TREATMENT PLANS */}
          {activeTab === "treatment" && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-xl font-bold">Treatment Plans</h1>
                  <p className="text-sm text-muted-foreground mt-1">Create and manage patient TRT protocols</p>
                </div>
                <Dialog open={treatOpen} onOpenChange={setTreatOpen}>
                  <DialogTrigger asChild>
                    <Button data-testid="button-create-treatment" size="sm">
                      <Plus className="w-4 h-4 mr-2" /> New Plan
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Create Treatment Plan</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 mt-2 max-h-[70vh] overflow-y-auto pr-1">
                      <div>
                        <Label>Patient</Label>
                        <Select onValueChange={v => setTreatPatientId(parseInt(v))}>
                          <SelectTrigger data-testid="select-treat-patient" className="mt-1">
                            <SelectValue placeholder="Select a patient" />
                          </SelectTrigger>
                          <SelectContent>
                            {patients?.map(p => (
                              <SelectItem key={p.id} value={String(p.id)}>
                                {p.firstName} {p.lastName}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label>Protocol Title</Label>
                        <Input data-testid="input-treat-title" value={treatTitle} onChange={e => setTreatTitle(e.target.value)} className="mt-1" placeholder="e.g. TRT — Testosterone Cypionate Protocol" />
                      </div>
                      <div>
                        <Label>Medications (comma-separated)</Label>
                        <Input data-testid="input-treat-meds" value={treatMeds} onChange={e => setTreatMeds(e.target.value)} className="mt-1" placeholder="Testosterone Cypionate, HCG, Anastrozole" />
                      </div>
                      <div>
                        <Label>Dosing Schedule</Label>
                        <Textarea data-testid="input-treat-dosing" value={treatDosing} onChange={e => setTreatDosing(e.target.value)} rows={2} className="mt-1" placeholder="200mg Testosterone Cypionate IM q7d, 500 IU HCG IM q3d" />
                      </div>
                      <div>
                        <Label>Patient Instructions</Label>
                        <Textarea data-testid="input-treat-instructions" value={treatInstructions} onChange={e => setTreatInstructions(e.target.value)} rows={3} className="mt-1" placeholder="Injection technique, storage, monitoring instructions..." />
                      </div>
                      <div>
                        <Label>Next Lab Date</Label>
                        <Input data-testid="input-treat-nextlab" type="date" value={treatNextLab} onChange={e => setTreatNextLab(e.target.value)} className="mt-1" />
                      </div>
                      <Button
                        data-testid="button-submit-treatment"
                        className="w-full"
                        disabled={!treatPatientId || !treatTitle || !treatMeds || !treatDosing || createTreatmentMutation.isPending}
                        onClick={() => {
                          if (!treatPatientId) return;
                          const meds = treatMeds.split(",").map(m => m.trim()).filter(Boolean);
                          createTreatmentMutation.mutate({
                            patientId: treatPatientId,
                            providerId: user.id,
                            title: treatTitle,
                            medications: JSON.stringify(meds),
                            dosing: treatDosing,
                            instructions: treatInstructions,
                            nextLabDate: treatNextLab || null,
                            isActive: 1,
                          });
                        }}
                      >
                        {createTreatmentMutation.isPending ? "Creating..." : "Create Protocol"}
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>

              <Card>
                <CardContent className="py-12 text-center">
                  <Pill className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
                  <p className="text-sm font-medium">Create personalized treatment protocols</p>
                  <p className="text-xs text-muted-foreground mt-1">Treatment plans are visible to patients in their dashboard</p>
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      </main>

      {/* Patient detail dialog */}
      <Dialog open={patientDetailOpen} onOpenChange={setPatientDetailOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {selectedPatient ? `${selectedPatient.firstName} ${selectedPatient.lastName}` : "Patient"}
            </DialogTitle>
          </DialogHeader>
          {selectedPatient && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-xs text-muted-foreground">Email</p>
                  <p className="font-medium truncate">{selectedPatient.email}</p>
                </div>
                {selectedPatient.phone && (
                  <div>
                    <p className="text-xs text-muted-foreground">Phone</p>
                    <p className="font-medium">{selectedPatient.phone}</p>
                  </div>
                )}
                {selectedPatient.dateOfBirth && (
                  <div>
                    <p className="text-xs text-muted-foreground">Date of Birth</p>
                    <p className="font-medium">{selectedPatient.dateOfBirth}</p>
                  </div>
                )}
                <div>
                  <p className="text-xs text-muted-foreground">Joined</p>
                  <p className="font-medium">{new Date(selectedPatient.createdAt).toLocaleDateString()}</p>
                </div>
              </div>

              {/* Subscription management */}
              <div className="border rounded-lg p-4 space-y-3">
                <p className="text-sm font-medium">Subscription</p>
                <div className="flex items-center gap-3">
                  <StatusBadge status={selectedPatient.subscriptionStatus ?? "inactive"} />
                  {selectedPatient.subscriptionPlan && (
                    <Badge variant="outline" className="capitalize">{selectedPatient.subscriptionPlan}</Badge>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <Select defaultValue={selectedPatient.subscriptionPlan || "starter"} onValueChange={v => setSubPlan(v)}>
                    <SelectTrigger data-testid="select-patient-plan" className="text-xs">
                      <SelectValue placeholder="Plan" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="starter">Starter — $149/mo</SelectItem>
                      <SelectItem value="optimized">Optimized — $249/mo</SelectItem>
                      <SelectItem value="elite">Elite — $399/mo</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select defaultValue={selectedPatient.subscriptionStatus || "inactive"} onValueChange={v => setSubStatus(v)}>
                    <SelectTrigger data-testid="select-patient-status" className="text-xs">
                      <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="inactive">Inactive</SelectItem>
                      <SelectItem value="cancelled">Cancelled</SelectItem>
                      <SelectItem value="past_due">Past Due</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button
                  data-testid="button-update-subscription"
                  size="sm"
                  className="w-full"
                  disabled={updateSubscriptionMutation.isPending}
                  onClick={() => updateSubscriptionMutation.mutate({
                    patientId: selectedPatient.id,
                    plan: subPlan,
                    status: subStatus,
                  })}
                >
                  {updateSubscriptionMutation.isPending ? "Updating..." : "Update Subscription"}
                </Button>
              </div>

              <div className="flex gap-2">
                <Button
                  data-testid="button-message-patient"
                  size="sm"
                  variant="outline"
                  className="flex-1"
                  onClick={() => {
                    setMsgTo(selectedPatient.id);
                    setPatientDetailOpen(false);
                    setActiveTab("messages");
                    setComposeOpen(true);
                  }}
                >
                  <MessageSquare className="w-4 h-4 mr-1.5" /> Message
                </Button>
                <Button
                  data-testid="button-upload-lab-for-patient"
                  size="sm"
                  variant="outline"
                  className="flex-1"
                  onClick={() => {
                    setLabPatientId(selectedPatient.id);
                    setPatientDetailOpen(false);
                    setActiveTab("labs");
                    setLabOpen(true);
                  }}
                >
                  <FlaskConical className="w-4 h-4 mr-1.5" /> Upload Labs
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
