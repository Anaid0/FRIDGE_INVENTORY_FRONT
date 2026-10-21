<script setup lang="ts">
import { IonContent, IonPage, onIonViewDidEnter, onIonViewWillLeave, useBackButton } from '@ionic/vue';
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { RouterLink, useRouter } from 'vue-router';
import FridgeLogo from '@/components/brand/FridgeLogo.vue';
import KioskChangePin from '@/components/kiosk/KioskChangePin.vue';
import DeliveryScene, { type DeliveryLine, type DeliveryStanding } from '@/components/machine/DeliveryScene.vue';
import MachineCabinet from '@/components/machine/MachineCabinet.vue';
import MachineCart from '@/components/machine/MachineCart.vue';
import MachineHeader from '@/components/machine/MachineHeader.vue';
import MachineKeypad from '@/components/machine/MachineKeypad.vue';
import MachineSearch from '@/components/machine/MachineSearch.vue';
import SplashScreen from '@/components/machine/SplashScreen.vue';
import Icon from '@/components/ui/Icon.vue';
import OfflineBanner from '@/components/ui/OfflineBanner.vue';
import { useIdle } from '@/composables/useIdle';
import { useMediaQuery } from '@/composables/useMediaQuery';
import { useOnEnter } from '@/composables/useOnEnter';
import { useVendingMachine } from '@/composables/useVendingMachine';
import type { KioskMovementResult, Product } from '@/domain/models';
import { isNative } from '@/native/platform';
import { useServices } from '@/services/container';
import { ApiError, errorMessage } from '@/services/errors';
import { useAuthStore } from '@/stores/auth';
import { useKioskStore } from '@/stores/kiosk';
import { joinList } from '@/components/kiosk/kioskText';

/** Vuelve al inicio tras este tiempo sin tocar la pantalla (si había algo a medias). */
const IDLE_MS = 60_000;
const REFRESH_MS = 60_000;
/** Si el servidor tarda más que esto, se muestra "Procesando tu retiro…" con el mono. */
const PROCESSING_AFTER_MS = 350;
const TOAST_MS = 6_000;
const PIN_ERRORS = ['INVALID_PIN', 'PIN_LOCKED', 'PIN_AMBIGUOUS', 'INVALID_ADMIN_CODE'];
const STOCK_ERRORS = ['INSUFFICIENT_STOCK', 'PRODUCT_INACTIVE', 'PRODUCT_NOT_FOUND'];

/**
 * La máquina expendedora (mockups Main y MaquinaTablet). Pantalla de inicio de la app:
 * - Empleado: toca los productos → PIN + OK → el mono entrega → vuelve sola.
 *   En el celular son dos pasos: primero la máquina ("Retirar · N") y luego la pantalla del PIN.
 * - Administrador: con el retiro vacío marca su código (4–6 dígitos) + OK → entra a la administración.
 *   En el celular llega al teclado con el candado de la cabecera.
 */
const kiosk = useKioskStore();
const auth = useAuthStore();
const services = useServices();
const router = useRouter();

/** Productos de la máquina, en el orden de sus códigos (11, 12, 13, 14, 21…). */
const products = computed<Product[]>(() =>
  [...kiosk.activeProducts].sort((a, b) => {
    if (a.code && b.code) return a.code.localeCompare(b.code);
    if (a.code || b.code) return a.code ? -1 : 1;
    return a.name.localeCompare(b.name, 'es');
  }),
);

const machine = useVendingMachine({ onWithdraw: withdraw, onAdmin: enterAdmin });
const cart = machine.cart;

/** Buscador: filtra la vitrina desde la tercera letra, sin importar tildes ni mayúsculas. */
const SEARCH_MIN = 3;
const search = ref('');
const normalize = (text: string) =>
  text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
const searching = computed(() => search.value.trim().length >= SEARCH_MIN);
const visibleProducts = computed(() => {
  if (!searching.value) return products.value;
  const term = normalize(search.value.trim());
  return products.value.filter((p) => normalize(p.name).includes(term));
});
const emptyText = computed(() =>
  searching.value ? `No hay productos que coincidan con «${search.value.trim()}».` : undefined,
);

/** Tablet en horizontal: máquina a la izquierda; retiro y teclado a la derecha. */
const large = useMediaQuery('(min-width: 900px) and (min-height: 600px)');

