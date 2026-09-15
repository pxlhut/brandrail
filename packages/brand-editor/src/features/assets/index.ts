/**
 * The logo field (§36) never reaches `generateTheme()` — it's a file, not a
 * token. This hook owns upload state for the `{ light, dark }` variant pair
 * and delegates the actual upload to an injected callback; storing both
 * variants from the start (even before dark mode ships) is what §36 warns
 * is expensive to retrofit later.
 */

import { useCallback, useMemo, useState } from 'react';

export type LogoVariant = 'light' | 'dark';

export interface LogoVariantState {
  url: string | undefined;
  uploading: boolean;
  error: string | null;
  /** No-op when the field is locked — mirrors `FieldState.setValue`'s own contract. */
  upload: (file: File) => Promise<void>;
}

export interface UseLogoAssetsOptions {
  value: { light?: string; dark?: string };
  disabled: boolean;
  setValue: (value: { light?: string; dark?: string }) => void;
  onUpload?: (file: File, variant: LogoVariant) => Promise<string>;
}

export interface LogoAssetsState {
  light: LogoVariantState;
  dark: LogoVariantState;
}

function useVariant(
  variant: LogoVariant,
  value: { light?: string; dark?: string },
  disabled: boolean,
  setValue: (value: { light?: string; dark?: string }) => void,
  onUpload?: (file: File, variant: LogoVariant) => Promise<string>,
): LogoVariantState {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const upload = useCallback(
    async (file: File) => {
      if (disabled || onUpload === undefined) return;
      setUploading(true);
      setError(null);
      try {
        const url = await onUpload(file, variant);
        setValue({ ...value, [variant]: url });
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setUploading(false);
      }
    },
    [disabled, onUpload, setValue, value, variant],
  );

  return { url: value[variant], uploading, error, upload };
}

export function useLogoAssets({ value, disabled, setValue, onUpload }: UseLogoAssetsOptions): LogoAssetsState {
  const light = useVariant('light', value, disabled, setValue, onUpload);
  const dark = useVariant('dark', value, disabled, setValue, onUpload);
  return useMemo(() => ({ light, dark }), [light, dark]);
}
