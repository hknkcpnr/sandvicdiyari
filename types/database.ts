/**
 * Sandwich Diyarı - Core TypeScript Domain & ORM Schema Types
 */

export type ProductStockStatus = 'in_stock' | 'low_stock' | 'out_of_stock' | 'closed';

export type ProductCategory = 'menu' | 'sandwich' | 'sides' | 'drinks' | string;

export interface ProductOptionChoice {
  label: string;
  price?: number;
}

export interface ProductOptionGroup {
  name: string;
  type: 'radio' | 'checkbox' | 'select';
  required?: boolean;
  choices: (string | ProductOptionChoice)[];
}

export interface RecipeItem {
  ingredientId: string;
  quantity: number;
}

export interface Product {
  id: number | string;
  name: string;
  desc: string;
  price: number;
  category: ProductCategory;
  badge?: string | null;
  image: string;
  calories?: string | null;
  prepTime?: string | null;
  rating?: number;
  stock: number;
  trackStock: boolean;
  isAvailable: boolean;
  criticalThreshold: number;
  status?: ProductStockStatus;
  options?: ProductOptionGroup[];
  recipe?: RecipeItem[];
  createdAt?: string;
  updatedAt?: string;
}

export interface Ingredient {
  id: string;
  name: string;
  category: string;
  unit: string;
  stock: number;
  criticalThreshold: number;
  icon: string;
  description?: string;
}

export type OrderStatus =
  | 'Yeni'
  | 'Görüntülendi'
  | 'Onaylandı'
  | 'Hazırlanıyor'
  | 'Hazır'
  | 'Yolda'
  | 'Teslim Edildi'
  | 'İptal Edildi';

export type PaymentStatus = 'Bekleniyor' | 'Ödendi' | 'İade Edildi';

export interface OrderItem {
  id?: number | string;
  name: string;
  price: number;
  quantity: number;
  selectedOptions?: string[];
  image?: string;
}

export interface OrderStatusHistoryEntry {
  status: OrderStatus | string;
  timestamp: string;
  user: string;
  note: string;
}

export interface Order {
  id: string;
  orderNumber: string;
  customerName: string;
  customerPhone: string;
  customerAddress: string;
  orderNote?: string;
  paymentMethod: string;
  paymentStatus: PaymentStatus;
  items: OrderItem[];
  subtotal: number;
  deliveryFee: number;
  total: number;
  userEmail?: string | null;
  status: OrderStatus;
  isViewed: boolean;
  viewedAt?: string | null;
  viewedBy?: string | null;
  courierName?: string | null;
  deliveredBy?: string | null;
  deliveredAt?: string | null;
  cancellationReason?: string | null;
  date: string;
  createdAt: string;
  updatedAt: string;
  statusHistory: OrderStatusHistoryEntry[];
}

export interface CustomerOrderSummary {
  id: string;
  date: string;
  total: number;
  items: string;
  status: string;
}

export interface User {
  id: string;
  name: string;
  email: string;
  phone: string;
  address: string;
  pass: string;
  orders: CustomerOrderSummary[];
  createdAt?: string;
}

export type PermissionCode =
  | 'overview'
  | 'orders'
  | 'inventory'
  | 'products'
  | 'users'
  | 'reviews'
  | 'api'
  | 'delete_order'
  | 'manage_prices';

export interface RoleModel {
  id: string;
  name: string;
  code: string;
  color: string;
  description: string;
  isSystem: boolean;
  permissions: PermissionCode[];
}

export interface AdminUser {
  id: string;
  name: string;
  email: string;
  phone: string;
  pass: string;
  roleId: string;
  roleName: string;
  isActive: boolean;
  createdAt: string;
}

export interface AuthenticatedAdmin {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: string;
  roleId: string;
  roleColor: string;
  permissions: PermissionCode[];
}

export interface Review {
  id: number | string;
  name: string;
  initials: string;
  location: string;
  rating: number;
  comment: string;
  createdAt: string;
}

export interface Feedback {
  id: number | string;
  name: string;
  email: string;
  type: string;
  message: string;
  createdAt: string;
}

export interface SecurityAuditLog {
  id: string;
  timestamp: string;
  level: 'INFO' | 'WARN' | 'ERROR' | 'CRITICAL';
  category: 'AUTH' | 'VALIDATION' | 'SQL_INJECTION' | 'XSS' | 'RATE_LIMIT' | 'PRICE_TAMPER' | 'ORM_QUERY' | 'SYSTEM';
  endpoint: string;
  ip: string;
  message: string;
  details?: Record<string, unknown>;
}

export interface DatabaseSchema {
  products: Product[];
  ingredients: Ingredient[];
  orders: Order[];
  users: User[];
  roles: RoleModel[];
  adminUsers: AdminUser[];
  reviews: Review[];
  feedback: Feedback[];
}

export interface ApiSuccessResponse<T = unknown> {
  success: true;
  message?: string;
  data?: T;
  count?: number;
  requestId?: string;
  [key: string]: unknown;
}

export interface ApiErrorResponse {
  success: false;
  error: string;
  errorCode: string;
  statusCode: number;
  requestId: string;
  timestamp: string;
  details?: unknown;
}

export interface OrmTableMetric {
  tableName: string;
  modelName: string;
  rowCount: number;
  primaryKey: string;
  indexes: string[];
  status: 'READY' | 'SYNCED';
}

export interface OrmHealthReport {
  connected: boolean;
  activeDriver: 'pg-prisma-pool' | 'postgresql-hybrid-sync';
  postgresServerReachable: boolean;
  postgresServerVersion: string | null;
  host: string;
  port: number;
  database: string;
  latencyMs: number;
  ormName: string;
  typescriptEnabled: boolean;
  tables: OrmTableMetric[];
  securityStatus: {
    preparedStatements: boolean;
    passwordHashing: string;
    jwtAlgorithm: string;
    rateLimitingActive: boolean;
    xssSanitizerActive: boolean;
    priceTamperProtection: boolean;
    auditLogsCount: number;
  };
  diagnostics: {
    name: string;
    passed: boolean;
    durationMs: number;
    detail: string;
  }[];
  checkedAt: string;
}

