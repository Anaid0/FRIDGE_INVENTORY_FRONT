<script setup lang="ts">
import AdminPage from '@/layouts/AdminPage.vue';
import { useOnEnter } from '@/composables/useOnEnter';
import { reactive, watch } from 'vue';
import { RouterLink } from 'vue-router';
import ProductArt from '@/components/machine/ProductArt.vue';
import EmptyState from '@/components/ui/EmptyState.vue';
import ErrorState from '@/components/ui/ErrorState.vue';
import Icon from '@/components/ui/Icon.vue';
import PageHeader from '@/components/ui/PageHeader.vue';
import Pagination from '@/components/ui/Pagination.vue';
import { useAsync } from '@/composables/useAsync';
import { useServices } from '@/services/container';
import { useAuthStore } from '@/stores/auth';
import { useLookupsStore } from '@/stores/lookups';
import type { PurchaseListItem } from '@/domain/models';
import { formatMoney, formatNumber, fullName } from '@/utils/format';

const { purchases, funding } = useServices();
const auth = useAuthStore();
const lookups = useLookupsStore();

const filters = reactive({ periodId: '', buyerId: '', includeVoided: false, page: 1 });
const periods = useAsync(() => funding.list());
const { data, error, loading, run } = useAsync(() =>
  purchases.list({
    periodId: filters.periodId || undefined,
    buyerId: filters.buyerId || undefined,
    includeVoided: filters.includeVoided || undefined,
    page: filters.page,
    pageSize: 20,
  }),
);

watch(
  () => [filters.periodId, filters.buyerId, filters.includeVoided],
  () => {
    filters.page = 1;
    void run();
  },
);
watch(() => filters.page, run);

const DAY = new Intl.DateTimeFormat('es-CO', { day: 'numeric', month: 'short', year: 'numeric' });
const TIME = new Intl.DateTimeFormat('es-CO', { hour: 'numeric', minute: '2-digit' });
/** "19 oct 2026" y "3:45 p. m." por separado (la hora va debajo, más pequeña). */
const day = (iso: string) => DAY.format(new Date(iso)).replace(/\.| de/g, '');
const time = (iso: string) => TIME.format(new Date(iso));
/** "12 Coca cola 250ml · 6 Leche". */
const linesSummary = (p: PurchaseListItem) =>
  p.lines.map((line) => `${formatNumber(line.quantity)} ${line.productName}`).join(' · ');

useOnEnter(() => {
  void run();
  void periods.run();
  void lookups.ensureUsers().catch(() => undefined);
});
</script>

