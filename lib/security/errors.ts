import { NextResponse } from 'next/server';
import crypto from 'crypto';
import type { ApiErrorResponse, SecurityAuditLog } from '@/types/database';

/**
 * Base Application Error with HTTP status code and machine-readable error code
 */
export class AppError extends Error {
  public readonly statusCode: number;
  public readonly errorCode: string;
  public readonly isOperational: boolean;
  public readonly details?: unknown;

  constructor(
    message: string,
    statusCode = 500,
    errorCode = 'INTERNAL_SERVER_ERROR',
    details?: unknown,
    isOperational = true
  ) {
    super(message);
    Object.setPrototypeOf(this, new.target.prototype);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.errorCode = errorCode;
    this.details = details;
    this.isOperational = isOperational;
  }
}

export class BadRequestError extends AppError {
  constructor(message = 'Geçersiz istek formatı.', details?: unknown) {
    super(message, 400, 'BAD_REQUEST', details);
  }
}

export class ValidationError extends AppError {
  constructor(message = 'Gönderilen veriler doğrulama kurallarına uymuyor.', details?: unknown) {
    super(message, 400, 'VALIDATION_ERROR', details);
  }
}

export class AuthenticationError extends AppError {
  constructor(message = 'Kimlik doğrulama başarısız veya oturum süresi dolmuş.') {
    super(message, 401, 'AUTHENTICATION_FAILED');
  }
}

export class AuthorizationError extends AppError {
  constructor(message = 'Bu işlem için yetkiniz bulunmamaktadır.') {
    super(message, 403, 'FORBIDDEN_ACCESS');
  }
}

export class NotFoundError extends AppError {
  constructor(message = 'İstenen kayıt bulunamadı.') {
    super(message, 404, 'RESOURCE_NOT_FOUND');
  }
}

export class ConflictError extends AppError {
  constructor(message = 'Bu kayıt zaten mevcut veya durum çakışması oluştu.') {
    super(message, 409, 'RESOURCE_CONFLICT');
  }
}

export class RateLimitError extends AppError {
  public readonly retryAfterSeconds: number;
  constructor(message = 'Çok fazla istek gönderdiniz. Lütfen biraz bekleyin.', retryAfterSeconds = 60) {
    super(message, 429, 'RATE_LIMIT_EXCEEDED', { retryAfterSeconds });
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

export class DatabaseError extends AppError {
  constructor(message = 'Veritabanı işlemi sırasında bir hata oluştu.', details?: unknown) {
    super(message, 500, 'DATABASE_ORM_ERROR', details);
  }
}

// ============================================================================
// SECURITY AUDIT RING BUFFER (In-Memory + ORM Synced)
// ============================================================================
const MAX_AUDIT_LOGS = 200;
const securityAuditStore: SecurityAuditLog[] = [
  {
    id: 'audit_init_1',
    timestamp: new Date().toISOString(),
    level: 'INFO',
    category: 'SYSTEM',
    endpoint: '/api/health/db',
    ip: '127.0.0.1',
    message: 'MySQL ORM Katmanı, TypeScript Tip Güvenliği ve Merkezi Hata Yönetimi başlatıldı.'
  }
];

export function logSecurityEvent(params: {
  level: SecurityAuditLog['level'];
  category: SecurityAuditLog['category'];
  endpoint: string;
  ip?: string;
  message: string;
  details?: Record<string, unknown>;
}): SecurityAuditLog {
  const entry: SecurityAuditLog = {
    id: `aud_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`,
    timestamp: new Date().toISOString(),
    level: params.level,
    category: params.category,
    endpoint: params.endpoint,
    ip: params.ip || '127.0.0.1',
    message: params.message,
    details: params.details
  };

  securityAuditStore.unshift(entry);
  if (securityAuditStore.length > MAX_AUDIT_LOGS) {
    securityAuditStore.length = MAX_AUDIT_LOGS;
  }
  return entry;
}

export function getSecurityAuditLogs(limit = 50): SecurityAuditLog[] {
  return securityAuditStore.slice(0, limit);
}

/**
 * Extracts client IP safely from Request headers
 */
export function getClientIp(request?: Request): string {
  if (!request || !request.headers) return '127.0.0.1';
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    return forwarded.split(',')[0].trim().slice(0, 64);
  }
  const realIp = request.headers.get('x-real-ip');
  if (realIp) {
    return realIp.trim().slice(0, 64);
  }
  return '127.0.0.1';
}

/**
 * Standard Security Headers attached to every API response
 */
export const SECURITY_HEADERS: Record<string, string> = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'X-XSS-Protection': '1; mode=block',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Cache-Control': 'no-store, max-age=0'
};