/** Celular: paso 1 la máquina, paso 2 el teclado (PIN para retirar, o código de administrador). */
const phoneStep = ref<'select' | 'keypad'>('select');
const phoneKeypad = computed(() => !large.value && phoneStep.value === 'keypad');
// Si se quita lo último del retiro mientras se pide el PIN, se vuelve a la máquina.
watch(
  () => cart.isEmpty.value,
  (empty, wasEmpty) => {
    if (empty && !wasEmpty) phoneStep.value = 'select';
  },
);
function toKeypad() {
  machine.clear();
  phoneStep.value = 'keypad';
}
function toSelect() {
  machine.clear();
  phoneStep.value = 'select';
}

type Screen = 'machine' | 'delivery' | 'change-pin';
const screen = ref<Screen>('machine');
const phase = ref<'processing' | 'delivered' | 'error'>('processing');
const busy = ref(false);
const deliveredLines = ref<DeliveryLine[]>([]);
const personName = ref<string | null>(null);
const standing = ref<DeliveryStanding | null>(null);
const errorInfo = ref({ title: '', text: '' });
const pendingPin = ref('');
/** Aviso arriba al volver a la máquina ("David retiró… · llevas 10 esta quincena"). */
const toast = ref<{ name: string; text: string; tone: 'ok' | 'info' | 'warning' } | null>(null);
let toastTimer: ReturnType<typeof setTimeout> | undefined;

function showToast(value: NonNullable<typeof toast.value>) {
  clearTimeout(toastTimer);
  toast.value = value;
  toastTimer = setTimeout(() => (toast.value = null), TOAST_MS);
}

/** Bloqueo por demasiados PIN o códigos incorrectos en esta tablet. */
function lockedMessage(error: ApiError): string {
  const details = error.details as { lockedUntil?: string } | undefined;
  const time = details?.lockedUntil
    ? new Date(details.lockedUntil).toLocaleTimeString('es-CO', { hour: 'numeric', minute: '2-digit' })
    : null;
  return time ? `Demasiados intentos · vuelve a intentarlo a las ${time}` : error.message;
}

/** Mensaje corto para la pantalla del teclado. */
function screenMessage(error: ApiError): string {
  if (error.code === 'PIN_LOCKED') return lockedMessage(error);
  const remaining = (error.details as { remainingAttempts?: number } | undefined)?.remainingAttempts;
  const what = error.code === 'INVALID_ADMIN_CODE' ? 'Código incorrecto' : 'PIN incorrecto';
  if (typeof remaining === 'number') {
    return `${what} · ${remaining === 1 ? 'te queda 1 intento' : `te quedan ${remaining} intentos`}`;
  }
  return error.message;
}

/** Tras retirar: cuántas unidades lleva en la quincena abierta y en qué puesto va. */
async function loadStanding(result: KioskMovementResult) {
  standing.value = null;
  try {
    const ranking = await services.kiosk.topWithdrawers('period', 50);
    const mine = ranking.find((row) => row.user.id === result.person.id);
    if (!mine) return;
    standing.value = {
      units: mine.totalWithdrawn,
      position: 1 + ranking.filter((row) => row.totalWithdrawn > mine.totalWithdrawn).length,
    };
  } catch {
    // Sin quincena abierta (o sin conexión): no se muestra.
  }
}

async function withdraw(pin: string) {
  if (busy.value) return;
  busy.value = true;
  pendingPin.value = pin;
  const lines = cart.lines.value.map((l) => ({ name: l.product.name, quantity: l.quantity }));
  const slow = setTimeout(() => {
    deliveredLines.value = lines;
    phase.value = 'processing';
    screen.value = 'delivery';
  }, PROCESSING_AFTER_MS);
  try {
    const result = await kiosk.register({ pin, type: 'OUT', items: cart.items.value });
    clearTimeout(slow);
    deliveredLines.value = lines;
    personName.value = result.person.name;
    phase.value = 'delivered';
    screen.value = 'delivery';
    await loadStanding(result);
  } catch (e) {
    clearTimeout(slow);
    if (e instanceof ApiError && PIN_ERRORS.includes(e.code)) {
      screen.value = 'machine';
      machine.rejectEntry(screenMessage(e));
    } else if (e instanceof ApiError && STOCK_ERRORS.includes(e.code)) {
      // Otra persona sacó algo mientras tanto: se actualiza el stock y se ajusta el retiro.
      await kiosk.refresh().catch(() => undefined);
      const adjusted = cart.syncStock(kiosk.products);
      screen.value = 'machine';
      machine.rejectEntry(adjusted.length ? `Cambió el stock de ${joinList(adjusted)} · revisa tu retiro` : e.message);
    } else {
      deliveredLines.value = lines;
      errorInfo.value =
        e instanceof ApiError && e.status > 0
          ? { title: 'No se pudo registrar', text: `${errorMessage(e)} No se descontó nada del stock.` }
          : {
              title: 'Se perdió la conexión con el servidor',
              text: 'No se descontó nada del stock. Reintenta para que quede registrado a tu nombre.',
            };
      phase.value = 'error';
      screen.value = 'delivery';
    }
  } finally {
    busy.value = false;
  }
}

