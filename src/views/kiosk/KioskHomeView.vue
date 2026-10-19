<script setup lang="ts">
import { IonContent, IonPage, onIonViewDidEnter, onIonViewWillLeave, useBackButton } from '@ionic/vue';
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import FridgeLogo from '@/components/brand/FridgeLogo.vue';
import LoadingFridge from '@/components/brand/LoadingFridge.vue';
import CartPanel from '@/components/kiosk/CartPanel.vue';
import KioskChangePin from '@/components/kiosk/KioskChangePin.vue';
import KioskMovementsPanel from '@/components/kiosk/KioskMovementsPanel.vue';
import KioskNav, { type KioskTab } from '@/components/kiosk/KioskNav.vue';
import KioskPinStep from '@/components/kiosk/KioskPinStep.vue';
import KioskRankingPanel from '@/components/kiosk/KioskRankingPanel.vue';
import KioskSuccess, { type KioskStanding } from '@/components/kiosk/KioskSuccess.vue';
import KioskTopBar from '@/components/kiosk/KioskTopBar.vue';
import PersonPicker from '@/components/kiosk/PersonPicker.vue';
import ProductTile from '@/components/kiosk/ProductTile.vue';
import StepIndicator from '@/components/kiosk/StepIndicator.vue';
import Icon from '@/components/ui/Icon.vue';
import { useIdle } from '@/composables/useIdle';
import { useKioskCart } from '@/composables/useKioskCart';
import { useOnEnter } from '@/composables/useOnEnter';
import type { KioskMovementResult, KioskPerson, MovementType } from '@/domain/models';
import { useServices } from '@/services/container';
import { ApiError, errorMessage } from '@/services/errors';
import { isNative } from '@/native/platform';
import { useKioskStore } from '@/stores/kiosk';

/** Vuelve al inicio tras este tiempo sin tocar la pantalla (si había algo a medias). */
const IDLE_MS = 60_000;
const REFRESH_MS = 60_000;
const STOCK_ERRORS = ['INSUFFICIENT_STOCK', 'PRODUCT_INACTIVE', 'PRODUCT_NOT_FOUND'];

type Step = 'products' | 'person' | 'pin' | 'change-pin' | 'done';

const kiosk = useKioskStore();
const services = useServices();
const router = useRouter();

const tab = ref<KioskTab>('OUT');
const type = computed<MovementType>(() => (tab.value === 'IN' ? 'IN' : 'OUT'));
const cart = useKioskCart(type);
const step = ref<Step>('products');
const person = ref<KioskPerson | null>(null);
const pinError = ref<string | null>(null);
const submitting = ref(false);
const result = ref<KioskMovementResult | null>(null);
const standing = ref<KioskStanding | null>(null);
const notice = ref<{ kind: 'info' | 'warning'; text: string } | null>(null);
const search = ref('');
const category = ref<string | null>(null);
const loadingPeople = ref(false);

// --- Productos y categorías ---
/** Categorías que tienen algún producto activo (las demás no sirven como filtro). */
const usedCategories = computed(() =>
  kiosk.categories.filter((c) => kiosk.activeProducts.some((p) => p.categoryId === c.id)),
);
/** Filtrar solo tiene sentido si hay al menos dos grupos (contando los productos sin categoría). */
const showCategories = computed(
  () => usedCategories.value.length + (kiosk.activeProducts.some((p) => !p.categoryId) ? 1 : 0) > 1,
);
const categoryName = computed(() => new Map(kiosk.categories.map((c) => [c.id, c.name])));
const products = computed(() => {
  const term = search.value.trim().toLowerCase();
  const filter = usedCategories.value.some((c) => c.id === category.value) ? category.value : null;
  return kiosk.activeProducts.filter(
    (p) => (!term || p.name.toLowerCase().includes(term)) && (!filter || p.categoryId === filter),
  );
});

/** "2 Coca cola y 1 Chocorramo" en negrita, como partes para la plantilla. */
const cartParts = computed(() =>
  cart.lines.value.map((l) => ({ key: l.product.id, text: `${l.quantity} ${l.product.name}` })),
);

function resetAll() {
  step.value = 'products';
  tab.value = 'OUT';
  cart.clear();
  person.value = null;
  pinError.value = null;
  result.value = null;
  standing.value = null;
  search.value = '';
  category.value = null;
}

