import { connect } from 'cloudflare:sockets';

/**
 * Минимальный SMTP-клиент для Cloudflare Pages Functions.
 *
 * Почему здесь нет nodemailer:
 * Cloudflare Functions работают не как обычный Node.js-сервер. Для исходящего
 * SMTP-соединения мы используем нативный TCP Socket API Cloudflare и общаемся
 * с SMTP-сервером напрямую.
 */
export type SmtpConfig = {
  host: string;
  port: number;
  user: string;
  password: string;
};

export type MailMessage = {
  to: string;
  subject: string;
  html: string;
  fromName?: string;
};

const encoder = new TextEncoder();
const decoder = new TextDecoder();

function utf8ToBase64(value: string) {
  const bytes = encoder.encode(value);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function wrapBase64(value: string, width = 76) {
  const parts: string[] = [];
  for (let i = 0; i < value.length; i += width) parts.push(value.slice(i, i + width));
  return parts.join('\r\n');
}

/**
 * Отправляет одно HTML-письмо через SMTP over TLS (обычно порт 465).
 * Функция намеренно небольшая: нам нужен только сценарий восстановления пароля.
 */
export async function sendSmtpMail(config: SmtpConfig, message: MailMessage) {
  const socket = connect(
    { hostname: config.host, port: config.port },
    { secureTransport: 'on', allowHalfOpen: false },
  );

  await socket.opened;

  const reader = socket.readable.getReader();
  const writer = socket.writable.getWriter();
  let responseBuffer = '';

  const readResponse = async (allowedCodes: number[]) => {
    while (true) {
      const { value, done } = await reader.read();
      if (done) throw new Error('SMTP server closed the connection unexpectedly');

      responseBuffer += decoder.decode(value, { stream: true });
      const lines = responseBuffer.split(/\r?\n/);
      responseBuffer = lines.pop() || '';

      for (const line of lines) {
        // SMTP multiline responses look like "250-..." and finish with "250 ...".
        const finalLine = line.match(/^(\d{3})\s/);
        if (!finalLine) continue;

        const code = Number(finalLine[1]);
        if (!allowedCodes.includes(code)) {
          throw new Error(`SMTP error ${code}: ${line}`);
        }
        return line;
      }
    }
  };

  const sendLine = async (line: string, allowedCodes: number[]) => {
    await writer.write(encoder.encode(`${line}\r\n`));
    return readResponse(allowedCodes);
  };

  try {
    await readResponse([220]);
    await sendLine('EHLO sarukraineplatform.pages.dev', [250]);

    // AUTH LOGIN: сервер по очереди запрашивает логин и пароль в Base64.
    await sendLine('AUTH LOGIN', [334]);
    await sendLine(btoa(config.user), [334]);
    await sendLine(btoa(config.password), [235]);

    await sendLine(`MAIL FROM:<${config.user}>`, [250]);
    await sendLine(`RCPT TO:<${message.to}>`, [250, 251]);
    await sendLine('DATA', [354]);

    const fromName = message.fromName || 'SAR Ukraine';
    const encodedSubject = `=?UTF-8?B?${utf8ToBase64(message.subject)}?=`;
    const encodedFromName = `=?UTF-8?B?${utf8ToBase64(fromName)}?=`;
    const encodedBody = wrapBase64(utf8ToBase64(message.html));

    const rawMessage = [
      `From: ${encodedFromName} <${config.user}>`,
      `To: <${message.to}>`,
      `Subject: ${encodedSubject}`,
      `Date: ${new Date().toUTCString()}`,
      'MIME-Version: 1.0',
      'Content-Type: text/html; charset=UTF-8',
      'Content-Transfer-Encoding: base64',
      '',
      encodedBody,
      '.',
      '',
    ].join('\r\n');

    await writer.write(encoder.encode(rawMessage));
    await readResponse([250]);
    await sendLine('QUIT', [221]);
  } finally {
    try { writer.releaseLock(); } catch {}
    try { reader.releaseLock(); } catch {}
    try { await socket.close(); } catch {}
  }
}
