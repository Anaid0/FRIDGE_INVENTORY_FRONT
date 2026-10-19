import { defineStore } from 'pinia';
import { computed, ref, shallowRef } from 'vue';
import type { KioskMovementInput } from '@/domain/inputs';
import type {
  Category,
  KioskDevice,
  KioskMovementResult,
  KioskPerson,
  MovementView,
  Product,
  TopWithdrawer,
} from '@/domain/models';
import { useKioskTokenStorage, useServices } from '@/services/container';
import { ApiError, errorMessage } from '@/services/errors';

/** Códigos con los que la API rechaza al DISPOSITIVO (no a la persona): la tablet deja de estar autorizada. */
export const DEVICE_REJECTED_CODES = [
  'DEVICE_REVOKED',
  'DEVICE_NOT_AUTHORIZED',
  'INVALID_TOKEN',
  'TOKEN_EXPIRED',
  'MISSING_TOKEN',
] as const;

export type KioskStatus = 'loading' | 'unpaired' | 'revoked' | 'offline' | 'ready';

/**
 * Estado de la tablet: si está autorizada, y los datos que muestra (stock, personas, quién más retira,
 * últimos movimientos). Usa el token de la tablet, independiente de la sesión del admin.
 */
export const useKioskStore = defineStore('kiosk', () => {
  const { kiosk } = useServices();
  const tokens = useKioskTokenStorage();

  const status = ref<KioskStatus>('loading');
  const device = ref<KioskDevice | null>(null);
  const products = shallowRef<Product[]>([]);
  const categories = shallowRef<Category[]>([]);
  const people = shallowRef<KioskPerson[]>([]);
  const topWithdrawer = ref<TopWithdrawer | null>(null);
  const latestMovements = shallowRef<MovementView[]>([]);
  const offlineMessage = ref<string | null>(null);

  const isPaired = computed(() => status.value === 'ready' || status.value === 'offline');
  const activeProducts = computed(() => products.value.filter((p) => p.isActive));

  /** La API rechazó la tablet: se olvida el token y se pide autorizarla de nuevo. */
  function onDeviceRejected(code: string): void {
    tokens.clear();
    device.value = null;
    status.value = code === 'DEVICE_REVOKED' ? 'revoked' : 'unpaired';
  }

  function isDeviceRejection(error: unknown): error is ApiError {
    return (
      error instanceof ApiError &&
      error.status === 401 &&
      (DEVICE_REJECTED_CODES as readonly string[]).includes(error.code)
    );
  }

  async function init(): Promise<void> {
    if (!tokens.get()) {
      status.value = 'unpaired';
      return;
    }
    try {
      device.value = await kiosk.me();
      offlineMessage.value = null;
      status.value = 'ready';
      await refresh();
    } catch (error) {
      if (isDeviceRejection(error)) onDeviceRejected(error.code);
      else {
        status.value = 'offline';
        offlineMessage.value = errorMessage(error);
      }
    }
  }

  /**
   * Stock, personas, quién más retira y últimos movimientos (así "¿Quién eres?" aparece al instante).
   * Las categorías solo sirven para filtrar: si fallan, se conservan las que había.
   */
  async function refresh(): Promise<void> {
    const [productList, peopleList, top, latest, categoryList] = await Promise.all([
      kiosk.products(),
      kiosk.people(),
      kiosk.topWithdrawers('all', 1),
      kiosk.latestMovements(15),
      kiosk.categories().catch(() => categories.value),
    ]);
    products.value = productList;
    categories.value = categoryList;
    people.value = peopleList;
    topWithdrawer.value = top[0] ?? null;
    latestMovements.value = latest;
    if (status.value === 'offline') status.value = 'ready';
  }

  async function loadPeople(): Promise<KioskPerson[]> {
    people.value = await kiosk.people();
    return people.value;
  }

  /** Recién autorizada desde la administración: guarda el token y arranca. */
  async function adopt(token: string, pairedDevice: KioskDevice): Promise<void> {
    tokens.set(token);
    device.value = pairedDevice;
    status.value = 'ready';
    await refresh().catch(() => undefined);
  }

  /** Desvincula este dispositivo (deja de funcionar como tablet; no revoca en el servidor). */
  function unpair(): void {
    tokens.clear();
    device.value = null;
    status.value = 'unpaired';
  }

  async function register(input: KioskMovementInput): Promise<KioskMovementResult> {
    const result = await kiosk.register(input);
    const updated = new Map(result.products.map((p) => [p.id, p]));
    products.value = products.value.map((p) => updated.get(p.id) ?? p);
    void refresh().catch(() => undefined);
    return result;
  }

  async function changePin(personId: string, currentPin: string, newPin: string): Promise<void> {
    await kiosk.changePin(personId, currentPin, newPin);
  }

  return {
    status,
    device,
    products,
    activeProducts,
    categories,
    people,
    topWithdrawer,
    latestMovements,
    offlineMessage,
    isPaired,
    hasToken: () => tokens.get() !== null,
    init,
    refresh,
    loadPeople,
    adopt,
    unpair,
    register,
    changePin,
    onDeviceRejected,
  };
});
