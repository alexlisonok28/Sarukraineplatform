/*
 * ОБЩИЕ TYPESCRIPT-ТИПЫ ПРОЕКТА
 * -----------------------------
 * Этот файл не выполняет код. Он описывает форму данных, с которыми работает React.
 *
 * TypeScript использует эти типы, чтобы редактор заранее подсвечивал ошибки:
 * например, если мы случайно обратимся к competition.foo, которого не существует.
 *
 * Знак ? после имени поля означает: поле необязательное и может отсутствовать.
 */

// Собака, которую пользователь добавляет в своём кабинете.
export type Dog = {
  id: string;            // Уникальный идентификатор записи.
  userId?: string;       // Владелец собаки.
  name: string;
  birth: string;
  gender: 'male' | 'female'; // Разрешены только эти два строковых значения.
  pedigree: string;
  chip: string;
  workbook?: string;
  breed?: string;
};

// Роль определяет доступные пользователю действия в интерфейсе и API.
// ВАЖНО: серверная схема также знает роль 'judge'. При дальнейшем развитии
// frontend-тип необходимо держать синхронизированным с backend.
export type UserRole = 'user' | 'organizer' | 'admin';

// Профиль пользователя — данные, которые показываются в кабинете и используются
// для проверки роли в интерфейсе.
export type UserProfile = {
  id: string;
  email: string;
  role: UserRole;
  name?: string;
  phone?: string;
  city?: string;
  club?: string;
  team?: string;
};

// Основная модель соревнования.
export type Competition = {
  id: string;
  name: string;

  // date осталось для совместимости со старыми данными.
  // Новые записи используют startDate/endDate.
  date?: string;
  startDate?: string;
  endDate?: string;

  location: string;
  level: string;
  description: string;
  maxParticipants: number;

  // Кто создал/организует соревнование. По organizerId frontend решает,
  // может ли текущий organizer управлять конкретным соревнованием.
  organizerId: string;
  organizerName?: string;

  status: 'open' | 'closed' | 'completed';

  // participants может отсутствовать у нового соревнования, поэтому поле optional.
  participants?: {
    userId: string;
    dogId: string;
    status: 'registered' | 'confirmed' | 'rejected';
    date?: string;

    // Результат появляется после проведения соревнования.
    results?: {
      search?: number;
      obedience?: number;
      total?: number;
      place?: number;
      score?: number;
      qualification?: string;
      notes?: string;
      title?: string;
    };
  }[];

  judges?: string[];
  categories?: string[];
};
