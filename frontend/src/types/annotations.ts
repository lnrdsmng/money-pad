export interface ParagraphAnchor {
  startIndex: number;
  endIndex: number;
  selectedText: string;
}

export interface ParagraphCommentSummary extends ParagraphAnchor {
  commentCount: number | string;
}

export interface PassageComment extends ParagraphAnchor {
  id: string;
  parentId?: string | null;
  userId: string;
  username: string;
  userProfileImageUrl?: string | null;
  isUserVerified: boolean;
  content: string;
  timestamp: number | string;
  heartsCount: number;
  isHearted: boolean;
  replies: PassageComment[];
}

export interface PaginatedPassageComments {
  data: PassageComment[];
  current_page: number;
  last_page: number;
}
