import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, ArrowRight, ArrowLeft, Upload, Check, LoaderCircle, BookOpen } from 'lucide-react';
import http from '../../api/http';
import { STORY_GENRES } from '../../constants/genres';
import { useFeedback } from '../feedback/feedback';
import { getApiErrorMessage } from '../../utils/apiError';

interface CreateStoryModalProps {
  onClose: () => void;
}

export const CreateStoryModal = ({ onClose }: CreateStoryModalProps) => {
  const navigate = useNavigate();
  const feedback = useFeedback();

  const [step, setStep] = useState<1 | 2>(1);
  const [title, setTitle] = useState('');
  const [overview, setOverview] = useState('');
  const [coverImageUrl, setCoverImageUrl] = useState('');
  const [selectedGenres, setSelectedGenres] = useState<string[]>([]);
  const [language, setLanguage] = useState('en');
  const [isMature, setIsMature] = useState(false);
  const [isUploadingCover, setIsUploadingCover] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleUploadCover = async (file: File) => {
    const formData = new FormData();
    formData.append('image', file);
    setIsUploadingCover(true);
    try {
      const res = await http.post('/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setCoverImageUrl(res.data.url);
      feedback.success('Cover image uploaded.');
    } catch (error) {
      feedback.error(getApiErrorMessage(error, 'Cover upload failed.'));
    } finally {
      setIsUploadingCover(false);
    }
  };

  const handleToggleGenre = (genre: string) => {
    if (selectedGenres.includes(genre)) {
      setSelectedGenres(selectedGenres.filter((g) => g !== genre));
    } else {
      if (selectedGenres.length >= 5) {
        feedback.info('You can select up to 5 genres.');
        return;
      }
      setSelectedGenres([...selectedGenres, genre]);
    }
  };

  const handleCreate = async () => {
    if (!title.trim() || !overview.trim()) {
      feedback.error('Please enter a story title and synopsis.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await http.post('/stories', {
        title: title.trim(),
        overview: overview.trim(),
        coverImageUrl: coverImageUrl.trim() || null,
        genres: selectedGenres.join(','),
        language,
        isMature,
      });

      feedback.success('Story created successfully!');
      onClose();
      navigate(`/writer/story/${res.data.id}/parts`);
    } catch (error) {
      feedback.error(getApiErrorMessage(error, 'Could not create story.'));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl max-w-lg w-full p-6 relative max-h-[90vh] overflow-y-auto">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 p-1 rounded-full transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-2 mb-1">
          <BookOpen className="w-5 h-5 text-primary" />
          <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">
            Create New Story (Step {step} of 2)
          </h2>
        </div>
        <p className="text-xs text-gray-500 mb-6">
          {step === 1 ? 'Start with the basic story details and book cover' : 'Categorize your novel and target audience'}
        </p>

        {/* STEP 1 */}
        {step === 1 && (
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                Story Title *
              </label>
              <input
                type="text"
                required
                placeholder="e.g. The Alpha's Forbidden Luna"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full text-sm p-3 rounded-xl border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-gray-900 dark:text-gray-100 focus:outline-none focus:border-primary"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                Synopsis / Overview *
              </label>
              <textarea
                rows={4}
                required
                placeholder="Write a compelling blurb to hook your readers..."
                value={overview}
                onChange={(e) => setOverview(e.target.value)}
                className="w-full text-sm p-3 rounded-xl border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-gray-900 dark:text-gray-100 focus:outline-none focus:border-primary"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                Cover Image (Recommended 2:3 ratio)
              </label>
              <div className="flex items-center gap-4">
                <div className="w-16 h-24 rounded-lg bg-gray-100 dark:bg-slate-700 border border-gray-200 dark:border-slate-600 overflow-hidden shrink-0 flex items-center justify-center text-xs text-gray-400">
                  {coverImageUrl ? (
                    <img src={coverImageUrl} alt="Cover" className="w-full h-full object-cover" />
                  ) : (
                    'No Cover'
                  )}
                </div>

                <div className="flex-1 space-y-2">
                  <input
                    type="url"
                    placeholder="https://example.com/cover.jpg"
                    value={coverImageUrl}
                    onChange={(e) => setCoverImageUrl(e.target.value)}
                    className="w-full text-xs p-2 rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-gray-900 dark:text-gray-100"
                  />
                  <label className="inline-flex items-center gap-1.5 px-3 py-1 bg-gray-100 dark:bg-slate-700 hover:bg-gray-200 text-xs font-medium text-gray-700 dark:text-gray-200 rounded-lg cursor-pointer transition">
                    {isUploadingCover ? <LoaderCircle className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                    {isUploadingCover ? 'Uploading...' : 'Upload Image'}
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      disabled={isUploadingCover}
                      onChange={(e) => {
                        if (e.target.files?.[0]) handleUploadCover(e.target.files[0]);
                      }}
                    />
                  </label>
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-4 border-t border-gray-100 dark:border-slate-700">
              <button
                type="button"
                onClick={() => {
                  if (!title.trim() || !overview.trim()) {
                    feedback.error('Title and synopsis are required.');
                    return;
                  }
                  setStep(2);
                }}
                className="px-5 py-2.5 bg-primary text-white text-xs sm:text-sm font-semibold rounded-xl hover:bg-green-600 transition flex items-center gap-1.5 cursor-pointer shadow-xs"
              >
                Next: Genres & Details
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* STEP 2 */}
        {step === 2 && (
          <div className="space-y-5">
            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                Select Genres (Up to 5)
              </label>
              <div className="flex flex-wrap gap-1.5 max-h-48 overflow-y-auto p-1 border border-gray-100 dark:border-slate-700 rounded-xl">
                {STORY_GENRES.map((genre) => {
                  const selected = selectedGenres.includes(genre);
                  return (
                    <button
                      key={genre}
                      type="button"
                      onClick={() => handleToggleGenre(genre)}
                      className={`px-3 py-1 rounded-full text-xs font-medium transition flex items-center gap-1 cursor-pointer ${
                        selected
                          ? 'bg-primary text-white shadow-xs'
                          : 'bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200'
                      }`}
                    >
                      {selected && <Check className="w-3 h-3" />}
                      {genre}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                  Language
                </label>
                <select
                  value={language}
                  onChange={(e) => setLanguage(e.target.value)}
                  className="w-full text-xs p-2.5 rounded-xl border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-gray-900 dark:text-gray-100 focus:outline-none focus:border-primary"
                >
                  <option value="en">English</option>
                  <option value="fil">Filipino / Tagalog</option>
                  <option value="taglish">Taglish</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                  Mature Audience (18+)
                </label>
                <button
                  type="button"
                  onClick={() => setIsMature(!isMature)}
                  className={`w-full p-2.5 rounded-xl border text-xs font-medium transition flex items-center justify-between cursor-pointer ${
                    isMature
                      ? 'border-accent bg-accent/5 text-accent font-bold'
                      : 'border-gray-300 dark:border-slate-600 text-gray-600 dark:text-gray-400'
                  }`}
                >
                  <span>Mature Content</span>
                  <span className={`w-4 h-4 rounded-full border flex items-center justify-center text-[10px] ${isMature ? 'bg-accent text-white border-accent' : 'border-gray-400'}`}>
                    {isMature ? '✓' : ''}
                  </span>
                </button>
              </div>
            </div>

            <div className="flex justify-between items-center pt-4 border-t border-gray-100 dark:border-slate-700">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="px-4 py-2 text-xs text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-xl transition flex items-center gap-1.5"
              >
                <ArrowLeft className="w-4 h-4" />
                Back
              </button>

              <button
                type="button"
                onClick={handleCreate}
                disabled={isSubmitting}
                className="px-6 py-2.5 bg-primary text-white text-xs sm:text-sm font-bold rounded-xl hover:bg-green-600 transition flex items-center gap-2 cursor-pointer shadow-sm disabled:opacity-60"
              >
                {isSubmitting && <LoaderCircle className="w-4 h-4 animate-spin" />}
                {isSubmitting ? 'Creating Story...' : 'Publish Story Project'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default CreateStoryModal;
