/**
 * @typedef {object} AppSettings
 * @property {'daily' | 'weekly'} progressPeriod
 * @property {number} goalHours
 * @property {number} workDaysPerWeek
 * @property {'never' | 'daily' | 'weekly' | 'monthly'} dataClearFrequency
 * @property {number | null} lastAutoClearAt
 */

/** @type {AppSettings} */
export const DEFAULT_SETTINGS = {
    progressPeriod: 'weekly',
    goalHours: 40,
    workDaysPerWeek: 5,
    dataClearFrequency: 'never',
    lastAutoClearAt: null,
};
