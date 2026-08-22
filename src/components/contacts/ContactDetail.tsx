"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ContactForm } from "./ContactForm";
import { ActivityForm } from "@/components/activities/ActivityForm";
import { ContactMethodDialog } from "@/components/pipeline/ContactMethodDialog";
import { ScheduleVisitDialog } from "@/components/pipeline/ScheduleVisitDialog";
import {
  ArrowLeft,
  Mail,
  Phone,
  Building2,
  Calendar,
  FileText,
  Clock,
  Users,
  Pencil,
  Trash2,
  Plus,
  MessageCircle,
  Copy,
  Check,
  MapPin,
  IdCard,
  UserPlus,
  Bike,
} from "lucide-react";
import { formatCurrency, formatDate, formatRelativeDate, cleanPhoneForWhatsApp } from "@/lib/constants";
import { ACTIVITY_TYPE_CONFIG, SOURCE_LABELS, MOTORCYCLE_LABELS, NEXT_ACTION_CONFIG, VISIT_RESULT_CONFIG } from "@/lib/constants";
import { toast } from "sonner";
import type { ActivityType, LeadSource, MotorcycleInterest, NextAction } from "@/types";

const activityIcons: Record<string, typeof Phone> = {
  call: Phone,
  email: Mail,
  meeting: Users,
  note: FileText,
  follow_up: Clock,
};

interface ContactDetailClientProps {
  contact: {
    id: string;
    name: string;
    stageId: string | null;
    phone: string | null;
    phone2: string | null;
    address: string | null;
    city: string | null;
    neighborhood: string | null;
    identificationNumber: string | null;
    expeditionCity: string | null;
    companionName: string | null;
    motorcycleInterest: string | null;
    company: string | null;
    source: string;
    score: number;
    notes: string | null;
    visitResult: string | null;
    procedureStartDate: number | Date | null;
    createdAt: number | Date;
  };
  stages: Array<{
    id: string;
    name: string;
    color: string;
    nextAction: string | null;
  }>;
  deals: Array<{
    id: string;
    title: string;
    value: number;
    probability: number;
    stageName: string | null;
    stageColor: string | null;
    createdAt: number | Date;
  }>;
  activities: Array<{
    id: string;
    type: string;
    description: string;
    scheduledAt: number | Date | null;
    completedAt: number | Date | null;
    createdAt: number | Date;
  }>;
}

