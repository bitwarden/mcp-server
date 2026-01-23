export default {
  preset: 'ts-jest/presets/default-esm',
  testEnvironment: 'node',
  extensionsToTreatAsEsm: ['.ts'],
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
  testMatch: ['**/tests/**/*.spec.ts'],
  setupFiles: ['./.jest/setEnvVars.js'],
  reporters: ['default', 'jest-junit'],
  collectCoverage: true,
  collectCoverageFrom: ['src/**/*.ts'],
  coverageReporters: ['html', 'lcov'],
  coverageDirectory: 'coverage',
};
