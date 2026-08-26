import { useEffect, useState } from 'react';
import { Toast } from '../App';
import { SESSION_EXPIRED_MESSAGE } from '../utils/errors';
import { CheckCircle2, XCircle, TriangleAlert, Info, X } from 'lucide-react';

type ToastContainerProps = {
  toasts: Toast[];
  onRemove: (id: string) => void;
};

export default function ToastContainer({ toasts, onRemove }: ToastContainerProps) {
  const [systemToasts, setSystemToasts] = useState<Toast[]>([]);

  useEffect(() => {
    const handleAuthRequired = () => {
      const id = `auth-${Date.now()}`;
      setSystemToasts(prev => [...prev.filter(item => !item.id.startsWith('auth-')), { id, message: SESSION_EXPIRED_MESSAGE, type: 'warning' }]);
      window.setTimeout(() => setSystemToasts(prev => prev.filter(item => item.id !== id)), 4000);
    };
    window.addEventListener('sar:auth-required', handleAuthRequired);
    return () => window.removeEventListener('sar:auth-required', handleAuthRequired);
  }, []);

  const iconComponents = {
    success: CheckCircle2,
    error: XCircle,
    warning: TriangleAlert,
    info: Info,
  };

  const styles = {
    success: 'bg-green-50 border-green-300 text-green-800',
    error: 'bg-red-50 border-red-300 text-red-800',
    warning: 'bg-yellow-50 border-yellow-300 text-yellow-800',
    info: 'bg-blue-50 border-blue-300 text-blue-800',
  };

  const visibleToasts = [...toasts, ...systemToasts];

  return (
    <div
      className="flex flex-col gap-3 items-end"
      style={{ position: 'fixed', right: 20, bottom: 20, top: 'auto', left: 'auto', zIndex: 1000, maxWidth: 'calc(100vw - 40px)' }}
    >
      {visibleToasts.map((toast) => {
        const IconComponent = iconComponents[toast.type];
        const isSystemToast = toast.id.startsWith('auth-');
        return (
          <div
            key={toast.id}
            className={`${styles[toast.type]} border rounded-xl px-5 py-4 w-full sm:w-auto min-w-0 sm:min-w-[300px] max-w-[400px] shadow-lg animate-[slideInRight_0.3s_ease] flex items-center gap-3`}
          >
            <IconComponent className="w-5 h-5 flex-shrink-0" />
            <span className="flex-1 font-medium">{toast.message}</span>
            <button
              className="bg-none border-none text-current opacity-60 cursor-pointer p-0 w-6 h-6 flex items-center justify-center flex-shrink-0 hover:opacity-100 transition-opacity"
              onClick={() => isSystemToast ? setSystemToasts(prev => prev.filter(item => item.id !== toast.id)) : onRemove(toast.id)}
              aria-label="Закрити повідомлення"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
