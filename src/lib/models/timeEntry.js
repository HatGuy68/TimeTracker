/**
 * @typedef {object} TimeEntry
 * @property {string} id
 * @property {'CLOCK_IN' | 'CLOCK_OUT'} type
 * @property {number} timestamp
 * @property {string} [note]
 * @property {boolean} [deleted]
 */

/**
 * @typedef {object} WorkSession
 * @property {number} clockIn
 * @property {number} [clockOut]
 * @property {number} [durationMinutes]
 * @property {string} [note]
 */

/**
 * @typedef {object} DailySummary
 * @property {string} date
 * @property {number} totalMinutes
 * @property {WorkSession[]} sessions
 */