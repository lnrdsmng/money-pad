import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Highlight from '@tiptap/extension-highlight'
import Image from '@tiptap/extension-image'
import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import http from '../../api/http'
import { ActionDialog } from '../../components/feedback/ActionDialog'
import { useFeedback } from '../../components/feedback/feedback'
import { getApiErrorMessage } from '../../utils/apiError'

export default function EditorPage() {
  const { storyId, partId } = useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [title, setTitle] = useState('')
  const [pendingAction, setPendingAction] = useState<'draft' | 'publish' | null>(null)
  const [showImageDialog, setShowImageDialog] = useState(false)
  const [imageUrl, setImageUrl] = useState('')
  const feedback = useFeedback()

  const { data: part, isLoading } = useQuery({
    queryKey: ['part', partId],
    queryFn: async () => {
      const res = await http.get(`/parts/${partId}`)
      setTitle(res.data.title)
      return res.data
    },
    enabled: !!partId
  })

  const editor = useEditor({
    extensions: [
      StarterKit,
      Highlight,
      Image,
    ],
    content: '',
    editorProps: {
      attributes: {
        class: 'prose dark:prose-invert max-w-none focus:outline-none min-h-[500px] p-4 border border-gray-200 dark:border-slate-700 rounded-b',
      },
    },
  })

  // Load content into editor once fetched
  useEffect(() => {
    if (part && editor && !editor.isDestroyed) {
      editor.commands.setContent(part.content)
    }
  }, [part, editor])

  const handleSave = async (publish: boolean = false) => {
    if (!editor) return
    if (pendingAction) return
    setPendingAction(publish ? 'publish' : 'draft')
    try {
      const html = editor.getHTML()
      
      const payload = {
        title,
        content: html,
        isPublished: publish
      }

      await http.put(`/parts/${partId}`, payload)
      await queryClient.invalidateQueries({ queryKey: ['parts', storyId] })
      if (publish) {
        feedback.success('Chapter published.')
        navigate(`/writer/story/${storyId}/parts`)
      } else {
        feedback.success('Draft saved.')
      }
    } catch (error) {
      feedback.error(getApiErrorMessage(error, publish ? 'The chapter could not be published.' : 'The draft could not be saved.'))
    } finally {
      setPendingAction(null)
    }
  }

  if (isLoading) return <div className="p-8 text-center">Loading editor...</div>

  return (
    <div className="max-w-4xl mx-auto bg-white dark:bg-slate-800 p-6 rounded shadow">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Editing Chapter</h1>
        <div className="flex gap-2">
          <button 
            onClick={() => handleSave(false)} 
            disabled={pendingAction !== null}
            aria-busy={pendingAction === 'draft'}
            className="px-4 py-2 border border-gray-300 rounded hover:bg-gray-50 dark:hover:bg-slate-700"
          >
            {pendingAction === 'draft' ? 'Saving...' : 'Save Draft'}
          </button>
          <button 
            onClick={() => handleSave(true)}
            disabled={pendingAction !== null}
            aria-busy={pendingAction === 'publish'}
            className="px-4 py-2 bg-primary text-white rounded hover:bg-green-600"
          >
            {pendingAction === 'publish' ? 'Publishing...' : 'Publish'}
          </button>
        </div>
      </div>

      <input 
        type="text" 
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Chapter Title"
        className="w-full p-4 mb-4 text-xl font-bold border border-gray-200 dark:border-slate-700 rounded dark:bg-slate-900 focus:outline-none focus:border-primary"
      />

      <div className="border border-gray-200 dark:border-slate-700 border-b-0 rounded-t p-2 flex gap-2 bg-gray-50 dark:bg-slate-900 flex-wrap">
        <button onClick={() => editor?.chain().focus().toggleBold().run()} className={`p-2 rounded ${editor?.isActive('bold') ? 'bg-gray-200 dark:bg-slate-700' : 'hover:bg-gray-200 dark:hover:bg-slate-700'}`}><b>B</b></button>
        <button onClick={() => editor?.chain().focus().toggleItalic().run()} className={`p-2 rounded ${editor?.isActive('italic') ? 'bg-gray-200 dark:bg-slate-700' : 'hover:bg-gray-200 dark:hover:bg-slate-700'}`}><i>I</i></button>
        <button onClick={() => editor?.chain().focus().toggleHeading({ level: 2 }).run()} className={`p-2 rounded ${editor?.isActive('heading', { level: 2 }) ? 'bg-gray-200 dark:bg-slate-700' : 'hover:bg-gray-200 dark:hover:bg-slate-700'}`}>H2</button>
        <button onClick={() => editor?.chain().focus().toggleBulletList().run()} className={`p-2 rounded ${editor?.isActive('bulletList') ? 'bg-gray-200 dark:bg-slate-700' : 'hover:bg-gray-200 dark:hover:bg-slate-700'}`}>List</button>
        <button type="button" onClick={() => setShowImageDialog(true)} className="p-2 rounded hover:bg-gray-200 dark:hover:bg-slate-700">Image
        </button>
      </div>
      
      <EditorContent editor={editor} />

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
          setShowImageDialog(false)
          setImageUrl('')
        }}
        onConfirm={() => {
          editor?.chain().focus().setImage({ src: imageUrl.trim() }).run()
          setShowImageDialog(false)
          setImageUrl('')
          feedback.info('Image inserted into the chapter.')
        }}
      />
    </div>
  )
}
