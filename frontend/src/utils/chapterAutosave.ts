import type { ChapterSave, ChapterSaveResponse } from '../types/content';

export type SaveStatus = 'saved' | 'saving' | 'dirty' | 'error';

export function createChapterAutosave(
  save: (data: Partial<ChapterSave> & { revision: number }) => Promise<ChapterSaveResponse>,
  status: (value: SaveStatus) => void,
  onError: (error: unknown) => void,
) {
  let revision = 0;
  let version = 0;
  let savedVersion = 0;
  let latest: ChapterSave | null = null;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let queue: Promise<void> = Promise.resolve();
  let active = 0;

  function enqueue(action: () => Promise<void>) {
    const operation = queue.then(action);
    queue = operation.catch(() => undefined);
    return operation;
  }

  async function saveContent() {
    while (latest && savedVersion < version) {
      const snapshot = { ...latest };
      const savingVersion = version;
      status('saving');
      const response = await save({ ...snapshot, revision });
      revision = response.revision;
      savedVersion = savingVersion;
    }
  }

  function flush(publication?: boolean) {
    clearTimeout(timer);
    active++;
    return enqueue(async () => {
      try {
        await saveContent();
        if (publication !== undefined) {
          status('saving');
          revision = (await save({ isPublished: publication, revision })).revision;
        }
        status(savedVersion === version ? 'saved' : 'dirty');
      } catch (error) {
        status('error');
        onError(error);
        throw error;
      } finally { active--; }
    });
  }

  return {
    initialize(value: number) { revision = value; },
    update(value: ChapterSave) {
      // Publication state is changed only by an explicit publish/save-draft action.
      latest = { title: value.title, content: value.content, headerImageUrl: value.headerImageUrl };
      version++;
      status('dirty');
      clearTimeout(timer);
      timer = setTimeout(() => { void flush().catch(() => undefined); }, 2000);
    },
    flush,
    isDirty() { return version > savedVersion || active > 0; },
    cancelTimer() { clearTimeout(timer); },
  };
}
