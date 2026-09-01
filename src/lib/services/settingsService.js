/**
 * @typedef {import('../models/settings.js').AppSettings} AppSettings
 */

import { DEFAULT_SETTINGS } from '../models/settings.js';

const STORAGE_KEY = 'timetracker_settings';

/**
 * @returns {AppSettings}
 */
export function getSettings() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) {
            return { ...DEFAULT_SETTINGS };
        }
        const parsed = JSON.parse(raw);
        return {
            ...DEFAULT_SETTINGS,
            ...parsed,
        };
    } catch {
        return { ...DEFAULT_SETTINGS };
    }
}

/**
 * @param {Partial<AppSettings>} partial
 * @returns {AppSettings}
 */
export function saveSettings(partial) {
    const settings = { ...getSettings(), ...partial };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    return settings;
}

/**
 * @returns {number}
 */
export function getGoalMinutes() {
    return getSettings().goalHours * 60;
}

const WORKDAYS_PER_WEEK = 5;

/**
 * Daily target in minutes. Uses the configured goal when tracking daily,
 * otherwise spreads a weekly goal across a 5-day work week.
 * @returns {number}
 */
export function getDailyTargetMinutes() {
    const settings = getSettings();
    if (settings.progressPeriod === 'daily') {
        return settings.goalHours * 60;
    }
    return (settings.goalHours * 60) / WORKDAYS_PER_WEEK;
}

/**
 * Weekly target in minutes. Uses the configured goal when tracking weekly,
 * otherwise multiplies a daily goal across a 5-day work week.
 * @returns {number}
 */
export function getWeeklyTargetMinutes() {
    const settings = getSettings();
    if (settings.progressPeriod === 'weekly') {
        return settings.goalHours * 60;
    }
    return settings.goalHours * 60 * WORKDAYS_PER_WEEK;
}

/**
 * @param {Date} date
 * @returns {Date}
 */
function startOfDay(date) {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    return d;
}

/**
 * @param {Date} date
 * @returns {Date}
 */
function mostRecentSundayMidnight(date) {
    const d = startOfDay(date);
    d.setDate(d.getDate() - d.getDay());
    return d;
}

/**
 * @param {Date} date
 * @returns {Date}
 */
function startOfMonthMidnight(date) {
    const d = startOfDay(date);
    d.setDate(1);
    return d;
}

/**
 * @param {AppSettings} settings
 * @returns {Date | null}
 */
function getCurrentClearBoundary(settings) {
    const now = new Date();

    switch (settings.dataClearFrequency) {
        case 'daily':
            return startOfDay(now);
        case 'weekly':
            return mostRecentSundayMidnight(now);
        case 'monthly':
            return startOfMonthMidnight(now);
        default:
            return null;
    }
}

/**
 * @param {AppSettings} [settings]
 * @returns {boolean}
 */
export function shouldAutoClear(settings = getSettings()) {
    if (settings.dataClearFrequency === 'never') {
        return false;
    }

    const boundary = getCurrentClearBoundary(settings);
    if (!boundary) {
        return false;
    }

    if (settings.lastAutoClearAt === null) {
        return true;
    }

    return settings.lastAutoClearAt < boundary.getTime();
}

/**
 * @returns {AppSettings}
 */
export function markAutoClearComplete() {
    return saveSettings({ lastAutoClearAt: Date.now() });
}
