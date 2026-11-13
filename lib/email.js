import nodemailer from 'nodemailer';

/**
 * Sandviç Diyarı - Güvenli E-Posta Gönderim Servisi
 * Gmail SMTP ve Özel SMTP sunucularını tam destekler.
 */
function getTransporter() {
  const user = process.env.SMTP_USER || process.env.GMAIL_USER || '';
  const pass = process.env.SMTP_PASS || process.env.GMAIL_APP_PASSWORD || '';
  const host = process.env.SMTP_HOST || 'smtp.gmail.com';
  const port = Number(process.env.SMTP_PORT) || 465;
  const isSecure = port === 465;

  if (!user || !pass) {
    return null;
  }

  return nodemailer.createTransport({
    host,
    port,
    secure: isSecure,
    auth: {
      user,
      pass
    },
    tls: {
      rejectUnauthorized: false
    }
  });
}

/**
 * Şifre Sıfırlama E-Postası Gönderir (HTML Şablonlu)
 * @param {Object} params
 * @param {string} params.toEmail - Alıcı e-posta adresi
 * @param {string} params.userName - Müşterinin adı soyadı
 * @param {string} params.resetCode - 6 Haneli doğrulama kodu
 * @returns {Promise<{ success: boolean, simulated?: boolean, messageId?: string }>}
 */
export async function sendPasswordResetEmail({ toEmail, userName, resetCode }) {
  const transporter = getTransporter();

  if (!transporter) {
    console.info(
      `[E-Posta Servisi] SMTP_USER ve SMTP_PASS .env içinde henüz tanımlı değil. (Simülasyon Modu: ${toEmail} -> Kod: ${resetCode})`
    );
    return { success: false, simulated: true, reason: 'SMTP_NOT_CONFIGURED' };
  }

  const senderName = process.env.SMTP_FROM_NAME || 'Sandviç Diyarı';
  const senderEmail = process.env.SMTP_FROM_EMAIL || process.env.SMTP_USER || process.env.GMAIL_USER;

  const htmlContent = `
    <!DOCTYPE html>
    <html lang="tr">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Şifre Sıfırlama Kodu</title>
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
            Sandviç Diyarı hesabınız için şifre sıfırlama talebinde bulundunuz. Aşağıdaki 6 haneli doğrulama kodunu şifre yenileme ekranına girerek yeni şifrenizi belirleyebilirsiniz:
          </div>

          <div class="code-box">
            <div class="code-label">Şifre Sıfırlama Doğrulama Kodunuz</div>
            <div class="code-value">${resetCode}</div>
          </div>

          <div class="note">
            ⏱️ <strong>Süre Uyarısı:</strong> Bu doğrulama kodu güvenlik sebebiyle <strong>10 dakika</strong> boyunca geçerlidir.<br>
            🔒 Bu talebi siz gerçekleştirmediyseniz, hesabınız güvendedir; bu e-postayı dikkate almayınız.
          </div>
        </div>
        <div class="footer">
          Sandviç Diyarı Sipariş Portalı • Torbalı Mah. Hüseyin Kurtuldu Sok. No:32 Torbalı / İZMİR
        </div>
      </div>
    </body>
    </html>
  `;

  try {
    const info = await transporter.sendMail({
      from: `"${senderName}" <${senderEmail}>`,
      to: toEmail,
      subject: `🥪 Sandviç Diyarı - Şifre Sıfırlama Kodunuz: ${resetCode}`,
      text: `Merhaba ${userName || ''},\n\nSandviç Diyarı şifre sıfırlama kodunuz: ${resetCode}\n\nBu kod 10 dakika geçerlidir.`,
      html: htmlContent
    });

    return { success: true, messageId: info.messageId };
  } catch (err) {
    console.error('[E-Posta Gönderim Hatası]', err);
    return { success: false, error: err.message };
  }
}

