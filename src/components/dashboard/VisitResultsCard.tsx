import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { VISIT_RESULT_CONFIG, cleanPhoneForWhatsApp } from "@/lib/constants";
import { Phone, MessageCircle, AlertTriangle } from "lucide-react";

interface VisitResultsCardProps {
  counts: { aprobado: number; sin_proceso: number; negado: number };
  aprobados: Array<{
    id: string;
    name: string;
    phone: string | null;
    approvedAt: number | null;
  }>;
}

const MAX_DAYS_TO_CONTACT = 3;

function daysSince(ms: number | null): number | null {
  if (!ms) return null;
  return Math.floor((Date.now() - ms) / 86400000);
}

export function VisitResultsCard({ counts, aprobados }: VisitResultsCardProps) {
  const items = [
    { key: "aprobado" as const, count: counts.aprobado },
    { key: "sin_proceso" as const, count: counts.sin_proceso },
    { key: "negado" as const, count: counts.negado },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Resultado de Visitas</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-3 gap-3">
          {items.map(({ key, count }) => {
            const cfg = VISIT_RESULT_CONFIG[key];
            return (
              <div
                key={key}
                className="rounded-lg p-3 text-center"
                style={{ backgroundColor: cfg.bgColor }}
              >
                <div className="text-2xl font-bold" style={{ color: cfg.color }}>
                  {count}
                </div>
                <div className="text-xs" style={{ color: cfg.color }}>
                  {cfg.label}
                </div>
              </div>
            );
          })}
        </div>

        <div>
          <p className="text-sm font-medium mb-2">
            Aprobados por contactar ({aprobados.length})
          </p>
          {aprobados.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No hay clientes aprobados pendientes de contactar.
            </p>
          ) : (
            <div className="space-y-2">
              {aprobados.map((c) => {
                const days = daysSince(c.approvedAt);
                const overdue = days !== null && days >= MAX_DAYS_TO_CONTACT;
                return (
                <div
                  key={c.id}
                  className={`flex items-center justify-between gap-2 rounded-lg border p-2 ${
                    overdue ? "border-red-300 bg-red-50" : ""
                  }`}
                >
                  <div className="min-w-0">
                    <Link
                      href={`/contacts/${c.id}`}
                      className="text-sm font-medium hover:underline truncate block"
                    >
                      {c.name}
                    </Link>
                    {days !== null && (
                      <span
                        className={`text-xs flex items-center gap-1 ${
                          overdue ? "text-red-600 font-medium" : "text-muted-foreground"
                        }`}
                      >
                        {overdue && <AlertTriangle className="h-3 w-3" />}
                        {days === 0
                          ? "Aprobado hoy"
                          : `Aprobado hace ${days} dia${days === 1 ? "" : "s"}`}
                        {overdue ? " · contactar ya" : ""}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-xs text-muted-foreground">{c.phone || "-"}</span>
                    {c.phone && (
                      <>
                        <a
                          href={`https://wa.me/${cleanPhoneForWhatsApp(c.phone)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-1 rounded hover:bg-green-50"
                          title="WhatsApp"
                        >
                          <MessageCircle className="h-3.5 w-3.5 text-green-600" />
                        </a>
                        <a
                          href={`tel:${c.phone}`}
                          className="p-1 rounded hover:bg-blue-50"
                          title="Llamar"
                        >
                          <Phone className="h-3.5 w-3.5 text-blue-600" />
                        </a>
                      </>
                    )}
                  </div>
                </div>
                );
              })}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
