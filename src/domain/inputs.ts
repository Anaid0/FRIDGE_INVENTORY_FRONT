import type { DateOnly, MovementSource, MovementType, Role } from './models';

export interface PageQuery {
  page?: number;
  pageSize?: number;
}

export interface DateRangeQuery {
  from?: string;
  to?: string;
}

export interface UserFilter {
  role?: Role;
  isActive?: boolean;
  search?: string;
}

/** Alta de otro administrador (email + contraseña). */
export interface CreateAdminInput {
  name: string;
  lastname: string;
  email: string;
  password: string;
}

export interface UpdateUserInput {
  name?: string;
  lastname?: string;
  email?: string;
  password?: string;
  isActive?: boolean;
}

export interface CreatePersonInput {
  name: string;
  lastname: string;
  pin: string;
}

export interface UpdatePersonInput {
  name?: string;
  lastname?: string;
  isActive?: boolean;
}

export interface PersonFilter {
  isActive?: boolean;
  search?: string;
}

export interface ProductFilter {
  search?: string;
  categoryId?: string;
  lowStock?: boolean;
  includeInactive?: boolean;
}

export interface CreateProductInput {
  name: string;
  /** Código de 2 dígitos de la máquina; si no viene (o es null), la API asigna el primero libre. */
  code?: string | null;
  description?: string | null;
  unit?: string;
  minStock?: number;
  categoryId?: string | null;
  /** Precio de referencia (decimal) para productos sin compras. */
  referencePrice?: string | null;
  initialQuantity?: number;
}

export interface UpdateProductInput {
  name?: string;
  /** Nuevo código de la máquina. No se puede quitar (la API no acepta null): si no viene, se conserva. */
  code?: string;
  description?: string | null;
  unit?: string;
  minStock?: number;
  categoryId?: string | null;
  referencePrice?: string | null;
  isActive?: boolean;
}

export interface StockMovementInput {
  productId: string;
  quantity: number;
  note?: string | null;
  /** Solo lo tiene en cuenta el backend si quien registra es ADMIN. */
  performedBy?: string | null;
}

export interface MovementFilter extends PageQuery, DateRangeQuery {
  type?: MovementType;
  source?: MovementSource;
  performedBy?: string;
  registeredBy?: string;
  productId?: string;
}

export interface OpenPeriodInput {
  name: string;
  startDate: DateOnly;
  endDate: DateOnly;
  notes?: string | null;
}

export interface ContributionInput {
  userId: string;
  amount: string;
  paidAt?: string;
  note?: string | null;
}

/**
 * Línea de compra: por unidad (`quantity` + `unitPrice`) o por paquetes (`packageCount` +
 * `unitsPerPackage` + `total` pagado). Con paquetes, el precio unitario lo calcula la API: total ÷ unidades.
 */
export type PurchaseItemInput =
  | { productId: string; quantity: number; unitPrice: string }
  | { productId: string; packageCount: number; unitsPerPackage: number; total: string };

export interface RegisterPurchaseInput {
  periodId: string;
  buyerId: string;
  store?: string | null;
  purchasedAt: string;
  note?: string | null;
  items: PurchaseItemInput[];
  receipt?: File | null;
}

export interface PurchaseFilter extends PageQuery, DateRangeQuery {
  periodId?: string;
  buyerId?: string;
  productId?: string;
  includeVoided?: boolean;
}

export type ReportScope = { periodId: string } | DateRangeQuery;

/** Registro en la tablet: el PIN identifica a la persona (no se elige nombre). */
export interface KioskMovementInput {
  pin: string;
  type: MovementType;
  items: { productId: string; quantity: number }[];
  note?: string | null;
}
