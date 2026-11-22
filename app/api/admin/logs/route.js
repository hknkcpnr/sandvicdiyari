import { NextResponse } from 'next/server';
import { getUserActivityLogs, clearAllActivityLogs } from '@/lib/activityLogger';
import { handleApiError } from '@/lib/security/errors';
import { getOptionalAuthFromRequest } from '@/lib/security/auth';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = searchParams.get('limit') || '150';
    const category = searchParams.get('category') || 'ALL';
    const search = searchParams.get('search') || '';

    const logs = await getUserActivityLogs({
      limit: parseInt(limit, 10) || 150,
      category,
      search,
    });

    const allLogs = await getUserActivityLogs({ limit: 1000, category: 'ALL' });
    const stats = {
      total: allLogs.length,
      orders: allLogs.filter((l) => l.category === 'ORDER').length,
      menu: allLogs.filter((l) => l.category === 'MENU').length,
      users: allLogs.filter((l) => l.category === 'USER').length,
      finance: allLogs.filter((l) => l.category === 'FINANCE').length,
      system: allLogs.filter((l) => l.category === 'SYSTEM').length,
    };

    return NextResponse.json({
      success: true,
      data: {
        logs,
        stats,
      },
    });
  } catch (error) {
    return handleApiError(error, '/api/admin/logs', request);
  }
}

export async function DELETE(request) {
  try {
    const auth = getOptionalAuthFromRequest(request);
    await clearAllActivityLogs();
    return NextResponse.json({
      success: true,
      message: 'İşlem geçmişi logları başarıyla temizlendi.',
    });
  } catch (error) {
    return handleApiError(error, '/api/admin/logs', request);
  }
}