/** Fin de la entrega: vuelve a la máquina vacía con el aviso de lo que se retiró. */
function finishDelivery() {
  const name = personName.value;
  const text = `retiró ${joinList(deliveredLines.value.map((l) => `${l.quantity} ${l.name}`))}${
    standing.value ? ` · llevas ${standing.value.units} esta quincena` : ''
  }`;
  machine.reset();
  screen.value = 'machine';
  phoneStep.value = 'select';
  search.value = '';
  personName.value = null;
  if (name) showToast({ name, text, tone: 'ok' });
}

function backFromError() {
  screen.value = 'machine';
  machine.clear();
}

async function enterAdmin(code: string) {
  if (busy.value) return;
  busy.value = true;
  try {
    await auth.loginWithCode(code);
    machine.reset();
    phoneStep.value = 'select';
    void router.push('/admin');
  } catch (e) {
    machine.rejectEntry(
      e instanceof ApiError && PIN_ERRORS.includes(e.code) ? screenMessage(e) : errorMessage(e),
    );
  } finally {
    busy.value = false;
  }
}

function onPinChanged(name: string) {
  screen.value = 'machine';
  showToast({ name, text: 'tu PIN se cambió.', tone: 'info' });
}

// Inactividad: si quedó algo a medias, se limpia.
useIdle(
  IDLE_MS,
  () => {
    machine.reset();
    search.value = '';
    phoneStep.value = 'select';
    if (screen.value === 'change-pin') screen.value = 'machine';
  },
  () =>
    screen.value !== 'delivery' &&
    (!cart.isEmpty.value ||
      machine.entry.value !== '' ||
      search.value !== '' ||
      phoneStep.value !== 'select' ||
      screen.value !== 'machine'),
);

// Stock al día mientras la máquina espera.
let refreshTimer: ReturnType<typeof setInterval> | undefined;
onMounted(() => {
  refreshTimer = setInterval(async () => {
    if (kiosk.status !== 'ready' || screen.value !== 'machine') return;
    await kiosk.refresh().catch(() => undefined);
    cart.syncStock(kiosk.products);
  }, REFRESH_MS);
});
onBeforeUnmount(() => {
  clearInterval(refreshTimer);
  clearTimeout(toastTimer);
});

useOnEnter(async () => {
  if (kiosk.status === 'ready') await kiosk.refresh().catch(() => undefined);
  else await kiosk.init();
});

// Botón "atrás" de Android: retrocede un paso; en la máquina no hace nada (la tablet no se cierra sola).
let backButton: { unregister: () => void } | undefined;
onIonViewDidEnter(() => {
  backButton = useBackButton(10, () => {
    if (screen.value === 'change-pin') screen.value = 'machine';
    else if (screen.value === 'machine' && machine.entry.value) machine.back();
    else if (phoneKeypad.value) toSelect();
  });
});
onIonViewWillLeave(() => backButton?.unregister());

const native = isNative();
function authorize() {
  void router.push({ path: '/admin/tablets', query: { autorizar: '1' } });
}

const ready = computed(() => kiosk.status === 'ready' || kiosk.status === 'offline');
const keypadProps = computed(() => ({
  display: machine.display.value,
  okAction: machine.okAction.value,
  okEnabled: machine.okEnabled.value,
  busy: busy.value,
}));
const keypadEvents = {
  digit: machine.digit,
  back: machine.back,
  clear: machine.clear,
  ok: machine.ok,
};
</script>

