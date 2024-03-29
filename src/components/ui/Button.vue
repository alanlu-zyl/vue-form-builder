/* eslint-disable vue/no-mutating-props */
<template>
  <div class="x-btn" v-bind="wrapperProps">
    <Loading v-if="loading" />
    <Icon v-else-if="icon" :icon="icon" :color="color" />
    <slot></slot>
    <component
      :is="href ? 'a' : 'button'"
      ref="btn"
      v-bind="cmpProps"
      @click="handleClick"
      @focus="handleFocus"
      @blur="handleBlur"
      @mousedown="handleMousedown"
      @keydown="handleKeydown"
    />
  </div>
</template>

<script>
import Loading from '@/components/ui/Loading';
import Icon from '@/components/ui/Icon';

export default /*#__PURE__*/ {
  name: 'Button',
  components: {
    Loading,
    Icon,
  },
  inheritAttrs: false,
  props: {
    // ---- 元素屬性 ----
    name: { type: String, default: null },
    htmltype: { type: String, default: null },
    href: { type: String, default: null },
    target: { type: String, default: '_blank' },
    rel: { type: String, default: null },
    download: { type: String, default: null },
    disabled: { type: Boolean, default: null }, // 禁用
    // ---- 元件樣式 ----
    type: {
      validator: (value) => ['primary', 'danger', 'flat', 'dashed'].includes(value),
      default: null,
    },
    icon: { type: String, default: null }, // 圖示
    color: { type: String, default: null }, // 圖示顏色
    loading: { type: Boolean, default: null }, // 載入中 (狀態與禁用相仿)
    shape: { type: String, default: null }, // 形狀
    block: { type: Boolean, default: null }, // 區塊
    // ---- 其他 ----
    toggle: { type: Boolean, default: null },
    handleToggle: { type: Function, default: null },
  },
  emits: ['click', 'focus', 'blur', 'mousedown', 'keydown'],
  data() {
    return {
      checked: false,
      isEmpty: false,
      actived: false,
    };
  },
  computed: {
    wrapperClasses() {
      return [
        this.type && `x-btn--${this.type}`,
        { 'x-btn--href': !!this.href },
        { 'x-btn--block': this.block },
        { 'x-btn--circle': this.shape === 'circle' },
        { 'x-btn--disabled': !this.type && this.disabled },
      ];
    },
    wrapperProps() {
      return {
        class: this.wrapperClasses,
        disabled: this.disabled,
        loading: this.loading,
        empty: this.isEmpty,
        checked: this.toggle && this.checked,
      };
    },
    classes() {
      return ['btn', { 'btn--active': this.actived }];
    },
    cmpProps() {
      let temp = {
        class: this.classes,
        name: this.name,
        type: this.htmltype || (!this.href && 'button'),
        disabled: this.disabled || this.loading,
      };

      if (this.href) {
        temp = {
          ...temp,
          href: !this.disabled && !this.loading && this.href,
          target: this.target,
          rel: this.rel,
          download: this.download,
        };
      }

      return temp;
    },
  },
  created() {
    this.checkSlot();
  },
  beforeUpdate() {
    this.checkSlot();
  },
  methods: {
    checkSlot() {
      this.isEmpty = !this.$slots.default;
      if (!this.isEmpty) {
        // 如果純文字 補上 <span> 標籤
        if (!this.$slots.default[0].tag) this.$slots.default[0].tag = 'span';
      }
    },
    focus() {
      this.$nextTick(() => this.$refs.btn.focus());
    },
    activeRipple(e) {
      if (!this.disabled) {
        this.actived = true;

        const { left, top, width, height } = this.$refs.btn.getBoundingClientRect();
        const x = e?.clientX ? e.clientX - left : width / 2;
        const y = e?.clientY ? e.clientY - top : height / 2;

        // 設定波紋(ripple)中心位置
        this.$refs.btn.style.setProperty('--x', x + 'px');
        this.$refs.btn.style.setProperty('--y', y + 'px');

        this.$nextTick(() => {
          this.actived = false;
        });
      }
    },
    handleClick() {
      this.$emit('click');

      if (this.toggle) {
        this.checked = !this.checked;

        if (this.handleToggle) {
          this.handleToggle(this.checked);
        }
      }
    },
    handleFocus() {
      // console.log('btn focus');
    },
    handleBlur() {
      // console.log('btn blur');
    },
    handleMousedown(e) {
      this.activeRipple(e);
    },
    handleKeydown(e) {
      switch (e.keyCode) {
        case 13: //Enter
          e.stopPropagation();
          this.activeRipple();
          break;
        case 32: //Spacebar
          this.activeRipple();
          break;
        default:
          break;
      }
    },
  },
};
</script>

