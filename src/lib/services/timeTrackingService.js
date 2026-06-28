/**
 * @typedef {import('../../lib/models/timeEntry.js').TimeEntry} TimeEntry
 * @typedef {import('../../lib/models/timeEntry.js').WorkSession} WorkSession
 * @typedef {import('../../lib/models/timeEntry.js').DailySummary} DailySummary
 */

import { uuidv4 } from '../../../scripts/generate-uuid.js';
import { initializeDB, saveEntry, updateEntry, deleteEntry, getEntry, getAllEntries, getEntriesBetween, clearDatabase } from '../db/db.js';

const CLOCK_IN = 'CLOCK_IN';
const CLOCK_OUT = 'CLOCK_OUT';

/**
 * Formats a timestamp as YYYY-MM-DD in local time.
 * @param {number | Date} value
 * @returns {string}
 */
export function toLocalDateKey(value) {
    const date = value instanceof Date ? value : new Date(value);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

/**
 * Clocks in the user.
 * @param {string} [note]
 * @returns {Promise<TimeEntry>}
 */
export async function clockIn(note) {
    const now = Date.now();
    /** @type {TimeEntry} */
    const entry = {
        id: uuidv4(),
        type: CLOCK_IN,
        timestamp: now,
        note: note || undefined,
    };
    await saveEntry(entry);
    return entry;
}

/**
 * Clocks out the user.
 * @param {string} [note]
 * @returns {Promise<TimeEntry>}
 */
export async function clockOut(note) {
    const now = Date.now();
    /** @type {TimeEntry} */
    const entry = {
        id: uuidv4(),
        type: CLOCK_OUT,
        timestamp: now,
        note: note || undefined,
    };
    await saveEntry(entry);
    return entry;
}

/**
 * Checks if the user is currently clocked in.
 * @returns {Promise<boolean>}
 */
export async function isCurrentlyClockedIn() {
    const entries = await getAllEntries();
    if (entries.length === 0) {
        return false;
    }
    const lastEntry = entries.sort((a, b) => b.timestamp - a.timestamp)[0];
    return lastEntry.type === CLOCK_IN && !lastEntry.deleted;
}

/**
 * Gets the current work session if clocked in.
 * @returns {Promise<WorkSession | null>}
 */
export async function getCurrentSession() {
    const entries = await getAllEntries();
    const sortedEntries = entries.sort((a, b) => a.timestamp - b.timestamp);

    let lastClockIn = null;
    for (const entry of sortedEntries) {
        if (entry.type === CLOCK_IN && !entry.deleted) {
            lastClockIn = entry;
        } else if (entry.type === CLOCK_OUT && !entry.deleted) {
            lastClockIn = null;
        }
    }

    if (lastClockIn) {
        const now = Date.now();
        const durationMinutes = (now - lastClockIn.timestamp) / (1000 * 60);
        return {
            clockIn: lastClockIn.timestamp,
            clockOut: undefined,
            durationMinutes: durationMinutes,
            note: lastClockIn.note,
        };
    }
    return null;
}

/**
 * Generates work sessions from time entries.
 * @param {TimeEntry[]} entries
 * @returns {WorkSession[]}
 */
function generateWorkSessions(entries) {
    const sortedEntries = entries.sort((a, b) => a.timestamp - b.timestamp);
    /** @type {WorkSession[]} */
    const sessions = [];
    let currentSession = null;

    for (const entry of sortedEntries) {
        if (entry.deleted) continue;

        if (entry.type === CLOCK_IN) {
            if (currentSession) {
                // Previous session was incomplete, close it now.
                sessions.push({
                    clockIn: currentSession.clockIn,
                    clockOut: entry.timestamp, // Use current clock-in as clock-out for previous incomplete session
                    durationMinutes: (entry.timestamp - currentSession.clockIn) / (1000 * 60),
                    note: currentSession.note,
                });
            }
            currentSession = {
                clockIn: entry.timestamp,
                note: entry.note,
            };
        } else if (entry.type === CLOCK_OUT) {
            if (currentSession) {
                currentSession.clockOut = entry.timestamp;
                currentSession.durationMinutes = (currentSession.clockOut - currentSession.clockIn) / (1000 * 60);
                currentSession.note = currentSession.note || entry.note;
                sessions.push(currentSession);
                currentSession = null;
            } else {
                // Orphaned CLOCK_OUT, ignore or handle as an error if needed
                console.warn('Orphaned CLOCK_OUT entry:', entry);
            }
        }
    }

    if (currentSession) {
        // Handle the last incomplete session (if any)
        sessions.push(currentSession);
    }

    return sessions;
}

/**
 * Groups sessions by date and calculates daily summaries.
 * @param {WorkSession[]} sessions
 * @returns {Map<string, DailySummary>}
 */
function groupSessionsByDate(sessions) {
    /** @type {Map<string, DailySummary>} */
    const dailySummaries = new Map();

    for (const session of sessions) {
        if (!session.clockIn) continue;

        const date = toLocalDateKey(session.clockIn);

        if (!dailySummaries.has(date)) {
            dailySummaries.set(date, {
                date: date,
                totalMinutes: 0,
                sessions: [],
            });
        }

        const summary = dailySummaries.get(date);
        summary.sessions.push(session);
        if (session.durationMinutes) {
            summary.totalMinutes += session.durationMinutes;
        }
    }

    // Sort sessions within each daily summary by clockIn timestamp
    dailySummaries.forEach(summary => {
        summary.sessions.sort((a, b) => a.clockIn - b.clockIn);
    });

    return dailySummaries;
}

/**
 * Gets today's work summary.
 * @returns {Promise<DailySummary | null>}
 */
export async function getTodaySummary() {
    const now = Date.now();
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const entries = await getEntriesBetween(startOfDay.getTime(), now);
    const sessions = generateWorkSessions(entries);
    const dailySummaries = groupSessionsByDate(sessions);

    const today = toLocalDateKey(startOfDay);
    return dailySummaries.get(today) || null;
}

/**
 * Returns Sunday midnight local time for the current week.
 * @returns {Date}
 */
export function getWeekStartDate() {
    const startOfWeek = new Date();
    startOfWeek.setHours(0, 0, 0, 0);
    startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());
    return startOfWeek;
}

