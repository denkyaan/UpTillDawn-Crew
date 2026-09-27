export interface VersionPolicy {
  minimumSupported: string
  latest: string
}

function parts(version: string): number[] {
  return version.split('.').map((value) => Number.parseInt(value, 10) || 0)
}

export function compareVersions(a: string, b: string): number {
  const left = parts(a)
  const right = parts(b)
  const length = Math.max(left.length, right.length)
  for (let index = 0; index < length; index += 1) {
    const difference = (left[index] ?? 0) - (right[index] ?? 0)
    if (difference !== 0) return difference
  }
  return 0
}

export function clientVersionSupported(version: string, policy: VersionPolicy): boolean {
  return compareVersions(version, policy.minimumSupported) >= 0
}

export function clientUpdateAvailable(version: string, policy: VersionPolicy): boolean {
  return compareVersions(version, policy.latest) < 0
}
