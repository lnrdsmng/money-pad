import { useState } from 'react';

interface UserAvatarProps {
  username: string;
  imageUrl?: string | null;
  className?: string;
  imageClassName?: string;
}

export function UserAvatar({ username, imageUrl, className = 'h-8 w-8', imageClassName = '' }: UserAvatarProps) {
  const [failedImageUrl, setFailedImageUrl] = useState<string | null>(null);

  return (
    <span className={`inline-flex shrink-0 overflow-hidden rounded-full bg-primary text-white ${className}`}>
      {imageUrl && failedImageUrl !== imageUrl ? (
        <img
          src={imageUrl}
          alt={`${username}'s profile`}
          className={`h-full w-full object-cover ${imageClassName}`}
          onError={() => setFailedImageUrl(imageUrl)}
        />
      ) : (
        <span className="flex h-full w-full items-center justify-center font-bold" aria-hidden="true">
          {username.trim().charAt(0).toUpperCase() || '?'}
        </span>
      )}
    </span>
  );
}
