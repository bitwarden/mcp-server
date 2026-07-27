import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import { defineConfig, globalIgnores } from 'eslint/config';

export default defineConfig([
  {
    files: ['**/*.ts'],
    plugins: { js },
    extends: ['js/recommended'],
  },
  {
    files: ['**/*.ts'],
    languageOptions: { globals: globals.browser },
  },
  // Nested git worktrees are separate checkouts with their own sources, build
  // output and coverage; linting them from the parent reports duplicate files.
  // Covers both common locations: .worktrees/ (git-worktree.nvim) and
  // .claude/worktrees/ (Claude Code).
  globalIgnores([
    '**/dist/',
    '**/coverage/',
    '.worktrees/',
    '.claude/worktrees/',
  ]),
  tseslint.configs.recommended,
]);
