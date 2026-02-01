import { createTRPCProxyClient, httpBatchLink, loggerLink } from '@trpc/client'
import type { AppRouter } from '../server/trpc'

const getBaseUrl = () => {
  if (typeof window !== 'undefined') {
    return ''
  }

  const envBaseUrl = process.env.TRPC_BASE_URL
  return envBaseUrl && envBaseUrl.trim().length > 0
    ? envBaseUrl
    : 'http://localhost:3000'
}

export const createTrpcClient = (baseUrl = getBaseUrl()) =>
  createTRPCProxyClient<AppRouter>({
    links: [
      loggerLink({
        enabled: (opts) =>
          process.env.NODE_ENV === 'development' ||
          (opts.direction === 'down' && opts.result instanceof Error),
      }),
      httpBatchLink({
        url: `${baseUrl}/api/trpc`,
      }),
    ],
  })

export const trpcClient = createTrpcClient()
