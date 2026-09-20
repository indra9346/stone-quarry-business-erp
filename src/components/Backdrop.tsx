import { useId } from 'react'
import { cn } from '@/lib/utils'

/**
 * Quarry backdrop drawn in SVG + CSS (no image or video download): a dawn sky
 * over terraced granite walls and stacked blocks, with slow parallax drift and a
 * few floating dust motes. It is decorative (aria-hidden), dark enough for white
 * text, and every animation stops under "reduce motion".
 *
 * An optional looping video (public/media/<name>.mp4) is layered on top when
 * VITE_BG_VIDEO=1 is set at build time; it is muted, never autoplays on phones'
 * data-saver, and falls back to this artwork if the file is missing.
 */
export default function Backdrop({ className, video, compact }: { className?: string; video?: string; compact?: boolean }) {
  const uid = useId().replace(/:/g, '')
  const withVideo = video && import.meta.env.VITE_BG_VIDEO === '1'
  return (
    <div aria-hidden className={cn('pointer-events-none absolute inset-0 overflow-hidden bg-navy-950', className)}>
      <svg className="absolute inset-0 h-full w-full" viewBox="0 0 1600 900" preserveAspectRatio="xMidYMax slice">
        <defs>
          <linearGradient id={`${uid}sky`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#0b0a09" />
            <stop offset="0.55" stopColor="#1c1714" />
            <stop offset="0.8" stopColor="#4a2f17" />
            <stop offset="1" stopColor="#c8871b" stopOpacity="0.9" />
          </linearGradient>
          <radialGradient id={`${uid}sun`} cx="0.72" cy="0.7" r="0.45">
            <stop offset="0" stopColor="#f2b544" stopOpacity="0.55" />
            <stop offset="1" stopColor="#f2b544" stopOpacity="0" />
          </radialGradient>
          <linearGradient id={`${uid}wall`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#3a3430" />
            <stop offset="1" stopColor="#15120f" />
          </linearGradient>
          <filter id={`${uid}grain`} x="0" y="0" width="100%" height="100%">
            <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" stitchTiles="stitch" />
            <feColorMatrix values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 0.5 0" />
          </filter>
        </defs>
        <rect width="1600" height="900" fill={`url(#${uid}sky)`} />
        <rect width="1600" height="900" fill={`url(#${uid}sun)`} className="animate-sun" />

        {/* far terraces */}
        <g className="animate-drift-slow" opacity="0.9">
          <path d="M-100 600 L120 560 L260 575 L420 520 L560 540 L700 480 L880 510 L1010 470 L1180 500 L1350 455 L1500 480 L1700 440 L1700 900 L-100 900Z" fill="#241f1b" />
          <path d="M-100 660 L180 630 L330 640 L520 590 L700 610 L860 570 L1040 595 L1220 560 L1400 585 L1700 545 L1700 900 L-100 900Z" fill="#2d2621" />
        </g>
        {/* near terraces */}
        <g className="animate-drift" opacity="0.95">
          <path d="M-100 720 L140 690 L300 700 L470 660 L640 675 L820 640 L1000 660 L1180 625 L1380 650 L1700 610 L1700 900 L-100 900Z" fill={`url(#${uid}wall)`} />
        </g>
        {/* stacked cut blocks */}
        <g>
          {[
            [40, 770, 150, 62], [200, 782, 120, 50], [330, 764, 170, 68], [520, 786, 130, 46], [1050, 772, 160, 60], [1230, 786, 120, 46], [1370, 758, 190, 74],
            [90, 715, 110, 56], [370, 700, 120, 62], [1100, 712, 120, 58], [1410, 690, 130, 70],
          ].map(([x, y, w, h], i) => (
            <g key={i}>
              <rect x={x} y={y} width={w} height={h} fill="#2a2420" />
              <rect x={x} y={y} width={w} height={6} fill="#4a4038" />
              <rect x={x} y={y} width={3} height={h} fill="#00000040" />
            </g>
          ))}
        </g>
        <rect width="1600" height="900" filter={`url(#${uid}grain)`} opacity="0.07" />
      </svg>

      {!compact &&
        Array.from({ length: 14 }, (_, i) => (
          <span
            key={i}
            className="absolute rounded-full bg-amber-400/40 animate-dust"
            style={{
              left: `${(i * 73) % 100}%`,
              bottom: `${(i * 37) % 40}%`,
              width: 2 + (i % 3),
              height: 2 + (i % 3),
              animationDelay: `${(i * 1.3) % 9}s`,
              animationDuration: `${10 + (i % 5) * 3}s`,
            }}
          />
        ))}

      {withVideo && (
        <video
          className="absolute inset-0 h-full w-full object-cover opacity-70 motion-reduce:hidden"
          src={`/media/${video}.mp4`}
          poster={`/media/${video}.jpg`}
          autoPlay
          muted
          loop
          playsInline
          preload="metadata"
          onError={(e) => (e.currentTarget.style.display = 'none')}
        />
      )}

      {/* keeps text readable */}
      <div className="absolute inset-0 bg-gradient-to-b from-navy-950/70 via-navy-950/30 to-navy-950/80" />
    </div>
  )
}
