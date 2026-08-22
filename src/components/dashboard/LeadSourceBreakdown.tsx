import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SOURCE_LABELS } from "@/lib/constants";
import type { LeadSource } from "@/types";

interface LeadSourceBreakdownProps {
  data: Array<{ source: string; count: number }>;
}

export function LeadSourceBreakdown({ data }: LeadSourceBreakdownProps) {
  const total = data.reduce((sum, d) => sum + d.count, 0);
  const sorted = [...data].sort((a, b) => b.count - a.count);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Leads por Fuente</CardTitle>
      </CardHeader>
      <CardContent>
        {total === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">
            Aun no hay contactos
          </p>
        ) : (
          <div className="space-y-3">
            {sorted.map((item) => {
              const pct = total > 0 ? Math.round((item.count / total) * 100) : 0;
              return (
                <div key={item.source} className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <span>{SOURCE_LABELS[item.source as LeadSource] || item.source}</span>
                    <span className="text-muted-foreground">
                      {item.count} &middot; {pct}%
                    </span>
                  </div>
                  <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full bg-primary"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