// Cambiar entre pestañas (Sacar, Meter…) empieza una lista nueva.
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

/** Tras sacar: cuántas unidades lleva en la quincena abierta y en qué puesto va (si hay quincena). */
async function loadStanding(registered: KioskMovementResult) {
  standing.value = null;
  if (registered.type !== 'OUT') return;
  try {
    const ranking = await services.kiosk.topWithdrawers('period', 50);
    const mine = ranking.find((row) => row.user.id === registered.person.id);
    if (!mine || result.value !== registered) return;
    standing.value = {
      units: mine.totalWithdrawn,
      position: 1 + ranking.filter((row) => row.totalWithdrawn > mine.totalWithdrawn).length,
    };
  } catch {
    // Sin quincena abierta (o sin conexión): simplemente no se muestra.
  }
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
    void loadStanding(result.value);
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

const ready = computed(() => kiosk.status === 'ready' || kiosk.status === 'offline');
/** La navegación y la cabecera solo en el inicio; los pasos de sacar/meter ocupan toda la pantalla. */
const showNav = computed(() => ready.value && step.value === 'products');
/** Tablet en horizontal: Sacar/Meter y Ranking llenan el alto y se desplazan por dentro. */
const fill = computed(() => showNav.value && tab.value !== 'log');

/** Texto para lectores de pantalla al cambiar de paso. */
const announcement = computed(() => {
  if (step.value === 'person') return 'Paso 2 de 3: ¿Quién eres?';
  if (step.value === 'pin') return `Paso 3 de 3: Hola, ${person.value?.name ?? ''}. Escribe tu PIN.`;
  if (step.value === 'change-pin') return 'Cambiar mi PIN';
  return '';
});
</script>

<template>
  <IonPage>
    <div class="kiosk-frame" :class="{ 'with-nav': showNav }">
      <KioskNav v-if="showNav" :tab="tab" @select="tab = $event" @admin="openAdmin" />

      <IonContent class="kiosk-content">
        <p class="sr-only" aria-live="polite">{{ announcement }}</p>

        <!-- Estados de la tablet -->
        <div v-if="kiosk.status === 'loading'" class="kiosk-main grid place-items-center">
          <LoadingFridge />
        </div>

        <div
          v-else-if="kiosk.status === 'unpaired' || kiosk.status === 'revoked'"
          class="kiosk-main grid place-items-center text-center"
        >
          <div class="card w-full max-w-md px-6 py-8 sm:px-10">
            <FridgeLogo class="mx-auto mb-5 size-20" />
            <h1 class="text-2xl font-black text-ink-900 sm:text-3xl">
              {{
                kiosk.status === 'revoked'
                  ? 'Esta tablet fue desautorizada'
                  : 'Esta tablet aún no está autorizada'
              }}
            </h1>
            <p class="mt-3 text-ink-500">
              Un administrador debe autorizarla una vez para que el equipo pueda registrar lo que saca y mete
              con su PIN.
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

        <div v-else class="kiosk-main" :class="{ 'is-fill': fill, 'is-step': step !== 'products' }">
          <p
            v-if="kiosk.status === 'offline'"
            class="flex flex-wrap items-center gap-x-2 rounded-2xl border border-warning-600/20 bg-warning-50/85 px-4 py-3 text-warning-700"
            role="alert"
          >
            <Icon name="alert" :size="18" /> Sin conexión con el servidor. {{ kiosk.offlineMessage }}
            <button type="button" class="min-h-11 font-extrabold underline" @click="kiosk.init()">
              Reintentar
            </button>
          </p>

          <!-- Inicio: cabecera y pestañas -->
          <template v-if="step === 'products'">
            <KioskTopBar :top="kiosk.topWithdrawer" />

            <div v-if="tab === 'ranking'" class="min-h-0 flex-1">
              <KioskRankingPanel />
            </div>
            <KioskMovementsPanel v-else-if="tab === 'log'" :movements="kiosk.latestMovements" />

            <!-- 1. Elegir productos -->
            <div v-else class="products-layout">
              <div class="products-col">
                <div class="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                  <h1 class="text-[26px] font-black tracking-tight text-ink-900 sm:text-[30px]">
                    {{ type === 'OUT' ? '¿Qué vas a sacar?' : '¿Qué vas a meter?' }}
                  </h1>
                  <p class="text-[15px] text-ink-500">Toca para agregar</p>
                </div>

                <p
                  v-if="notice"
                  class="flex items-center gap-2 rounded-2xl border px-4 py-3"
                  :class="
                    notice.kind === 'warning'
                      ? 'border-warning-600/20 bg-warning-50/85 text-warning-700'
                      : 'border-brand-200/70 bg-brand-50/80 text-brand-800'
                  "
                  role="status"
                >
                  <Icon :name="notice.kind === 'warning' ? 'alert' : 'check'" :size="18" class="shrink-0" />
                  {{ notice.text }}
                </p>

                <div
                  v-if="showCategories"
                  class="chips -mx-1 flex gap-2 overflow-x-auto px-1 pb-1"
                  role="group"
                  aria-label="Categorías"
                >
                  <button
                    type="button"
                    class="chip min-h-12 shrink-0 px-5! text-base!"
                    :aria-pressed="category === null"
                    @click="category = null"
                  >
                    Todo
                  </button>
                  <button
                    v-for="c in usedCategories"
                    :key="c.id"
                    type="button"
                    class="chip min-h-12 shrink-0 px-5! text-base!"
                    :aria-pressed="category === c.id"
                    @click="category = c.id"
                  >
                    {{ c.name }}
                  </button>
                </div>

                <input
                  v-if="kiosk.activeProducts.length > 12"
                  v-model="search"
                  type="search"
                  class="input py-3 text-lg"
                  placeholder="Buscar producto…"
                  aria-label="Buscar producto"
                />

                <div class="products-scroll">
                  <p v-if="!kiosk.activeProducts.length" class="py-10 text-center text-ink-500">
                    Todavía no hay productos. El administrador puede crearlos.
                  </p>
                  <div class="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-3.5 2xl:grid-cols-4">
                    <ProductTile
                      v-for="product in products"
                      :key="product.id"
                      :product="product"
                      :type="type"
                      :category="product.categoryId ? categoryName.get(product.categoryId) : null"
                      :in-cart="cart.quantityOf(product.id)"
                      :can-add-more="cart.canAdd(product)"
                      :disabled="!cart.canAdd(product) && !cart.quantityOf(product.id)"
                      @add="cart.add(product)"
                      @decrease="cart.setQuantity(product.id, cart.quantityOf(product.id) - 1)"
                    />
                  </div>
                </div>
              </div>
              <!--
                Celular y tablet en vertical: la lista queda fija abajo para que "Continuar" siempre esté a
                mano. Tablet en horizontal: columna a la derecha con todo el alto.
              -->
              <div class="cart-dock">
                <CartPanel :cart="cart" :type="type" @continue="goToPeople" />
              </div>
            </div>
          </template>

          <!-- 2. ¿Quién eres? -->
          <section v-else-if="step === 'person'" class="flex flex-1 flex-col">
            <div class="flex flex-wrap items-center justify-between gap-3">
              <button type="button" class="btn-secondary min-h-[52px] px-5 text-base" @click="goBack">
                <Icon name="arrowLeft" :size="20" :stroke="2.25" /> Volver a elegir
              </button>
              <StepIndicator :step="2" :type="type" />
            </div>
            <div class="mt-6 flex flex-wrap items-end justify-between gap-x-6 gap-y-4 sm:mt-8">
              <div>
                <h1 class="text-4xl font-black tracking-tight text-ink-900 sm:text-[44px]">¿Quién eres?</h1>
                <p class="mt-1 text-lg text-ink-500">Toca tu nombre. Luego te pedimos tu PIN.</p>
              </div>
              <p
                class="flex max-w-xl items-start gap-2.5 rounded-2xl border px-4 py-2.5 text-ink-700"
                :class="
                  type === 'OUT'
                    ? 'border-accent-200/80 bg-accent-50/85'
                    : 'border-success-100 bg-success-50/85'
                "
              >
                <Icon
                  :name="type === 'OUT' ? 'takeOut' : 'putIn'"
                  :size="20"
                  :stroke="2"
                  class="mt-0.5 shrink-0"
                  :class="type === 'OUT' ? 'text-accent-700' : 'text-success-700'"
                />
                <span>
                  {{ type === 'OUT' ? 'Vas a sacar' : 'Vas a meter' }}
                  <template v-for="(part, index) in cartParts" :key="part.key"
                    ><template v-if="index > 0">{{ index === cartParts.length - 1 ? ' y ' : ', ' }}</template
                    ><strong class="font-black text-ink-900">{{ part.text }}</strong></template
                  >
                </span>
              </p>
            </div>
            <p
              v-if="notice"
              class="mt-4 flex items-center gap-2 rounded-2xl border border-warning-600/20 bg-warning-50/85 px-4 py-3 text-warning-700"
              role="status"
            >
              <Icon name="alert" :size="18" /> {{ notice.text }}
            </p>
            <PersonPicker
              class="mt-6"
              :people="kiosk.people"
              :loading="loadingPeople"
              @select="selectPerson"
            />
            <p class="mt-auto pt-8 text-center text-[15px] text-ink-500">
              ¿No apareces? Pídele al administrador que te agregue en
              <strong class="font-black text-ink-900">Personas</strong>.
            </p>
          </section>

          <!-- 3. PIN -->
          <KioskPinStep
            v-else-if="step === 'pin' && person"
            :person="person"
            :type="type"
            :lines="cart.lines.value"
            :error="pinError"
            :submitting="submitting"
            @back="goBack"
            @submit="submitPin"
            @change-pin="step = 'change-pin'"
          />

          <KioskChangePin
            v-else-if="step === 'change-pin' && person"
            :person="person"
            @done="onPinChanged"
            @cancel="step = 'pin'"
          />

          <!-- 4. Listo -->
          <KioskSuccess
            v-else-if="step === 'done' && result"
            :result="result"
            :standing="standing"
            @done="resetAll"
          />
        </div>
      </IonContent>
    </div>
  </IonPage>
</template>

<style scoped>
/* Celular: contenido arriba y pestañas abajo. Tablet: barra de navegación a la izquierda. */
.kiosk-frame {
  display: flex;
  flex-direction: column-reverse;
  flex: 1;
  min-height: 0;
  height: 100%;
}
.kiosk-content {
  flex: 1 1 0;
  min-height: 0;
  min-width: 0;
  /* Sin cabecera de Ionic: el contenido se aparta él mismo de la barra de estado y de los bordes. */
  --padding-top: var(--ion-safe-area-top);
  --padding-bottom: var(--ion-safe-area-bottom);
  --padding-start: var(--ion-safe-area-left);
  --padding-end: var(--ion-safe-area-right);
}
/* Con la barra de pestañas abajo, ella se aparta de los botones de navegación del sistema. */
.with-nav .kiosk-content {
  --padding-bottom: 0px;
}
@media (min-width: 768px) {
  .kiosk-frame {
    flex-direction: row;
  }
  .kiosk-content {
    height: 100%;
  }
  .with-nav .kiosk-content {
    --padding-bottom: var(--ion-safe-area-bottom);
    --padding-start: 0px;
  }
}

.kiosk-main {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  min-height: 100%;
  padding: 0.75rem 1rem 1rem;
}
@media (min-width: 640px) {
  .kiosk-main {
    gap: 1.125rem;
    padding: 1.25rem 1.5rem 1.5rem;
  }
}
/* Pasos de sacar/meter a pantalla completa: más margen, como en los mockups. */
@media (min-width: 1024px) {
  .kiosk-main.is-step {
    padding: 1.75rem 3rem 2.25rem;
  }
}

.products-layout {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 1.25rem;
}
.products-col {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 0.875rem;
}
.chips {
  scrollbar-width: none;
}
.cart-dock {
  position: sticky;
  bottom: 0.75rem;
  z-index: 5;
}

/* Tablet en horizontal: todo cabe en la pantalla; la grilla de productos se desplaza por dentro. */
@media (min-width: 1024px) and (min-height: 600px) {
  .kiosk-main.is-fill {
    height: 100%;
    min-height: 0;
  }
  .is-fill .products-layout {
    flex: 1;
    min-height: 0;
    grid-template-columns: minmax(0, 1fr) 21.25rem;
  }
  .is-fill .products-col {
    min-height: 0;
  }
  .is-fill .products-scroll {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    /* Aire para que el borde y la sombra de las tarjetas no se corten. */
    margin: -0.25rem;
    padding: 0.25rem 0.25rem 1rem;
  }
  .is-fill .cart-dock {
    position: static;
    min-height: 0;
  }
}
</style>
