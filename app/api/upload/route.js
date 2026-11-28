import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import {
  ValidationError,
  handleApiError,
  jsonSuccess,
  logSecurityEvent
} from '@/lib/security/errors';
import { checkRateLimit, assertProtectedApiAccess } from '@/lib/security/auth';
import { validateImageMagicBytes } from '@/lib/security/validation';

export async function POST(request) {
  try {
    assertProtectedApiAccess(request, { endpoint: '/api/upload' });

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

    let outputBuffer = buffer;
    let outputExt = ext;
    if (ext !== '.gif' && buffer.length > 150 * 1024) {
      try {
        const sharpMod = await import('sharp');
        const sharp = sharpMod.default || sharpMod;
        const optimized = await sharp(buffer)
          .rotate()
          .resize({ width: 1600, height: 1600, fit: 'inside', withoutEnlargement: true })
          .webp({ quality: 82 })
          .toBuffer();
        if (optimized && optimized.length > 0 && optimized.length < buffer.length) {
          outputBuffer = optimized;
          outputExt = '.webp';
        }
      } catch {
        // sharp optional fallback: keep original verified buffer
      }
    }

    let publicUrl = '';
    let storageProvider = 'local';
    const mime =
      outputExt === '.png'
        ? 'image/png'
        : outputExt === '.webp'
        ? 'image/webp'
        : outputExt === '.gif'
        ? 'image/gif'
        : 'image/jpeg';

    const safeBaseName = path
      .basename(originalName, ext)
      .replace(/[^a-zA-Z0-9_-]/g, '_')
      .slice(0, 40);
    const randomToken = crypto.randomBytes(4).toString('hex');
    const fileName = `product_${Date.now()}_${randomToken}_${safeBaseName}${outputExt}`;

    // 1. Önce Supabase Storage yapılandırılmışsa doğrudan bulut deposuna yükle (Vercel için kalıcı CDN URL)
    const supabaseUrl = (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '')
      .trim()
      .replace(/\/+$/, '');
    const supabaseKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
    const supabaseBucket = (process.env.SUPABASE_STORAGE_BUCKET || 'uploads').trim() || 'uploads';

    if (supabaseUrl && supabaseKey) {
      try {
        const uploadRes = await fetch(
          `${supabaseUrl}/storage/v1/object/${encodeURIComponent(supabaseBucket)}/${encodeURIComponent(fileName)}`,
          {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${supabaseKey}`,
              apikey: supabaseKey,
              'Content-Type': mime,
              'x-upsert': 'true'
            },
            body: outputBuffer
          }
        );
        if (uploadRes.ok) {
          publicUrl = `${supabaseUrl}/storage/v1/object/public/${encodeURIComponent(supabaseBucket)}/${encodeURIComponent(fileName)}`;
          storageProvider = 'supabase';
        } else {
          console.warn('Supabase Storage upload warning:', uploadRes.status);
        }
      } catch (supErr) {
        console.warn('Supabase Storage upload fallback:', supErr.message);
      }
    }

    // 2. Yerel disk veya Data URI yedeği
    if (!publicUrl) {
      try {
        const uploadDir = path.join(process.cwd(), 'public', 'uploads');
        if (!fs.existsSync(uploadDir)) {
          fs.mkdirSync(uploadDir, { recursive: true });
        }

        const filePath = path.join(uploadDir, fileName);

        // Ensure resolved path stays strictly inside uploadDir (Path Traversal protection)
        if (path.resolve(filePath).startsWith(path.resolve(uploadDir))) {
          fs.writeFileSync(filePath, outputBuffer);
          publicUrl = `/uploads/${fileName}`;
          storageProvider = 'local';
        }
      } catch (fsErr) {
        publicUrl = `data:${mime};base64,${outputBuffer.toString('base64')}`;
        storageProvider = 'data_uri';
      }
    }

    if (!publicUrl) {
      publicUrl = `data:${mime};base64,${outputBuffer.toString('base64')}`;
      storageProvider = 'data_uri';
    }

    return jsonSuccess(
      {
        message: 'Görsel güvenlik kontrolünden geçti ve başarıyla yüklendi.',
        url: publicUrl,
        provider: storageProvider
      },
      201
    );
  } catch (error) {
    return handleApiError(error, '/api/upload', request);
  }
}
