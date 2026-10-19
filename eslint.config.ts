import { defineConfigWithVueTs, vueTsConfigs } from '@vue/eslint-config-typescript';
import prettier from 'eslint-config-prettier';
import pluginVue from 'eslint-plugin-vue';

export default defineConfigWithVueTs(
  { name: 'app/files', files: ['**/*.{ts,mts,tsx,vue}'] },
  { name: 'app/ignores', ignores: ['dist/**', 'coverage/**', 'node_modules/**', 'playwright-report/**', 'test-results/**', 'android/**'] },
  pluginVue.configs['flat/recommended'],
  vueTsConfigs.recommended,
  {
    rules: {
      'vue/multi-word-component-names': 'off',
      // Ionic usa slots de web components (slot="start", slot="end"), no slots de Vue.
      'vue/no-deprecated-slot-attribute': 'off',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
    },
  },
  {
    // Las vistas y componentes hablan con el backend solo a través de stores/servicios.
    name: 'app/layering',
    files: ['src/views/**', 'src/components/**', 'src/layouts/**'],
    rules: {
      'no-restricted-imports': [
        'error',
        { patterns: [{ group: ['axios', '@/services/http/*'], message: 'Usa los stores o useServices(), no HTTP directo.' }] },
      ],
    },
  },
  prettier,
);
