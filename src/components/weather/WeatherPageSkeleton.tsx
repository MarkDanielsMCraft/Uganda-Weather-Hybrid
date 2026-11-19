export function WeatherPageSkeleton({ districtName }: { districtName?: string } = {}) {
  return (
    <div className="min-w-0 animate-pulse space-y-5 pb-2">
      <div className="h-8 w-40 rounded-lg bg-white/10" />
      <div className="space-y-3 pt-4 text-center">
        <div className="mx-auto h-4 w-28 rounded bg-white/10" />
        {districtName ? (
          <h1 className="text-on-sky-strong block text-[32px] font-semibold tracking-[-0.03rem] text-white sm:text-[38px]">
            {districtName}
          </h1>
        ) : (
          <div className="mx-auto h-10 w-48 rounded-lg bg-white/10" />
        )}
        <div className="mx-auto h-24 w-32 rounded-lg bg-white/10" />
        <div className="mx-auto h-5 w-36 rounded bg-white/10" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="h-24 rounded-2xl bg-white/10" />
        <div className="h-24 rounded-2xl bg-white/10" />
        <div className="h-24 rounded-2xl bg-white/10" />
        <div className="h-24 rounded-2xl bg-white/10" />
      </div>
      <div className="h-40 rounded-2xl bg-white/10" />
      <div className="h-52 rounded-2xl bg-white/10" />
    </div>
  );
}
