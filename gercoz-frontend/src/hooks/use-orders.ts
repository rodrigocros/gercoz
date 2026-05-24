import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

export interface OrderItem {
  productId: string;
  name: string;
  quantity: number;
  unitPrice: number;
  notes?: string;
}

export interface Order {
  id: string;
  orderNumber: number;
  type: 'MESA' | 'BALCAO';
  tableNumber?: number;
  status: 'PENDING' | 'PREPARING' | 'READY' | 'DELIVERED' | 'CANCELLED';
  items: OrderItem[];
  subtotal: number;
  discount: number;
  total: number;
  createdAt: string;
}

export const useOrders = (params?: { status?: string; type?: string }) =>
  useQuery({
    queryKey: ['orders', params],
    queryFn: () => api.get('/orders', { params }).then((r) => r.data),
    refetchInterval: 30_000,
  });

export const useCreateOrder = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      type: string;
      tableNumber?: number;
      items: Omit<OrderItem, 'name'>[];
      discount?: number;
    }) => api.post('/orders', data).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['orders'] }),
  });
};

export const useUpdateOrderStatus = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      api.patch(`/orders/${id}/status`, { status }).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['orders'] }),
  });
};
