'use client';
import { useFichaTecnica } from '@/hooks/use-products';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';

interface Props {
  productId: string | null;
  onClose: () => void;
}

export default function FichaTecnicaModal({ productId, onClose }: Props) {
  const { data, isLoading } = useFichaTecnica(productId ?? '');

  const marginPct = data
    ? ((data.salePrice - data.totalCost) / data.salePrice) * 100
    : 0;
  const roi = data && data.totalCost > 0
    ? ((data.salePrice - data.totalCost) / data.totalCost) * 100
    : 0;

  return (
    <Dialog open={!!productId} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Ficha Tecnica -- {data?.productName}</DialogTitle>
        </DialogHeader>

        {isLoading && <p className="text-gray-500">Carregando...</p>}

        {data && (
          <div className="space-y-4">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Ingrediente</TableHead>
                  <TableHead>Quantidade</TableHead>
                  <TableHead>Unidade</TableHead>
                  <TableHead>Custo Unit.</TableHead>
                  <TableHead>Custo Parcial</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.items?.map(
                  (item: {
                    ingredientName: string;
                    quantity: number;
                    unit: string;
                    unitCost: number;
                    totalCost: number;
                  }) => (
                    <TableRow key={item.ingredientName}>
                      <TableCell>{item.ingredientName}</TableCell>
                      <TableCell>{item.quantity}</TableCell>
                      <TableCell>{item.unit}</TableCell>
                      <TableCell>R$ {item.unitCost.toFixed(4)}</TableCell>
                      <TableCell>R$ {item.totalCost.toFixed(2)}</TableCell>
                    </TableRow>
                  ),
                )}
              </TableBody>
            </Table>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
              <div className="border rounded p-3">
                <p className="text-gray-500">Custo Total</p>
                <p className="font-bold text-lg">R$ {data.totalCost?.toFixed(2)}</p>
              </div>
              <div className="border rounded p-3">
                <p className="text-gray-500">Preco de Venda</p>
                <p className="font-bold text-lg">R$ {data.salePrice?.toFixed(2)}</p>
              </div>
              <div className="border rounded p-3">
                <p className="text-gray-500">Margem</p>
                <Badge
                  variant={
                    marginPct >= 40
                      ? 'default'
                      : marginPct >= 20
                        ? 'secondary'
                        : 'destructive'
                  }
                  className="text-base px-2 py-1"
                >
                  {marginPct.toFixed(1)}%
                </Badge>
              </div>
              <div className="border rounded p-3">
                <p className="text-gray-500">ROI</p>
                <p className="font-bold text-lg">{roi.toFixed(1)}%</p>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
