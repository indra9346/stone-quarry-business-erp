import { useId } from 'react'
import { cn } from '@/lib/utils'

interface BackdropProps {
  className?: string
  compact?: boolean
  image?: string
  position?: string
}

/**
 * Pure creamy & gold industrial backdrop:
 * Static, elegant, high-contrast, zero video, zero distracting animation.
 * Features warm ivory and champagne gold gradients over subtle terraced stone geometry.
 */
export default function Backdrop({
  className,
  compact = false,
  image,
  position = 'center',
}: BackdropProps) {
  const uid = useId().replace(/:/g, '')

  return (
    <div
      aria-hidden
      className={cn(
        'pointer-events-none absolute inset-0 overflow-hidden bg-[#faf7f2]',
        className,
      )}
    >
      {/* Creamy & Gold Artwork */}
      <svg className="absolute inset-0 h-full w-full" viewBox="0 0 1600 900" preserveAspectRatio="xMidYMax slice">
        <defs>
          <linearGradient id={`${uid}creamSky`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#fdfbf7" />
            <stop offset="0.4" stopColor="#f7f1e3" />
            <stop offset="0.75" stopColor="#ede0c4" />
            <stop offset="1" stopColor="#dfcb9f" />
          </linearGradient>

          <radialGradient id={`${uid}goldGlow`} cx="0.8" cy="0.2" r="0.6">
            <stop offset="0" stopColor="#fae5a3" stopOpacity="0.8" />
            <stop offset="0.35" stopColor="#eed07a" stopOpacity="0.45" />
            <stop offset="0.7" stopColor="#d4af37" stopOpacity="0.15" />
            <stop offset="1" stopColor="#d4af37" stopOpacity="0" />
          </radialGradient>

          <linearGradient id={`${uid}goldWall1`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#e5c875" />
            <stop offset="1" stopColor="#c59b27" />
          </linearGradient>

          <linearGradient id={`${uid}goldWall2`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#d8b456" />
            <stop offset="1" stopColor="#a87a15" />
          </linearGradient>

          <linearGradient id={`${uid}creamWallNear`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#dfccaa" />
            <stop offset="0.5" stopColor="#c7b088" />
            <stop offset="1" stopColor="#ab946b" />
          </linearGradient>

          <filter id={`${uid}grain`} x="0" y="0" width="100%" height="100%">
            <feTurbulence type="fractalNoise" baseFrequency="0.8" numOctaves="2" stitchTiles="stitch" />
            <feColorMatrix values="0 0 0 0 0.8  0 0 0 0 0.7  0 0 0 0 0.45  0 0 0 0.05 0" />
          </filter>
        </defs>

        {/* Sky */}
        <rect width="1600" height="900" fill={`url(#${uid}creamSky)`} />
        {/* Golden Sun Glow */}
        <rect width="1600" height="900" fill={`url(#${uid}goldGlow)`} />

        {/* Distant Quarry Terraces - Warm Champagne Gold */}
        <path
          d="M-100 520 L140 485 L280 500 L440 450 L590 470 L720 420 L900 445 L1040 405 L1200 435 L1380 390 L1520 415 L1700 375 L1700 900 L-100 900Z"
          fill={`url(#${uid}goldWall1)`}
          opacity="0.35"
        />

        {/* Mid Terraces - Muted Golden Bronze */}
        <path
          d="M-100 600 L160 565 L320 575 L500 525 L680 545 L850 500 L1020 525 L1210 485 L1400 515 L1700 470 L1700 900 L-100 900Z"
          fill={`url(#${uid}goldWall2)`}
          opacity="0.45"
        />

        {/* Near Quarry Terraces - Warm Sandstone Cream */}
        <path
          d="M-100 690 L150 660 L310 670 L490 630 L660 645 L840 610 L1020 630 L1200 595 L1400 620 L1700 580 L1700 900 L-100 900Z"
          fill={`url(#${uid}creamWallNear)`}
          opacity="0.65"
        />

        {/* Cut Granite & Marble Blocks in Pit - Warm Cream & Gold Tops */}
        <g opacity="0.85">
          {[
            [40, 770, 150, 62],
            [200, 782, 120, 50],
            [330, 764, 170, 68],
            [520, 786, 130, 46],
            [1050, 772, 160, 60],
            [1230, 786, 120, 46],
            [1370, 758, 190, 74],
            [90, 715, 110, 56],
            [370, 700, 120, 62],
            [1100, 712, 120, 58],
            [1410, 690, 130, 70],
          ].map(([x, y, w, h], i) => (
            <g key={i}>
              <rect x={x} y={y} width={w} height={h} fill="#cfbe9b" />
              {/* Gold Top highlight */}
              <rect x={x} y={y} width={w} height={5} fill="#e5c875" />
              {/* Side bevel */}
              <rect x={x} y={y} width={4} height={h} fill="#ffffff" opacity="0.4" />
            </g>
          ))}
        </g>

        {/* Subtle Warm Texture */}
        <rect width="1600" height="900" filter={`url(#${uid}grain)`} opacity="0.08" />
      </svg>

      {/* Optional Static Photo with Soft Creamy Golden Blend */}
      {image && (
        <div className="absolute inset-0 overflow-hidden mix-blend-multiply opacity-25">
          <img
            src={image}
            alt=""
            decoding="async"
            className="h-full w-full object-cover"
            style={{ objectPosition: position }}
            onError={(e) => (e.currentTarget.style.display = 'none')}
          />
        </div>
      )}

      {/* Cream & Gold Ambient Overlays */}
      <div
        className={cn(
          'absolute inset-0 bg-gradient-to-b',
          compact
            ? 'from-[#faf7f2]/80 via-transparent to-[#faf7f2]/90'
            : 'from-[#faf7f2]/70 via-transparent to-[#faf7f2]/95',
        )}
      />
      <div className="absolute inset-0 bg-radial from-transparent via-[#fae5a3]/10 to-[#d4af37]/15" />
    </div>
  )
}
