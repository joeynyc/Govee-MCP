import { useDevices } from "./hooks/useDevices";
import { DeviceList } from "./components/DeviceList";

function App() {
  const { data: devices, isLoading, error, refetch } = useDevices();

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      {/* Header */}
      <header className="border-b border-zinc-800 bg-zinc-900/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <svg
              className="w-8 h-8 text-emerald-500"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
              />
            </svg>
            <h1 className="text-xl font-semibold">Govee Dashboard</h1>
          </div>
          <button
            onClick={() => refetch()}
            disabled={isLoading}
            className={`
              px-4 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700
              transition-colors text-sm font-medium
              ${isLoading ? "opacity-50 cursor-not-allowed" : ""}
            `}
          >
            {isLoading ? "Loading..." : "Refresh"}
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-6xl mx-auto px-4 py-6">
        {/* Loading State */}
        {isLoading && !devices && (
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin w-8 h-8 border-2 border-zinc-600 border-t-emerald-500 rounded-full" />
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="bg-red-900/20 border border-red-800 rounded-xl p-4 text-center">
            <p className="text-red-400 font-medium">Failed to load devices</p>
            <p className="text-red-400/70 text-sm mt-1">
              {error instanceof Error ? error.message : "Unknown error"}
            </p>
            <button
              onClick={() => refetch()}
              className="mt-3 px-4 py-2 bg-red-800 hover:bg-red-700 rounded-lg text-sm transition-colors"
            >
              Try Again
            </button>
          </div>
        )}

        {/* Devices */}
        {devices && <DeviceList devices={devices} />}
      </main>

      {/* Footer */}
      <footer className="border-t border-zinc-800 mt-auto">
        <div className="max-w-6xl mx-auto px-4 py-4 text-center text-zinc-500 text-sm">
          Govee Dashboard - Control your smart lights
        </div>
      </footer>
    </div>
  );
}

export default App;
