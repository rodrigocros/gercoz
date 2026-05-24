'use client';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { format } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface PricePoint {
  price: number;
  changedAt: string;
}

interface Props {
  history: PricePoint[];
  ingredientName: string;
}

export default function PriceHistoryChart({ history, ingredientName }: Props) {
  const data = history.map((h) => ({
    price: h.price,
    date: format(new Date(h.changedAt), 'dd/MM/yy'),
  }));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">Histórico de Preço — {ingredientName}</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={200}>
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" tick={{ fontSize: 11 }} />
            <YAxis
              tickFormatter={(v) => `R$${v.toFixed(2)}`}
              tick={{ fontSize: 11 }}
              width={60}
            />
            <Tooltip formatter={(v: number) => [`R$ ${v.toFixed(2)}`, 'Preço']} />
            <Line
              type="monotone"
              dataKey="price"
              stroke="#2563eb"
              strokeWidth={2}
              dot={{ r: 3 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
