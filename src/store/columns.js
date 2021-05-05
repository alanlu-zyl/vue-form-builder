import Vue from 'vue';
import { instantiateSetState, instantiateGetState } from '@/store/helper.js';
import collects, { mutations as collectsMutations } from '@/store/collects.js';

import {
  nanoid,
  isEmpty,
  clearEmpties,
  arr2ObjByKey,
  arrRemoveValueByKey,
  arrRemoveValues,
  difference,
  deepCopy,
} from '@/assets/js/helper.js';

import { getTypeConstraint } from '@/assets/js/options.js';

const state = Vue.observable({ columns: [] });

// Getters
const getters = {
  // 欄位群 (可變的)
  mutableColumns: {
    get() {
      return state.columns;
    },
    set(val) {
      mutations.setColumns(val);
    },
  },
  // 欄位群 (Array to Obj - By Key)
  columnsByKey: () => arr2ObjByKey(state.columns, 'id'),
  // 最終欄位群 (去除不必要的屬性)
  finalColumns: () => processColumns(deepCopy(state.columns)),
};

// Mutations
const mutations = {
  // 設置欄位群
  setColumns(columns) {
    const oldColumns = deepCopy(state.columns);
    state.columns = clearEmpties(columns) || [];

    actions.handleUpdateColumns(state.columns, oldColumns);
  },
  // 新增欄位 (插入位置)
  addColumn(insertIdx = state.columns.length) {
    const emptyColumn = { id: nanoid(6) };
    const newColumns = [...state.columns];
    newColumns.splice(insertIdx, 0, emptyColumn);
    mutations.setColumns(newColumns);
  },
  // 刪除欄位 (欄位ID)
  removeColumn(id) {
    const newColumns = arrRemoveValueByKey(state.columns, 'id', id);
    mutations.setColumns(newColumns);
  },
  // 設置欄位 (欄位ID, 物件路徑, 值, 更新或插入)
  setColumnById(id, objectPath, value = {}, upsert = true) {
    const column = state.columns.find((c) => c.id === id);

    if (column) {
      const setColumn = instantiateSetState(column);
      const getColumn = instantiateGetState(column);

      const before = deepCopy(getColumn({ objectPath }));
      setColumn({ objectPath, value, upsert });
      const after = getColumn({ objectPath });

      const targetProp = objectPath.join('.');
      actions.handleUpdateColumnProp(column, targetProp, after, before);
    }
  },
};

// Actions
const actions = {
  // async fetchColumnsFromApi() {
  //   const res = await fetch('http://localhost:5001/api/columns');
  //   mutations.setColumns(res.data);
  // },
  handleUpdateColumns(after = [], before = []) {
    const afterIds = after.map((c) => c.id);
    const beforeIds = before.map((c) => c.id);
    const addIds = difference(afterIds, beforeIds); // 增加的欄位IDs
    const deductIds = difference(beforeIds, afterIds); // 減少的欄位IDs

    // 有增加的IDs
    if (addIds.length) {
      // 初始集合，提供後續使用。
      addIds.forEach((id) => {
        if (collects[id] === undefined) collectsMutations.setCollect([id], {});
      });
    }

    // 有減少的IDs
    if (deductIds.length) {
      // 監聽連動 [Side Effect]
      after.forEach((column) => {
        const setColumn = instantiateSetState(column);
        const getColumn = instantiateGetState(column);
        let objectPath = null;
        let targetValue = null;

        // 如果有規則
        if (column.rule) {
          // 被連動必填
          objectPath = ['rule', 'requiredPassive'];
          if ((targetValue = getColumn({ objectPath }))) {
            setColumn({ objectPath, value: arrRemoveValues(targetValue, deductIds) });
          }

          // 與...相符
          objectPath = ['rule', 'sameAs'];
          if ((targetValue = getColumn({ objectPath }))) {
            setColumn({ objectPath, value: null });
          }
        }

        // 如果有條件
        if (column.condition) {
          // 顯示
          objectPath = ['condition', 'display'];
          if ((targetValue = getColumn({ objectPath }))) {
            removeConditionDisplayTriggerId(targetValue, deductIds); // recursive & side effect
          }
        }
      });
    }
  },
  handleRemoveColumn(id, handleConfirm = null) {
    const idx = state.columns.findIndex((c) => c.id === id);
    const { name } = state.columns[idx];
    const showMsg = `確定刪除欄位 #${idx + 1} [${name || id}] ?`;

    const allowFunc = mutations.removeColumn.bind(null, id);

    if (typeof handleConfirm === 'function') {
      handleConfirm(showMsg, allowFunc);
    } else {
      if (confirm(showMsg)) allowFunc();
    }
  },
  handleUpdateColumnProp(column, targetProp, after, before) {
    switch (targetProp) {
      case 'type': {
        const typeConstraint = getTypeConstraint(after);
        console.log('type', after, before);

        // 基本設定
        if (column.base) {
          // 重置 [欄位性質]
          if (column.base.subType && !typeConstraint.isText) {
            column.base.subType = null;
          }
          // 重置 [可複選]
          if (column.base.multiple && !typeConstraint.canMultiple) {
            column.base.multiple = null;
          }
          // 重置 [預設值] (Array or Other)
          if (column.base.defaultValue) {
            column.base.defaultValue = column.base.multiple ? [] : null;
          }
        }

        // 規則設定
        if (column.rule) {
          // 重置 [與..相符]
          if (column.rule.sameAs) {
            column.rule.sameAs = null;
          }
        }

        // 連動其他欄位
        state.columns.map((c) => {
          if (c.rule?.sameAs === column.id) {
            c.rule.sameAs = null;
          }
          if (c.condition?.display) {
            initConditionDisplayValue(c.condition.display, column.id);
          }
        });

        break;
      }
      case 'base.multiple': {
        if (after !== before) {
          column.base.defaultValue = after ? [] : null;
        }
        break;
      }
      case 'rule.required': {
        if (after) column.rule.requiredPassive = [];
        break;
      }
      case 'item.options': {
        const afterIds = (after || []).map((c) => c.id);
        const beforeIds = (before || []).map((c) => c.id);
        const addIds = difference(afterIds, beforeIds); // 增加的欄位IDs
        const deductIds = difference(beforeIds, afterIds); // 減少的欄位IDs
        // console.log('item.options', addIds, deductIds);

        // 有增加的IDs
        if (addIds.length) {
        }

        // 有減少的IDs
        if (deductIds.length) {
          const baseDefaultValue = column.base?.defaultValue;
          if (baseDefaultValue) {
            if (column.base.multiple && baseDefaultValue.some((value) => deductIds.includes(value))) {
              column.base.defaultValue = arrRemoveValues(baseDefaultValue, deductIds);
            } else if (deductIds.includes(baseDefaultValue)) {
              column.base.defaultValue = null;
            }
          }

          state.columns.map((c) => {
            if (c.condition?.display) {
              removeConditionDisplayValue(c.condition.display, column.id, deductIds);
            }
          });
        }
        break;
      }
      default:
        break;
    }
  },
};

