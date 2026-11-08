import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import {
  ValidationError,
  handleApiError,
  jsonSuccess,
  logSecurityEvent
} from '@/lib/security/errors';
import { checkRateLimit } from '@/lib/security/auth';
import { validateImageMagicBytes } from '@/lib/security/validation';

export async function POST(request) {
  try {
    checkRateLimit(request, {
      keyPrefix: 'POST:/api/upload',
      maxRequests: 15,
      windowMs: 60 * 1000
    });

    const formData = await request.formData();
    const file = formData.get('file');

    if (!file || typeof file.arrayBuffer !== 'function') {
      throw new ValidationError('Lütfen geçerli bir görsel dosyası seçin.');
    }

    const buffer = Buffer.from(await file.arrayBuffer());

    // Validate size (max 5MB)
    if (buffer.length > 5 * 1024 * 1024) {
      throw new ValidationError('Görsel boyutu en fazla 5MB olabilir.');
    }

    // Determine safe extension (SVG removed from direct upload to prevent stored XSS)
    const originalName = path.basename(String(file.name || 'image.jpg'));
    const ext = path.extname(originalName).toLowerCase() || '.jpg';
    const allowedExts = ['.jpg', '.jpeg', '.png', '.webp', '.gif'];

    if (!allowedExts.includes(ext)) {
      throw new ValidationError(
        'Güvenlik nedeniyle yalnızca gerçek JPG, PNG, WEBP veya GIF görsel formatları desteklenmektedir.'
      );
    }

    // Binary Magic-Byte Signature Verification
    if (!validateImageMagicBytes(buffer, ext)) {
      logSecurityEvent({
        level: 'CRITICAL',
        category: 'XSS',
        endpoint: '/api/upload',
        message: `Sahte uzantılı dosya yükleme girişimi engellendi (${originalName}).`
      });
      throw new ValidationError(
        'Dosya içeriği (Magic Bytes) uzantısıyla eşleşmiyor. Yalnızca gerçek görsel dosyaları yüklenebilir.'
      );
    }

    let publicUrl = '';
    try {
      const uploadDir = path.join(process.cwd(), 'public', 'uploads');
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
      }

      const safeBaseName = path
        .basename(originalName, ext)
        .replace(/[^a-zA-Z0-9_-]/g, '_')
        .slice(0, 40);
      const randomToken = crypto.randomBytes(4).toString('hex');
      const fileName = `product_${Date.now()}_${randomToken}_${safeBaseName}${ext}`;
      const filePath = path.join(uploadDir, fileName);

      // Ensure resolved path stays strictly inside uploadDir (Path Traversal protection)
      if (path.resolve(filePath).startsWith(path.resolve(uploadDir))) {
        fs.writeFileSync(filePath, buffer);
        publicUrl = `/uploads/${fileName}`;
      }
    } catch (fsErr) {
      // Vercel serverless / read-only filesystem fallback: data URI
      const mime =
        ext === '.png'
          ? 'image/png'
          : ext === '.webp'
          ? 'image/webp'
          : ext === '.gif'
          ? 'image/gif'
          : 'image/jpeg';
      publicUrl = `data:${mime};base64,${buffer.toString('base64')}`;
    }

    if (!publicUrl) {
      const mime =
        ext === '.png'
          ? 'image/png'
          : ext === '.webp'
          ? 'image/webp'
          : ext === '.gif'
          ? 'image/gif'
          : 'image/jpeg';
      publicUrl = `data:${mime};base64,${buffer.toString('base64')}`;
    }

    return jsonSuccess(
      {
        message: 'Görsel güvenlik kontrolünden geçti ve başarıyla yüklendi.',
        url: publicUrl
      },
      201
    );
  } catch (error) {
    return handleApiError(error, '/api/upload', request);
  }
}
