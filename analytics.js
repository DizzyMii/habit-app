// analytics.js — Chart.js powered analytics panel
// Requires Chart.js loaded via CDN before this script

(function () {
    // Wait for DOM and main app data
    document.addEventListener('DOMContentLoaded', () => {
        const toggleBtn = document.getElementById('analytics-toggle-btn');
        const panel = document.getElementById('analytics-panel');

        if (!toggleBtn || !panel) return;

        toggleBtn.addEventListener('click', () => {
            const isVisible = panel.classList.toggle('open');
            toggleBtn.textContent = isVisible ? '📊 Hide Analytics' : '📊 Show Analytics';
            if (isVisible) renderCharts();
        });
    });

    function getAppData() {
        const raw = localStorage.getItem('habitJournalDataV5');
        return raw ? JSON.parse(raw) : null;
    }

    // Pixel-art chart defaults
    const pixelFont = "'Minecraft', sans-serif";
    const inkColor = '#5D4037';
    const accentColor = '#E8D5C4';

    function getChartDefaults() {
        return {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    labels: {
                        font: { family: pixelFont, size: 11 },
                        color: inkColor
                    }
                }
            },
            scales: {
                x: {
                    ticks: { font: { family: pixelFont, size: 10 }, color: inkColor },
                    grid: { color: 'rgba(93, 64, 55, 0.1)' }
                },
                y: {
                    ticks: { font: { family: pixelFont, size: 10 }, color: inkColor },
                    grid: { color: 'rgba(93, 64, 55, 0.1)' }
                }
            }
        };
    }

    // Destroy existing charts
    let charts = {};
    function destroyCharts() {
        Object.values(charts).forEach(c => { if (c) c.destroy(); });
        charts = {};
    }

    function renderCharts() {
        const appData = getAppData();
        if (!appData || !appData.weeks) return;

        destroyCharts();

        const weekKeys = Object.keys(appData.weeks).sort().slice(-8); // Last 8 weeks
        const labels = weekKeys.map(k => {
            const d = new Date(k + 'T00:00:00');
            return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        });

        // --- Sleep Chart (Bar) ---
        const sleepData = weekKeys.map(k => {
            const w = appData.weeks[k];
            if (!w || !w.trackers || !Array.isArray(w.trackers.sleep)) return 0;
            const hours = w.trackers.sleep
                .map(d => parseFloat(d.hours) || 0)
                .filter(h => h > 0);
            return hours.length > 0 ? (hours.reduce((a, b) => a + b, 0) / hours.length).toFixed(1) : 0;
        });

        const sleepCtx = document.getElementById('chart-sleep');
        if (sleepCtx) {
            charts.sleep = new Chart(sleepCtx, {
                type: 'bar',
                data: {
                    labels,
                    datasets: [{
                        label: 'Avg Sleep (hrs)',
                        data: sleepData,
                        backgroundColor: 'rgba(93, 64, 55, 0.6)',
                        borderColor: inkColor,
                        borderWidth: 2
                    }]
                },
                options: {
                    ...getChartDefaults(),
                    scales: {
                        ...getChartDefaults().scales,
                        y: { ...getChartDefaults().scales.y, beginAtZero: true, max: 12 }
                    }
                }
            });
        }

        // --- Mood Trend (Line) ---
        const moodMap = { 'rad': 5, 'good': 4, 'meh': 3, 'bad': 2, 'awful': 1 };
        const moodData = weekKeys.map(k => {
            const w = appData.weeks[k];
            if (!w || !w.trackers || !w.trackers.mood) return null;
            return moodMap[w.trackers.mood] || null;
        });

        const moodCtx = document.getElementById('chart-mood');
        if (moodCtx) {
            charts.mood = new Chart(moodCtx, {
                type: 'line',
                data: {
                    labels,
                    datasets: [{
                        label: 'Mood',
                        data: moodData,
                        borderColor: inkColor,
                        backgroundColor: 'rgba(93, 64, 55, 0.1)',
                        fill: true,
                        tension: 0,
                        stepped: true,
                        borderWidth: 2,
                        pointRadius: 4,
                        pointBackgroundColor: inkColor
                    }]
                },
                options: {
                    ...getChartDefaults(),
                    scales: {
                        ...getChartDefaults().scales,
                        y: {
                            ...getChartDefaults().scales.y,
                            min: 1, max: 5,
                            ticks: {
                                ...getChartDefaults().scales.y.ticks,
                                callback: v => ['', 'Awful', 'Bad', 'Meh', 'Good', 'Rad'][v] || ''
                            }
                        }
                    }
                }
            });
        }

        // --- Task Completion Rate (Bar) ---
        const taskData = weekKeys.map(k => {
            const w = appData.weeks[k];
            if (!w || !w.tasks) return 0;
            let total = 0, checked = 0;
            w.tasks.forEach(task => {
                if (task.days) {
                    task.days.forEach(s => {
                        total++;
                        if (s === 'check') checked++;
                    });
                }
            });
            return total > 0 ? Math.round((checked / total) * 100) : 0;
        });

        const taskCtx = document.getElementById('chart-tasks');
        if (taskCtx) {
            charts.tasks = new Chart(taskCtx, {
                type: 'bar',
                data: {
                    labels,
                    datasets: [{
                        label: 'Task Completion %',
                        data: taskData,
                        backgroundColor: 'rgba(201, 169, 110, 0.6)',
                        borderColor: '#C9A96E',
                        borderWidth: 2
                    }]
                },
                options: {
                    ...getChartDefaults(),
                    scales: {
                        ...getChartDefaults().scales,
                        y: { ...getChartDefaults().scales.y, beginAtZero: true, max: 100 }
                    }
                }
            });
        }

        // --- Water Streak (Bar) ---
        const waterData = weekKeys.map(k => {
            const w = appData.weeks[k];
            if (!w || !w.trackers || !Array.isArray(w.trackers.water)) return 0;
            return w.trackers.water.filter(Boolean).length;
        });

        const waterCtx = document.getElementById('chart-water');
        if (waterCtx) {
            charts.water = new Chart(waterCtx, {
                type: 'bar',
                data: {
                    labels,
                    datasets: [{
                        label: 'Water Days',
                        data: waterData,
                        backgroundColor: 'rgba(100, 181, 246, 0.5)',
                        borderColor: '#64B5F6',
                        borderWidth: 2
                    }]
                },
                options: {
                    ...getChartDefaults(),
                    scales: {
                        ...getChartDefaults().scales,
                        y: { ...getChartDefaults().scales.y, beginAtZero: true, max: 7 }
                    }
                }
            });
        }
    }
})();
