import type { Hold, Point2D } from '@/types/beta'

// --- Color conversion helpers ---

function rgbToLab(r: number, g: number, b: number): [number, number, number] {
  // sRGB to linear
  let lr = r / 255
  let lg = g / 255
  let lb = b / 255
  lr = lr > 0.04045 ? Math.pow((lr + 0.055) / 1.055, 2.4) : lr / 12.92
  lg = lg > 0.04045 ? Math.pow((lg + 0.055) / 1.055, 2.4) : lg / 12.92
  lb = lb > 0.04045 ? Math.pow((lb + 0.055) / 1.055, 2.4) : lb / 12.92

  // Linear RGB to XYZ (D65)
  let x = (lr * 0.4124564 + lg * 0.3575761 + lb * 0.1804375) / 0.95047
  let y = lr * 0.2126729 + lg * 0.7151522 + lb * 0.0721750
  let z = (lr * 0.0193339 + lg * 0.1191920 + lb * 0.9503041) / 1.08883

  const e = 0.008856
  const k = 903.3
  x = x > e ? Math.cbrt(x) : (k * x + 16) / 116
  y = y > e ? Math.cbrt(y) : (k * y + 16) / 116
  z = z > e ? Math.cbrt(z) : (k * z + 16) / 116

  return [116 * y - 16, 500 * (x - y), 200 * (y - z)]
}

function colorDistanceLab(
  a: [number, number, number],
  b: [number, number, number]
): number {
  const dL = a[0] - b[0]
  const da = a[1] - b[1]
  const db = a[2] - b[2]
  return Math.sqrt(dL * dL + da * da + db * db)
}

function hexToLab(hex: string): [number, number, number] {
  const h = hex.replace('#', '')
  const r = parseInt(h.substring(0, 2), 16)
  const g = parseInt(h.substring(2, 4), 16)
  const b = parseInt(h.substring(4, 6), 16)
  return rgbToLab(r, g, b)
}

// --- Pixel helpers ---

function getPixelLab(
  data: Uint8ClampedArray,
  w: number,
  x: number,
  y: number
): [number, number, number] {
  const i = (y * w + x) * 4
  return rgbToLab(data[i], data[i + 1], data[i + 2])
}

// --- Gradient magnitude (Sobel) ---

function computeGradientMap(data: Uint8ClampedArray, w: number, h: number): Float32Array {
  const grad = new Float32Array(w * h)
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      // Grayscale luminance at 3x3 neighborhood
      const g = (px: number, py: number) => {
        const i = (py * w + px) * 4
        return 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]
      }
      // Sobel X and Y
      const gx =
        -g(x - 1, y - 1) + g(x + 1, y - 1) +
        -2 * g(x - 1, y) + 2 * g(x + 1, y) +
        -g(x - 1, y + 1) + g(x + 1, y + 1)
      const gy =
        -g(x - 1, y - 1) - 2 * g(x, y - 1) - g(x + 1, y - 1) +
        g(x - 1, y + 1) + 2 * g(x, y + 1) + g(x + 1, y + 1)
      grad[y * w + x] = Math.sqrt(gx * gx + gy * gy)
    }
  }
  return grad
}

function medianLab(
  data: Uint8ClampedArray,
  w: number,
  h: number,
  cx: number,
  cy: number,
  radius: number
): [number, number, number] {
  const ls: number[] = []
  const as: number[] = []
  const bs: number[] = []
  for (let dy = -radius; dy <= radius; dy++) {
    for (let dx = -radius; dx <= radius; dx++) {
      const px = cx + dx
      const py = cy + dy
      if (px < 0 || py < 0 || px >= w || py >= h) continue
      const lab = getPixelLab(data, w, px, py)
      ls.push(lab[0])
      as.push(lab[1])
      bs.push(lab[2])
    }
  }
  const med = (arr: number[]) => {
    arr.sort((a, b) => a - b)
    const mid = Math.floor(arr.length / 2)
    return arr.length % 2 ? arr[mid] : (arr[mid - 1] + arr[mid]) / 2
  }
  return [med(ls), med(as), med(bs)]
}

// --- Color blob centroid search ---

