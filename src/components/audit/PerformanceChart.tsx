"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AUDIT_ACTION_CONFIG, AUDIT_CHART_ACTIONS } from "@/lib/constants";
import type { PerformanceRow } from "@/types";

interface PerformanceChartProps {
  data: PerformanceRow[];
  /** Texto del periodo consultado, para el subtitulo. */
  periodo: string;
}

/**
 * Desempeno por colaborador: una barra por persona, partida en colores segun
 * el tipo de movimiento. Entrar y salir del CRM no cuenta aqui.
 */
export function PerformanceChart({ data, periodo }: PerformanceChartProps) {
  // Solo se dibujan las acciones que de verdad ocurrieron en el periodo, para
  // no llenar la leyenda de tipos en cero.
  const acciones = AUDIT_CHART_ACTIONS.filter((a) =>
    data.some((row) => (row.porAccion[a] || 0) > 0)
  );

  const chartData = data.map((row) => {
    const entry: Record<string, string | number> = {
      name: row.userName,
      total: row.total,
    };
    for (const a of acciones) entry[a] = row.porAccion[a] || 0;
    return entry;
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Desempeno del equipo</CardTitle>
        <p className="text-sm text-muted-foreground">
          Movimientos registrados por cada colaborador · {periodo}
        </p>
      </CardHeader>
      <CardContent>
        {chartData.length === 0 ? (
          <p className="py-12 text-center text-sm text-muted-foreground">
            Todavia no hay movimientos en este periodo.
          </p>
        ) : (
          <ResponsiveContainer width="100%" height={320}>
            <BarChart
              data={chartData}
              margin={{ top: 5, right: 20, bottom: 5, left: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis
                dataKey="name"
                tick={{ fontSize: 12 }}
                className="fill-muted-foreground"
              />
              <YAxis
                allowDecimals={false}
                tick={{ fontSize: 12 }}
                className="fill-muted-foreground"
              />
              <Tooltip
                cursor={{ fill: "var(--muted)", opacity: 0.4 }}
                contentStyle={{
                  borderRadius: 8,
                  border: "1px solid var(--border)",
                  background: "var(--card)",
                  fontSize: 12,
                }}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              {acciones.map((a) => (
                <Bar
                  key={a}
                  dataKey={a}
                  name={AUDIT_ACTION_CONFIG[a]?.label || a}
                  stackId="acciones"
                  fill={AUDIT_ACTION_CONFIG[a]?.chart || "#94a3b8"}
                  radius={a === acciones[acciones.length - 1] ? [4, 4, 0, 0] : 0}
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
