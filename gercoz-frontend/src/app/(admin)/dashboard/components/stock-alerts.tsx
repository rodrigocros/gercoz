'use client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { StockAlert } from '@/hooks/use-dashboard';

export default function StockAlerts({ alerts }: { alerts: StockAlert[] }) {
  if (alerts.length === 0) return null;

  return (
    <Card className="border-red-200">
      <CardHeader>
        <CardTitle className="text-sm text-red-700">
          Alertas de Estoque ({alerts.length})
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="space-y-2">
          {alerts.map((a) => (
            <li key={a.id} className="flex justify-between items-center text-sm">
              <span>{a.name}</span>
              <Badge variant="destructive">
                {a.stock} / {a.minStock} {a.unit}
              </Badge>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
