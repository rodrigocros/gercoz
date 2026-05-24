'use client';
import { useUpdateOrderStatus } from '@/hooks/use-orders';
import type { Order } from '@/hooks/use-orders';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const statusConfig: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive'; className?: string }> = {
  PENDING: { label: 'Pendente', variant: 'secondary' },
  PREPARING: { label: 'Preparando', variant: 'default', className: 'bg-yellow-500' },
  READY: { label: 'Pronto', variant: 'default', className: 'bg-green-500' },
  DELIVERED: { label: 'Entregue', variant: 'default', className: 'bg-blue-500' },
  CANCELLED: { label: 'Cancelado', variant: 'destructive' },
};

interface Props {
  order: Order;
}

export default function OrderCard({ order }: Props) {
  const updateStatus = useUpdateOrderStatus();
  const cfg = statusConfig[order.status] ?? { label: order.status, variant: 'secondary' as const };

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex justify-between items-center">
          <span className="font-bold">#{order.orderNumber}</span>
          <Badge variant={cfg.variant} className={cfg.className}>
            {cfg.label}
          </Badge>
        </div>
        <div className="flex justify-between text-xs text-gray-500">
          <span>
            {order.type === 'MESA' ? `Mesa ${order.tableNumber}` : 'Balcão'}
          </span>
          <span>
            {formatDistanceToNow(new Date(order.createdAt), {
              addSuffix: true,
              locale: ptBR,
            })}
          </span>
        </div>
      </CardHeader>
      <CardContent>
        <ul className="text-sm space-y-1 mb-3">
          {order.items.map((item, idx) => (
            <li key={idx} className="flex justify-between">
              <span>
                {item.quantity}× {item.name}
              </span>
              <span className="text-gray-500">
                R$ {(item.unitPrice * item.quantity).toFixed(2)}
              </span>
            </li>
          ))}
        </ul>
        <div className="flex justify-between font-semibold text-sm border-t pt-2">
          <span>Total</span>
          <span>R$ {order.total.toFixed(2)}</span>
        </div>
        {order.status === 'READY' && (
          <Button
            size="sm"
            className="w-full mt-3 bg-blue-600 hover:bg-blue-700"
            onClick={() => updateStatus.mutate({ id: order.id, status: 'DELIVERED' })}
            disabled={updateStatus.isPending}
          >
            Marcar Entregue
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
