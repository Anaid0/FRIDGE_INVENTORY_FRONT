import { computed, ref, type Ref } from 'vue';
import type { MovementType, Product } from '@/domain/models';

export interface CartLine {
  product: Product;
  quantity: number;
}

/** Máximo por línea al meter productos (al sacar el máximo es el stock). */
const MAX_IN = 99;
/** El backend acepta hasta 20 productos distintos por registro. */
export const MAX_CART_LINES = 20;

/**
 * Lista de productos que alguien va a sacar o meter en la tablet.
 * Al sacar no deja superar el stock; si el stock cambia (otra persona sacó algo), `syncStock` ajusta.
 */
export function useKioskCart(type: Ref<MovementType>) {
  const lines = ref<CartLine[]>([]);

  const maxFor = (product: Product) => (type.value === 'OUT' ? product.quantity : MAX_IN);
  const quantityOf = (productId: string) =>
    lines.value.find((l) => l.product.id === productId)?.quantity ?? 0;

  function canAdd(product: Product): boolean {
    if (!product.isActive) return false;
    const inCart = quantityOf(product.id);
    if (inCart === 0 && lines.value.length >= MAX_CART_LINES) return false;
    return inCart < maxFor(product);
  }

  function add(product: Product): boolean {
    if (!canAdd(product)) return false;
    const line = lines.value.find((l) => l.product.id === product.id);
    if (line) line.quantity += 1;
    else lines.value.push({ product, quantity: 1 });
    return true;
  }

  function setQuantity(productId: string, quantity: number): void {
    const line = lines.value.find((l) => l.product.id === productId);
    if (!line) return;
    const clamped = Math.min(Math.max(Math.trunc(quantity), 0), maxFor(line.product));
    if (clamped === 0) remove(productId);
    else line.quantity = clamped;
  }

  function remove(productId: string): void {
    lines.value = lines.value.filter((l) => l.product.id !== productId);
  }

  function clear(): void {
    lines.value = [];
  }

  /**
   * Con el stock actualizado: refresca cada producto y, al sacar, recorta cantidades que ya no alcanzan.
   * Devuelve los nombres de los productos que se ajustaron (para avisar).
   */
  function syncStock(products: Product[]): string[] {
    const byId = new Map(products.map((p) => [p.id, p]));
    const adjusted: string[] = [];
    lines.value = lines.value.flatMap((line) => {
      const product = byId.get(line.product.id);
      if (!product || !product.isActive) {
        adjusted.push(line.product.name);
        return [];
      }
      const max = maxFor(product);
      if (line.quantity > max) adjusted.push(product.name);
      const quantity = Math.min(line.quantity, max);
      return quantity > 0 ? [{ product, quantity }] : [];
    });
    return adjusted;
  }

  const totalUnits = computed(() => lines.value.reduce((sum, l) => sum + l.quantity, 0));
  const isEmpty = computed(() => lines.value.length === 0);
  const items = computed(() => lines.value.map((l) => ({ productId: l.product.id, quantity: l.quantity })));

  return {
    lines,
    items,
    totalUnits,
    isEmpty,
    quantityOf,
    canAdd,
    add,
    setQuantity,
    remove,
    clear,
    syncStock,
  };
}

export type KioskCart = ReturnType<typeof useKioskCart>;