<style lang="scss">
@import '@/assets/scss/utils.scss';

.x-btn-group {
  @include group;

  .x-btn {
    &--primary,
    &--danger,
    &--flat {
      &:not(:first-of-type) {
        margin-left: var(--borderWidth) !important;
      }
    }
  }
}

.x-btn {
  box-sizing: border-box;
  position: relative;
  padding: var(--vGap) var(--hGap);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  vertical-align: middle;
  line-height: inherit;
  font-size: inherit;
  color: var(--fontColor);
  border: var(--borderWidth) solid var(--borderColor);
  border-radius: var(--borderRadius);
  transition: z-index 0.3s, border-color 0.3s, box-shadow 0.3s, color 0.3s, background 0.3s;
  z-index: 0;
  overflow: hidden;

  // 非禁用下的
  &:not([disabled]) {
    &:hover,
    &:focus-within {
      color: var(--themeColor);
      border-color: var(--themeColor);
    }

    // 焦點的陰影
    // &:focus-within {
    //   box-shadow: $shadow-52;
    // }
  }

  // 禁用 or 載入中
  &[disabled],
  &[loading] {
    opacity: 0.6;
    pointer-events: none;

    .btn {
      cursor: not-allowed;
      pointer-events: auto;
    }
  }
  // 非禁用 且 非載入中
  &:not([disabled]):not([loading]) {
    &:hover,
    &:active,
    &:focus-within {
      z-index: 1;
    }
    // 按下
    // &:active {
    //   transform: translateY(0.05em);
    // }
  }

  .btn {
    position: absolute;
    padding: 0;
    left: 0;
    top: 0;
    width: 100%;
    height: 100%;
    border: 0;
    background: none;
    user-select: none;
    cursor: pointer;
    outline: 0;

    &::-moz-focus-inner {
      border: 0;
    }

    &::before,
    &::after {
      content: '';
      display: block;
      position: absolute;
      width: 100%;
      height: 100%;
      left: 0;
      top: 0;
      opacity: 0;
      pointer-events: none;
    }

    // flat 背景
    &::before {
      background: #fff;
      transition: 0.3s;
    }

    // 波紋
    &::after {
      left: var(--x, 0);
      top: var(--y, 0);
      background-image: radial-gradient(circle, var(--themeColor) 10%, transparent 10.01%);
      background-repeat: no-repeat;
      background-position: 50%;
      transform: translate(-50%, -50%) scale(10);
      transition: transform 0.3s, opacity 0.8s;
    }

    // 啟動波紋
    &--active,
    &:active {
      &:not([disabled])::after {
        transform: translate(-50%, -50%) scale(0);
        opacity: 0.3;
        transition: 0s;
      }
    }
  }

  // 禁用樣式
  &--disabled {
    background: rgba(0, 0, 0, 0.1);
  }
  // 超連結樣式
  &--href {
    cursor: pointer;
  }
  // 圓行樣式
  &--circle {
    border-radius: 50%;
  }
  // 區塊樣式
  &--block {
    display: flex;
  }
  // 以下樣式，補上短少的邊框寬度
  &--primary,
  &--danger,
  &--flat {
    border: 0;
    padding: calc(var(--vGap) + var(--borderWidth)) calc(var(--hGap) + var(--borderWidth));

    &[empty] {
      padding: calc(var(--vGap) + var(--borderWidth));
    }
  }
  &--primary,
  &--danger {
    color: #fff;

    &:not([disabled]) {
      &:hover,
      &:focus-within {
        color: #fff;
      }
    }

    .btn::after {
      background-image: radial-gradient(circle, #fff 10%, transparent 10.01%);
    }
  }
  &--primary {
    background: var(--themeColor);
  }
  &--danger {
    background: var(--dangerColor);
  }
  &--dashed {
    border-style: dashed;
  }
  &--flat {
    .btn::before {
      background: var(--themeColor);
    }
    &:not([disabled]) {
      &:hover .btn::before {
        opacity: 0.1;
      }
      &:focus-within .btn::before {
        opacity: 0.2;
      }
    }
  }

  // 切換
  &[checked] {
    color: #fff;
    background: var(--themeColor);

    &:not([disabled]) {
      &:hover,
      &:focus-within {
        color: #fff;
        background: var(--themeColor);
      }
    }
  }

  .x-loading,
  .x-icon {
    color: inherit;

    &:first-child {
      margin-right: 0.35em;
    }
  }

  * ~ .x-icon {
    margin-left: 0.35em;
  }
  .x-icon {
    transition: none;
  }

  &[empty] {
    padding: var(--vGap);

    .x-loading,
    .x-icon {
      &:first-child {
        margin: 0 auto;
      }
    }
  }
}
</style>
