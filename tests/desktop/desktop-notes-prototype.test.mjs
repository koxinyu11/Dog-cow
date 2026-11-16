import test from 'node:test';
import assert from 'node:assert/strict';
import { clampNote, containsPoint, hangingNoteBounds, isSampleDrag, ropePoint, sampleNotes, samplePaperBounds, sampleSize, toggleSamplePreview } from '../../dist-electron/src/shared/desktop-notes-prototype.js';

test('offscreen note is recoverable on a display with negative coordinates', () => {
  const workArea = { x: -1440, y: 32, width: 1440, height: 868 };
  const result = clampNote({ x: 2000, y: -800, width: 324, height: 354 }, workArea);
  assert.deepEqual(result, { x: -324, y: 32, width: 324, height: 354 });
  assert.equal(containsPoint(workArea, { x: result.x, y: result.y }), true);
  assert.equal(containsPoint(workArea, { x: result.x + result.width - 1, y: result.y + result.height - 1 }), true);
});

test('hanging uses the released horizontal location for either type; only rope endpoints clamp it', () => {
  const line = { x: -900, y: 70, width: 650, height: 96 };
  for (const id of ['single', 'list']) {
    for (const center of [-820, -600, -340]) {
      const result = hangingNoteBounds(id, line, center);
      assert.equal(result.x + result.width / 2, center);
      assert.ok(Math.abs(result.y + 17 - ropePoint(line, center).y) < .51);
      assert.deepEqual({ width: result.width, height: result.height }, sampleSize(id, true));
    }
    const clipped = hangingNoteBounds(id, line, 800);
    assert.equal(clipped.x + clipped.width / 2, line.x + line.width - 50);
  }
});

test('folded paper hit region excludes the transparent area inside a full-sized native window', () => {
  for (const id of ['single', 'list']) {
    const folded = samplePaperBounds(id, false);
    const expanded = samplePaperBounds(id, true);
    const native = sampleSize(id, true);
    assert.equal(folded.x + folded.width / 2, native.width / 2);
    assert.equal(containsPoint(folded, { x: 20, y: 35 }), false);
    assert.equal(containsPoint(expanded, { x: 20, y: 35 }), true);
    assert.equal(containsPoint(folded, { x: native.width / 2, y: folded.y + folded.height - 1 }), true);
    assert.equal(containsPoint(folded, { x: native.width / 2, y: native.height - 30 }), false);
  }
});

test('click toggles exactly one hanging preview without changing task completion or desktop notes', () => {
  const notes = sampleNotes();
  const originalTasks = structuredClone(notes.map(note => note.tasks));
  toggleSamplePreview(notes, 'single');
  assert.equal(notes[0].expanded, true);
  for (const note of notes) { note.hanging = true; note.expanded = false; }
  toggleSamplePreview(notes, 'single');
  assert.deepEqual(notes.map(note => note.expanded), [true, false]);
  toggleSamplePreview(notes, 'list');
  assert.deepEqual(notes.map(note => note.expanded), [false, true]);
  toggleSamplePreview(notes, 'list');
  assert.deepEqual(notes.map(note => note.expanded), [false, false]);
  assert.deepEqual(notes.map(note => note.tasks), originalTasks);
});

test('small press jitter is a click, while a quick release beyond the threshold is a drag', () => {
  const origin = { x: 400, y: 150 };
  assert.equal(isSampleDrag(origin, { x: 403, y: 154 }), false);
  assert.equal(isSampleDrag(origin, { x: 404, y: 154 }), true);
  assert.equal(isSampleDrag(origin, { x: 400, y: 156 }), true);
});

test('hit regions exclude their right and bottom edges and accept negative display coordinates', () => {
  const area = { x: -300, y: 50, width: 200, height: 80 };
  assert.equal(containsPoint(area, { x: -300, y: 50 }), true);
  assert.equal(containsPoint(area, { x: -100, y: 70 }), false);
  assert.equal(containsPoint(area, { x: -200, y: 130 }), false);
  assert.equal(containsPoint(area, { x: -200, y: 129 }), true);
});

test('reset produces independent sample tasks; folding preserves note identity and data', () => {
  const first = sampleNotes();
  first[1].tasks[0].done = false;
  assert.equal(sampleNotes()[1].tasks[0].done, true);
  assert.equal(first[0].tasks.length, 1);
  assert.ok(first[1].tasks.length > 1);
  for (const note of first) {
    const expanded = sampleSize(note.id, true);
    const folded = sampleSize(note.id, false);
    assert.ok(folded.height < expanded.height);
    assert.ok(folded.width < expanded.width);
  }
});

test('line height clamps to display work area with space for expanded sheets; endpoints have explicit hit regions',async()=>{
 const {fitLine,lineEndpoints}=await import('../../dist-electron/src/shared/desktop-note-window.js');
 const area={x:-1280,y:24,width:1280,height:900};
 assert.deepEqual(fitLine(area,-100,354),{x:-1280,y:24,width:1280,height:96});
 assert.equal(fitLine(area,10000,354).y,24+900-408);
 const line=fitLine(area,150,354);const endpoints=lineEndpoints(line);
 assert.equal(endpoints.length,2);for(const endpoint of endpoints){assert.equal(endpoint.width,28);assert.equal(endpoint.height,28)}
 assert.equal(containsPoint(endpoints[0],{x:line.x+22,y:line.y+33}),true);
 assert.equal(containsPoint(endpoints[1],{x:line.x+line.width-22,y:line.y+33}),true);
});
