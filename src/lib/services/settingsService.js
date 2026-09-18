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
        const merged = {
            ...DEFAULT_SETTINGS,
            ...parsed,
        };
        return { ...merged, ...clampGoalAndDays(merged) };
    } catch {
        return { ...DEFAULT_SETTINGS };
    }
}

/**
 * @param {Partial<AppSettings>} partial
 * @returns {AppSettings}
 */
export function saveSettings(partial) {
    const merged = { ...getSettings(), ...partial };
    const clamped = clampGoalAndDays(merged);
    const settings = { ...merged, ...clamped };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    return settings;
}

/**
 * @returns {number}
 */
export function getGoalMinutes() {
    return getSettings().goalHours * 60;
}

export const MAX_DAILY_HOURS = 9;
export const MIN_WORK_DAYS = 1;
export const MAX_WORK_DAYS = 7;

/**
 * @param {number} days
 * @returns {number}
 */
export function clampWorkDays(days) {
    const value = parseInt(String(days), 10);
    if (Number.isNaN(value)) {
        return DEFAULT_SETTINGS.workDaysPerWeek;
    }
    return Math.min(MAX_WORK_DAYS, Math.max(MIN_WORK_DAYS, value));
}

/**
 * Fewest days that keep weeklyHours / days strictly under 9h.
 * @param {number} weeklyHours
 * @returns {number}
 */
export function minWorkDaysForWeeklyHours(weeklyHours) {
    const hours = Math.max(1, weeklyHours);
    return Math.min(MAX_WORK_DAYS, Math.max(MIN_WORK_DAYS, Math.floor(hours / MAX_DAILY_HOURS) + 1));
}

/**
 * @param {{ progressPeriod: 'daily' | 'weekly', goalHours: number, workDaysPerWeek: number }} values
 * @returns {{ progressPeriod: 'daily' | 'weekly', goalHours: number, workDaysPerWeek: number }}
 */
export function clampGoalAndDays(values) {
    const progressPeriod = values.progressPeriod === 'daily' ? 'daily' : 'weekly';
    let workDaysPerWeek = clampWorkDays(values.workDaysPerWeek);
    let goalHours = Math.max(1, parseInt(String(values.goalHours), 10) || DEFAULT_SETTINGS.goalHours);

    if (progressPeriod === 'daily') {
        goalHours = Math.min(MAX_DAILY_HOURS - 1, goalHours);
        return { progressPeriod, goalHours, workDaysPerWeek };
    }

    const minDays = minWorkDaysForWeeklyHours(goalHours);
    if (workDaysPerWeek < minDays) {
        workDaysPerWeek = minDays;
    }

    const maxHours = workDaysPerWeek * MAX_DAILY_HOURS - 1;
    if (goalHours > maxHours) {
        goalHours = maxHours;
    }

    return { progressPeriod, goalHours, workDaysPerWeek };
}

/**
 * @returns {number}
 */
export function getWorkDaysPerWeek() {
    return clampWorkDays(getSettings().workDaysPerWeek);
}

/**
 * Daily target in minutes. Weekly goals are split across the configured work days.
 * Daily goals are the configured hours, capped under 9h.
 * @returns {number}
 */
export function getDailyTargetMinutes() {
    const settings = getSettings();
    if (settings.progressPeriod === 'daily') {
        return settings.goalHours * 60;
    }
    return (settings.goalHours * 60) / getWorkDaysPerWeek();
}

/**
 * Weekly target in minutes. Daily goals are multiplied by the configured work days.
 * @returns {number}
 */
export function getWeeklyTargetMinutes() {
    const settings = getSettings();
    if (settings.progressPeriod === 'weekly') {
        return settings.goalHours * 60;
    }
    return settings.goalHours * 60 * getWorkDaysPerWeek();
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
