/**
 * Input validation utilities
 */

import { z } from 'zod';

/**
 * Validates input against a Zod schema and returns either the validated data or a structured error response.
 */
export function validateInput<T>(
  schema: z.ZodType<T>,
  args: unknown,
):
  | readonly [true, T]
  | readonly [
      false,
      {
        readonly content: readonly [
          { readonly type: 'text'; readonly text: string },
        ];
        readonly isError: true;
      },
    ] {
  try {
    const validatedInput = schema.parse(args ?? {});
    return [true, validatedInput] as const;
  } catch (error) {
    if (error instanceof z.ZodError) {
      const errorMessage = error.issues
        .map((issue) => issue.message)
        .join(', ');

      return [
        false,
        {
          content: [
            {
              type: 'text',
              text: `Validation error: ${errorMessage}`,
            } as const,
          ],
          isError: true,
        } as const,
      ] as const;
    }

    throw error;
  }
}

/**
 * Higher-order function that handles validation and executes a handler function with validated arguments.
 * This eliminates the need for every handler to duplicate validation error handling.
 *
 * @param schema - Zod schema for validation
 * @param handlerFn - Function to execute with validated arguments
 * @returns A handler function that validates input and executes the provided function
 */
export function withValidation<T, R>(
  schema: z.ZodType<T>,
  handlerFn: (validatedArgs: T) => Promise<R>,
) {
  return async (args: unknown): Promise<R> => {
    const [success, validatedArgs] = validateInput(schema, args);
    if (!success) {
      return validatedArgs as R; // Type assertion needed due to union type
    }
    return handlerFn(validatedArgs);
  };
}
