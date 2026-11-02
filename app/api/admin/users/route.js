import { db } from '@/lib/db';
import { orm } from '@/lib/orm/postgresEngine';
import {
  ValidationError,
  handleApiError,
  jsonSuccess,
  parseJsonBody
} from '@/lib/security/errors';
import { sanitizeEmailOrUsername, sanitizePhone, sanitizeText } from '@/lib/security/validation';

export async function GET(request) {
  try {
    const adminUsers = orm.executePrepared(
      'AdminUser',
      'SELECT',
      'SELECT "id", "name", "email", "phone", "role_id", "role_name", "is_active", "created_at" FROM "admin_users" ORDER BY "created_at" ASC',
      [],
      () => db.getAdminUsers()
    );
    const roles = orm.executePrepared(
      'Role',
      'SELECT',
      'SELECT * FROM "roles" ORDER BY "is_system" DESC',
      [],
      () => db.getRoles()
    );
    const customers = orm.executePrepared(
      'User',
      'SELECT',
      'SELECT "id", "name", "email", "phone", "address" FROM "users"',
      [],
      () => db.getUsers()
    );

    return jsonSuccess({
      data: {
        adminUsers,
        roles,
        customers
      }
    });
  } catch (error) {
    return handleApiError(error, '/api/admin/users', request);
  }
}

export async function POST(request) {
  try {
    const body = await parseJsonBody(request);
    const entityType = sanitizeText(body.entityType || 'user', 32, 'entityType', '/api/admin/users');

    if (entityType === 'role') {
      const roleName = sanitizeText(body.name, 120, 'Rol Adı', '/api/admin/users');
      if (!roleName) {
        throw new ValidationError('Rol adı zorunludur.');
      }
      const rolePayload = {
        ...body,
        name: roleName,
        color: sanitizeText(body.color || 'blue', 32, 'Renk', '/api/admin/users'),
        description: sanitizeText(body.description || '', 400, 'Açıklama', '/api/admin/users'),
        permissions: Array.isArray(body.permissions)
          ? body.permissions.map(p => sanitizeText(p, 64, 'Yetki', '/api/admin/users'))
          : ['orders']
      };

      const savedRole = orm.executePrepared(
        'Role',
        body.id ? 'UPDATE' : 'INSERT',
        body.id
          ? 'UPDATE "roles" SET "name" = $1, "color" = $2, "description" = $3, "permissions" = $4::jsonb, "updated_at" = NOW() WHERE "id" = $5 RETURNING *'
          : 'INSERT INTO "roles" ("id", "name", "code", "color", "description", "permissions") VALUES ($1, $2, $3, $4, $5, $6::jsonb) RETURNING *',
        [rolePayload.name, rolePayload.color, rolePayload.description],
        () => db.saveRole(rolePayload)
      );

      return jsonSuccess({
        message: 'Rol modeli başarıyla kaydedildi.',
        data: {
          role: savedRole,
          roles: db.getRoles(),
          adminUsers: db.getAdminUsers()
        }
      });
    }

    // Save admin/staff user
    const name = sanitizeText(body.name, 150, 'Ad Soyad', '/api/admin/users');
    const email = sanitizeEmailOrUsername(body.email, true, '/api/admin/users');
    const phone = sanitizePhone(body.phone || '', false);

    if (!name || !email) {
      throw new ValidationError('Ad Soyad ve E-Posta / Kullanıcı Adı zorunludur.');
    }

    const userPayload = {
      ...body,
      name,
      email,
      phone,
      roleId: sanitizeText(body.roleId || 'role_super_admin', 64, 'roleId', '/api/admin/users')
    };

    const savedUser = orm.executePrepared(
      'AdminUser',
      body.id ? 'UPDATE' : 'INSERT',
      body.id
        ? 'UPDATE "admin_users" SET "name" = $1, "email" = $2, "phone" = $3, "role_id" = $4, "is_active" = $5, "updated_at" = NOW() WHERE "id" = $6 RETURNING *'
        : 'INSERT INTO "admin_users" ("id", "name", "email", "phone", "pass_hash", "role_id", "role_name", "is_active") VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *',
      [name, email, phone, userPayload.roleId],
      () => db.saveAdminUser(userPayload)
    );

    return jsonSuccess({
      message: 'Kullanıcı başarıyla kaydedildi.',
      data: {
        user: savedUser,
        adminUsers: db.getAdminUsers(),
        roles: db.getRoles()
      }
    });
  } catch (error) {
    return handleApiError(error, '/api/admin/users', request);
  }
}

export async function DELETE(request) {
  try {
    const { searchParams } = new URL(request.url);
    const entityType = sanitizeText(searchParams.get('type') || 'user', 32, 'type', '/api/admin/users');
    const id = sanitizeText(searchParams.get('id') || '', 64, 'id', '/api/admin/users');

    if (!id) {
      throw new ValidationError('Silinecek kayıt ID belirtilmedi.');
    }

    if (entityType === 'role') {
      orm.executePrepared(
        'Role',
        'DELETE',
        'DELETE FROM "roles" WHERE "id" = $1 RETURNING "id"',
        [id],
        () => db.deleteRole(id)
      );
      return jsonSuccess({
        message: 'Rol modeli silindi.',
        data: {
          roles: db.getRoles(),
          adminUsers: db.getAdminUsers(),
          customers: db.getUsers()
        }
      });
    }

    if (entityType === 'customer') {
      orm.executePrepared(
        'User',
        'DELETE',
        'DELETE FROM "users" WHERE "id" = $1 RETURNING "id"',
        [id],
        () => db.deleteUser(id)
      );
      return jsonSuccess({
        message: 'Müşteri kaydı silindi.',
        data: {
          customers: db.getUsers(),
          adminUsers: db.getAdminUsers(),
          roles: db.getRoles()
        }
      });
    }

    orm.executePrepared(
      'AdminUser',
      'DELETE',
      'DELETE FROM "admin_users" WHERE "id" = $1 RETURNING "id"',
      [id],
      () => db.deleteAdminUser(id)
    );

    return jsonSuccess({
      message: 'Kullanıcı silindi.',
      data: {
        adminUsers: db.getAdminUsers(),
        roles: db.getRoles(),
        customers: db.getUsers()
      }
    });
  } catch (error) {
    return handleApiError(error, '/api/admin/users', request);
  }
}
