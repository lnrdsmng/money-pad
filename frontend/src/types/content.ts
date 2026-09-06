export interface Story {
  id: string;
  authorId: string;
  authorName: string;
  title: string;
  overview: string;
  genres: string;
  coverImageUrl?: string | null;
  isMature?: boolean;
  isPublished: boolean;
  isAuthorVerified: boolean;
  readCount: number;
  likes: number;
  lastUpdatedAt: number;
}

export interface ChapterSummary {
  id: string;
  storyId: string;
  title: string;
  order: number;
  isPublished: boolean;
  publishedAt: number;
  readCount: number;
  headerImageUrl?: string | null;
  revision: number;
}

export interface Chapter extends ChapterSummary { content: string }
export interface ChapterSave {
  title: string;
  content: string;
  headerImageUrl: string | null;
  isPublished?: boolean;
}
export interface ChapterSaveResponse { success: boolean; revision: number }
