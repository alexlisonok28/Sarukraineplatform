import { useState } from 'react';
import { PageType, Toast } from '../../App';
import { auth } from '../../utils/auth';

type LoginPageProps = {
  onLogin: () => void;
  onPageChange: (page: PageType) => void;
  showToast?: (message: string, type: Toast['type']) => void;
};

const inputClassName = "w-full px-4 py-[14px] bg-white border border-gray-300 rounded-[10px] text-gray-900 transition-all duration-300 placeholder:text-gray-400 focus:outline-none focus:border-[#007AFF]";

export default function LoginPage({ onLogin, onPageChange, showToast }: LoginPageProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    console.log('[LoginPage] Attempting login for:', email);
    
    const { data, error } = await auth.signInWithPassword({
        email,
        password
    });

    if (error) {
        console.error('[LoginPage] Login error:', error);
        showToast?.(error.message, 'error');
    } else {
        console.log('[LoginPage] ✓ Login successful!', {
          userId: data.user?.id,
          email: data.user?.email,
          hasSession: !!data.session,
          hasAccessToken: !!data.session?.access_token,
          tokenLength: data.session?.access_token?.length
        });
        
        // Verify session is stored
        setTimeout(async () => {
          const { data: checkData } = await auth.getSession();
          console.log('[LoginPage] Session check after login:', {
            hasSession: !!checkData.session,
            userId: checkData.session?.user?.id
          });
        }, 100);
        
        showToast?.('Успішний вхід', 'success');
        onLogin();
    }
    setLoading(false);
  };

  return (
    <div className="max-w-[480px] mx-auto px-6 py-[60px]">
      <div className="bg-white shadow-sm rounded-3xl p-12 p-[24px]">
        <h1 className="text-4xl mb-2 text-center text-gray-900 font-semibold">
          Вхід
        </h1>
        <p className="text-center text-gray-600 mb-8">Увійдіть до свого облікового запису</p>

        <form onSubmit={handleSubmit}>
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

          <div className="text-right mt-2">
            <button
              type="button"
              className="text-[#007AFF] no-underline text-sm cursor-pointer bg-none border-none hover:text-[#0066CC]"
              onClick={() => onPageChange('forgot-password')}
            >
              Забули пароль?
            </button>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full px-4 py-4 bg-[#007AFF] hover:bg-[#0066CC] text-white border-none rounded-xl cursor-pointer transition-all duration-300 mt-6 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Вхід...' : 'Увійти'}
          </button>
        </form>

        <p className="text-center text-gray-600 mt-6">
          Немає облікового запису?{' '}
          <button
            className="text-[#007AFF] cursor-pointer bg-none border-none hover:text-[#0066CC]"
            onClick={() => onPageChange('register')}
          >
            Зареєструйтеся
          </button>
        </p>
      </div>
    </div>
  );
}