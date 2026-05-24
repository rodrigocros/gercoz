import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

export interface MenuItem {
  id: string;
  name: string;
  description?: string;
  categoryId?: string;
  categoryName?: string;
  salePrice: number;
  preparationTime: number;
  isActive: boolean;
}

export const useMenu = () =>
  useQuery({
    queryKey: ['menu'],
    queryFn: () => api.get('/menu').then((r) => r.data),
  });

export const useToggleProduct = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (productId: string) =>
      api.patch(`/menu/${productId}/toggle`).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['menu'] }),
  });
};
