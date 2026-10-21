<script setup lang="ts">
import FridgeLogo from '../brand/FridgeLogo.vue';

/** Carga inicial (mockup Splash): el logo en una tarjeta de vidrio, el lema y tres puntos que laten. */
</script>

<template>
  <div class="splash" role="status" aria-label="Cargando FridgeYA">
    <div class="flex flex-1 flex-col items-center justify-center gap-4">
      <div class="glass-strong grid size-[170px] place-items-center rounded-[44px]">
        <FridgeLogo variant="full" class="size-[132px] drop-shadow-[0_10px_24px_rgb(11_121_195/0.35)]" />
      </div>
      <p class="font-display text-[38px] leading-none font-black tracking-[-1px] text-ink-900">
        Fridge<span class="text-brand-600">YA</span>
      </p>
      <p class="text-[14px] font-bold text-ink-700">La nevera de la oficina, en orden</p>
    </div>
    <div class="dots" aria-hidden="true"><span /><span /><span /></div>
    <p class="text-[12px] font-extrabold text-brand-700">una app de MonkeyJobs</p>
  </div>
</template>

<style scoped>
.splash {
  display: flex;
  min-height: 100%;
  flex-direction: column;
  align-items: center;
  gap: 2rem;
  padding: calc(var(--ion-safe-area-top) + 2rem) 1.5rem calc(var(--ion-safe-area-bottom) + 2.5rem);
}
.dots {
  display: flex;
  gap: 8px;
}
.dots span {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--color-brand-600);
  animation: pulse 1.2s ease-in-out infinite;
}
.dots span:nth-child(2) {
  animation-delay: 0.2s;
}
.dots span:nth-child(3) {
  background: var(--color-accent-500);
  animation-delay: 0.4s;
}
@keyframes pulse {
  0%,
  100% {
    opacity: 0.35;
    transform: scale(0.85);
  }
  50% {
    opacity: 1;
    transform: scale(1);
  }
}
@media (prefers-reduced-motion: reduce) {
  .dots span {
    animation: none;
  }
}
</style>
