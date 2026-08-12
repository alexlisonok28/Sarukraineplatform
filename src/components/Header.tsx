/*
 * ВЕРХНЕЕ МЕНЮ САЙТА
 * ------------------
 * Header — обычный React-компонент. Он получает данные через props и на их основе
 * решает, какие пункты меню показать.
 *
 * Главное здесь:
 * - isLoggedIn сообщает, вошёл ли пользователь;
 * - userProfile содержит роль пользователя;
 * - currentPage нужен для подсветки активного пункта;
 * - onPageChange — функция из App.tsx, которая переключает страницу.
 *
 * Компонент сам не загружает данные и не меняет базу: он только отображает меню.
 */
import { PageType } from '../App';
import { UserProfile } from '../types';
import { Trophy, Home, Scale, Users, FileText, Medal, BarChart3, Menu, Shield } from 'lucide-react';
import { ImageWithFallback } from './figma/ImageWithFallback';
import logo from 'figma:asset/369da5dbacae8c0f58b86860e229dbcb695eb5fa.png';

// Props — параметры, которые родительский компонент App передаёт в Header.
type HeaderProps = {
  isLoggedIn: boolean;
  userProfile: UserProfile | null;
  currentPage: PageType;
  onPageChange: (page: PageType) => void;
  onLogout: () => void;
  onToggleMobileMenu: () => void;
  onHomeClick: () => void;
};

export default function Header({
  isLoggedIn,
  userProfile,
  currentPage,
  onPageChange,
  onLogout,
  onToggleMobileMenu,
  onHomeClick,
}: HeaderProps) {
  /*
   * Формируем меню динамически.
   * React позволяет использовать обычные JS-массивы: ниже мы собираем список
   * пунктов, а затем через .map() превращаем каждый пункт в кнопку.
   */
  const navItems = isLoggedIn
    ? [
        { page: 'cabinet' as PageType, Icon: Home, label: 'Кабінет' },

        // Административный пункт видит только пользователь с ролью admin.
        ...(userProfile?.role === 'admin'
          ? [{ page: 'admin' as PageType, Icon: Shield, label: 'Адмін' }]
          : []),

        { page: 'competitions' as PageType, Icon: Trophy, label: 'Змагання' },

        // В текущей логике organizer не видит пункты Судді и Команди.
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
        // Меню для посетителя, который ещё не вошёл.
        { page: 'landing' as PageType, Icon: Home, label: 'Головна' },
        { page: 'competitions' as PageType, Icon: Trophy, label: 'Змагання' },
        { page: 'judges' as PageType, Icon: Scale, label: 'Судді' },
        { page: 'teams' as PageType, Icon: Users, label: 'Команди' },
        { page: 'documents' as PageType, Icon: FileText, label: 'Документи' },
        { page: 'results' as PageType, Icon: Medal, label: 'Результати' },
      ];

  // return() описывает HTML-подобную разметку JSX, которую React покажет на странице.
  return (
    <header className="bg-white border-b border-gray-200 py-4 sticky top-0 z-[100]">
      <div className="max-w-[1400px] mx-auto px-6 flex justify-between items-center">
        {/* Клик по логотипу возвращает на главную/в кабинет. */}
        <div
          className="flex items-center gap-3 cursor-pointer"
          onClick={onHomeClick}
        >
          <ImageWithFallback
            src={logo}
            alt="SAR Ukraine Logo"
            className="w-10 h-10 rounded-[10px] object-cover"
          />
        </div>

        {/* На маленьких экранах показываем кнопку открытия MobileMenu. */}
        <button
          className="md:hidden bg-none border-none text-gray-900 cursor-pointer p-2"
          onClick={onToggleMobileMenu}
        >
          <Menu className="w-6 h-6" />
        </button>

        {/* На desktop каждый объект navItems превращается в кнопку меню. */}
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
            // Авторизованному пользователю показываем только выход.
            <button
              className="px-6 py-[10px] bg-[#007AFF] hover:bg-[#0066CC] text-white border-none rounded-lg cursor-pointer transition-all duration-300"
              onClick={onLogout}
            >
              Вийти
            </button>
          ) : (
            // Гостю показываем вход и регистрацию.
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
