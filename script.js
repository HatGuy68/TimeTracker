import * as timeTrackingService from './src/lib/services/timeTrackingService.js';
import * as settingsService from './src/lib/services/settingsService.js';

// DOM Elements
const liveDateElement = document.getElementById('live-date');
const liveTimeHoursMins = document.getElementById('live-time-hours-mins');
const liveTimeAmpm = document.getElementById('live-time-ampm');
const workingSinceElement = document.getElementById('working-since');
const todayTotalElement = document.getElementById('today-total');
const goalLabelElement = document.getElementById('goal-label');
const clockInButton = document.getElementById('clock-in-btn');
const clockOutButton = document.getElementById('clock-out-btn');
const sessionsListElement = document.getElementById('sessions-list');
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

/** @type {number | null} */
let activeClockInTimestamp = null;

function formatDuration(minutes) {
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = Math.round(minutes % 60);
    return `${hours}h ${remainingMinutes}m`;
}

function getElapsedMinutes(clockInTimestamp) {
    return Math.floor((Date.now() - clockInTimestamp) / (1000 * 60));
}

function updateElapsedDisplay() {
    if (activeClockInTimestamp === null) {
        return;
    }

    const elapsed = formatDuration(getElapsedMinutes(activeClockInTimestamp));
    const startTime = new Date(activeClockInTimestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    workingSinceElement.textContent = `Started ${startTime} · ${elapsed} elapsed`;
    workingSinceElement.classList.remove('hidden');

    const ongoingBadge = sessionsListElement.querySelector('.ongoing-duration-badge');
    if (ongoingBadge) {
        ongoingBadge.textContent = elapsed;
    }
}

function updateLiveClock() {
    const now = new Date();
    const options = { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' };
    liveDateElement.textContent = now.toLocaleDateString('en-US', options).toUpperCase();

    let hours = now.getHours();
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12 || 12;
    const minutes = String(now.getMinutes()).padStart(2, '0');
    liveTimeHoursMins.textContent = `${String(hours).padStart(2, '0')}:${minutes}`;
    liveTimeAmpm.textContent = ampm;
}

function getProgressMinutes(weekSummary, todaySummary, isClockedIn) {
    const settings = settingsService.getSettings();
    const goalMinutes = settingsService.getGoalMinutes();

    if (settings.progressPeriod === 'daily') {
        let totalMinutesToday = todaySummary?.totalMinutes ?? 0;
        if (isClockedIn && activeClockInTimestamp !== null) {
            totalMinutesToday += getElapsedMinutes(activeClockInTimestamp);
        }
        return { totalMinutes: totalMinutesToday, goalMinutes };
    }

    let totalMinutesThisWeek = 0;
    weekSummary.forEach(day => {
        totalMinutesThisWeek += day.totalMinutes;
    });
    if (isClockedIn && activeClockInTimestamp !== null) {
        totalMinutesThisWeek += getElapsedMinutes(activeClockInTimestamp);
    }
    return { totalMinutes: totalMinutesThisWeek, goalMinutes };
}

function updateGoalLabel() {
    const settings = settingsService.getSettings();
    const periodLabel = settings.progressPeriod === 'daily' ? 'DAILY' : 'WEEKLY';
    goalLabelElement.textContent = `${periodLabel} GOAL: ${settings.goalHours}H`;
}

async function updateUI() {
    const isClockedIn = await timeTrackingService.isCurrentlyClockedIn();
    const currentSession = await timeTrackingService.getCurrentSession();

    const weekSummary = await timeTrackingService.getWeekSummary();
    const todaySummary = await timeTrackingService.getTodaySummary();

    const inIconBox = clockInButton.querySelector('.btn-icon-box');
    const inTitle = clockInButton.querySelector('.btn-title');
    const inSubtitle = clockInButton.querySelector('.btn-subtitle');

    const outIconBox = clockOutButton.querySelector('.btn-icon-box');
    const outTitle = clockOutButton.querySelector('.btn-title');
    const outSubtitle = clockOutButton.querySelector('.btn-subtitle');

    if (isClockedIn) {
        clockInButton.disabled = true;
        clockInButton.className = "w-full bg-[#34d399]/5 border border-[#34d399]/10 opacity-40 text-slate-500 p-4 rounded-2xl flex items-center gap-4 cursor-not-allowed";
        if (inIconBox) inIconBox.className = "btn-icon-box bg-[#34d399]/20 text-[#34d399]/40 p-3 rounded-xl shadow-none";
        if (inTitle) inTitle.className = "btn-title font-bold text-base text-[#34d399]/60";
        if (inSubtitle) inSubtitle.className = "btn-subtitle text-xs text-[#34d399]/40 font-medium";

        clockOutButton.disabled = false;
        clockOutButton.className = "w-full bg-[#ef4444]/10 border border-[#ef4444]/20 hover:bg-[#ef4444]/20 text-white p-4 rounded-2xl flex items-center gap-4 transition-all duration-200 active:scale-[0.99]";
        if (outIconBox) outIconBox.className = "btn-icon-box bg-[#ef4444] text-[#05070f] p-3 rounded-xl shadow-lg shadow-[#ef4444]/20";
        if (outTitle) outTitle.className = "btn-title font-bold text-base text-[#ef4444]";
        if (outSubtitle) outSubtitle.className = "btn-subtitle text-xs text-[#ef4444]/70 font-medium";

        if (currentSession) {
            activeClockInTimestamp = currentSession.clockIn;
            updateElapsedDisplay();
        }
    } else {
        activeClockInTimestamp = null;
        clockInButton.disabled = false;
        clockInButton.className = "w-full bg-[#34d399]/10 border border-[#34d399]/20 hover:bg-[#34d399]/20 text-white p-4 rounded-2xl flex items-center gap-4 transition-all duration-200 active:scale-[0.99]";
        if (inIconBox) inIconBox.className = "btn-icon-box bg-[#34d399] text-[#05070f] p-3 rounded-xl shadow-lg shadow-[#34d399]/20";
        if (inTitle) inTitle.className = "btn-title font-bold text-base text-[#34d399]";
        if (inSubtitle) inSubtitle.className = "btn-subtitle text-xs text-[#34d399]/70 font-medium";

        clockOutButton.disabled = true;
        clockOutButton.className = "w-full bg-[#ef4444]/5 border border-[#ef4444]/10 opacity-40 text-slate-500 p-4 rounded-2xl flex items-center gap-4 cursor-not-allowed";
        if (outIconBox) outIconBox.className = "btn-icon-box bg-[#ef4444]/20 text-[#ef4444]/40 p-3 rounded-xl";
        if (outTitle) outTitle.className = "btn-title font-bold text-base text-[#ef4444]/60";
        if (outSubtitle) outSubtitle.className = "btn-subtitle text-xs text-[#ef4444]/40 font-medium";

        workingSinceElement.classList.add('hidden');
    }

    updateGoalLabel();

    const { totalMinutes, goalMinutes } = getProgressMinutes(weekSummary, todaySummary, isClockedIn);
    const remainingMinutes = Math.max(0, goalMinutes - totalMinutes);
    todayTotalElement.textContent = remainingMinutes > 0 ? `${formatDuration(remainingMinutes)} left` : `Goal achieved!`;

    const percentage = Math.min(100, (totalMinutes / goalMinutes) * 100);
    const progressBar = document.querySelector('.bg-blue-500');
    if (progressBar) {
        progressBar.style.width = `${percentage}%`;
    }

    if (todaySummary && todaySummary.sessions && todaySummary.sessions.length > 0) {
        renderRecentSessions(todaySummary.sessions);
    } else {
        sessionsListElement.innerHTML = `
            <div class="bg-slate-900/40 p-3.5 rounded-full text-slate-600 mb-3">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-6 h-6">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                </svg>
            </div>
            <p class="text-sm font-semibold text-slate-400">No shifts logged this week</p>
            <p class="text-xs text-slate-500 mt-1 max-w-[200px]">Clock in to start tracking your time</p>
        `;
        sessionsListElement.className = "flex-1 flex flex-col items-center justify-center text-center p-4";
    }
}

function renderRecentSessions(sessions) {
    sessionsListElement.innerHTML = '';
    sessionsListElement.className = "space-y-3 w-full overflow-y-auto max-h-[300px] pr-1 text-left";

    sessions.forEach(session => {
        const sessionDiv = document.createElement('div');
        sessionDiv.className = "bg-slate-900/50 p-4 rounded-xl border border-slate-800/40 flex justify-between items-center transition-all";

        const clockInTime = new Date(session.clockIn).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const clockOutTime = session.clockOut ? new Date(session.clockOut).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--:--';
        const duration = session.clockOut
            ? formatDuration(session.durationMinutes)
            : formatDuration(getElapsedMinutes(session.clockIn));
        const durationBadgeClass = session.clockOut
            ? 'text-xs font-semibold px-2.5 py-1 rounded-md bg-slate-800 text-slate-300'
            : 'ongoing-duration-badge text-xs font-semibold px-2.5 py-1 rounded-md bg-green-500/10 text-green-400';

        sessionDiv.innerHTML = `
            <div class="flex flex-col gap-0.5">
                <p class="text-sm font-bold text-white tracking-tight">${clockInTime} — ${clockOutTime}</p>
                <p class="text-xs text-slate-400">Logged Shift</p>
                ${session.note ? `<p class="text-[11px] text-blue-400 mt-1 italic">Note: ${session.note}</p>` : ''}
            </div>
            <div class="text-right">
                <span class="${durationBadgeClass}">${duration}</span>
            </div>
        `;
        sessionsListElement.appendChild(sessionDiv);
    });
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
    await updateUI();
}

clockInButton.addEventListener('click', async () => {
    await timeTrackingService.clockIn();
    await updateUI();
});

clockOutButton.addEventListener('click', async () => {
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
    updateLiveClock();
    await populateLiveAppLink();
    await runAutoClearIfNeeded();
    await updateUI();
    await handleLaunchAction();
    setInterval(updateLiveClock, 60_000);
    setInterval(updateElapsedDisplay, 60_000);
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
