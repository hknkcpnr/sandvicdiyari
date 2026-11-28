import { handleApiError, jsonSuccess, parseJsonBody } from '@/lib/security/errors';
import { checkRateLimit } from '@/lib/security/auth';
import { validateEmailAddressServer } from '@/lib/serverEmailVerify';

export async function POST(request) {
  try {
    checkRateLimit(request, {
      keyPrefix: 'POST:/api/auth/check-email',
      maxRequests: 30,
      windowMs: 60 * 1000
    });

    const body = await parseJsonBody(request);
    const result = await validateEmailAddressServer(body?.email || '');

    return jsonSuccess({ data: result });
  } catch (error) {
    return handleApiError(error, '/api/auth/check-email', request);
  }
}
