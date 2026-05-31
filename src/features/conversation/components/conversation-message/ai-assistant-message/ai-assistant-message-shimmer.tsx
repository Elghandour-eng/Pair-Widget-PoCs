export function AiAssistantMessageShimmer() {
  return (
    <>
      {/* Text Area Skeleton */}
      <div className="mt-1 flex w-full flex-col gap-2.5">
        <div className="shimmer-skeleton h-2.5 w-full rounded-[6px]" />
        <div className="shimmer-skeleton h-2.5 w-full rounded-[6px]" />
        <div className="shimmer-skeleton h-2.5 w-full rounded-[6px]" />
      </div>

      {/* Suggestions Section Skeleton */}
      <div className="mt-2 flex w-full gap-2">
        <div className="shimmer-skeleton h-72 flex-1 rounded-2xl" />
        <div className="shimmer-skeleton h-72 flex-1 rounded-2xl" />
        <div className="shimmer-skeleton h-72 flex-1 rounded-2xl" />
      </div>
    </>
  )
}
