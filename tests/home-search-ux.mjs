import assert from "node:assert/strict";
import { createHomeSearchBox } from "../src/home-search.js";

let value = "";
let renders = 0;
let currentInput = null;
const selector = ".home-primary-search input";

globalThis.document = {
  querySelector: (target) => {
    assert.equal(target, selector);
    return currentInput;
  }
};

function node(tag, props = {}, children = []) {
  return {
    tag,
    props,
    children: Array.isArray(children) ? [...children] : [children],
    value: props.value ?? "",
    selectionStart: 0,
    selectionEnd: 0,
    selectionDirection: "none",
    listeners: new Map(),
    addEventListener(name, fn) { this.listeners.set(name, fn); },
    focus(options) { this.focused = true; this.focusOptions = options; },
    setSelectionRange(start, end, direction) {
      this.selectionStart = start;
      this.selectionEnd = end;
      this.selectionDirection = direction;
    }
  };
}

function render() {
  const wrap = createHomeSearchBox({
    className: "home-primary-search",
    node,
    iconNode: () => ({}),
    appendPresent: (parent, child) => parent.children.push(child),
    getSearch: () => value,
    setSearch: (next) => { value = next; },
    render
  });
  currentInput = wrap.children.at(-1);
  renders += 1;
}

render();
const initial = currentInput;
initial.value = "alphabet";
initial.setSelectionRange(2, 5, "forward");
initial.props.onInput({ target: initial, isComposing: false });

assert.equal(value, "alphabet");
assert.equal(renders, 2);
assert.notEqual(currentInput, initial);
assert.equal(currentInput.focused, true);
assert.deepEqual(currentInput.focusOptions, { preventScroll: true });
assert.deepEqual(
  [currentInput.selectionStart, currentInput.selectionEnd, currentInput.selectionDirection],
  [2, 5, "forward"]
);

const composing = currentInput;
composing.listeners.get("compositionstart")();
composing.value = "日本語";
composing.props.onInput({ target: composing, isComposing: true });
assert.equal(value, "日本語");
assert.equal(renders, 2, "IME input must not replace an active composition");
composing.listeners.get("compositionend")();
assert.equal(renders, 3);
assert.equal(currentInput.value, "日本語");

console.log("search interaction regression tests passed");
