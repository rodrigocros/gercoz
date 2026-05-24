'use client';
import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useSocket } from '@/contexts/socket-context';
import { useOrders } from '@/hooks/use-orders';
import type { Order } from '@/hooks/use-orders';
import OrderCard from './components/order-card';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

const STATUS_GROUPS = [
  { value: 'active', label: 'Ativos', statuses: ['PENDING', 'PREPARING', 'READY'] },
  { value: 'delivered', label: 'Entregues', statuses: ['DELIVERED'] },
  { value: 'all', label: 'Todos', statuses: [] as string[] },
];

export default function OrdersListPage() {
  const { data: orders = [] } = useOrders();
  const socket = useSocket();
  const qc = useQueryClient();
  const [activeGroup, setActiveGroup] = useState('active');

  useEffect(() => {
    if (!socket) return;
    const refresh = () => qc.invalidateQueries({ queryKey: ['orders'] });
    socket.on('order:status_changed', refresh);
    socket.on('order:created', refresh);
    return () => {
      socket.off('order:status_changed', refresh);
      socket.off('order:created', refresh);
    };
  }, [socket, qc]);

  const group = STATUS_GROUPS.find((g) => g.value === activeGroup)!;
  const filtered =
    group.statuses.length > 0
      ? orders.filter((o: Order) => group.statuses.includes(o.status))
      : orders;

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Pedidos</h1>

      <Tabs value={activeGroup} onValueChange={setActiveGroup} className="mb-4">
        <TabsList>
          {STATUS_GROUPS.map((g) => (
            <TabsTrigger key={g.value} value={g.value}>
              {g.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map((order: Order) => (
          <OrderCard key={order.id} order={order} />
        ))}
        {filtered.length === 0 && (
          <p className="col-span-full text-gray-400 text-center py-8">
            Nenhum pedido encontrado.
          </p>
        )}
      </div>
    </div>
  );
}
