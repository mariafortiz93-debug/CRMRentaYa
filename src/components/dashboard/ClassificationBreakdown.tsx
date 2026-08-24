import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CLASSIFICATION_CONFIG, CLASSIFICATION_ORDER } from "@/lib/constants";

interface ClassificationBreakdownProps {
  counts: Record<string, number>;
  /** Detalles agrupados, ej. marcas mencionadas o ciudades. */
  details?: Record<string, string[]>;
}

export function ClassificationBreakdown({ counts, details }: ClassificationBreakdownProps) {
  const total = CLASSIFICATION_ORDER.reduce((sum, k) => sum + (counts[k] || 0), 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Clasificacion de Contactados</CardTitle>
      </CardHeader>
      <CardContent>
        {total === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">
            Aun no hay clientes clasificados.
          </p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {CLASSIFICATION_ORDER.map((key) => {
              const cfg = CLASSIFICATION_CONFIG[key];
              const count = counts[key] || 0;
              const detailList = details?.[key] || [];
              return (
                <div
                  key={key}
                  className="rounded-lg p-3"
                  style={{ backgroundColor: cfg.bgColor }}
                >
                  <div className="text-2xl font-bold" style={{ color: cfg.color }}>
                    {count}
                  </div>
                  <div className="text-xs font-medium" style={{ color: cfg.color }}>
                    {cfg.label}
                  </div>
                  {detailList.length > 0 && (
                    <div
                      className="text-[10px] mt-1 opacity-80 break-words"
                      style={{ color: cfg.color }}
                    >
                      {detailList.slice(0, 4).join(", ")}
                      {detailList.length > 4 ? "…" : ""}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
