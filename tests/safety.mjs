// Output safety helpers from the security audit. No browser or network.
import assert from 'assert/strict';
globalThis.document ??= {}; globalThis.window ??= globalThis; globalThis.addEventListener ??= () => {};
const { safeImg, csvCell } = await import('../app/js/ui.js');
let passed = 0, failed = 0;
const test = (name, fn) => { try { fn(); passed++; console.log('  ✓ ' + name); } catch (e) { failed++; console.log('  ✗ ' + name + '\n    ' + e.message); } };
console.log('Output safety');
test('real image data passes', () => assert.equal(safeImg('data:image/jpeg;base64,AA=='), 'data:image/jpeg;base64,AA=='));
for (const bad of ['x" onerror="alert(1)', 'javascript:alert(1)', 'https://evil.example/x.png', 'data:image/svg+xml;base64,AA==', 'data:text/html;base64,AA==', 'data:image/png;base64,AA=="><script>', '', null, 5, {}]) {
  test('blocks image value ' + JSON.stringify(bad), () => assert.equal(safeImg(bad), ''));
}
test('formula cells become text', () => { for (const s of ['=1+1', '+1', '-1', '@x', '\tx', '\rx']) assert.equal(csvCell(s).slice(0, 2), '"\''); });
test('normal cells are unchanged', () => assert.equal(csvCell('Kopi Kolej'), '"Kopi Kolej"'));
test('numbers and empty cells work', () => { assert.equal(csvCell(12), '"12"'); assert.equal(csvCell(null), '""'); });
test('quotes are escaped', () => assert.equal(csvCell('a"b'), '"a""b"'));
console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
