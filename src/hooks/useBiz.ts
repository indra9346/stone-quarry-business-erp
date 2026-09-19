import { useMutation, useQuery, useQueryClient, type QueryKey } from '@tanstack/react-query'
import type { SupabaseClient } from '@supabase/supabase-js'
import { useBusinessContext } from '@/features/auth/businessContextValue'

/**
 * Data access is always through the CURRENT business's client, and every query
 * key is prefixed with the business code — so KMG rows can never be served from
 * Murudeshwara's cache (or the other way round), even in the same browser tab.
 */
export function useBizQuery<T>(
  key: QueryKey,
  fn: (client: SupabaseClient) => Promise<T>,
  options: { enabled?: boolean; staleTime?: number } = {},
) {
  const { code, client, accessState } = useBusinessContext()
  return useQuery<T, Error>({
    queryKey: ['biz', code, ...key],
    queryFn: () => fn(client!),
    enabled: !!client && accessState === 'ready' && (options.enabled ?? true),
    staleTime: options.staleTime,
  })
}

export function useBizMutation<TVars, TData = unknown>(
  fn: (client: SupabaseClient, vars: TVars) => Promise<TData>,
  options: { invalidate?: QueryKey[]; onSuccess?: (data: TData, vars: TVars) => void } = {},
) {
  const { code, client } = useBusinessContext()
  const qc = useQueryClient()
  return useMutation<TData, Error, TVars>({
    mutationFn: (vars) => fn(client!, vars),
    onSuccess: async (data, vars) => {
      const keys = options.invalidate ?? [[]]
      await Promise.all(keys.map((k) => qc.invalidateQueries({ queryKey: ['biz', code, ...k] })))
      options.onSuccess?.(data, vars)
    },
  })
}
