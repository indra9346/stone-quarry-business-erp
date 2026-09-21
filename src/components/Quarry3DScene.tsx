import { useEffect, useRef } from 'react'

interface Quarry3DSceneProps {
  className?: string
  intensity?: number
  showTelemetry?: boolean
  ambientOnly?: boolean
}

/**
 * Realistic 3D Quarry Digital Twin & Promotional Simulation
 * Renders an interactive 3D open-pit granite/limestone quarry in daylight,
 * featuring stepped rock benches, active excavators, haul trucks, diamond wire
 * cutting saw rigs, golden volumetric sunbeams, and floating dust motes.
 */
export default function Quarry3DScene({
  className = '',
  intensity = 1,
  showTelemetry = true,
  ambientOnly = false,
}: Quarry3DSceneProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const mouseRef = useRef({ x: 0, y: 0, targetX: 0, targetY: 0 })

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d', { alpha: true })
    if (!ctx) return

    let animationFrameId: number
    let width = (canvas.width = canvas.parentElement?.clientWidth || window.innerWidth)
    let height = (canvas.height = canvas.parentElement?.clientHeight || window.innerHeight)

    const handleResize = () => {
      if (!canvas || !canvas.parentElement) return
      width = canvas.width = canvas.parentElement.clientWidth || window.innerWidth
      height = canvas.height = canvas.parentElement.clientHeight || window.innerHeight
    }

    const handleMouseMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect()
      const nx = ((e.clientX - rect.left) / rect.width) * 2 - 1
      const ny = ((e.clientY - rect.top) / rect.height) * 2 - 1
      mouseRef.current.targetX = nx * 25
      mouseRef.current.targetY = ny * 15
    }

    window.addEventListener('resize', handleResize)
    window.addEventListener('mousemove', handleMouseMove)

    // Particles for dust and sun motes
    interface DustMote {
      x: number
      y: number
      z: number
      vx: number
      vy: number
      size: number
      alpha: number
      pulse: number
    }

    const dustCount = ambientOnly ? 35 : 75
    const dustMotes: DustMote[] = Array.from({ length: dustCount }, () => ({
      x: Math.random() * width,
      y: Math.random() * height,
      z: Math.random() * 400 + 50,
      vx: (Math.random() - 0.5) * 0.4 + 0.25,
      vy: -Math.random() * 0.35 - 0.1,
      size: Math.random() * 3 + 1,
      alpha: Math.random() * 0.6 + 0.2,
      pulse: Math.random() * Math.PI * 2,
    }))

    // Vehicles traversing the quarry benches
    const trucks = [
      { progress: 0.15, speed: 0.0004, bench: 3, dir: 1, name: 'CAT 777 #01' },
      { progress: 0.58, speed: 0.00032, bench: 2, dir: -1, name: 'VOLVO R100 #04' },
      { progress: 0.82, speed: 0.00045, bench: 4, dir: 1, name: 'KOMATSU HD785 #02' },
    ]

    let time = 0

    const render = () => {
      time += 0.016
      // Smooth mouse follow
      mouseRef.current.x += (mouseRef.current.targetX - mouseRef.current.x) * 0.04
      mouseRef.current.y += (mouseRef.current.targetY - mouseRef.current.y) * 0.04

      const camX = mouseRef.current.x
      const camY = mouseRef.current.y

      ctx.clearRect(0, 0, width, height)

      // 1. Daylight Atmosphere: Warm sky gradient and sun flare
      const skyGrad = ctx.createLinearGradient(0, 0, 0, height)
      skyGrad.addColorStop(0, 'rgba(219, 234, 254, 0.45)') // daylight soft azure
      skyGrad.addColorStop(0.35, 'rgba(254, 243, 199, 0.4)') // golden sunlit haze
      skyGrad.addColorStop(0.7, 'rgba(245, 230, 211, 0.3)') // warm quarry sand
      skyGrad.addColorStop(1, 'rgba(230, 215, 195, 0.5)')
      ctx.fillStyle = skyGrad
      ctx.fillRect(0, 0, width, height)

      // 2. Volumetric Sunbeams (God Rays) from upper-right
      ctx.save()
      const sunX = width * 0.75 + camX * 0.5
      const sunY = height * 0.12 + camY * 0.3
      const numBeams = 6
      for (let i = 0; i < numBeams; i++) {
        const beamAngle = Math.PI * 0.65 + (i - numBeams / 2) * 0.12 + Math.sin(time * 0.2 + i) * 0.03
        const beamLength = Math.max(width, height) * 1.3
        const beamSpread = 0.18 + Math.sin(time * 0.3 + i * 1.5) * 0.04

        const p1x = sunX + Math.cos(beamAngle - beamSpread) * beamLength
        const p1y = sunY + Math.sin(beamAngle - beamSpread) * beamLength
        const p2x = sunX + Math.cos(beamAngle + beamSpread) * beamLength
        const p2y = sunY + Math.sin(beamAngle + beamSpread) * beamLength

        const beamGrad = ctx.createRadialGradient(sunX, sunY, 10, sunX, sunY, beamLength)
        beamGrad.addColorStop(0, 'rgba(254, 240, 138, 0.28)')
        beamGrad.addColorStop(0.4, 'rgba(253, 230, 138, 0.12)')
        beamGrad.addColorStop(1, 'rgba(253, 230, 138, 0.0)')

        ctx.beginPath()
        ctx.moveTo(sunX, sunY)
        ctx.lineTo(p1x, p1y)
        ctx.lineTo(p2x, p2y)
        ctx.closePath()
        ctx.fillStyle = beamGrad
        ctx.fill()
      }

      // Sun glow circle
      const sunGlow = ctx.createRadialGradient(sunX, sunY, 0, sunX, sunY, 220)
      sunGlow.addColorStop(0, 'rgba(255, 255, 255, 0.85)')
      sunGlow.addColorStop(0.2, 'rgba(254, 240, 138, 0.55)')
      sunGlow.addColorStop(0.6, 'rgba(251, 191, 36, 0.2)')
      sunGlow.addColorStop(1, 'rgba(251, 191, 36, 0)')
      ctx.fillStyle = sunGlow
      ctx.beginPath()
      ctx.arc(sunX, sunY, 220, 0, Math.PI * 2)
      ctx.fill()
      ctx.restore()

      // 3. 3D Terraced Quarry Pit (Open-pit Benches)
      // Stepped rock cliffs in perspective with granite strata textures
      const benches = [
        { yBase: height * 0.44, depth: 0.2, color: '#948b81', shadow: '#78716c', face: '#a8a29e', name: 'BENCH 01' },
        { yBase: height * 0.54, depth: 0.35, color: '#888077', shadow: '#716962', face: '#99928a', name: 'BENCH 02' },
        { yBase: height * 0.65, depth: 0.55, color: '#7a7269', shadow: '#625b53', face: '#8c847b', name: 'BENCH 03' },
        { yBase: height * 0.78, depth: 0.75, color: '#6d655c', shadow: '#564f47', face: '#7e756c', name: 'BENCH 04' },
        { yBase: height * 0.92, depth: 1.0, color: '#5e564d', shadow: '#474039', face: '#6f665d', name: 'PIT FLOOR' },
      ]

      benches.forEach((bench, bIdx) => {
        const offset = (bIdx - 2) * 6
        const yTop = bench.yBase + camY * bench.depth * 0.8
        const yFloor = yTop + (height * 0.12 * (1 + bench.depth * 0.3))

        ctx.save()
        // Rock Bench Vertical Cliff Face
        ctx.beginPath()
        ctx.moveTo(-50, yTop)

        // Jagged cut rock profile along the quarry bench
        const steps = 18
        const stepW = (width + 100) / steps
        for (let i = 0; i <= steps; i++) {
          const px = -50 + i * stepW
          const jitter = Math.sin(i * 1.8 + bIdx * 3) * 6 + Math.cos(i * 0.8) * 4
          ctx.lineTo(px, yTop + jitter)
        }

        ctx.lineTo(width + 50, yFloor)
        ctx.lineTo(-50, yFloor)
        ctx.closePath()

        // Bench vertical face gradient: sunlit top, shaded rock lower
        const faceGrad = ctx.createLinearGradient(0, yTop, 0, yFloor)
        faceGrad.addColorStop(0, bench.face)
        faceGrad.addColorStop(0.5, bench.color)
        faceGrad.addColorStop(1, bench.shadow)
        ctx.fillStyle = faceGrad
        ctx.fill()

        // Granite cut lines / Wire-saw cut marks
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)'
        ctx.lineWidth = 1
        for (let x = 30; x < width + 50; x += 75 + bIdx * 12) {
          ctx.beginPath()
          ctx.moveTo(x + offset, yTop)
          ctx.lineTo(x + offset + (bIdx * 4), yFloor)
          ctx.stroke()
        }

        // Horizontal bench roadway / terrace shelf
        ctx.fillStyle = bench.face
        ctx.fillRect(-50, yFloor - 5, width + 100, 10)
        ctx.strokeStyle = 'rgba(254, 243, 199, 0.25)'
        ctx.beginPath()
        ctx.moveTo(-50, yFloor)
        ctx.lineTo(width + 50, yFloor)
        ctx.stroke()

        // 4. Heavy Equipment on Benches
        // Excavator operating on Bench 03
        if (bIdx === 2 && !ambientOnly) {
          const excX = width * 0.28 + camX * 0.4
          const excY = yFloor - 8

          // Excavator chassis (CAT yellow / industrial amber)
          ctx.fillStyle = '#e8a227'
          ctx.fillRect(excX - 18, excY - 14, 36, 12)
          // Black continuous tracks (rich dark slate, non-black)
          ctx.fillStyle = '#334155'
          ctx.fillRect(excX - 22, excY - 4, 44, 7)
          // Cab
          ctx.fillStyle = '#e2e8f0'
          ctx.fillRect(excX - 8, excY - 24, 16, 12)
          ctx.fillStyle = '#38bdf8' // glass
          ctx.fillRect(excX - 6, excY - 22, 10, 8)

          // Articulated Boom & Arm animation
          const boomAngle = -0.6 + Math.sin(time * 1.4) * 0.25
          const armAngle = 0.9 + Math.cos(time * 1.4) * 0.35

          ctx.strokeStyle = '#e8a227'
          ctx.lineWidth = 4
          ctx.lineCap = 'round'

          // Boom
          const boomLen = 28
          const bEndX = excX + 8 + Math.cos(boomAngle) * boomLen
          const bEndY = excY - 16 + Math.sin(boomAngle) * boomLen

          ctx.beginPath()
          ctx.moveTo(excX + 8, excY - 16)
          ctx.lineTo(bEndX, bEndY)
          ctx.stroke()

          // Arm & Bucket
          const armLen = 22
          const aEndX = bEndX + Math.cos(armAngle) * armLen
          const aEndY = bEndY + Math.sin(armAngle) * armLen

          ctx.strokeStyle = '#c8871b'
          ctx.lineWidth = 3
          ctx.beginPath()
          ctx.moveTo(bEndX, bEndY)
          ctx.lineTo(aEndX, aEndY)
          ctx.stroke()

          // Bucket
          ctx.fillStyle = '#475569'
          ctx.beginPath()
          ctx.arc(aEndX, aEndY, 5, 0, Math.PI)
          ctx.fill()

          // Working dust puff from digging
          const dustSize = 12 + Math.sin(time * 4) * 4
          const dustAlpha = 0.3 + Math.sin(time * 3) * 0.15
          ctx.fillStyle = `rgba(254, 243, 199, ${dustAlpha})`
          ctx.beginPath()
          ctx.arc(aEndX + 4, aEndY + 2, dustSize, 0, Math.PI * 2)
          ctx.fill()

          // Telemetry pin for Excavator
          if (showTelemetry) {
            ctx.fillStyle = '#f59e0b'
            ctx.beginPath()
            ctx.arc(excX, excY - 32, 3, 0, Math.PI * 2)
            ctx.fill()

            ctx.strokeStyle = 'rgba(245, 158, 11, 0.7)'
            ctx.lineWidth = 1
            ctx.strokeRect(excX - 35, excY - 48, 70, 14)
            ctx.fillStyle = '#ffffff'
            ctx.font = '9px monospace'
            ctx.textAlign = 'center'
            ctx.fillText('CAT 390F · LIVE', excX, excY - 38)
          }
        }

        // Haul trucks moving across benches
        trucks.forEach((trk) => {
          if (trk.bench === bIdx && !ambientOnly) {
            trk.progress = (trk.progress + trk.speed * trk.dir + 1) % 1
            const trkX = trk.progress * (width + 200) - 100 + camX * 0.3
            const trkY = yFloor - 6

            // Haul truck body
            ctx.fillStyle = '#f59e0b' // yellow body
            ctx.fillRect(trkX - 16, trkY - 12, 32, 10)
            // Heavy off-road tires
            ctx.fillStyle = '#334155'
            ctx.beginPath()
            ctx.arc(trkX - 10, trkY - 1, 4, 0, Math.PI * 2)
            ctx.arc(trkX + 10, trkY - 1, 4, 0, Math.PI * 2)
            ctx.fill()
            // High dump bed carrying granite block
            ctx.fillStyle = '#cbd5e1'
            ctx.fillRect(trkX - 12, trkY - 17, 18, 6)

            // Hauler Telemetry
            if (showTelemetry && trk.bench === 3) {
              ctx.strokeStyle = 'rgba(59, 130, 246, 0.8)'
              ctx.lineWidth = 1
              ctx.strokeRect(trkX - 30, trkY - 28, 60, 12)
              ctx.fillStyle = '#ffffff'
              ctx.font = '8px monospace'
              ctx.textAlign = 'center'
              ctx.fillText(`${trk.name}`, trkX, trkY - 20)
            }
          }
        })

        // Telemetry bench marker
        if (showTelemetry && bIdx < 4) {
          const markerX = width * 0.86 + camX * 0.2
          ctx.fillStyle = 'rgba(255, 255, 255, 0.35)'
          ctx.font = '10px monospace'
          ctx.textAlign = 'right'
          ctx.fillText(`EL. +${(4 - bIdx) * 18}m · ${bench.name}`, markerX, yFloor - 8)
        }

        ctx.restore()
      })

      // 5. Stacked Cut Granite / Marble Blocks in pit stockyard (Foreground)
      ctx.save()
      const blockBaseY = height * 0.88 + camY * 0.9
      const blockClusters = [
        { x: width * 0.08, w: 55, h: 26 },
        { x: width * 0.14, w: 48, h: 22 },
        { x: width * 0.21, w: 62, h: 28 },
        { x: width * 0.74, w: 58, h: 24 },
        { x: width * 0.82, w: 65, h: 30 },
      ]

      blockClusters.forEach((b, i) => {
        const bx = b.x + camX * 0.6
        const by = blockBaseY - b.h
        // 3D Block Top (sunlit marble/granite)
        ctx.fillStyle = '#e2e8f0'
        ctx.beginPath()
        ctx.moveTo(bx, by)
        ctx.lineTo(bx + 14, by - 6)
        ctx.lineTo(bx + b.w + 14, by - 6)
        ctx.lineTo(bx + b.w, by)
        ctx.closePath()
        ctx.fill()

        // 3D Block Front Face
        ctx.fillStyle = i % 2 === 0 ? '#cbd5e1' : '#b8c5d6'
        ctx.fillRect(bx, by, b.w, b.h)

        // 3D Block Right Shaded Face
        ctx.fillStyle = '#94a3b8'
        ctx.beginPath()
        ctx.moveTo(bx + b.w, by)
        ctx.lineTo(bx + b.w + 14, by - 6)
        ctx.lineTo(bx + b.w + 14, by + b.h - 6)
        ctx.lineTo(bx + b.w, by + b.h)
        ctx.closePath()
        ctx.fill()

        // Barcode / ERP block serial tag
        ctx.fillStyle = '#f59e0b'
        ctx.fillRect(bx + 6, by + 6, 12, 6)
      })
      ctx.restore()

      // 6. Floating Sunlit Dust Particles & Motes
      ctx.save()
      dustMotes.forEach((mote) => {
        mote.x += mote.vx
        mote.y += mote.vy
        mote.pulse += 0.03

        if (mote.y < -10) mote.y = height + 10
        if (mote.x > width + 10) mote.x = -10

        const alpha = (Math.sin(mote.pulse) * 0.3 + 0.5) * mote.alpha * intensity
        ctx.fillStyle = `rgba(254, 240, 138, ${alpha})`
        ctx.beginPath()
        ctx.arc(mote.x + camX * (mote.z / 300), mote.y + camY * (mote.z / 300), mote.size, 0, Math.PI * 2)
        ctx.fill()
      })
      ctx.restore()

      // 7. Light warm vignette (NOT black!) - soft amber stone tint
      const vignette = ctx.createRadialGradient(
        width / 2,
        height / 2,
        Math.min(width, height) * 0.4,
        width / 2,
        height / 2,
        Math.max(width, height) * 0.8,
      )
      vignette.addColorStop(0, 'rgba(255, 255, 255, 0)')
      vignette.addColorStop(0.7, 'rgba(245, 158, 11, 0.04)')
      vignette.addColorStop(1, 'rgba(120, 113, 108, 0.18)')
      ctx.fillStyle = vignette
      ctx.fillRect(0, 0, width, height)

      animationFrameId = requestAnimationFrame(render)
    }

    render()

    return () => {
      window.removeEventListener('resize', handleResize)
      window.removeEventListener('mousemove', handleMouseMove)
      cancelAnimationFrame(animationFrameId)
    }
  }, [intensity, showTelemetry, ambientOnly])

  return (
    <div className={`pointer-events-none absolute inset-0 overflow-hidden ${className}`} aria-hidden>
      <canvas ref={canvasRef} className="h-full w-full object-cover" />
    </div>
  )
}