function findBestColorBlob(
  data: Uint8ClampedArray,
  w: number,
  h: number,
  cx: number,
  cy: number,
  targetLab: [number, number, number],
  searchRadius: number,
  colorThreshold: number,
  minBlobSize: number
): { x: number; y: number } | null {
  // Define search window clamped to image bounds
  const x0 = Math.max(0, cx - searchRadius)
  const y0 = Math.max(0, cy - searchRadius)
  const x1 = Math.min(w - 1, cx + searchRadius)
  const y1 = Math.min(h - 1, cy + searchRadius)
  const winW = x1 - x0 + 1
  const winH = y1 - y0 + 1

  const visited = new Uint8Array(winW * winH)

  const blobs: { centroidX: number; centroidY: number; area: number; dist: number }[] = []

  const dx4 = [1, -1, 0, 0]
  const dy4 = [0, 0, 1, -1]

  for (let wy = 0; wy < winH; wy++) {
    for (let wx = 0; wx < winW; wx++) {
      if (visited[wy * winW + wx]) continue
      const gx = wx + x0
      const gy = wy + y0
      const lab = getPixelLab(data, w, gx, gy)
      if (colorDistanceLab(lab, targetLab) >= colorThreshold) continue

      // BFS flood fill to find connected component
      const queue: number[] = [wx, wy]
      visited[wy * winW + wx] = 1
      let sumX = 0
      let sumY = 0
      let count = 0

      while (queue.length > 0) {
        const qy = queue.pop()!
        const qx = queue.pop()!
        sumX += qx + x0
        sumY += qy + y0
        count++

        for (let d = 0; d < 4; d++) {
          const nx = qx + dx4[d]
          const ny = qy + dy4[d]
          if (nx < 0 || ny < 0 || nx >= winW || ny >= winH) continue
          if (visited[ny * winW + nx]) continue
          const nlab = getPixelLab(data, w, nx + x0, ny + y0)
          if (colorDistanceLab(nlab, targetLab) >= colorThreshold) continue
          visited[ny * winW + nx] = 1
          queue.push(nx, ny)
        }
      }

      if (count >= minBlobSize) {
        const centroidX = sumX / count
        const centroidY = sumY / count
        const dist = Math.hypot(centroidX - cx, centroidY - cy)
        blobs.push({ centroidX, centroidY, area: count, dist })
      }
    }
  }

  if (blobs.length === 0) return null

  // Score: prefer larger blobs closer to the AI seed
  let bestScore = -1
  let bestBlob = blobs[0]
  for (const blob of blobs) {
    const score = blob.area / (1 + blob.dist / searchRadius)
    if (score > bestScore) {
      bestScore = score
      bestBlob = blob
    }
  }

  return { x: Math.round(bestBlob.centroidX), y: Math.round(bestBlob.centroidY) }
}

// --- Region growing (BFS flood fill) ---

function regionGrow(
  data: Uint8ClampedArray,
  w: number,
  h: number,
  seedX: number,
  seedY: number,
  refLab: [number, number, number],
  threshold: number,
  edgeThreshold: number,
  maxRadius: number,
  maxArea: number,
  gradMap: Float32Array,
  gradientThreshold: number,
  targetLab: [number, number, number] | null,
  targetThreshold: number
): Uint8Array {
  const mask = new Uint8Array(w * h)
  const queue: number[] = [seedX, seedY]
  mask[seedY * w + seedX] = 1

  const dx = [1, -1, 0, 0]
  const dy = [0, 0, 1, -1]
  let area = 1

  while (queue.length > 0) {
    const cy = queue.pop()!
    const cx = queue.pop()!
    const curLab = getPixelLab(data, w, cx, cy)
    for (let d = 0; d < 4; d++) {
      const nx = cx + dx[d]
      const ny = cy + dy[d]
      if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue
      const idx = ny * w + nx
      if (mask[idx]) continue
      // Max radius check
      const distX = nx - seedX
      const distY = ny - seedY
      if (distX * distX + distY * distY > maxRadius * maxRadius) continue
      // Gradient barrier: don't cross strong edges
      if (gradMap[idx] > gradientThreshold) continue
      const lab = getPixelLab(data, w, nx, ny)
      // Check similarity to seed reference color
      if (colorDistanceLab(lab, refLab) >= threshold) continue
      // Check similarity to target hold color (if provided)
      if (targetLab && colorDistanceLab(lab, targetLab) >= targetThreshold) continue
      // Edge check: reject if strong color discontinuity between current and neighbor
      if (colorDistanceLab(lab, curLab) >= edgeThreshold) continue
      mask[idx] = 1
      area++
      if (area > maxArea) return mask // safety cap
      queue.push(nx, ny)
    }
  }
  return mask
}

