import { LayoutDashboard, Upload, BookMarked, GitBranch } from 'lucide-react';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db/index';
import { transcripts, examples } from '@/lib/db/schema';
import { eq, and, or, isNull, count } from 'drizzle-orm';

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user?.id) redirect('/login');
  const userId = session.user.id;

  const [[exampleCount], [transcriptCount], [inProgressCount]] = await Promise.all([
    db.select({ total: count() }).from(examples).where(eq(examples.userId, userId)),
    db.select({ total: count() }).from(transcripts).where(eq(transcripts.userId, userId)),
    db.select({ total: count() }).from(transcripts).where(
      and(
        eq(transcripts.userId, userId),
        or(isNull(transcripts.extractedAt), isNull(transcripts.enrichedAt))
      )
    ),
  ]);

  const stats = [
    { value: String(exampleCount?.total ?? 0), label: 'examples' },
    { value: String(transcriptCount?.total ?? 0), label: 'transcripts' },
    { value: String(inProgressCount?.total ?? 0), label: 'in progress' },
  ];

  return (
    <div className="max-w-4xl">
      {/* Header */}
      <div className="mb-8">
        <h1
          className="font-heading text-3xl font-bold mb-1"
          style={{ color: 'var(--mist)', letterSpacing: '-0.01em' }}
        >
          Welcome to StoryBank
        </h1>
        <p className="text-sm" style={{ color: 'var(--sage)' }}>
          Your career story, organised.
        </p>
      </div>

      {/* Quick stats */}
      <div
        className="grid grid-cols-3 gap-4 mb-8 p-4 rounded-lg"
        style={{ background: 'var(--card)', border: '1px solid var(--border)' }}
      >
        {stats.map(({ value, label }) => (
          <div key={label} className="text-center">
            <p
              className="font-mono text-2xl font-bold"
              style={{ color: 'var(--amber)', fontVariantNumeric: 'tabular-nums' }}
            >
              {value}
            </p>
            <p className="text-xs mt-0.5" style={{ color: 'var(--sage)' }}>
              {label}
            </p>
          </div>
        ))}
      </div>

      {/* Quick actions */}
      <h2
        className="font-heading text-base font-semibold mb-3"
        style={{ color: 'var(--mist)', letterSpacing: '-0.01em' }}
      >
        Quick actions
      </h2>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: 'Upload transcript', href: '/upload', icon: Upload },
          { label: 'Example bank', href: '/examples', icon: BookMarked },
          { label: 'Match a job spec', href: '/match', icon: LayoutDashboard },
          { label: 'Check consistency', href: '/consistency', icon: GitBranch },
        ].map(({ label, href, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className="flex flex-col items-center gap-2 p-4 rounded-lg text-center transition-colors duration-100"
            style={{
              background: 'var(--card)',
              border: '1px solid var(--border)',
            }}
          >
            <Icon size={20} strokeWidth={1.5} style={{ color: 'var(--amber)' }} />
            <span className="text-xs font-medium" style={{ color: 'var(--mist)' }}>
              {label}
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
