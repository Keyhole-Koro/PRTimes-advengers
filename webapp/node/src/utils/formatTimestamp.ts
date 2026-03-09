export function formatTimestamp(timestamp: Date): string {
  const year = timestamp.getFullYear()
  const month = String(timestamp.getMonth() + 1).padStart(2, '0')
  const day = String(timestamp.getDate()).padStart(2, '0')
  const hours = String(timestamp.getHours()).padStart(2, '0')
  const minutes = String(timestamp.getMinutes()).padStart(2, '0')
  const seconds = String(timestamp.getSeconds()).padStart(2, '0')
  const microseconds = String(timestamp.getMilliseconds() * 1000).padStart(6, '0')

  return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}.${microseconds}`
}
