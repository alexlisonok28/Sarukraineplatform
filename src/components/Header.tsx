/*
 * ВЕРХНЕЕ МЕНЮ САЙТА
 * ------------------
 * Header — обычный React-компонент. Он получает данные через props и на их основе
 * решает, какие пункты меню показать.
 */
import { PageType } from '../App';
import { UserProfile } from '../types';
import { Trophy, Home, Scale, Users, FileText, Medal, BarChart3, Menu, Shield } from 'lucide-react';

type HeaderProps = {
  isLoggedIn: boolean;
  userProfile: UserProfile | null;
  currentPage: PageType;
  onPageChange: (page: PageType) => void;
  onLogout: () => void;
  onToggleMobileMenu: () => void;
  onHomeClick: () => void;
};

/**
 * Compact SAR Ukraine mark adapted specifically for the 40×40 header slot.
 * Inline SVG keeps it sharp on Retina/HiDPI screens and removes the old
 * production dependency on figma:asset, which could render as a broken image.
 */
const SarLogo = () => (
  <svg
    viewBox="0 0 160 160"
    width="40"
    height="40"
    role="img"
    aria-label="SAR Ukraine"
    className="block w-10 h-10"
  >
    <rect width="160" height="160" rx="28" fill="#F8FAFC" />

    {/* Forest silhouettes */}
    <path d="M18 96 34 68l-7 2 9-16 10 18-7-2 10 17-8-2 9 15H20l8-14-7 2 8-14-6 2Z" fill="#0A376D" />
    <path d="M36 92 54 57l-8 3 10-20 12 22-8-3 11 19-9-3 10 18H41l10-17-8 3 9-18-7 3Z" fill="#0A376D" />

    {/* Dog */}
    <path d="M55 101c7-10 14-20 20-31l10-18 4-17 12-20 5 3 2 27 11 4 15 8c6 3 9 6 10 11l-2 5-18 15c-5 4-10 5-16 4l-11-2-3 13-5 20-12 14-22-16-12-12 12-8Z" fill="#0A376D" />
    <path d="m106 46 7-18 9 6-4 17-12-5Z" fill="#0A376D" />
    <path d="m118 61 10 3-9 6-7-4 6-5Z" fill="#F8FAFC" />

    {/* Harness */}
    <path d="M60 92 90 109" stroke="#FFC629" strokeWidth="9" strokeLinecap="round" />
    <path d="m88 108 18 11" stroke="#FFC629" strokeWidth="9" strokeLinecap="round" />

    {/* Medical cross */}
    <path d="M53 104h9v-9h10v9h9v10h-9v9H62v-9h-9v-10Z" fill="#FFC629" />

    {/* Rubble/building */}
    <path d="m102 122 15-15 9 7 11-12 15 14v24h-8v-11h-7v11h-25l-10-7-13 9-12-3 11-11 14-6Z" fill="#0A376D" />
    <path d="m110 121 7-7 6 5-7 7-6-5Zm14 10 7-7 6 5-7 7-6-5Z" fill="#F8FAFC" />
  </svg>
);

export default function Header({
  isLoggedIn,
  userProfile,
  currentPage,
  onPageChange,
  onLogout,
  onToggleMobileMenu,
  onHomeClick,
}: HeaderProps) {
  const navItems = isLoggedIn
    ? [
        { page: 'cabinet' as PageType, Icon: Home, label: 'Кабінет' },
        ...(userProfile?.role === 'admin'
          ? [{ page: 'admin' as PageType, Icon: Shield, label: 'Адмін' }]
          : []),
        { page: 'competitions' as PageType, Icon: Trophy, label: 'Змагання' },
        ...(userProfile?.role !== 'organizer'
          ? [
              { page: 'judges' as PageType, Icon: Scale, label: 'Судді' },
              { page: 'teams' as PageType, Icon: Users, label: 'Команди' },
            ]
          : []),
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
    <header className="bg-white border-b border-gray-200 py-4 sticky top-0 z-[100]">
      <div className="max-w-[1400px] mx-auto px-6 flex justify-between items-center">
        <button
          type="button"
          aria-label="На головну"
          className="flex items-center gap-3 cursor-pointer bg-transparent border-none p-0"
          onClick={onHomeClick}
        >
          <SarLogo />
        </button>

        <button
          className="md:hidden bg-none border-none text-gray-900 cursor-pointer p-2"
          onClick={onToggleMobileMenu}
        >
          <Menu className="w-6 h-6" />
        </button>

        <nav className="hidden md:flex gap-1 items-center">
          {navItems.map((item) => (
            <button
              key={item.page}
              className={`px-[18px] py-[10px] rounded-lg cursor-pointer transition-all duration-300 flex items-center gap-2 border-none relative
                ${
                  currentPage === item.page
                    ? 'bg-blue-50 text-[#007AFF] after:absolute after:bottom-0 after:left-0 after:right-0 after:h-[2px] after:bg-[#007AFF]'
                    : 'bg-transparent text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                }`}
              onClick={() => onPageChange(item.page)}
            >
              <item.Icon className="w-4 h-4" /> {item.label}
            </button>
          ))}
        </nav>

        <div className="hidden md:flex gap-3 items-center">
          {isLoggedIn ? (
            <button
              className="px-6 py-[10px] bg-[#007AFF] hover:bg-[#0066CC] text-white border-none rounded-lg cursor-pointer transition-all duration-300"
              onClick={onLogout}
            >
              Вийти
            </button>
          ) : (
            <>
              <button
                className="px-6 py-[10px] bg-[#007AFF] hover:bg-[#0066CC] text-white border-none rounded-lg cursor-pointer transition-all duration-300"
                onClick={() => onPageChange('login')}
              >
                Увійти
              </button>
              <button
                className="px-6 py-[10px] bg-white hover:bg-gray-100 text-gray-900 border-2 border-gray-300 hover:border-gray-400 rounded-lg cursor-pointer transition-all duration-300"
                onClick={() => onPageChange('register')}
              >
                Реєстрація
              </button>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
