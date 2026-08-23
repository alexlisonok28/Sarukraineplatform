import { useState } from 'react';
import { PageType, Toast } from '../../App';
import { apiRequest } from '../../utils/api';

type RegisterPageProps = {
  onRegister?: () => void;
  onPageChange: (page: PageType) => void;
  showToast?: (message: string, type: Toast['type']) => void;
};

const inputClassName = "w-full px-4 py-[14px] bg-white border border-gray-300 rounded-[10px] text-gray-900 transition-all duration-300 placeholder:text-gray-400 focus:outline-none focus:border-[#007AFF]";

export default function RegisterPage({ onPageChange, showToast }: RegisterPageProps) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (password !== confirmPassword) {
      showToast?.('Паролі не співпадають', 'error');
      return;
    }

    setLoading(true);

    try {
      await apiRequest('/signup', 'POST', {
        email,
        password,
        name,
      });

      showToast?.('Реєстрація успішна. Перевірте пошту та підтвердіть email.', 'success');
      onPageChange('login');
    } catch (error: any) {
      console.error('[RegisterPage] Registration error:', error);
      showToast?.(error.message || 'Помилка реєстрації', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-[480px] mx-auto px-6 py-[60px]">
      <div className="bg-white shadow-sm rounded-3xl p-12 p-[24px]">
        <h1 className="text-4xl mb-2 text-center text-gray-900 font-semibold">
          Реєстрація
        </h1>
        <p className="text-center text-gray-600 mb-8">Створіть новий обліковий запис</p>

        <form onSubmit={handleSubmit}>
          <div className="mb-5">
            <label className="block text-sm text-gray-900 mb-2 font-medium">Ім'я та Прізвище</label>
            <input
              type="text"
              className={inputClassName}
              placeholder="Іван Петренко"
              value={name}
              onChange={e => setName(e.target.value)}
              required
            />
          </div>

          <div className="mb-5">
            <label className="block text-sm text-gray-900 mb-2 font-medium">Email</label>
            <input
              type="email"
              className={inputClassName}
              placeholder="your@email.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
            />
          </div>

          <div className="mb-5">
            <label className="block text-sm text-gray-900 mb-2 font-medium">Пароль</label>
            <input
              type="password"
              className={inputClassName}
              placeholder="••••••••"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
            />
          </div>

          <div className="mb-5">
            <label className="block text-sm text-gray-900 mb-2 font-medium">Підтвердження паролю</label>
            <input
              type="password"
              className={inputClassName}
              placeholder="••••••••"
              value={confirmPassword}
              onChange={e => setConfirmPassword(e.target.value)}
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full px-4 py-4 bg-[#007AFF] hover:bg-[#0066CC] text-white border-none rounded-xl cursor-pointer transition-all duration-300 disabled:opacity-50"
          >
            {loading ? 'Реєстрація...' : 'Зареєструватися'}
          </button>
        </form>

        <div className="text-center mt-6 text-gray-600">
          Вже є обліковий запис?{' '}
          <button
            className="text-[#007AFF] no-underline cursor-pointer bg-none border-none hover:text-[#0066CC]"
            onClick={() => onPageChange('login')}
          >
            Увійти
          </button>
        </div>
      </div>
    </div>
  );
}
