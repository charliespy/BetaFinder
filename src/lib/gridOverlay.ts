/**
 * Draws a percentage grid overlay onto an image for AI coordinate reference.
 * Returns a new base64 string with the grid baked in.
 */
export function applyGridOverlay(base64: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = img.width
      canvas.height = img.height
      const ctx = canvas.getContext('2d')
      if (!ctx) {
        reject(new Error('Failed to get canvas context'))
        return
      }
      ctx.drawImage(img, 0, 0)

      ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)'
      ctx.lineWidth = 1
      ctx.font = `${Math.max(12, Math.round(canvas.width / 80))}px sans-serif`
      ctx.fillStyle = 'rgba(255, 255, 255, 0.7)'

      for (let pct = 10; pct <= 90; pct += 10) {
        const x = (pct / 100) * canvas.width
        const y = (pct / 100) * canvas.height

        ctx.beginPath()
        ctx.moveTo(x, 0)
        ctx.lineTo(x, canvas.height)
        ctx.stroke()

        ctx.beginPath()
        ctx.moveTo(0, y)
        ctx.lineTo(canvas.width, y)
        ctx.stroke()

        ctx.fillText(`${pct}%`, x + 2, 14)
        ctx.fillText(`${pct}%`, 2, y - 2)
      }

      const result = canvas.toDataURL('image/jpeg', 0.9)
      resolve(result.split(',')[1])
    }
    img.onerror = () => reject(new Error('Failed to load image for grid overlay'))
    img.src = `data:image/jpeg;base64,${base64}`
  })
}
