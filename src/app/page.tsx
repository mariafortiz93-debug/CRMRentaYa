import { Suspense } from "react";
import { db } from "@/db";
import { contacts, activities, pipelineStages } from "@/db/schema";
import { eq, asc, desc } from "drizzle-orm";
import { KPICards } from "@/components/dashboard/KPICards";
import { PipelineChart } from "@/components/dashboard/PipelineChart";
import { RecentActivity } from "@/components/dashboard/RecentActivity";
import { NotificationBanner } from "@/components/dashboard/NotificationBanner";
import { LeadSourceBreakdown } from "@/components/dashboard/LeadSourceBreakdown";
import { VisitResultsCard } from "@/components/dashboard/VisitResultsCard";
import { ClassificationBreakdown } from "@/components/dashboard/ClassificationBreakdown";
import { ConversionFunnel } from "@/components/dashboard/ConversionFunnel";
import { ContactSearch } from "@/components/dashboard/ContactSearch";
import { DateRangeFilter } from "@/components/shared/DateRangeFilter";
import { resolveDateRange, inRange } from "@/lib/dateRange";
import { CLASSIFICATION_ORDER } from "@/lib/constants";
import type { DashboardStats } from "@/types";

export const dynamic = "force-dynamic";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const params = await searchParams;
  const range = resolveDateRange(params);

  const everyContact = db.select().from(contacts).all();
  const allContacts = everyContact.filter((c) => inRange(c.createdAt, range));

  const stages = db
    .select()
    .from(pipelineStages)
    .orderBy(asc(pipelineStages.order))
    .all();

  const stats: DashboardStats = {
    totalContacts: allContacts.length,
    activeDeals: allContacts.filter((c) => {
      const stage = stages.find((s) => s.id === c.stageId);
      return stage && !stage.isWon && !stage.isLost;
    }).length,
    entregadas: allContacts.filter((c) => {
      const stage = stages.find((s) => s.id === c.stageId);
      return stage?.isWon;
    }).length,
  };

  const pipelineData = stages
    .filter((s) => !s.isLost)
    .map((stage) => ({
      name: stage.name,
      count: allContacts.filter((c) => c.stageId === stage.id).length,
      color: stage.color,
    }));

  const sourceBreakdown = Object.entries(
    allContacts.reduce<Record<string, number>>((acc, c) => {
      acc[c.source] = (acc[c.source] || 0) + 1;
      return acc;
    }, {})
  ).map(([source, count]) => ({ source, count }));

  const visitResultCounts = {
    aprobado: allContacts.filter((c) => c.visitResult === "aprobado").length,
    sin_proceso: allContacts.filter((c) => c.visitResult === "sin_proceso").length,
    negado: allContacts.filter((c) => c.visitResult === "negado").length,
  };

  // Conteo y detalles (marcas, ciudades, modelos) de las clasificaciones.
  const classificationCounts: Record<string, number> = {};
  const classificationDetails: Record<string, string[]> = {};
  for (const key of CLASSIFICATION_ORDER) classificationCounts[key] = 0;
  for (const c of allContacts) {
    if (!c.classification) continue;
    classificationCounts[c.classification] =
      (classificationCounts[c.classification] || 0) + 1;
    if (c.classificationDetail) {
      const list = (classificationDetails[c.classification] ||= []);
      if (!list.includes(c.classificationDetail)) list.push(c.classificationDetail);
    }
  }

  // ---- Embudo de conversion ----
  const pct = (part: number, whole: number) =>
    whole > 0 ? Math.round((part / whole) * 100) : 0;

  const stageOrderById = new Map(stages.map((s) => [s.id, s.order]));
  const tramiteOrder =
    stages.find((s) => s.name.toLowerCase() === "inicio de tramite")?.order ?? Infinity;

  const contactadoOrder =
    stages.find((s) => s.name.toLowerCase() === "contactado")?.order ?? Infinity;

  const totalLeads = allContacts.length;
  // Contactado = se registro el medio, o ya avanzo mas alla de Prospecto, o
  // ya tiene resultado de visita. Asi el embudo nunca supera el 100%.
  const contactados = allContacts.filter(
    (c) =>
      c.contactMethod ||
      c.visitResult ||
      (stageOrderById.get(c.stageId || "") ?? -1) >= contactadoOrder
  ).length;
  const conVisita = allContacts.filter((c) => c.visitResult).length;
  const aprobados = allContacts.filter((c) => c.visitResult === "aprobado").length;
  const iniciaronTramite = allContacts.filter(
    (c) => (stageOrderById.get(c.stageId || "") ?? -1) >= tramiteOrder
  ).length;
  const entregadas = allContacts.filter((c) => {
    const stage = stages.find((s) => s.id === c.stageId);
    return stage?.isWon;
  }).length;
  const perdidos = allContacts.filter((c) => {
    const stage = stages.find((s) => s.id === c.stageId);
    return stage?.isLost;
  }).length;
  const indecisos = allContacts.filter((c) => c.classification === "indeciso").length;

  const funnelSteps = [
    {
      label: "Leads captados",
      count: totalLeads,
      pctOfTotal: 100,
      pctOfPrev: null,
      color: "#64748b",
    },
    {
      label: "Contactados (llamada o WhatsApp)",
      count: contactados,
      pctOfTotal: pct(contactados, totalLeads),
      pctOfPrev: pct(contactados, totalLeads),
      prevLabel: "leads",
      color: "#3b82f6",
    },
    {
      label: "Con visita realizada",
      count: conVisita,
      pctOfTotal: pct(conVisita, totalLeads),
      pctOfPrev: pct(conVisita, contactados),
      prevLabel: "contactados",
      color: "#d946ef",
    },
    {
      label: "Aprobados",
      count: aprobados,
      pctOfTotal: pct(aprobados, totalLeads),
      pctOfPrev: pct(aprobados, conVisita),
      prevLabel: "visitados",
      color: "#f59e0b",
    },
    {
      label: "Iniciaron tramite",
      count: iniciaronTramite,
      pctOfTotal: pct(iniciaronTramite, totalLeads),
      pctOfPrev: pct(iniciaronTramite, aprobados),
      prevLabel: "aprobados",
      color: "#ea580c",
    },
    {
      label: "Moto entregada (venta)",
      count: entregadas,
      pctOfTotal: pct(entregadas, totalLeads),
      pctOfPrev: pct(entregadas, iniciaronTramite),
      prevLabel: "en tramite",
      color: "#16a34a",
    },
  ];

  // Conversion por fuente de captacion.
  const sourceStats = new Map<string, { leads: number; entregadas: number }>();
  for (const c of allContacts) {
    const entry = sourceStats.get(c.source) || { leads: 0, entregadas: 0 };
    entry.leads++;
    const stage = stages.find((s) => s.id === c.stageId);
    if (stage?.isWon) entry.entregadas++;
    sourceStats.set(c.source, entry);
  }
  const bySource = [...sourceStats.entries()]
    .map(([source, v]) => ({
      source,
      leads: v.leads,
      entregadas: v.entregadas,
      rate: pct(v.entregadas, v.leads),
    }))
    .sort((a, b) => b.leads - a.leads);

  const dealershipAnnounced = allContacts.filter((c) => c.dealershipAnnouncedAt).length;
  const dealershipVisited = allContacts.filter((c) => c.dealershipVisitedAt).length;

  // Aprobados que aun no han iniciado tramite (pendientes de contactar)
  const aprobadosPorContactar = allContacts
    .filter((c) => c.visitResult === "aprobado" && !c.approvedContactedAt)
    .map((c) => ({
      id: c.id,
      name: c.name,
      phone: c.phone,
      approvedAt: c.visitResultDate ? c.visitResultDate.getTime() : null,
    }));

  const recentActivities = db
    .select({
      id: activities.id,
      type: activities.type,
      description: activities.description,
      contactName: contacts.name,
      createdAt: activities.createdAt,
    })
    .from(activities)
    .leftJoin(contacts, eq(activities.contactId, contacts.id))
    .orderBy(desc(activities.createdAt))
    .limit(5)
    .all();

  const isFirstRun = everyContact.length === 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground">
            Resumen de tu pipeline de ventas
          </p>
        </div>
        <Suspense fallback={null}>
          <DateRangeFilter
            from={range.fromParam}
            to={range.toParam}
            hint="Leads creados"
          />
        </Suspense>
      </div>

      {isFirstRun && (
        <div className="rounded-lg border border-primary/20 bg-primary/5 p-6">
          <h2 className="text-lg font-semibold mb-2">
            Bienvenido a Auto-CRM
          </h2>
          <p className="text-sm text-muted-foreground mb-4">
            Tu CRM esta listo. Aqui tienes como comenzar:
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
            <div className="p-3 rounded-lg bg-card border">
              <p className="font-medium">1. Personaliza tu CRM</p>
              <p className="text-xs text-muted-foreground mt-1">
                Ejecuta <code className="bg-muted px-1 rounded">/setup</code> en Claude Code
              </p>
            </div>
            <div className="p-3 rounded-lg bg-card border">
              <p className="font-medium">2. Agrega contactos</p>
              <p className="text-xs text-muted-foreground mt-1">
                Ve a Contactos o usa <code className="bg-muted px-1 rounded">/add-lead</code>
              </p>
            </div>
            <div className="p-3 rounded-lg bg-card border">
              <p className="font-medium">3. Carga datos demo</p>
              <p className="text-xs text-muted-foreground mt-1">
                Ejecuta <code className="bg-muted px-1 rounded">npm run seed</code> en terminal
              </p>
            </div>
          </div>
        </div>
      )}

      <NotificationBanner />

      <ContactSearch
        stages={stages.map((s) => ({ id: s.id, name: s.name, color: s.color }))}
      />

      <KPICards stats={stats} />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <PipelineChart data={pipelineData} />
        </div>
        <div className="space-y-6">
          <RecentActivity
            activities={
              recentActivities as Array<{
                id: string;
                type: string;
                description: string;
                contactName: string | null;
                createdAt: number | Date;
              }>
            }
          />
          <LeadSourceBreakdown data={sourceBreakdown} />
        </div>
      </div>

      <ConversionFunnel
        totalLeads={totalLeads}
        steps={funnelSteps}
        overallRate={pct(entregadas, totalLeads)}
        bySource={bySource}
        lostPct={pct(perdidos, totalLeads)}
        indecisoPct={pct(indecisos, totalLeads)}
        dealership={{
          announced: dealershipAnnounced,
          visited: dealershipVisited,
          rate: pct(dealershipVisited, dealershipAnnounced),
        }}
      />

      <ClassificationBreakdown
        counts={classificationCounts}
        details={classificationDetails}
      />

      <VisitResultsCard counts={visitResultCounts} aprobados={aprobadosPorContactar} />
    </div>
  );
}
