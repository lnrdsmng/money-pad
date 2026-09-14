import type { Story } from './content';

export interface ReadingList {
  id: string;
  name: string;
  description?: string | null;
  userId: string;
  createdAt: number | string;
  stories: Story[];
  storyCount: number;
}
