<template>
  <Tips v-bind="{ tips, showTips, disabled }">
    <VueSelect
      :value="mutableValue"
      :options="mutableOptions"
      :placeholder="placeholder"
      :autocomplete="autocomplete"
      :disabled="disabled"
      :multiple="multiple"
      :label="textKey"
      :selectable="invokeSelectable"
      :reduce="invokeReduce"
      :get-option-label="invokeGetOptionLabel"
      :clearable="clearable"
      :searchable="searchable"
      :filterable="filterable"
      :filter="fuseSearch"
      :taggable="taggable"
      :push-tags="pushTags"
      :create-option="invokeCreateOption"
      :close-on-select="closeOnSelect"
      :no-drop="noDrop"
      :append-to-body="true"
      :calculate-position="withPopper"
      :handle-option-change="handleOptionChange"
      :reset-on-options-change="invokeResetOnOptionsChange"
      @input="handleInput"
      @option:created="handleCreated"
      @option:selecting="tunnelEmit('handle:selecting', $event)"
      @option:selected="tunnelEmit('handle:selected', $event)"
      @option:deselecting="tunnelEmit('handle:deselecting', $event)"
      @option:deselected="tunnelEmit('handle:deselected', $event)"
      @search:focus="tunnelEmit('focus', $event)"
      @search:blur="tunnelEmit('blur', $event)"
    >
      <template #search="{ attributes, events }">
        <input
          :id="id"
          ref="el"
          :name="name"
          class="vs__search"
          :required="required && !mutableValue"
          v-bind="attributes"
          v-on="events"
        />
      </template>

      <!-- 已選項目  -->
      <template #selected-option="option">
        <IconRow :icon="icons[option[iconKey]] || option[iconKey]">
          {{ option[textKey] || `(${option[valueKey]})` }}
        </IconRow>
      </template>

      <!-- 項目  -->
      <template #option="option">
        <IconRow :icon="icons[option[iconKey]] || option[iconKey]">
          {{ option[textKey] || `(${option[valueKey]})` }}
        </IconRow>
      </template>

      <!-- 無項目 -->
      <template v-if="searchable" #no-options="{ search, searching }">
        <template v-if="searching">
          查無
          <em>{{ search }}</em> 相關.
        </template>
        <em v-else style="opacity: 0.5">{{ searchPlaceholder }}</em>
      </template>

      <template v-for="(_, slot) in $scopedSlots" #[slot]="props">
        <slot :name="slot" v-bind="props" />
      </template>
    </VueSelect>
  </Tips>
</template>

<script>
import VueSelect from 'vue-select';
// import VueSelect from '@/assets/js/vue-select';
import IconRow from '@/components/ui/IconRow';
import Tips from '@/components/ui/Tips';
import Fuse from 'fuse.js';
import { createPopper } from '@popperjs/core';
import { nanoid, difference } from '@/assets/js/helper.js';

