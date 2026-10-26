import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

test("the web runtime resolves the compiled API and serves health and errors", () => {
  const result = spawnSync(
    process.execPath,
    [
      "--input-type=module",
      "--eval",
      `
        import assert from 'node:assert/strict';
        import app from '@traveler/api';
        assert.equal(new URL(import.meta.resolve('@traveler/api')).pathname.endsWith('/dist/app.js'), true);
        const health = await app.fetch(new Request('http://localhost/api/health'));
        assert.equal(health.status, 200);
        assert.deepEqual(await health.json(), { status: 'ok' });
        const missing = await app.fetch(new Request('http://localhost/api/missing'));
        assert.equal(missing.status, 404);
        assert.deepEqual(await missing.json(), { error: 'not_found' });
      `,
    ],
    {
      cwd: fileURLToPath(new URL("../../../apps/web/", import.meta.url)),
      encoding: "utf8",
    },
  );
  assert.equal(result.status, 0, result.stderr || String(result.error));
});
