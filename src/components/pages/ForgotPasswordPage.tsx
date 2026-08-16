import { useState } from 'react';
import { PageType } from '../../App';
import { apiRequest } from '../../utils/api';

type ForgotPasswordPageProps = {
  onPageChange: (page: PageType) => void;
  showToast: (message: string, type?: 'success' | 'error' | 'info') => void;
};

/**
 * Страница запроса восстановления пароля.
 *
 * Для человека, который только знакомится с React:
 * - `email` хранит то, что пользователь ввёл в поле Email.
 * - `isSending` нужен, чтобы во время отправки нельзя было нажать кнопку несколько раз.
 * - после submit мы вызываем наш backend `/api/auth/forgot-password`.
 */
export default function ForgotPasswordPage({ onPageChange, showToast }: ForgotPasswordPageProps) {
  const [email, setEmail] = useState('');
  const [isSending, setIsSending] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSending) return;

    setIsSending(true);

    try {
      await apiRequest('/auth/forgot-password', 'POST', { email });

      // Backend специально не сообщает, существует такой email или нет.
      // Это стандартная мера безопасности против перебора зарегистрированных адресов.
      showToast('Якщо цей email зареєстрований, інструкції надіслано на пошту', 'success');
      setTimeout(() => onPageChange('login'), 1800);
    } catch (error: any) {
      console.error('[ForgotPasswordPage] Reset request failed:', error);
      showToast(error?.message || 'Не вдалося відправити лист', 'error');
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="max-w-[480px] mx-auto px-6 py-[60px]">
      <div className="bg-white shadow-sm rounded-3xl p-12 p-[24px]">
        <h1 className="text-4xl mb-2 text-center text-gray-900 text-[36px] font-semibold">
          Відновлення паролю
        </h1>
        <p className="text-center text-gray-600 mb-8">Введіть ваш email для отримання інструкцій</p>

        <form onSubmit={handleSubmit}>
          <div className="mb-5">
            <label className="block text-sm text-gray-900 mb-2 font-medium">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-[14px] bg-white border border-gray-300 rounded-[10px] text-gray-900 transition-all duration-300 placeholder:text-gray-400 focus:outline-none focus:border-[#007AFF]"
              placeholder="your@email.com"
              autoComplete="email"
              required
            />
          </div>

          <button
            type="submit"
            disabled={isSending}
            className="w-full px-4 py-4 bg-[#007AFF] hover:bg-[#0066CC] disabled:opacity-60 disabled:cursor-not-allowed text-white border-none rounded-xl cursor-pointer transition-all duration-300"
          >
            {isSending ? 'Відправлення...' : 'Відправити'}
          </button>
        </form>

        <div className="text-center mt-6 text-gray-600">
          Згадали пароль?{' '}
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