export default /*#__PURE__*/ {
  name: 'FieldSelect',
  components: {
    VueSelect,
    IconRow,
    Tips,
  },
  inheritAttrs: false,
  props: {
    value: { type: [String, Number, Boolean, Array], default: null },
    error: { type: String, default: null },
    // ----------------------------------
    id: { type: String, default: null },
    name: { type: String, default: null },
    defaultValue: { type: [String, Number, Boolean, Array], default: null },
    placeholder: { type: String, default: null },
    options: { type: Array, default: () => [] },
    icons: { type: Object, default: () => ({}) },
    required: { type: Boolean, default: false },
    disabled: { type: Boolean, default: false },
    novalidate: { type: Boolean, default: null },
    multiple: { type: Boolean, default: false },
    autocomplete: { type: String, default: 'off' },
    valueKey: { type: String, default: 'id' },
    textKey: { type: String, default: 'text' },
    iconKey: { type: String, default: 'icon' },
    // ---------------------------------------------
    // https://vue-select.org/api/props.html#options
    selectable: { type: Function, default: null }, // 是否可選處理
    reduce: { type: Function, default: null }, // 轉換對象處理 (傳遞給 v-model binding 或 @input event.)
    getOptionLabel: { type: Function, default: null }, // 生成項目文字處理
    resetOnOptionsChange: { type: [Function, Boolean], default: false }, // 項目更新是否重置所選值處理
    // ---------------------------------------------
    clearable: { type: Boolean, default: false }, // 是否可清除所選
    searchable: { type: Boolean, default: true }, // 是否可查詢項目
    // ---------------------------------------------
    filterable: { type: Boolean, default: true }, // When true, existing options will be filtered by the search text. Should not be used in conjunction with taggable.
    fuseKeys: { type: Array, default: null }, // 模糊查詢欄位
    // ---------------------------------------------
    taggable: { type: Boolean, default: false }, // Enable/disable creating options from searchInput.
    pushTags: { type: Boolean, default: false }, // When true, newly created tags will be added to the options list.
    createOption: { type: Function, default: null }, // User defined function for adding Options
    reactable: { type: Boolean, default: false },
    handleCreatedCallback: { type: Function, default: null },
    // ---------------------------------------------
    closeOnSelect: { type: Boolean, default: true }, // Close a dropdown when an option is chosen. Set to false to keep the dropdown open
    noDrop: { type: Boolean, default: false }, // Disable the dropdown entirely.
    // ---------------------------------------------
    searchPlaceholder: { type: String, default: '開始嘗試搜尋欄位' },
    // ----------------------------------
    processRule: { type: Function, default: null },
  },
  emits: [
    'update:value',
    'update:error',
    'handle:selecting',
    'handle:selected',
    'handle:deselecting',
    'handle:deselected',
    'focus',
    'blur',
  ],
  data() {
    return {
      placement: 'bottom',
      invalid: null,
      tips: null,
      showTips: null,
    };
  },
  computed: {
    mutableValue: {
      get() {
        return this.value;
      },
      set(value) {
        this.$emit('update:value', value);
      },
    },
    mutableError: {
      get() {
        return this.error;
      },
      set(val) {
        this.$emit('update:error', val);
      },
    },
    mutableOptions() {
      return this.options;
    },
    invokeResetOnOptionsChange(newOptions, oldOptions, selectedValue) {
      if (this.resetOnOptionsChange !== null) return this.resetOnOptionsChange;

      return () => {
        console.log(newOptions, oldOptions, selectedValue);
        return true;
      };
    },
    invokeSelectable() {
      if (this.selectable !== null) return this.selectable;
      // multiple
      if (this.multiple) return (option) => !(this.value || []).includes(option[this.valueKey]);
      // default
      return () => true;
    },
    invokeReduce() {
      if (this.reduce !== null) return this.reduce;
      // default
      return (option) => option[this.valueKey];
    },
    invokeGetOptionLabel() {
      // Label text is used for filtering comparison and displaying.
      // If you only need to adjust the display, you should use the option and selected-option slots.
      if (this.getOptionLabel !== null) return this.getOptionLabel;
      // default
      return (option) => option[this.textKey] || `(${option[this.valueKey]})`;
    },
    invokeCreateOption() {
      if (this.createOption !== null) return this.createOption;
      // default
      return (option) => ({ [this.valueKey]: nanoid(6), [this.textKey]: option });
    },
    fuseSearch() {
      if (!this.filterable || !this.searchable) return null;

      return (options, search) => {
        const fuse = new Fuse(options, {
          keys: this.fuseKeys ? this.fuseKeys : [this.textKey],
          shouldSort: true,
        });
        return search.length ? fuse.search(search).map(({ item }) => item) : fuse.list;
      };
    },
  },
  watch: {
    mutableValue: 'checkValidity',
    mutableError: 'checkValidity',
  },
  methods: {
    focus() {
      this.$nextTick(() => this.$refs.el.focus());
    },
    reset() {
      this.mutableValue = this.defaultValue;
      this.invalid = null;
      this.showTips = null;
      this.tips = null;
    },
    validity() {
      // custom
      if (this.processRule && !this.processRule()) return false;

      return true;
    },
    checkValidity() {
      if (this.novalidate || this.disabled) {
        return true;
      }

      if (this.validity()) {
        this.invalid = null;
        this.showTips = null;
        this.tips = null;
      } else {
        // this.focus();
        this.invalid = true;
        this.showTips = true;
        this.tips = this.mutableError;
      }

      return !this.invalid;
    },
    handleOptionChange(newOptions, oldOptions, pushedTags) {
      const afterIds = newOptions.map((c) => c.id);
      const beforeIds = oldOptions.map((c) => c.id);
      const deductIds = difference(beforeIds, afterIds); // 減少的欄位IDs

      if (deductIds.length) {
        console.log('pushedTags', pushedTags);
      }
    },
    tunnelEmit(event, ...payload) {
      let vm = this;
      while (vm && !vm.$listeners[event]) {
        vm = vm.$parent;
      }
      if (vm) {
        vm.$emit(event, ...payload);
      } else {
        // return console.error(`no target listener for event "${event}"`);
      }
    },
    filter(options, search) {
      return options.filter((option) => {
        let label = this.invokeGetOptionLabel(option);
        if (typeof label === 'number') {
          label = label.toString();
        }
        return this.filterBy(option, label, search);
      });
    },
    filterBy(option, label, search) {
      console.log(option.text.toLowerCase().indexOf(search.toLowerCase()) > -1);
      return option.text.toLowerCase().indexOf(search.toLowerCase()) > -1;
      // return (label || '').toLowerCase().indexOf(search.toLowerCase()) > -1;
    },
    handleInput(value) {
      // console.log('handleInput', value);
      this.mutableValue = value;
    },
    handleCreated(option) {
      // console.log('handleCreated', option);
      if (this.reactable) {
        this.mutableOptions.push(option);
      }

      if (this.handleCreatedCallback) {
        this.handleCreatedCallback(option);
      }

      this.tunnelEmit('handle:created', option);
    },
    withPopper(dropdownList, component, { width }) {
      /**
       * We need to explicitly define the dropdown width since
       * it is usually inherited from the parent with CSS.
       */
      dropdownList.style.width = width;

      /**
       * Here we position the dropdownList relative to the $refs.toggle Element.
       *
       * The 'offset' modifier aligns the dropdown so that the $refs.toggle and
       * the dropdownList overlap by 1 pixel.
       *
       * The 'toggleClass' modifier adds a 'drop-up' class to the Vue Select
       * wrapper so that we can set some styles for when the dropdown is placed
       * above.
       */
      const popper = createPopper(component.$refs.toggle, dropdownList, {
        placement: this.placement,
        modifiers: [
          {
            name: 'offset',
            options: {
              offset: [0, -1],
            },
          },
          {
            name: 'toggleClass',
            enabled: true,
            phase: 'write',
            fn({ state }) {
              component.$el.classList.toggle('drop-up', state.placement === 'top');
            },
          },
        ],
      });

      /**
       * To prevent memory leaks Popper needs to be destroyed.
       * If you return function, it will be called just before dropdown is removed from DOM.
       */
      return () => popper.destroy();
    },
  },
};
</script>

