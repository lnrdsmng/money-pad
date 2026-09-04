import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Highlight from '@tiptap/extension-highlight';
import Image from '@tiptap/extension-image';
import { useState, useEffect, useRef } from 'react';
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
  Heading2,
  List,
  Image as LucideImage,
} from 'lucide-react';
import http from '../../api/http';
import { ActionDialog } from '../../components/feedback/ActionDialog';
import { useFeedback } from '../../components/feedback/feedback';
import { getApiErrorMessage } from '../../utils/apiError';

export default function EditorPage() {
  const { storyId, partId } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const feedback = useFeedback();

  const [title, setTitle] = useState('');
  const [headerImageUrl, setHeaderImageUrl] = useState('');
  const [pendingAction, setPendingAction] = useState<'draft' | 'publish' | null>(null);
  const [showImageDialog, setShowImageDialog] = useState(false);
  const [imageUrl, setImageUrl] = useState('');
  const [showStatsModal, setShowStatsModal] = useState(false);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [isUploadingHeader, setIsUploadingHeader] = useState(false);
  const [autosaveStatus, setAutosaveStatus] = useState<'saved' | 'saving' | 'dirty'>('saved');
  const autosaveTimerRef = useRef<any>(null);

  const { data: part, isLoading } = useQuery({
    queryKey: ['part', partId],
    queryFn: async () => {
      const res = await http.get(`/parts/${partId}`);
      setTitle(res.data.title || '');
      setHeaderImageUrl(res.data.headerImageUrl || '');
      return res.data;
    },
    enabled: !!partId,
  });

  const editor = useEditor({
    extensions: [StarterKit, Highlight, Image],
    content: '',
    editorProps: {
      attributes: {
        class:
          'prose dark:prose-invert max-w-none focus:outline-none min-h-[500px] p-4 sm:p-6 border border-gray-200 dark:border-slate-700 rounded-b font-serif text-base sm:text-lg leading-relaxed sm:leading-loose',
      },
    },
    onUpdate: ({ editor: ed }) => {
      setAutosaveStatus('dirty');
      const text = ed.getText();
      const words = text.trim() ? text.trim().split(/\s+/).filter(Boolean).length : 0;
      const characters = text.length;
      const paragraphs = ed.getHTML().match(/<p>/g)?.length || 1;
      const readingTime = Math.max(1, Math.ceil(words / 200));
      setStats({ words, characters, paragraphs, readingTime });
    },
  });

  const [stats, setStats] = useState({ words: 0, characters: 0, paragraphs: 0, readingTime: 1 });

  // Load content into editor once fetched
  useEffect(() => {
    if (part && editor && !editor.isDestroyed) {
      editor.commands.setContent(part.content || '');
      const text = editor.getText();
      const words = text.trim() ? text.trim().split(/\s+/).filter(Boolean).length : 0;
      const characters = text.length;
      const paragraphs = editor.getHTML().match(/<p>/g)?.length || 1;
      const readingTime = Math.max(1, Math.ceil(words / 200));
      setStats({ words, characters, paragraphs, readingTime });
    }
  }, [part, editor]);

  // Autosave listener (debounced 2000ms)
  useEffect(() => {
    if (autosaveStatus !== 'dirty' || !editor) return;

    if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current);

    autosaveTimerRef.current = setTimeout(async () => {
      try {
        setAutosaveStatus('saving');
        await http.put(`/parts/${partId}`, {
          title,
          content: editor.getHTML(),
          headerImageUrl: headerImageUrl || null,
          isPublished: part?.isPublished ?? false,
        });
        setAutosaveStatus('saved');
      } catch {
        setAutosaveStatus('dirty');
      }
    }, 2000);

    return () => {
      if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current);
    };
  }, [autosaveStatus, editor, title, headerImageUrl, partId, part?.isPublished]);

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

  const handleSave = async (publish: boolean = false) => {
    if (!editor) return;
    if (pendingAction) return;
    setPendingAction(publish ? 'publish' : 'draft');
    try {
      const html = editor.getHTML();
      const payload = {
        title: title.trim() || 'Untitled Chapter',
        content: html,
        headerImageUrl: headerImageUrl.trim() || null,
        isPublished: publish,
      };

      await http.put(`/parts/${partId}`, payload);
      await queryClient.invalidateQueries({ queryKey: ['parts', storyId] });
      setAutosaveStatus('saved');
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
              {autosaveStatus === 'saving' ? (
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

      {/* Chapter Header Banner Input */}
      <div className="bg-white dark:bg-slate-800 p-3 rounded-xl border border-gray-200 dark:border-slate-700 flex flex-col sm:flex-row items-start sm:items-center gap-3">
        <div className="flex-1 w-full">
          <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">
            Chapter Header Banner (Optional)
          </label>
          <div className="flex gap-2">
            <input
              type="url"
              placeholder="https://example.com/chapter-banner.jpg"
              value={headerImageUrl}
              onChange={(e) => {
                setHeaderImageUrl(e.target.value);
                setAutosaveStatus('dirty');
              }}
              className="flex-1 text-xs p-2 rounded-lg border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-900 text-gray-900 dark:text-gray-100"
            />
            <label className="px-3 py-1.5 bg-gray-100 dark:bg-slate-700 hover:bg-gray-200 text-xs font-medium rounded-lg cursor-pointer transition flex items-center gap-1.5 shrink-0">
              {isUploadingHeader ? <LoaderCircle className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
              <span>Upload</span>
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
          </div>
        </div>

        {headerImageUrl && (
          <div className="w-20 h-12 rounded-lg overflow-hidden border border-gray-200 shrink-0">
            <img src={headerImageUrl} alt="Header Preview" className="w-full h-full object-cover" />
          </div>
        )}
      </div>

      {/* Editor Toolbar & Content */}
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-xs overflow-hidden border border-gray-200 dark:border-slate-700">
        <div className="border-b border-gray-200 dark:border-slate-700 p-2 flex gap-1.5 bg-gray-50 dark:bg-slate-900 flex-wrap items-center text-xs">
          <button
            type="button"
            onClick={() => editor?.chain().focus().toggleBold().run()}
            title="Bold"
            aria-label="Bold"
            className={`p-2 rounded-lg transition cursor-pointer ${
              editor?.isActive('bold') ? 'bg-primary text-white' : 'hover:bg-gray-200 dark:hover:bg-slate-700 text-gray-700 dark:text-gray-300'
            }`}
          >
            <Bold className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => editor?.chain().focus().toggleItalic().run()}
            title="Italic"
            aria-label="Italic"
            className={`p-2 rounded-lg transition cursor-pointer ${
              editor?.isActive('italic') ? 'bg-primary text-white' : 'hover:bg-gray-200 dark:hover:bg-slate-700 text-gray-700 dark:text-gray-300'
            }`}
          >
            <Italic className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => editor?.chain().focus().toggleHeading({ level: 2 }).run()}
            title="Heading 2"
            aria-label="Heading 2"
            className={`p-2 rounded-lg transition cursor-pointer ${
              editor?.isActive('heading', { level: 2 }) ? 'bg-primary text-white' : 'hover:bg-gray-200 dark:hover:bg-slate-700 text-gray-700 dark:text-gray-300'
            }`}
          >
            <Heading2 className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => editor?.chain().focus().toggleBulletList().run()}
            title="Bullet List"
            aria-label="Bullet List"
            className={`p-2 rounded-lg transition cursor-pointer ${
              editor?.isActive('bulletList') ? 'bg-primary text-white' : 'hover:bg-gray-200 dark:hover:bg-slate-700 text-gray-700 dark:text-gray-300'
            }`}
          >
            <List className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => setShowImageDialog(true)}
            title="Image"
            aria-label="Image"
            className="p-2 rounded-lg hover:bg-gray-200 dark:hover:bg-slate-700 text-gray-700 dark:text-gray-300 transition cursor-pointer"
          >
            <LucideImage className="w-4 h-4" />
          </button>

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
                dangerouslySetInnerHTML={{ __html: editor?.getHTML() || '' }}
              />
            </div>
          </div>
        </div>
      )}

      {/* INSERT IMAGE DIALOG */}
      <ActionDialog
        open={showImageDialog}
        title="Insert image"
        description="Enter a public image URL to insert it at the current cursor position."
        confirmLabel="Insert image"
        input={{
          label: 'Image URL',
          value: imageUrl,
          onChange: setImageUrl,
          placeholder: 'https://example.com/image.jpg',
          required: true,
          type: 'url',
        }}
        onCancel={() => {
          setShowImageDialog(false);
          setImageUrl('');
        }}
        onConfirm={() => {
          editor?.chain().focus().setImage({ src: imageUrl.trim() }).run();
          setShowImageDialog(false);
          setImageUrl('');
          feedback.info('Image inserted into chapter.');
        }}
      />
    </div>
  );
}
