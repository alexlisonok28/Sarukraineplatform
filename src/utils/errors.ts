export const AUTH_REQUIRED_MESSAGE = 'Для виконання цієї дії необхідно увійти в систему';
export const SESSION_EXPIRED_MESSAGE = 'Сесія завершилася. Увійдіть у систему повторно';

const ERROR_MESSAGES: Record<string, string> = {
  'Unauthorized': AUTH_REQUIRED_MESSAGE,
  'Invalid email or password': 'Невірний email або пароль',
  'Login failed': 'Не вдалося виконати вхід. Спробуйте ще раз',
  'This email is already registered': 'Користувач із таким email вже зареєстрований',
  'Signup failed': 'Не вдалося завершити реєстрацію. Спробуйте ще раз',
  'Password update failed': 'Не вдалося змінити пароль. Спробуйте ще раз',
  'Backend did not confirm all participant changes': 'Сервер не підтвердив збереження всіх змін',
  'Forbidden': 'У вас немає прав для виконання цієї дії',
  'Competition not found': 'Змагання не знайдено',
  'Participant not found': 'Учасника не знайдено',
  'Dog not found': 'Собаку не знайдено',
  'File not found': 'Файл не знайдено',
  'Internal server error': 'Сталася внутрішня помилка сервера. Спробуйте ще раз',
};

export function localizeApiError(message: unknown, status?: number) {
  const raw = String(message || '').trim();
  if (status === 401) return AUTH_REQUIRED_MESSAGE;
  if (ERROR_MESSAGES[raw]) return ERROR_MESSAGES[raw];
  if (/request failed with status 401/i.test(raw)) return AUTH_REQUIRED_MESSAGE;
  if (/request failed with status 403/i.test(raw)) return ERROR_MESSAGES.Forbidden;
  if (/request failed with status 5\d\d/i.test(raw)) return 'Сервіс тимчасово недоступний. Спробуйте ще раз пізніше';
  return raw || 'Сталася помилка. Спробуйте ще раз';
}
