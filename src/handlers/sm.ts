/**
 * Secrets Manager handlers for projects and secrets
 *
 * Secret values are returned only by `get_sm_secret`. Every other handler
 * removes them from the `bws` output, and the import and export handlers
 * report keys only, so values can be stored or restored without passing
 * through the client.
 */

import fs from 'fs';
import { withValidation } from '../utils/validation.js';
import {
  executeSmCommand,
  generateSecretValue,
  parseSmSecretList,
  redactSecretValues,
} from '../utils/sm.js';
import { formatEnvFile, isEnvKey, parseEnvFile } from '../utils/env-file.js';
import {
  listSmProjectsSchema,
  getSmProjectSchema,
  createSmProjectSchema,
  editSmProjectSchema,
  deleteSmProjectSchema,
  listSmSecretsSchema,
  getSmSecretSchema,
  createSmSecretSchema,
  editSmSecretSchema,
  deleteSmSecretSchema,
  importSmSecretsSchema,
  exportSmSecretsSchema,
} from '../schemas/sm.js';
import type { CliResponse } from '../utils/types.js';

function toMcpFormat(response: CliResponse) {
  return {
    isError: response.errorOutput ? true : false,
    content: [
      {
        type: 'text',
        text:
          response.output ||
          response.errorOutput ||
          'Success: Operation completed',
      },
    ],
  };
}

function toRedactedMcpFormat(response: CliResponse) {
  if (response.errorOutput) {
    return toMcpFormat(response);
  }
  return toMcpFormat({ output: redactSecretValues(response.output) });
}

function textResult(text: string, isError = false) {
  return {
    isError,
    content: [{ type: 'text', text }],
  };
}

export const handleListSmProjects = withValidation(
  listSmProjectsSchema,
  async () => {
    const response = await executeSmCommand('project', 'list');
    return toMcpFormat(response);
  },
);

export const handleGetSmProject = withValidation(
  getSmProjectSchema,
  async (validatedArgs) => {
    const response = await executeSmCommand(
      'project',
      'get',
      [],
      [validatedArgs.projectId],
    );
    return toMcpFormat(response);
  },
);

export const handleCreateSmProject = withValidation(
  createSmProjectSchema,
  async (validatedArgs) => {
    const response = await executeSmCommand(
      'project',
      'create',
      [],
      [validatedArgs.name],
    );
    return toMcpFormat(response);
  },
);

export const handleEditSmProject = withValidation(
  editSmProjectSchema,
  async (validatedArgs) => {
    const response = await executeSmCommand(
      'project',
      'edit',
      [`--name=${validatedArgs.name}`],
      [validatedArgs.projectId],
    );
    return toMcpFormat(response);
  },
);

export const handleDeleteSmProject = withValidation(
  deleteSmProjectSchema,
  async (validatedArgs) => {
    const response = await executeSmCommand(
      'project',
      'delete',
      [],
      [validatedArgs.projectId],
    );
    return toMcpFormat(response);
  },
);

export const handleListSmSecrets = withValidation(
  listSmSecretsSchema,
  async (validatedArgs) => {
    const response = await executeSmCommand(
      'secret',
      'list',
      [],
      validatedArgs.projectId ? [validatedArgs.projectId] : [],
    );
    return toRedactedMcpFormat(response);
  },
);

export const handleGetSmSecret = withValidation(
  getSmSecretSchema,
  async (validatedArgs) => {
    const response = await executeSmCommand(
      'secret',
      'get',
      [],
      [validatedArgs.secretId],
    );
    return toMcpFormat(response);
  },
);

export const handleCreateSmSecret = withValidation(
  createSmSecretSchema,
  async (validatedArgs) => {
    const { key, projectId, value, generate, note } = validatedArgs;
    const secretValue = generate ? generateSecretValue(generate) : value!;
    const options = note !== undefined ? [`--note=${note}`] : [];
    const response = await executeSmCommand('secret', 'create', options, [
      key,
      secretValue,
      projectId,
    ]);
    return toRedactedMcpFormat(response);
  },
);

export const handleEditSmSecret = withValidation(
  editSmSecretSchema,
  async (validatedArgs) => {
    const { secretId, key, value, generate, note, projectId } = validatedArgs;
    const options: string[] = [];
    if (key !== undefined) {
      options.push(`--key=${key}`);
    }
    if (generate) {
      options.push(`--value=${generateSecretValue(generate)}`);
    } else if (value !== undefined) {
      options.push(`--value=${value}`);
    }
    if (note !== undefined) {
      options.push(`--note=${note}`);
    }
    if (projectId !== undefined) {
      options.push(`--project-id=${projectId}`);
    }
    const response = await executeSmCommand('secret', 'edit', options, [
      secretId,
    ]);
    return toRedactedMcpFormat(response);
  },
);

