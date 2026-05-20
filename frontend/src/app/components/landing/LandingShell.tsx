/** Instant branded shell while auth or Three.js chunk loads */
export function LandingShell() {
  return (
    <div className="relative min-h-screen overflow-hidden bg-[#030712] text-white">
      <div
        className="pointer-events-none absolute left-[-10%] top-[-20%] h-[420px] w-[420px] rounded-full bg-violet-600/30 blur-[100px]"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute bottom-[-15%] right-[-5%] h-[420px] w-[420px] rounded-full bg-cyan-500/20 blur-[100px]"
        aria-hidden
      />
      <div className="relative z-10 flex min-h-screen flex-col items-center justify-center gap-6 px-6">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-cyan-500/30 bg-cyan-500/10 shadow-[0_0_40px_rgba(34,211,238,0.25)]">
          <span className="text-2xl font-bold tracking-tight text-cyan-300">H</span>
        </div>
        <div className="text-center">
          <p className="text-sm uppercase tracking-[0.35em] text-cyan-400/80">Hexerve</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">WorkPlus</h1>
        </div>
        <div className="h-1 w-48 overflow-hidden rounded-full bg-white/10">
            <LoadingBar />
        </div>
      </div>
    </div>
  );
}

function LoadingBar() {
  return (
    <div className="h-full w-1/3 animate-[landing-bar-shimmer_1.2s_ease-in-out_infinite] rounded-full bg-gradient-to-r from-cyan-400 to-violet-500" />
  );
}
