import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactNode } from 'react';
import { useIngredients, useCreateIngredient } from './use-ingredients';
import { api } from '@/lib/api';

jest.mock('@/lib/api', () => ({ api: { get: jest.fn(), post: jest.fn() } }));

const wrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
    {children}
  </QueryClientProvider>
);

describe('useIngredients', () => {
  it('fetches ingredients from /ingredients', async () => {
    (api.get as jest.Mock).mockResolvedValueOnce({
      data: [{ id: '1', name: 'Farinha', unit: 'KG', costPrice: 3.5, stock: 10, minStock: 2, isActive: true }],
    });
    const { result } = renderHook(() => useIngredients(), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(api.get).toHaveBeenCalledWith('/ingredients', { params: undefined });
    expect(result.current.data).toHaveLength(1);
  });
});
