import { useState, useRef, useEffect } from 'react'

export function useFullPageScroll(
  totalSections: number,
  interactivePanelRef?: React.RefObject<HTMLDivElement | null>,
  interactivePanelIndex?: number
) {
  const [activeIndex, setActiveIndex] = useState(0)
  const isScrollingRef = useRef(false)

  // Mobile touch refs
  const touchStartY = useRef(0)
  const touchCurrentY = useRef(0)

  // Safety cooldown to prevent hypersensitive Apple trackpad multi-swipes
  const COOLDOWN_MS = 1200

  const lockScroll = () => {
    isScrollingRef.current = true
    setTimeout(() => {
      isScrollingRef.current = false
    }, COOLDOWN_MS)
  }

  const navigateTo = (direction: 'up' | 'down') => {
    if (isScrollingRef.current) return

    if (direction === 'down') {
      if (activeIndex < totalSections - 1) {
        lockScroll()
        setActiveIndex((prev) => prev + 1)
      }
    } else {
      // Trying to go up
      if (activeIndex > 0) {
        // If we are currently on an interactive panel (e.g. Featured Properties with a scrollbar),
        // we only snap up if they have scrolled back to the absolute top of the panel.
        if (
          interactivePanelRef?.current &&
          interactivePanelIndex !== undefined &&
          activeIndex === interactivePanelIndex
        ) {
          const panel = interactivePanelRef.current
          if (panel.scrollTop > 10) return // Let native scroll happen inside panel
        }

        lockScroll()
        setActiveIndex((prev) => prev - 1)
      }
    }
  }

  useEffect(() => {
    // We attach passive: false listeners explicitly to document/window or the immediate layout container
    // Because React synthetic onWheel doesn't allow preventDefault easily.
    
    // We only want to intercept scroll if we are not reducing motion
    const reduce = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduce) return

    const handleWheel = (e: WheelEvent) => {
      // If expanding a modal or SWAL is active, do not intercept
      if (document.querySelector('.swal2-container')) return

      // Are we hovering over the scrollable internal panel?
      if (
        interactivePanelIndex !== undefined &&
        activeIndex === interactivePanelIndex &&
        interactivePanelRef?.current?.contains(e.target as Node)
      ) {
        const panel = interactivePanelRef.current
        const atTop = panel.scrollTop <= 0
        const atBottom = panel.scrollHeight - panel.scrollTop <= panel.clientHeight + 2

        if (e.deltaY < 0 && !atTop) return // Standard scroll up
        if (e.deltaY > 0 && !atBottom) return // Standard scroll down

        // If at the top and pulling up, trigger the snap to previous section
        if (e.deltaY < 0 && atTop) {
          e.preventDefault()
          navigateTo('up')
          return
        }
        
        // If at the bottom and pulling down, trigger the snap to next section
        if (e.deltaY > 0 && atBottom) {
          e.preventDefault()
          navigateTo('down')
          return
        }
      }

      // Default outer scroll handler
      e.preventDefault()
      
      // Debounce tiny scroll events
      if (Math.abs(e.deltaY) > 20) {
        if (e.deltaY > 0) navigateTo('down')
        else navigateTo('up')
      }
    }

    const handleTouchStart = (e: TouchEvent) => {
      touchStartY.current = e.touches[0].clientY
      touchCurrentY.current = e.touches[0].clientY
    }

    const handleTouchMove = (e: TouchEvent) => {
      if (document.querySelector('.swal2-container')) return

      touchCurrentY.current = e.touches[0].clientY
      const dy = touchStartY.current - touchCurrentY.current

      // Check internal scroll threshold
      if (
        interactivePanelIndex !== undefined &&
        activeIndex === interactivePanelIndex &&
        interactivePanelRef?.current?.contains(e.target as Node)
      ) {
        const panel = interactivePanelRef.current
        const atTop = panel.scrollTop <= 0
        const atBottom = panel.scrollHeight - panel.scrollTop <= panel.clientHeight + 2

        // User swiping down (scrolling up)
        if (dy < 0 && atTop) {
          e.preventDefault() // prevent native bounce
        }
        // User swiping up (scrolling down)
        else if (dy > 0 && atBottom) {
          e.preventDefault()
        } 
        else {
          return // Let native touch scrolling handle inside the interactive panel
        }
      } else {
        // Prevent default on all other panels to lock them to swipe
        e.preventDefault()
      }
    }

    const handleTouchEnd = () => {
      if (document.querySelector('.swal2-container')) return

      const dy = touchStartY.current - touchCurrentY.current
      if (Math.abs(dy) > 50) { // 50px swipe threshold
        if (dy > 0) {
          navigateTo('down')
        } else {
          navigateTo('up')
        }
      }
    }

    // Attach passive: false to window to ensure preventDefault works synchronously
    const options = { passive: false }
    window.addEventListener('wheel', handleWheel, options)
    window.addEventListener('touchstart', handleTouchStart, options)
    window.addEventListener('touchmove', handleTouchMove, options)
    window.addEventListener('touchend', handleTouchEnd)

    return () => {
      window.removeEventListener('wheel', handleWheel)
      window.removeEventListener('touchstart', handleTouchStart)
      window.removeEventListener('touchmove', handleTouchMove)
      window.removeEventListener('touchend', handleTouchEnd)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeIndex, totalSections, interactivePanelRef, interactivePanelIndex])

  return { activeIndex, setActiveIndex }
}
