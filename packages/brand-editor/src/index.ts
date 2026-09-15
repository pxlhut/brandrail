/**
 * @pxlhut/brand-editor — the public surface (step 16).
 *
 * `useBrandEditor` is the entire package. No components, no CSS — that's
 * step 17's `@pxlhut/brand-editor`'s shadcn-registry component, a pure
 * rendering layer over the state this hook returns.
 */

export { useBrandEditor, PublishAbortedError } from './use-brand-editor.js';
export type {
  UseBrandEditorOptions,
  BrandEditorState,
  FieldState,
  FieldStates,
  FieldValueFor,
  PreviewResult,
  LogoAssetsState,
  LogoVariant,
  LogoVariantState,
} from './use-brand-editor.js';
