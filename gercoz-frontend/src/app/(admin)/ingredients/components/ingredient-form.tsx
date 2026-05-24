'use client';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useCreateIngredient, useUpdateIngredient } from '@/hooks/use-ingredients';
import type { Ingredient } from '@/hooks/use-ingredients';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const schema = z.object({
  name: z.string().min(1, 'Nome obrigatório'),
  unit: z.enum(['G', 'KG', 'ML', 'L', 'UN']),
  costPrice: z.coerce.number().min(0, 'Custo deve ser positivo'),
  stock: z.coerce.number().min(0),
  minStock: z.coerce.number().min(0),
  supplier: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

interface Props {
  ingredient?: Ingredient | null;
  onSuccess: () => void;
}

export default function IngredientForm({ ingredient, onSuccess }: Props) {
  const create = useCreateIngredient();
  const update = useUpdateIngredient();

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: ingredient?.name ?? '',
      unit: (ingredient?.unit as FormData['unit']) ?? 'KG',
      costPrice: ingredient?.costPrice ?? 0,
      stock: ingredient?.stock ?? 0,
      minStock: ingredient?.minStock ?? 0,
      supplier: ingredient?.supplier ?? '',
    },
  });

  const onSubmit = async (data: FormData) => {
    if (ingredient) {
      await update.mutateAsync({ id: ingredient.id, ...data });
    } else {
      await create.mutateAsync(data);
    }
    onSuccess();
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 p-2" noValidate>
      <h2 className="text-lg font-semibold">
        {ingredient ? 'Editar Ingrediente' : 'Novo Ingrediente'}
      </h2>

      <div>
        <Label htmlFor="ing-name">Nome</Label>
        <Input id="ing-name" {...register('name')} />
        {errors.name && <p className="text-red-500 text-sm">{errors.name.message}</p>}
      </div>

      <div>
        <Label>Unidade</Label>
        <Select
          defaultValue={watch('unit')}
          onValueChange={(v) => setValue('unit', v as FormData['unit'])}
        >
          <SelectTrigger>
            <SelectValue placeholder="Selecione" />
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

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="costPrice">Custo (R$)</Label>
          <Input id="costPrice" type="number" step="0.01" {...register('costPrice')} />
          {errors.costPrice && (
            <p className="text-red-500 text-sm">{errors.costPrice.message}</p>
          )}
        </div>
        <div>
          <Label htmlFor="supplier">Fornecedor</Label>
          <Input id="supplier" {...register('supplier')} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="stock">Estoque</Label>
          <Input id="stock" type="number" step="0.001" {...register('stock')} />
        </div>
        <div>
          <Label htmlFor="minStock">Estoque Mínimo</Label>
          <Input id="minStock" type="number" step="0.001" {...register('minStock')} />
        </div>
      </div>

      <Button type="submit" disabled={isSubmitting} className="w-full">
        {isSubmitting ? 'Salvando...' : 'Salvar'}
      </Button>
    </form>
  );
}