/**
 * Safely parses JSON body from a Request with size and syntax validation
 */
export async function parseJsonBody<T = Record<string, unknown>>(
  request: Request,
  maxBytes = 256 * 1024
): Promise<T> {
  let rawText = '';
  try {
    rawText = await request.text();
  } catch {
    throw new BadRequestError('İstek gövdesi (Request Body) okunamadı.');
  }

  if (!rawText || !rawText.trim()) {
    throw new BadRequestError('İstek gövdesi boş olamaz (JSON bekleniyor).');
  }

  if (Buffer.byteLength(rawText, 'utf8') > maxBytes) {
    throw new BadRequestError(`İstek boyutu çok büyük (Maksimum ${Math.round(maxBytes / 1024)}KB).`);
  }

  try {
    const parsed = JSON.parse(rawText);
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
      throw new BadRequestError('Geçerli bir JSON nesnesi gönderilmelidir.');
    }
    return parsed as T;
  } catch (err) {
    if (err instanceof AppError) throw err;
    throw new BadRequestError('Geçersiz JSON formatı gönderildi.');
  }
}

/**
 * Centralized API Error Handler that converts any exception into a safe, structured NextResponse
 */
export function handleApiError(
  error: unknown,
  endpoint = '/api/unknown',
  request?: Request
): NextResponse<ApiErrorResponse> {
  const requestId = `req_${crypto.randomBytes(6).toString('hex')}`;
  const ip = getClientIp(request);

  if (error instanceof AppError) {
    if (error.statusCode >= 400) {
      logSecurityEvent({
        level: error.statusCode >= 500 ? 'ERROR' : 'WARN',
        category:
          error instanceof AuthenticationError || error instanceof AuthorizationError
            ? 'AUTH'
            : error instanceof RateLimitError
            ? 'RATE_LIMIT'
            : 'VALIDATION',
        endpoint,
        ip,
        message: `[${error.errorCode}] ${error.message}`
      });
    }

    const headers: Record<string, string> = {
      ...SECURITY_HEADERS,
      'X-Request-Id': requestId
    };
    if (error instanceof RateLimitError) {
      headers['Retry-After'] = String(error.retryAfterSeconds);
    }

    return NextResponse.json(
      {
        success: false,
        error: error.message,
        errorCode: error.errorCode,
        statusCode: error.statusCode,
        requestId,
        timestamp: new Date().toISOString(),
        ...(error.details ? { details: error.details } : {})
      },
      { status: error.statusCode, headers }
    );
  }

  // Handle legacy business logic errors thrown from db methods
  const rawMessage = error instanceof Error ? error.message : 'Beklenmeyen bir sunucu hatası oluştu.';
  const isKnownBusinessError =
    rawMessage.includes('stok') ||
    rawMessage.includes('tükendi') ||
    rawMessage.includes('durum') ||
    rawMessage.includes('silinemez') ||
    rawMessage.includes('mevcut') ||
    rawMessage.includes('pasif') ||
    rawMessage.includes('bulunamadı');

  const statusCode = isKnownBusinessError ? 400 : 500;
  const errorCode = isKnownBusinessError ? 'BUSINESS_RULE_VIOLATION' : 'INTERNAL_SERVER_ERROR';

  logSecurityEvent({
    level: isKnownBusinessError ? 'WARN' : 'ERROR',
    category: isKnownBusinessError ? 'VALIDATION' : 'SYSTEM',
    endpoint,
    ip,
    message: `[${errorCode}] ${rawMessage}`
  });

  // Never leak stack traces to the client
  const safeMessage =
    statusCode === 500 && process.env.NODE_ENV === 'production'
      ? 'Sunucu tarafında beklenmeyen bir hata oluştu. Lütfen tekrar deneyin.'
      : rawMessage;

  return NextResponse.json(
    {
      success: false,
      error: safeMessage,
      errorCode,
      statusCode,
      requestId,
      timestamp: new Date().toISOString()
    },
    {
      status: statusCode,
      headers: {
        ...SECURITY_HEADERS,
        'X-Request-Id': requestId
      }
    }
  );
}

/**
 * Helper to create a standardized success NextResponse with security headers
 */
export function jsonSuccess<T extends Record<string, unknown>>(
  payload: T,
  status = 200
): NextResponse {
  const requestId = `req_${crypto.randomBytes(6).toString('hex')}`;
  return NextResponse.json(
    {
      success: true,
      ...payload,
      requestId
    },
    {
      status,
      headers: {
        ...SECURITY_HEADERS,
        'X-Request-Id': requestId
      }
    }
  );
}

