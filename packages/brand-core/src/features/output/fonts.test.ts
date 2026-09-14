import { describe, expect, it } from 'vitest';

import { FONT_STACKS } from '../../shared/fields/index.js';
import { fontFaceBlocks } from './fonts.js';

const INTER = FONT_STACKS['inter'] as string;
const MONO = FONT_STACKS['jetbrains-mono'] as string;

describe('fontFaceBlocks', () => {
  it('emits nothing for "none"', () => {
    expect(fontFaceBlocks([INTER], 'none')).toBe('');
  });

  it('"fontsource" documents the exact package to install', () => {
    expect(fontFaceBlocks([INTER], 'fontsource')).toBe('/* fonts: npm install @fontsource/inter */');
  });

  it('"fontsource" lists every distinct package once, for heading + body', () => {
    const result = fontFaceBlocks([INTER, MONO], 'fontsource');
    expect(result).toContain('@fontsource/inter');
    expect(result).toContain('@fontsource/jetbrains-mono');
  });

  it('"fontsource" is a comment, not a fabricated @import URL', () => {
    expect(fontFaceBlocks([INTER], 'fontsource')).not.toMatch(/@import/);
  });

  it('"inline-face" emits a real @font-face with a local() source', () => {
    expect(fontFaceBlocks([INTER], 'inline-face')).toBe(
      "@font-face{font-family:'Inter';src:local('Inter');font-display:swap;}",
    );
  });

  it('"inline-face" emits one block per distinct family, not per input', () => {
    const result = fontFaceBlocks([INTER, INTER], 'inline-face');
    expect(result.match(/@font-face/g)).toHaveLength(1);
  });

  it('deals gracefully with a stack that matches no curated id', () => {
    expect(fontFaceBlocks(['not-a-curated-stack'], 'fontsource')).toBe('');
  });
});
