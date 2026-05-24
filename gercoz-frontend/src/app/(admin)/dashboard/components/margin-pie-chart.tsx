'use client';
import { PieChart, Pie, Cell, Legend, Tooltip, ResponsiveContainer } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { DashboardProduct } from '@/hooks/use-dashboard';

const COLORS = { ALTO: '#16a34a', MEDIO: '#ca8a04', BAIXO: '#dc2626' };

export default function MarginPieChart({ products }: { products: DashboardProduct[] }) {
  const counts = products.reduce(
    (acc, p) => { acc[p.classification] = (acc[p.classification] ?? 0) + 1; return acc; },
    {} as Record<string, number>,
  );
  const data = Object.entries(counts).map(([name, value]) => ({ name, value }));

  return (
    <Card>
      <CardHeader><CardTitle className="text-sm">Distribuição por Margem</CardTitle></CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={200}>
          <PieChart>
            <Pie data={data} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
              {data.map((entry) => (
                <Cell key={entry.name} fill={COLORS[entry.name as keyof typeof COLORS] ?? '#888'} />
              ))}
            </Pie>
            <Tooltip />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
