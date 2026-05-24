import { render, screen, fireEvent } from '@testing-library/react';
import KdsCard from './kds-card';
import { useUpdateOrderStatus } from '@/hooks/use-orders';

jest.mock('@/hooks/use-orders');
const mockMutate = jest.fn();
(useUpdateOrderStatus as jest.Mock).mockReturnValue({ mutate: mockMutate, isPending: false });

const pendingOrder = {
  id: 'o1',
  orderNumber: 42,
  type: 'MESA' as const,
  tableNumber: 3,
  status: 'PENDING' as const,
  items: [{ name: 'Pizza', quantity: 2, unitPrice: 45, notes: 'sem cebola', productId: 'p1' }],
  createdAt: new Date().toISOString(),
  subtotal: 90,
  discount: 0,
  total: 90,
};

describe('KdsCard', () => {
  it('renders order number and items', () => {
    render(<KdsCard order={pendingOrder} />);
    expect(screen.getByText(/#42/)).toBeInTheDocument();
    expect(screen.getByText(/Pizza/)).toBeInTheDocument();
  });

  it('shows Iniciar Preparo button when status is PENDING', () => {
    render(<KdsCard order={pendingOrder} />);
    expect(screen.getByRole('button', { name: /iniciar preparo/i })).toBeInTheDocument();
  });

  it('calls updateStatus with PREPARING on Iniciar Preparo click', () => {
    render(<KdsCard order={pendingOrder} />);
    fireEvent.click(screen.getByRole('button', { name: /iniciar preparo/i }));
    expect(mockMutate).toHaveBeenCalledWith({ id: 'o1', status: 'PREPARING' });
  });
});
