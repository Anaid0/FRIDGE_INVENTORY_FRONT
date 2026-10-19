<script setup lang="ts">
import AdminPage from '@/layouts/AdminPage.vue';
import { useOnEnter } from '@/composables/useOnEnter';
import { computed } from 'vue';
import { RouterLink } from 'vue-router';
import BarChart from '@/components/charts/BarChart.vue';
import MovementTypeBadge from '@/components/MovementTypeBadge.vue';
import PeriodBalanceCard from '@/components/PeriodBalanceCard.vue';
import EmptyState from '@/components/ui/EmptyState.vue';
import ErrorState from '@/components/ui/ErrorState.vue';
import Icon from '@/components/ui/Icon.vue';
import StatTile from '@/components/ui/StatTile.vue';
import { useAsync } from '@/composables/useAsync';
import { useServices } from '@/services/container';
import { useAuthStore } from '@/stores/auth';
import { formatMoney, formatNumber, formatRelative, fullName, withUnit } from '@/utils/format';

const { movements } = useServices();
const auth = useAuthStore();
const { data, error, loading, run } = useAsync(() => movements.dashboard());
useOnEnter(run);

const top = computed(() => data.value?.topWithdrawer ?? null);
const monthRows = computed(() =>
  (data.value?.topWithdrawers.last30Days ?? []).map((row) => ({
    key: row.user.id,
    label: fullName(row.user),
    value: row.totalWithdrawn,
    valueLabel: `${formatNumber(row.totalWithdrawn)} und.`,
    detail: `${row.withdrawals} ${row.withdrawals === 1 ? 'retiro' : 'retiros'}`,
  })),
);
</script>

