import { defineComponent, h } from 'vue';

/**
 * ion-modal no pinta su contenido en jsdom (necesita animaciones y overlays reales).
 * En los tests de componentes se reemplaza BaseDialog por este stub con la misma API.
 */
export const BaseDialogStub = defineComponent({
  name: 'BaseDialog',
  props: {
    open: Boolean,
    title: { type: String, default: '' },
    description: { type: String, default: undefined },
    wide: Boolean,
  },
  emits: ['close'],
  setup(props, { slots }) {
    return () =>
      props.open
        ? h('div', { role: 'dialog', 'aria-label': props.title }, [
            h('h2', props.title),
            props.description ? h('p', props.description) : null,
            slots.default?.(),
          ])
        : null;
  },
});

export const dialogStubs = { BaseDialog: BaseDialogStub };
