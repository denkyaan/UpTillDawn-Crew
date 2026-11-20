import { defineCloudflareConfig } from '@opennextjs/cloudflare'
import staticAssetsIncrementalCache from '@opennextjs/cloudflare/overrides/incremental-cache/static-assets-incremental-cache'

// Only public login and metadata pages are SSG in this application; all
// authenticated pages remain dynamic and keep their live RLS-backed reads.
// Avoid loading the full NextServer on every request for prerendered login
// shells. The packaged cache is read-only: never put authenticated pages or
// routes relying on ISR/revalidatePath into the static route set.
export default defineCloudflareConfig({
  incrementalCache: staticAssetsIncrementalCache,
  // Main serves private pages dynamically; its only prerendered output is
  // the public login/metadata shell. Intercepting all requests at the edge
  // adds an unnecessary cache-route pass and can amplify Next 16 segment
  // prefetch loops on some OpenNext versions. Keep static-assets caching
  // for public shells; do not cache authenticated SSR or user-specific data.
  enableCacheInterception: false,
})
