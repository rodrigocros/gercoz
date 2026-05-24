'use client';
import { useState, useMemo } from 'react';
import { useMenu } from '@/hooks/use-menu';
import type { MenuItem } from '@/hooks/use-menu';
import { useCreateOrder } from '@/hooks/use-orders';
import { useCategories } from '@/hooks/use-products';
import Cart from './components/cart';
import type { CartItem } from './components/cart';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';

export default function PdvPage() {
  const { data: menu = [] } = useMenu();
  const { data: categories = [] } = useCategories();
  const createOrder = useCreateOrder();

  const [orderType, setOrderType] = useState<'MESA' | 'BALCAO'>('BALCAO');
  const [tableNumber, setTableNumber] = useState('');
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState('all');
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [discount, setDiscount] = useState(0);

  const filteredMenu = useMemo(
    () =>
      menu.filter((item: MenuItem) => {
        if (!item.isActive) return false;
        const matchesSearch = item.name.toLowerCase().includes(search.toLowerCase());
        const matchesCategory =
          activeCategory === 'all' || item.categoryId === activeCategory;
        return matchesSearch && matchesCategory;
      }),
    [menu, search, activeCategory],
  );

  const addToCart = (product: MenuItem) => {
    setCartItems((prev) => {
      const existing = prev.find((i) => i.productId === product.id);
      if (existing) {
        return prev.map((i) =>
          i.productId === product.id ? { ...i, quantity: i.quantity + 1 } : i,
        );
      }
      return [
        ...prev,
        {
          productId: product.id,
          name: product.name,
          quantity: 1,
          unitPrice: product.salePrice,
          notes: '',
        },
      ];
    });
  };

  const handleQuantityChange = (productId: string, delta: number) => {
    setCartItems((prev) =>
      prev
        .map((i) =>
          i.productId === productId ? { ...i, quantity: i.quantity + delta } : i,
        )
        .filter((i) => i.quantity > 0),
    );
  };

  const handleNotesChange = (productId: string, notes: string) => {
    setCartItems((prev) =>
      prev.map((i) => (i.productId === productId ? { ...i, notes } : i)),
    );
  };

  const handleRemove = (productId: string) => {
    setCartItems((prev) => prev.filter((i) => i.productId !== productId));
  };

  const handleConfirm = async () => {
    try {
      await createOrder.mutateAsync({
        type: orderType,
        tableNumber: orderType === 'MESA' ? Number(tableNumber) : undefined,
        items: cartItems.map(({ productId, quantity, unitPrice, notes }) => ({
          productId,
          quantity,
          unitPrice,
          notes: notes || undefined,
        })),
        discount: discount || undefined,
      });
      setCartItems([]);
      setDiscount(0);
      setTableNumber('');
    } catch {
      // error handled silently; API errors visible in network tab
    }
  };

  return (
    <div className="flex h-[calc(100vh-4rem)]">
      <div className="flex-1 overflow-y-auto p-4 border-r">
        <div className="flex gap-3 mb-4 items-center">
          <div className="flex gap-2">
            <Button
              size="sm"
              variant={orderType === 'BALCAO' ? 'default' : 'outline'}
              onClick={() => setOrderType('BALCAO')}
            >
              Balcão
            </Button>
            <Button
              size="sm"
              variant={orderType === 'MESA' ? 'default' : 'outline'}
              onClick={() => setOrderType('MESA')}
            >
              Mesa
            </Button>
          </div>
          {orderType === 'MESA' && (
            <div className="flex items-center gap-2">
              <Label className="text-sm shrink-0">Nº Mesa</Label>
              <Input
                type="number"
                value={tableNumber}
                onChange={(e) => setTableNumber(e.target.value)}
                className="w-20 h-8"
              />
            </div>
          )}
          <Input
            placeholder="Buscar produto..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="ml-auto w-48 h-8"
          />
        </div>

        <Tabs value={activeCategory} onValueChange={setActiveCategory} className="mb-3">
          <TabsList>
            <TabsTrigger value="all">Todos</TabsTrigger>
            {categories.map((c: { id: string; name: string }) => (
              <TabsTrigger key={c.id} value={c.id}>
                {c.name}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {filteredMenu.map((item: MenuItem) => (
            <button
              key={item.id}
              onClick={() => addToCart(item)}
              className="border rounded-lg p-3 text-left hover:bg-gray-50 active:scale-95 transition-transform"
            >
              <p className="font-medium text-sm">{item.name}</p>
              <p className="text-green-700 font-semibold text-sm mt-1">
                R$ {item.salePrice.toFixed(2)}
              </p>
              {cartItems.find((i) => i.productId === item.id) && (
                <Badge variant="secondary" className="mt-1 text-xs">
                  {cartItems.find((i) => i.productId === item.id)?.quantity}x
                </Badge>
              )}
            </button>
          ))}
        </div>
      </div>

      <div className="w-80 p-4">
        <Cart
          items={cartItems}
          discount={discount}
          onQuantityChange={handleQuantityChange}
          onNotesChange={handleNotesChange}
          onRemove={handleRemove}
          onDiscountChange={setDiscount}
          onConfirm={handleConfirm}
          isSubmitting={createOrder.isPending}
        />
      </div>
    </div>
  );
}
