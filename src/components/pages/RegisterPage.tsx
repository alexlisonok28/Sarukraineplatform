import { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { PageType, Toast } from '../../App';
import { apiRequest } from '../../utils/api';
import { localizeApiError } from '../../utils/errors';

type RegisterPageProps = {
  onRegister?: () => void;
  onPageChange: (page: PageType) => void;
  showToast?: (message: string, type: Toast['type']) => void;
};

type RegisterErrors = { name?: string; email?: string; password?: string; confirmPassword?: string; form?: string };

const baseInputClassName = "w-full px-4 py-[14px] bg-white border rounded-[10px] text-gray-900 transition-all duration-300 placeholder:text-gray-400 focus:outline-none";
const inputClassName = (hasError: boolean) => `${baseInputClassName} ${hasError ? 'border-red-500 focus:border-red-500' : 'border-gray-300 focus:border-[#007AFF]'}`;

export default function RegisterPage({ onPageChange, showToast }: RegisterPageProps) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<RegisterErrors>({});

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const nextErrors: RegisterErrors = {};
    const normalizedEmail = email.trim();
    if (!name.trim()) nextErrors.name = 'Вкажіть ім’я та прізвище';
    if (!normalizedEmail) nextErrors.email = 'Вкажіть email';
    else if (!/^\S+@\S+\.\S+$/.test(normalizedEmail)) nextErrors.email = 'Вкажіть коректний email';
    if (!password) nextErrors.password = 'Вкажіть пароль';
    else if (password.length < 8) nextErrors.password = 'Пароль має містити щонайменше 8 символів';
    if (!confirmPassword) nextErrors.confirmPassword = 'Повторіть пароль';
    else if (password !== confirmPassword) nextErrors.confirmPassword = 'Паролі не співпадають';

    if (Object.keys(nextErrors).length) {
      setErrors(nextErrors);
      return;
    }

    setErrors({});
    setLoading(true);

    try {
      await apiRequest('/signup', 'POST', { email: normalizedEmail, password, name: name.trim() });
      showToast?.('Реєстрація успішна. Перевірте пошту та підтвердіть email.', 'success');
      onPageChange('login');
    } catch (error: any) {
      console.error('[RegisterPage] Registration error:', error);
      const message = localizeApiError(error.message);
      if (message === 'Користувач із таким email вже зареєстрований') setErrors({ email: message });
      else setErrors({ form: message });
    } finally {
      setLoading(false);
    }
  };

  const clearError = (field: keyof RegisterErrors) => setErrors(prev => ({ ...prev, [field]: undefined, form: undefined }));

  return (
    <div className="max-w-[480px] mx-auto px-6 py-[60px]">
      <div className="bg-white shadow-sm rounded-3xl p-12 p-[24px]">
        <h1 className="text-4xl mb-2 text-center text-gray-900 font-semibold">Реєстрація</h1>
        <p className="text-center text-gray-600 mb-8">Створіть новий обліковий запис</p>

        <form onSubmit={handleSubmit} noValidate>
          <div className="mb-5">
            <label className="block text-sm text-gray-900 mb-2 font-medium">Ім'я та Прізвище</label>
            <input type="text" className={inputClassName(!!errors.name)} placeholder="Іван Петренко" value={name} aria-invalid={!!errors.name} onChange={e => { setName(e.target.value); clearError('name'); }} />
            {errors.name && <p className="mt-2 text-sm text-red-600">{errors.name}</p>}
          </div>

          <div className="mb-5">
            <label className="block text-sm text-gray-900 mb-2 font-medium">Email</label>
            <input type="email" className={inputClassName(!!errors.email)} placeholder="your@email.com" value={email} aria-invalid={!!errors.email} onChange={e => { setEmail(e.target.value); clearError('email'); }} />
            {errors.email && <p className="mt-2 text-sm text-red-600">{errors.email}</p>}
          </div>

          <div className="mb-5">
            <label className="block text-sm text-gray-900 mb-2 font-medium">Пароль</label>
            <div className="relative">
              <input type={showPassword ? 'text' : 'password'} className={`${inputClassName(!!errors.password)} pr-12`} placeholder="••••••••" value={password} aria-invalid={!!errors.password} onChange={e => { setPassword(e.target.value); clearError('password'); }} />
              <button type="button" onClick={() => setShowPassword(v => !v)} className="absolute right-0 top-0 h-full w-12 flex items-center justify-center bg-transparent border-0 text-gray-500 hover:text-gray-700 cursor-pointer" aria-label={showPassword ? 'Приховати пароль' : 'Показати пароль'}>
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
            {errors.password && <p className="mt-2 text-sm text-red-600">{errors.password}</p>}
          </div>

          <div className="mb-5">
            <label className="block text-sm text-gray-900 mb-2 font-medium">Підтвердження паролю</label>
            <div className="relative">
              <input type={showConfirmPassword ? 'text' : 'password'} className={`${inputClassName(!!errors.confirmPassword)} pr-12`} placeholder="••••••••" value={confirmPassword} aria-invalid={!!errors.confirmPassword} onChange={e => { setConfirmPassword(e.target.value); clearError('confirmPassword'); }} />
              <button type="button" onClick={() => setShowConfirmPassword(v => !v)} className="absolute right-0 top-0 h-full w-12 flex items-center justify-center bg-transparent border-0 text-gray-500 hover:text-gray-700 cursor-pointer" aria-label={showConfirmPassword ? 'Приховати підтвердження паролю' : 'Показати підтвердження паролю'}>
                {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
            {errors.confirmPassword && <p className="mt-2 text-sm text-red-600">{errors.confirmPassword}</p>}
          </div>

          {errors.form && <div className="mb-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">{errors.form}</div>}

          <button type="submit" disabled={loading} className="w-full px-4 py-4 bg-[#007AFF] hover:bg-[#0066CC] text-white border-none rounded-xl cursor-pointer transition-all duration-300 disabled:opacity-50">
            {loading ? 'Реєстрація...' : 'Зареєструватися'}
          </button>
        </form>

        <div className="text-center mt-6 text-gray-600">
          Вже є обліковий запис?{' '}
          <button className="text-[#007AFF] no-underline cursor-pointer bg-none border-none hover:text-[#0066CC]" onClick={() => onPageChange('login')}>
            Увійти
          </button>
        </div>
      </div>
    </div>
  );
}
