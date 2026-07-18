export function formatDate(dateStr) {
  if (!dateStr) return ''

  const date = new Date(dateStr)

  if (isNaN(date.getTime())) return ''

  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  }).format(date)
}

export function formatCurrency(amount) {
  const numericAmount = Number(amount)

  if (isNaN(numericAmount)) return '$0.00'

  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(numericAmount)
}
