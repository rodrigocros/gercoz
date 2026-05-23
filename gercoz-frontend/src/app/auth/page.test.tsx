import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import AuthPage from './page';
import { useAuth } from '@/contexts/auth-context';
import { useRouter } from 'next/navigation';

jest.mock('@/contexts/auth-context');
jest.mock('next/navigation', () => ({ useRouter: jest.fn() }));

const mockLogin = jest.fn();
const mockPush = jest.fn();

beforeEach(() => {
  jest.clearAllMocks();
  (useAuth as jest.Mock).mockReturnValue({ user: null, login: mockLogin, logout: jest.fn() });
  (useRouter as jest.Mock).mockReturnValue({ push: mockPush });
});

describe('AuthPage', () => {
  it('renders email and password inputs', () => {
    render(<AuthPage />);
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/senha/i)).toBeInTheDocument();
  });

  it('shows submit button with text Entrar', () => {
    render(<AuthPage />);
    expect(screen.getByRole('button', { name: /entrar/i })).toBeInTheDocument();
  });

  it('calls login with email and password on submit', async () => {
    mockLogin.mockResolvedValueOnce(undefined);
    render(<AuthPage />);
    fireEvent.change(screen.getByLabelText(/email/i), {
      target: { value: 'admin@demo.com' },
    });
    fireEvent.change(screen.getByLabelText(/senha/i), {
      target: { value: 'admin123' },
    });
    fireEvent.click(screen.getByRole('button', { name: /entrar/i }));
    await waitFor(() =>
      expect(mockLogin).toHaveBeenCalledWith('admin@demo.com', 'admin123')
    );
  });

  it('redirects to /dashboard after successful login', async () => {
    mockLogin.mockResolvedValueOnce(undefined);
    render(<AuthPage />);
    fireEvent.change(screen.getByLabelText(/email/i), {
      target: { value: 'admin@demo.com' },
    });
    fireEvent.change(screen.getByLabelText(/senha/i), {
      target: { value: 'admin123' },
    });
    fireEvent.click(screen.getByRole('button', { name: /entrar/i }));
    await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/dashboard'));
  });

  it('shows validation error for invalid email', async () => {
    render(<AuthPage />);
    fireEvent.change(screen.getByLabelText(/email/i), {
      target: { value: 'not-an-email' },
    });
    fireEvent.click(screen.getByRole('button', { name: /entrar/i }));
    await waitFor(() =>
      expect(screen.getByText(/email inválido/i)).toBeInTheDocument()
    );
  });
});
