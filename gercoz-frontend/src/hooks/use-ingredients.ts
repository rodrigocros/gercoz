import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

export interface Ingredient {
  id: string;
  name: string;
  unit: string;
  costPrice: number;
  stock: number;
  minStock: number;
  supplier?: string;
  isActive: boolean;
  priceHistory?: { price: number; changedAt: string }[];
}

export const useIngredients = (params?: { isActive?: boolean; name?: string }) =>
  useQuery({
    queryKey: ['ingredients', params],
    queryFn: () => api.get('/ingredients', { params }).then((r) => r.data),
  });

export const useIngredient = (id: string) =>
  useQuery({
    queryKey: ['ingredients', id],
    queryFn: () => api.get(`/ingredients/${id}`).then((r) => r.data),
    enabled: !!id,
  });

export const useCreateIngredient = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<Ingredient>) =>
      api.post('/ingredients', data).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['ingredients'] }),
  });
};

export const useUpdateIngredient = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: Partial<Ingredient> & { id: string }) =>
      api.patch(`/ingredients/${id}`, data).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['ingredients'] }),
  });
};

export const useDeleteIngredient = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/ingredients/${id}`).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['ingredients'] }),
  });
};
