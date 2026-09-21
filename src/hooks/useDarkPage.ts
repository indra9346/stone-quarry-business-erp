import { useEffect } from 'react'

/**
 * Full-screen photo pages: make everything behind the page dark and stop the
 * rubber-band overscroll, so a fast scroll to the bottom never flashes a light
 * strip (the normal page background) under the photo.
 */
export function useDarkPage() {
  useEffect(() => {
    const html = document.documentElement
    const body = document.body
    const prev = { h: html.style.backgroundColor, b: body.style.backgroundColor, o: html.style.overscrollBehaviorY }
    html.style.backgroundColor = '#1e293b'
    body.style.backgroundColor = '#1e293b'
    html.style.overscrollBehaviorY = 'none'
    return () => {
      html.style.backgroundColor = prev.h
      body.style.backgroundColor = prev.b
      html.style.overscrollBehaviorY = prev.o
    }
  }, [])
}
