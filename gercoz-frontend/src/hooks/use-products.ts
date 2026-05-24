import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

export interface RecipeItem {
  ingredientId: string;
  quantity: number;
  unit: string;
}

export interface Product {
  id: string;
  name: string;
  description?: string;
  categoryId?: string;
  categoryName?: string;
  salePrice: number;
  costPrice: number;
  preparationTime: number;
  isActive: boolean;
  recipeItems?: RecipeItem[];
}

export interface Category {
  id: string;
  name: string;
}

export const useProducts = (params?: { isActive?: boolean; categoryId?: string }) =>
  useQuery({
    queryKey: ['products', params],
    queryFn: () => api.get('/products', { params }).then((r) => r.data),
  });

export const useProduct = (id: string) =>
  useQuery({
    queryKey: ['products', id],
    queryFn: () => api.get(`/products/${id}`).then((r) => r.data),
    enabled: !!id,
  });

export const useCategories = () =>
  useQuery({
    queryKey: ['categories'],
    queryFn: () => api.get('/categories').then((r) => r.data),
  });

export const useFichaTecnica = (id: string) =>
  useQuery({
    queryKey: ['ficha-tecnica', id],
    queryFn: () => api.get(`/products/${id}/ficha-tecnica`).then((r) => r.data),
    enabled: !!id,
  });

export const useCreateProduct = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<Product>) =>
      api.post('/products', data).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['products'] }),
  });
};

export const useUpdateProduct = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: Partial<Product> & { id: string }) =>
      api.patch(`/products/${id}`, data).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['products'] }),
  });
};

export const useDeleteProduct = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/products/${id}`).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['products'] }),
  });
};