<template>
  <IonPage>
    <IonContent :fullscreen="true" :scroll-y="screen !== 'machine' || !large">
      <SplashScreen v-if="kiosk.status === 'loading'" />

      <!-- Tablet sin autorizar -->
      <div
        v-else-if="kiosk.status === 'unpaired' || kiosk.status === 'revoked'"
        class="grid min-h-full place-items-center px-4 pt-[calc(var(--ion-safe-area-top)+1rem)] pb-[calc(var(--ion-safe-area-bottom)+1rem)] text-center"
      >
        <div class="card w-full max-w-md px-6 py-8 sm:px-10">
          <FridgeLogo class="mx-auto mb-5 size-20" />
          <h1 class="text-2xl font-black text-ink-900">
            {{ kiosk.status === 'revoked' ? 'Esta tablet fue desautorizada' : 'Esta tablet aún no está autorizada' }}
          </h1>
          <p class="mt-3 text-ink-500">
            Un administrador debe autorizarla una vez para que el equipo pueda retirar con su PIN.
          </p>
          <button type="button" class="btn-primary mt-8 min-h-14 w-full px-8 text-lg" @click="authorize">
            <Icon name="lock" :size="18" /> Autorizar esta tablet
          </button>
          <button
            v-if="native"
            type="button"
            class="mx-auto mt-4 block min-h-11 text-sm font-bold text-ink-500"
            @click="router.push('/configurar-servidor')"
          >
            Cambiar servidor
          </button>
        </div>
      </div>

      <template v-else-if="ready">
        <DeliveryScene
          v-if="screen === 'delivery'"
          :phase="phase"
          :lines="deliveredLines"
          :person-name="personName"
          :standing="standing"
          :error-title="errorInfo.title"
          :error-text="errorInfo.text"
          @done="finishDelivery"
          @back="backFromError"
          @retry="withdraw(pendingPin)"
        />

        <div v-else-if="screen === 'change-pin'" class="change-pin">
          <KioskChangePin @done="onPinChanged" @cancel="screen = 'machine'" />
        </div>

        <!-- Celular, paso 1: la máquina (mockup Main) -->
        <div v-else-if="!large && phoneStep === 'select'" class="phone">
          <MachineHeader :top="kiosk.topWithdrawer" admin @admin="toKeypad" />
          <div class="flex items-center justify-between gap-2 px-1">
            <h1 class="shrink-0 font-display text-lg font-black text-ink-900">¿Qué vas a retirar?</h1>
            <MachineSearch v-model="search" class="w-full max-w-[190px]" />
          </div>
          <OfflineBanner v-if="kiosk.status === 'offline'" @retry="kiosk.init()" />
          <MachineCabinet
            class="cabinet"
            :products="visibleProducts"
            :empty-text="emptyText"
            :in-cart="cart.quantityOf"
            :left="machine.left"
            @pick="machine.add($event)"
          />
          <MachineCart
            withdraw
            :lines="cart.lines.value"
            :total="cart.totalUnits.value"
            @remove="machine.remove"
            @withdraw="toKeypad"
          />
          <p v-if="machine.display.value.isError" class="px-1 text-[12px] font-bold text-danger-700" role="alert">
            {{ machine.display.value.sub }}
          </p>
        </div>

        <!-- Celular, paso 2: el PIN (o el código de administrador) -->
        <div v-else-if="!large" class="phone phone-pin">
          <div class="flex items-center gap-2.5">
            <button
              type="button"
              class="glass grid size-10 shrink-0 place-items-center rounded-full text-ink-900"
              aria-label="Volver a la máquina"
              @click="toSelect"
            >
              <Icon name="chevronLeft" :size="20" :stroke="2.4" />
            </button>
            <h1 class="font-display text-[21px] font-black text-ink-900">
              {{ machine.step.value === 'pin' ? 'Escribe tu PIN' : 'Código de administrador' }}
            </h1>
          </div>
          <p class="px-1 text-[13px] text-ink-700">
            <template v-if="machine.step.value === 'pin'">Tu PIN te identifica: no hace falta elegir tu nombre.</template>
            <template v-else>Los administradores entran con su código de 4 a 6 dígitos.</template>
          </p>
          <MachineCart
            v-if="!cart.isEmpty.value"
            :lines="cart.lines.value"
            :total="cart.totalUnits.value"
            @remove="machine.remove"
          />
          <MachineKeypad class="mt-auto" v-bind="keypadProps" v-on="keypadEvents" />
          <button
            v-if="machine.step.value === 'pin'"
            type="button"
            class="self-center text-[13px] font-extrabold text-brand-700"
            @click="screen = 'change-pin'"
          >
            Cambiar mi PIN
          </button>
          <RouterLink v-else to="/admin/login" class="self-center text-[13px] font-extrabold text-brand-700">
            ¿Sin código? Entrar con correo
          </RouterLink>
        </div>

        <!-- Tablet en horizontal (mockup MaquinaTablet) -->
        <div v-else class="tablet">
          <MachineCabinet
            large
            :products="visibleProducts"
            :empty-text="emptyText"
            :in-cart="cart.quantityOf"
            :left="machine.left"
            @pick="machine.add($event)"
          >
            <template #top>
              <div class="flex items-center justify-between gap-3 px-1">
                <div class="flex items-center gap-2.5">
                  <FridgeLogo variant="mini" class="size-[34px]" />
                  <span class="font-display text-[22px] font-black tracking-[-0.4px] text-white">
                    Fridge<span class="text-brand-300">YA</span>
                  </span>
                </div>
                <div class="flex min-w-0 items-center gap-3">
                  <h1 class="shrink-0 text-[15px] font-extrabold text-[#9fd3f5]">¿Qué vas a retirar?</h1>
                  <MachineSearch v-model="search" dark class="w-[240px]" />
                </div>
              </div>
            </template>
          </MachineCabinet>
          <div class="side">
            <MachineHeader :top="kiosk.topWithdrawer" compact long />
            <OfflineBanner v-if="kiosk.status === 'offline'" @retry="kiosk.init()" />
            <MachineCart
              large
              :lines="cart.lines.value"
              :total="cart.totalUnits.value"
              @remove="machine.remove"
            />
            <MachineKeypad large v-bind="keypadProps" v-on="keypadEvents" />
            <button
              v-if="machine.step.value === 'pin'"
              type="button"
              class="self-center text-sm font-extrabold text-brand-700"
              @click="screen = 'change-pin'"
            >
              Cambiar mi PIN
            </button>
            <RouterLink
              v-else-if="machine.entry.value"
              to="/admin/login"
              class="self-center text-sm font-extrabold text-brand-700"
            >
              ¿Sin código? Entrar con correo
            </RouterLink>
          </div>
        </div>

        <!-- Al volver: lo que se retiró (mockup MaquinaRegreso) -->
        <Transition name="toast">
          <div v-if="toast && screen === 'machine'" class="toast glass-strong" role="status">
            <span class="grid size-7 shrink-0 place-items-center rounded-full bg-success-700 text-white">
              <Icon name="check" :size="16" :stroke="3" />
            </span>
            <span class="flex-1 text-[12px] text-ink-800">
              <strong class="text-ink-900">{{ toast.name }}</strong> {{ toast.text }}
            </span>
          </div>
        </Transition>
      </template>
    </IonContent>
  </IonPage>
