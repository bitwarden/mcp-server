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
