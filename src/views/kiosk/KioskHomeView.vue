<script setup lang="ts">
import {
  IonContent,
  IonLabel,
  IonPage,
  IonSegment,
  IonSegmentButton,
  onIonViewDidEnter,
  onIonViewWillLeave,
  useBackButton,
} from '@ionic/vue';
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import CartPanel from '@/components/kiosk/CartPanel.vue';
import KioskChangePin from '@/components/kiosk/KioskChangePin.vue';
import KioskMovementsPanel from '@/components/kiosk/KioskMovementsPanel.vue';
import KioskRankingPanel from '@/components/kiosk/KioskRankingPanel.vue';
import KioskSuccess from '@/components/kiosk/KioskSuccess.vue';
import PersonPicker from '@/components/kiosk/PersonPicker.vue';
import PinPad from '@/components/kiosk/PinPad.vue';
import ProductTile from '@/components/kiosk/ProductTile.vue';
import Icon from '@/components/ui/Icon.vue';
import { useIdle } from '@/composables/useIdle';
import { useKioskCart } from '@/composables/useKioskCart';
import { useOnEnter } from '@/composables/useOnEnter';
import type { KioskMovementResult, KioskPerson, MovementType } from '@/domain/models';
import { ApiError, errorMessage } from '@/services/errors';
import { isNative } from '@/native/platform';
import { useKioskStore } from '@/stores/kiosk';
import { formatNumber, fullName } from '@/utils/format';

/** Vuelve al inicio tras este tiempo sin tocar la pantalla (si había algo a medias). */
const IDLE_MS = 60_000;
const REFRESH_MS = 60_000;
const STOCK_ERRORS = ['INSUFFICIENT_STOCK', 'PRODUCT_INACTIVE', 'PRODUCT_NOT_FOUND'];

type Tab = 'OUT' | 'IN' | 'ranking' | 'log';
type Step = 'products' | 'person' | 'pin' | 'change-pin' | 'done';

const kiosk = useKioskStore();
const router = useRouter();

const tab = ref<Tab>('OUT');
const type = computed<MovementType>(() => (tab.value === 'IN' ? 'IN' : 'OUT'));
const cart = useKioskCart(type);
const step = ref<Step>('products');
const person = ref<KioskPerson | null>(null);
const pinError = ref<string | null>(null);
const submitting = ref(false);
const result = ref<KioskMovementResult | null>(null);
const notice = ref<{ kind: 'info' | 'warning'; text: string } | null>(null);
const search = ref('');
const loadingPeople = ref(false);

const products = computed(() => {
  const term = search.value.trim().toLowerCase();
  return kiosk.activeProducts.filter((p) => !term || p.name.toLowerCase().includes(term));
});

function resetAll() {
  step.value = 'products';
  tab.value = 'OUT';
  cart.clear();
  person.value = null;
  pinError.value = null;
  result.value = null;
  search.value = '';
}

// Cambiar entre Sacar y Meter empieza una lista nueva.
watch(tab, () => {
  cart.clear();
  step.value = 'products';
  notice.value = null;
});

/** Las personas ya vienen cargadas con el stock: se muestran al instante y se actualizan en segundo plano. */
async function goToPeople() {
  notice.value = null;
  step.value = 'person';
  loadingPeople.value = kiosk.people.length === 0;
  try {
    await kiosk.loadPeople();
  } catch (e) {
    if (!kiosk.people.length) notice.value = { kind: 'warning', text: errorMessage(e) };
  } finally {
    loadingPeople.value = false;
  }
}

function selectPerson(selected: KioskPerson) {
  person.value = selected;
  pinError.value = null;
  step.value = 'pin';
}

function lockedMessage(error: ApiError): string {
  const until = (error.details as { lockedUntil?: string } | undefined)?.lockedUntil;
  const time = until
    ? new Date(until).toLocaleTimeString('es-CO', { hour: 'numeric', minute: '2-digit' })
    : null;
  return time
    ? `Demasiados intentos. Podrás volver a intentarlo a las ${time}, o pide al administrador que restablezca tu PIN.`
    : error.message;
}

