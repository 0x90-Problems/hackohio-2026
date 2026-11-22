"use client"

import { useEffect, type RefObject } from "react"

import { edgeSpeed } from "@/lib/drag-scroll"

/**
 * While something is dragged inside `area`, scroll its horizontal viewport (the board's columns)
 * and the window toward whichever edge the pointer is near. Native drag and drop sends no wheel or
 * scroll of its own, so without this a card couldn't reach a column off screen.
 */
export function useDragScroll(area: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const root = area.current
    if (!root) return
    let pointer: { x: number; y: number } | null = null
    let frame = 0

    const viewport = () => root.querySelector<HTMLElement>("[data-slot=scroll-area-viewport]") ?? root
    const tick = () => {
      frame = 0
      if (!pointer) return
      const box = viewport().getBoundingClientRect()
      const dx = pointer.y >= box.top && pointer.y <= box.bottom ? edgeSpeed(pointer.x, box.left, box.right) : 0
      const dy = edgeSpeed(pointer.y, 0, window.innerHeight)
      if (dx) viewport().scrollLeft += dx
      if (dy) window.scrollBy(0, dy)
      if (dx || dy) frame = requestAnimationFrame(tick)
    }
    const onOver = (event: DragEvent) => {
      if (!pointer) return
      pointer = { x: event.clientX, y: event.clientY }
      if (!frame) frame = requestAnimationFrame(tick)
    }
    const onStart = (event: DragEvent) => {
      pointer = { x: event.clientX, y: event.clientY }
    }
    const stop = () => {
      pointer = null
      if (frame) cancelAnimationFrame(frame)
      frame = 0
    }

    root.addEventListener("dragstart", onStart)
    document.addEventListener("dragover", onOver)
    document.addEventListener("dragend", stop)
    document.addEventListener("drop", stop)
    return () => {
      stop()
      root.removeEventListener("dragstart", onStart)
      document.removeEventListener("dragover", onOver)
      document.removeEventListener("dragend", stop)
      document.removeEventListener("drop", stop)
    }
  }, [area])
}
