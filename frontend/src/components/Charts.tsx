// Small dependency-free SVG charts (line + bar), themed via CSS variables and readable by screen readers.
export interface Point {
  label: string;
  value: number;
}

const W = 320;
const H = 150;
const PAD = { top: 16, right: 12, bottom: 26, left: 30 };

function scale(values: number[], min?: number, max?: number) {
  const lo = min ?? Math.min(...values);
  const hi = max ?? Math.max(...values);
  const span = hi - lo || 1;
  return { lo, hi, y: (v: number) => PAD.top + (1 - (v - lo) / span) * (H - PAD.top - PAD.bottom) };
}

function Axis({ lo, hi }: { lo: number; hi: number }) {
  const fmt = (v: number) => (Math.abs(v) >= 100 ? Math.round(v) : Math.round(v * 10) / 10);
  return (
    <g fontSize="10" fill="var(--text-muted)">
      <text x={PAD.left - 6} y={PAD.top + 4} textAnchor="end">
        {fmt(hi)}
      </text>
      <text x={PAD.left - 6} y={H - PAD.bottom} textAnchor="end">
        {fmt(lo)}
      </text>
      <line x1={PAD.left} x2={W - PAD.right} y1={H - PAD.bottom} y2={H - PAD.bottom} stroke="var(--border)" />
    </g>
  );
}

/** `title` is announced to screen readers; points are also listed in a visually hidden table. */
export function LineChart({ data, title, min, max }: { data: Point[]; title: string; min?: number; max?: number }) {
  if (data.length === 0) return null;
  const { lo, hi, y } = scale(data.map((d) => d.value), min, max);
  const x = (i: number) => PAD.left + (data.length === 1 ? (W - PAD.left - PAD.right) / 2 : (i / (data.length - 1)) * (W - PAD.left - PAD.right));
  const path = data.map((d, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(d.value).toFixed(1)}`).join(' ');
  const labelEvery = Math.max(1, Math.ceil(data.length / 5));
  return (
    <figure style={{ margin: 0 }}>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label={title} style={{ maxHeight: 220 }}>
        <Axis lo={lo} hi={hi} />
        <path d={path} fill="none" stroke="var(--primary)" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
        {data.map((d, i) => (
          <circle key={i} cx={x(i)} cy={y(d.value)} r={data.length > 20 ? 0 : 3.5} fill="var(--primary)" />
        ))}
        <g fontSize="9.5" fill="var(--text-muted)" textAnchor="middle">
          {data.map((d, i) => (i % labelEvery === 0 || i === data.length - 1 ? <text key={i} x={x(i)} y={H - 8}>{d.label}</text> : null))}
        </g>
      </svg>
      <DataTable data={data} title={title} />
    </figure>
  );
}

export function BarChart({ data, title }: { data: Point[]; title: string }) {
  if (data.length === 0) return null;
  const { y } = scale([0, ...data.map((d) => d.value)], 0);
  const slot = (W - PAD.left - PAD.right) / data.length;
  const bw = Math.min(34, slot * 0.6);
  return (
    <figure style={{ margin: 0 }}>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label={title} style={{ maxHeight: 220 }}>
        <line x1={PAD.left} x2={W - PAD.right} y1={H - PAD.bottom} y2={H - PAD.bottom} stroke="var(--border)" />
        {data.map((d, i) => {
          const cx = PAD.left + slot * i + slot / 2;
          const top = y(d.value);
          return (
            <g key={i}>
              <rect x={cx - bw / 2} y={top} width={bw} height={H - PAD.bottom - top} rx="5" fill="var(--period)" />
              <text x={cx} y={top - 4} fontSize="10" textAnchor="middle" fill="var(--text)">
                {d.value}
              </text>
              <text x={cx} y={H - 8} fontSize="9.5" textAnchor="middle" fill="var(--text-muted)">
                {d.label}
              </text>
            </g>
          );
        })}
      </svg>
      <DataTable data={data} title={title} />
    </figure>
  );
}

function DataTable({ data, title }: { data: Point[]; title: string }) {
  return (
    <table className="visually-hidden">
      <caption>{title}</caption>
      <tbody>
        {data.map((d, i) => (
          <tr key={i}>
            <th scope="row">{d.label}</th>
            <td>{d.value}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
