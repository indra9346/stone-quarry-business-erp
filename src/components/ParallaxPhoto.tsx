import { useEffect, useRef, useState } from 'react'
import { cn } from '@/lib/utils'

/**
 * The quarry photo with a slow "camera" that drifts sideways so the scene feels
 * three-dimensional: nearer rock moves more than the far hills. There is no real
 * depth information in a single photo, so depth is ESTIMATED (lower and darker parts
 * of the picture are treated as closer) and each pixel is shifted in proportion.
 * The shift is small, so it reads as parallax, not as distortion.
 *
 * Drawn with plain WebGL. If WebGL is unavailable, the picture fails to load, or the
 * visitor prefers reduced motion, it falls back to the ordinary still photo.
 */
const VERT = `
attribute vec2 aPos;
varying vec2 vUv;
void main() {
  vUv = vec2(aPos.x * 0.5 + 0.5, 0.5 - aPos.y * 0.5);
  gl_Position = vec4(aPos, 0.0, 1.0);
}`

const FRAG = `
precision mediump float;
uniform sampler2D uImg;
uniform sampler2D uDepth;
uniform vec2 uScale;
uniform vec2 uOffset;
uniform vec2 uCam;
uniform float uZoom;
varying vec2 vUv;
void main() {
  vec2 uv = (vUv - 0.5) / uZoom + 0.5;
  vec2 st = uv * uScale + uOffset;
  float d = texture2D(uDepth, st).r;
  vec2 p = clamp(st + uCam * (d - 0.4), vec2(0.001), vec2(0.999));
  gl_FragColor = texture2D(uImg, p);
}`

function parsePosition(pos: string): [number, number] {
  const parts = pos.trim().split(/\s+/)
  const one = (s: string | undefined) => {
    if (!s || s === 'center') return 0.5
    if (s === 'left' || s === 'top') return 0
    if (s === 'right' || s === 'bottom') return 1
    const n = parseFloat(s)
    return Number.isFinite(n) ? Math.min(1, Math.max(0, n / 100)) : 0.5
  }
  return [one(parts[0]), one(parts[1] ?? parts[0])]
}

/** Estimated depth: 0 = far, 1 = near. Low in the frame and dark = near; blurred so edges do not tear. */
function buildDepth(img: HTMLImageElement): { data: Uint8Array; w: number; h: number } {
  const w = 256
  const h = Math.max(64, Math.round((256 * img.naturalHeight) / img.naturalWidth))
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  const ctx = c.getContext('2d', { willReadFrequently: true })
  if (!ctx) throw new Error('no 2d context')
  ctx.drawImage(img, 0, 0, w, h)
  const px = ctx.getImageData(0, 0, w, h).data
  let depth = new Float32Array(w * h)
  for (let y = 0; y < h; y++) {
    const yn = y / (h - 1)
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4
      const lum = (0.2126 * px[i]! + 0.7152 * px[i + 1]! + 0.0722 * px[i + 2]!) / 255
      depth[y * w + x] = 0.1 + 0.72 * Math.pow(yn, 1.15) + 0.18 * (1 - lum)
    }
  }
  // Two passes of a box blur.
  for (let pass = 0; pass < 2; pass++) {
    const out = new Float32Array(w * h)
    const r = 5
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        let sum = 0
        let n = 0
        for (let dy = -r; dy <= r; dy += 2) {
          for (let dx = -r; dx <= r; dx += 2) {
            const xx = Math.min(w - 1, Math.max(0, x + dx))
            const yy = Math.min(h - 1, Math.max(0, y + dy))
            sum += depth[yy * w + xx]!
            n++
          }
        }
        out[y * w + x] = sum / n
      }
    }
    depth = out
  }
  const data = new Uint8Array(w * h)
  for (let i = 0; i < data.length; i++) data[i] = Math.round(Math.min(1, Math.max(0, depth[i]!)) * 255)
  return { data, w, h }
}

