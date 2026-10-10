import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const [mode, css, icons, workflow, policy] = await Promise.all([
  'src/components/StudyMode.jsx','src/studyTools.css','src/components/StudyUiIcons.jsx',
  '.github/workflows/android-apk.yml','.motorlab/STUDYBOOK_STANDARD_APK_METHOD.txt',
].map(path => readFile(path,'utf8')));
assert.ok(mode.includes('sb-lab06-compact-header'), 'minimal header');
assert.ok(mode.includes('StudyBackIcon'), 'back control');
assert.ok(mode.includes('onClick={closeReader}'), 'functional back');
assert.ok(mode.includes('StudySoundIcon'), 'unified audio');
assert.ok(!mode.includes('🔊'), 'no device-dependent audio emoji');
assert.ok(mode.includes('sb-lab06-chapter-full-title'), 'full chapter title');
assert.ok(mode.includes('CAPITOLO <b>{chapterIndex + 1} / {chapterCount}</b>'), 'chapter counter');
assert.ok(mode.includes('changeChapter(chapterIndex - 1)') && mode.includes('changeChapter(chapterIndex + 1)'), 'chapter arrows');
assert.ok(mode.includes('changeChapter(Number(event.target.value))'), 'native chapter dropdown');
assert.ok(!mode.includes('sb-lab05-chapter-title'), 'no duplicated second title');
assert.ok(mode.includes("setStudyScope('chapter')"), 'chapter navigation scoping');
assert.ok(mode.includes('listenToCurrentContent'), 'audio button connected');
assert.ok(mode.includes('Torna alla pagina del libro'), 'back accessible');
assert.ok(css.includes('.sb-lab06-chapter-full-title') && css.includes('white-space: normal'), 'long chapter title wraps');
assert.ok(icons.includes('<svg') && icons.includes('stroke="currentColor"'), 'native-independent icons');
assert.ok(workflow.includes('lab/studybook-core-android-01-update-06'), 'LAB06 workflow');
assert.ok(policy.includes('STABLE_APP_ID=it.studybook.ai.lab') && policy.includes('CERT_POLICY='), 'standard APK saved');
console.log('LAB06 UI and Android workflow static regression gates: PASS');
