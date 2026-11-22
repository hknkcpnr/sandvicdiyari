import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { rawPrisma } from '@/lib/prisma';
import { logSecurityEvent, getClientIp } from '@/lib/security/errors';
import { getOptionalAuthFromRequest } from '@/lib/security/auth';

const logsDir = path.resolve(process.cwd(), 'data');
const logsPath = path.resolve(logsDir, 'activity_logs.json');
const dbPath = path.resolve(logsDir, 'db.json');

function readLogs() {
  try {
    if (fs.existsSync(logsPath)) {
      const raw = fs.readFileSync(logsPath, 'utf8');
      const data = JSON.parse(raw);
      if (Array.isArray(data)) return data;
      if (Array.isArray(data.activityLogs)) return data.activityLogs;
    }
  } catch (err) {
    console.warn('Error reading activity_logs.json:', err.message);
  }

  try {
    if (fs.existsSync(dbPath)) {
      const raw = fs.readFileSync(dbPath, 'utf8');
      const data = JSON.parse(raw);
      if (Array.isArray(data.activityLogs) && data.activityLogs.length > 0) {
        return data.activityLogs;
      }
    }
  } catch {}

  return [];
}

function writeLogs(logs) {
  const cleanLogs = Array.isArray(logs) ? logs.slice(0, 500) : [];
  try {
    if (!fs.existsSync(logsDir)) {
      fs.mkdirSync(logsDir, { recursive: true });
    }
    fs.writeFileSync(logsPath, JSON.stringify(cleanLogs, null, 2), 'utf8');
  } catch (err) {
    console.error('Activity logs write error:', err);
  }

  // data/db.json ile senkron tut
  try {
    if (fs.existsSync(dbPath)) {
      const raw = fs.readFileSync(dbPath, 'utf8');
      const dbData = JSON.parse(raw);
      dbData.activityLogs = cleanLogs;
      fs.writeFileSync(dbPath, JSON.stringify(dbData, null, 2), 'utf8');
    }
  } catch {}
}

/**
 * Kullanıcı İşlem Logu Kaydetme Fonksiyonu
 * @param {Object} params
 * @param {Object} [params.user] - İşlemi yapan kullanıcı { id, name, email, role, roleName }
 * @param {string} params.action - İşlem kodu (Örn: 'ORDER_DELETE', 'ORDER_STATUS', 'PRODUCT_ADD', 'STOCK_UPDATE', vb.)
 * @param {string} params.category - 'ORDER' | 'MENU' | 'USER' | 'FINANCE' | 'SYSTEM'
 * @param {string} params.level - 'INFO' | 'WARN' | 'CRITICAL'
 * @param {string} params.message - Net ve anlaşılır Türkçe açıklama
 * @param {Object} [params.details] - Ek veri nesnesi
 * @param {Request} [params.req] - İstek nesnesi (IP, auth cookie/token ve endpoint tespiti için)
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
  let endpoint = '/panel';
  try {
    if (req?.url) {
      endpoint = new URL(req.url, 'http://localhost').pathname;
    }
  } catch {}

  let auth = null;
  try {
    if (req) {
      auth = getOptionalAuthFromRequest(req);
    }
  } catch {}

  const userName =
    user?.name ||
    user?.userName ||
    auth?.name ||
    user?.email ||
    auth?.email ||
    (auth?.type === 'admin' ? 'Yönetici' : 'Sistem / Otomatik');

  const userRole =
    user?.role ||
    user?.roleName ||
    auth?.role ||
    (auth?.email === 'admin' ? 'Süper Yönetici' : auth?.type === 'admin' ? 'Yönetici' : 'Personel');

  const userEmail = user?.email || auth?.email || '';
  const userId = user?.id || auth?.sub || '';

  const logEntry = {
    id: logId,
    timestamp,
    action,
    category: String(category).toUpperCase(),
    level: String(level).toUpperCase(),
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

  // 1. Yerel data/activity_logs.json'a kaydet (hızlı, güvenli, silinmez)
  try {
    const existingLogs = readLogs();
    existingLogs.unshift(logEntry);
    writeLogs(existingLogs);
  } catch (err) {
    console.error('Activity log kaydedilemedi:', err);
  }

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
  let logs = readLogs();

  // Eğer henüz log yoksa başlangıç bildirimi oluştur
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
    writeLogs(logs);
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
  writeLogs([]);
  return true;
}
