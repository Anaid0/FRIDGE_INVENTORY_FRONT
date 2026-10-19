import { defineStore } from 'pinia';
import { ref } from 'vue';
import type { Category, Product, UserRef } from '@/domain/models';
import { useServices } from '@/services/container';

/**
 * Listas de apoyo para selectores y filtros (usuarios, categorías, productos activos).
 * Se cargan una vez y se invalidan cuando algo las cambia.
 */
export const useLookupsStore = defineStore('lookups', () => {
  const services = useServices();
  const users = ref<UserRef[]>([]);
  const categories = ref<Category[]>([]);
  const products = ref<Product[]>([]);
  const loaded = { users: false, categories: false, products: false };

  async function ensureUsers(force = false) {
    if (loaded.users && !force) return users.value;
    users.value = await services.users.options();
    loaded.users = true;
    return users.value;
  }

  async function ensureCategories(force = false) {
    if (loaded.categories && !force) return categories.value;
    categories.value = await services.catalog.listCategories();
    loaded.categories = true;
    return categories.value;
  }

  async function ensureProducts(force = false) {
    if (loaded.products && !force) return products.value;
    products.value = await services.catalog.listProducts();
    loaded.products = true;
    return products.value;
  }

  function categoryName(id: string | null): string {
    if (!id) return 'Sin categoría';
    return categories.value.find((c) => c.id === id)?.name ?? '—';
  }

  return { users, categories, products, ensureUsers, ensureCategories, ensureProducts, categoryName };
});
