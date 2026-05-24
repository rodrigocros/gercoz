'use client';
import { useState } from 'react';
import { useDashboardProducts, useDashboardSummary } from '@/hooks/use-dashboard';
import type { DashboardProduct } from '@/hooks/use-dashboard';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import RoiBarChart from './components/roi-bar-chart';
import MarginPieChart from './components/margin-pie-chart';
import CostScatterChart from './components/cost-scatter-chart';
import StockAlerts from './components/stock-alerts';

type SortKey = keyof Pick<DashboardProduct, 'name' | 'costPrice' | 'salePrice' | 'margin' | 'marginPct' | 'roi'>;
type SortDir = 'asc' | 'desc';

const classificationVariant = (c: string): 'default' | 'secondary' | 'destructive' =>
  c === 'ALTO' ? 'default' : c === 'MEDIO' ? 'secondary' : 'destructive';

export default function DashboardPage() {
  const { data: products = [], isLoading } = useDashboardProducts();
  const { data: summary } = useDashboardSummary();
  const [sortKey, setSortKey] = useState<SortKey>('roi');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [filterClassification, setFilterClassification] = useState('');

  const sorted = [...products]
    .filter((p: DashboardProduct) => !filterClassification || p.classification === filterClassification)
    .sort((a: DashboardProduct, b: DashboardProduct) => {
      const av = a[sortKey];
      const bv = b[sortKey];
      if (typeof av === 'string' && typeof bv === 'string') {
        return sortDir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av);
      }
      return sortDir === 'asc' ? (av as number) - (bv as number) : (bv as number) - (av as number);
    });

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortKey(key); setSortDir('desc'); }
  };

  const th = (key: SortKey, label: string) => (
    <TableHead
      className="cursor-pointer select-none hover:bg-gray-50"
      onClick={() => toggleSort(key)}
    >
      {label} {sortKey === key ? (sortDir === 'asc' ? '↑' : '↓') : ''}
    </TableHead>
  );

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold">Dashboard</h1>

      {/* KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-1"><CardTitle className="text-sm text-gray-500">Produtos Ativos</CardTitle></CardHeader>
          <CardContent><p className="text-3xl font-bold">{summary?.totalProducts ?? '—'}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-1"><CardTitle className="text-sm text-gray-500">Margem Média</CardTitle></CardHeader>
          <CardContent><p className="text-3xl font-bold">{summary ? `${summary.avgMarginPct.toFixed(1)}%` : '—'}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-1"><CardTitle className="text-sm text-gray-500">ROI Médio</CardTitle></CardHeader>
          <CardContent><p className="text-3xl font-bold">{summary ? `${summary.avgRoi.toFixed(1)}%` : '—'}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-1"><CardTitle className="text-sm text-gray-500">Margem Baixa</CardTitle></CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">
              {summary?.lowMarginCount ?? '—'}
              {summary && summary.lowMarginCount > 0 && (
                <Badge variant="destructive" className="ml-2 text-sm">{summary.lowMarginCount}</Badge>
              )}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Stock alerts */}
      {summary?.stockAlerts && summary.stockAlerts.length > 0 && (
        <StockAlerts alerts={summary.stockAlerts} />
      )}

      {/* Filter + Table */}
      <div>
        <div className="flex gap-2 mb-3">
          {['', 'ALTO', 'MEDIO', 'BAIXO'].map((c) => (
            <button
              key={c}
              onClick={() => setFilterClassification(c)}
              className={`px-3 py-1 rounded text-sm border ${filterClassification === c ? 'bg-gray-800 text-white' : 'bg-white'}`}
            >
              {c || 'Todos'}
            </button>
          ))}
        </div>

        {isLoading ? (
          <p className="text-gray-500">Carregando...</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                {th('name', 'Produto')}
                <TableHead>Categoria</TableHead>
                {th('costPrice', 'Custo')}
                {th('salePrice', 'Venda')}
                {th('margin', 'Margem R$')}
                {th('marginPct', 'Margem %')}
                {th('roi', 'ROI %')}
                <TableHead>Classe</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sorted.map((p: DashboardProduct) => (
                <TableRow
                  key={p.id}
                  className={
                    p.classification === 'ALTO'
                      ? 'bg-green-50'
                      : p.classification === 'MEDIO'
                        ? 'bg-yellow-50'
                        : 'bg-red-50'
                  }
                >
                  <TableCell className="font-medium">{p.name}</TableCell>
                  <TableCell className="text-gray-500">{p.categoryName}</TableCell>
                  <TableCell>R$ {p.costPrice.toFixed(2)}</TableCell>
                  <TableCell>R$ {p.salePrice.toFixed(2)}</TableCell>
                  <TableCell>R$ {p.margin.toFixed(2)}</TableCell>
                  <TableCell>{p.marginPct.toFixed(1)}%</TableCell>
                  <TableCell>{p.roi.toFixed(1)}%</TableCell>
                  <TableCell>
                    <Badge variant={classificationVariant(p.classification)}>
                      {p.classification}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      {/* Charts */}
      {products.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <RoiBarChart products={products} />
          <MarginPieChart products={products} />
          <CostScatterChart products={products} />
        </div>
      )}
    </div>
  );
}
