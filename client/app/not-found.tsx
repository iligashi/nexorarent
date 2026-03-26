import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="min-h-screen bg-bg-primary flex items-center justify-center px-4">
      <div className="text-center">
        <h1 className="text-8xl font-outfit font-bold text-accent mb-4">404</h1>
        <h2 className="text-2xl font-outfit font-bold text-white mb-3">Page Not Found</h2>
        <p className="text-text-secondary mb-8 max-w-md">
          The page you&apos;re looking for doesn&apos;t exist or has been moved.
        </p>
        <div className="flex items-center justify-center gap-4">
          <Link href="/" className="px-6 py-3 bg-accent text-white font-semibold rounded-lg hover:bg-accent-hover transition-colors">
            Go Home
          </Link>
          <Link href="/cars" className="px-6 py-3 bg-bg-tertiary text-white font-semibold rounded-lg hover:bg-surface transition-colors border border-border">
            Browse Cars
          </Link>
        </div>
      </div>
    </div>
  );
}
