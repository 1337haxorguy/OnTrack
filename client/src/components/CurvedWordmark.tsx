const LETTERS = [
  { ch: "O", cx: 54.73,  cy: 66.89, r: -24.25, sk: -4.01 },
  { ch: "N", cx: 85.15,  cy: 50.56, r: -17.66, sk: -3.05 },
  { ch: "T", cx: 129.68, cy: 44.33, r:   6.77, sk:  1.22 },
  { ch: "R", cx: 159.22, cy: 52.44, r:   6.77, sk:  1.22 },
  { ch: "A", cx: 189.69, cy: 53.98, r:   6.77, sk:  1.22 },
  { ch: "C", cx: 221.08, cy: 52.40, r:  -8.26, sk: -1.48 },
  { ch: "K", cx: 254.24, cy: 35.58, r: -27.61, sk: -4.43 },
];

export default function CurvedWordmark({ scale = 1 }: { scale?: number }) {
  return (
    <svg viewBox="0 0 280 100" height={62 * scale}
      style={{ width: "auto", display: "block", overflow: "visible", userSelect: "none" }}
      aria-label="ON TRACK"
    >
      {LETTERS.map(({ ch, cx, cy, r, sk }) => (
        <text key={ch} x="0" y="0" textAnchor="middle" dominantBaseline="central"
          fontFamily="Epilogue, sans-serif" fontWeight="700" fontSize="48"
          fill="currentColor" letterSpacing="-1.44"
          transform={`translate(${cx},${cy}) skewX(${sk}) rotate(${r})`}
        >{ch}</text>
      ))}
    </svg>
  );
}
