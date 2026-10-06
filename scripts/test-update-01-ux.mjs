import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const screens = await readFile('src/components/AppScreens.jsx', 'utf8');
const app = await readFile('src/AppV15.jsx', 'utf8');
const css = await readFile('src/appShellV16.css', 'utf8');

assert.ok(screens.includes('window.setTimeout(() =>'));
assert.ok(screens.includes('520'));
assert.ok(screens.includes('sb-book-delete'));
assert.ok(screens.includes('Eliminare definitivamente?'));
assert.ok(screens.includes('Sì, elimina'));
assert.ok(app.includes('function goBack()'));
assert.ok(app.includes('sb-back-button'));
assert.ok(app.includes('screenHistoryRef.current.pop()'));
assert.ok(app.includes('onDeleteBook={removeLibraryItem}'));
assert.ok(app.includes('.epub,.txt,.html,.htm,.rtf,.odt,.md,.markdown'));
assert.ok(css.includes('.sb-confirm-overlay'));
assert.ok(css.includes('.sb-back-button'));

console.log(JSON.stringify({
  ok: true,
  longPressDelete: true,
  deleteConfirmation: true,
  backNavigation: true,
  extendedImport: true,
}, null, 2));
