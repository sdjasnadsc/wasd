import assert from 'node:assert/strict';
import type { IncomingMessage } from 'node:http';
import { test } from 'node:test';
import { requestOriginAllowed } from '../apps/server/src/http.ts';

test('only the exact forwarded Codespaces origin is trusted for the app port', t => {
  const originalEnv = process.env;
  process.env = {
    ...originalEnv,
    CODESPACES: 'true',
    CODESPACE_NAME: 'abyssal-test',
    GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN: 'app.github.dev',
    TRUST_PROXY: '0',
  };
  t.after(() => { process.env = originalEnv; });
  const allows = (origin?: string) => requestOriginAllowed({
    headers: { origin, host: 'localhost:5173', 'x-forwarded-host': 'unrelated.example' },
    socket: { localPort: 5173 },
  } as IncomingMessage);
  assert.equal(allows('https://abyssal-test-5173.app.github.dev'), true);
  assert.equal(allows('https://abyssal-test-5174.app.github.dev'), false);
  assert.equal(allows('https://another-test-5173.app.github.dev'), false);
  assert.equal(allows('http://abyssal-test-5173.app.github.dev'), false);
  assert.equal(allows('https://unrelated.example'), false);
  assert.equal(allows('http://localhost:5173'), true);
  assert.equal(allows(), true);
});
