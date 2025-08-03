export function getCurrentMonth(): string {
	return new Date().toISOString().slice(0, 7)
}

export function getNextMonth(): string {
	const date = new Date()
	date.setMonth(date.getMonth() + 1)
	return date.toISOString().slice(0, 7)
}

export function formatMonthYear(monthStr: string): string {
	const [year, month] = monthStr.split('-')
	return new Date(parseInt(year), parseInt(month) - 1, 1).toLocaleDateString('en-US', {
		year: 'numeric',
		month: 'long',
	})
}

export function getDaysLeftInMonth(): number {
	const now = new Date()
	const lastDayOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
	return lastDayOfMonth - now.getDate()
}

export function isDaysBeforeMonthEnd(targetDays: number): boolean {
	return getDaysLeftInMonth() === targetDays
}

export function isLastWeekOfMonth(): boolean {
	return getDaysLeftInMonth() <= 7
}
