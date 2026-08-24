import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SOURCE_LABELS } from "@/lib/constants";
import type { LeadSource } from "@/types";

export interface FunnelStep {
  label: string;
  count: number;
  /** Porcentaje sobre el total de leads. */
  pctOfTotal: number;
  /** Porcentaje sobre el paso anterior. */
  pctOfPrev: number | null;
  prevLabel?: string;
  color: string;
}

export interface SourceConversion {
  source: string;
  leads: number;
  entregadas: number;
  rate: number;
}

interface ConversionFunnelProps {
  totalLeads: number;
  steps: FunnelStep[];
  overallRate: number;
  bySource: SourceConversion[];
  lostPct: number;
  indecisoPct: number;
  dealership: { announced: number; visited: number; rate: number };
}

export function ConversionFunnel({
  totalLeads,
  steps,
  overallRate,
  bySource,
  lostPct,
  indecisoPct,
  dealership,
}: ConversionFunnelProps) {
  const best = bySource.reduce<SourceConversion | null>(
    (acc, s) => (s.leads > 0 && (!acc || s.rate > acc.rate) ? s : acc),
    null
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Tasa de Conversion</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {totalLeads === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">
            Aun no hay leads en este periodo.
          </p>
        ) : (
          <>
            {/* Titulares */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="rounded-lg p-3 bg-green-50">
                <div className="text-2xl font-bold text-green-700">
                  {overallRate}%
                </div>
                <div className="text-xs text-green-700">
                  Conversion general (motos entregadas / leads)
                </div>
              </div>
              <div className="rounded-lg p-3 bg-red-50">
                <div className="text-2xl font-bold text-red-700">{lostPct}%</div>
                <div className="text-xs text-red-700">Clientes perdidos</div>
              </div>
              <div className="rounded-lg p-3 bg-yellow-50">
                <div className="text-2xl font-bold text-yellow-700">
                  {indecisoPct}%
                </div>
                <div className="text-xs text-yellow-700">Indecisos</div>
              </div>
              <div className="rounded-lg p-3 bg-cyan-50">
                <div className="text-2xl font-bold text-cyan-700">
                  {dealership.rate}%
                </div>
                <div className="text-xs text-cyan-700">
                  Asistieron al concesionario ({dealership.visited} de{" "}
                  {dealership.announced})
                </div>
              </div>
            </div>

            {/* Embudo paso a paso */}
            <div className="space-y-2">
              <p className="text-sm font-medium">Embudo</p>
              {steps.map((step) => (
                <div key={step.label} className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <span>{step.label}</span>
                    <span className="text-muted-foreground">
                      <strong className="text-foreground">{step.count}</strong> ·{" "}
                      {step.pctOfTotal}% del total
                      {step.pctOfPrev !== null && step.prevLabel
                        ? ` · ${step.pctOfPrev}% de ${step.prevLabel}`
                        : ""}
                    </span>
                  </div>
                  <div className="h-2.5 w-full bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${step.pctOfTotal}%`,
                        backgroundColor: step.color,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>

            {/* Conversion por fuente de captacion */}
            <div className="space-y-2">
              <div className="flex items-baseline justify-between">
                <p className="text-sm font-medium">Conversion por fuente</p>
                {best && best.entregadas > 0 && (
                  <p className="text-xs text-green-700">
                    Mejor fuente: {SOURCE_LABELS[best.source as LeadSource] || best.source}{" "}
                    ({best.rate}%)
                  </p>
                )}
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs text-muted-foreground">
                      <th className="py-1">Fuente</th>
                      <th className="py-1 text-right">Leads</th>
                      <th className="py-1 text-right">Entregadas</th>
                      <th className="py-1 text-right">Conversion</th>
                    </tr>
                  </thead>
                  <tbody>
                    {bySource.map((s) => (
                      <tr key={s.source} className="border-t">
                        <td className="py-1.5">
                          {SOURCE_LABELS[s.source as LeadSource] || s.source}
                        </td>
                        <td className="py-1.5 text-right">{s.leads}</td>
                        <td className="py-1.5 text-right">{s.entregadas}</td>
                        <td className="py-1.5 text-right font-medium">{s.rate}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
