/**
 * Error handling utilities
 */

export class BrandProfileGenerationError extends Error {
  constructor(
    message: string,
    public step: string,
    public recoverable: boolean = false,
    public details?: any
  ) {
    super(message);
    this.name = 'BrandProfileGenerationError';
  }
}

export function handleError(error: unknown, step: string): Response {
  console.error(`Error in ${step}:`, error);

  if (error instanceof BrandProfileGenerationError) {
    return new Response(
      JSON.stringify({
        error: error.message,
        step: error.step,
        recoverable: error.recoverable,
        details: error.details,
      }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  return new Response(
    JSON.stringify({
      error: 'An unexpected error occurred',
      step,
      details: error instanceof Error ? error.message : 'Unknown error',
    }),
    { status: 500, headers: { 'Content-Type': 'application/json' } }
  );
}