// --- Moore boundary trace ---

function mooreBoundaryTrace(
  mask: Uint8Array,
  w: number,
  h: number
): Point2D[] {
  // Find first boundary pixel (top-left scan)
  let startX = -1
  let startY = -1
  outer: for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (mask[y * w + x]) {
        startX = x
        startY = y
        break outer
      }
    }
  }
  if (startX === -1) return []

  // Moore neighborhood: 8 directions clockwise from W
  const mx = [-1, -1, 0, 1, 1, 1, 0, -1]
  const my = [0, -1, -1, -1, 0, 1, 1, 1]

  const boundary: Point2D[] = []
  let cx = startX
  let cy = startY
  let dir = 0 // start looking west

  const isSet = (x: number, y: number) =>
    x >= 0 && y >= 0 && x < w && y < h && mask[y * w + x] === 1

  const maxSteps = w * h
  let steps = 0

  do {
    boundary.push({ x: cx, y: cy })
    // Search clockwise from (dir+5)%8 (backtrack direction + 1)
    let searchDir = (dir + 5) % 8
    let found = false
    for (let i = 0; i < 8; i++) {
      const nd = (searchDir + i) % 8
      const nx = cx + mx[nd]
      const ny = cy + my[nd]
      if (isSet(nx, ny)) {
        dir = nd
        cx = nx
        cy = ny
        found = true
        break
      }
    }
    if (!found) break
    steps++
  } while ((cx !== startX || cy !== startY) && steps < maxSteps)

  return boundary
}

// --- Douglas-Peucker simplification ---

function douglasPeucker(points: Point2D[], epsilon: number): Point2D[] {
  if (points.length <= 2) return points

  let maxDist = 0
  let maxIdx = 0
  const first = points[0]
  const last = points[points.length - 1]

  for (let i = 1; i < points.length - 1; i++) {
    const d = perpendicularDist(points[i], first, last)
    if (d > maxDist) {
      maxDist = d
      maxIdx = i
    }
  }

  if (maxDist > epsilon) {
    const left = douglasPeucker(points.slice(0, maxIdx + 1), epsilon)
    const right = douglasPeucker(points.slice(maxIdx), epsilon)
    return [...left.slice(0, -1), ...right]
  }
  return [first, last]
}

function perpendicularDist(p: Point2D, a: Point2D, b: Point2D): number {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const lenSq = dx * dx + dy * dy
  if (lenSq === 0) return Math.hypot(p.x - a.x, p.y - a.y)
  const num = Math.abs(dy * p.x - dx * p.y + b.x * a.y - b.y * a.x)
  return num / Math.sqrt(lenSq)
}

// --- Public API ---

function countMask(mask: Uint8Array): number {
  let count = 0
  for (let i = 0; i < mask.length; i++) if (mask[i]) count++
  return count
}

function regionBounds(mask: Uint8Array, w: number, h: number): { minX: number; minY: number; maxX: number; maxY: number } {
  let minX = w, minY = h, maxX = 0, maxY = 0
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (mask[y * w + x]) {
        if (x < minX) minX = x
        if (x > maxX) maxX = x
        if (y < minY) minY = y
        if (y > maxY) maxY = y
      }
    }
  }
  return { minX, minY, maxX, maxY }
}

function tryGrowAndTrace(
  data: Uint8ClampedArray,
  w: number,
  h: number,
  seedX: number,
  seedY: number,
  threshold: number,
  edgeThreshold: number,
  maxRadius: number,
  maxArea: number,
  minRegion: number,
  dpEpsilon: number,
  gradMap: Float32Array,
  gradientThreshold: number,
  targetLab: [number, number, number] | null,
  targetThreshold: number
): { contour: Point2D[] } | null {
  const refLab = medianLab(data, w, h, seedX, seedY, 2)
  const mask = regionGrow(data, w, h, seedX, seedY, refLab, threshold, edgeThreshold, maxRadius, maxArea, gradMap, gradientThreshold, targetLab, targetThreshold)
  const regionSize = countMask(mask)

  if (regionSize < minRegion || regionSize > maxArea) return null

  // Compactness check: reject sprawling regions that aren't hold-shaped
  const bounds = regionBounds(mask, w, h)
  const bboxArea = (bounds.maxX - bounds.minX + 1) * (bounds.maxY - bounds.minY + 1)
  const compactness = regionSize / bboxArea
  if (compactness < 0.12) return null // holds are roughly blob-shaped, not spindly

  const boundary = mooreBoundaryTrace(mask, w, h)
  if (boundary.length < 6) return null

  const simplified = douglasPeucker(boundary, dpEpsilon)
  if (simplified.length < 3) return null

  return { contour: simplified }
}

