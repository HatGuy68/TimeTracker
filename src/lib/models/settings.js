/**
 * @typedef {object} AppSettings
 * @property {'daily' | 'weekly'} progressPeriod
 * @property {number} goalHours
 * @property {'never' | 'daily' | 'weekly' | 'monthly'} dataClearFrequency
 * @property {number | null} lastAutoClearAt
 */

/** @type {AppSettings} */
export const DEFAULT_SETTINGS = {
    progressPeriod: 'weekly',
    goalHours: 40,
    dataClearFrequency: 'never',
    lastAutoClearAt: null,
};