async function submitPin(pin: string) {
  if (!person.value) return;
  submitting.value = true;
  pinError.value = null;
  try {
    result.value = await kiosk.register({
      personId: person.value.id,
      pin,
      type: type.value,
      items: cart.items.value,
    });
    cart.clear();
    step.value = 'done';
  } catch (e) {
    if (e instanceof ApiError && e.code === 'PIN_LOCKED') pinError.value = lockedMessage(e);
    else if (e instanceof ApiError && STOCK_ERRORS.includes(e.code)) {
      // Otra persona sacó algo mientras tanto: se actualiza el stock y se ajusta la lista.
      await kiosk.refresh().catch(() => undefined);
      const adjusted = cart.syncStock(kiosk.products);
      notice.value = {
        kind: 'warning',
        text: adjusted.length
          ? `Cambió el stock de ${adjusted.join(', ')} mientras elegías. Revisa tu lista.`
          : e.message,
      };
      step.value = 'products';
    } else pinError.value = errorMessage(e);
  } finally {
    submitting.value = false;
  }
}

function onPinChanged() {
  notice.value = { kind: 'info', text: `${person.value?.name ?? ''}, tu PIN se cambió.` };
  step.value = cart.isEmpty.value ? 'products' : 'pin';
  pinError.value = null;
}

function goBack() {
  if (step.value === 'pin') step.value = 'person';
  else step.value = 'products';
}

// Inactividad: si quedó algo a medias, se limpia y vuelve al inicio.
useIdle(IDLE_MS, resetAll, () => step.value !== 'products' || !cart.isEmpty.value || tab.value !== 'OUT');

// Datos al día mientras la tablet espera en el inicio.
let refreshTimer: ReturnType<typeof setInterval> | undefined;
onMounted(() => {
  refreshTimer = setInterval(async () => {
    if (kiosk.status !== 'ready' || step.value !== 'products') return;
    await kiosk.refresh().catch(() => undefined);
    cart.syncStock(kiosk.products);
  }, REFRESH_MS);
});
onBeforeUnmount(() => clearInterval(refreshTimer));

useOnEnter(async () => {
  resetAll();
  if (kiosk.status === 'ready') await kiosk.refresh().catch(() => undefined);
  else await kiosk.init();
});

// Botón "atrás" de Android: retrocede un paso; en el inicio no hace nada (la tablet no se cierra sola).
let backButton: { unregister: () => void } | undefined;
onIonViewDidEnter(() => {
  backButton = useBackButton(10, () => {
    if (step.value === 'products' || step.value === 'done') return;
    if (step.value === 'change-pin') step.value = 'pin';
    else goBack();
  });
});
onIonViewWillLeave(() => backButton?.unregister());

const native = isNative();

function openAdmin() {
  void router.push('/admin');
}

function authorize() {
  void router.push({ path: '/admin/tablets', query: { autorizar: '1' } });
}

const stepTitle = computed(() => {
  if (step.value === 'person') return '¿Quién eres?';
  if (step.value === 'pin') return `Hola, ${person.value?.name ?? ''}`;
  if (step.value === 'change-pin') return 'Cambiar mi PIN';
  return '';
});
</script>

