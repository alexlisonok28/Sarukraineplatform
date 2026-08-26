import { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { PageType, Toast } from '../../App';
import { auth } from '../../utils/auth';
import { localizeApiError } from '../../utils/errors';

type LoginPageProps = {
  onLogin: () => void;
  onPageChange: (page: PageType) => void;
  showToast?: (message: string, type: Toast['type']) => void;
};

type LoginErrors = { email?: string; password?: string; form?: string };

const baseInputClassName = "w-full px-4 py-[14px] bg-white border rounded-[10px] text-gray-900 transition-all duration-300 placeholder:text-gray-400 focus:outline-none";
const inputClassName = (hasError: boolean) => `${baseInputClassName} ${hasError ? 'border-red-500 focus:border-red-500' : 'border-gray-300 focus:border-[#007AFF]'}`;

export default function LoginPage({ onLogin, onPageChange, showToast }: LoginPageProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<LoginErrors>({});

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const nextErrors: LoginErrors = {};
    const normalizedEmail = email.trim();
    if (!normalizedEmail) nextErrors.email = 'Вкажіть email';
    else if (!/^\S+@\S+\.\S+$/.test(normalizedEmail)) nextErrors.email = 'Вкажіть коректний email';
    if (!password) nextErrors.password = 'Вкажіть пароль';
    if (Object.keys(nextErrors).length) { setErrors(nextErrors); return; }

    setErrors({});
    setLoading(true);
    const { error } = await auth.signInWithPassword({ email: normalizedEmail, password });
    if (error) {
      console.error('[LoginPage] Login error:', error);
      setErrors({ form: localizeApiError(error.message) });
    } else {
      showToast?.('Успішний вхід', 'success');
      onLogin();
    }
    setLoading(false);
  };

  return (
    <div className="max-w-[480px] mx-auto px-6 py-[60px]">
      <div className="bg-white shadow-sm rounded-3xl p-12 p-[24px]">
        <h1 className="text-4xl mb-2 text-center text-gray-900 font-semibold">Вхід</h1>
        <p className="text-center text-gray-600 mb-8">Увійдіть до свого облікового запису</p>
        <form onSubmit={handleSubmit} noValidate>
          <div className="mb-5">
            <label className="block text-sm text-gray-900 mb-2 font-medium">Email</label>
            <input type="email" className={inputClassName(!!errors.email)} placeholder="your@email.com" value={email} aria-invalid={!!errors.email} onChange={e => { setEmail(e.target.value); if (errors.email || errors.form) setErrors(prev => ({ ...prev, email: undefined, form: undefined })); }} />
            {errors.email && <p className="mt-2 text-sm text-red-600">{errors.email}</p>}
          </div>

          <div className="mb-5">
            <label className="block text-sm text-gray-900 mb-2 font-medium">Пароль</label>
            <div className="relative">
              <input type={showPassword ? 'text' : 'password'} className={`${inputClassName(!!errors.password)} pr-12`} placeholder="••••••••" value={password} aria-invalid={!!errors.password} onChange={e => { setPassword(e.target.value); if (errors.password || errors.form) setErrors(prev => ({ ...prev, password: undefined, form: undefined })); }} />
              <button type="button" onClick={() => setShowPassword(v => !v)} className="absolute right-0 top-0 h-full w-12 flex items-center justify-center bg-transparent border-0 text-gray-500 hover:text-gray-700 cursor-pointer" aria-label={showPassword ? 'Приховати пароль' : 'Показати пароль'}>
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
            {errors.password && <p className="mt-2 text-sm text-red-600">{errors.password}</p>}
          </div>

          <div className="text-right mt-2"><button type="button" className="text-[#007AFF] no-underline text-sm cursor-pointer bg-none border-none hover:text-[#0066CC]" onClick={() => onPageChange('forgot-password')}>Забули пароль?</button></div>
          {errors.form && <div className="mt-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">{errors.form}</div>}
          <button type="submit" disabled={loading} className="w-full px-4 py-4 bg-[#007AFF] hover:bg-[#0066CC] text-white border-none rounded-xl cursor-pointer transition-all duration-300 mt-6 disabled:opacity-50 disabled:cursor-not-allowed">{loading ? 'Вхід...' : 'Увійти'}</button>
        </form>
        <p className="text-center text-gray-600 mt-6">Немає облікового запису?{' '}<button className="text-[#007AFF] cursor-pointer bg-none border-none hover:text-[#0066CC]" onClick={() => onPageChange('register')}>Зареєструйтеся</button></p>
      </div>
    </div>
  );
}
