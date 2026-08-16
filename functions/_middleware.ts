// Cloudflare Pages middleware.
//
// Зачем этот файл нужен:
// Pages Functions сначала пропускают запрос через middleware, а уже потом
// вызывают конкретный API-обработчик. Здесь мы аккуратно нормализуем ответ
// страницы управления соревнованием.
//
// Причина бага:
// Для только что созданного соревнования поле `participants` может вообще
// отсутствовать в сохранённом JSON. Само соревнование при этом загружается
// успешно, но React-страница ожидает массив и вызывает `data.participants.forEach(...)`.
// Если `participants` отсутствует, JavaScript выбрасывает ошибку уже ПОСЛЕ того,
// как данные соревнования были получены. Поэтому пользователь видел корректную
// страницу и одновременно ложный toast «Не вдалося завантажити дані змагання».
//
// Правильное значение для соревнования без заявок — пустой массив `[]`.
// Middleware добавляет его только в успешный GET-ответ `/details` и никак не
// скрывает реальные ошибки API (403, 404, 500 и т.д.).

type PagesContext = {
  request: Request;
  next: () => Promise<Response>;
};

export async function onRequest(context: PagesContext): Promise<Response> {
  // Сначала даём существующему API выполнить запрос как обычно.
  const response = await context.next();

  const url = new URL(context.request.url);
  const isCompetitionDetailsRequest =
    context.request.method === 'GET' &&
    /^\/api\/competitions\/[^/]+\/details\/?$/.test(url.pathname);

  // Ничего не меняем для остальных запросов и для настоящих ошибок API.
  if (!isCompetitionDetailsRequest || !response.ok) {
    return response;
  }

  // Работаем только с JSON. Если формат ответа когда-нибудь изменится,
  // middleware безопасно пропустит его без модификации.
  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) {
    return response;
  }

  try {
    const data = await response.json() as Record<string, unknown>;

    // Новое соревнование ещё не имеет заявок. Для React это должен быть
    // пустой массив, а не undefined/null.
    if (!Array.isArray(data.participants)) {
      data.participants = [];
    }

    // Сохраняем исходный HTTP-статус и заголовки ответа.
    const headers = new Headers(response.headers);
    headers.set('Content-Type', 'application/json');

    return new Response(JSON.stringify(data), {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  } catch (error) {
    // Если успешный ответ неожиданно оказался невалидным JSON, не подменяем
    // проблему выдуманным результатом. Логируем её и возвращаем явную ошибку.
    console.error('[competition details middleware] Invalid JSON response:', error);
    return new Response(JSON.stringify({ error: 'Invalid competition response' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
