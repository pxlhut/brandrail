# Backend integration

Every snippet below wires the same three service-layer calls
(`saveDraft`, `publishTheme`, `renderThemeStyle` — all from
`@pxlhut/brand-store/service`) into a different framework's request/
response shape. **These are documentation, not dependencies.** The moment
`@pxlhut/brand-store` imported one framework's request/response types or
DI container, it would stop being backend-agnostic — the whole reason a
Fastify shop and an AdonisJS shop can both use this package unmodified.

Wherever you see `store` below, it's whatever `BrandThemeStore` you
constructed — the in-memory reference adapter, `@pxlhut/brand-store-lucid`,
or your own. Nothing past this line cares which.

## AdonisJS (the one real adapter)

`@pxlhut/brand-store-lucid` ships as an Adonis service provider — list it
in `adonisrc.ts`'s `providers` array and the container hands you a ready
instance instead of constructing one by hand:

```ts
// adonisrc.ts
export default defineConfig({
  providers: [
    // ...
    () => import('@pxlhut/brand-store-lucid/provider'),
  ],
});
```

```ts
// a controller
import { saveDraft, publishTheme } from '@pxlhut/brand-store/service';

export default class BrandController {
  async saveDraft({ request, auth }: HttpContext) {
    const store = await this.app.container.make('brand.store');
    const config = await saveDraft(request.param('siteId'), request.body(), {
      store,
      userId: auth.user!.id,
      authorize: async () => 'owner', // your own role lookup
    });
    return config;
  }

  async publish({ request, auth }: HttpContext) {
    const store = await this.app.container.make('brand.store');
    return publishTheme(request.param('siteId'), {
      store,
      userId: auth.user!.id,
      authorize: async () => 'owner',
    });
  }
}
```

## Express

```ts
import express from "express";
import { saveDraft, publishTheme } from "@pxlhut/brand-store/service";

const app = express();
app.use(express.json());

app.post("/sites/:siteId/draft", async (req, res) => {
  const config = await saveDraft(req.params.siteId, req.body, {
    store,
    userId: req.user.id,
    authorize: async () => req.user.roleFor(req.params.siteId),
  });
  res.json(config);
});

app.post("/sites/:siteId/publish", async (req, res) => {
  const result = await publishTheme(req.params.siteId, {
    store,
    userId: req.user.id,
    authorize: async () => req.user.roleFor(req.params.siteId),
  });
  res.status(result.ok ? 200 : 422).json(result);
});
```

## Fastify

```ts
import Fastify from "fastify";
import { saveDraft, publishTheme } from "@pxlhut/brand-store/service";

const app = Fastify();

app.post("/sites/:siteId/draft", async (request, reply) => {
  const { siteId } = request.params as { siteId: string };
  const config = await saveDraft(siteId, request.body, {
    store,
    userId: request.user.id,
    authorize: async () => request.user.roleFor(siteId),
  });
  return config;
});
```

## Koa

```ts
import Router from "@koa/router";
import { saveDraft } from "@pxlhut/brand-store/service";

const router = new Router();

router.post("/sites/:siteId/draft", async (ctx) => {
  ctx.body = await saveDraft(ctx.params.siteId, ctx.request.body, {
    store,
    userId: ctx.state.user.id,
    authorize: async () => ctx.state.user.roleFor(ctx.params.siteId),
  });
});
```

## NestJS

The one framework here with a real DI container worth actually wrapping
`BrandThemeStore` for — as an injectable provider, not as a dependency of
the store package itself:

```ts
// brand-store.provider.ts
import { Provider } from "@nestjs/common";
import { MemoryBrandThemeStore } from "@pxlhut/brand-store/memory";
import type { BrandThemeStore } from "@pxlhut/brand-store";

export const BRAND_STORE = Symbol("BRAND_STORE");

export const BrandStoreProvider: Provider = {
  provide: BRAND_STORE,
  useFactory: (): BrandThemeStore => new MemoryBrandThemeStore(), // swap for your real adapter
};
```

```ts
// brand.controller.ts
import { Controller, Inject, Post, Param, Body, Req } from "@nestjs/common";
import { saveDraft, publishTheme } from "@pxlhut/brand-store/service";
import type { BrandThemeStore } from "@pxlhut/brand-store";
import { BRAND_STORE } from "./brand-store.provider.js";

@Controller("sites/:siteId")
export class BrandController {
  constructor(@Inject(BRAND_STORE) private readonly store: BrandThemeStore) {}

  @Post("draft")
  saveDraft(@Param("siteId") siteId: string, @Body() patch: unknown, @Req() req: Request) {
    return saveDraft(siteId, patch as never, {
      store: this.store,
      userId: (req as any).user.id,
      authorize: async () => "owner",
    });
  }

  @Post("publish")
  publish(@Param("siteId") siteId: string, @Req() req: Request) {
    return publishTheme(siteId, {
      store: this.store,
      userId: (req as any).user.id,
      authorize: async () => "owner",
    });
  }
}
```

`BrandThemeStore`'s own interface still has no idea NestJS exists — the DI
wrapper lives entirely in your app.

## The read path is the same everywhere

Regardless of framework, the request a visitor's browser makes never
calls any of the above — see
[the SSR read path](../packages/brand-store/src/service/features/delivery/read-path.md)
for `renderThemeStyle`, the CSP header, and the one real gap (ISR caching)
worth knowing about before you ship.
