import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';

export interface DashboardProduct {
  id: string;
  name: string;
  categoryName: string;
  costPrice: number;
  salePrice: number;
  margin: number;
  marginPct: number;
  roi: number;
  classification: 'ALTO' | 'MEDIO' | 'BAIXO';
}

export interface StockAlert {
  id: string;
  name: string;
  unit: string;
  stock: number;
  minStock: number;
}

export interface DashboardSummary {
  totalProducts: number;
  avgMarginPct: number;
  avgRoi: number;
  lowMarginCount: number;
  stockAlerts: StockAlert[];
}

export const useDashboardProducts = () =>
  useQuery({
    queryKey: ['dashboard', 'products'],
    queryFn: () => api.get('/dashboard/products').then((r) => r.data),
    staleTime: 60_000,
  });

export const useDashboardSummary = () =>
  useQuery({
    queryKey: ['dashboard', 'summary'],
    queryFn: () => api.get('/dashboard/summary').then((r) => r.data),
    staleTime: 60_000,
  });
