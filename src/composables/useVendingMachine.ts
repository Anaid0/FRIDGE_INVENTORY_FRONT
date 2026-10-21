import { computed, ref } from 'vue';
import type { Product } from '@/domain/models';
import { useKioskCart } from './useKioskCart';

export const PIN_LENGTH = 4;
export const ADMIN_CODE_MIN = 4;
export const ADMIN_CODE_MAX = 6;

/** `admin`: retiro vacío, el teclado sirve para el código de administrador. `pin`: hay productos elegidos. */
export type MachineStep = 'admin' | 'pin';

export interface MachineDisplay {
  label: string;
  /** Lo grande de la pantalla: los puntos del PIN o del código de administrador. */
  big: string;
  sub: string;
  isError: boolean;
  /** Candado: recuerda que los administradores entran escribiendo su código. */
  showLock: boolean;
}

/** Qué hace OK: retirar con el PIN o entrar como administrador. */
export type OkAction = 'withdraw' | 'admin';

const plural = (n: number) => `${n} ${n === 1 ? 'producto' : 'productos'}`;
const dots = (typed: number, total: number) =>
  Array.from({ length: total }, (_, i) => (i < typed ? '●' : '○')).join(' ');

/**
 * Lógica de la máquina expendedora: se tocan los productos y luego se escribe el PIN de 4 dígitos, que
 * identifica a la persona. Con el retiro vacío, el teclado es para el código de administrador (4–6 dígitos),
 * que se valida en el servidor. La vista decide qué hacer con el PIN o el código (`onWithdraw` / `onAdmin`).
 */
export function useVendingMachine(handlers: {
  onWithdraw: (pin: string) => void;
  onAdmin: (code: string) => void;
}) {
  const cart = useKioskCart(ref('OUT'));
  /** Lo marcado en el teclado (PIN o código de administrador). */
  const entry = ref('');
  /** Aviso pasajero (p. ej. "Guaro está agotado") hasta la siguiente tecla. */
  const msg = ref<string | null>(null);
  /** Error del servidor con el PIN o el código de admin (se borra al volver a marcar). */
  const serverError = ref<string | null>(null);

  const step = computed<MachineStep>(() => (cart.isEmpty.value ? 'admin' : 'pin'));
  const left = (p: Product) => p.quantity - cart.quantityOf(p.id);

  const display = computed<MachineDisplay>(() => {
    const error = serverError.value ?? msg.value;
    if (step.value === 'pin') {
      return {
        label: 'TU PIN',
        big: dots(entry.value.length, PIN_LENGTH),
        sub: error ?? `${plural(cart.totalUnits.value)} · escribe tu PIN para retirar`,
        isError: Boolean(error),
        showLock: false,
      };
    }
    if (entry.value) {
      return {
        label: 'ADMINISTRADOR',
        big: entry.value.replace(/\d/g, '●').split('').join(' '),
        sub: error ?? 'Pulsa OK · se valida en el servidor',
        isError: Boolean(error),
        showLock: false,
      };
    }
    return {
      label: 'TU RETIRO',
      big: '',
      sub: error ?? 'Toca los productos que vas a llevar',
      isError: Boolean(error),
      showLock: true,
    };
  });

  const okAction = computed<OkAction>(() => (step.value === 'pin' ? 'withdraw' : 'admin'));
  const okEnabled = computed(() =>
    step.value === 'pin' ? entry.value.length === PIN_LENGTH : entry.value.length >= ADMIN_CODE_MIN,
  );

  /** Agrega una unidad del producto tocado. */
  function add(product: Product) {
    serverError.value = null;
    msg.value = null;
    if (step.value === 'admin') entry.value = ''; // lo marcado era un código de admin a medias
    if (product.quantity === 0) {
      msg.value = `${product.name} está agotado`;
      return;
    }
    if (left(product) <= 0) {
      msg.value = `Ya tienes todos los ${product.name} disponibles`;
      return;
    }
    cart.add(product);
  }

  function digit(d: string) {
    serverError.value = null;
    msg.value = null;
    const max = step.value === 'pin' ? PIN_LENGTH : ADMIN_CODE_MAX;
    if (entry.value.length < max) entry.value += d;
  }

  function back() {
    serverError.value = null;
    msg.value = null;
    entry.value = entry.value.slice(0, -1);
  }

  function clear() {
    serverError.value = null;
    msg.value = null;
    entry.value = '';
  }

  function ok() {
    if (!okEnabled.value) return;
    if (okAction.value === 'withdraw') handlers.onWithdraw(entry.value);
    else handlers.onAdmin(entry.value);
  }

  function remove(productId: string) {
    cart.remove(productId);
    entry.value = '';
    serverError.value = null;
  }

  /** El servidor rechazó el PIN o el código: se muestra en la pantalla y se vuelve a pedir. */
  function rejectEntry(message: string) {
    serverError.value = message;
    entry.value = '';
  }

  /** Vuelve al inicio: retiro vacío y teclado limpio. */
  function reset() {
    cart.clear();
    entry.value = '';
    msg.value = null;
    serverError.value = null;
  }

  return {
    cart,
    step,
    entry,
    display,
    okAction,
    okEnabled,
    left,
    add,
    digit,
    back,
    clear,
    ok,
    remove,
    rejectEntry,
    reset,
  };
}

export type VendingMachine = ReturnType<typeof useVendingMachine>;
