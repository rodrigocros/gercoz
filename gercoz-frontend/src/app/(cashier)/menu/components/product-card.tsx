'use client';
import { useToggleProduct } from '@/hooks/use-menu';
import type { MenuItem } from '@/hooks/use-menu';
import { useAuth } from '@/contexts/auth-context';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

interface Props {
  product: MenuItem;
}

export default function ProductCard({ product }: Props) {
  const { user } = useAuth();
  const toggle = useToggleProduct();

  return (
    <Card className={product.isActive ? '' : 'opacity-50'}>
      <CardHeader className="pb-2">
        <div className="flex justify-between items-start">
          <CardTitle className="text-sm font-medium">{product.name}</CardTitle>
          <Badge variant={product.isActive ? 'default' : 'secondary'}>
            {product.isActive ? 'Ativo' : 'Inativo'}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {product.description && (
          <p className="text-xs text-gray-500 line-clamp-2">{product.description}</p>
        )}
        <div className="flex justify-between items-center text-sm">
          <span className="font-semibold text-green-700">
            R$ {product.salePrice.toFixed(2)}
          </span>
          <span className="text-gray-400">{product.preparationTime} min</span>
        </div>
        {user?.role === 'ADMIN' && (
          <Button
            size="sm"
            variant="outline"
            className="w-full"
            onClick={() => toggle.mutate(product.id)}
            disabled={toggle.isPending}
          >
            {product.isActive ? 'Desativar' : 'Ativar'}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
