'use client';
import { useUpdateOrderStatus } from '@/hooks/use-orders';
import type { Order } from '@/hooks/use-orders';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface Props {
  order: Order;
}

export default function KdsCard({ order }: Props) {
  const updateStatus = useUpdateOrderStatus();

  const elapsed = formatDistanceToNow(new Date(order.createdAt), {
    addSuffix: false,
    locale: ptBR,
  });

  const statusColors: Record<string, string> = {
    PENDING: 'border-yellow-400 bg-yellow-50',
    PREPARING: 'border-blue-400 bg-blue-50',
  };

  return (
    <Card className={`border-2 ${statusColors[order.status] ?? ''}`}>
      <CardHeader className="pb-2">
        <div className="flex justify-between items-center">
          <span className="text-xl font-bold">#{order.orderNumber}</span>
          <Badge
            variant={order.status === 'PENDING' ? 'secondary' : 'default'}
            className={order.status === 'PREPARING' ? 'bg-blue-500' : ''}
          >
            {order.status === 'PENDING' ? 'Pendente' : 'Preparando'}
          </Badge>
        </div>
        <div className="flex justify-between text-sm text-gray-600">
          <span>{order.type === 'MESA' ? `Mesa ${order.tableNumber}` : 'Balcão'}</span>
          <span className="text-orange-500 font-medium">{elapsed}</span>
        </div>
      </CardHeader>
      <CardContent>
        <ul className="space-y-2 mb-4">
          {order.items.map((item, idx) => (
            <li key={idx} className="text-sm">
              <span className="font-semibold">
                {item.quantity}× {item.name}
              </span>
              {item.notes && (
                <p className="text-xs text-gray-500 italic ml-4">{item.notes}</p>
              )}
            </li>
          ))}
        </ul>

        {order.status === 'PENDING' && (
          <Button
            className="w-full bg-yellow-500 hover:bg-yellow-600 text-white"
            onClick={() => updateStatus.mutate({ id: order.id, status: 'PREPARING' })}
            disabled={updateStatus.isPending}
          >
            Iniciar Preparo
          </Button>
        )}

        {order.status === 'PREPARING' && (
          <Button
            className="w-full bg-green-600 hover:bg-green-700 text-white"
            onClick={() => updateStatus.mutate({ id: order.id, status: 'READY' })}
            disabled={updateStatus.isPending}
          >
            Marcar Pronto
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
