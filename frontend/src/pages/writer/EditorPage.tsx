import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Highlight from '@tiptap/extension-highlight'
import Image from '@tiptap/extension-image'
import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import http from '../../api/http'

export default function EditorPage() {
  const { storyId, partId } = useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [title, setTitle] = useState('')
  const [saving, setSaving] = useState(false)

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
    setSaving(true)
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
        navigate(`/writer/story/${storyId}/parts`)
      } else {
        alert('Draft saved!')
      }
    } catch (e) {
      alert('Failed to save')
    } finally {
      setSaving(false)
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
            disabled={saving}
            className="px-4 py-2 border border-gray-300 rounded hover:bg-gray-50 dark:hover:bg-slate-700"
          >
            {saving ? 'Saving...' : 'Save Draft'}
          </button>
          <button 
            onClick={() => handleSave(true)}
            disabled={saving}
            className="px-4 py-2 bg-primary text-white rounded hover:bg-green-600"
          >
            Publish
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
        <button onClick={() => {
            const url = window.prompt('URL')
            if (url) editor?.chain().focus().setImage({ src: url }).run()
          }} className="p-2 rounded hover:bg-gray-200 dark:hover:bg-slate-700">Image
        </button>
      </div>
      
      <EditorContent editor={editor} />
    </div>
  )
}
