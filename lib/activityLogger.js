import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { rawPrisma } from '@/lib/prisma';
import { logSecurityEvent, getClientIp } from '@/lib/security/errors';

const dbPath = path.resolve(process.cwd(), 'data', 'db.json');

function readDbLogs() {
  try {
    if (!fs.existsSync(dbPath)) return [];
    const raw = fs.readFileSync(dbPath, 'utf8');
    const data = JSON.parse(raw);
    if (!Array.isArray(data.activityLogs)) {
      return [];
    }
    return data.activityLogs;
  } catch {
    return [];
  }
}

function writeDbLogs(logs) {
  try {
    if (!fs.existsSync(dbPath)) return;
    const raw = fs.readFileSync(dbPath, 'utf8');
    const data = JSON.parse(raw);
    data.activityLogs = logs.slice(0, 500); // En son 500 işlem logunu sakla
    fs.writeFileSync(dbPath, JSON.stringify(data, null, 2), 'utf8');
  } catch (err) {
    console.error('Activity log kaydedilemedi:', err);
  }
}

/**
 * Kullanıcı İşlem Logu Kaydetme Fonksiyonu
 * @param {Object} params
 * @param {Object} [params.user] - İşlemi yapan kullanıcı { id, name, email, roleName }
 * @param {string} params.action - İşlem kodu (Örn: 'ORDER_DELETE', 'ORDER_STATUS', 'PRODUCT_ADD', 'LOGIN', vb.)
 * @param {string} params.category - 'ORDER' | 'MENU' | 'USER' | 'FINANCE' | 'SYSTEM'
 * @param {string} params.level - 'INFO' | 'WARN' | 'CRITICAL'
 * @param {string} params.message - Net Türkçe açıklama
 * @param {Object} [params.details] - Ek veri nesnesi
 * @param {Request} [params.req] - İstek nesnesi (IP ve endpoint tespiti için)
 */
export async function logUserActivity({
  user = null,
  action = 'SYSTEM_ACTION',
  category = 'SYSTEM',
  level = 'INFO',
  message = '',
  details = null,
  req = null,
}) {
  const logId = `act_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;
  const timestamp = new Date().toISOString();
  const ip = req ? getClientIp(req) : '127.0.0.1';
  const endpoint = req?.url ? new URL(req.url, 'http://localhost').pathname : '/panel';

  const userName = user?.name || user?.email || (user?.type === 'admin' ? 'Yönetici' : 'Sistem / Otomatik');
  const userRole = user?.role || user?.roleName || (user?.email === 'admin' ? 'Süper Yönetici' : 'Personel');
  const userEmail = user?.email || '';
  const userId = user?.id || '';

  const logEntry = {
    id: logId,
    timestamp,
    action,
    category: category.toUpperCase(),
    level: level.toUpperCase(),
    message,
    user: {
      id: userId,
      name: userName,
      role: userRole,
      email: userEmail,
    },
    ip,
    endpoint,
    details: details || null,
  };

  // 1. Yerel data/db.json'a kaydet (hızlı okuma ve taşınabilirlik)
  try {
    const existingLogs = readDbLogs();
    existingLogs.unshift(logEntry);
    writeDbLogs(existingLogs);
  } catch {}

  // 2. PostgreSQL Prisma SecurityAuditLog tablosuna kaydet
  try {
    if (rawPrisma?.securityAuditLog?.create) {
      await rawPrisma.securityAuditLog.create({
        data: {
          id: logId,
          timestamp: new Date(),
          level: logEntry.level,
          category: logEntry.category,
          endpoint,
          ip,
          message: `[${userName} - ${userRole}] ${message}`,
          details: {
            action,
            user: logEntry.user,
            details: details || null,
          },
        },
      });
    }
  } catch {}

  // 3. Ring buffer error memory log
  try {
    logSecurityEvent({
      level: logEntry.level === 'CRITICAL' ? 'ERROR' : logEntry.level === 'WARN' ? 'WARN' : 'INFO',
      category: logEntry.category,
      endpoint,
      ip,
      message: `[${userName} - ${userRole}] ${message}`,
      details: logEntry.details,
    });
  } catch {}

  return logEntry;
}

/**
 * Logları getirme fonksiyonu
 */
export async function getUserActivityLogs({ limit = 100, category = 'ALL', search = '' } = {}) {
  let logs = readDbLogs();

  // Eğer db.json'da henüz log yoksa başlangıç örnekleri oluştur
  if (logs.length === 0) {
    logs = [
      {
        id: 'act_init_1',
        timestamp: new Date().toISOString(),
        action: 'SYSTEM_START',
        category: 'SYSTEM',
        level: 'INFO',
        message: 'Kullanıcı işlem ve aktivite denetim günlüğü başarıyla başlatıldı.',
        user: { id: 'sys', name: 'Sistem Yöneticisi', role: 'Süper Yönetici', email: 'admin' },
        ip: '127.0.0.1',
        endpoint: '/panel',
      },
    ];
    writeDbLogs(logs);
  }

  // Filtreler
  let filtered = logs;
  if (category && category !== 'ALL') {
    filtered = filtered.filter((l) => l.category === category.toUpperCase());
  }

  if (search && search.trim()) {
    const q = search.toLowerCase().trim();
    filtered = filtered.filter(
      (l) =>
        (l.message || '').toLowerCase().includes(q) ||
        (l.user?.name || '').toLowerCase().includes(q) ||
        (l.user?.role || '').toLowerCase().includes(q) ||
        (l.action || '').toLowerCase().includes(q) ||
        (l.ip || '').toLowerCase().includes(q)
    );
  }

  return filtered.slice(0, Number(limit) || 100);
}

/**
 * Logları temizleme
 */
export function clearAllActivityLogs() {
  writeDbLogs([]);
  return true;
}
