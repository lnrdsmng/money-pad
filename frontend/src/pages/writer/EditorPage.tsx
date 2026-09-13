import { useEditor, EditorContent, useEditorState } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Highlight from '@tiptap/extension-highlight';
import ImageResize from 'tiptap-extension-resize-image';
import { Placeholder } from '@tiptap/extensions/placeholder';
import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Eye,
  BarChart2,
  Clock,
  Upload,
  Check,
  LoaderCircle,
  ArrowLeft,
  X,
  Bold,
  Italic,
  Image as LucideImage,
} from 'lucide-react';
import http from '../../api/http';
import { useFeedback } from '../../components/feedback/feedback';
import { getApiErrorMessage } from '../../utils/apiError';
import type { Chapter, ChapterSaveResponse } from '../../types/content';
import { createChapterAutosave, type SaveStatus } from '../../utils/chapterAutosave';
import { formatChapterHtml } from '../../utils/formatHtml';

export default function EditorPage() {
  const { partId } = useParams();
  return <ChapterEditor key={partId} />;
}

function ChapterEditor() {
  const { storyId, partId } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const feedback = useFeedback();

  const [title, setTitle] = useState('');
  const [headerImageUrl, setHeaderImageUrl] = useState('');
  const [pendingAction, setPendingAction] = useState<'draft' | 'publish' | null>(null);
  const [isUploadingInlineImage, setIsUploadingInlineImage] = useState(false);
  const inlineImageInputRef = useRef<HTMLInputElement>(null);
  const [showStatsModal, setShowStatsModal] = useState(false);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [isUploadingHeader, setIsUploadingHeader] = useState(false);
  const [autosaveStatus, setAutosaveStatus] = useState<SaveStatus>('saved');
  const loaded = useRef(false);
  const alive = useRef(true);
  const reportStatus = useCallback((value: SaveStatus) => { if (alive.current) setAutosaveStatus(value); }, []);
  const reportError = useCallback((error: unknown) => { if (alive.current) feedback.error(getApiErrorMessage(error, 'Changes could not be saved. Please retry.')); }, [feedback]);
  const saver = useMemo(() => createChapterAutosave(
    async data => (await http.put<ChapterSaveResponse>(`/parts/${partId}`, data)).data,
    reportStatus,
    reportError,
  ), [partId, reportStatus, reportError]);

  const { data: part, isLoading } = useQuery<Chapter>({
    queryKey: ['part', partId],
    queryFn: async () => {
      const res = await http.get<Chapter>(`/parts/${partId}`);
      return res.data;
    },
    enabled: !!partId,
  });

  const editor = useEditor({
    extensions: [
      StarterKit,
      Highlight,
      ImageResize.configure({
        inline: false,
      }),
      Placeholder.configure({
        placeholder: 'Start writing here...',
        emptyEditorClass: 'is-editor-empty',
      }),
    ],
    content: '',
    editorProps: {
      attributes: {
        class:
          'prose dark:prose-invert max-w-none focus:outline-none min-h-[500px] p-4 sm:p-6 border border-gray-200 dark:border-slate-700 rounded-b font-serif text-base sm:text-lg leading-relaxed sm:leading-loose',
      },
    },
    onUpdate: ({ editor: ed }) => {
      if (loaded.current) setAutosaveStatus('dirty');
      const text = ed.getText();
      const words = text.trim() ? text.trim().split(/\s+/).filter(Boolean).length : 0;
      const characters = text.length;
      const paragraphs = ed.getHTML().match(/<p>/g)?.length || 1;
      const readingTime = Math.max(1, Math.ceil(words / 200));
      setStats({ words, characters, paragraphs, readingTime });
    },
  });

  const editorState = useEditorState({
    editor,
    selector: (ctx) => ({
      isBold: ctx.editor?.isActive('bold') ?? false,
      isItalic: ctx.editor?.isActive('italic') ?? false,
    }),
  });
  const isBold = editorState?.isBold ?? false;
  const isItalic = editorState?.isItalic ?? false;

  const [stats, setStats] = useState({ words: 0, characters: 0, paragraphs: 0, readingTime: 1 });

  // Load content into editor once fetched
  useEffect(() => {
    if (part && editor && !editor.isDestroyed && !loaded.current) {
      setTitle(part.title);
      setHeaderImageUrl(part.headerImageUrl || '');
      saver.initialize(part.revision);
      loaded.current = true;
      const rawContent = part.content || '';
      const cleanContent =
        rawContent.trim() === '<p>Start writing here...</p>' ||
        rawContent.trim() === 'Start writing here...' ||
        rawContent.trim() === '<p></p>'
          ? ''
          : rawContent;
      editor.commands.setContent(formatChapterHtml(cleanContent), { emitUpdate: false });
      const text = editor.getText();
      const words = text.trim() ? text.trim().split(/\s+/).filter(Boolean).length : 0;
      const characters = text.length;
      const paragraphs = editor.getHTML().match(/<p>/g)?.length || 1;
      const readingTime = Math.max(1, Math.ceil(words / 200));
      setStats({ words, characters, paragraphs, readingTime });
    }
  }, [part, editor, saver]);

  const content = editor?.getHTML() ?? '';
  useEffect(() => {
    if (!loaded.current || autosaveStatus !== 'dirty' || !editor) return;
    saver.update({ title: title.trim() || 'Untitled Chapter', content: editor.getHTML(), headerImageUrl: headerImageUrl || null });
  }, [title, headerImageUrl, content, editor, saver, autosaveStatus]);

  useEffect(() => {
    alive.current = true;
    const warnUnsaved = (event: BeforeUnloadEvent) => {
      if (saver.isDirty()) { event.preventDefault(); event.returnValue = ''; }
    };
    window.addEventListener('beforeunload', warnUnsaved);
    return () => {
      alive.current = false;
      window.removeEventListener('beforeunload', warnUnsaved);
      saver.cancelTimer();
      if (saver.isDirty()) void saver.flush().catch(() => undefined);
    };
  }, [saver]);

  useEffect(() => { editor?.setEditable(pendingAction === null); }, [editor, pendingAction]);

  const handleUploadHeader = async (file: File) => {
    const formData = new FormData();
    formData.append('image', file);
    setIsUploadingHeader(true);
    try {
      const res = await http.post('/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setHeaderImageUrl(res.data.url);
      setAutosaveStatus('dirty');
      feedback.success('Chapter banner uploaded.');
    } catch (error) {
      feedback.error(getApiErrorMessage(error, 'Header image upload failed.'));
    } finally {
      setIsUploadingHeader(false);
    }
  };

  const handleUploadInlineImage = async (file: File) => {
    const formData = new FormData();
    formData.append('image', file);
    setIsUploadingInlineImage(true);
    try {
      const res = await http.post('/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      const url = res.data.url;
      if (url && editor) {
        editor.chain().focus().setImage({ src: url }).run();
        setAutosaveStatus('dirty');
        feedback.success('Image inserted into chapter.');
      }
    } catch (error) {
      feedback.error(getApiErrorMessage(error, 'Image upload failed.'));
    } finally {
      setIsUploadingInlineImage(false);
      if (inlineImageInputRef.current) {
        inlineImageInputRef.current.value = '';
      }
    }
  };

  const handleSave = async (publish: boolean = false) => {
    if (!editor) return;
    if (pendingAction) return;
    setPendingAction(publish ? 'publish' : 'draft');
    try {
      saver.update({ title: title.trim() || 'Untitled Chapter', content: editor.getHTML(), headerImageUrl: headerImageUrl.trim() || null });
      await saver.flush(publish);
      await queryClient.invalidateQueries({ queryKey: ['parts', storyId] });
      if (publish) {
        await queryClient.invalidateQueries({ queryKey: ['story', storyId] });
        await queryClient.invalidateQueries({ queryKey: ['stories'] });
      }
      if (publish) {
        feedback.success('Chapter published successfully!');
        navigate(`/writer/story/${storyId}/parts`);
      } else {
        feedback.success('Draft saved.');
      }
    } catch (error) {
      feedback.error(
        getApiErrorMessage(error, publish ? 'Could not publish chapter.' : 'Could not save draft.')
      );
    } finally {
      setPendingAction(null);
    }
  };

  if (isLoading) return <div className="p-8 text-center text-sm text-gray-500">Loading editor...</div>;

  return (
    <div className="max-w-4xl mx-auto pb-16 space-y-4">
      {/* Top Header & Actions Bar */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div className="flex items-center gap-3">
          <Link
            to={`/writer/story/${storyId}/parts`}
            className="p-1.5 rounded-lg border border-gray-200 dark:border-slate-700 text-gray-500 hover:text-gray-800 dark:hover:text-gray-200 hover:bg-gray-50 transition"
            title="Back to Chapters"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">Chapter Editor</h1>
            <div className="flex items-center gap-2 text-[11px] text-gray-400">
              {autosaveStatus === 'error' ? <span role="alert" className="text-red-600">Save failed ? use Save Draft to retry</span> : autosaveStatus === 'saving' ? (
                <span className="flex items-center gap-1 text-amber-500">
                  <LoaderCircle className="w-3 h-3 animate-spin" /> Autosaving...
                </span>
              ) : autosaveStatus === 'saved' ? (
                <span className="flex items-center gap-1 text-emerald-500">
                  <Check className="w-3 h-3" /> All changes saved
                </span>
              ) : (
                <span>Unsaved changes</span>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          {/* Stats Button */}
          <button
            type="button"
            onClick={() => setShowStatsModal(true)}
            className="p-2 border border-gray-200 dark:border-slate-700 rounded-lg text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-700 transition flex items-center gap-1.5 text-xs font-medium cursor-pointer"
            title="Word Count & Statistics"
          >
            <BarChart2 className="w-4 h-4 text-primary" />
            <span className="hidden xs:inline">{stats.words} words</span>
          </button>

          {/* Reader POV Preview Button */}
          <button
            type="button"
            onClick={() => setShowPreviewModal(true)}
            className="p-2 border border-gray-200 dark:border-slate-700 rounded-lg text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-700 transition flex items-center gap-1.5 text-xs font-medium cursor-pointer"
            title="Reader POV Preview"
          >
            <Eye className="w-4 h-4 text-blue-500" />
            <span className="hidden xs:inline">Reader POV</span>
          </button>

          <button
            onClick={() => handleSave(false)}
            disabled={pendingAction !== null}
            className="px-3 py-2 text-xs font-medium border border-gray-300 dark:border-slate-600 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-700 transition cursor-pointer"
          >
            {pendingAction === 'draft' ? 'Saving...' : 'Save Draft'}
          </button>

          <button
            onClick={() => handleSave(true)}
            disabled={pendingAction !== null}
            className="px-4 py-2 text-xs font-bold bg-primary text-white rounded-lg hover:bg-green-600 transition cursor-pointer shadow-xs"
          >
            {pendingAction === 'publish' ? 'Publishing...' : 'Publish'}
          </button>
        </div>
      </div>

      {/* Chapter Title Input */}
      <input
        type="text"
        value={title}
        onChange={(e) => {
          setTitle(e.target.value);
          setAutosaveStatus('dirty');
        }}
        placeholder="Chapter Title"
        className="w-full p-3 sm:p-4 text-lg sm:text-2xl font-bold border border-gray-200 dark:border-slate-700 rounded-xl dark:bg-slate-900 text-gray-900 dark:text-gray-100 focus:outline-none focus:border-primary shadow-xs"
      />

      {/* Chapter Header Banner Section */}
      <div className="bg-white dark:bg-slate-800 p-3.5 rounded-xl border border-gray-200 dark:border-slate-700 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          {headerImageUrl ? (
            <div className="w-20 h-12 rounded-lg overflow-hidden border border-gray-200 dark:border-slate-700 shrink-0">
              <img src={headerImageUrl} alt="Header Preview" className="w-full h-full object-cover" />
            </div>
          ) : (
            <div className="w-20 h-12 rounded-lg border border-dashed border-gray-300 dark:border-slate-700 bg-gray-50 dark:bg-slate-900/50 flex items-center justify-center text-[10px] text-gray-400 shrink-0">
              No Banner
            </div>
          )}
          <div>
            <span className="block text-xs font-semibold text-gray-700 dark:text-gray-300">
              Chapter Header Banner (Optional)
            </span>
            <span className="block text-[11px] text-gray-400">
              Displayed at the top of your chapter
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <label className="px-3 py-1.5 bg-gray-100 dark:bg-slate-700 hover:bg-gray-200 dark:hover:bg-slate-600 text-xs font-medium text-gray-700 dark:text-gray-200 rounded-lg cursor-pointer transition flex items-center gap-1.5">
            {isUploadingHeader ? <LoaderCircle className="w-3.5 h-3.5 animate-spin text-primary" /> : <Upload className="w-3.5 h-3.5 text-primary" />}
            <span>{isUploadingHeader ? 'Uploading...' : headerImageUrl ? 'Change Banner' : 'Upload Banner'}</span>
            <input
              type="file"
              accept="image/*"
              className="hidden"
              disabled={isUploadingHeader}
              onChange={(e) => {
                if (e.target.files?.[0]) handleUploadHeader(e.target.files[0]);
              }}
            />
          </label>
          {headerImageUrl && (
            <button
              type="button"
              onClick={() => {
                setHeaderImageUrl('');
                setAutosaveStatus('dirty');
              }}
              className="text-xs text-red-500 hover:underline cursor-pointer px-2 py-1.5"
            >
              Remove
            </button>
          )}
        </div>
      </div>

      {/* Editor Toolbar & Content */}
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-xs overflow-hidden border border-gray-200 dark:border-slate-700">
        <div className="border-b border-gray-200 dark:border-slate-700 p-2 flex gap-1.5 bg-gray-50 dark:bg-slate-900 flex-wrap items-center text-xs">
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => editor?.chain().focus().toggleBold().run()}
            title="Bold"
            aria-label="Bold"
            aria-pressed={isBold}
            className={`p-2 rounded-lg transition cursor-pointer ${
              isBold ? 'bg-primary text-white' : 'hover:bg-gray-200 dark:hover:bg-slate-700 text-gray-700 dark:text-gray-300'
            }`}
          >
            <Bold className="w-4 h-4" />
          </button>
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => editor?.chain().focus().toggleItalic().run()}
            title="Italic"
            aria-label="Italic"
            aria-pressed={isItalic}
            className={`p-2 rounded-lg transition cursor-pointer ${
              isItalic ? 'bg-primary text-white' : 'hover:bg-gray-200 dark:hover:bg-slate-700 text-gray-700 dark:text-gray-300'
            }`}
          >
            <Italic className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => inlineImageInputRef.current?.click()}
            disabled={isUploadingInlineImage}
            title="Insert Image from Gallery / Device"
            aria-label="Insert Image from Gallery / Device"
            className="p-2 rounded-lg hover:bg-gray-200 dark:hover:bg-slate-700 text-gray-700 dark:text-gray-300 transition cursor-pointer disabled:opacity-50"
          >
            {isUploadingInlineImage ? (
              <LoaderCircle className="w-4 h-4 animate-spin text-primary" />
            ) : (
              <LucideImage className="w-4 h-4" />
            )}
          </button>
          <input
            type="file"
            ref={inlineImageInputRef}
            accept="image/*"
            className="hidden"
            disabled={isUploadingInlineImage}
            onChange={(e) => {
              if (e.target.files?.[0]) handleUploadInlineImage(e.target.files[0]);
            }}
          />

          <div className="ml-auto text-[11px] text-gray-400 flex items-center gap-3 pr-2">
            <span>{stats.words} words</span>
            <span>~{stats.readingTime} min read</span>
          </div>
        </div>

        <EditorContent editor={editor} />
      </div>

      {/* WRITING STATS MODAL */}
      {showStatsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl max-w-sm w-full p-6 relative">
            <button
              onClick={() => setShowStatsModal(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 p-1 rounded-full"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="font-bold text-lg text-gray-900 dark:text-gray-100 flex items-center gap-2 mb-4">
              <BarChart2 className="w-5 h-5 text-primary" />
              Chapter Statistics
            </h3>

            <div className="space-y-3 text-sm">
              <div className="flex justify-between p-3 rounded-xl bg-gray-50 dark:bg-slate-900 border border-gray-100 dark:border-slate-800">
                <span className="text-gray-600 dark:text-gray-400">Total Words</span>
                <strong className="text-gray-900 dark:text-gray-100">{stats.words}</strong>
              </div>
              <div className="flex justify-between p-3 rounded-xl bg-gray-50 dark:bg-slate-900 border border-gray-100 dark:border-slate-800">
                <span className="text-gray-600 dark:text-gray-400">Characters</span>
                <strong className="text-gray-900 dark:text-gray-100">{stats.characters}</strong>
              </div>
              <div className="flex justify-between p-3 rounded-xl bg-gray-50 dark:bg-slate-900 border border-gray-100 dark:border-slate-800">
                <span className="text-gray-600 dark:text-gray-400">Paragraphs</span>
                <strong className="text-gray-900 dark:text-gray-100">{stats.paragraphs}</strong>
              </div>
              <div className="flex justify-between p-3 rounded-xl bg-gray-50 dark:bg-slate-900 border border-gray-100 dark:border-slate-800">
                <span className="text-gray-600 dark:text-gray-400 flex items-center gap-1.5">
                  <Clock className="w-4 h-4 text-primary" /> Est. Reading Time
                </span>
                <strong className="text-primary">{stats.readingTime} min</strong>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* READER POV PREVIEW MODAL */}
      {showPreviewModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4">
          <div className="bg-[#FAF9F6] text-gray-900 rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] flex flex-col relative overflow-hidden">
            <div className="p-4 border-b border-gray-200 bg-white flex justify-between items-center shrink-0">
              <div className="flex items-center gap-2">
                <Eye className="w-5 h-5 text-primary" />
                <h3 className="font-bold text-sm sm:text-base">Reader POV Preview</h3>
              </div>
              <button
                onClick={() => setShowPreviewModal(false)}
                className="p-1 rounded-full text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 sm:p-10 font-serif">
              {headerImageUrl && (
                <div className="w-full h-44 rounded-xl overflow-hidden mb-6 shadow-xs">
                  <img src={headerImageUrl} alt={title} className="w-full h-full object-cover" />
                </div>
              )}
              <h1 className="text-2xl sm:text-3xl font-bold text-center mb-8">
                {title || 'Untitled Chapter'}
              </h1>
              <div
                className="prose prose-base sm:prose-lg max-w-none prose-p:leading-relaxed sm:prose-p:leading-loose"
                dangerouslySetInnerHTML={{ __html: formatChapterHtml(editor?.getHTML() || '') }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
