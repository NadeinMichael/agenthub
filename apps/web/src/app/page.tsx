import Link from 'next/link';

export default function HomePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-white to-blue-50">
      <div className="text-center">
        <h1 className="text-5xl font-bold text-gray-900">AgentHub</h1>
        <p className="mt-4 text-xl text-gray-600">Manage and orchestrate your AI agents</p>
        <div className="mt-8 flex gap-4 justify-center">
          <Link
            href="/dashboard"
            className="rounded-lg bg-blue-600 px-6 py-3 text-white font-medium hover:bg-blue-700 transition-colors"
          >
            Go to Dashboard
          </Link>
          <Link
            href="/login"
            className="rounded-lg border border-gray-300 px-6 py-3 text-gray-700 font-medium hover:bg-gray-50 transition-colors"
          >
            Sign In
          </Link>
        </div>
      </div>
    </main>
  );
}
