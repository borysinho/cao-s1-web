import test from 'node:test';
import assert from 'node:assert/strict';
import { editorialEvents } from '../src/editorial-events.ts';
test('las nueve portadas de demostración existen y los ids no se repiten', async () => {
  const { access } = await import('node:fs/promises');
  assert.equal(editorialEvents.length, 9);
  assert.equal(new Set(editorialEvents.map(event => event.id)).size, 9);
  for (const event of editorialEvents) await access(new URL('../public/eventos-demo/' + event.image, import.meta.url));
});
