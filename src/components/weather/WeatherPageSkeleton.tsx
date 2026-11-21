export function WeatherPageSkeleton({ districtName }: { districtName?: string } = {}) {
  return (
    <div
      className="min-w-0 space-y-4 pb-2"
      role="status"
      aria-live="polite"
      aria-label="Loading weather forecast"
    >
      {/* Hero section matching WeatherHero exact vertical height */}
      <div className="flex min-h-[208px] flex-col items-center justify-center space-y-3 pt-2 text-center">
        <div className="glass-shimmer h-3.5 w-28 rounded-full" />
        {districtName ? (
          <h1 className="text-on-sky-strong block text-[32px] font-semibold tracking-[-0.03rem] text-white sm:text-[38px]">
            {districtName}
          </h1>
        ) : (
          <div className="glass-shimmer h-10 w-44 rounded-xl" />
        )}
        <div className="glass-shimmer h-20 w-28 rounded-2xl" />
        <div className="glass-shimmer h-4 w-36 rounded-full" />
      </div>

      {/* Hourly strip skeleton matching HourlyStrip geometry */}
      <div className="rounded-[22px] border border-white/[0.1] bg-[rgba(14,20,34,0.45)] p-4 backdrop-blur-xl">
        <div className="glass-shimmer mb-3 h-3.5 w-44 rounded-full" />
        <div className="grid grid-cols-6 gap-2">
          {Array.from({ length: 6 }).map((_, index) => (
            <div key={index} className="flex flex-col items-center gap-2 py-1">
              <div className="glass-shimmer h-3 w-8 rounded-full" />
              <div className="glass-shimmer h-6 w-6 rounded-full" />
              <div className="glass-shimmer h-4 w-7 rounded-full" />
            </div>
          ))}
        </div>
      </div>

      {/* Mobile: 10-day card + essential tile skeletons matching real heights */}
      <div className="space-y-3 lg:hidden">
        <div className="rounded-[22px] border border-white/[0.1] bg-[rgba(14,20,34,0.45)] p-4 backdrop-blur-xl">
          <div className="glass-shimmer mb-3.5 h-3.5 w-32 rounded-full" />
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, index) => (
              <div key={index} className="flex items-center justify-between gap-3">
                <div className="glass-shimmer h-4 w-16 rounded-full" />
                <div className="glass-shimmer h-5 w-5 rounded-full" />
                <div className="glass-shimmer h-2 flex-1 rounded-full" />
                <div className="glass-shimmer h-4 w-14 rounded-full" />
              </div>
            ))}
          </div>
        </div>

        <div className="min-h-[176px] rounded-[22px] border border-white/[0.1] bg-[rgba(14,20,34,0.45)] p-4 backdrop-blur-xl">
          <div className="glass-shimmer mb-3 h-3.5 w-28 rounded-full" />
          <div className="glass-shimmer mb-2.5 h-6 w-48 rounded-lg" />
          <div className="glass-shimmer h-4 w-full max-w-[260px] rounded-full" />
        </div>

        <div className="min-h-[360px] rounded-[22px] border border-white/[0.1] bg-[rgba(14,20,34,0.45)] p-4 backdrop-blur-xl">
          <div className="glass-shimmer mb-3 h-3.5 w-32 rounded-full" />
          <div className="glass-shimmer h-[290px] w-full rounded-2xl" />
        </div>
      </div>

      {/* Desktop: 4-column grid matching DesktopDashboard & HomeTileGrid */}
      <div className="hidden grid-cols-4 gap-3 lg:grid">
        <div className="col-span-1 row-span-3 min-h-[560px] rounded-[22px] border border-white/[0.1] bg-[rgba(14,20,34,0.45)] p-4 backdrop-blur-xl">
          <div className="glass-shimmer mb-4 h-3.5 w-28 rounded-full" />
          <div className="space-y-4">
            {Array.from({ length: 8 }).map((_, index) => (
              <div key={index} className="flex items-center justify-between gap-2">
                <div className="glass-shimmer h-4 w-12 rounded-full" />
                <div className="glass-shimmer h-2 flex-1 rounded-full" />
                <div className="glass-shimmer h-4 w-10 rounded-full" />
              </div>
            ))}
          </div>
        </div>
        <div className="col-span-2 min-h-[176px] rounded-[22px] border border-white/[0.1] bg-[rgba(14,20,34,0.45)] p-4 backdrop-blur-xl">
          <div className="glass-shimmer mb-3 h-3.5 w-28 rounded-full" />
          <div className="glass-shimmer mb-2.5 h-7 w-44 rounded-lg" />
          <div className="glass-shimmer h-4 w-56 rounded-full" />
        </div>
        <div className="col-span-1 min-h-[176px] rounded-[22px] border border-white/[0.1] bg-[rgba(14,20,34,0.45)] p-4 backdrop-blur-xl">
          <div className="glass-shimmer mb-3 h-3.5 w-20 rounded-full" />
          <div className="glass-shimmer h-10 w-24 rounded-lg" />
        </div>
        <div className="col-span-2 row-span-2 min-h-[360px] rounded-[22px] border border-white/[0.1] bg-[rgba(14,20,34,0.45)] p-4 backdrop-blur-xl">
          <div className="glass-shimmer mb-3 h-3.5 w-32 rounded-full" />
          <div className="glass-shimmer h-[290px] w-full rounded-2xl" />
        </div>
        <div className="col-span-1 min-h-[176px] rounded-[22px] border border-white/[0.1] bg-[rgba(14,20,34,0.45)] p-4 backdrop-blur-xl">
          <div className="glass-shimmer mb-3 h-3.5 w-24 rounded-full" />
          <div className="glass-shimmer h-10 w-20 rounded-lg" />
        </div>
        <div className="col-span-1 min-h-[176px] rounded-[22px] border border-white/[0.1] bg-[rgba(14,20,34,0.45)] p-4 backdrop-blur-xl">
          <div className="glass-shimmer mb-3 h-3.5 w-24 rounded-full" />
          <div className="glass-shimmer h-10 w-20 rounded-lg" />
        </div>
      </div>
    </div>
  );
}
