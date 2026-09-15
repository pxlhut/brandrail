import { describe, expect, it } from 'vitest';

import { requireWriteAccess, RoleError, type SiteRole } from './index.js';

function ctxWithRole(role: SiteRole | null) {
  return {
    userId: 'user-1',
    authorize: async () => role,
  };
}

describe('requireWriteAccess', () => {
  it('allows an owner', async () => {
    await expect(requireWriteAccess('site-1', ctxWithRole('owner'))).resolves.toBe('owner');
  });

  it('allows an editor', async () => {
    await expect(requireWriteAccess('site-1', ctxWithRole('editor'))).resolves.toBe('editor');
  });

  it('rejects a viewer with RoleError', async () => {
    await expect(requireWriteAccess('site-1', ctxWithRole('viewer'))).rejects.toBeInstanceOf(RoleError);
  });

  it('rejects someone with no relationship to the site at all', async () => {
    await expect(requireWriteAccess('site-1', ctxWithRole(null))).rejects.toBeInstanceOf(RoleError);
  });

  it('names the site and the user on the error, for a caller that wants to log it', async () => {
    try {
      await requireWriteAccess('site-42', ctxWithRole(null));
      expect.unreachable();
    } catch (error) {
      expect(error).toBeInstanceOf(RoleError);
      const roleError = error as RoleError;
      expect(roleError.siteId).toBe('site-42');
      expect(roleError.userId).toBe('user-1');
    }
  });
});
