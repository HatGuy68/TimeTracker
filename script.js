import * as timeTrackingService from './src/lib/services/timeTrackingService.js';
import * as settingsService from './src/lib/services/settingsService.js';

const liveDateElement = document.getElementById('live-date');
const headerDateElement = document.getElementById('header-date');
const liveTimeHoursMins = document.getElementById('live-time-hours-mins');
const liveTimeAmpm = document.getElementById('live-time-ampm');
const workingSinceElement = document.getElementById('working-since');
const workingStatusElement = document.getElementById('working-status');
const todayTotalElement = document.getElementById('today-total');
const goalLabelElement = document.getElementById('goal-label');
const clockActionButton = document.getElementById('clock-action-btn');
const clockActionLabel = document.getElementById('clock-action-label');
const clockActionIcon = document.getElementById('clock-action-icon');
const clockInButton = document.getElementById('clock-in-btn');
const clockOutButton = document.getElementById('clock-out-btn');
const sessionsListElement = document.getElementById('sessions-list');
const todaySessionsListElement = document.getElementById('today-sessions-list');
const mainView = document.getElementById('main-view');
const settingsView = document.getElementById('settings-view');
const settingsBtn = document.getElementById('settings-btn');
const liveLinkBtn = document.getElementById('live-link-btn');
const settingsBackBtn = document.getElementById('settings-back-btn');
const liveAppUrlInput = document.getElementById('live-app-url');
const copyLiveLinkBtn = document.getElementById('copy-live-link-btn');
const openLiveLinkBtn = document.getElementById('open-live-link-btn');
const goalHoursInput = document.getElementById('goal-hours');
const dataClearFrequencySelect = document.getElementById('data-clear-frequency');
const exportDataBtn = document.getElementById('export-data-btn');
const clearDataBtn = document.getElementById('clear-data-btn');
const progressPeriodInputs = document.querySelectorAll('input[name="progress-period"]');
const goalPresetBtns = document.querySelectorAll('.goal-preset-btn');

const PLAY_ICON = 'M8 5.14v14c0 .86.94 1.39 1.66.9l10-7c.61-.43.61-1.37 0-1.8l-10-7A1 1 0 0 0 8 5.14Z';
const STOP_ICON = 'M6 6h12v12H6z';

/** @type {number | null} */
let activeClockInTimestamp = null;
/** @type {string | null} */
let expandedSessionId = null;
/** @type {ReturnType<typeof setInterval> | null} */
let liveTickTimer = null;

/** @type {{
 *  isClockedIn: boolean,
 *  todaySessions: object[],
 *  todayClosedMinutes: number,
 *  weekClosedMinutes: number,
 *  weekRows: object[],
 *  monthClosedMinutes: number,
 *  dailyTargetMinutes: number,
 *  weeklyTargetMinutes: number,
 * }} */
let dashboard = {
    isClockedIn: false,
    todaySessions: [],
    todayClosedMinutes: 0,
    weekClosedMinutes: 0,
    weekRows: [],
    monthClosedMinutes: 0,
    dailyTargetMinutes: 8 * 60,
    weeklyTargetMinutes: 40 * 60,
};

function pad2(value) {
    return String(value).padStart(2, '0');
}

function formatDuration(minutes, style = 'full') {
    const total = Math.max(0, Math.round(minutes));
    const hours = Math.floor(total / 60);
    const remainingMinutes = total % 60;

    if (style === 'padded') {
        return `${pad2(hours)}h ${pad2(remainingMinutes)}m`;
    }
    if (style === 'compact') {
        if (total === 0) {
            return '—';
        }
        return remainingMinutes ? `${hours}h${pad2(remainingMinutes)}` : `${hours}h`;
    }
    if (hours === 0) {
        return `${remainingMinutes}m`;
    }
    if (remainingMinutes === 0) {
        return `${hours}h`;
    }
    return `${hours}h ${pad2(remainingMinutes)}m`;
}

