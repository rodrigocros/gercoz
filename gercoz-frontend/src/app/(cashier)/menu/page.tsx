'use client';
import { useState, useMemo } from 'react';
import { useMenu } from '@/hooks/use-menu';
import type { MenuItem } from '@/hooks/use-menu';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import ProductCard from './components/product-card';

export default function MenuPage() {
  const { data: menu = [], isLoading } = useMenu();
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState('all');

  const categories = useMemo(() => {
    const cats = new Map<string, string>();
    menu.forEach((item: MenuItem) => {
      if (item.categoryId && item.categoryName) {
        cats.set(item.categoryId, item.categoryName);
      }
    });
    return Array.from(cats.entries()).map(([id, name]) => ({ id, name }));
  }, [menu]);

  const filtered = useMemo(
    () =>
      menu.filter((item: MenuItem) => {
        const matchesSearch = item.name.toLowerCase().includes(search.toLowerCase());
        const matchesCategory =
          activeCategory === 'all' || item.categoryId === activeCategory;
        return matchesSearch && matchesCategory;
      }),
    [menu, search, activeCategory],
  );

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-bold">Cardápio</h1>
        <Input
          placeholder="Buscar produto..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-56"
        />
      </div>

      <Tabs value={activeCategory} onValueChange={setActiveCategory} className="mb-4">
        <TabsList>
          <TabsTrigger value="all">Todos</TabsTrigger>
          {categories.map((c) => (
            <TabsTrigger key={c.id} value={c.id}>
              {c.name}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {isLoading ? (
        <p className="text-gray-500">Carregando cardápio...</p>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {filtered.map((item: MenuItem) => (
            <ProductCard key={item.id} product={item} />
          ))}
          {filtered.length === 0 && (
            <p className="col-span-full text-gray-400 text-center py-8">
              Nenhum produto encontrado.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
