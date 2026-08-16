import { useState } from 'react';
import { PageType } from '../../App';
import { apiRequest } from '../../utils/api';

type ResetPasswordPageProps = {
  token: string;
  onPageChange: (page: PageType) => void;
  showToast: (message: string, type?: 'success' | 'error' | 'info') => void;
};

/**
 * Страница, которую пользователь открывает из письма.
 * В URL находится одноразовый `resetToken`, а здесь пользователь задаёт новый пароль.
 */
export default function ResetPasswordPage({ token, onPageChange, showToast }: ResetPasswordPageProps) {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (password.length < 8) {
      showToast('Пароль має містити щонайменше 8 символів', 'error');
      return;
    }

    if (password !== confirmPassword) {
      showToast('Паролі не співпадають', 'error');
      return;
    }

    setIsSaving(true);

    try {
      await apiRequest('/auth/reset-password', 'POST', { token, password });

      // После успешного использования убираем секретный token из адресной строки,
      // чтобы он не оставался в истории браузера.
      window.history.replaceState(null, '', window.location.pathname);
      showToast('Пароль успішно змінено. Тепер ви можете увійти.', 'success');
      setTimeout(() => onPageChange('login'), 1200);
    } catch (error: any) {
      console.error('[ResetPasswordPage] Password reset failed:', error);
      showToast(error?.message || 'Не вдалося змінити пароль', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  if (!token) {
    return (
      <div className="max-w-[480px] mx-auto px-6 py-[60px] text-center">
        <div className="bg-white shadow-sm rounded-3xl p-8">
          <h1 className="text-3xl font-semibold text-gray-900 mb-3">Посилання недійсне</h1>
          <p className="text-gray-600 mb-6">Запросіть нове посилання для відновлення пароля.</p>
          <button onClick={() => onPageChange('forgot-password')} className="px-5 py-3 bg-[#007AFF] text-white rounded-xl">
            Відновити пароль
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-[480px] mx-auto px-6 py-[60px]">
      <div className="bg-white shadow-sm rounded-3xl p-[24px] sm:p-12">
        <h1 className="text-[36px] mb-2 text-center text-gray-900 font-semibold">Новий пароль</h1>
        <p className="text-center text-gray-600 mb-8">Введіть новий пароль для вашого облікового запису</p>

        <form onSubmit={handleSubmit}>
          <div className="mb-5">
            <label className="block text-sm text-gray-900 mb-2 font-medium">Новий пароль</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
              minLength={8}
              className="w-full px-4 py-[14px] bg-white border border-gray-300 rounded-[10px] text-gray-900 focus:outline-none focus:border-[#007AFF]"
              required
            />
          </div>

          <div className="mb-6">
            <label className="block text-sm text-gray-900 mb-2 font-medium">Повторіть пароль</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              autoComplete="new-password"
              minLength={8}
              className="w-full px-4 py-[14px] bg-white border border-gray-300 rounded-[10px] text-gray-900 focus:outline-none focus:border-[#007AFF]"
              required
            />
          </div>

          <button
            type="submit"
            disabled={isSaving}
            className="w-full px-4 py-4 bg-[#007AFF] hover:bg-[#0066CC] disabled:opacity-60 disabled:cursor-not-allowed text-white rounded-xl transition-all"
          >
            {isSaving ? 'Збереження...' : 'Зберегти новий пароль'}
          </button>
        </form>
      </div>
    </div>
  );
}
