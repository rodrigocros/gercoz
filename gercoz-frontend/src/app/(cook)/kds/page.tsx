'use client';
import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useSocket } from '@/contexts/socket-context';
import { useOrders } from '@/hooks/use-orders';
import type { Order } from '@/hooks/use-orders';
import KdsCard from './components/kds-card';

export default function KdsPage() {
  const { data: orders = [] } = useOrders();
  const socket = useSocket();
  const qc = useQueryClient();
  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    if (!socket) return;

    const handleNewOrder = () => {
      qc.invalidateQueries({ queryKey: ['orders'] });
      audioRef.current?.play().catch(() => {});
    };

    const handleStatusChange = () => {
      qc.invalidateQueries({ queryKey: ['orders'] });
    };

    socket.on('order:created', handleNewOrder);
    socket.on('order:status_changed', handleStatusChange);

    return () => {
      socket.off('order:created', handleNewOrder);
      socket.off('order:status_changed', handleStatusChange);
    };
  }, [socket, qc]);

  const activeOrders = orders.filter((o: Order) =>
    ['PENDING', 'PREPARING'].includes(o.status),
  );

  return (
    <div className="min-h-screen bg-gray-900 p-4">
      <audio ref={audioRef} src="/notification.mp3" preload="auto" />

      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-bold text-white">KDS — Cozinha</h1>
        <span className="text-gray-400 text-sm">
          {activeOrders.length} pedido(s) ativo(s)
        </span>
      </div>

      {activeOrders.length === 0 ? (
        <div className="flex items-center justify-center h-64">
          <p className="text-gray-500 text-xl">Nenhum pedido pendente</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {activeOrders.map((order: Order) => (
            <KdsCard key={order.id} order={order} />
          ))}
        </div>
      )}
    </div>
  );
}