export function ContactDetailClient({
  contact,
  stages,
  deals,
  activities,
}: ContactDetailClientProps) {
  const router = useRouter();
  const [showEditForm, setShowEditForm] = useState(false);
  const [advanceStageId, setAdvanceStageId] = useState<string | null>(null);
  const [showActivityForm, setShowActivityForm] = useState(false);
  const [showScheduleVisit, setShowScheduleVisit] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [stageId, setStageId] = useState(contact.stageId);
  const [pendingStageId, setPendingStageId] = useState<string | null>(null);
  const [visitResult, setVisitResult] = useState<string | null>(contact.visitResult);

  const currentStage = stages.find((s) => s.id === stageId);
  const nextAction = currentStage?.nextAction as NextAction | null | undefined;
  const agendarStageId =
    stages.find((s) => s.name.toLowerCase() === "agendar visita")?.id ?? null;

  const setVisitResultValue = async (result: string) => {
    const previous = visitResult;
    setVisitResult(result);
    try {
      const res = await fetch(`/api/contacts/${contact.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ visitResult: result }),
      });
      if (!res.ok) throw new Error("Error");
      toast.success("Resultado guardado");
      router.refresh();
    } catch {
      setVisitResult(previous);
      toast.error("Error al guardar el resultado");
    }
  };

  const startProcedure = async () => {
    const tramiteStage = stages.find((s) => s.name.toLowerCase() === "inicio de tramite");
    try {
      const res = await fetch(`/api/contacts/${contact.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          procedureStartDate: new Date().toISOString(),
          stageId: tramiteStage?.id,
        }),
      });
      if (!res.ok) throw new Error("Error");
      if (tramiteStage) setStageId(tramiteStage.id);
      toast.success("Tramite iniciado. Fecha de inicio registrada.");
      router.refresh();
    } catch {
      toast.error("Error al iniciar el tramite");
    }
  };

  const openEditForm = () => {
    setAdvanceStageId(null);
    setShowEditForm(true);
  };

  const openRegistroForm = () => {
    setAdvanceStageId(agendarStageId);
    setShowEditForm(true);
  };

  const applyStageChange = async (newStageId: string, contactMethod?: "whatsapp" | "call") => {
    const previous = stageId;
    setStageId(newStageId);
    try {
      const res = await fetch(`/api/contacts/${contact.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stageId: newStageId }),
      });
      if (!res.ok) throw new Error("Error");

      if (contactMethod) {
        await fetch("/api/activities", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            type: "call",
            description:
              contactMethod === "whatsapp"
                ? "Contacto inicial via WhatsApp"
                : "Contacto inicial via llamada telefonica",
            contactId: contact.id,
          }),
        });
      }

      toast.success("Etapa actualizada");
      router.refresh();
    } catch {
      setStageId(previous);
      toast.error("Error al cambiar la etapa");
    }
  };

  const handleStageChange = (newStageId: string) => {
    const targetStage = stages.find((s) => s.id === newStageId);
    if (targetStage?.name.toLowerCase() === "contactado") {
      setPendingStageId(newStageId);
      return;
    }
    applyStageChange(newStageId);
  };

  const handleCopy = async (value: string, field: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedField(field);
      toast.success("Copiado");
      setTimeout(() => setCopiedField(null), 2000);
    } catch {
      toast.error("Error al copiar");
    }
  };

  const handleDelete = async () => {
    if (!confirm("Estas seguro de eliminar este contacto? Esta accion no se puede deshacer.")) {
      return;
    }

    try {
      const res = await fetch(`/api/contacts/${contact.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Error al eliminar");
      toast.success("Contacto eliminado");
      router.push("/contacts");
    } catch {
      toast.error("Error al eliminar el contacto");
    }
  };

  const handleCompleteActivity = async (activityId: string) => {
    try {
      const res = await fetch(`/api/activities/${activityId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ completedAt: new Date().toISOString() }),
      });
      if (!res.ok) throw new Error("Error");
      toast.success("Actividad completada");
      router.refresh();
    } catch {
      toast.error("Error al completar la actividad");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => router.push("/contacts")}
          className="cursor-pointer"
          aria-label="Volver a contactos"
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold">{contact.name}</h1>
          </div>
          <p className="text-muted-foreground">
            Score: {contact.score}/100 &middot;{" "}
            {SOURCE_LABELS[contact.source as LeadSource] || contact.source}
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={openEditForm}
            className="cursor-pointer"
          >
            <Pencil className="h-4 w-4 mr-1" />
            Editar
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleDelete}
            className="cursor-pointer text-destructive hover:text-destructive"
          >
            <Trash2 className="h-4 w-4 mr-1" />
            Eliminar
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="flex flex-col sm:flex-row sm:items-center gap-4 pt-6">
          <div className="flex-1 space-y-1.5">
            <span className="text-xs text-muted-foreground">Etapa actual</span>
            <Select
              value={stageId ?? undefined}
              onValueChange={(v) => v && handleStageChange(v)}
            >
              <SelectTrigger className="cursor-pointer w-full sm:w-64">
                <SelectValue placeholder="Sin etapa" />
              </SelectTrigger>
              <SelectContent>
                {stages.map((stage) => (
                  <SelectItem key={stage.id} value={stage.id}>
                    {stage.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {nextAction && (
            <div className="space-y-1.5">
              <span className="text-xs text-muted-foreground">Siguiente paso</span>
              {contact.phone ? (
                <a
                  href={
                    nextAction === "whatsapp"
                      ? `https://wa.me/${cleanPhoneForWhatsApp(contact.phone)}`
                      : `tel:${contact.phone}`
                  }
                  target={nextAction === "whatsapp" ? "_blank" : undefined}
                  rel={nextAction === "whatsapp" ? "noopener noreferrer" : undefined}
                  className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium ${
                    nextAction === "whatsapp"
                      ? "bg-green-50 text-green-700 hover:bg-green-100"
                      : "bg-blue-50 text-blue-700 hover:bg-blue-100"
                  }`}
                >
                  {nextAction === "whatsapp" ? (
                    <MessageCircle className="h-4 w-4" />
                  ) : (
                    <Phone className="h-4 w-4" />
                  )}
                  {NEXT_ACTION_CONFIG[nextAction].label}
                </a>
              ) : (
                <p className="text-sm">{NEXT_ACTION_CONFIG[nextAction].label}</p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {currentStage?.name.toLowerCase() === "registro online" && (
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-6">
            <div>
              <p className="font-medium">Registro Online</p>
              <p className="text-sm text-muted-foreground">
                Completa todos los datos del cliente: documento, direccion, moto de
                interes y demas.
              </p>
            </div>
            <Button
              onClick={openRegistroForm}
              className="cursor-pointer shrink-0"
            >
              <FileText className="h-4 w-4 mr-2" />
              Diligenciar formulario
            </Button>
          </CardContent>
        </Card>
      )}

      {(currentStage?.name.toLowerCase() === "agendar visita" ||
        currentStage?.name.toLowerCase() === "visitas reagendadas") && (
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-6">
            <div>
              <p className="font-medium">
                {currentStage?.name.toLowerCase() === "visitas reagendadas"
                  ? "Reagendar visita"
                  : "Agendar visita"}
              </p>
              <p className="text-sm text-muted-foreground">
                Asigna visitador, fecha, hora y barrio. Al agendar, el cliente pasa a
                la etapa Visita.
              </p>
            </div>
            <Button
              onClick={() => setShowScheduleVisit(true)}
              className="cursor-pointer shrink-0"
            >
              <Calendar className="h-4 w-4 mr-2" />
              Agendar visita
            </Button>
          </CardContent>
        </Card>
      )}

      {currentStage?.name.toLowerCase() === "estado de la visita" && (
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="space-y-3 pt-6">
            <div>
              <p className="font-medium">Resultado de la visita</p>
              <p className="text-sm text-muted-foreground">
                Marca el resultado. Si es Aprobado, podras iniciar el tramite.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {(["aprobado", "sin_proceso", "negado"] as const).map((r) => {
                const cfg = VISIT_RESULT_CONFIG[r];
                const active = visitResult === r;
                return (
                  <button
                    key={r}
                    onClick={() => setVisitResultValue(r)}
                    className="rounded-lg px-3 py-2 text-sm font-medium border cursor-pointer transition-all"
                    style={{
                      backgroundColor: active ? cfg.bgColor : "transparent",
                      color: active ? cfg.color : undefined,
                      borderColor: active ? cfg.color : "var(--border)",
                    }}
                  >
                    {cfg.label}
                  </button>
                );
              })}
            </div>
            {visitResult === "aprobado" && (
              <div className="pt-2 border-t">
                <Button onClick={startProcedure} className="cursor-pointer">
                  Contactar cliente e iniciar tramite
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Contact info */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Informacion</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {contact.phone && (
              <div className="flex items-center gap-2 text-sm">
                <Phone className="h-4 w-4 text-muted-foreground shrink-0" />
                <span className="flex-1">{contact.phone}</span>
                <div className="flex items-center gap-1">
                  <a
                    href={`https://wa.me/${cleanPhoneForWhatsApp(contact.phone)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-1 rounded hover:bg-green-50 cursor-pointer"
                    title="Abrir WhatsApp"
                  >
                    <MessageCircle className="h-3.5 w-3.5 text-green-600" />
                  </a>
                  <a
                    href={`tel:${contact.phone}`}
                    className="p-1 rounded hover:bg-blue-50 cursor-pointer"
                    title="Llamar"
                  >
                    <Phone className="h-3.5 w-3.5 text-blue-600" />
                  </a>
                  <button
                    onClick={() => handleCopy(contact.phone!, "phone")}
                    className="p-1 rounded hover:bg-muted cursor-pointer"
                    title="Copiar telefono"
                  >
                    {copiedField === "phone" ? (
                      <Check className="h-3.5 w-3.5 text-green-600" />
                    ) : (
                      <Copy className="h-3.5 w-3.5 text-muted-foreground" />
                    )}
                  </button>
                </div>
              </div>
            )}
            {contact.phone2 && (
              <div className="flex items-center gap-2 text-sm">
                <MessageCircle className="h-4 w-4 text-muted-foreground shrink-0" />
                <span className="flex-1">{contact.phone2} (Tel. 2 / WhatsApp)</span>
                <a
                  href={`https://wa.me/${cleanPhoneForWhatsApp(contact.phone2)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-1 rounded hover:bg-green-50 cursor-pointer"
                  title="Abrir WhatsApp"
                >
                  <MessageCircle className="h-3.5 w-3.5 text-green-600" />
                </a>
              </div>
            )}
            {(contact.address || contact.city || contact.neighborhood) && (
              <div className="flex items-start gap-2 text-sm">
                <MapPin className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                <span>
                  {[contact.address, contact.neighborhood, contact.city]
                    .filter(Boolean)
                    .join(", ")}
                </span>
              </div>
            )}
            {(contact.identificationNumber || contact.expeditionCity) && (
              <div className="flex items-center gap-2 text-sm">
                <IdCard className="h-4 w-4 text-muted-foreground shrink-0" />
                <span>
                  {contact.identificationNumber || "-"}
                  {contact.expeditionCity ? ` (exp. ${contact.expeditionCity})` : ""}
                </span>
              </div>
            )}
            {contact.companionName && (
              <div className="flex items-center gap-2 text-sm">
                <UserPlus className="h-4 w-4 text-muted-foreground shrink-0" />
                <span>Acompañante: {contact.companionName}</span>
              </div>
            )}
            {contact.motorcycleInterest && (
              <div className="flex items-center gap-2 text-sm">
                <Bike className="h-4 w-4 text-muted-foreground shrink-0" />
                <span>
                  {MOTORCYCLE_LABELS[contact.motorcycleInterest as MotorcycleInterest] ||
                    contact.motorcycleInterest}
                </span>
              </div>
            )}
            {contact.company && (
              <div className="flex items-center gap-2 text-sm">
                <Building2 className="h-4 w-4 text-muted-foreground" />
                <span>{contact.company}</span>
              </div>
            )}
            <div className="flex items-center gap-2 text-sm">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <span>Creado {formatDate(contact.createdAt)}</span>
            </div>
            {contact.notes && (
              <div className="pt-2 border-t">
                <p className="text-sm text-muted-foreground">{contact.notes}</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Deals */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Deals ({deals.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {deals.length === 0 ? (
              <p className="text-sm text-muted-foreground">Sin deals</p>
            ) : (
              <div className="space-y-3">
                {deals.map((deal) => (
                  <div
                    key={deal.id}
                    className="p-3 rounded-lg border cursor-pointer hover:bg-muted/50"
                    onClick={() => router.push(`/deals/${deal.id}`)}
                  >
                    <p className="text-sm font-medium">{deal.title}</p>
                    <div className="flex items-center justify-between mt-1">
                      <span className="text-sm font-semibold text-primary">
                        {formatCurrency(deal.value)}
                      </span>
                      <Badge
                        variant="outline"
                        style={{
                          borderColor: deal.stageColor || undefined,
                          color: deal.stageColor || undefined,
                        }}
                      >
                        {deal.stageName}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Activity timeline */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">
              Actividades ({activities.length})
            </CardTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowActivityForm(true)}
              className="cursor-pointer"
            >
              <Plus className="h-4 w-4 mr-1" />
              Registrar
            </Button>
          </CardHeader>
          <CardContent>
            {activities.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Sin actividades. Registra una llamada, email o nota.
              </p>
            ) : (
              <div className="space-y-4">
                {activities.map((activity) => {
                  const Icon = activityIcons[activity.type] || FileText;
                  const config = ACTIVITY_TYPE_CONFIG[activity.type as ActivityType];
                  const isPending = !activity.completedAt && activity.scheduledAt;
                  return (
                    <div key={activity.id} className="flex gap-3">
                      <div className="rounded-full bg-muted p-2 h-fit shrink-0">
                        <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <Badge variant="secondary" className="text-xs">
                            {config?.label || activity.type}
                          </Badge>
                          {isPending && (
                            <Badge
                              variant="outline"
                              className="text-xs text-orange-600 border-orange-600 cursor-pointer"
                              onClick={() => handleCompleteActivity(activity.id)}
                            >
                              Completar
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm mt-1">{activity.description}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {formatRelativeDate(activity.createdAt)}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <ContactForm
        open={showEditForm}
        advanceToStageId={advanceStageId}
        onClose={() => {
          setShowEditForm(false);
          setAdvanceStageId(null);
          router.refresh();
        }}
        initialData={{
          id: contact.id,
          name: contact.name,
          phone: contact.phone || "",
          phone2: contact.phone2 || "",
          address: contact.address || "",
          city: contact.city || "",
          neighborhood: contact.neighborhood || "",
          identificationNumber: contact.identificationNumber || "",
          expeditionCity: contact.expeditionCity || "",
          companionName: contact.companionName || "",
          motorcycleInterest: contact.motorcycleInterest || "boxer_ct100_ks",
          company: contact.company || "",
          source: contact.source,
          notes: contact.notes || "",
        }}
      />

      <ActivityForm
        open={showActivityForm}
        onClose={() => {
          setShowActivityForm(false);
          router.refresh();
        }}
        preselectedContactId={contact.id}
      />

      <ContactMethodDialog
        open={!!pendingStageId}
        onClose={() => setPendingStageId(null)}
        onSelect={(method) => {
          const target = pendingStageId;
          setPendingStageId(null);
          if (target) applyStageChange(target, method);
        }}
      />

      <ScheduleVisitDialog
        open={showScheduleVisit}
        onClose={() => setShowScheduleVisit(false)}
        contactId={contact.id}
        contactNeighborhood={contact.neighborhood}
        onScheduled={() => {
          const visitaStage = stages.find((s) => s.name.toLowerCase() === "visita");
          if (visitaStage) setStageId(visitaStage.id);
          router.refresh();
        }}
      />
    </div>
  );
}
