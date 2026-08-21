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

// Exact 56×56 JPG provided by the user, embedded unchanged so production does not
// depend on figma:asset or an external file path.
const SAR_LOGO_DATA_URI = 'data:image/jpeg;base64,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';

export default function Header({ isLoggedIn, userProfile, currentPage, onPageChange, onLogout, onToggleMobileMenu, onHomeClick }: HeaderProps) {
  const navItems = isLoggedIn
    ? [
        { page: 'cabinet' as PageType, Icon: Home, label: 'Кабінет' },
        ...(userProfile?.role === 'admin' ? [{ page: 'admin' as PageType, Icon: Shield, label: 'Адмін' }] : []),
        { page: 'competitions' as PageType, Icon: Trophy, label: 'Змагання' },
        ...(userProfile?.role !== 'organizer' ? [{ page: 'judges' as PageType, Icon: Scale, label: 'Судді' }, { page: 'teams' as PageType, Icon: Users, label: 'Команди' }] : []),
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
        <button type="button" aria-label="На головну" className="flex items-center gap-3 cursor-pointer bg-transparent border-none p-0" onClick={onHomeClick}>
          <img src={SAR_LOGO_DATA_URI} alt="SAR Ukraine" width={56} height={56} className="block w-14 h-14 object-contain" />
        </button>
        <button className="md:hidden bg-none border-none text-gray-900 cursor-pointer p-2" onClick={onToggleMobileMenu}><Menu className="w-6 h-6" /></button>
        <nav className="hidden md:flex gap-1 items-center">
          {navItems.map((item) => <button key={item.page} className={`px-[18px] py-[10px] rounded-lg cursor-pointer transition-all duration-300 flex items-center gap-2 border-none relative ${currentPage === item.page ? 'bg-blue-50 text-[#007AFF] after:absolute after:bottom-0 after:left-0 after:right-0 after:h-[2px] after:bg-[#007AFF]' : 'bg-transparent text-gray-600 hover:text-gray-900 hover:bg-gray-100'}`} onClick={() => onPageChange(item.page)}><item.Icon className="w-4 h-4" /> {item.label}</button>)}
        </nav>
        <div className="hidden md:flex gap-3 items-center">
          {isLoggedIn ? <button className="px-6 py-[10px] bg-[#007AFF] hover:bg-[#0066CC] text-white border-none rounded-lg cursor-pointer transition-all duration-300" onClick={onLogout}>Вийти</button> : <><button className="px-6 py-[10px] bg-[#007AFF] hover:bg-[#0066CC] text-white border-none rounded-lg cursor-pointer transition-all duration-300" onClick={() => onPageChange('login')}>Увійти</button><button className="px-6 py-[10px] bg-white hover:bg-gray-100 text-gray-900 border-2 border-gray-300 hover:border-gray-400 rounded-lg cursor-pointer transition-all duration-300" onClick={() => onPageChange('register')}>Реєстрація</button></>}
        </div>
      </div>
    </header>
  );
}