<template>
  <AdminPage title="Inicio">
    <section>
      <div class="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 class="text-2xl font-bold tracking-tight text-ink-900">Hola, {{ auth.user?.name }}</h1>
          <p class="mt-1 text-sm text-ink-500">Así está la nevera de la oficina.</p>
        </div>
        <RouterLink to="/admin/productos" class="btn-primary self-start"
          ><Icon name="box" :size="16" /> Meter o sacar</RouterLink
        >
      </div>

      <ErrorState v-if="error && !data" :message="error" @retry="run" />

      <div v-else class="space-y-6 transition-opacity" :class="{ 'opacity-60': loading && data }">
        <!-- Lo más importante de la vista: quién más retira -->
        <div class="card flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:justify-between">
          <div class="flex items-center gap-4">
            <span class="grid size-14 shrink-0 place-items-center rounded-2xl bg-brand-700 text-white">
              <Icon name="trophy" :size="28" />
            </span>
            <div>
              <p class="text-sm text-ink-500">Quien más retira de la nevera</p>
              <p v-if="top" class="text-3xl font-bold tracking-tight text-ink-900">
                {{ fullName(top.user) }}
              </p>
              <p v-else-if="data" class="text-xl font-semibold text-ink-700">Aún nadie ha sacado nada</p>
              <p v-else class="mt-1 h-8 w-56 animate-pulse rounded bg-ink-100" />
            </div>
          </div>
          <div v-if="top" class="flex gap-6 sm:text-right">
            <div>
              <p class="text-3xl font-bold text-ink-900">{{ formatNumber(top.totalWithdrawn) }}</p>
              <p class="text-xs text-ink-500">unidades retiradas</p>
            </div>
            <div>
              <p class="text-3xl font-bold text-ink-900">{{ formatNumber(top.withdrawals) }}</p>
              <p class="text-xs text-ink-500">retiros</p>
            </div>
          </div>
        </div>

        <div class="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatTile label="Productos activos" :value="data ? formatNumber(data.activeProducts) : '—'" />
          <StatTile label="Unidades en la nevera" :value="data ? formatNumber(data.totalUnits) : '—'" />
          <StatTile
            label="Con stock bajo"
            :value="data ? formatNumber(data.lowStockProducts.length) : '—'"
            :tone="data && data.lowStockProducts.length ? 'warning' : 'default'"
          />
          <StatTile
            label="Saldo de la quincena"
            :value="data?.currentPeriod ? formatMoney(data.currentPeriod.balance) : 'Sin quincena'"
            :tone="data?.currentPeriod?.isOverspent ? 'danger' : 'default'"
            :hint="data?.currentPeriod?.name"
          />
        </div>

        <div class="grid grid-cols-1 gap-6 lg:grid-cols-[1.4fr_1fr]">
          <div class="card">
            <div class="flex items-center justify-between border-b border-ink-100 px-5 py-4">
              <h2 class="font-semibold text-ink-900">Últimos movimientos</h2>
              <RouterLink to="/admin/movimientos" class="text-sm font-medium text-brand-700 hover:underline"
                >Ver todos</RouterLink
              >
            </div>
            <EmptyState
              v-if="data && !data.latestMovements.length"
              icon="list"
              title="Todavía no hay movimientos"
              message="Cuando alguien meta o saque productos aparecerá aquí."
            />
            <ul v-else class="divide-y divide-ink-100">
              <li
                v-for="m in data?.latestMovements ?? []"
                :key="m.id"
                class="flex items-center gap-3 px-5 py-3"
              >
                <MovementTypeBadge :type="m.type" :source="m.source" />
                <div class="min-w-0 flex-1">
                  <p v-if="m.source === 'PURCHASE_VOID'" class="truncate text-sm text-ink-800">
                    Se anuló una compra: salieron {{ withUnit(m.quantity, m.product.unit) }} de
                    <strong class="font-semibold">{{ m.product.name }}</strong>
                  </p>
                  <p v-else class="truncate text-sm text-ink-800">
                    <strong class="font-semibold">{{ fullName(m.performedBy) }}</strong>
                    {{ m.source === 'PURCHASE' ? 'compró' : m.type === 'OUT' ? 'sacó' : 'metió' }}
                    {{ withUnit(m.quantity, m.product.unit) }} de
                    <strong class="font-semibold">{{ m.product.name }}</strong>
                  </p>
                  <p
                    v-if="m.source !== 'PURCHASE_VOID' && m.performedBy.id !== m.registeredBy.id"
                    class="text-xs text-ink-500"
                  >
                    Registrado por {{ fullName(m.registeredBy) }}
                  </p>
                </div>
                <time class="shrink-0 text-xs text-ink-500" :datetime="m.createdAt">{{
                  formatRelative(m.createdAt)
                }}</time>
              </li>
            </ul>
          </div>

          <div class="space-y-6">
            <PeriodBalanceCard v-if="data?.currentPeriod" :summary="data.currentPeriod" compact />

            <div class="card p-5">
              <h2 class="font-semibold text-ink-900">Más retiros · últimos 30 días</h2>
              <p class="mb-4 text-xs text-ink-500">Unidades sacadas por persona</p>
              <BarChart
                v-if="monthRows.length"
                :rows="monthRows"
                caption="Unidades retiradas por persona en los últimos 30 días"
                label-header="Persona"
                value-header="Unidades"
                :emphasize-key="monthRows[0]?.key ?? null"
              />
              <p v-else class="text-sm text-ink-500">Sin retiros en los últimos 30 días.</p>
            </div>

            <div class="card p-5">
              <h2 class="mb-3 font-semibold text-ink-900">Hay que reponer</h2>
              <ul v-if="data?.lowStockProducts.length" class="space-y-2">
                <li
                  v-for="p in data.lowStockProducts"
                  :key="p.id"
                  class="flex items-center justify-between text-sm"
                >
                  <span class="text-ink-800">{{ p.name }}</span>
                  <span
                    class="tabular-nums"
                    :class="p.quantity === 0 ? 'text-danger-700' : 'text-warning-700'"
                  >
                    {{ p.quantity }} / mín. {{ p.minStock }}
                  </span>
                </li>
              </ul>
              <p v-else class="text-sm text-ink-500">Todo con buen stock.</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  </AdminPage>
</template>