export const handleDeleteSmSecret = withValidation(
  deleteSmSecretSchema,
  async (validatedArgs) => {
    const response = await executeSmCommand(
      'secret',
      'delete',
      [],
      [validatedArgs.secretId],
    );
    return toMcpFormat(response);
  },
);

export const handleImportSmSecrets = withValidation(
  importSmSecretsSchema,
  async (validatedArgs) => {
    const { filePath, projectId, overwrite } = validatedArgs;

    let content: string;
    try {
      content = await fs.promises.readFile(filePath, 'utf8');
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code ?? 'unknown error';
      return textResult(`Could not read the file (${code}).`, true);
    }

    const { entries, invalidLines } = parseEnvFile(content);
    if (invalidLines.length > 0) {
      return textResult(
        `The file has lines that are not KEY=VALUE assignments (lines ${invalidLines.join(', ')}). No secrets were changed.`,
        true,
      );
    }
    if (entries.length === 0) {
      return textResult('The file has no KEY=VALUE assignments.', true);
    }

    const listResponse = await executeSmCommand(
      'secret',
      'list',
      [],
      [projectId],
    );
    if (listResponse.errorOutput) {
      return toMcpFormat(listResponse);
    }
    const existing = parseSmSecretList(listResponse.output);
    if (!existing) {
      return textResult(
        'Could not read the secrets of the project. No secrets were changed.',
        true,
      );
    }

    const idsByKey = new Map<string, string[]>();
    for (const secret of existing) {
      idsByKey.set(secret.key, [
        ...(idsByKey.get(secret.key) ?? []),
        secret.id,
      ]);
    }

    const created: string[] = [];
    const updated: string[] = [];
    const skipped: { key: string; reason: string }[] = [];
    const failed: { key: string; error: string }[] = [];

    for (const { key, value } of entries) {
      const ids = idsByKey.get(key) ?? [];
      if (ids.length > 1) {
        skipped.push({
          key,
          reason: 'several secrets in the project use this key',
        });
        continue;
      }
      if (ids.length === 1 && !overwrite) {
        skipped.push({
          key,
          reason: 'already exists (pass overwrite: true to replace it)',
        });
        continue;
      }

      const response =
        ids.length === 1
          ? await executeSmCommand(
              'secret',
              'edit',
              [`--value=${value}`],
              [ids[0]!],
            )
          : await executeSmCommand(
              'secret',
              'create',
              [],
              [key, value, projectId],
            );
      if (response.errorOutput) {
        failed.push({ key, error: response.errorOutput });
      } else if (ids.length === 1) {
        updated.push(key);
      } else {
        created.push(key);
      }
    }

    return {
      isError: failed.length > 0,
      content: [
        {
          type: 'text',
          text: JSON.stringify({ created, updated, skipped, failed }, null, 2),
        },
      ],
    };
  },
);

export const handleExportSmSecrets = withValidation(
  exportSmSecretsSchema,
  async (validatedArgs) => {
    const { filePath, projectId, overwrite } = validatedArgs;

    const listResponse = await executeSmCommand(
      'secret',
      'list',
      [],
      [projectId],
    );
    if (listResponse.errorOutput) {
      return toMcpFormat(listResponse);
    }
    const secrets = parseSmSecretList(listResponse.output);
    if (!secrets) {
      return textResult('Could not read the secrets of the project.', true);
    }

    const keyCounts = new Map<string, number>();
    for (const secret of secrets) {
      keyCounts.set(secret.key, (keyCounts.get(secret.key) ?? 0) + 1);
    }

    const exportable: { key: string; value: string }[] = [];
    const skipped: { key: string; reason: string }[] = [];
    for (const [key, count] of keyCounts) {
      if (count > 1) {
        skipped.push({
          key,
          reason: 'several secrets in the project use this key',
        });
      } else if (!isEnvKey(key)) {
        skipped.push({
          key,
          reason: 'the key is not a valid dotenv variable name',
        });
      }
    }
    for (const { key, value } of secrets) {
      if (keyCounts.get(key) === 1 && isEnvKey(key)) {
        exportable.push({ key, value });
      }
    }

    try {
      // Owner-only permissions; 'wx' refuses to replace an existing file,
      // and chmod also restricts a replaced one.
      await fs.promises.writeFile(filePath, formatEnvFile(exportable), {
        encoding: 'utf8',
        mode: 0o600,
        flag: overwrite ? 'w' : 'wx',
      });
      await fs.promises.chmod(filePath, 0o600);
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      return textResult(
        code === 'EEXIST'
          ? 'The file already exists. Pass overwrite: true to replace it.'
          : `Could not write the file (${code ?? 'unknown error'}).`,
        true,
      );
    }

    return {
      isError: false,
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              filePath,
              exported: exportable.map((secret) => secret.key),
              skipped,
            },
            null,
            2,
          ),
        },
      ],
    };
  },
);
