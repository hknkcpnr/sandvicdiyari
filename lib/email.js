import { Resend } from 'resend';
import nodemailer from 'nodemailer';

function cleanEnv(val) {
  return String(val || '')
    .trim()
    .replace(/^['"]+|['"]+$/g, '')
    .trim();
}

function getResendClient() {
  const envKey = cleanEnv(process.env.RESEND_API_KEY);
  if (!envKey) return null;
  return new Resend(envKey);
}

function getSmtpConfig() {
  const user = cleanEnv(process.env.SMTP_USER || process.env.GMAIL_USER);
  const pass = cleanEnv(process.env.SMTP_PASS || process.env.GMAIL_APP_PASSWORD).replace(/\s+/g, '');
  const host = cleanEnv(process.env.SMTP_HOST) || 'smtp.gmail.com';
  const primaryPort = Number(cleanEnv(process.env.SMTP_PORT)) || 465;
  const senderName = cleanEnv(process.env.SMTP_FROM_NAME) || 'Sandviç Diyarı';
  const senderEmail = cleanEnv(process.env.SMTP_FROM_EMAIL) || user;

  if (!user || !pass) return null;
  return { user, pass, host, primaryPort, senderName, senderEmail };
}

/**
 * Sandviç Diyarı - Güvenli E-Posta Gönderim Servisi
 * Gmail / Özel SMTP (465 + 587 STARTTLS yedeği) ve Resend API sunucularını destekler.
 */
function createSmtpTransporter({ host, port, user, pass }) {
  const isSecure = port === 465;
  return nodemailer.createTransport({
    host,
    port,
    secure: isSecure,
    requireTLS: !isSecure,
    connectionTimeout: 8000,
    greetingTimeout: 8000,
    socketTimeout: 12000,
    auth: {
      user,
      pass
    },
    tls: {
      rejectUnauthorized: false
    }
  });
}

function buildHtmlTemplate({
  userName,
  code,
  pageTitle,
  introText,
  codeLabel,
  secondaryNote
}) {
  return `
    <!DOCTYPE html>
    <html lang="tr">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${pageTitle}</title>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f7f7f5; margin: 0; padding: 24px; color: #1c1917; }
        .container { max-width: 540px; margin: 0 auto; background: #ffffff; border-radius: 24px; overflow: hidden; border: 1px solid #e7e5e4; box-shadow: 0 4px 20px rgba(0,0,0,0.05); }
        .header { background: #1c1917; padding: 28px 24px; text-align: center; }
        .header h1 { color: #f59e0b; margin: 0; font-size: 22px; font-weight: 900; letter-spacing: -0.5px; }
        .header p { color: #a8a29e; margin: 6px 0 0 0; font-size: 12px; }
        .content { padding: 32px 28px; }
        .greeting { font-size: 16px; font-weight: 800; color: #1c1917; margin-bottom: 12px; }
        .text { font-size: 14px; line-height: 1.6; color: #57534e; margin-bottom: 24px; }
        .code-box { background: #fef3c7; border: 2px dashed #f59e0b; border-radius: 16px; padding: 20px; text-align: center; margin: 24px 0; }
        .code-label { font-size: 11px; text-transform: uppercase; font-weight: 800; letter-spacing: 1px; color: #92400e; margin-bottom: 6px; }
        .code-value { font-size: 36px; font-weight: 900; letter-spacing: 8px; color: #78350f; font-family: monospace; }
        .note { font-size: 12px; color: #78716c; line-height: 1.5; border-top: 1px solid #f5f5f4; padding-top: 18px; margin-top: 24px; }
        .footer { background: #f5f5f4; padding: 18px; text-align: center; font-size: 11px; color: #a8a29e; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>🥪 SANDVİÇ DİYARI</h1>
          <p>Torbalı • Sıcak & Hızlı Gurme Paket Servis</p>
        </div>
        <div class="content">
          <div class="greeting">Merhaba ${userName || 'Değerli Müşterimiz'},</div>
          <div class="text">
            ${introText}
          </div>

          <div class="code-box">
            <div class="code-label">${codeLabel}</div>
            <div class="code-value">${code}</div>
          </div>

          <div class="note">
            ⏱️ <strong>Süre Uyarısı:</strong> Bu doğrulama kodu güvenlik sebebiyle <strong>30 dakika</strong> boyunca geçerlidir.<br>
            🔒 ${secondaryNote}
          </div>
        </div>
        <div class="footer">
          Sandviç Diyarı Sipariş Portalı • Torbalı Mah. Hüseyin Kurtuldu Sok. No:32 Torbalı / İZMİR
        </div>
      </div>
    </body>
    </html>
  `;
}

async function sendEmail({ toEmail, subject, plainText, htmlContent }) {
  let lastSmtpError = null;

  // 1. ÖNCELİK: SMTP (Nodemailer / Gmail / Kurumsal E-Posta)
  const smtp = getSmtpConfig();
  if (smtp) {
    const portsToTry = smtp.primaryPort === 465 ? [465, 587] : [smtp.primaryPort];
    for (const port of portsToTry) {
      try {
        const transporter = createSmtpTransporter({
          host: smtp.host,
          port,
          user: smtp.user,
          pass: smtp.pass
        });
        const info = await transporter.sendMail({
          from: `"${smtp.senderName}" <${smtp.senderEmail}>`,
          to: toEmail,
          subject,
          text: plainText,
          html: htmlContent
        });
        return { success: true, provider: 'smtp', port, messageId: info.messageId };
      } catch (smtpErr) {
        lastSmtpError = smtpErr;
        console.error('[SMTP Error]', {
          port,
          code: smtpErr?.code,
          responseCode: smtpErr?.responseCode,
          message: smtpErr?.message
        });
        // Kimlik doğrulama (şifre) hatasında alternatif porta geçmeye gerek yok
        if (smtpErr?.code === 'EAUTH' || smtpErr?.responseCode === 535) {
          break;
        }
      }
    }
  }

  // 2. ALTERNATİF: RESEND API (Resend.com bulut servisi)
  const resend = getResendClient();
  if (resend) {
    try {
      const fromAddress = cleanEnv(process.env.RESEND_FROM_EMAIL) || 'Sandviç Diyarı <onboarding@resend.dev>';
      const res = await resend.emails.send({
        from: fromAddress,
        to: [toEmail],
        subject,
        text: plainText,
        html: htmlContent
      });

      if (res?.data?.id || res?.id) {
        return { success: true, provider: 'resend', messageId: res.data?.id || res.id };
      }

      if (res?.error) {
        console.error('[Resend Error]', res.error);
      }
    } catch (resendErr) {
      console.warn('[Resend API Warning]', resendErr.message || resendErr);
    }
  }

  // 3. Fallback — hassas bilgi sızdırmadan sebep kodu döndür
  const reason =
    lastSmtpError?.code === 'EAUTH' || lastSmtpError?.responseCode === 535
      ? 'SMTP_AUTH_FAILED'
      : lastSmtpError
      ? 'SMTP_CONNECTION_FAILED'
      : 'NO_ACTIVE_EMAIL_PROVIDER';

  return { success: false, simulated: true, reason };
}

/**
 * Şifre Sıfırlama E-Postası Gönderir (SMTP veya Resend API)
 */
export async function sendPasswordResetEmail({ toEmail, userName, resetCode }) {
  const htmlContent = buildHtmlTemplate({
    userName,
    code: resetCode,
    pageTitle: 'Şifre Sıfırlama Kodu',
    introText:
      'Sandviç Diyarı hesabınız için şifre sıfırlama talebinde bulundunuz. Aşağıdaki 6 haneli doğrulama kodunu şifre yenileme ekranına girerek yeni şifrenizi belirleyebilirsiniz:',
    codeLabel: 'Şifre Sıfırlama Doğrulama Kodunuz',
    secondaryNote: 'Bu talebi siz gerçekleştirmediyseniz, hesabınız güvendedir; bu e-postayı dikkate almayınız.'
  });
  const subject = `🥪 Sandviç Diyarı - Şifre Sıfırlama Kodunuz: ${resetCode}`;
  const plainText = `Merhaba ${userName || ''},\n\nSandviç Diyarı şifre sıfırlama kodunuz: ${resetCode}\n\nBu kod 30 dakika geçerlidir.`;

  return sendEmail({ toEmail, subject, plainText, htmlContent });
}

/**
 * Yeni Kayıt E-Posta Doğrulama Kodu Gönderir (SMTP veya Resend API)
 */
export async function sendEmailVerificationCode({ toEmail, userName, verificationCode }) {
  const htmlContent = buildHtmlTemplate({
    userName,
    code: verificationCode,
    pageTitle: 'E-Posta Doğrulama Kodu',
    introText:
      'Sandviç Diyarı ailesine hoş geldiniz! Üyeliğinizi hemen aktifleştirmek ve sipariş verebilmek için aşağıdaki 6 haneli doğrulama kodunu kayıt ekranına giriniz:',
    codeLabel: 'E-Posta Doğrulama Kodunuz',
    secondaryNote: 'Bu hesabı siz oluşturmadıysanız bu e-postayı güvenle yok sayabilirsiniz.'
  });
  const subject = `🥪 Sandviç Diyarı - E-Posta Doğrulama Kodunuz: ${verificationCode}`;
  const plainText = `Merhaba ${userName || ''},\n\nSandviç Diyarı üyeliğinizi tamamlamak için 6 haneli doğrulama kodunuz: ${verificationCode}\n\nBu kod 30 dakika geçerlidir.`;

  return sendEmail({ toEmail, subject, plainText, htmlContent });
}