<template>
  <IonPage>
    <IonContent>
      <div class="flex min-h-full flex-col bg-ink-50">
        <!-- Cabecera: marca, quién más retira (siempre visible) y acceso a la administración -->
        <header class="flex flex-wrap items-center gap-x-6 gap-y-3 bg-white px-5 py-4 shadow-sm md:px-8">
          <div class="flex items-center gap-2">
            <img src="/favicon.svg" alt="" class="size-9" />
            <span class="text-2xl font-bold tracking-tight text-ink-900"
              >Fridge<span class="text-brand-700">YA</span></span
            >
          </div>

          <div
            v-if="kiosk.isPaired"
            class="flex min-w-0 flex-1 items-center gap-3 rounded-2xl bg-brand-50 px-4 py-2"
            aria-live="polite"
          >
            <span class="grid size-10 shrink-0 place-items-center rounded-xl bg-brand-700 text-white">
              <Icon name="trophy" :size="22" />
            </span>
            <div class="min-w-0">
              <p class="text-xs text-ink-500">Quien más retira</p>
              <p v-if="kiosk.topWithdrawer" class="truncate text-lg font-bold text-ink-900">
                {{ fullName(kiosk.topWithdrawer.user) }}
                <span class="text-base font-normal text-ink-500">
                  · {{ formatNumber(kiosk.topWithdrawer.totalWithdrawn) }} und.
                </span>
              </p>
              <p v-else class="text-lg font-semibold text-ink-600">Aún nadie</p>
            </div>
          </div>
          <div v-else class="flex-1" />

          <button
            type="button"
            class="grid size-11 place-items-center rounded-xl text-ink-400 hover:bg-ink-100 hover:text-ink-700"
            aria-label="Administración"
            title="Administración"
            @click="openAdmin"
          >
            <Icon name="lock" :size="22" />
          </button>
        </header>

        <!-- Estados de la tablet -->
        <div v-if="kiosk.status === 'loading'" class="grid flex-1 place-items-center text-ink-500">
          Cargando…
        </div>

        <div
          v-else-if="kiosk.status === 'unpaired' || kiosk.status === 'revoked'"
          class="grid flex-1 place-items-center px-6 text-center"
        >
          <div class="max-w-md">
            <span class="mx-auto mb-5 grid size-20 place-items-center rounded-full bg-ink-100 text-ink-500">
              <Icon name="tablet" :size="40" />
            </span>
            <h1 class="text-2xl font-bold text-ink-900">
              {{
                kiosk.status === 'revoked'
                  ? 'Esta tablet fue desautorizada'
                  : 'Esta tablet aún no está autorizada'
              }}
            </h1>
            <p class="mt-3 text-ink-600">
              Un administrador debe autorizarla una vez para que el equipo pueda registrar lo que saca y mete
              con su PIN.
            </p>
            <button type="button" class="btn-primary mt-8 px-8 py-4 text-lg" @click="authorize">
              <Icon name="lock" :size="18" /> Autorizar esta tablet
            </button>
            <button
              v-if="native"
              type="button"
              class="mx-auto mt-4 block text-sm font-medium text-ink-500"
              @click="router.push('/configurar-servidor')"
            >
              Cambiar servidor
            </button>
          </div>
        </div>

        <template v-else>
          <p
            v-if="kiosk.status === 'offline'"
            class="mx-5 mt-4 rounded-xl bg-warning-50 px-4 py-3 text-warning-700 md:mx-8"
            role="alert"
          >
            Sin conexión con el servidor. {{ kiosk.offlineMessage }}
            <button type="button" class="ml-2 font-semibold underline" @click="kiosk.init()">
              Reintentar
            </button>
          </p>

          <!-- Pestañas (solo en el inicio) o título del paso -->
          <div class="px-5 pt-5 md:px-8">
            <IonSegment
              v-if="step === 'products' || step === 'done'"
              :value="tab"
              class="kiosk-tabs"
              @ion-change="tab = $event.detail.value as Tab"
            >
              <IonSegmentButton value="OUT"><IonLabel>Sacar</IonLabel></IonSegmentButton>
              <IonSegmentButton value="IN"><IonLabel>Meter</IonLabel></IonSegmentButton>
              <IonSegmentButton value="ranking"><IonLabel>Ranking</IonLabel></IonSegmentButton>
              <IonSegmentButton value="log"><IonLabel>Movimientos</IonLabel></IonSegmentButton>
            </IonSegment>
            <div v-else class="flex items-center gap-3">
              <button type="button" class="btn-secondary px-4 py-3 text-base" @click="goBack">
                <Icon name="chevronLeft" :size="20" /> Atrás
              </button>
              <h1 class="text-2xl font-bold text-ink-900">{{ stepTitle }}</h1>
            </div>
          </div>

          <main class="flex-1 px-5 py-5 md:px-8">
            <p
              v-if="notice && step === 'products'"
              class="mb-4 flex items-center gap-2 rounded-xl px-4 py-3"
              :class="
                notice.kind === 'warning' ? 'bg-warning-50 text-warning-700' : 'bg-brand-50 text-brand-800'
              "
              role="status"
            >
              <Icon :name="notice.kind === 'warning' ? 'alert' : 'check'" :size="18" /> {{ notice.text }}
            </p>

            <KioskRankingPanel v-if="tab === 'ranking' && step === 'products'" />
            <KioskMovementsPanel
              v-else-if="tab === 'log' && step === 'products'"
              :movements="kiosk.latestMovements"
            />

            <template v-else>
              <!-- 1. Elegir productos -->
              <div v-if="step === 'products'" class="grid grid-cols-1 gap-5 lg:grid-cols-[1fr_22rem]">
                <div>
                  <input
                    v-if="kiosk.activeProducts.length > 12"
                    v-model="search"
                    type="search"
                    class="input mb-4 py-3 text-lg"
                    placeholder="Buscar producto…"
                    aria-label="Buscar producto"
                  />
                  <p v-if="!kiosk.activeProducts.length" class="py-10 text-center text-ink-500">
                    Todavía no hay productos. El administrador puede crearlos.
                  </p>
                  <div class="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-4">
                    <ProductTile
                      v-for="product in products"
                      :key="product.id"
                      :product="product"
                      :type="type"
                      :in-cart="cart.quantityOf(product.id)"
                      :disabled="!cart.canAdd(product) && !cart.quantityOf(product.id)"
                      @add="cart.add(product)"
                    />
                  </div>
                </div>
                <div class="lg:sticky lg:top-4 lg:h-[calc(100vh-14rem)]">
                  <CartPanel :cart="cart" :type="type" @continue="goToPeople" />
                </div>
              </div>

              <!-- 2. ¿Quién eres? -->
              <PersonPicker
                v-else-if="step === 'person'"
                :people="kiosk.people"
                :loading="loadingPeople"
                @select="selectPerson"
              />

              <!-- 3. PIN -->
              <div v-else-if="step === 'pin' && person" class="py-2">
                <PinPad
                  label="Escribe tu PIN"
                  :error="pinError"
                  :disabled="submitting"
                  @complete="submitPin"
                />
                <div class="mt-6 text-center text-sm text-ink-500">
                  <p>¿Olvidaste tu PIN? Pídele al administrador que lo restablezca.</p>
                  <button
                    type="button"
                    class="mt-2 font-semibold text-brand-700"
                    @click="step = 'change-pin'"
                  >
                    Cambiar mi PIN
                  </button>
                </div>
              </div>

              <KioskChangePin
                v-else-if="step === 'change-pin' && person"
                :person="person"
                @done="onPinChanged"
                @cancel="step = 'pin'"
              />

              <!-- 4. Listo -->
              <KioskSuccess v-else-if="step === 'done' && result" :result="result" @done="resetAll" />
            </template>
          </main>
        </template>
      </div>
    </IonContent>
  </IonPage>
</template>

<style scoped>
.kiosk-tabs {
  --background: white;
  max-width: 44rem;
  font-size: 1.05rem;
}
.kiosk-tabs ion-segment-button {
  --indicator-color: var(--color-brand-700);
  --color-checked: var(--color-brand-800);
  min-height: 52px;
  font-weight: 600;
  text-transform: none;
  letter-spacing: 0;
}
</style>
