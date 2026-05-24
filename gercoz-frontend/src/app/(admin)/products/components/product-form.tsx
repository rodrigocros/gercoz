'use client';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMemo } from 'react';
import { useIngredients } from '@/hooks/use-ingredients';
import type { Ingredient } from '@/hooks/use-ingredients';
import { useCreateProduct, useUpdateProduct, useCategories } from '@/hooks/use-products';
import type { Product, Category } from '@/hooks/use-products';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const recipeItemSchema = z.object({
  ingredientId: z.string().min(1, 'Selecione um ingrediente'),
  quantity: z.coerce.number().min(0.001, 'Quantidade deve ser maior que 0'),
  unit: z.enum(['G', 'KG', 'ML', 'L', 'UN']),
});

const schema = z.object({
  name: z.string().min(1, 'Nome obrigatório'),
  description: z.string().optional(),
  categoryId: z.string().optional(),
  salePrice: z.coerce.number().min(0),
  preparationTime: z.coerce.number().min(1).default(15),
  recipeItems: z.array(recipeItemSchema),
});

type FormData = z.infer<typeof schema>;

interface Props {
  product?: Product | null;
  onSuccess: () => void;
}

export default function ProductForm({ product, onSuccess }: Props) {
  const create = useCreateProduct();
  const update = useUpdateProduct();
  const { data: categories = [] } = useCategories();
  const { data: ingredients = [] } = useIngredients({ isActive: true });

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    control,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: product?.name ?? '',
      description: product?.description ?? '',
      categoryId: product?.categoryId ?? '',
      salePrice: product?.salePrice ?? 0,
      preparationTime: product?.preparationTime ?? 15,
      recipeItems: product?.recipeItems ?? [],
    },
  });

  const { fields, append, remove } = useFieldArray({ control, name: 'recipeItems' });
  const watchedItems = watch('recipeItems');
  const watchedSalePrice = watch('salePrice');

  const calculatedCost = useMemo(() => {
    return watchedItems.reduce((sum, item) => {
      const ing = ingredients.find((i: Ingredient) => i.id === item.ingredientId);
      if (!ing) return sum;
      let qty = item.quantity;
      if (item.unit === 'G' && ing.unit === 'KG') qty /= 1000;
      if (item.unit === 'ML' && ing.unit === 'L') qty /= 1000;
      return sum + ing.costPrice * qty;
    }, 0);
  }, [watchedItems, ingredients]);

  const margin = watchedSalePrice - calculatedCost;
  const marginPct = watchedSalePrice > 0 ? (margin / watchedSalePrice) * 100 : 0;

  const onSubmit = async (data: FormData) => {
    if (product) {
      await update.mutateAsync({ id: product.id, ...data });
    } else {
      await create.mutateAsync(data);
    }
    onSuccess();
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 p-2 max-h-[80vh] overflow-y-auto" noValidate>
      <h2 className="text-lg font-semibold">
        {product ? 'Editar Produto' : 'Novo Produto'}
      </h2>

      <div>
        <Label htmlFor="prod-name">Nome</Label>
        <Input id="prod-name" {...register('name')} />
        {errors.name && <p className="text-red-500 text-sm">{errors.name.message}</p>}
      </div>

      <div>
        <Label htmlFor="description">Descricao</Label>
        <Input id="description" {...register('description')} />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>Categoria</Label>
          <Select
            defaultValue={product?.categoryId ?? ''}
            onValueChange={(v) => setValue('categoryId', v)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Selecione" />
            </SelectTrigger>
            <SelectContent>
              {categories.map((c: Category) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label htmlFor="preparationTime">Tempo de Preparo (min)</Label>
          <Input id="preparationTime" type="number" {...register('preparationTime')} />
        </div>
      </div>

      <div>
        <Label htmlFor="salePrice">Preco de Venda (R$)</Label>
        <Input id="salePrice" type="number" step="0.01" {...register('salePrice')} />
      </div>

      <div className="border rounded p-3 space-y-3">
        <div className="flex justify-between items-center">
          <h3 className="font-medium text-sm">Receita</h3>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => append({ ingredientId: '', quantity: 0, unit: 'KG' })}
          >
            + Ingrediente
          </Button>
        </div>

        {fields.map((field, idx) => (
          <div key={field.id} className="grid grid-cols-[1fr_80px_80px_32px] gap-2 items-end">
            <div>
              <Label className="text-xs">Ingrediente</Label>
              <Select
                onValueChange={(v) => setValue(`recipeItems.${idx}.ingredientId`, v)}
                defaultValue={field.ingredientId}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {ingredients.map((i: Ingredient) => (
                    <SelectItem key={i.id} value={i.id}>
                      {i.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Qtd</Label>
              <Input
                type="number"
                step="0.001"
                {...register(`recipeItems.${idx}.quantity`)}
              />
            </div>
            <div>
              <Label className="text-xs">Und</Label>
              <Select
                defaultValue={field.unit}
                onValueChange={(v) =>
                  setValue(`recipeItems.${idx}.unit`, v as 'G' | 'KG' | 'ML' | 'L' | 'UN')
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {['G', 'KG', 'ML', 'L', 'UN'].map((u) => (
                    <SelectItem key={u} value={u}>
                      {u}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="text-red-500"
              onClick={() => remove(idx)}
            >
              x
            </Button>
          </div>
        ))}

        <div className="pt-2 border-t text-sm space-y-1">
          <p>
            Custo calculado:{' '}
            <span className="font-semibold">R$ {calculatedCost.toFixed(2)}</span>
          </p>
          <p>
            Margem:{' '}
            <Badge
              variant={marginPct >= 40 ? 'default' : marginPct >= 20 ? 'secondary' : 'destructive'}
            >
              {marginPct.toFixed(1)}%
            </Badge>
          </p>
        </div>
      </div>

      <Button type="submit" disabled={isSubmitting} className="w-full">
        {isSubmitting ? 'Salvando...' : 'Salvar'}
      </Button>
    </form>
  );
}
