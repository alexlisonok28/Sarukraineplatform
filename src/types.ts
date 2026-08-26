/*
 * ОБЩИЕ TYPESCRIPT-ТИПЫ ПРОЕКТА
 * -----------------------------
 * Этот файл не выполняет код. Он описывает форму данных, с которыми работает React.
 */

export type Dog = {
  id: string;
  userId?: string;
  name: string;
  birth: string;
  gender: 'male' | 'female';
  pedigree: string;
  chip: string;
  workbook?: string;
  breed?: string;       // Название оставляем для совместимости со старыми записями.
  breedId?: number;     // ID породы из справочника breeds.
};

export type Breed = {
  id: number;
  name: string;
  fciGroupNumber?: number;
  breedNumber?: number;
};

export type UserRole = 'user' | 'organizer' | 'admin';

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

export type Competition = {
  id: string;
  name: string;
  date?: string;
  startDate?: string;
  endDate?: string;
  location: string;
  level: string;
  description: string;
  maxParticipants: number;
  organizerId: string;
  organizerName?: string;
  status: 'planned' | 'registration_open' | 'registration_closed' | 'completed' | 'cancelled';
  participants?: {
    userId: string;
    dogId: string;
    status: 'registered' | 'confirmed' | 'rejected';
    date?: string;
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