<template>
  <AdminPage title="Compras">
    <section>
      <PageHeader
        title="Compras"
        subtitle="Lo que se compró con el fondo de cada quincena."
        back="/admin/mas"
      >
        <template #actions>
          <RouterLink
            v-if="auth.isAdmin"
            to="/admin/compras/nueva"
            class="btn-primary min-h-11 rounded-[14px] px-3.5 text-xs lg:text-sm"
          >
            <Icon name="plus" :size="16" :stroke="2.6" /> Registrar compra
          </RouterLink>
        </template>
      </PageHeader>

      <div class="mb-2.5 flex flex-wrap items-center gap-2">
        <select
          v-model="filters.periodId"
          class="input h-11 w-auto max-w-full min-w-0 flex-[1_1_160px] rounded-xl py-0 text-[13px] font-bold sm:flex-none"
          aria-label="Quincena"
        >
          <option value="">Todas las quincenas</option>
          <option v-for="p in periods.data.value ?? []" :key="p.periodId" :value="p.periodId">
            {{ p.name }}
          </option>
        </select>
        <select
          v-model="filters.buyerId"
          class="input h-11 w-auto max-w-full min-w-0 flex-[1_1_160px] rounded-xl py-0 text-[13px] font-bold sm:flex-none"
          aria-label="Quién compró"
        >
          <option value="">Cualquier comprador</option>
          <option v-for="u in lookups.users" :key="u.id" :value="u.id">{{ fullName(u) }}</option>
        </select>
        <label
          class="chip min-h-11 cursor-pointer has-checked:border-ink-900 has-checked:bg-ink-900 has-checked:text-white"
        >
          <input v-model="filters.includeVoided" type="checkbox" class="size-4 accent-brand-600" /> Incluir
          anuladas
        </label>
      </div>

      <ErrorState v-if="error && !data" :message="error" @retry="run" />

      <div
        v-else
        class="card overflow-hidden px-3 transition-opacity lg:px-4"
        :class="{ 'opacity-60': loading && data }"
      >
        <EmptyState v-if="data && !data.items.length" icon="cart" title="No hay compras" />
        <div v-else-if="!data" class="flex flex-col gap-2 py-3" aria-busy="true">
          <div v-for="i in 4" :key="i" class="h-12 animate-pulse rounded-xl bg-white/50" />
        </div>
        <table v-else class="w-full text-xs lg:text-[13px]">
          <thead class="text-left text-[10px] font-black tracking-[0.06em] text-ink-500 uppercase">
            <tr>
              <th scope="col" class="py-2.5 pr-2 font-black">Compra</th>
              <th scope="col" class="hidden px-2 py-2.5 font-black sm:table-cell">Tienda</th>
              <th scope="col" class="hidden px-2 py-2.5 font-black md:table-cell">Compró</th>
              <th scope="col" class="hidden px-2 py-2.5 font-black lg:table-cell">Quincena</th>
              <th scope="col" class="py-2.5 pl-2 text-right font-black">Total</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="p in data.items"
              :key="p.id"
              class="border-t border-ink-900/8 hover:bg-white/40"
              :class="{ 'text-ink-400': p.voidedAt }"
            >
              <td class="py-2 pr-2">
                <div class="flex min-w-0 items-center gap-2">
                  <span
                    class="grid size-9 shrink-0 place-items-center rounded-[10px] bg-white/70"
                    :class="{ 'opacity-50': p.voidedAt }"
                    aria-hidden="true"
                  >
                    <ProductArt :name="p.lines[0]?.productName ?? ''" :size="26" />
                  </span>
                  <span class="flex min-w-0 flex-col">
                    <RouterLink
                      :to="`/admin/compras/${p.id}`"
                      class="font-extrabold whitespace-nowrap text-ink-900 hover:text-brand-700"
                      :class="{ 'text-ink-500 line-through': p.voidedAt }"
                    >
                      {{ day(p.purchasedAt) }}
                    </RouterLink>
                    <span class="line-clamp-2 text-[11px] text-ink-500">
                      {{ linesSummary(p) || `${p.itemsCount} productos` }}
                    </span>
                    <span class="text-[10px] text-ink-500">
                      {{ time(p.purchasedAt) }}<span class="md:hidden"> · {{ fullName(p.buyer) }}</span>
                      <span class="sm:hidden"
                        ><template v-if="p.store"> · {{ p.store }}</template></span
                      >
                    </span>
                  </span>
                </div>
              </td>
              <td class="hidden px-2 py-2 sm:table-cell">
                <span class="inline-flex flex-wrap items-center gap-1.5">
                  {{ p.store ?? '—' }}
                  <template v-if="p.hasReceipt">
                    <Icon name="receipt" :size="14" class="text-ink-400" />
                    <span class="sr-only">Con comprobante</span>
                  </template>
                </span>
              </td>
              <td class="hidden px-2 py-2 md:table-cell">{{ fullName(p.buyer) }}</td>
              <td class="hidden px-2 py-2 text-ink-600 lg:table-cell">{{ p.periodName }}</td>
              <td class="py-2 pl-2 text-right align-middle">
                <span class="flex flex-col items-end gap-1">
                  <span
                    class="num whitespace-nowrap text-ink-900"
                    :class="{ 'text-ink-400 line-through': p.voidedAt }"
                    >{{ formatMoney(p.total) }}</span
                  >
                  <span
                    v-if="p.voidedAt"
                    class="rounded-md bg-ink-900/8 px-1.5 py-0.5 text-[10px] font-extrabold text-ink-700"
                    >Anulada</span
                  >
                </span>
              </td>
            </tr>
          </tbody>
        </table>
        <Pagination
          v-if="data && data.total > data.pageSize"
          class="border-t border-ink-900/8"
          :page="data.page"
          :page-size="data.pageSize"
          :total="data.total"
          @change="filters.page = $event"
        />
      </div>
    </section>
  </AdminPage>
</template>
