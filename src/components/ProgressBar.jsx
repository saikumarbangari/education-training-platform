export default function ProgressBar({ value, label }) {
  return (
    <div className="progress-block">
      <div className="progress-label">
        <span>{label}</span>
        <strong>{value}%</strong>
      </div>
      <progress max="100" value={value} aria-label={`${label}: ${value}%`}>
        {value}%
      </progress>
    </div>
  );
}
