<script setup lang="ts">
import AdminPage from '@/layouts/AdminPage.vue';
import { useOnEnter } from '@/composables/useOnEnter';
import { reactive, watch } from 'vue';
import { RouterLink } from 'vue-router';
import Badge from '@/components/ui/Badge.vue';
import EmptyState from '@/components/ui/EmptyState.vue';
import ErrorState from '@/components/ui/ErrorState.vue';
import Icon from '@/components/ui/Icon.vue';
import PageHeader from '@/components/ui/PageHeader.vue';
import Pagination from '@/components/ui/Pagination.vue';
import { useAsync } from '@/composables/useAsync';
import { useServices } from '@/services/container';
import { useAuthStore } from '@/stores/auth';
import { useLookupsStore } from '@/stores/lookups';
import { formatDateTime, formatMoney, fullName } from '@/utils/format';

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

useOnEnter(() => {
  void run();
  void periods.run();
  void lookups.ensureUsers().catch(() => undefined);
});
</script>

<template>
  <AdminPage title="Compras">
    <section>
      <PageHeader title="Compras" subtitle="Historial de lo que se compró con el fondo de cada quincena.">
        <template #actions>
          <RouterLink v-if="auth.isAdmin" to="/admin/compras/nueva" class="btn-primary">
            <Icon name="plus" :size="16" /> Registrar compra
          </RouterLink>
        </template>
      </PageHeader>

      <div class="mb-4 flex flex-wrap items-center gap-3">
        <select v-model="filters.periodId" class="input w-auto" aria-label="Quincena">
          <option value="">Todas las quincenas</option>
          <option v-for="p in periods.data.value ?? []" :key="p.periodId" :value="p.periodId">
            {{ p.name }}
          </option>
        </select>
        <select v-model="filters.buyerId" class="input w-auto" aria-label="Quién compró">
          <option value="">Cualquier comprador</option>
          <option v-for="u in lookups.users" :key="u.id" :value="u.id">{{ fullName(u) }}</option>
        </select>
        <label class="flex items-center gap-2 text-sm text-ink-700">
          <input v-model="filters.includeVoided" type="checkbox" class="size-4 accent-brand-700" /> Incluir
          anuladas
        </label>
      </div>

      <ErrorState v-if="error && !data" :message="error" @retry="run" />

      <div v-else class="card overflow-hidden transition-opacity" :class="{ 'opacity-60': loading && data }">
        <EmptyState v-if="data && !data.items.length" icon="cart" title="No hay compras" />
        <div v-else class="overflow-x-auto">
          <table class="w-full text-sm">
            <thead class="border-b border-ink-100 bg-ink-50 text-xs text-ink-500">
              <tr>
                <th scope="col" class="px-4 py-3 text-left font-medium">Fecha</th>
                <th scope="col" class="px-4 py-3 text-left font-medium">Tienda</th>
                <th scope="col" class="px-4 py-3 text-left font-medium">Compró</th>
                <th scope="col" class="px-4 py-3 text-left font-medium">Quincena</th>
                <th scope="col" class="px-4 py-3 text-right font-medium">Productos</th>
                <th scope="col" class="px-4 py-3 text-right font-medium">Total</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-ink-100">
              <tr
                v-for="p in data?.items ?? []"
                :key="p.id"
                class="hover:bg-ink-50"
                :class="{ 'text-ink-400': p.voidedAt }"
              >
                <td class="px-4 py-3 whitespace-nowrap">
                  <RouterLink
                    :to="`/admin/compras/${p.id}`"
                    class="font-medium text-ink-900 hover:text-brand-700"
                  >
                    {{ formatDateTime(p.purchasedAt) }}
                  </RouterLink>
                </td>
                <td class="px-4 py-3">
                  <span class="inline-flex items-center gap-1.5">
                    {{ p.store ?? '—' }}
                    <Icon v-if="p.hasReceipt" name="receipt" :size="14" class="text-ink-400" />
                    <Badge v-if="p.voidedAt" tone="neutral">Anulada</Badge>
                  </span>
                </td>
                <td class="px-4 py-3">{{ fullName(p.buyer) }}</td>
                <td class="px-4 py-3 text-ink-600">{{ p.periodName }}</td>
                <td class="px-4 py-3 text-right tabular-nums">{{ p.itemsCount }}</td>
                <td
                  class="px-4 py-3 text-right font-semibold tabular-nums"
                  :class="{ 'line-through': p.voidedAt }"
                >
                  {{ formatMoney(p.total) }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <Pagination
          v-if="data && data.total > data.pageSize"
          class="border-t border-ink-100"
          :page="data.page"
          :page-size="data.pageSize"
          :total="data.total"
          @change="filters.page = $event"
        />
      </div>
    </section>
  </AdminPage>
</template>
