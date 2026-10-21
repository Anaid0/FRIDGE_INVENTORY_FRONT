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
  /** Solo administradores: si ya tiene código para entrar desde la máquina. */
  hasAdminCode?: boolean;
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
  /** Bloqueada por PIN incorrectos: hasta cuándo (si no, null). */
  pinLockedUntil: ISODate | null;
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
  /** Código de 2 dígitos que se marca en la máquina (10–99). */
  code: string | null;
  name: string;
  description: string | null;
  unit: string;
  quantity: number;
  minStock: number;
  isLowStock: boolean;
  categoryId: string | null;
  /** Precio que puso el admin para productos sin compras (regalos, stock inicial). */
  referencePrice: Decimal | null;
  /** Lo que vale una unidad hoy al sacarla: última compra o, si no hay, el de referencia. */
  currentPrice: Decimal | null;
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
  /** Precio unitario: el guardado al sacar (retiros), el de compra o el del producto al ingresar. */
  unitPrice: Decimal | null;
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
  /** Precio unitario: el guardado al sacar (retiros), el de compra o el del producto al ingresar. */
  unitPrice: Decimal | null;
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

/** 'period' = la quincena abierta. */
export type RankingPeriod = 'all' | 'month' | 'week' | 'period';

/** Ranking en vivo: una ventana de tiempo o una quincena concreta (por id). */
export type RankingScope = { period: RankingPeriod } | { periodId: string };

/** Un puesto del ranking calculado de una quincena (con empates, `position` se repite). */
export interface PeriodRankingEntry {
  position: number;
  user: UserRef;
  totalWithdrawn: number;
  withdrawals: number;
}

/** "El más hambriento de la quincena": resultado guardado al calcularlo. */
export interface PeriodRanking {
  period: { id: string; name: string; startDate: string; endDate: string };
  computedAt: string;
  /** Un administrador (su nombre) o una tablet (el nombre de la tablet). */
  computedBy: { kind: 'user' | 'kiosk'; name: string };
  entries: PeriodRankingEntry[];
  /** Primer puesto (más de una persona si empatan); vacío si nadie sacó nada. */
  hungriest: PeriodRankingEntry[];
  podium: PeriodRankingEntry[];
}

/** Quincena para elegir en el ranking (también en la tablet, sin montos). */
export interface RankingPeriodOption {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  status: PeriodStatus;
  /** Ya terminó o está cerrada: se puede calcular el más hambriento. */
  finished: boolean;
  /** Ya tiene su más hambriento calculado. */
  computed: boolean;
}

export interface PeriodRankingStatus {
  periodId: string;
  /** La quincena ya terminó o está cerrada: se puede calcular. */
  canCompute: boolean;
  /** Desde cuándo se puede calcular (ISO). */
  availableFrom: string;
  ranking: PeriodRanking | null;
}

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
  /** Si es el pago de un cobro por consumo. */
  chargeId: string | null;
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
  /** Pago de un cobro por consumo: de qué quincena era el cobro. */
  charge: { id: string; periodId: string; periodName: string } | null;
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
  /** Resumen de las líneas ("12 Coca cola"). */
  lines: { productName: string; quantity: number }[];
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
  /** Si se compró por paquetes (p. ej. 2 sixpacks de 6). */
  packageCount: number | null;
  unitsPerPackage: number | null;
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
/** Unidades que una persona sacó y metió a mano en una quincena. */
export interface PersonActivity {
  userId: string;
  withdrawn: number;
  stored: number;
}

export interface PeopleActivity {
  period: { id: string; name: string; startDate: DateOnly; endDate: DateOnly } | null;
  people: PersonActivity[];
}

/** Quien más consume, más aporta: lo que una persona debe aportar por lo que consumió en una quincena. */
export interface ConsumptionCharge {
  /** null en una estimación (quincena abierta). */
  id: string | null;
  period: { id: string; name: string };
  user: UserRef;
  amount: Decimal;
  paid: Decimal;
  pending: Decimal;
  units: number;
  /** Unidades sin precio conocido (cuentan como $0). */
  unpricedUnits: number;
  computedAt: ISODate | null;
}

export interface PeriodCharges {
  periodId: string;
  /** 'generated': guardados al cerrar la quincena. 'estimate': cálculo en vivo (quincena abierta). */
  status: 'generated' | 'estimate';
  canGenerate: boolean;
  charges: ConsumptionCharge[];
  totals: { amount: Decimal; paid: Decimal; pending: Decimal; unpricedUnits: number };
}

export interface DashboardSummary {
  activeProducts: number;
  totalUnits: number;
  lowStockProducts: Product[];
  topWithdrawer: TopWithdrawer | null;
  topWithdrawers: { allTime: TopWithdrawer[]; last30Days: TopWithdrawer[] };
  latestMovements: MovementView[];
  currentPeriod: PeriodSummary | null;
}
