let storedImage: string | null = null

export function setImage(base64: string): void {
  storedImage = base64
}

export function getImage(): string | null {
  return storedImage
}

export function clearImage(): void {
  storedImage = null
}
