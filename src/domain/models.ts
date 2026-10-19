/**
 * Modelos del front: reflejan los DTOs de la API de FridgeYA.
 * Las fechas llegan como texto ISO; el dinero como texto decimal ("48000.00").
 */

export type Role = 'ADMIN' | 'EMPLOYEE';
export type ISODate = string; // '2026-10-16T15:00:00.000Z'
export type DateOnly = string; // '2026-10-16'
export type Decimal = string; // '48000.00'

export interface Page<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

// --- Usuarios ---
export interface UserRef {
  id: string;
  name: string;
  lastname: string;
}

export interface User extends UserRef {
  fullName: string;
  /** Solo los administradores tienen email (las personas usan PIN). */
  email: string | null;
  role: Role;
  isActive: boolean;
  createdAt: ISODate;
  updatedAt: ISODate;
}

/** Persona que se identifica en la tablet con nombre + PIN (sin cuenta). */
export interface Person extends UserRef {
  fullName: string;
  isActive: boolean;
  hasPin: boolean;
  isPinLocked: boolean;
  pinLockedUntil: ISODate | null;
  createdAt: ISODate;
  updatedAt: ISODate;
}

/** Tablet autorizada para registrar movimientos con PIN. */
export interface KioskDevice {
  id: string;
  name: string;
  isActive: boolean;
  createdBy: UserRef | null;
  createdAt: ISODate;
  lastSeenAt: ISODate | null;
  revokedAt: ISODate | null;
}

export interface PairKioskResult {
  device: KioskDevice;
  token: string;
}

/** Persona tal como la muestra la tablet (nunca datos del PIN). */
export interface KioskPerson extends UserRef {
  initials: string;
}

export interface KioskMovementResult {
  person: UserRef;
  type: MovementType;
  movements: Movement[];
  products: Product[];
}

export interface LoginResult {
  token: string;
  user: User;
}

// --- Catálogo ---
export interface Category {
  id: string;
  name: string;
  createdAt: ISODate;
}

export interface Product {
  id: string;
  name: string;
  description: string | null;
  unit: string;
  quantity: number;
  minStock: number;
  isLowStock: boolean;
  categoryId: string | null;
  isActive: boolean;
  createdAt: ISODate;
  updatedAt: ISODate;
}

// --- Movimientos ---
export type MovementType = 'IN' | 'OUT';
export type MovementSource = 'MANUAL' | 'PURCHASE' | 'PURCHASE_VOID';

export interface Movement {
  id: string;
  productId: string;
  type: MovementType;
  source: MovementSource;
  quantity: number;
  stockBefore: number;
  stockAfter: number;
  performedBy: string;
  registeredBy: string;
  note: string | null;
  purchaseItemId: string | null;
  createdAt: ISODate;
}

/** Fila del log con nombres resueltos. */
export interface MovementView {
  id: string;
  type: MovementType;
  source: MovementSource;
  quantity: number;
  stockBefore: number;
  stockAfter: number;
  note: string | null;
  createdAt: ISODate;
  product: { id: string; name: string; unit: string };
  performedBy: UserRef;
  registeredBy: UserRef;
  purchaseId: string | null;
}

export interface ProductDetail {
  product: Product;
  latestMovements: MovementView[];
}

export interface StockMovementResult {
  movement: Movement;
  product: Product;
}

export interface TopWithdrawer {
  user: UserRef;
  totalWithdrawn: number;
  withdrawals: number;
}

export type RankingPeriod = 'all' | 'month' | 'week';

// --- Quincenas ---
export type PeriodStatus = 'OPEN' | 'CLOSED';

export interface FundingPeriod {
  id: string;
  name: string;
  startDate: DateOnly;
  endDate: DateOnly;
  status: PeriodStatus;
  notes: string | null;
  createdBy: string;
  closedAt: ISODate | null;
  createdAt: ISODate;
}

export interface PeriodSummary {
  periodId: string;
  name: string;
  startDate: DateOnly;
  endDate: DateOnly;
  status: PeriodStatus;
  collected: Decimal;
  spent: Decimal;
  balance: Decimal;
  isOverspent: boolean;
}

export interface Contribution {
  id: string;
  periodId: string;
  userId: string;
  amount: Decimal;
  paidAt: ISODate;
  registeredBy: string;
  note: string | null;
  createdAt: ISODate;
}

export interface ContributionView {
  id: string;
  periodId: string;
  user: UserRef;
  amount: Decimal;
  paidAt: ISODate;
  note: string | null;
  registeredBy: UserRef;
  createdAt: ISODate;
}

export interface ContributorTotal {
  user: UserRef;
  total: Decimal;
  contributions: number;
}

export interface FundingPeriodDetail {
  period: FundingPeriod;
  summary: PeriodSummary;
  contributions: ContributionView[];
  contributorTotals: ContributorTotal[];
  purchases: PurchaseListItem[];
}

// --- Compras ---
export interface PurchaseListItem {
  id: string;
  periodId: string;
  periodName: string;
  buyer: UserRef;
  store: string | null;
  purchasedAt: ISODate;
  total: Decimal;
  itemsCount: number;
  hasReceipt: boolean;
  voidedAt: ISODate | null;
  createdAt: ISODate;
}

export interface PurchaseItemDetail {
  id: string;
  product: { id: string; name: string; unit: string };
  quantity: number;
  unitPrice: Decimal;
  subtotal: Decimal;
}

export interface PurchaseDetail {
  id: string;
  periodId: string;
  buyer: UserRef;
  registeredBy: UserRef;
  voidedBy: UserRef | null;
  store: string | null;
  purchasedAt: ISODate;
  total: Decimal;
  hasReceipt: boolean;
  note: string | null;
  voidedAt: ISODate | null;
  createdAt: ISODate;
  items: PurchaseItemDetail[];
}

// --- Reportes ---
export interface ProductSpending {
  productId: string;
  productName: string;
  units: number;
  spent: Decimal;
  averageUnitPrice: Decimal;
}

export interface CategorySpending {
  categoryId: string | null;
  categoryName: string;
  units: number;
  spent: Decimal;
}

export interface PricePoint {
  purchaseId: string;
  purchasedAt: ISODate;
  unitPrice: Decimal;
  store: string | null;
}

// --- Dashboard ---
export interface DashboardSummary {
  activeProducts: number;
  totalUnits: number;
  lowStockProducts: Product[];
  topWithdrawer: TopWithdrawer | null;
  topWithdrawers: { allTime: TopWithdrawer[]; last30Days: TopWithdrawer[] };
  latestMovements: MovementView[];
  currentPeriod: PeriodSummary | null;
}
