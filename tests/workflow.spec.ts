import { describe, it, expect } from '@jest/globals';
import fs from 'fs';
import path from 'path';

const root = path.resolve(__dirname, '..');
const workflow = fs.readFileSync(
  path.join(root, '.github/workflows/build.yml'),
  'utf8',
);
const readme = fs.readFileSync(path.join(root, 'README.md'), 'utf8');

/** Splits the `jobs:` section into job blocks keyed by job id (2-space keys). */
function parseJobs(text: string): Record<string, string> {
  const lines = text.split('\n');
  const start = lines.findIndex((l) => l === 'jobs:');
  const jobs: Record<string, string> = {};
  let current: string | null = null;
  for (const line of lines.slice(start + 1)) {
    const m = /^ {2}([A-Za-z0-9_-]+):\s*$/.exec(line);
    if (m) {
      current = m[1] as string;
      jobs[current] = '';
    } else if (current !== null) {
      jobs[current] += line + '\n';
    }
  }
  return jobs;
}

const jobs = parseJobs(workflow);
const steps = (block: string): string[] =>
  block
    .split(/^ {6}- name:/m)
    .slice(1)
    .map((s) => s);
const isPublisher = (block: string): boolean => /packages:\s*write/.test(block);

describe('build.yml job split (VULN-1365)', () => {
  const publishers = Object.entries(jobs).filter(([, b]) => isPublisher(b));
  const nonPublishers = Object.entries(jobs).filter(([, b]) => !isPublisher(b));

  it('has exactly one job holding packages: write and at least one other job', () => {
    expect(publishers).toHaveLength(1);
    expect(nonPublishers.length).toBeGreaterThanOrEqual(1);
  });

  it('has no workflow-level packages: write', () => {
    const header = workflow.slice(0, workflow.indexOf('\njobs:'));
    expect(header).not.toMatch(/packages:\s*write/);
  });

  describe('criterion 1: PR/dispatch job', () => {
    it.each(nonPublishers)(
      '%s has no ghcr login, push or signing, and keeps id-token: write for Aikido only',
      (_name, block) => {
        expect(block).not.toMatch(/docker\/login-action/);
        expect(block).not.toMatch(/ghcr\.io/);
        expect(block).not.toMatch(/cosign/);
        expect(block).not.toMatch(/push:\s*true/);
        expect(block).toMatch(/id-token:\s*write/);
        expect(block).toMatch(/setup-aikido-endpoint-protection/);
        expect(block).toMatch(/push:\s*false/);
      },
    );

    it('does not gate the build job to main (it runs on PRs and dispatch)', () => {
      const block = nonPublishers[0]![1];
      expect(block).not.toMatch(/^\s{4}if:/m);
    });
  });

  describe('criterion 2: publishing job', () => {
    const pub = publishers[0]![1];

    it('runs only for push on refs/heads/main', () => {
      expect(pub).toMatch(
        /^ {4}if:.*github\.event_name == 'push'.*github\.ref == 'refs\/heads\/main'/m,
      );
    });

    it('is bound to a GitHub environment', () => {
      expect(pub).toMatch(/^ {4}environment:\s*\S+/m);
    });

    it('logs in to ghcr, pushes, and signs', () => {
      expect(pub).toMatch(/docker\/login-action/);
      expect(pub).toMatch(/push:\s*true/);
      expect(pub).toMatch(/cosign sign/);
    });

    it('is the only job that signs or pushes', () => {
      for (const [, block] of nonPublishers) {
        expect(block).not.toMatch(/cosign sign/);
        expect(block).not.toMatch(/push:\s*true/);
      }
    });
  });

  describe('criterion 3: publishing job runs no host npm build', () => {
    const pub = publishers[0]![1];

    it('has no npm ci, npm install or npm run build step', () => {
      expect(pub).not.toMatch(/npm\s+(ci|install|i|run\s+build)\b/);
    });

    it('builds the image with docker/build-push-action from the Dockerfile', () => {
      const buildStep = steps(pub).find((s) =>
        /docker\/build-push-action/.test(s),
      );
      expect(buildStep).toBeDefined();
      expect(buildStep).toMatch(/file:\s*Dockerfile/);
    });
  });

  describe('criterion 4: README cosign verify docs', () => {
    it('documents the identity pinned to the publishing workflow on main', () => {
      expect(readme).toMatch(
        /--certificate-identity\s+https:\/\/github\.com\/bitwarden\/mcp-server\/\.github\/workflows\/build\.yml@refs\/heads\/main/,
      );
    });

    it('documents the issuer', () => {
      expect(readme).toMatch(
        /--certificate-oidc-issuer\s+https:\/\/token\.actions\.githubusercontent\.com/,
      );
    });
  });

  describe('criterion 5: downstream contract', () => {
    it('keeps the mcp-server-<version> artifact upload', () => {
      expect(workflow).toMatch(/actions\/upload-artifact/);
      expect(workflow).toMatch(
        /name:\s*mcp-server-\$\{\{\s*steps\.retrieve-package-version\.outputs\.package_version\s*\}\}/,
      );
    });

    it('keeps the :dev and :dev-<short sha> tags pushed from the main-only job', () => {
      const pub = publishers[0]![1];
      expect(pub).toMatch(/\$\{_IMAGE_NAME\}:dev,/);
      expect(pub).toMatch(/\$\{_IMAGE_NAME\}:dev-\$\{SHORT_SHA\}/);
    });

    it('keeps the ghcr.io/bitwarden/mcp-server image name', () => {
      expect(workflow).toMatch(
        /_IMAGE_NAME:\s*ghcr\.io\/bitwarden\/mcp-server/,
      );
    });
  });
});
