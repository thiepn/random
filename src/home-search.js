// Reusable, DOM-preserving search interaction for the Home and Arcade views.
export function createHomeSearchBox({
  className = "",
  placeholder = "Search randomizers…",
  node,
  iconNode,
  appendPresent,
  getSearch,
  setSearch,
  render
} = {}) {
  const wrap = node("label", {
    class: ("search-box home-search-box " + className).trim()
  }, [
    iconNode("search", { className: "search-icon" }),
    node("span", { class: "sr-only", text: "Search randomizers" })
  ]);

  const updateResults = (input) => {
    const start = input.selectionStart;
    const end = input.selectionEnd;
    const direction = input.selectionDirection;
    setSearch(input.value);
    render();
    const inputClass = className.split(" ").find(Boolean);
    const next = document.querySelector(
      inputClass ? "." + inputClass + " input" : ".home-search-box input"
    );
    if (next) {
      next.focus({ preventScroll: true });
      if (start != null && end != null) {
        next.setSelectionRange(start, end, direction || "none");
      }
    }
  };

  let composing = false;
  const search = node("input", {
    type: "search",
    value: getSearch(),
    placeholder,
    onInput: (event) => {
      if (composing || event.isComposing) {
        setSearch(event.target.value);
        return;
      }
      updateResults(event.target);
    }
  });
  search.addEventListener("compositionstart", () => {
    composing = true;
  });
  search.addEventListener("compositionend", () => {
    composing = false;
    updateResults(search);
  });

  appendPresent(wrap, search);
  return wrap;
}
