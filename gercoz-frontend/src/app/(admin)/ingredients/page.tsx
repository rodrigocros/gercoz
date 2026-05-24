'use client';
import { useState } from 'react';
import { useIngredients, useDeleteIngredient } from '@/hooks/use-ingredients';
import type { Ingredient } from '@/hooks/use-ingredients';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import IngredientForm from './components/ingredient-form';
import PriceHistoryChart from './components/price-history-chart';

export default function IngredientsPage() {
  const [search, setSearch] = useState('');
  const { data: ingredients = [], isLoading } = useIngredients();
  const [editing, setEditing] = useState<Ingredient | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [historyFor, setHistoryFor] = useState<Ingredient | null>(null);
  const deleteIngredient = useDeleteIngredient();

  const filtered = ingredients.filter((i: Ingredient) =>
    i.name.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-bold">Ingredientes</h1>
        <div className="flex gap-3">
          <Input
            placeholder="Buscar..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-48"
          />
          <Button
            onClick={() => {
              setEditing(null);
              setFormOpen(true);
            }}
          >
            Novo Ingrediente
          </Button>
        </div>
      </div>

      {isLoading ? (
        <p className="text-gray-500">Carregando...</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>Unidade</TableHead>
              <TableHead>Custo</TableHead>
              <TableHead>Estoque</TableHead>
              <TableHead>Mín.</TableHead>
              <TableHead>Fornecedor</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((ing: Ingredient) => (
              <TableRow key={ing.id}>
                <TableCell className="font-medium">{ing.name}</TableCell>
                <TableCell>{ing.unit}</TableCell>
                <TableCell>R$ {ing.costPrice.toFixed(2)}</TableCell>
                <TableCell>
                  <span className="flex items-center gap-2">
                    {ing.stock}
                    {ing.stock <= ing.minStock && (
                      <Badge variant="destructive">Baixo</Badge>
                    )}
                  </span>
                </TableCell>
                <TableCell>{ing.minStock}</TableCell>
                <TableCell>{ing.supplier || '—'}</TableCell>
                <TableCell>
                  <Badge variant={ing.isActive ? 'default' : 'secondary'}>
                    {ing.isActive ? 'Ativo' : 'Inativo'}
                  </Badge>
                </TableCell>
                <TableCell>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setEditing(ing);
                        setFormOpen(true);
                      }}
                    >
                      Editar
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setHistoryFor(ing)}
                    >
                      Histórico
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => deleteIngredient.mutate(ing.id)}
                    >
                      Desativar
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-w-lg">
          <IngredientForm
            ingredient={editing}
            onSuccess={() => setFormOpen(false)}
          />
        </DialogContent>
      </Dialog>

      <Dialog open={!!historyFor} onOpenChange={(o) => !o && setHistoryFor(null)}>
        <DialogContent className="max-w-lg">
          {historyFor?.priceHistory && historyFor.priceHistory.length > 0 ? (
            <PriceHistoryChart
              history={historyFor.priceHistory}
              ingredientName={historyFor.name}
            />
          ) : (
            <p className="text-gray-500 text-sm p-4">Sem histórico de preço.</p>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
