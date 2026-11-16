import { rawPrisma } from '@/lib/prisma';
import {
  ValidationError,
  handleApiError,
  jsonSuccess,
  parseJsonBody
} from '@/lib/security/errors';
import { assertProtectedApiAccess, checkRateLimit } from '@/lib/security/auth';
import { sanitizeText } from '@/lib/security/validation';

export const dynamic = 'force-dynamic';

const FINANCE_KEY = 'cash_transactions';

async function readTransactions() {
  if (!rawPrisma || !rawPrisma.systemSetting) return [];
  const rec = await rawPrisma.systemSetting.findUnique({
    where: { key: FINANCE_KEY }
  });
  if (rec && Array.isArray(rec.value)) {
    return rec.value;
  }
  return [];
}

async function writeTransactions(list) {
  if (!rawPrisma || !rawPrisma.systemSetting) return;
  await rawPrisma.systemSetting.upsert({
    where: { key: FINANCE_KEY },
    update: { value: list },
    create: { key: FINANCE_KEY, value: list }
  });
}

export async function GET(request) {
  try {
    assertProtectedApiAccess(request, { endpoint: '/api/finance' });
    checkRateLimit(request, {
      keyPrefix: 'GET:/api/finance',
      maxRequests: 60,
      windowMs: 60 * 1000
    });
    const list = await readTransactions();
    return jsonSuccess({
      count: list.length,
      data: list
    });
  } catch (error) {
    return handleApiError(error, '/api/finance', request);
  }
}

export async function POST(request) {
  try {
    assertProtectedApiAccess(request, { endpoint: '/api/finance' });
    checkRateLimit(request, {
      keyPrefix: 'POST:/api/finance',
      maxRequests: 30,
      windowMs: 60 * 1000
    });

    const body = await parseJsonBody(request);
    const type = body.type === 'in' ? 'in' : body.type === 'out' ? 'out' : null;
    if (!type) {
      throw new ValidationError('İşlem türü "in" (Giren) veya "out" (Çıkan) olmalıdır.');
    }

    const amount = Number(body.amount);
    if (!Number.isFinite(amount) || amount <= 0 || amount > 10000000) {
      throw new ValidationError('Geçerli bir tutar giriniz.');
    }

    const category = sanitizeText(body.category || 'Genel', 80, 'Kategori', '/api/finance');
    const description = sanitizeText(body.description || '', 300, 'Açıklama', '/api/finance');
    const paymentSource = sanitizeText(body.paymentSource || 'Nakit Kasa', 60, 'Ödeme Kaynağı', '/api/finance');
    const createdBy = sanitizeText(body.createdBy || 'Yönetici', 100, 'İşlemi Yapan', '/api/finance');
    const date = sanitizeText(body.date || new Date().toISOString().slice(0, 10), 32, 'Tarih', '/api/finance');

    if (!description || description.length < 2) {
      throw new ValidationError('Lütfen en az 2 karakterlik bir açıklama giriniz.');
    }

    const newItem = {
      id: `fin_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      type,
      amount: Math.round(amount * 100) / 100,
      category,
      description,
      paymentSource,
      createdBy,
      date,
      createdAt: new Date().toISOString()
    };

    const existing = await readTransactions();
    const updated = [newItem, ...existing];
    await writeTransactions(updated);

    return jsonSuccess(
      {
        message: type === 'in' ? 'Kasa girişi kaydedildi.' : 'Kasa çıkışı (gider) kaydedildi.',
        data: newItem
      },
      201
    );
  } catch (error) {
    return handleApiError(error, '/api/finance', request);
  }
}

export async function DELETE(request) {
  try {
    assertProtectedApiAccess(request, { endpoint: '/api/finance' });
    checkRateLimit(request, {
      keyPrefix: 'DELETE:/api/finance',
      maxRequests: 30,
      windowMs: 60 * 1000
    });

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) {
      throw new ValidationError('Silinecek işlem ID zorunludur.');
    }

    const existing = await readTransactions();
    const filtered = existing.filter((item) => String(item.id) !== String(id));
    await writeTransactions(filtered);

    return jsonSuccess({
      message: 'Kasa kaydı silindi.'
    });
  } catch (error) {
    return handleApiError(error, '/api/finance', request);
  }
}
