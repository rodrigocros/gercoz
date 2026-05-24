'use client';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { DashboardProduct } from '@/hooks/use-dashboard';

export default function RoiBarChart({ products }: { products: DashboardProduct[] }) {
  const top10 = [...products]
    .sort((a, b) => b.roi - a.roi)
    .slice(0, 10)
    .map((p) => ({
      name: p.name.length > 14 ? p.name.slice(0, 14) + '…' : p.name,
      roi: Number(p.roi.toFixed(1)),
    }));

  return (
    <Card>
      <CardHeader><CardTitle className="text-sm">Top 10 ROI</CardTitle></CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={top10} layout="vertical" margin={{ left: 8 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis type="number" tickFormatter={(v) => `${v}%`} tick={{ fontSize: 11 }} />
            <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={90} />
            <Tooltip formatter={(v: number) => [`${v}%`, 'ROI']} />
            <Bar dataKey="roi" fill="#2563eb" radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
