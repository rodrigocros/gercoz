import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactNode } from 'react';
import { useDashboardSummary, useDashboardProducts } from './use-dashboard';
import { api } from '@/lib/api';

jest.mock('@/lib/api', () => ({ api: { get: jest.fn() } }));

const wrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
    {children}
  </QueryClientProvider>
);

describe('useDashboardSummary', () => {
  it('fetches from /dashboard/summary', async () => {
    (api.get as jest.Mock).mockResolvedValueOnce({
      data: { totalProducts: 5, avgMarginPct: 42, avgRoi: 72, lowMarginCount: 1, stockAlerts: [] },
    });
    const { result } = renderHook(() => useDashboardSummary(), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data.avgMarginPct).toBe(42);
  });
});
