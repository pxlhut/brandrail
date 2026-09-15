import '@testing-library/jest-dom/vitest';

// jsdom has no layout engine, so it has no `ResizeObserver` either. Base UI's
// `Slider` (and other floating-ui-positioned primitives) wait for one
// observation before revealing content, to avoid a flash of unpositioned
// markup — without this stub they stay `visibility: hidden` forever in tests.
class ResizeObserverStub {
  private readonly callback: ResizeObserverCallback;
  constructor(callback: ResizeObserverCallback) {
    this.callback = callback;
  }
  observe(target: Element) {
    this.callback([{ target } as ResizeObserverEntry], this);
  }
  unobserve() {}
  disconnect() {}
}

globalThis.ResizeObserver ??= ResizeObserverStub;
