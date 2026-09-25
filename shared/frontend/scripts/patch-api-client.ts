#!/usr/bin/env node
// Patch @hey-api/openapi-ts generated Nuxt client files.
//
// Two fixes for known generator typing bugs (run after every `openapi-ts`):
//   1. sdk.gen.ts — function return types use DefaultT for the error slot, but the
//      actual `.post<T, ResT, SomeErrorType, DefaultT>(...)` calls return RequestResult
//      with the concrete error type. TypeScript can't prove SomeErrorType is assignable
//      to the generic DefaultT. Fix: replace the hand-written return type with `any` so
//      the real return type is inferred.
//   2. client.gen.ts — the SSE helper spreads Nuxt fetch options (which allow
//      `cache: false`) into createSseClient, whose parameter type only allows
//      RequestCache | undefined. Fix: override the Nuxt-specific `cache` with `undefined`.
// @ts-ignore
import { readFileSync, writeFileSync } from "node:fs";

const SDK_PATH = "app/api-client/sdk.gen.ts";
const CLIENT_PATH = "app/api-client/client/client.gen.ts";

// Fix 1: sdk.gen.ts — replace problematic return type annotations with `any`.
let sdk = readFileSync(SDK_PATH, "utf-8");
sdk = sdk.replace(/: RequestResult<TComposable, .+? \| DefaultT, DefaultT>(?= =>)/g, ": any");
writeFileSync(SDK_PATH, sdk);
console.log("✓ Patched sdk.gen.ts");

// Fix 2: client.gen.ts — suppress the Nuxt-specific `cache` option in the SSE helper.
// The spread `...unwrapRefs(opts)` carries `cache: false` (from Nuxt's useFetch options)
// into the object literal passed to createSseClient. Insert `cache: undefined` right
// after the spread so it wins and satisfies RequestInit['cache'].
let client = readFileSync(CLIENT_PATH, "utf-8");
client = client.replace("...unwrapRefs(opts),", "...unwrapRefs(opts),\n      cache: undefined,");
writeFileSync(CLIENT_PATH, client);
console.log("✓ Patched client.gen.ts");
