'use client';

import { useState } from 'react';
import { ContentType } from '@/lib/types';

interface SubmitModalProps {
  onClose: () => void;
  user: any | null;
  onAuthClick: () => void;
}

export default function SubmitModal({ onClose, user, onAuthClick }: SubmitModalProps) {
  const [url, setUrl] = useState('');
  const [contentType, setContentType] = useState<ContentType>('article');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ message: string; success: boolean } | null>(null);

  const handleSubmit = async () => {
    if (!user) {
      onAuthClick();
      return;
    }
    if (!url) return;

    setLoading(true);
    try {
      const res = await fetch('/api/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, content_type: contentType, user_id: user.id }),
      });
      const data = await res.json();
      if (res.ok) {
        setResult({ message: data.message, success: true });
      } else {
        setResult({ message: data.error, success: false });
      }
    } catch {
      setResult({ message: 'Something went wrong', success: false });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal modal-open" onClick={onClose}>
      <div className="modal-box max-w-md" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-lg font-bold">Submit Content</h3>

        {result ? (
          <div className="mt-4">
            <div className={`alert ${result.success ? 'alert-success' : 'alert-error'} text-sm`}>
              {result.message}
            </div>
            <button onClick={onClose} className="btn btn-block btn-sm mt-4">
              Close
            </button>
          </div>
        ) : (
          <div className="mt-4 space-y-4">
            <div>
              <label className="text-sm font-semibold text-base-content/60 block mb-1">URL</label>
              <input
                type="url" placeholder="https://..."
                value={url} onChange={(e) => setUrl(e.target.value)}
                className="input input-bordered input-sm w-full"
              />
            </div>

            <div>
              <label className="text-sm font-semibold text-base-content/60 block mb-2">
                Content Type
              </label>
              <div className="flex gap-2">
                {(['article', 'video', 'podcast'] as ContentType[]).map((t) => (
                  <button
                    key={t}
                    onClick={() => setContentType(t)}
                    className={`btn btn-sm capitalize ${
                      contentType === t ? 'btn-primary' : 'btn-ghost'
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>

            <p className="text-xs text-base-content/40 leading-relaxed">
              Our AI will generate a summary and check quality. Your submission appears in
              the feed if it meets the quality threshold.
            </p>

            <div className="flex gap-2 justify-end">
              <button onClick={onClose} className="btn btn-ghost btn-sm">Cancel</button>
              <button
                onClick={handleSubmit}
                disabled={loading || !url}
                className="btn btn-primary btn-sm font-semibold"
              >
                {loading ? <span className="loading loading-spinner loading-xs" /> : null}
                Submit
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
