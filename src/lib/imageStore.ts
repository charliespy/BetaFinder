const STORAGE_KEY = 'betafinder_image'

export function setImage(base64: string): boolean {
  try {
    sessionStorage.setItem(STORAGE_KEY, base64)
    return true
  } catch {
    return false
  }
}

export function getImage(): string | null {
  try {
    return sessionStorage.getItem(STORAGE_KEY)
  } catch {
    return null
  }
}

export function clearImage(): void {
  try {
    sessionStorage.removeItem(STORAGE_KEY)
  } catch {
    // ignore
  }
}
