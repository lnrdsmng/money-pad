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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-2.5 sm:p-4">
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl max-w-lg w-full p-4 sm:p-6 relative max-h-[92vh] overflow-y-auto">
        <button
          onClick={onClose}
          className="absolute top-3.5 right-3.5 sm:top-4 sm:right-4 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 p-1.5 rounded-full transition-colors cursor-pointer"
          aria-label="Close modal"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="pr-8 sm:pr-0">
          <div className="flex items-center gap-2 mb-1">
            <BookOpen className="w-5 h-5 text-primary shrink-0" />
            <h2 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-gray-100">
              Create New Story (Step {step} of 2)
            </h2>
          </div>
          <p className="text-xs text-gray-500 mb-4 sm:mb-6">
            {step === 1 ? 'Start with the basic story details and book cover' : 'Categorize your novel and target audience'}
          </p>
        </div>

        {/* STEP 1 */}
        {step === 1 && (
          <div className="space-y-3.5 sm:space-y-4">
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
                className="w-full text-xs sm:text-sm p-2.5 sm:p-3 rounded-xl border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-gray-900 dark:text-gray-100 focus:outline-none focus:border-primary"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                Synopsis / Overview *
              </label>
              <textarea
                rows={3}
                required
                placeholder="Write a compelling blurb to hook your readers..."
                value={overview}
                onChange={(e) => setOverview(e.target.value)}
                className="w-full text-xs sm:text-sm p-2.5 sm:p-3 rounded-xl border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-gray-900 dark:text-gray-100 focus:outline-none focus:border-primary"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
                Cover Image (Recommended 2:3 ratio)
              </label>
              <div className="flex flex-col xs:flex-row items-center gap-3 p-3 rounded-xl border border-dashed border-gray-200 dark:border-slate-700 bg-gray-50/60 dark:bg-slate-900/40">
                <div className="w-20 h-28 rounded-lg bg-gray-100 dark:bg-slate-700 border border-gray-200 dark:border-slate-600 overflow-hidden shrink-0 flex items-center justify-center text-xs text-gray-400">
                  {coverImageUrl ? (
                    <img src={coverImageUrl} alt="Cover" className="w-full h-full object-cover" />
                  ) : (
                    <div className="flex flex-col items-center gap-1 text-[10px] text-gray-400 p-1 text-center">
                      <BookOpen className="w-5 h-5 opacity-40" />
                      <span>No Cover</span>
                    </div>
                  )}
                </div>

                <div className="flex flex-col items-center xs:items-start gap-2 w-full min-w-0">
                  <label className="inline-flex w-full xs:w-auto items-center justify-center gap-1.5 px-4 py-2 bg-white dark:bg-slate-800 border border-gray-300 dark:border-slate-600 hover:bg-gray-50 dark:hover:bg-slate-700 text-xs font-medium text-gray-700 dark:text-gray-200 rounded-xl cursor-pointer transition shadow-xs">
                    {isUploadingCover ? <LoaderCircle className="w-4 h-4 animate-spin text-primary" /> : <Upload className="w-4 h-4 text-primary" />}
                    <span>{isUploadingCover ? 'Uploading...' : coverImageUrl ? 'Change Cover' : 'Upload Cover'}</span>
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
                  {coverImageUrl && (
                    <button
                      type="button"
                      onClick={() => setCoverImageUrl('')}
                      className="text-[11px] text-red-500 hover:underline cursor-pointer"
                    >
                      Remove Cover
                    </button>
                  )}
                  <p className="text-[11px] text-gray-400 text-center xs:text-left">
                    PNG, JPG or WebP up to 5MB
                  </p>
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-3 sm:pt-4 border-t border-gray-100 dark:border-slate-700">
              <button
                type="button"
                onClick={() => {
                  if (!title.trim() || !overview.trim()) {
                    feedback.error('Title and synopsis are required.');
                    return;
                  }
                  setStep(2);
                }}
                className="w-full sm:w-auto px-5 py-2.5 bg-primary text-white text-xs sm:text-sm font-semibold rounded-xl hover:bg-green-600 transition flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
              >
                <span>Next: Genres & Details</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* STEP 2 */}
        {step === 2 && (
          <div className="space-y-4 sm:space-y-5">
            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                Select Genres (Up to 5)
              </label>
              <div className="flex flex-wrap gap-1.5 max-h-40 sm:max-h-48 overflow-y-auto p-1.5 border border-gray-100 dark:border-slate-700 rounded-xl">
                {STORY_GENRES.map((genre) => {
                  const selected = selectedGenres.includes(genre);
                  return (
                    <button
                      key={genre}
                      type="button"
                      onClick={() => handleToggleGenre(genre)}
                      className={`px-2.5 sm:px-3 py-1 rounded-full text-[11px] sm:text-xs font-medium transition flex items-center gap-1 cursor-pointer ${
                        selected
                          ? 'bg-primary text-white shadow-xs'
                          : 'bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200'
                      }`}
                    >
                      {selected && <Check className="w-3 h-3" />}
                      <span>{genre}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                  Language
                </label>
                <select
                  value={language}
                  onChange={(e) => setLanguage(e.target.value)}
                  className="w-full text-xs sm:text-sm p-2.5 rounded-xl border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-gray-900 dark:text-gray-100 focus:outline-none focus:border-primary"
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
                  className={`w-full p-2.5 rounded-xl border text-xs sm:text-sm font-medium transition flex items-center justify-between cursor-pointer ${
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

            <div className="flex flex-col-reverse sm:flex-row justify-between items-stretch sm:items-center gap-2.5 sm:gap-3 pt-3 sm:pt-4 border-t border-gray-100 dark:border-slate-700">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="w-full sm:w-auto px-4 py-2.5 text-xs sm:text-sm font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-xl transition flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Back</span>
              </button>

              <button
                type="button"
                onClick={handleCreate}
                disabled={isSubmitting}
                className="w-full sm:w-auto px-5 py-2.5 bg-primary text-white text-xs sm:text-sm font-bold rounded-xl hover:bg-green-600 transition flex items-center justify-center gap-2 cursor-pointer shadow-xs disabled:opacity-60"
              >
                {isSubmitting && <LoaderCircle className="w-4 h-4 animate-spin" />}
                <span>{isSubmitting ? 'Creating Story...' : 'Publish Story Project'}</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default CreateStoryModal;
