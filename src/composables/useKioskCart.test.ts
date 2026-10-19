import { describe, expect, it } from 'vitest';
import { ref } from 'vue';
import type { MovementType, Product } from '@/domain/models';
import { MAX_CART_LINES, useKioskCart } from './useKioskCart';

const product = (id: string, quantity: number, extra: Partial<Product> = {}): Product => ({
  id,
  name: id,
  description: null,
  unit: 'unidad',
  quantity,
  minStock: 0,
  isLowStock: false,
  categoryId: null,
  referencePrice: null,
  currentPrice: null,
  isActive: true,
  createdAt: '',
  updatedAt: '',
  ...extra,
});

describe('useKioskCart', () => {
  it('al sacar no deja pasar del stock', () => {
    const cart = useKioskCart(ref<MovementType>('OUT'));
    const gaseosa = product('gaseosa', 2);
    expect(cart.add(gaseosa)).toBe(true);
    expect(cart.add(gaseosa)).toBe(true);
    expect(cart.add(gaseosa)).toBe(false);
    expect(cart.quantityOf('gaseosa')).toBe(2);
    expect(cart.canAdd(product('agotado', 0))).toBe(false);
    cart.setQuantity('gaseosa', 9);
    expect(cart.quantityOf('gaseosa')).toBe(2);
  });

  it('al meter no depende del stock', () => {
    const cart = useKioskCart(ref<MovementType>('IN'));
    const agotado = product('agotado', 0);
    expect(cart.add(agotado)).toBe(true);
    cart.setQuantity('agotado', 12);
    expect(cart.items.value).toEqual([{ productId: 'agotado', quantity: 12 }]);
  });

  it('cantidades, totales, quitar y vaciar', () => {
    const cart = useKioskCart(ref<MovementType>('OUT'));
    cart.add(product('a', 5));
    cart.add(product('b', 5));
    cart.setQuantity('a', 3);
    expect(cart.totalUnits.value).toBe(4);
    cart.setQuantity('b', 0);
    expect(cart.lines.value.map((l) => l.product.id)).toEqual(['a']);
    cart.remove('a');
    expect(cart.isEmpty.value).toBe(true);
    cart.add(product('c', 1));
    cart.clear();
    expect(cart.isEmpty.value).toBe(true);
  });

  it('no permite inactivos ni más líneas que las que acepta la API', () => {
    const cart = useKioskCart(ref<MovementType>('IN'));
    expect(cart.add(product('x', 5, { isActive: false }))).toBe(false);
    for (let i = 0; i < MAX_CART_LINES; i++) cart.add(product(`p${i}`, 5));
    expect(cart.add(product('extra', 5))).toBe(false);
    expect(cart.add(product('p0', 5))).toBe(true); // sumar a una línea existente sí
  });

  it('syncStock ajusta cuando otra persona sacó algo y avisa qué cambió', () => {
    const cart = useKioskCart(ref<MovementType>('OUT'));
    cart.add(product('a', 5));
    cart.setQuantity('a', 4);
    cart.add(product('b', 1));
    cart.add(product('c', 3));
    const adjusted = cart.syncStock([product('a', 2), product('b', 0), product('c', 3, { isActive: false })]);
    expect(adjusted).toEqual(['a', 'b', 'c']);
    expect(cart.items.value).toEqual([{ productId: 'a', quantity: 2 }]);
  });
});
