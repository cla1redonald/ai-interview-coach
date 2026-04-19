interface RadarDimension {
  label: string;
  score: number; // 1-10
}

interface RadarChartProps {
  dimensions: RadarDimension[];
  size?: number;
}

export function RadarChart({ dimensions, size = 240 }: RadarChartProps) {
  const n = dimensions.length;
  if (n === 0) return null;

  const centre = size / 2;
  const radius = centre - 28; // 28px padding for labels

  // Score 1-10 → 0-1 scale mapped onto radius
  const scoreToR = (score: number) => (score / 10) * radius;

  // Angle for spoke i: start from top (−π/2) and go clockwise
  const angle = (i: number) => (2 * Math.PI * i) / n - Math.PI / 2;

  // Point on spoke for a given score
  const point = (i: number, score: number) => {
    const r = scoreToR(score);
    const a = angle(i);
    return {
      x: centre + r * Math.cos(a),
      y: centre + r * Math.sin(a),
    };
  };

  // Outer spoke tip (at 100%)
  const spokeTip = (i: number) => {
    const a = angle(i);
    return {
      x: centre + radius * Math.cos(a),
      y: centre + radius * Math.sin(a),
    };
  };

  // Label position at 110% of radius
  const labelPos = (i: number) => {
    const a = angle(i);
    const r = radius * 1.12;
    return {
      x: centre + r * Math.cos(a),
      y: centre + r * Math.sin(a),
    };
  };

  // Text anchor based on x-position relative to centre
  const textAnchor = (i: number): 'start' | 'middle' | 'end' => {
    const lx = labelPos(i).x;
    if (lx < centre - 4) return 'end';
    if (lx > centre + 4) return 'start';
    return 'middle';
  };

  // Build data polygon path
  const dataPoints = dimensions.map((d, i) => point(i, d.score));
  const dataPath = dataPoints
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(2)},${p.y.toFixed(2)}`)
    .join(' ') + ' Z';

  // Ring percentages: 25%, 50%, 75%
  const rings = [0.25, 0.5, 0.75];

  // Build a ring polygon at a given fraction of radius
  const ringPath = (fraction: number) => {
    const pts = Array.from({ length: n }, (_, i) => {
      const a = angle(i);
      const r = radius * fraction;
      return `${i === 0 ? 'M' : 'L'} ${(centre + r * Math.cos(a)).toFixed(2)},${(centre + r * Math.sin(a)).toFixed(2)}`;
    });
    return pts.join(' ') + ' Z';
  };

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      aria-hidden="true"
      role="img"
    >
      <title>Fit dimension scores radar chart</title>
      <desc>
        Radar chart showing 8 fit dimensions scored 1 to 10:{' '}
        {dimensions.map((d) => `${d.label} ${d.score}`).join(', ')}
      </desc>

      {/* Background rings */}
      {rings.map((fraction) => (
        <path
          key={fraction}
          d={ringPath(fraction)}
          fill="none"
          stroke="var(--border)"
          strokeOpacity={0.4}
          strokeWidth={1}
        />
      ))}

      {/* Spoke lines */}
      {dimensions.map((_, i) => {
        const tip = spokeTip(i);
        return (
          <line
            key={i}
            x1={centre}
            y1={centre}
            x2={tip.x.toFixed(2)}
            y2={tip.y.toFixed(2)}
            stroke="var(--border)"
            strokeOpacity={0.4}
            strokeWidth={1}
          />
        );
      })}

      {/* Data polygon fill */}
      <path
        d={dataPath}
        fill="rgba(226,160,57,0.18)"
        stroke="var(--amber)"
        strokeWidth={1.5}
      />

      {/* Data point circles */}
      {dataPoints.map((p, i) => (
        <circle
          key={i}
          cx={p.x.toFixed(2)}
          cy={p.y.toFixed(2)}
          r={3}
          fill="var(--amber)"
        />
      ))}

      {/* Labels */}
      {dimensions.map((d, i) => {
        const lp = labelPos(i);
        const anchor = textAnchor(i);
        return (
          <text
            key={i}
            x={lp.x.toFixed(2)}
            y={lp.y.toFixed(2)}
            textAnchor={anchor}
            dominantBaseline="middle"
            fontSize={10}
            fill="var(--sage)"
            fontFamily="system-ui, sans-serif"
          >
            {d.label}
          </text>
        );
      })}
    </svg>
  );
}
