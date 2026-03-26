'use client';

export default function Error({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div className="min-h-screen bg-bg-primary flex items-center justify-center px-4">
      <div className="text-center">
        <h1 className="text-6xl font-outfit font-bold text-accent mb-4">Oops</h1>
        <h2 className="text-xl font-outfit font-bold text-white mb-3">Something went wrong</h2>
        <p className="text-text-secondary mb-8 max-w-md">
          An unexpected error occurred. Please try again.
        </p>
        <button
          onClick={reset}
          className="px-6 py-3 bg-accent text-white font-semibold rounded-lg hover:bg-accent-hover transition-colors"
        >
          Try Again
        </button>
      </div>
    </div>
  );
}
