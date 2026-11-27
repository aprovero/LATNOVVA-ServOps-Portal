/**
 * Local-calendar safe Monday–Sunday week range calculator for Nomina.
 * Fixes two bugs:
 * 1. On Sundays (getDay() === 0), d.getDate() - 0 + 1 jumped to NEXT Monday instead of the Monday 6 days earlier.
 * 2. Using toISOString().split('T')[0] shifted dates +1 day after 6:00 PM in UTC-6 (Mexico time).
 */
export function formatLocalYMD(date: Date): string {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

export function getDefaultNominaWeekRange(now: Date = new Date()): { startDate: string; endDate: string } {
    const day = now.getDay(); // 0 = Sun, 1 = Mon, ..., 6 = Sat
    const diffToMonday = day === 0 ? -6 : 1 - day;

    const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() + diffToMonday);
    const sunday = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + 6);

    return {
        startDate: formatLocalYMD(monday),
        endDate: formatLocalYMD(sunday),
    };
}