export function extractSingleHoldContour(
  imageData: ImageData,
  hold: Hold,
  gradMap: Float32Array,
): { contour: Point2D[]; correctedX: number; correctedY: number } | null {
  const { data, width: w, height: h } = imageData
  // A single hold is typically 3-5% of image dimension; cap at 5%
  const maxRadius = Math.floor(Math.min(w, h) * 0.05)
  // Cap region at 0.8% of image area
  const maxArea = Math.floor(w * h * 0.008)
  const MIN_REGION = 50
  const DP_EPSILON = 2
  const EDGE_THRESHOLD = 15 // max LAB distance between adjacent pixels
  const GRADIENT_THRESHOLD = 40 // Sobel magnitude to block region growth
  const TARGET_THRESHOLD = 35 // max LAB distance from AI-reported hold color

  // Use the AI-provided hex color for this specific hold, converted to LAB
  const targetLab = hold.hexColor ? hexToLab(hold.hexColor) : null

  let seedX = Math.max(0, Math.min(w - 1, Math.round(hold.x)))
  let seedY = Math.max(0, Math.min(h - 1, Math.round(hold.y)))

  // Strategy 1: Try growing from original AI seed with moderate threshold
  let result = tryGrowAndTrace(data, w, h, seedX, seedY, 22, EDGE_THRESHOLD, maxRadius, maxArea, MIN_REGION, DP_EPSILON, gradMap, GRADIENT_THRESHOLD, targetLab, TARGET_THRESHOLD)
  if (result) return { ...result, correctedX: seedX, correctedY: seedY }

  // Strategy 2: If we have a hex color from the AI, find the best color blob nearby
  if (targetLab) {
    const corrected = findBestColorBlob(data, w, h, seedX, seedY, targetLab, 50, 25, 15)
    if (corrected) {
      seedX = corrected.x
      seedY = corrected.y
      result = tryGrowAndTrace(data, w, h, seedX, seedY, 25, EDGE_THRESHOLD, maxRadius, maxArea, MIN_REGION, DP_EPSILON, gradMap, GRADIENT_THRESHOLD, targetLab, TARGET_THRESHOLD + 5)
      if (result) return { ...result, correctedX: seedX, correctedY: seedY }
    }

    // Strategy 3: Wider search with relaxed color threshold
    const corrected2 = findBestColorBlob(data, w, h, Math.round(hold.x), Math.round(hold.y), targetLab, 80, 30, 15)
    if (corrected2) {
      seedX = corrected2.x
      seedY = corrected2.y
      result = tryGrowAndTrace(data, w, h, seedX, seedY, 30, 20, maxRadius, maxArea, MIN_REGION, DP_EPSILON, gradMap, GRADIENT_THRESHOLD + 10, targetLab, TARGET_THRESHOLD + 10)
      if (result) return { ...result, correctedX: seedX, correctedY: seedY }
    }
  }

  return null
}

export async function extractHoldContours(
  imageBase64: string,
  holds: Hold[],
): Promise<{ id: string; contour: Point2D[]; correctedX: number; correctedY: number }[]> {
  // Load image onto offscreen canvas
  const img = new Image()
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve()
    img.onerror = reject
    img.src = `data:image/jpeg;base64,${imageBase64}`
  })

  const canvas = document.createElement('canvas')
  canvas.width = img.width
  canvas.height = img.height
  const ctx = canvas.getContext('2d')!
  ctx.drawImage(img, 0, 0)
  const imageData = ctx.getImageData(0, 0, img.width, img.height)
  const gradMap = computeGradientMap(imageData.data, img.width, img.height)

  const results: { id: string; contour: Point2D[]; correctedX: number; correctedY: number }[] = []

  for (const hold of holds) {
    const result = extractSingleHoldContour(imageData, hold, gradMap)
    if (result) {
      results.push({
        id: hold.id,
        contour: result.contour,
        correctedX: result.correctedX,
        correctedY: result.correctedY,
      })
    }
  }

  return results
}
