// Deno type declarations for Edge Functions
declare module 'https://deno.land/std@0.168.0/http/server.ts' {
  export function serve(
    handler: (request: Request) => Response | Promise<Response>,
    options?: { port?: number; hostname?: string; signal?: AbortSignal }
  ): Promise<void>
}

declare namespace Deno {
  export namespace env {
    export function get(key: string): string | undefined
  }
}
