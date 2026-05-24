import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactNode } from 'react';
import { useOrders, useCreateOrder } from './use-orders';
import { api } from '@/lib/api';

jest.mock('@/lib/api', () => ({ api: { get: jest.fn(), post: jest.fn() } }));

const wrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
    {children}
  </QueryClientProvider>
);

describe('useOrders', () => {
  it('fetches orders from /orders', async () => {
    (api.get as jest.Mock).mockResolvedValueOnce({
      data: [{ id: 'o1', orderNumber: 1, status: 'PENDING', type: 'BALCAO', total: 45 }],
    });
    const { result } = renderHook(() => useOrders(), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data[0].status).toBe('PENDING');
  });
});