export default function ParallaxPhoto({
  src,
  position,
  mobilePosition,
  className,
}: {
  src: string
  /** object-position on wide screens, e.g. "65% 50%" */
  position: string
  /** object-position below the md breakpoint */
  mobilePosition: string
  className?: string
}) {
  const ref = useRef<HTMLCanvasElement>(null)
  const [fallback, setFallback] = useState(false)

  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduce) {
      setFallback(true)
      return
    }
    const gl = canvas.getContext('webgl', { antialias: false, alpha: false, powerPreference: 'low-power' })
    if (!gl) {
      setFallback(true)
      return
    }

    let raf = 0
    let alive = true
    let visible = true
    const pointer = { x: 0, y: 0, tx: 0, ty: 0 }
    const wide = window.matchMedia('(min-width: 768px)')

    function shader(type: number, source: string) {
      const s = gl!.createShader(type)!
      gl!.shaderSource(s, source)
      gl!.compileShader(s)
      if (!gl!.getShaderParameter(s, gl!.COMPILE_STATUS)) throw new Error(gl!.getShaderInfoLog(s) ?? 'shader')
      return s
    }

    const img = new Image()
    img.decoding = 'async'
    img.onerror = () => setFallback(true)
    img.onload = () => {
      if (!alive || !gl) return
      try {
        const prog = gl.createProgram()!
        gl.attachShader(prog, shader(gl.VERTEX_SHADER, VERT))
        gl.attachShader(prog, shader(gl.FRAGMENT_SHADER, FRAG))
        gl.linkProgram(prog)
        if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error('link')
        gl.useProgram(prog)

        const buf = gl.createBuffer()
        gl.bindBuffer(gl.ARRAY_BUFFER, buf)
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW)
        const aPos = gl.getAttribLocation(prog, 'aPos')
        gl.enableVertexAttribArray(aPos)
        gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0)

        const tex = (unit: number, upload: () => void) => {
          const t = gl.createTexture()
          gl.activeTexture(gl.TEXTURE0 + unit)
          gl.bindTexture(gl.TEXTURE_2D, t)
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
          upload()
        }
        tex(0, () => gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, img))
        const depth = buildDepth(img)
        gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1)
        tex(1, () => gl.texImage2D(gl.TEXTURE_2D, 0, gl.LUMINANCE, depth.w, depth.h, 0, gl.LUMINANCE, gl.UNSIGNED_BYTE, depth.data))
        gl.uniform1i(gl.getUniformLocation(prog, 'uImg'), 0)
        gl.uniform1i(gl.getUniformLocation(prog, 'uDepth'), 1)

        const uScale = gl.getUniformLocation(prog, 'uScale')
        const uOffset = gl.getUniformLocation(prog, 'uOffset')
        const uCam = gl.getUniformLocation(prog, 'uCam')
        const uZoom = gl.getUniformLocation(prog, 'uZoom')
        const ia = img.naturalWidth / img.naturalHeight

        const resize = () => {
          const dpr = Math.min(window.devicePixelRatio || 1, 2)
          const w = Math.max(2, Math.round(canvas.clientWidth * dpr))
          const h = Math.max(2, Math.round(canvas.clientHeight * dpr))
          if (canvas.width !== w || canvas.height !== h) {
            canvas.width = w
            canvas.height = h
          }
          gl.viewport(0, 0, w, h)
          const ca = w / h
          const [px, py] = parsePosition(wide.matches ? position : mobilePosition)
          // "cover": fill the box, crop the rest, honouring the focal position.
          const sx = ca > ia ? 1 : ca / ia
          const sy = ca > ia ? ia / ca : 1
          gl.uniform2f(uScale, sx, sy)
          gl.uniform2f(uOffset, (1 - sx) * px, (1 - sy) * py)
        }
        resize()
        const ro = new ResizeObserver(resize)
        ro.observe(canvas)

        const onMove = (e: PointerEvent) => {
          pointer.tx = (e.clientX / window.innerWidth - 0.5) * 2
          pointer.ty = (e.clientY / window.innerHeight - 0.5) * 2
        }
        window.addEventListener('pointermove', onMove, { passive: true })
        const onVis = () => {
          visible = !document.hidden
          if (visible && alive) raf = requestAnimationFrame(frame)
        }
        document.addEventListener('visibilitychange', onVis)

        const t0 = performance.now()
        const frame = () => {
          if (!alive || !visible) return
          const t = (performance.now() - t0) / 1000
          pointer.x += (pointer.tx - pointer.x) * 0.04
          pointer.y += (pointer.ty - pointer.y) * 0.04
          // The camera slowly slides left and right (about 45 s per cycle), with a little bob,
          // plus a small extra shift that follows the mouse.
          const camX = 0.014 * Math.sin(t * 0.14) + 0.006 * pointer.x
          const camY = 0.004 * Math.sin(t * 0.11 + 1.3) + 0.003 * pointer.y
          gl.uniform2f(uCam, camX, camY)
          gl.uniform1f(uZoom, 1.07 + 0.015 * Math.sin(t * 0.07))
          gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)
          raf = requestAnimationFrame(frame)
        }
        raf = requestAnimationFrame(frame)

        cleanup = () => {
          cancelAnimationFrame(raf)
          ro.disconnect()
          window.removeEventListener('pointermove', onMove)
          document.removeEventListener('visibilitychange', onVis)
        }
      } catch {
        setFallback(true)
      }
    }
    let cleanup = () => {}
    img.src = src

    return () => {
      alive = false
      cleanup()
    }
  }, [src, position, mobilePosition])

  if (fallback) {
    return (
      <img
        src={src}
        alt=""
        decoding="async"
        fetchPriority="high"
        className={cn('h-full w-full object-cover [object-position:var(--mp)] md:[object-position:var(--pos)]', className)}
        style={{ ['--pos' as string]: position, ['--mp' as string]: mobilePosition }}
      />
    )
  }
  return <canvas ref={ref} aria-hidden className={cn('h-full w-full', className)} />
}