</template>

<style scoped>
.phone {
  display: flex;
  min-height: 100%;
  flex-direction: column;
  gap: 8px;
  padding: calc(var(--ion-safe-area-top) + 1.25rem) calc(14px + var(--ion-safe-area-right))
    calc(var(--ion-safe-area-bottom) + 1rem) calc(14px + var(--ion-safe-area-left));
}
/* Pantallas con alto suficiente: todo cabe y la vitrina se desplaza por dentro si hay muchos productos. */
@media (min-height: 700px) {
  .phone {
    height: 100%;
  }
  .phone .cabinet {
    flex: 1 1 auto;
    min-height: 150px;
  }
}
.phone-pin {
  height: auto;
  min-height: 100%;
  gap: 12px;
}
.tablet {
  display: grid;
  height: 100%;
  grid-template-columns: minmax(0, 1fr) minmax(340px, 380px);
  gap: 20px;
  padding: calc(var(--ion-safe-area-top) + 24px) calc(24px + var(--ion-safe-area-right))
    calc(var(--ion-safe-area-bottom) + 24px) calc(24px + var(--ion-safe-area-left));
}
.side {
  display: flex;
  min-height: 0;
  flex-direction: column;
  gap: 12px;
}
.change-pin {
  display: flex;
  min-height: 100%;
  flex-direction: column;
  padding: calc(var(--ion-safe-area-top) + 1.5rem) 1rem calc(var(--ion-safe-area-bottom) + 1rem);
}
.toast {
  position: fixed;
  z-index: 30;
  top: calc(var(--ion-safe-area-top) + 4.25rem);
  left: calc(14px + var(--ion-safe-area-left));
  right: calc(14px + var(--ion-safe-area-right));
  max-width: 560px;
  margin-inline: auto;
  min-height: 44px;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 12px;
  border-radius: 14px;
  box-shadow: 0 10px 26px rgb(7 59 94 / 0.18);
}
/* Tablet: el aviso va sobre la vitrina, encima de la bandeja (arriba tapaba el buscador). */
@media (min-width: 900px) and (min-height: 600px) {
  .toast {
    top: auto;
    bottom: calc(var(--ion-safe-area-bottom) + 140px);
    left: calc(48px + var(--ion-safe-area-left));
    right: auto;
    width: min(560px, 55vw);
    margin-inline: 0;
  }
}
.toast-enter-active,
.toast-leave-active {
  transition:
    opacity 0.25s,
    transform 0.25s;
}
.toast-enter-from,
.toast-leave-to {
  opacity: 0;
  transform: translateY(-8px);
}
</style>
