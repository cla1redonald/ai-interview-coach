import { UploadForm } from '@/components/storybank/UploadForm';

export default function UploadPage() {
  return (
    <div className="max-w-2xl">
      <h1
        className="font-heading text-3xl font-bold mb-2"
        style={{ color: 'var(--mist)', letterSpacing: '-0.01em' }}
      >
        Upload Transcript
      </h1>
      <p className="text-sm mb-8" style={{ color: 'var(--sage)' }}>
        Paste or drop a transcript to extract Q&amp;A pairs and add them to your bank.
      </p>

      <UploadForm />
    </div>
  );
}
