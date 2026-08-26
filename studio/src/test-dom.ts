// JSDOM does not implement text geometry. CodeMirror only needs an empty,
// standards-shaped result for component tests that do not assert layout.
if (typeof Range !== 'undefined' && typeof Range.prototype.getClientRects !== 'function') {
  Object.defineProperty(Range.prototype, 'getClientRects', {
    configurable: true,
    value: () => [] as unknown as DOMRectList,
  });
}