export default state.columns;
export { getters, mutations, actions };

// ----------------------
const processColumns = (function () {
  // 處理欄位
  const processColumn = (column) => {
    column = clearEmpties(column);

    return Object.entries(column).reduce((acc, [k, v]) => {
      if (isEmpty(v)) return acc;

      switch (k) {
        case 'rule':
          v = processRule(v);
          break;
        case 'item':
          v = processItem(v);
          break;
        case 'condition':
          v = processCondition(v);
          break;
      }

      if (!isEmpty(v)) acc[k] = v;

      return acc;
    }, {});
  };
  // 處理欄位的規則
  const processRule = (rule) => {
    const { msg, ...newRule } = rule;

    const cleanRule = Object.entries(newRule).reduce((acc, [k, v]) => {
      if (!isEmpty(v)) acc[k] = v;
      return acc;
    }, {});

    if (msg) {
      const newMsg = Object.entries(msg).reduce((acc, [k, v]) => {
        if (v && cleanRule[k]) acc[k] = v;
        return acc;
      }, {});

      if (!isEmpty(newMsg)) cleanRule['msg'] = newMsg;
    }

    return cleanRule;
  };
  // 處理欄位的項目
  const processItem = (item) => {
    const { srcMode, options, api, ...newItem } = item;

    switch (srcMode) {
      case 'list':
        if (!isEmpty(options)) {
          newItem['srcMode'] = srcMode;
          newItem['options'] = options;
        }
        break;
      case 'api':
        if (!isEmpty(api)) {
          newItem['srcMode'] = srcMode;
          newItem['api'] = api;
        }
        break;
    }

    return newItem;
  };
  // 處理欄位的條件
  const processCondition = (condition) => {
    let { display, ...newCondition } = condition;
    display = processDisplay(display);
    if (!isEmpty(display)) newCondition['display'] = display;

    return newCondition;
  };
  // 處理欄位的條件的顯示
  const processDisplay = (arr) => {
    if (!Array.isArray(arr)) return arr;

    return arr.reduce((acc, d) => {
      if (d.triggerId) {
        let { list, ...newD } = d;
        list = processDisplay(list);
        if (!isEmpty(list)) newD['list'] = list;
        if (!isEmpty(newD)) acc.push(newD);
      }
      return acc;
    }, []);
  };

  return (columns) => columns.map((column) => processColumn(column));
})();

// 初始不存在的id (recursive & side effect)
const removeConditionDisplayTriggerId = (arr, deductIds) => {
  if (!Array.isArray(arr)) return arr;

  return arr.map((d) => {
    if (d.triggerId && deductIds.includes(d.triggerId)) {
      d.triggerId = null;
      d.value = null;
    }
    if (Array.isArray(d.list) && d.list.length) {
      d.list = removeConditionDisplayTriggerId(d.list, deductIds);
    }
    return d;
  });
};

const initConditionDisplayValue = (arr, triggerId) => {
  if (!Array.isArray(arr)) return arr;

  return arr.map((d) => {
    if (d.triggerId === triggerId) {
      d.value = null;
    }
    if (Array.isArray(d.list) && d.list.length) {
      d.list = initConditionDisplayValue(d.list, triggerId);
    }
    return d;
  });
};

const removeConditionDisplayValue = (arr, triggerId, deductIds) => {
  if (!Array.isArray(arr)) return arr;

  return arr.map((d) => {
    if (d.triggerId === triggerId) {
      d.value = arrRemoveValues(d.value, deductIds);
    }
    if (Array.isArray(d.list) && d.list.length) {
      d.list = removeConditionDisplayValue(d.list, triggerId, deductIds);
    }
    return d;
  });
};
