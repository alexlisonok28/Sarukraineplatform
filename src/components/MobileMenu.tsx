import { PageType } from '../App';
import { UserProfile } from '../types';
import { Trophy, Home, Scale, Users, FileText, Medal, BarChart3, Shield } from 'lucide-react';

type MobileMenuProps = {
  isOpen: boolean;
  isLoggedIn: boolean;
  userProfile: UserProfile | null;
  currentPage: PageType;
  onPageChange: (page: PageType) => void;
  onLogout: () => void;
};

export default function MobileMenu({
  isOpen,
  isLoggedIn,
  userProfile,
  currentPage,
  onPageChange,
  onLogout,
}: MobileMenuProps) {
  if (!isOpen) return null;

  const navItems = isLoggedIn
    ? [
        { page: 'cabinet' as PageType, Icon: Home, label: 'Кабінет' },
        ...(userProfile?.role === 'admin' ? [{ page: 'admin' as PageType, Icon: Shield, label: 'Адмін' }] : []),
        { page: 'competitions' as PageType, Icon: Trophy, label: 'Змагання' },
        { page: 'judges' as PageType, Icon: Scale, label: 'Судді' },
        ...(userProfile?.role !== 'organizer' ? [
          { page: 'teams' as PageType, Icon: Users, label: 'Команди' }
        ] : []),
        { page: 'documents' as PageType, Icon: FileText, label: 'Документи' },
        { page: 'results' as PageType, Icon: Medal, label: 'Результати' },
        { page: 'rating' as PageType, Icon: BarChart3, label: 'Рейтинг' },
      ]
    : [
        { page: 'landing' as PageType, Icon: Home, label: 'Головна' },
        { page: 'competitions' as PageType, Icon: Trophy, label: 'Змагання' },
        { page: 'judges' as PageType, Icon: Scale, label: 'Судді' },
        { page: 'teams' as PageType, Icon: Users, label: 'Команди' },
        { page: 'documents' as PageType, Icon: FileText, label: 'Документи' },
        { page: 'results' as PageType, Icon: Medal, label: 'Результати' },
      ];

  return (
    <div className="fixed top-[73px] left-0 right-0 bg-white border-b border-gray-200 p-5 shadow-lg animate-[slideDown_0.3s_ease] z-[99] md:hidden">
      <nav className="flex flex-col gap-2">
        {navItems.map((item) => (
          <button
            key={item.page}
            className={`w-full justify-start px-[18px] py-[14px] rounded-lg cursor-pointer transition-all duration-300 flex items-center gap-2 border
              ${
                currentPage === item.page
                  ? 'bg-[#007AFF] text-white border-transparent'
                  : 'bg-gray-50 border-gray-200 hover:bg-gray-100 hover:border-gray-300 text-gray-700'
              }`}
            onClick={() => onPageChange(item.page)}
          >
            <item.Icon className="w-4 h-4" /> {item.label}
          </button>
        ))}

        {isLoggedIn ? (
          <button
            className="block w-full mt-3 px-6 py-[10px] bg-[#007AFF] hover:bg-[#0066CC] text-white border-none rounded-lg cursor-pointer transition-all duration-300"
            onClick={onLogout}
          >
            Вийти
          </button>
        ) : (
          <>
            <button
              className="block w-full mt-3 px-6 py-[10px] bg-[#007AFF] hover:bg-[#0066CC] text-white border-none rounded-lg cursor-pointer transition-all duration-300"
              onClick={() => onPageChange('login')}
            >
              Увійти
            </button>
            <button
              className="block w-full mt-2 px-6 py-[10px] bg-white hover:bg-gray-50 text-gray-900 border-2 border-gray-300 hover:border-gray-400 rounded-lg cursor-pointer transition-all duration-300"
              onClick={() => onPageChange('register')}
            >
              Реєстрація
            </button>
          </>
        )}
      </nav>
    </div>
  );
}