/**
 * Gets the current week's work summary.
 * @returns {Promise<Map<string, DailySummary>>}
 */
export async function getWeekSummary() {
    const now = Date.now();
    const startOfWeek = getWeekStartDate();

    const entries = await getEntriesBetween(startOfWeek.getTime(), now);
    const sessions = generateWorkSessions(entries);
    return groupSessionsByDate(sessions);
}

/**
 * Gets the current month's work summary.
 * @returns {Promise<Map<string, DailySummary>>}
 */
export async function getMonthSummary() {
    const now = Date.now();
    const startOfMonth = new Date();
    startOfMonth.setHours(0, 0, 0, 0);
    startOfMonth.setDate(1);

    const entries = await getEntriesBetween(startOfMonth.getTime(), now);
    const sessions = generateWorkSessions(entries);
    return groupSessionsByDate(sessions);
}

/**
 * Retrieves all work sessions.
 * @returns {Promise<WorkSession[]>}
 */
export async function getAllSessions() {
    const entries = await getAllEntries();
    return generateWorkSessions(entries);
}

/**
 * Clears all time entry data from IndexedDB.
 * @returns {Promise<void>}
 */
export async function clearAllData() {
    await clearDatabase();
}

/**
 * Exports all application data as a JSON string.
 * @returns {Promise<string>}
 */
export async function exportData() {
    const entries = await getAllEntries();
    const data = {
        version: 1,
        exportedAt: Date.now(),
        entries: entries,
    };
    return JSON.stringify(data, null, 2);
}

/**
 * Imports data from a JSON string.
 * @param {string} jsonData
 * @returns {Promise<void>}
 */
export async function importData(jsonData) {
    const data = JSON.parse(jsonData);
    if (data.version !== 1 || !Array.isArray(data.entries)) {
        throw new Error('Invalid import data format.');
    }

    // Clear existing data before importing
    await clearDatabase();

    for (const entry of data.entries) {
        await saveEntry(entry);
    }
}
