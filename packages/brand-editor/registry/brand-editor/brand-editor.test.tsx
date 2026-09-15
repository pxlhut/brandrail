/**
 * End-to-end against the real hook and the step 12 in-memory store, the same
 * way `use-brand-editor.test.tsx` is — this is the "pure rendering layer"
 * claim (step 16's own doc comment) actually being exercised, not a mock
 * standing in for the hook.
 *
 * Every query below is scoped to the `container` the test's own `render()`
 * call returned (via `within`), rather than the ambient `screen` — jsdom has
 * no layout engine, and Base UI's Tabs/Popover animate-out their previous
 * content on a timer this suite fake-advances, so a `screen`-wide query can
 * still see a just-replaced node from earlier in the *same* test. Scoping to
 * this test's own container sidesteps that entirely.
 */

import { cleanup, fireEvent, render, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { FIELD_IDS } from "@pxlhut/brand-core";
import { MemoryBrandThemeStore } from "@pxlhut/brand-store/memory";
import { provisionSite, publishTheme, saveDraft, type AccessContext } from "@pxlhut/brand-store/service";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { BrandEditor } from "./brand-editor";

async function setup(siteId: string) {
  const store = new MemoryBrandThemeStore();
  await provisionSite(siteId, { brandColor: "#7c6cff" }, { store });
  const initial = await store.getConfig(siteId);
  if (initial === null) throw new Error("provisionSite did not create a config");

  const access: AccessContext = { userId: "owner-1", authorize: async () => "owner" };
  const onSave = (patch: Parameters<typeof saveDraft>[1]) => saveDraft(siteId, patch, { store, ...access });
  const onPublish = () => publishTheme(siteId, { store, ...access });

  return { store, initial, onSave, onPublish };
}

beforeEach(() => vi.useFakeTimers({ shouldAdvanceTime: true }));
afterEach(() => {
  // Not auto-registered: this config doesn't set vitest's `test.globals`, and RTL's own auto-cleanup only self-registers against a *global* `afterEach`.
  cleanup();
  vi.useRealTimers();
});

describe("<BrandEditor />", () => {
  it("renders all 14 §33 fields, and shows a locked field as visible and disabled, not hidden", async () => {
    const { initial, onSave, onPublish } = await setup("site-fields");
    const { container } = render(
      <BrandEditor controlConfig={initial.controlConfig} initial={initial} onSave={onSave} onPublish={onPublish} />,
    );
    const screen = within(container);

    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    // Every field's group heading appears at some point — walk every tab, since an inactive one unmounts its panel.
    const seen = new Set<string>();
    for (const tab of screen.getAllByRole("tab")) {
      await user.click(tab);
      for (const id of FIELD_IDS) {
        if (container.querySelector(`#${id}-heading`)) seen.add(id);
      }
    }
    expect([...seen].sort()).toEqual([...FIELD_IDS].sort());

    // `semanticColors` defaults to `locked` (§34) — shown, not hidden, with the platform explanation as real text.
    await user.click(screen.getByRole("tab", { name: "Brand" }));
    expect(screen.getByText("Managed by the platform")).toBeInTheDocument();
  });

  it("flipping `semanticColors` from locked to direct reshapes the field with no other change — the step 16/17 demo", async () => {
    const { initial, onSave, onPublish } = await setup("site-flip");
    const { container, rerender } = render(
      <BrandEditor controlConfig={initial.controlConfig} initial={initial} onSave={onSave} onPublish={onPublish} />,
    );
    const screen = within(container);

    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    await user.click(screen.getByRole("tab", { name: "Brand" }));
    expect(screen.getByText("Managed by the platform")).toBeInTheDocument();

    const upgraded = { ...initial.controlConfig, semanticColors: { tier: "direct" as const, type: "color" as const } };
    rerender(<BrandEditor controlConfig={upgraded} initial={initial} onSave={onSave} onPublish={onPublish} />);

    expect(screen.queryByText("Managed by the platform")).not.toBeInTheDocument();
    // Four colour swatches — one per semantic role (§34) — now editable.
    expect(screen.getAllByRole("textbox", { name: /Error|Success|Warning|Info/ })).toHaveLength(4);
  });

  it("§31's two Guided shapes render distinctly: a segmented radiogroup for `select`, a slider for `elevation`", async () => {
    const { initial, onSave, onPublish } = await setup("site-shapes");
    const { container } = render(
      <BrandEditor controlConfig={initial.controlConfig} initial={initial} onSave={onSave} onPublish={onPublish} />,
    );
    const screen = within(container);

    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    await user.click(screen.getByRole("tab", { name: "Typography & shape" }));

    // `radius` is `guided: select` with 3 options (§32) — a segmented control, not a dropdown.
    const radiusGroup = container.querySelector<HTMLElement>("#radius")!;
    expect(radiusGroup).toHaveAttribute("role", "radiogroup");
    expect(within(radiusGroup).getAllByRole("radio")).toHaveLength(3);

    // `elevation` is `guided: slider`, 0-100 (§33) — its accessible native `<input type="range">` is present.
    // (jsdom has no layout engine, so Base UI's own position-aware visibility check never clears — a real
    // browser renders and exposes it as `role="slider"`; this checks the same underlying control directly.)
    const elevationGroup = container.querySelector<HTMLElement>("#elevation")!;
    expect(elevationGroup.querySelector('input[type="range"]')).not.toBeNull();
  });

  it("arrow keys move the segmented control's selection — keyboard-navigable, not mouse-only", async () => {
    const { initial, onSave, onPublish } = await setup("site-keyboard");
    const { container } = render(
      <BrandEditor controlConfig={initial.controlConfig} initial={initial} onSave={onSave} onPublish={onPublish} />,
    );
    const screen = within(container);

    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    await user.click(screen.getByRole("tab", { name: "Typography & shape" }));

    const radiusGroup = container.querySelector<HTMLElement>("#radius")!;
    const radios = within(radiusGroup).getAllByRole("radio");
    const initiallyChecked = radios.find((radio) => radio.getAttribute("aria-checked") === "true")!;
    initiallyChecked.focus();

    await user.keyboard("{ArrowRight}");

    const nowChecked = within(radiusGroup)
      .getAllByRole("radio")
      .find((radio) => radio.getAttribute("aria-checked") === "true")!;
    expect(nowChecked).not.toBe(initiallyChecked);
    expect(nowChecked).toHaveFocus();
  });

  it("a contrast violation from a raw override shows as a field error and blocks Publish", async () => {
    const { initial, onSave, onPublish } = await setup("site-violation");
    // advancedTokens is `raw` tier by default (§33) — no controlConfig override needed.
    const { container } = render(
      <BrandEditor controlConfig={initial.controlConfig} initial={initial} onSave={onSave} onPublish={onPublish} />,
    );
    const screen = within(container);

    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    await user.click(screen.getByRole("tab", { name: "Advanced" }));

    // Not `getByLabelText`: `FieldRow`'s own `role="group"` wrapper carries the same `aria-labelledby` as the textarea inside it (both correctly named "Advanced tokens"), so a label-text query matches both. Filtering by role first is unambiguous.
    const textarea = screen.getByRole("textbox", { name: "Advanced tokens" }) as HTMLTextAreaElement;
    // `fireEvent.change`, not `user.type` — the value is pasted-in JSON, and `{`/`}` have special meaning to `userEvent.type`'s keystroke syntax.
    fireEvent.change(textarea, {
      target: { value: JSON.stringify({ "color.primary": "#808080", "color.primary-foreground": "#888888" }) },
    });
    await user.click(screen.getByRole("button", { name: "Apply changes" }));

    expect(await screen.findByRole("button", { name: "Publish" })).toBeDisabled();
    // Not `getByText`: the message spans a `<code>` boundary, so no single element's own text node contains the whole phrase.
    expect(container.textContent).toMatch(/needs contrast Lc/);
  });
});
