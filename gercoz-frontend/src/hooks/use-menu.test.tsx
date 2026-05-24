import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactNode } from 'react';
import { useMenu } from './use-menu';
import { api } from '@/lib/api';

jest.mock('@/lib/api', () => ({ api: { get: jest.fn() } }));

const wrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
    {children}
  </QueryClientProvider>
);

describe('useMenu', () => {
  it('fetches menu from /menu', async () => {
    (api.get as jest.Mock).mockResolvedValueOnce({
      data: [{ id: '1', name: 'Pizza Margherita', salePrice: 45.0, isActive: true }],
    });
    const { result } = renderHook(() => useMenu(), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toHaveLength(1);
  });
});
