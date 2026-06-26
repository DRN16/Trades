export default function CriteriaBadge({ label, met }: { label: string; met: boolean }) {
  return (
    <span
      className={`inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full border ${
        met ? "border-good text-good" : "border-gray-600 text-gray-500"
      }`}
    >
      {met ? "✅" : "—"} {label}
    </span>
  );
}
