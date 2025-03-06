import Link from "next/link";

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24">
      <h1 className="mb-8 text-4xl font-bold text-center">
        Find Foods with Similar Macros
      </h1>
      <Link 
        href="/search" 
        className="w-full max-w-2xl px-6 py-4 text-xl bg-blue-500 text-white rounded-lg text-center hover:bg-blue-600 transition-colors"
      >
        Start Searching
      </Link>
    </main>
  );
}
