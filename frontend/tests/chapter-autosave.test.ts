import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createChapterAutosave } from '../src/utils/chapterAutosave.ts';

const document = (content: string) => ({ title: 'Chapter', content, headerImageUrl: null });

test('edits during an in-flight save are serialized before publication', async () => {
  const calls: any[] = [];
  let release!: () => void;
  const blocked = new Promise<void>(resolve => { release = resolve; });
  const saver = createChapterAutosave(async data => {
    calls.push(data);
    if (calls.length === 1) await blocked;
    return { success: true, revision: data.revision + 1 };
  }, () => {}, () => {});
  saver.initialize(4);
  saver.update(document('old'));
  const first = saver.flush();
  await Promise.resolve();
  saver.update(document('new'));
  const publish = saver.flush(true);
  release();
  await Promise.all([first, publish]);
  assert.deepEqual(calls.map(call => [call.content, call.revision, call.isPublished]), [
    ['old', 4, undefined], ['new', 5, undefined], [undefined, 6, true],
  ]);
  assert.equal(saver.isDirty(), false);
  saver.cancelTimer();
});

test('failed saves retain pending edits and retry the same revision', async () => {
  let fail = true;
  const revisions: number[] = [];
  const saver = createChapterAutosave(async data => {
    revisions.push(data.revision);
    if (fail) throw new Error('Conflict');
    return { success: true, revision: data.revision + 1 };
  }, () => {}, () => {});
  saver.initialize(7);
  saver.update(document('unsaved'));
  await assert.rejects(saver.flush(), /Conflict/);
  assert.equal(saver.isDirty(), true);
  fail = false;
  await saver.flush();
  assert.deepEqual(revisions, [7, 7]);
  assert.equal(saver.isDirty(), false);
  saver.cancelTimer();
});
