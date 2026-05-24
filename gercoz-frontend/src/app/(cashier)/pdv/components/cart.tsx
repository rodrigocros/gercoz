'use client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export interface CartItem {
  productId: string;
  name: string;
  quantity: number;
  unitPrice: number;
  notes: string;
}

interface Props {
  items: CartItem[];
  discount: number;
  onQuantityChange: (productId: string, delta: number) => void;
  onNotesChange: (productId: string, notes: string) => void;
  onRemove: (productId: string) => void;
  onDiscountChange: (value: number) => void;
  onConfirm: () => void;
  isSubmitting: boolean;
}

export default function Cart({
  items,
  discount,
  onQuantityChange,
  onNotesChange,
  onRemove,
  onDiscountChange,
  onConfirm,
  isSubmitting,
}: Props) {
  const subtotal = items.reduce((s, i) => s + i.unitPrice * i.quantity, 0);
  const total = Math.max(0, subtotal - discount);

  return (
    <div className="flex flex-col h-full">
      <h2 className="text-lg font-semibold mb-3">Carrinho</h2>

      <div className="flex-1 overflow-y-auto space-y-3">
        {items.length === 0 && (
          <p className="text-gray-400 text-sm text-center py-6">
            Nenhum item adicionado.
          </p>
        )}
        {items.map((item) => (
          <div key={item.productId} className="border rounded p-2 space-y-1">
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium">{item.name}</span>
              <button
                onClick={() => onRemove(item.productId)}
                className="text-red-400 text-xs hover:text-red-600"
              >
                remover
              </button>
            </div>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                className="h-6 w-6 p-0"
                onClick={() => onQuantityChange(item.productId, -1)}
              >
                −
              </Button>
              <span className="text-sm w-6 text-center">{item.quantity}</span>
              <Button
                size="sm"
                variant="outline"
                className="h-6 w-6 p-0"
                onClick={() => onQuantityChange(item.productId, 1)}
              >
                +
              </Button>
              <span className="text-sm text-gray-500 ml-auto">
                R$ {(item.unitPrice * item.quantity).toFixed(2)}
              </span>
            </div>
            <Input
              placeholder="Observações..."
              value={item.notes}
              onChange={(e) => onNotesChange(item.productId, e.target.value)}
              className="h-7 text-xs"
            />
          </div>
        ))}
      </div>

      <div className="border-t pt-3 space-y-2 mt-3">
        <div className="flex justify-between text-sm">
          <span className="text-gray-500">Subtotal</span>
          <span>R$ {subtotal.toFixed(2)}</span>
        </div>
        <div className="flex items-center gap-2">
          <Label className="text-sm text-gray-500 shrink-0">Desconto R$</Label>
          <Input
            type="number"
            step="0.01"
            min="0"
            value={discount}
            onChange={(e) => onDiscountChange(Number(e.target.value))}
            className="h-7 text-sm"
          />
        </div>
        <div className="flex justify-between font-bold">
          <span>Total</span>
          <span>R$ {total.toFixed(2)}</span>
        </div>
        <Button
          className="w-full"
          onClick={onConfirm}
          disabled={items.length === 0 || isSubmitting}
        >
          {isSubmitting ? 'Enviando...' : 'Confirmar Pedido'}
        </Button>
      </div>
    </div>
  );
}
