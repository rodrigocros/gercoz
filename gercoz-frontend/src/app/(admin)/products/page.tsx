'use client';
import { useState } from 'react';
import { useProducts, useDeleteProduct, useCategories } from '@/hooks/use-products';
import type { Product, Category } from '@/hooks/use-products';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import ProductForm from './components/product-form';
import FichaTecnicaModal from './components/ficha-tecnica-modal';

function getMarginVariant(
  costPrice: number,
  salePrice: number,
): 'default' | 'secondary' | 'destructive' {
  if (salePrice === 0) return 'destructive';
  const pct = ((salePrice - costPrice) / salePrice) * 100;
  if (pct >= 40) return 'default';
  if (pct >= 20) return 'secondary';
  return 'destructive';
}

export default function ProductsPage() {
  const { data: products = [], isLoading } = useProducts();
  const { data: categories = [] } = useCategories();
  const deleteProduct = useDeleteProduct();
  const [editing, setEditing] = useState<Product | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [fichaTecnicaId, setFichaTecnicaId] = useState<string | null>(null);
  const [activeCategory, setActiveCategory] = useState<string>('all');

  const filtered =
    activeCategory === 'all'
      ? products
      : products.filter((p: Product) => p.categoryId === activeCategory);

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-bold">Produtos</h1>
        <Button
          onClick={() => {
            setEditing(null);
            setDialogOpen(true);
          }}
        >
          Novo Produto
        </Button>
      </div>

      <Tabs value={activeCategory} onValueChange={setActiveCategory} className="mb-4">
        <TabsList>
          <TabsTrigger value="all">Todos</TabsTrigger>
          {categories.map((c: Category) => (
            <TabsTrigger key={c.id} value={c.id}>
              {c.name}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {isLoading ? (
        <p className="text-gray-500">Carregando...</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((product: Product) => (
            <Card key={product.id} className="relative">
              <CardHeader className="pb-2">
                <div className="flex justify-between items-start">
                  <CardTitle className="text-base">{product.name}</CardTitle>
                  <Badge variant={getMarginVariant(product.costPrice, product.salePrice)}>
                    {product.salePrice > 0
                      ? `${(((product.salePrice - product.costPrice) / product.salePrice) * 100).toFixed(0)}%`
                      : 'N/A'}
                  </Badge>
                </div>
                {product.description && (
                  <p className="text-xs text-gray-500">{product.description}</p>
                )}
              </CardHeader>
              <CardContent>
                <div className="flex justify-between text-sm mb-3">
                  <span className="text-gray-500">
                    Custo: R$ {product.costPrice.toFixed(2)}
                  </span>
                  <span className="font-semibold">
                    Venda: R$ {product.salePrice.toFixed(2)}
                  </span>
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="flex-1"
                    onClick={() => setFichaTecnicaId(product.id)}
                  >
                    Ficha Tecnica
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setEditing(product);
                      setDialogOpen(true);
                    }}
                  >
                    Editar
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => deleteProduct.mutate(product.id)}
                  >
                    x
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl">
          <ProductForm product={editing} onSuccess={() => setDialogOpen(false)} />
        </DialogContent>
      </Dialog>

      <FichaTecnicaModal
        productId={fichaTecnicaId}
        onClose={() => setFichaTecnicaId(null)}
      />
    </div>
  );
}
