'use client';
import { ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { DashboardProduct } from '@/hooks/use-dashboard';

export default function CostScatterChart({ products }: { products: DashboardProduct[] }) {
  const data = products.map((p) => ({ cost: p.costPrice, price: p.salePrice, name: p.name }));

  return (
    <Card>
      <CardHeader><CardTitle className="text-sm">Custo × Preço de Venda</CardTitle></CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={200}>
          <ScatterChart>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="cost" name="Custo" tickFormatter={(v) => `R$${v}`} tick={{ fontSize: 11 }} />
            <YAxis dataKey="price" name="Preço" tickFormatter={(v) => `R$${v}`} tick={{ fontSize: 11 }} />
            <Tooltip cursor={{ strokeDasharray: '3 3' }} formatter={(v: number) => `R$ ${v.toFixed(2)}`} />
            <Scatter data={data} fill="#2563eb" />
          </ScatterChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
