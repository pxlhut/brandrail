/**
 * Architecture rules — see DECISIONS.md § "Folder structure".
 *
 * Feature-based folders decay into ordinary folders unless the import
 * direction is enforced. These rules are the enforcement. A violation is a
 * failed build, not a review comment.
 */

const CORE = '^packages/brand-core/src';

/**
 * A feature may import `shared/` and the features listed in `allowed`.
 * Everything else under `features/` is off limits.
 */
function layer(name, allowed) {
  return {
    name: `layer-${name}`,
    comment:
      `features/${name} may import: ${allowed.join(', ') || '(no other feature)'}. ` +
      `See the graph in DECISIONS.md.`,
    severity: 'error',
    from: { path: `${CORE}/features/${name}/` },
    to: {
      path: `${CORE}/features/([^/]+)/`,
      pathNot: `${CORE}/features/(${[name, ...allowed].join('|')})/`,
    },
  };
}

module.exports = {
  forbidden: [
    {
      name: 'no-circular',
      comment: 'Circular imports are the failure this structure exists to prevent.',
      severity: 'error',
      from: {},
      to: { circular: true },
    },

    {
      name: 'no-cross-feature-internals',
      comment:
        'A feature is a black box: import `features/<name>/index.ts`, never a ' +
        'file inside it. Reaching past the barrel is how feature boundaries rot.',
      severity: 'error',
      from: { path: `${CORE}/(?:features/([^/]+)|shared)/` },
      to: {
        path: `${CORE}/features/[^/]+/.+`,
        pathNot: [
          `${CORE}/features/$1/`, // same feature — internal imports are fine
          `${CORE}/features/[^/]+/index\\.ts$`, // another feature's barrel — fine
        ],
      },
    },

    {
      name: 'shared-imports-no-features',
      comment: 'shared/ is the bottom of the graph. It may not depend on a feature.',
      severity: 'error',
      from: { path: `${CORE}/shared/` },
      to: { path: `${CORE}/features/` },
    },

    // The layering graph, low to high.
    layer('contrast', []),
    layer('shape', []),
    layer('typography', []),
    layer('validation', []),
    layer('palette', ['contrast']),
    layer('semantics', ['contrast', 'palette']),
    layer('output', ['validation']),
    layer('theme', ['contrast', 'shape', 'typography', 'validation', 'palette', 'semantics', 'output']),

    {
      name: 'no-orphans',
      severity: 'warn',
      from: {
        orphan: true,
        pathNot: ['\\.d\\.ts$', '(^|/)index\\.ts$', '\\.config\\.(ts|js|cjs|mjs)$'],
      },
      to: {},
    },
  ],

  options: {
    doNotFollow: { path: 'node_modules' },
    // `brand-editor/registry` is excluded outright, not just from the layering
    // rules (which only ever scoped brand-core anyway): its `@/*` imports
    // resolve against a *consumer's* project layout, not this monorepo's
    // `tsconfig.base.json`, so this tool can't resolve them at all — every
    // file in that tree reads as a false-positive orphan otherwise (step 17).
    exclude: { path: '(node_modules|dist|/proofs/|/fixtures/|packages/brand-editor/registry/)' },
    tsConfig: { fileName: 'tsconfig.base.json' },
    tsPreCompilationDeps: true,
    enhancedResolveOptions: {
      exportsFields: ['exports'],
      conditionNames: ['import', 'require', 'node', 'default', 'types'],
      extensions: ['.js', '.ts', '.d.ts'],
    },
  },
};
