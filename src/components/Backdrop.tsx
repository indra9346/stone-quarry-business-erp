import { useId, useState, useRef } from 'react'
import { cn } from '@/lib/utils'
import ParallaxPhoto from './ParallaxPhoto'
import Quarry3DScene from './Quarry3DScene'
import { Video, Activity } from 'lucide-react'

interface BackdropProps {
  className?: string
  video?: string
  image?: string
  compact?: boolean
  position?: string
  smoke?: boolean
  showPromotionalBadges?: boolean
}

/**
 * Realistic 3D Quarry Background with video playback, interactive 3D digital
 * twin simulation, sunlit rock terraces, and promotional advertising HUD.
 * Completely non-black: uses daylight skies, warm granite, golden sunbeams,
 * and crystalline glass surfaces.
 */
export default function Backdrop({
  className,
  video = 'quarry-gateway',
  image,
  compact = false,
  position = 'center',
  smoke = true,
  showPromotionalBadges = false,
}: BackdropProps) {
  const uid = useId().replace(/:/g, '')
  const [videoLoaded, setVideoLoaded] = useState(false)
  const [videoFailed, setVideoFailed] = useState(false)
  const [mode, setMode] = useState<'video' | '3d' | 'photo'>('video')
  const videoRef = useRef<HTMLVideoElement | null>(null)

  const showSmoke = !!image && !compact && smoke !== false

  // High quality open quarry drone / heavy machinery video sources
  const videoSources = [
    `/media/${video}.mp4`,
    `/media/${video}.webm`,
    'https://upload.wikimedia.org/wikipedia/commons/transcoded/e/e9/Skydio2_Drone_Flight_Over_Fisk_Quarry_Preserve.webm/Skydio2_Drone_Flight_Over_Fisk_Quarry_Preserve.webm.360p.vp9.webm',
  ]

  return (
    <div
      aria-hidden
      className={cn(
        'pointer-events-none absolute inset-0 overflow-hidden bg-gradient-to-b from-sky-100/90 via-amber-50/80 to-stone-200',
        className,
      )}
    >
      {/* Layer 1: Sunlit Terraced Granite / Marble Quarry Artwork (Daylight SVG, zero black) */}
      <svg className="absolute inset-0 h-full w-full" viewBox="0 0 1600 900" preserveAspectRatio="xMidYMax slice">
        <defs>
          <linearGradient id={`${uid}sky`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#93c5fd" /> {/* bright sky azure */}
            <stop offset="0.45" stopColor="#dbeafe" />
            <stop offset="0.75" stopColor="#fef3c7" /> {/* golden daylight horizon */}
            <stop offset="1" stopColor="#fde68a" stopOpacity="0.9" />
          </linearGradient>
          <radialGradient id={`${uid}sun`} cx="0.75" cy="0.25" r="0.45">
            <stop offset="0" stopColor="#ffffff" stopOpacity="0.9" />
            <stop offset="0.25" stopColor="#fef08a" stopOpacity="0.6" />
            <stop offset="0.7" stopColor="#f59e0b" stopOpacity="0.15" />
            <stop offset="1" stopColor="#f59e0b" stopOpacity="0" />
          </radialGradient>
          <linearGradient id={`${uid}wallFar`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#b45309" />
            <stop offset="1" stopColor="#78350f" />
          </linearGradient>
          <linearGradient id={`${uid}wallNear`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#a8a29e" />
            <stop offset="0.5" stopColor="#78716c" />
            <stop offset="1" stopColor="#57534e" />
          </linearGradient>
          <filter id={`${uid}grain`} x="0" y="0" width="100%" height="100%">
            <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" stitchTiles="stitch" />
            <feColorMatrix values="0 0 0 0 0.4  0 0 0 0 0.35  0 0 0 0 0.3  0 0 0 0.05 0" />
          </filter>
        </defs>

        <rect width="1600" height="900" fill={`url(#${uid}sky)`} />
        <rect width="1600" height="900" fill={`url(#${uid}sun)`} className="animate-sun" />

        {/* Far Terraces - Sunlit Warm Sandstone & Granite */}
        <g className="animate-drift-slow" opacity="0.85">
          <path
            d="M-100 560 L120 520 L260 535 L420 480 L560 500 L700 440 L880 470 L1010 430 L1180 460 L1350 415 L1500 440 L1700 400 L1700 900 L-100 900Z"
            fill="#d97706"
            opacity="0.35"
          />
          <path
            d="M-100 620 L180 590 L330 600 L520 550 L700 570 L860 530 L1040 555 L1220 520 L1400 545 L1700 505 L1700 900 L-100 900Z"
            fill="#92400e"
            opacity="0.45"
          />
        </g>

        {/* Near Terraces - Stepped Cut Granite Walls */}
        <g className="animate-drift" opacity="0.9">
          <path
            d="M-100 680 L140 650 L300 660 L470 620 L640 635 L820 600 L1000 620 L1180 585 L1380 610 L1700 570 L1700 900 L-100 900Z"
            fill={`url(#${uid}wallNear)`}
          />
        </g>

        {/* Stacked Cut Granite & Marble Blocks */}
        <g>
          {[
            [40, 750, 150, 62],
            [200, 762, 120, 50],
            [330, 744, 170, 68],
            [520, 766, 130, 46],
            [1050, 752, 160, 60],
            [1230, 766, 120, 46],
            [1370, 738, 190, 74],
            [90, 695, 110, 56],
            [370, 680, 120, 62],
            [1100, 692, 120, 58],
            [1410, 670, 130, 70],
          ].map(([x, y, w, h], i) => (
            <g key={i}>
              <rect x={x} y={y} width={w} height={h} fill="#78716c" />
              <rect x={x} y={y} width={w} height={6} fill="#f59e0b" opacity="0.6" />
              <rect x={x} y={y} width={4} height={h} fill="#ffffff" opacity="0.25" />
            </g>
          ))}
        </g>

        <rect width="1600" height="900" filter={`url(#${uid}grain)`} opacity="0.06" />
      </svg>

      {/* Layer 2: Real High-Definition Looping Quarry Video */}
      {!videoFailed && mode !== 'photo' && (
        <video
          ref={videoRef}
          className={cn(
            'absolute inset-0 h-full w-full object-cover transition-opacity duration-1000 motion-reduce:hidden',
            videoLoaded ? 'opacity-85' : 'opacity-0',
          )}
          autoPlay
          muted
          loop
          playsInline
          preload="auto"
          onLoadedData={() => setVideoLoaded(true)}
          onError={() => {
            setVideoFailed(true)
            setMode('3d')
          }}
        >
          {videoSources.map((src, idx) => (
            <source key={idx} src={src} type={src.endsWith('.webm') ? 'video/webm' : 'video/mp4'} />
          ))}
        </video>
      )}

      {/* Layer 3: Interactive 3D Quarry Digital Twin Simulation (Canvas) */}
      <Quarry3DScene
        intensity={videoLoaded ? 0.45 : 1}
        ambientOnly={compact}
        showTelemetry={!compact}
        className={cn('transition-opacity duration-1000', mode === 'photo' ? 'opacity-0' : 'opacity-90')}
      />

      {/* Layer 4: Real Photo Blend with Parallax Camera */}
      {image && !compact && (
        <img
          src={image}
          alt=""
          aria-hidden
          decoding="async"
          className="absolute inset-0 h-full w-full scale-125 object-cover opacity-45 blur-2xl md:hidden"
          onError={(e) => (e.currentTarget.style.display = 'none')}
        />
      )}

      {image && (
        <div
          className={cn(
            'absolute inset-x-0 top-0 overflow-hidden mix-blend-multiply opacity-75',
            compact
              ? 'inset-0'
              : 'aspect-[1.3] [mask-image:linear-gradient(to_bottom,#000_65%,transparent)] md:inset-0 md:aspect-auto md:[mask-image:none]',
          )}
        >
          {compact ? (
            <img
              src={image}
              alt=""
              decoding="async"
              className="h-full w-full animate-kenburns object-cover md:[object-position:var(--pos)]"
              style={{ ['--pos' as string]: position }}
              onError={(e) => (e.currentTarget.style.display = 'none')}
            />
          ) : (
            <ParallaxPhoto src={image} position={position} mobilePosition="62% 50%" />
          )}
          {showSmoke && <Smoke />}
        </div>
      )}

      {/* Golden Sun Dust Motes */}
      {!compact &&
        Array.from({ length: 18 }, (_, i) => (
          <span
            key={i}
            className="absolute rounded-full bg-amber-400/60 shadow-[0_0_8px_rgba(245,158,11,0.6)] animate-dust"
            style={{
              left: `${(i * 61) % 100}%`,
              bottom: `${(i * 43) % 50}%`,
              width: 3 + (i % 3),
              height: 3 + (i % 3),
              animationDelay: `${(i * 1.1) % 8}s`,
              animationDuration: `${9 + (i % 4) * 3}s`,
            }}
          />
        ))}

      {/* Layer 5: Luminous Warm Ambient Overlays (Zero pure black! Soft daylight stone gradients) */}
      <div
        className={cn(
          'absolute inset-0 bg-gradient-to-b',
          compact
            ? 'from-slate-900/35 via-transparent to-slate-900/55'
            : 'from-slate-900/30 via-slate-900/10 to-stone-900/40',
        )}
      />
      <div className="absolute inset-0 bg-gradient-to-r from-slate-900/40 via-transparent to-amber-900/15" />

      {/* Software Promotional & Advertising HUD Overlay */}
      {showPromotionalBadges && !compact && (
        <div className="pointer-events-auto absolute bottom-4 right-4 z-10 hidden items-center gap-2 rounded-full border border-white/40 bg-white/80 px-3.5 py-1.5 shadow-lg backdrop-blur-md transition-all hover:bg-white sm:flex">
          <span className="flex h-2 w-2 relative">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
          </span>
          <span className="text-[11px] font-semibold tracking-wide text-slate-800">
            3D Quarry Twin · Live Telemetry
          </span>
          <div className="h-3 w-px bg-stone-300 mx-0.5" />
          <button
            onClick={() => setMode((m) => (m === 'video' ? '3d' : 'video'))}
            className="flex items-center gap-1 text-[11px] font-medium text-amber-700 hover:text-amber-900 cursor-pointer"
            title="Toggle between real video footage and 3D simulation"
          >
            {mode === 'video' ? <Video className="h-3 w-3" /> : <Activity className="h-3 w-3" />}
            {mode === 'video' ? 'Video View' : '3D Sim'}
          </button>
        </div>
      )}
    </div>
  )
}

/**
 * Natural quarry dust and atmospheric haze
 */
const SMOKE_SIZE: Record<string, [number, number]> = {
  '/media/smoke-a.webp': [1400, 480],
  '/media/smoke-b.webp': [1100, 520],
  '/media/smoke-c.webp': [760, 940],
}

function Plume({
  src,
  box,
  anim,
  delay,
  flip,
}: {
  src: string
  box: string
  anim: string
  delay: string
  flip?: boolean
}) {
  return (
    <div className={`pointer-events-none absolute motion-reduce:hidden ${box} ${flip ? '-scale-x-100' : ''}`} aria-hidden>
      <img
        src={src}
        alt=""
        width={SMOKE_SIZE[src]?.[0]}
        height={SMOKE_SIZE[src]?.[1]}
        decoding="async"
        className={`h-auto w-full mix-blend-screen will-change-transform opacity-0 ${anim}`}
        style={{ animationDelay: delay }}
        onError={(e) => (e.currentTarget.style.display = 'none')}
      />
    </div>
  )
}

function Smoke() {
  return (
    <>
      <Plume
        src="/media/smoke-c.webp"
        box="left-[11%] top-[-22%] w-[30%] md:left-[25%] md:top-[-7.5%] md:w-[14%]"
        anim="animate-rise-a"
        delay="-4s"
      />
      <Plume
        src="/media/smoke-c.webp"
        box="hidden md:block md:left-[47%] md:top-[25%] md:w-[12%]"
        anim="animate-rise-c"
        delay="-14s"
        flip
      />
      <Plume
        src="/media/smoke-b.webp"
        box="left-[45%] top-[-4%] w-[50%] md:left-[44%] md:top-[-2%] md:w-[26%]"
        anim="animate-smoke-b"
        delay="-30s"
      />
      <Plume
        src="/media/smoke-a.webp"
        box="left-[62%] top-[8%] w-[55%] md:left-[72%] md:top-[6%] md:w-[40%]"
        anim="animate-smoke-a"
        delay="-12s"
        flip
      />
      <Plume
        src="/media/smoke-a.webp"
        box="left-[15%] top-[45%] w-[80%] md:left-[28%] md:top-[34%] md:w-[55%]"
        anim="animate-smoke-c"
        delay="-40s"
      />
      <Plume
        src="/media/smoke-b.webp"
        box="hidden md:block md:left-[40%] md:top-[40%] md:w-[45%]"
        anim="animate-smoke-b"
        delay="-55s"
        flip
      />
    </>
  )
}