function formatClock(timestamp) {
    return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function toTimeInputValue(timestamp) {
    const date = new Date(timestamp);
    return `${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
}

function applyTimeToTimestamp(originalTimestamp, timeValue) {
    const [hours, minutes] = timeValue.split(':').map(Number);
    const next = new Date(originalTimestamp);
    next.setHours(hours, minutes, 0, 0);
    return next.getTime();
}

function getElapsedMinutes(clockInTimestamp) {
    return Math.max(0, Math.floor((Date.now() - clockInTimestamp) / (1000 * 60)));
}

function getLiveTodayMinutes() {
    let total = dashboard.todayClosedMinutes;
    if (dashboard.isClockedIn && activeClockInTimestamp !== null) {
        total += getElapsedMinutes(activeClockInTimestamp);
    }
    return total;
}

function getLiveWeekMinutes() {
    let total = dashboard.weekClosedMinutes;
    if (dashboard.isClockedIn && activeClockInTimestamp !== null) {
        total += getElapsedMinutes(activeClockInTimestamp);
    }
    return total;
}

function getLiveMonthMinutes() {
    let total = dashboard.monthClosedMinutes;
    if (dashboard.isClockedIn && activeClockInTimestamp !== null) {
        total += getElapsedMinutes(activeClockInTimestamp);
    }
    return total;
}

function sessionDurationMinutes(session, now = Date.now()) {
    if (session.clockOut) {
        return Math.max(0, Math.floor((session.clockOut - session.clockIn) / (1000 * 60)));
    }
    return Math.max(0, Math.floor((now - session.clockIn) / (1000 * 60)));
}

function getBreakMinutes(sessions, now = Date.now()) {
    if (sessions.length < 2) {
        return 0;
    }

    let breaks = 0;
    for (let i = 1; i < sessions.length; i += 1) {
        const previousOut = sessions[i - 1].clockOut ?? now;
        const nextIn = sessions[i].clockIn;
        breaks += Math.max(0, Math.floor((nextIn - previousOut) / (1000 * 60)));
    }
    return breaks;
}

function countWeekdaysInclusive(start, end) {
    const cursor = new Date(start);
    cursor.setHours(0, 0, 0, 0);
    const last = new Date(end);
    last.setHours(0, 0, 0, 0);
    let count = 0;
    while (cursor <= last) {
        const day = cursor.getDay();
        if (day !== 0 && day !== 6) {
            count += 1;
        }
        cursor.setDate(cursor.getDate() + 1);
    }
    return count;
}

function getElapsedWorkdays(now = new Date()) {
    const day = now.getDay();
    if (day === 0) {
        return 1;
    }
    if (day === 6) {
        return 5;
    }
    return day;
}

function getRemainingWorkdays(now = new Date()) {
    const day = now.getDay();
    if (day === 0) {
        return 5;
    }
    if (day === 6 || day === 5) {
        return 0;
    }
    return 5 - day;
}

function setText(id, value) {
    const el = document.getElementById(id);
    if (el) {
        el.textContent = value;
    }
}

function updateConnectionState() {
    const online = navigator.onLine;
    const dot = document.getElementById('connection-dot');
    const label = document.getElementById('connection-label');
    if (!dot || !label) {
        return;
    }

    if (online) {
        dot.className = 'w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block';
        label.textContent = 'Online';
        label.className = 'text-emerald-300/90';
    } else {
        dot.className = 'w-1.5 h-1.5 rounded-full bg-slate-500 inline-block';
        label.textContent = 'Offline';
        label.className = '';
    }
}

function updateLiveClock() {
    const now = new Date();
    const longDate = now.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' }).toUpperCase();
    const compactDate = now.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }).toUpperCase();
    liveDateElement.textContent = longDate.replace(',', ' ·');
    if (headerDateElement) {
        headerDateElement.textContent = compactDate.replace(',', ' ·');
    }

    let hours = now.getHours();
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12 || 12;
    liveTimeHoursMins.textContent = `${pad2(hours)}:${pad2(now.getMinutes())}`;
    liveTimeAmpm.textContent = ampm;
}

function computeMetrics() {
    const now = Date.now();
    const todayMinutes = getLiveTodayMinutes();
    const weekMinutes = getLiveWeekMinutes();
    const monthMinutes = getLiveMonthMinutes();
    const dailyTarget = dashboard.dailyTargetMinutes;
    const weeklyTarget = dashboard.weeklyTargetMinutes;
    const remainingToday = Math.max(0, dailyTarget - todayMinutes);
    const overtimeToday = Math.max(0, todayMinutes - dailyTarget);
    const remainingWeek = Math.max(0, weeklyTarget - weekMinutes);
    const todayPct = dailyTarget ? Math.min(100, (todayMinutes / dailyTarget) * 100) : 0;
    const weekPct = weeklyTarget ? Math.min(100, (weekMinutes / weeklyTarget) * 100) : 0;
    const breakMinutes = getBreakMinutes(dashboard.todaySessions, now);
    const efficiency = todayMinutes + breakMinutes > 0
        ? Math.round((todayMinutes / (todayMinutes + breakMinutes)) * 100)
        : null;

    const firstSession = dashboard.todaySessions[0];
    const activeSession = dashboard.todaySessions.find(session => !session.clockOut) || null;
    const shiftStart = dashboard.isClockedIn && activeClockInTimestamp
        ? activeClockInTimestamp
        : firstSession?.clockIn ?? null;

    let expectedOut = null;
    if (remainingToday > 0) {
        expectedOut = now + remainingToday * 60 * 1000;
    }

    const elapsedWorkdays = getElapsedWorkdays();
    const remainingWorkdays = getRemainingWorkdays();
    const weeklyAverage = weekMinutes / Math.max(1, elapsedWorkdays);

    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);
    const workdaysThisMonth = Math.max(1, countWeekdaysInclusive(monthStart, new Date()));
    const monthOvertime = monthMinutes - workdaysThisMonth * dailyTarget;

    let pace = '—';
    let paceClass = 'tnum text-[11px] font-semibold text-slate-200';
    if (todayMinutes >= dailyTarget) {
        pace = overtimeToday > 0 ? 'Over target' : 'Target met';
        paceClass = 'tnum text-[11px] font-semibold text-emerald-400';
    } else if (dashboard.isClockedIn) {
        const expectedHour = expectedOut ? new Date(expectedOut).getHours() : 18;
        pace = expectedHour <= 19 ? 'On track' : 'Behind';
        paceClass = expectedHour <= 19
            ? 'tnum text-[11px] font-semibold text-emerald-400'
            : 'tnum text-[11px] font-semibold text-red-400';
    } else if (dashboard.todaySessions.length > 0) {
        pace = 'Paused';
        paceClass = 'tnum text-[11px] font-semibold text-amber-300';
    } else {
        pace = 'Not started';
    }

    return {
        todayMinutes,
        weekMinutes,
        remainingToday,
        overtimeToday,
        remainingWeek,
        todayPct,
        weekPct,
        breakMinutes,
        efficiency,
        shiftStart,
        expectedOut,
        weeklyAverage,
        remainingWorkdays,
        monthOvertime,
        pace,
        paceClass,
        sessionCount: dashboard.todaySessions.length,
        dailyTarget,
        weeklyTarget,
    };
}

function paintActionButton(metrics) {
    const worked = formatDuration(metrics.todayMinutes);
    if (dashboard.isClockedIn) {
        clockActionButton.className = 'w-full py-2.5 px-3 rounded-xl flex items-center justify-center gap-2.5 bg-emerald-500 text-[#04110a] font-bold text-sm tracking-wide transition-all duration-200 active:scale-[0.99] hover:bg-emerald-400';
        clockActionLabel.textContent = `Clock Out · Working ${worked}`;
        clockActionIcon.innerHTML = `<path d="${STOP_ICON}"/>`;
        clockActionButton.dataset.action = 'clock-out';
        clockInButton.disabled = true;
        clockOutButton.disabled = false;
    } else {
        clockActionButton.className = 'w-full py-2.5 px-3 rounded-xl flex items-center justify-center gap-2.5 bg-emerald-500 text-[#04110a] font-bold text-sm tracking-wide transition-all duration-200 active:scale-[0.99] hover:bg-emerald-400';
        const subtitle = dashboard.todaySessions.length > 0 ? "Resume today's shift" : "Start today's shift";
        clockActionLabel.textContent = `Clock In · ${subtitle}`;
        clockActionIcon.innerHTML = `<path d="${PLAY_ICON}"/>`;
        clockActionButton.dataset.action = 'clock-in';
        clockInButton.disabled = false;
        clockOutButton.disabled = true;
    }
}

function paintStatus(metrics) {
    const statusDot = document.getElementById('work-status-dot');
    const statusLabel = document.getElementById('work-status-label');
    const statusBadge = document.getElementById('work-status-badge');
    const remainingEl = document.getElementById('today-remaining');
    const progressFill = document.getElementById('today-progress-fill');

    if (dashboard.isClockedIn) {
        statusDot.className = 'w-1.5 h-1.5 rounded-full bg-emerald-400 pulse-dot';
        statusLabel.textContent = 'Working';
        statusBadge.className = 'inline-flex items-center gap-1.5 text-[11px] font-bold tracking-[0.16em] uppercase text-emerald-400';
        workingStatusElement.textContent = 'Clocked In';
    } else {
        statusDot.className = 'w-1.5 h-1.5 rounded-full bg-slate-500';
        statusLabel.textContent = 'Clocked out';
        statusBadge.className = 'inline-flex items-center gap-1.5 text-[11px] font-bold tracking-[0.16em] uppercase text-slate-400';
        workingStatusElement.textContent = 'Not Clocked In';
    }

    setText('elapsed-display', formatDuration(metrics.todayMinutes, 'padded'));

    if (metrics.overtimeToday > 0) {
        remainingEl.textContent = `+${formatDuration(metrics.overtimeToday, 'padded')}`;
        remainingEl.className = 'tnum text-sm font-semibold text-emerald-400 mt-0.5';
    } else {
        remainingEl.textContent = formatDuration(metrics.remainingToday, 'padded');
        remainingEl.className = 'tnum text-sm font-semibold text-slate-200 mt-0.5';
    }

    setText('shift-start', metrics.shiftStart ? formatClock(metrics.shiftStart) : '—');
    setText('shift-end', metrics.expectedOut ? formatClock(metrics.expectedOut) : 'Target met');

    if (dashboard.isClockedIn && activeClockInTimestamp !== null) {
        const elapsed = formatDuration(getElapsedMinutes(activeClockInTimestamp));
        workingSinceElement.textContent = `Since ${formatClock(activeClockInTimestamp)} · ${elapsed}`;
        workingSinceElement.classList.remove('hidden');
    } else {
        workingSinceElement.classList.add('hidden');
    }

    const fillClass = metrics.todayPct >= 100
        ? 'h-full rounded-full bg-emerald-400 transition-all duration-500'
        : 'h-full rounded-full bg-blue-500 transition-all duration-500';
    progressFill.className = fillClass;
    progressFill.style.width = `${metrics.todayPct}%`;
    setText('today-progress-pct', `${Math.round(metrics.todayPct)}%`);
    setText(
        'today-progress-label',
        `${formatDuration(metrics.todayMinutes)} / ${formatDuration(metrics.dailyTarget, 'padded')}`
    );
}

function paintStats(metrics) {
    setText('stat-worked', formatDuration(metrics.todayMinutes, 'padded'));
    setText('stat-target', formatDuration(metrics.dailyTarget, 'padded'));
    setText(
        'stat-remaining',
        metrics.overtimeToday > 0
            ? `+${formatDuration(metrics.overtimeToday)}`
            : formatDuration(metrics.remainingToday, 'padded')
    );
    setText('stat-breaks', formatDuration(metrics.breakMinutes));
    setText('stat-sessions', String(metrics.sessionCount));
    setText('stat-efficiency', metrics.efficiency == null ? '—' : `${metrics.efficiency}%`);

    const remainingEl = document.getElementById('stat-remaining');
    if (remainingEl) {
        remainingEl.className = metrics.overtimeToday > 0
            ? 'tnum text-[15px] font-semibold text-emerald-400 mt-0.5'
            : 'tnum text-[15px] font-semibold text-white mt-0.5';
    }
}

function paintWeek(metrics) {
    const weekFill = document.getElementById('week-progress-fill');
    setText('week-totals', `${formatDuration(metrics.weekMinutes, 'padded')} / ${formatDuration(metrics.weeklyTarget, 'padded')}`);
    weekFill.className = metrics.weekPct >= 100
        ? 'h-full rounded-full bg-emerald-400 transition-all duration-500'
        : 'h-full rounded-full bg-blue-500 transition-all duration-500';
    weekFill.style.width = `${metrics.weekPct}%`;
    setText('week-progress-pct', `${metrics.weekPct.toFixed(1).replace(/\.0$/, '')}%`);

    const remainingLabel = metrics.remainingWeek > 0
        ? `${formatDuration(metrics.remainingWeek)} left`
        : 'Goal reached';
    const daysLabel = metrics.remainingWorkdays === 1
        ? '1 day remaining'
        : `${metrics.remainingWorkdays} days remaining`;
    setText(
        'week-meta',
        `${remainingLabel} · Avg ${formatDuration(metrics.weeklyAverage)}/day · ${daysLabel}`
    );
    setText('week-target-hint', `${formatDuration(metrics.dailyTarget)}/day`);

    const settings = settingsService.getSettings();
    const periodLabel = settings.progressPeriod === 'daily' ? 'DAILY' : 'WEEKLY';
    goalLabelElement.textContent = `${periodLabel} GOAL: ${settings.goalHours}H`;
    todayTotalElement.textContent = metrics.remainingWeek > 0
        ? `${formatDuration(metrics.remainingWeek)} left`
        : 'Goal achieved!';
}

function paintInsights(metrics) {
    setText('insight-avg', formatDuration(metrics.weeklyAverage));
    setText('insight-week', `${metrics.weekPct.toFixed(1).replace(/\.0$/, '')}%`);
    const paceEl = document.getElementById('insight-pace');
    if (paceEl) {
        paceEl.textContent = metrics.pace;
        paceEl.className = metrics.paceClass;
    }
    setText('insight-done-by', metrics.expectedOut ? formatClock(metrics.expectedOut) : 'Target met');

    const overtimeEl = document.getElementById('insight-overtime');
    if (overtimeEl) {
        const sign = metrics.monthOvertime >= 0 ? '+' : '−';
        overtimeEl.textContent = `${sign}${formatDuration(Math.abs(metrics.monthOvertime))}`;
        overtimeEl.className = metrics.monthOvertime >= 0
            ? 'tnum text-[11px] font-semibold text-emerald-400'
            : 'tnum text-[11px] font-semibold text-red-400';
    }
}

function paintTodayChartRow(metrics) {
    const todayRow = sessionsListElement.querySelector('[data-today-row]');
    if (!todayRow) {
        return;
    }

    const fill = todayRow.querySelector('.week-bar-fill');
    if (fill) {
        const width = metrics.dailyTarget
            ? Math.min(100, (metrics.todayMinutes / metrics.dailyTarget) * 100)
            : 0;
        fill.style.width = `${width}%`;
        fill.className = metrics.todayMinutes >= metrics.dailyTarget
            ? 'week-bar-fill h-full rounded-full bg-emerald-400 transition-all duration-500'
            : 'week-bar-fill h-full rounded-full bg-blue-400 transition-all duration-500';
    }

    const durationEl = todayRow.querySelector('.week-day-duration');
    if (durationEl) {
        durationEl.textContent = metrics.todayMinutes > 0
            ? formatDuration(metrics.todayMinutes, 'compact')
            : '—';
    }
}

function paintLiveSessionDurations(metrics) {
    todaySessionsListElement.querySelectorAll('[data-session-id]').forEach((row) => {
        const session = dashboard.todaySessions.find(item => item.clockInId === row.dataset.sessionId);
        if (!session) {
            return;
        }
        const durationEl = row.querySelector('[data-session-duration]');
        const endEl = row.querySelector('[data-session-end]');
        if (durationEl) {
            durationEl.textContent = formatDuration(sessionDurationMinutes(session), 'padded');
        }
        if (endEl && !session.clockOut) {
            endEl.textContent = 'NOW';
        }
    });
    setText('sessions-total', `Total ${formatDuration(metrics.todayMinutes, 'padded')}`);
}

function paintLiveMetrics() {
    const metrics = computeMetrics();
    paintStatus(metrics);
    paintActionButton(metrics);
    paintStats(metrics);
    paintWeek(metrics);
    paintInsights(metrics);
    paintTodayChartRow(metrics);
    paintLiveSessionDurations(metrics);
}

function updateElapsedDisplay() {
    if (!dashboard.isClockedIn || activeClockInTimestamp === null) {
        return;
    }
    paintLiveMetrics();
}

function syncLiveTicker() {
    if (liveTickTimer) {
        clearInterval(liveTickTimer);
        liveTickTimer = null;
    }
    if (dashboard.isClockedIn) {
        liveTickTimer = setInterval(updateElapsedDisplay, 1000);
    }
}

function renderWeeklyActivityChart() {
    const dailyTarget = dashboard.dailyTargetMinutes;
    sessionsListElement.innerHTML = '';
    sessionsListElement.className = 'space-y-1.5 w-full';

    dashboard.weekRows.forEach((row) => {
        const barWidth = dailyTarget ? Math.min(100, (row.totalMinutes / dailyTarget) * 100) : 0;
        const metTarget = row.totalMinutes >= dailyTarget && row.totalMinutes > 0;
        const labelClass = row.isToday
            ? 'w-8 text-[11px] font-bold text-white uppercase'
            : 'w-8 text-[11px] font-semibold text-slate-500 uppercase';
        const fillClass = row.isToday
            ? (metTarget ? 'week-bar-fill h-full rounded-full bg-emerald-400 transition-all duration-500' : 'week-bar-fill h-full rounded-full bg-blue-400 transition-all duration-500')
            : (metTarget ? 'week-bar-fill h-full rounded-full bg-emerald-500/80 transition-all duration-500' : 'week-bar-fill h-full rounded-full bg-blue-500/80 transition-all duration-500');
        const durationText = row.totalMinutes > 0 ? formatDuration(row.totalMinutes, 'compact') : '—';

        const rowEl = document.createElement('div');
        rowEl.className = row.isToday
            ? 'flex items-center gap-2.5 py-0.5'
            : 'flex items-center gap-2.5';
        if (row.isToday) {
            rowEl.dataset.todayRow = 'true';
            rowEl.dataset.baseMinutes = String(row.baseMinutes);
        }

        rowEl.innerHTML = `
            <span class="${labelClass}">${row.label}</span>
            <div class="relative flex-1 h-1.5 bg-[#1e293b] rounded-full overflow-hidden">
                <div class="${fillClass}" style="width: ${barWidth}%"></div>
            </div>
            <span class="week-day-duration w-12 text-right tnum text-[11px] ${row.isToday ? 'text-slate-200 font-semibold' : 'text-slate-500'}">${durationText}</span>
            <span class="w-2.5 ${row.isToday ? 'text-emerald-400' : 'text-transparent'}">●</span>
        `;
        sessionsListElement.appendChild(rowEl);
    });
}

function renderTodaySessions() {
    todaySessionsListElement.innerHTML = '';

    if (dashboard.todaySessions.length === 0) {
        const empty = document.createElement('div');
        empty.className = 'py-3 text-[12px] text-slate-500';
        empty.textContent = 'No sessions yet today.';
        todaySessionsListElement.appendChild(empty);
        setText('sessions-total', `Total ${formatDuration(0, 'padded')}`);
        return;
    }

    dashboard.todaySessions.forEach((session) => {
        const sessionId = session.clockInId || String(session.clockIn);
        const isExpanded = expandedSessionId === sessionId;
        const isActive = !session.clockOut;
        const duration = sessionDurationMinutes(session);

        const row = document.createElement('div');
        row.dataset.sessionId = sessionId;
        row.className = 'py-1.5';

        const header = document.createElement('button');
        header.type = 'button';
        header.className = 'w-full flex items-center justify-between gap-3 text-left py-1 rounded-md hover:bg-white/5 transition-colors';
        header.innerHTML = `
            <span class="tnum text-[12px] font-medium text-slate-300">
                ${formatClock(session.clockIn)} → <span data-session-end>${isActive ? 'NOW' : formatClock(session.clockOut)}</span>
            </span>
            <span class="flex items-center gap-2">
                <span data-session-duration class="tnum text-[12px] font-semibold text-slate-200">${formatDuration(duration, 'padded')}</span>
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" class="w-3.5 h-3.5 text-slate-500 transition-transform ${isExpanded ? 'rotate-180' : ''}">
                  <path stroke-linecap="round" stroke-linejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
                </svg>
            </span>
        `;
        header.addEventListener('click', () => {
            expandedSessionId = isExpanded ? null : sessionId;
            renderTodaySessions();
            paintLiveMetrics();
        });
        row.appendChild(header);

        if (isExpanded) {
            const editor = document.createElement('form');
            editor.className = 'mt-1.5 mb-1 grid grid-cols-[1fr_1fr_auto] gap-2 items-end bg-[#070b14] border border-slate-800/80 rounded-lg p-2';
            editor.innerHTML = `
                <label class="block">
                    <span class="block text-[10px] font-bold tracking-wider text-slate-500 uppercase mb-1">In</span>
                    <input name="clock-in" type="time" value="${toTimeInputValue(session.clockIn)}" class="w-full bg-[#0b1220] border border-slate-700 rounded-md px-2 py-1.5 text-xs text-white tnum focus:outline-none focus:border-blue-500/50" />
                </label>
                <label class="block">
                    <span class="block text-[10px] font-bold tracking-wider text-slate-500 uppercase mb-1">Out</span>
                    <input name="clock-out" type="time" ${isActive ? 'disabled' : ''} value="${session.clockOut ? toTimeInputValue(session.clockOut) : ''}" class="w-full bg-[#0b1220] border border-slate-700 rounded-md px-2 py-1.5 text-xs text-white tnum focus:outline-none focus:border-blue-500/50 disabled:opacity-40" />
                </label>
                <button type="submit" class="h-[34px] px-3 rounded-md bg-blue-500/20 border border-blue-500/40 text-blue-300 text-xs font-semibold hover:bg-blue-500/30 transition-colors">Save</button>
            `;
            editor.addEventListener('submit', async (event) => {
                event.preventDefault();
                const formData = new FormData(editor);
                const inValue = String(formData.get('clock-in') || '');
                const outValue = String(formData.get('clock-out') || '');
                const clockInTimestamp = applyTimeToTimestamp(session.clockIn, inValue);
                let clockOutTimestamp;
                if (!isActive && outValue) {
                    clockOutTimestamp = applyTimeToTimestamp(session.clockOut || session.clockIn, outValue);
                    if (clockOutTimestamp <= clockInTimestamp) {
                        alert('Clock-out must be after clock-in.');
                        return;
                    }
                }

                await timeTrackingService.updateSessionTimestamps({
                    clockInId: session.clockInId,
                    clockInTimestamp,
                    clockOutId: session.clockOutId,
                    clockOutTimestamp,
                });
                await updateUI();
            });
            row.appendChild(editor);
        }

        todaySessionsListElement.appendChild(row);
    });
}

function buildWeekRows(weekSummary) {
    const weekStart = timeTrackingService.getWeekStartDate();
    const todayKey = timeTrackingService.toLocalDateKey(new Date());
    const rows = [];

    for (let i = 0; i < 7; i += 1) {
        const date = new Date(weekStart);
        date.setDate(weekStart.getDate() + i);
        const dateKey = timeTrackingService.toLocalDateKey(date);
        const isToday = dateKey === todayKey;
        const baseMinutes = weekSummary.get(dateKey)?.totalMinutes ?? 0;
        let totalMinutes = baseMinutes;
        if (isToday && dashboard.isClockedIn && activeClockInTimestamp !== null) {
            totalMinutes += getElapsedMinutes(activeClockInTimestamp);
        }
        rows.push({
            dateKey,
            label: date.toLocaleDateString('en-US', { weekday: 'short' }),
            totalMinutes,
            baseMinutes,
            isToday,
        });
    }

    return rows;
}

function closedMinutesFromSummaryMap(summaryMap) {
    let total = 0;
    summaryMap.forEach((day) => {
        total += day.totalMinutes;
    });
    return total;
}

async function updateUI() {
    const isClockedIn = await timeTrackingService.isCurrentlyClockedIn();
    const currentSession = await timeTrackingService.getCurrentSession();
    const weekSummary = await timeTrackingService.getWeekSummary();
    const todaySummary = await timeTrackingService.getTodaySummary();
    const monthSummary = await timeTrackingService.getMonthSummary();

    dashboard.isClockedIn = isClockedIn;
    dashboard.todaySessions = todaySummary?.sessions ? [...todaySummary.sessions] : [];
    dashboard.todayClosedMinutes = dashboard.todaySessions.reduce((sum, session) => {
        if (!session.clockOut) {
            return sum;
        }
        return sum + sessionDurationMinutes(session);
    }, 0);
    dashboard.weekClosedMinutes = closedMinutesFromSummaryMap(weekSummary);
    dashboard.monthClosedMinutes = closedMinutesFromSummaryMap(monthSummary);
    dashboard.dailyTargetMinutes = settingsService.getDailyTargetMinutes();
    dashboard.weeklyTargetMinutes = settingsService.getWeeklyTargetMinutes();

    if (isClockedIn && currentSession) {
        activeClockInTimestamp = currentSession.clockIn;
        const alreadyListed = dashboard.todaySessions.some(session => !session.clockOut);
        if (!alreadyListed) {
            dashboard.todaySessions.push({
                clockIn: currentSession.clockIn,
                clockInId: currentSession.clockInId,
                durationMinutes: currentSession.durationMinutes,
            });
        }
    } else {
        activeClockInTimestamp = null;
    }

    dashboard.weekRows = buildWeekRows(weekSummary);

    renderWeeklyActivityChart();
    renderTodaySessions();
    paintLiveMetrics();
    syncLiveTicker();
}

/** @type {string | null} */
let cachedLiveAppUrl = null;

function normalizeLiveUrl(url) {
    if (!url) {
        return null;
    }
    return url.endsWith('/') ? url : `${url}/`;
}

function getDeployedAppUrl() {
    if (location.protocol === 'chrome-extension:') {
        return null;
    }

    if (location.hostname.endsWith('github.io')) {
        const path = location.pathname.replace(/\/?index\.html$/, '');
        const basePath = path.endsWith('/') ? path : `${path}/`;
        return normalizeLiveUrl(`${location.origin}${basePath}`);
    }

    return null;
}

async function getAppLiveUrl() {
    if (cachedLiveAppUrl) {
        return cachedLiveAppUrl;
    }

    const deployedUrl = getDeployedAppUrl();
    if (deployedUrl) {
        cachedLiveAppUrl = deployedUrl;
        return deployedUrl;
    }

    try {
        const response = await fetch('./site.config.json');
        if (response.ok) {
            const config = await response.json();
            cachedLiveAppUrl = normalizeLiveUrl(config.liveUrl);
            return cachedLiveAppUrl;
        }
    } catch {
        // Ignore fetch errors in offline or extension contexts.
    }

    cachedLiveAppUrl = normalizeLiveUrl(window.location.href.replace(/\/?index\.html$/, '/'));
    return cachedLiveAppUrl;
}

async function populateLiveAppLink() {
    const url = await getAppLiveUrl();
    if (liveAppUrlInput && url) {
        liveAppUrlInput.value = url;
    }
}

async function openLiveAppLink() {
    const url = await getAppLiveUrl();
    if (url) {
        window.open(url, '_blank', 'noopener,noreferrer');
    }
}

async function copyLiveAppLink() {
    const url = await getAppLiveUrl();
    if (!url) {
        return;
    }

    try {
        await navigator.clipboard.writeText(url);
        if (copyLiveLinkBtn) {
            const originalText = copyLiveLinkBtn.textContent;
            copyLiveLinkBtn.textContent = 'Copied!';
            setTimeout(() => {
                copyLiveLinkBtn.textContent = originalText;
            }, 1500);
        }
    } catch {
        if (liveAppUrlInput) {
            liveAppUrlInput.select();
            document.execCommand('copy');
        }
    }
}

function showSettings() {
    populateSettingsForm();
    populateLiveAppLink();
    mainView.classList.add('hidden');
    settingsView.classList.remove('hidden');
}

function showMain() {
    settingsView.classList.add('hidden');
    mainView.classList.remove('hidden');
}

function populateSettingsForm() {
    const settings = settingsService.getSettings();

    progressPeriodInputs.forEach(input => {
        input.checked = input.value === settings.progressPeriod;
    });

    goalHoursInput.value = String(settings.goalHours);
    dataClearFrequencySelect.value = settings.dataClearFrequency;
}

function handleSettingsChange() {
    const selectedPeriod = document.querySelector('input[name="progress-period"]:checked');
    const goalHours = Math.min(168, Math.max(1, parseInt(goalHoursInput.value, 10) || 40));

    settingsService.saveSettings({
        progressPeriod: selectedPeriod?.value === 'daily' ? 'daily' : 'weekly',
        goalHours,
        dataClearFrequency: dataClearFrequencySelect.value,
    });

    goalHoursInput.value = String(goalHours);
    updateUI();
}

async function exportDataAsJson() {
    const json = await timeTrackingService.exportData();
    const date = new Date().toISOString().split('T')[0];
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `timetracker-export-${date}.json`;
    link.click();
    URL.revokeObjectURL(url);
}

async function clearAllDataNow() {
    const confirmed = confirm('Clear all time entry data? This cannot be undone.');
    if (!confirmed) {
        return;
    }

    await timeTrackingService.clearAllData();
    activeClockInTimestamp = null;
    expandedSessionId = null;
    showMain();
    await updateUI();
}

async function runAutoClearIfNeeded() {
    if (!settingsService.shouldAutoClear()) {
        return;
    }

    await timeTrackingService.clearAllData();
    settingsService.markAutoClearComplete();
    activeClockInTimestamp = null;
    expandedSessionId = null;
    await updateUI();
}

async function handleClockAction() {
    const action = clockActionButton.dataset.action;
    if (action === 'clock-out') {
        await timeTrackingService.clockOut();
    } else {
        await timeTrackingService.clockIn();
    }
    await updateUI();
}

clockActionButton.addEventListener('click', handleClockAction);
clockInButton.addEventListener('click', async () => {
    if (clockInButton.disabled) {
        return;
    }
    await timeTrackingService.clockIn();
    await updateUI();
});
clockOutButton.addEventListener('click', async () => {
    if (clockOutButton.disabled) {
        return;
    }
    await timeTrackingService.clockOut();
    await updateUI();
});

settingsBtn.addEventListener('click', showSettings);
liveLinkBtn.addEventListener('click', openLiveAppLink);
settingsBackBtn.addEventListener('click', showMain);
copyLiveLinkBtn.addEventListener('click', copyLiveAppLink);
openLiveLinkBtn.addEventListener('click', openLiveAppLink);

progressPeriodInputs.forEach(input => {
    input.addEventListener('change', handleSettingsChange);
});

goalHoursInput.addEventListener('change', handleSettingsChange);
dataClearFrequencySelect.addEventListener('change', handleSettingsChange);

goalPresetBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        goalHoursInput.value = btn.dataset.goalHours;
        handleSettingsChange();
    });
});

exportDataBtn.addEventListener('click', exportDataAsJson);
clearDataBtn.addEventListener('click', clearAllDataNow);

window.addEventListener('online', updateConnectionState);
window.addEventListener('offline', updateConnectionState);

function preventBrowserZoom() {
    document.addEventListener('wheel', (event) => {
        if (event.ctrlKey) {
            event.preventDefault();
        }
    }, { passive: false });

    document.addEventListener('gesturestart', (event) => {
        event.preventDefault();
    }, { passive: false });
}

async function handleLaunchAction() {
    const params = new URLSearchParams(location.search);
    const action = params.get('action');
    if (!action) {
        return;
    }

    history.replaceState(null, '', location.pathname);

    if (action === 'settings') {
        showSettings();
        return;
    }

    if (action === 'clock-in' && !clockInButton.disabled) {
        await timeTrackingService.clockIn();
        await updateUI();
        return;
    }

    if (action === 'clock-out' && !clockOutButton.disabled) {
        await timeTrackingService.clockOut();
        await updateUI();
    }
}

async function importLaunchFile(fileHandle) {
    const file = await fileHandle.getFile();
    const text = await file.text();

    const confirmed = confirm(`Import time entries from "${file.name}"? This replaces all existing data.`);
    if (!confirmed) {
        return;
    }

    await timeTrackingService.importData(text);
    activeClockInTimestamp = null;
    expandedSessionId = null;
    showMain();
    await updateUI();
}

function registerLaunchQueueConsumer() {
    if (!('launchQueue' in window)) {
        return;
    }

    launchQueue.setConsumer(async (launchParams) => {
        const files = launchParams.files;
        if (!files?.length) {
            return;
        }

        try {
            await importLaunchFile(files[0]);
        } catch (error) {
            alert(`Could not import file: ${error instanceof Error ? error.message : 'Invalid file'}`);
        }
    });
}

document.addEventListener('DOMContentLoaded', async () => {
    preventBrowserZoom();
    registerLaunchQueueConsumer();
    updateConnectionState();
    updateLiveClock();
    await populateLiveAppLink();
    await runAutoClearIfNeeded();
    await updateUI();
    await handleLaunchAction();
    setInterval(updateLiveClock, 1000);
    setInterval(updateUI, 1000 * 30);
    setInterval(runAutoClearIfNeeded, 60_000);
});

function isExtensionContext() {
    return location.protocol === 'chrome-extension:';
}

if ('serviceWorker' in navigator && !isExtensionContext()) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js', { scope: './' }).catch((error) => {
      console.error('Service worker registration failed:', error)
    })
  })
}
