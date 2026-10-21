import type { MovementType } from '@/domain/models';
import { withUnit } from '@/utils/format';

/**
 * Celular en horizontal (poco alto): la lista de lo elegido pasa a ser una barra delgada para que los
 * productos tengan casi toda la pantalla.
 */
export const COMPACT_CART_QUERY = '(orientation: landscape) and (max-height: 599px)';

/** "a", "a y b", "a, b y c". */
export function joinList(parts: string[]): string {
  return parts.length > 1
    ? `${parts.slice(0, -1).join(', ')} y ${parts[parts.length - 1]}`
    : (parts[0] ?? '');
}

/** Cantidad con su unidad, salvo la genérica: "11", "1 botella", "3 paquetes". */
export function stockText(quantity: number, unit: string): string {
  return !unit || unit === 'unidad' ? String(quantity) : withUnit(quantity, unit);
}

/** Poco stock: lo que marca el admin (mínimo) o casi nada en la nevera. */
export function isScarce(product: { quantity: number; isLowStock: boolean }): boolean {
  return product.quantity > 0 && (product.isLowStock || product.quantity <= 2);
}

/** Lo que queda en la nevera tras sacar/meter `quantity`. */
export function stockAfter(type: MovementType, stock: number, quantity: number): number {
  return type === 'OUT' ? Math.max(stock - quantity, 0) : stock + quantity;
}

/** Colores de Sacar (naranja) y Meter (verde), para no repetir los ternarios en cada pantalla. */
export function tone(type: MovementType) {
  return type === 'OUT'
    ? {
        text: 'text-accent-700',
        soft: 'bg-accent-50/85 border-accent-200',
        solid: 'bg-accent-500 text-ink-900',
        bar: 'bg-accent-500',
        button: 'btn-accent',
      }
    : {
        text: 'text-success-700',
        soft: 'bg-success-50/85 border-success-100',
        solid: 'bg-success-700 text-white',
        bar: 'bg-success-700',
        button: 'btn-success',
      };
}
