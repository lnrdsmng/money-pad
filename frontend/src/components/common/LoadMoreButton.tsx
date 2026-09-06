interface Props {
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  fetchNextPage: () => Promise<unknown>;
  isError?: boolean;
}

export function LoadMoreButton({ hasNextPage, isFetchingNextPage, fetchNextPage, isError }: Props) {
  if (!hasNextPage) return null;
  return <button type="button" disabled={isFetchingNextPage} onClick={() => void fetchNextPage()}
    className="mx-auto my-4 block rounded-lg border border-gray-300 px-5 py-2 text-sm disabled:opacity-50">
    {isFetchingNextPage ? 'Loading...' : isError ? 'Retry loading more' : 'Load more'}
  </button>;
}
