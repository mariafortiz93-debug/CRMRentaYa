import { Suspense } from "react";
import { Lock } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { DateRangeFilter } from "@/components/shared/DateRangeFilter";
import { PerformanceChart } from "@/components/audit/PerformanceChart";
import { AuditFilters } from "@/components/audit/AuditFilters";
import { AuditTable } from "@/components/audit/AuditTable";
import { fetchAuditReport } from "@/lib/audit-query";
import { getSessionUser } from "@/lib/session";
import { hasPermission } from "@/lib/permissions";
import { AUDIT_ACTION_CONFIG } from "@/lib/constants";
import type { AuditLog } from "@/types";

export const dynamic = "force-dynamic";

/** "del 1 ago al 25 ago" o "todo el historial" si no hay filtro de fechas. */
function describirPeriodo(from?: string, to?: string): string {
  const fmt = (v: string) =>
    new Intl.DateTimeFormat("es-CO", { day: "numeric", month: "short" }).format(
      new Date(`${v}T12:00:00`)
    );

  if (from && to) return `del ${fmt(from)} al ${fmt(to)}`;
  if (from) return `desde el ${fmt(from)}`;
  if (to) return `hasta el ${fmt(to)}`;
  return "todo el historial";
}

export default async function RegistrosPage({
  searchParams,
}: {
  searchParams: Promise<{
    from?: string;
    to?: string;
    userId?: string;
    action?: string;
  }>;
}) {
  const params = await searchParams;

  // Esta pantalla muestra lo que hace cada persona, asi que se protege tambien
  // en el servidor y no solo escondiendo la entrada del menu.
  const user = await getSessionUser();
  if (!hasPermission(user, "registros")) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center p-6">
        <div className="max-w-sm space-y-3 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-muted">
            <Lock className="h-6 w-6 text-muted-foreground" />
          </div>
          <h2 className="text-lg font-semibold">Seccion no habilitada</h2>
          <p className="text-sm text-muted-foreground">
            Tu usuario no tiene permiso para ver los registros del equipo.
          </p>
        </div>
      </div>
    );
  }

  const report = fetchAuditReport(params);

  // Las fechas se pasan como texto para que los componentes del navegador las
  // reciban ya listas para mostrar.
  const logs: AuditLog[] = report.logs.map((log) => ({
    ...log,
    createdAt: log.createdAt.toISOString(),
  }));

  const periodo = describirPeriodo(params.from, params.to);
  const totalMovimientos = report.desempeno.reduce((sum, r) => sum + r.total, 0);
  const lider = report.desempeno[0];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Registros</h1>
          <p className="text-sm text-muted-foreground">
            Cada movimiento del CRM queda aqui con el nombre de quien lo hizo.
          </p>
        </div>
        <Suspense fallback={null}>
          <DateRangeFilter
            from={params.from || ""}
            to={params.to || ""}
            hint="movimientos"
          />
        </Suspense>
      </div>

      <PerformanceChart data={report.desempeno} periodo={periodo} />

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Movimientos</p>
            <p className="text-2xl font-semibold">{totalMovimientos}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Colaboradores activos</p>
            <p className="text-2xl font-semibold">{report.desempeno.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Quien mas movio</p>
            <p className="text-2xl font-semibold truncate">
              {lider ? lider.userName : "—"}
            </p>
            {lider && (
              <p className="text-xs text-muted-foreground">
                {lider.total} movimiento{lider.total === 1 ? "" : "s"}
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="space-y-4 pt-6">
          <Suspense fallback={null}>
            <AuditFilters
              colaboradores={report.colaboradores}
              userId={params.userId || ""}
              action={params.action || ""}
            />
          </Suspense>

          <p className="text-xs text-muted-foreground">
            {report.total === 0
              ? "Sin movimientos"
              : report.total > report.limite
                ? `Mostrando los ${report.limite} mas recientes de ${report.total}. Acota el periodo para ver los demas.`
                : `${report.total} movimiento${report.total === 1 ? "" : "s"}`}
            {params.action &&
              ` · filtrado por "${
                AUDIT_ACTION_CONFIG[params.action]?.label || params.action
              }"`}
          </p>

          <AuditTable logs={logs} />
        </CardContent>
      </Card>
    </div>
  );
}
