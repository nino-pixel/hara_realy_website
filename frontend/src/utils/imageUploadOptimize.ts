/**
 * Resize (max width 1920px) and JPEG encode for property uploads.
 * Best effort only: never reject solely because the resulting file is still large.
 */

const MAX_WIDTH = 1920
const BASE_QUALITY = 0.7

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('Invalid image'))
    img.src = src
  })
}

/**
 * Returns optimized JPEG `File`. Skips non-raster images (e.g. SVG).
 */
export async function optimizeImageForUpload(file: File): Promise<File> {
  if (!file.type.startsWith('image/') || file.type === 'image/svg+xml') {
    return file
  }

  const url = URL.createObjectURL(file)
  try {
    const img = await loadImage(url)
    const w = img.naturalWidth
    const h = img.naturalHeight
    const scale = w > MAX_WIDTH ? MAX_WIDTH / w : 1
    const cw = Math.max(1, Math.round(w * scale))
    const ch = Math.max(1, Math.round(h * scale))

    const canvas = document.createElement('canvas')
    canvas.width = cw
    canvas.height = ch
    const ctx = canvas.getContext('2d')
    if (!ctx) return file

    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, cw, ch)
    ctx.drawImage(img, 0, 0, cw, ch)

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob((b) => resolve(b), 'image/jpeg', BASE_QUALITY)
    )
    if (!blob) return file

    const name = file.name.replace(/\.[^.]+$/, '') + '.jpg'
    const optimized = new File([blob], name, { type: 'image/jpeg' })
    return optimized.size < file.size ? optimized : file
  } finally {
    URL.revokeObjectURL(url)
  }
}

export async function optimizeImageFiles(files: File[]): Promise<File[]> {
  return Promise.all(files.map((f) => optimizeImageForUpload(f)))
}