<style lang="scss">
@import '@/assets/scss/utils.scss';

// Vue-select
$vs-colors: (
  lightest: rgba(60, 60, 60, 0.26),
  light: rgba(60, 60, 60, 0.5),
  dark: #333,
  darkest: rgba(0, 0, 0, 0.15),
) !default;
$vs-component-placeholder-color: $color-gray-dark;
$vs-state-active-bg: var(--selectionBgColor);
$vs-state-active-color: var(--selectionFontColor);

$vs-border-width: var(--borderWidth);
$vs-border-style: solid;
$vs-border-radius: var(--borderRadius);
$vs-border-color: var(--borderColor);

$vs-controls-color: var(--borderColor);

$vs-dropdown-box-shadow: 0px 3px 6px 0px rgba(0, 0, 0, 0.5);

@import '~vue-select/src/scss/vue-select.scss';

.v-select {
  .x-tips & {
    width: 100%;
  }

  line-height: 1.4;
  background-color: #fff;

  .vs__selected {
    z-index: 2;
  }

  .vs__actions svg {
    transition: fill 300ms, transform 150ms cubic-bezier(1, -0.115, 0.975, 0.855);
  }

  &:not(.vs--disabled) {
    &:hover,
    &:focus-within {
      .vs__dropdown-toggle {
        border-color: var(--themeColor);
      }
      .vs__actions svg {
        fill: var(--themeColor);
      }
    }
  }
}

.vs {
  &__search,
  &__search:focus {
    margin: 0;
    padding: var(--vGap) var(--hGap);
  }
  &__selected-options {
    padding: 0;
    overflow: hidden;
  }

  &__selected {
    padding: 0 var(--vGap);
    margin: calc(var(--vGap) / 2) 0 calc(var(--vGap) / 2) var(--vGap);

    .vs--single & {
      position: absolute;
      top: var(--borderWidth);
      left: var(--borderWidth);
    }

    .vs--single.vs--open & {
      margin: calc(var(--borderWidth) * -2) 0 0 calc(var(--borderWidth) * -1);
      padding: var(--vGap) var(--hGap);
    }

    button:disabled {
      display: none;
    }
  }

  &__dropdown-toggle {
    padding: 0;
    transition: z-index 0.3s, border-color 0.3s, box-shadow 0.3s;

    .v-select.drop-up.vs--open & {
      border-radius: 0 0 $vs-border-radius $vs-border-radius;
      border-top-color: transparent;
      border-bottom-color: $vs-border-color;
    }
  }

  &__dropdown-option {
    // transition: color 0.1s, background 0.1s;
    .x-icon {
      transition: unset;
    }

    &--disabled {
      display: none;
    }
  }

  &__actions {
    margin: 0;
    padding: var(--vGap) var(--hGap) var(--vGap) 0;
  }
}

[data-popper-placement='top'] {
  border-radius: $vs-border-radius $vs-border-radius 0 0;
  border-top-style: $vs-border-style;
  border-bottom-style: none;
  box-shadow: 0px -3px 6px 0px rgba(0, 0, 0, 0.15);
}
</style>
