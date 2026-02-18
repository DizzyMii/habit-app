document.addEventListener('DOMContentLoaded', () => {
    // --- Constants ---
    const DAYS = 7;
    const STORAGE_KEY = 'habitJournalDataV5';
    const OLD_STORAGE_KEY = 'habitJournalDataV4';

    // --- Elements ---
    const taskList = document.getElementById('task-list');
    const addTaskBtn = document.getElementById('add-task-btn');
    const weekInput = document.getElementById('week-input');
    const waterGrid = document.getElementById('water-grid');
    const prevWeekBtn = document.getElementById('prev-week-btn');
    const nextWeekBtn = document.getElementById('next-week-btn');
    const exportBtn = document.getElementById('export-week-btn');

    const mealInputs = {
        breakfast: document.getElementById('meal-breakfast'),
        lunch: document.getElementById('meal-lunch'),
        dinner: document.getElementById('meal-dinner'),
        snack: document.getElementById('meal-snack')
    };

    // --- Week Key Helpers ---
    function getWeekKey(date) {
        // Get Monday of the week for the given date
        const d = new Date(date);
        const day = d.getDay();
        const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Mon
        const monday = new Date(d.setDate(diff));
        return monday.toISOString().split('T')[0]; // "YYYY-MM-DD"
    }

    function formatWeekLabel(weekKey) {
        const d = new Date(weekKey + 'T00:00:00');
        const end = new Date(d);
        end.setDate(end.getDate() + 6);
        const opts = { month: 'short', day: 'numeric' };
        return `${d.toLocaleDateString('en-US', opts)} – ${end.toLocaleDateString('en-US', opts)}`;
    }

    function shiftWeek(weekKey, delta) {
        const d = new Date(weekKey + 'T00:00:00');
        d.setDate(d.getDate() + (delta * 7));
        return getWeekKey(d);
    }

    // --- Default Week Data ---
    function createEmptyWeek() {
        return {
            tasks: [{ text: '', days: Array(DAYS).fill(null) }],
            trackers: {
                water: Array(DAYS).fill(false),
                sleep: Array(DAYS).fill().map(() => ({ wake: '', wakeAmPm: 'AM', bed: '', bedAmPm: 'PM', hours: '' })),
                food: { breakfast: false, lunch: false, dinner: false, snack: false },
                mood: null,
                weather: null,
                uniqueEvent: '',
                fitness: { type: '', duration: '' },
                appointments: []
            },
            weekOf: ''
        };
    }

    // --- Data Architecture V5 ---
    // { currentWeek: "YYYY-MM-DD", profile: {...}, weeks: { "YYYY-MM-DD": weekData } }

    function loadAppData() {
        let appData = JSON.parse(localStorage.getItem(STORAGE_KEY));

        if (!appData) {
            // Try to migrate from V4
            const oldData = JSON.parse(localStorage.getItem(OLD_STORAGE_KEY));
            const currentKey = getWeekKey(new Date());

            if (oldData) {
                // Migrate V4 data into V5
                appData = {
                    currentWeek: currentKey,
                    profile: { xp: 0, level: 1, streakDays: 0, longestStreak: 0, unlockedThemes: [] },
                    weeks: {}
                };
                // Ensure sleep data is migrated properly
                if (typeof oldData.trackers.sleep === 'number' || !Array.isArray(oldData.trackers.sleep)) {
                    oldData.trackers.sleep = Array(DAYS).fill().map(() => ({ wake: '', wakeAmPm: 'AM', bed: '', bedAmPm: 'PM', hours: '' }));
                }
                appData.weeks[currentKey] = oldData;
            } else {
                // Fresh start
                appData = {
                    currentWeek: currentKey,
                    profile: { xp: 0, level: 1, streakDays: 0, longestStreak: 0, unlockedThemes: [] },
                    weeks: {}
                };
                appData.weeks[currentKey] = createEmptyWeek();
            }
            saveAppData(appData);
        }

        return appData;
    }

    function saveAppData(appData) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(appData));
    }

    // --- Main State ---
    let appData = loadAppData();
    let currentWeekKey = appData.currentWeek;

    function getCurrentWeekData() {
        if (!appData.weeks[currentWeekKey]) {
            appData.weeks[currentWeekKey] = createEmptyWeek();
        }
        return appData.weeks[currentWeekKey];
    }

    function saveData() {
        appData.currentWeek = currentWeekKey;
        recalculateXP();
        saveAppData(appData);
    }

    // Shortcut
    function weekData() {
        return getCurrentWeekData();
    }

    // --- Gamification ---
    function ensureProfile() {
        if (!appData.profile) {
            appData.profile = { xp: 0, level: 1, streakDays: 0, longestStreak: 0, unlockedThemes: [] };
        }
        return appData.profile;
    }

    function calculateLevel(xp) {
        // Level = floor(sqrt(xp / 100)). Level 1 = 100xp, Level 2 = 400xp, Level 3 = 900xp, etc.
        return Math.max(1, Math.floor(Math.sqrt(xp / 100)));
    }

    function xpForLevel(level) {
        return level * level * 100;
    }

    function recalculateXP() {
        const profile = ensureProfile();
        let totalXP = 0;

        // Count XP across ALL weeks
        Object.keys(appData.weeks).forEach(weekKey => {
            const w = appData.weeks[weekKey];
            if (!w) return;

            // Tasks: +10 per 'check' state
            if (w.tasks) {
                w.tasks.forEach(task => {
                    if (task.days) {
                        task.days.forEach(status => {
                            if (status === 'check') totalXP += 10;
                        });
                    }
                });
            }

            if (w.trackers) {
                // Water: +5 per filled day
                if (Array.isArray(w.trackers.water)) {
                    w.trackers.water.forEach(filled => { if (filled) totalXP += 5; });
                }

                // Meals: +5 per checked meal
                if (w.trackers.food) {
                    Object.values(w.trackers.food).forEach(checked => { if (checked) totalXP += 5; });
                }

                // Sleep: +10 per day with hours logged
                if (Array.isArray(w.trackers.sleep)) {
                    w.trackers.sleep.forEach(day => {
                        if (day && day.hours && day.hours !== '' && day.hours !== '0') totalXP += 10;
                    });
                }

                // Mood: +5 if set
                if (w.trackers.mood) totalXP += 5;

                // Weather: +5 if set
                if (w.trackers.weather) totalXP += 5;
            }
        });

        const oldLevel = profile.level;
        profile.xp = totalXP;
        profile.level = calculateLevel(totalXP);

        // Level up!
        if (profile.level > oldLevel && oldLevel > 0) {
            showLevelUpToast(profile.level);
        }

        // Streak: count consecutive weeks with at least 1 task checked
        const weekKeys = Object.keys(appData.weeks).sort();
        let streak = 0;
        for (let i = weekKeys.length - 1; i >= 0; i--) {
            const w = appData.weeks[weekKeys[i]];
            let hasCheck = false;
            if (w && w.tasks) {
                w.tasks.forEach(task => {
                    if (task.days) task.days.forEach(s => { if (s === 'check') hasCheck = true; });
                });
            }
            if (hasCheck) streak++;
            else break;
        }
        profile.streakDays = streak;
        if (streak > (profile.longestStreak || 0)) profile.longestStreak = streak;
    }

    function showLevelUpToast(level) {
        const existing = document.querySelector('.level-up-toast');
        if (existing) existing.remove();

        const toast = document.createElement('div');
        toast.className = 'level-up-toast';
        toast.innerHTML = `⭐ LEVEL UP! Level ${level} ⭐`;
        document.body.appendChild(toast);

        setTimeout(() => toast.classList.add('show'), 10);
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 500);
        }, 3000);
    }

    function renderGamification() {
        const profile = ensureProfile();
        const xpBar = document.getElementById('xp-fill');
        const xpLabel = document.getElementById('xp-label');
        const levelBadge = document.getElementById('level-badge');
        const streakCounter = document.getElementById('streak-count');

        if (levelBadge) levelBadge.textContent = `LVL ${profile.level}`;
        if (streakCounter) streakCounter.textContent = profile.streakDays;

        if (xpBar && xpLabel) {
            const currentLevelXP = xpForLevel(profile.level);
            const nextLevelXP = xpForLevel(profile.level + 1);
            const progress = Math.min(100, ((profile.xp - currentLevelXP) / (nextLevelXP - currentLevelXP)) * 100);
            xpBar.style.width = `${Math.max(0, progress)}%`;
            xpLabel.textContent = `${profile.xp} XP`;
        }
    }

    // --- Navigation ---
    function navigateWeek(delta) {
        currentWeekKey = shiftWeek(currentWeekKey, delta);
        appData.currentWeek = currentWeekKey;
        saveData();
        renderAll();
    }

    if (prevWeekBtn) prevWeekBtn.addEventListener('click', () => navigateWeek(-1));
    if (nextWeekBtn) nextWeekBtn.addEventListener('click', () => navigateWeek(1));

    // --- Export ---
    if (exportBtn) {
        exportBtn.addEventListener('click', () => {
            const container = document.querySelector('.planner-container');
            // Simple: print the page
            window.print();
        });
    }

    // --- Render All ---
    function renderAll() {
        const wd = weekData();

        // Update header
        weekInput.value = wd.weekOf || formatWeekLabel(currentWeekKey);
        if (!wd.weekOf) {
            wd.weekOf = formatWeekLabel(currentWeekKey);
            saveData();
        }

        // Render all sections
        renderTasks();
        renderWeather();
        renderMood();
        renderAppointments();
        renderWater();
        renderSleep();
        renderFood();
        renderUniqueEvent();
        renderFitness();
        renderGamification();
    }

    // --- Header ---
    weekInput.addEventListener('input', (e) => {
        weekData().weekOf = e.target.value;
        saveData();
    });

    // --- Tasks ---
    function renderTasks() {
        const wd = weekData();
        taskList.innerHTML = '';
        wd.tasks.forEach((task, index) => {
            const row = document.createElement('div');
            row.className = 'task-row';

            // Input
            const input = document.createElement('input');
            input.type = 'text';
            input.className = 'task-input';
            input.value = task.text;
            input.placeholder = `Task ${index + 1}...`;
            input.addEventListener('input', (e) => {
                weekData().tasks[index].text = e.target.value;
                saveData();
            });

            // Checkboxes
            const checkboxGroup = document.createElement('div');
            checkboxGroup.className = 'checkbox-group';

            task.days.forEach((status, dayIndex) => {
                const box = document.createElement('div');
                box.className = 'day-checkbox';
                if (status) box.classList.add(`state-${status}`);

                box.addEventListener('click', () => {
                    const states = [null, 'check', 'x', 'na'];
                    const current = states.indexOf(weekData().tasks[index].days[dayIndex]);
                    const next = states[(current + 1) % states.length];
                    weekData().tasks[index].days[dayIndex] = next;
                    box.className = 'day-checkbox';
                    if (next) box.classList.add(`state-${next}`);
                    saveData();
                });

                checkboxGroup.appendChild(box);
            });

            // Delete button
            const deleteBtn = document.createElement('button');
            deleteBtn.className = 'delete-task-btn';
            deleteBtn.textContent = '×';
            deleteBtn.title = 'Remove Task';
            deleteBtn.addEventListener('click', () => {
                weekData().tasks.splice(index, 1);
                saveData();
                renderTasks();
            });

            row.appendChild(input);
            row.appendChild(checkboxGroup);
            row.appendChild(deleteBtn);
            taskList.appendChild(row);
        });
    }

    addTaskBtn.addEventListener('click', () => {
        weekData().tasks.push({ text: '', days: Array(DAYS).fill(null) });
        saveData();
        renderTasks();
    });

    // --- Weather ---
    function renderWeather() {
        const wd = weekData();
        const weatherOptions = document.querySelectorAll('.weather-options span');
        weatherOptions.forEach(span => {
            span.classList.remove('selected');
            if (span.dataset.weather === wd.trackers.weather) span.classList.add('selected');

            // Remove old listeners by cloning
            const newSpan = span.cloneNode(true);
            span.parentNode.replaceChild(newSpan, span);

            newSpan.addEventListener('click', () => {
                document.querySelectorAll('.weather-options span').forEach(s => s.classList.remove('selected'));
                newSpan.classList.add('selected');
                weekData().trackers.weather = newSpan.dataset.weather;
                saveData();
            });
        });
    }

    // --- Mood ---
    function renderMood() {
        const wd = weekData();
        const moodOptions = document.querySelectorAll('.mood-options span');
        moodOptions.forEach(span => {
            span.classList.remove('selected');
            if (span.dataset.mood === wd.trackers.mood) span.classList.add('selected');

            const newSpan = span.cloneNode(true);
            span.parentNode.replaceChild(newSpan, span);

            newSpan.addEventListener('click', () => {
                document.querySelectorAll('.mood-options span').forEach(s => s.classList.remove('selected'));
                newSpan.classList.add('selected');
                weekData().trackers.mood = newSpan.dataset.mood;
                saveData();
            });
        });
    }

    // --- Appointments ---
    function renderAppointments() {
        const wd = weekData();
        if (!wd.trackers.appointments || !Array.isArray(wd.trackers.appointments)) {
            wd.trackers.appointments = [];
        }

        const list = document.getElementById('appointment-list');
        list.innerHTML = '';

        wd.trackers.appointments.forEach((appt, index) => {
            const row = document.createElement('div');
            row.className = 'appt-row';

            const timeInput = document.createElement('input');
            timeInput.type = 'time';
            timeInput.className = 'appt-time';
            timeInput.value = appt.time;
            timeInput.addEventListener('input', (e) => {
                wd.trackers.appointments[index].time = e.target.value;
                saveData();
            });

            const eventInput = document.createElement('input');
            eventInput.type = 'text';
            eventInput.className = 'appt-event';
            eventInput.placeholder = 'Event...';
            eventInput.value = appt.event;
            eventInput.addEventListener('input', (e) => {
                wd.trackers.appointments[index].event = e.target.value;
                saveData();
            });

            const delBtn = document.createElement('button');
            delBtn.className = 'delete-appt-btn';
            delBtn.innerHTML = '✖';
            delBtn.title = 'Remove Appointment';
            delBtn.addEventListener('click', () => {
                wd.trackers.appointments.splice(index, 1);
                saveData();
                renderAppointments();
            });

            row.appendChild(timeInput);
            row.appendChild(eventInput);
            row.appendChild(delBtn);
            list.appendChild(row);
        });
    }

    const addApptBtn = document.getElementById('add-appt-btn');
    if (addApptBtn) {
        addApptBtn.addEventListener('click', () => {
            const wd = weekData();
            if (!wd.trackers.appointments) wd.trackers.appointments = [];
            wd.trackers.appointments.push({ time: '', event: '' });
            saveData();
            renderAppointments();
        });
    }

    // --- Water ---
    function renderWater() {
        const wd = weekData();
        waterGrid.innerHTML = '';
        if (!Array.isArray(wd.trackers.water)) {
            wd.trackers.water = Array(DAYS).fill(false);
        }

        for (let i = 0; i < DAYS; i++) {
            const drop = document.createElement('div');
            drop.className = 'water-drop';
            if (wd.trackers.water[i]) drop.classList.add('filled');

            drop.addEventListener('click', () => {
                weekData().trackers.water[i] = !weekData().trackers.water[i];
                saveData();
                renderWater();
            });

            waterGrid.appendChild(drop);
        }
    }

    // --- Sleep ---
    function renderSleep() {
        const wd = weekData();
        if (typeof wd.trackers.sleep === 'number' || !Array.isArray(wd.trackers.sleep)) {
            wd.trackers.sleep = Array(DAYS).fill().map(() => ({ wake: '', wakeAmPm: 'AM', bed: '', bedAmPm: 'PM', hours: '' }));
        }

        const sleepGrid = document.getElementById('sleep-grid');
        sleepGrid.innerHTML = '';

        for (let i = 0; i < DAYS; i++) {
            if (!wd.trackers.sleep[i]) wd.trackers.sleep[i] = { wake: '', wakeAmPm: 'AM', bed: '', bedAmPm: 'PM', hours: '' };
            if (!wd.trackers.sleep[i].wakeAmPm) wd.trackers.sleep[i].wakeAmPm = 'AM';
            if (!wd.trackers.sleep[i].bedAmPm) wd.trackers.sleep[i].bedAmPm = 'PM';

            const box = document.createElement('div');
            box.className = 'sleep-box';

            // --- Wake ---
            const wakeContainer = document.createElement('div');
            wakeContainer.className = 'sleep-time-container';

            const wakeLabel = document.createElement('span');
            wakeLabel.textContent = '☀️';
            wakeLabel.className = 'sleep-label-icon';

            const wakeInput = document.createElement('input');
            wakeInput.className = 'sleep-time-input';
            wakeInput.placeholder = '7:00';
            wakeInput.value = wd.trackers.sleep[i].wake;

            const wakeAmPm = document.createElement('select');
            wakeAmPm.className = 'sleep-ampm';
            wakeAmPm.innerHTML = '<option value="AM">AM</option><option value="PM">PM</option>';
            wakeAmPm.value = wd.trackers.sleep[i].wakeAmPm;

            wakeContainer.appendChild(wakeLabel);
            wakeContainer.appendChild(wakeInput);
            wakeContainer.appendChild(wakeAmPm);

            // --- Hours ---
            const hoursContainer = document.createElement('div');
            hoursContainer.className = 'sleep-hours-container';

            const hoursInput = document.createElement('input');
            hoursInput.className = 'sleep-hours';
            hoursInput.type = 'number';
            hoursInput.placeholder = '-';
            hoursInput.value = wd.trackers.sleep[i].hours;
            hoursInput.title = 'Hours Slept';

            const hoursLabel = document.createElement('span');
            hoursLabel.textContent = 'HRS';
            hoursLabel.className = 'sleep-hours-label';

            hoursContainer.appendChild(hoursInput);
            hoursContainer.appendChild(hoursLabel);

            // --- Bed ---
            const bedContainer = document.createElement('div');
            bedContainer.className = 'sleep-time-container';

            const bedLabel = document.createElement('span');
            bedLabel.textContent = '🌙';
            bedLabel.className = 'sleep-label-icon';

            const bedInput = document.createElement('input');
            bedInput.className = 'sleep-time-input';
            bedInput.placeholder = '11:00';
            bedInput.value = wd.trackers.sleep[i].bed;

            const bedAmPm = document.createElement('select');
            bedAmPm.className = 'sleep-ampm';
            bedAmPm.innerHTML = '<option value="AM">AM</option><option value="PM">PM</option>';
            bedAmPm.value = wd.trackers.sleep[i].bedAmPm;

            bedContainer.appendChild(bedLabel);
            bedContainer.appendChild(bedInput);
            bedContainer.appendChild(bedAmPm);

            // --- Calc ---
            const calculateSleep = () => {
                const wakeVal = wakeInput.value;
                const bedVal = bedInput.value;
                if (!wakeVal || !bedVal) return;
                const parseTime = (str, ampm) => {
                    const parts = str.split(':');
                    let h = parseInt(parts[0]);
                    const m = parts[1] ? parseInt(parts[1]) : 0;
                    if (isNaN(h)) return null;
                    if (ampm === 'PM' && h < 12) h += 12;
                    if (ampm === 'AM' && h === 12) h = 0;
                    return h + (m / 60);
                };
                const wakeH = parseTime(wakeVal, wakeAmPm.value);
                const bedH = parseTime(bedVal, bedAmPm.value);
                if (wakeH === null || bedH === null) return;
                let diff = wakeH - bedH;
                if (diff < 0) diff += 24;
                hoursInput.value = Math.round(diff * 10) / 10;
                weekData().trackers.sleep[i].hours = hoursInput.value;
                saveData();
            };

            const updateSleepData = () => {
                const wd = weekData();
                wd.trackers.sleep[i].wake = wakeInput.value;
                wd.trackers.sleep[i].wakeAmPm = wakeAmPm.value;
                wd.trackers.sleep[i].bed = bedInput.value;
                wd.trackers.sleep[i].bedAmPm = bedAmPm.value;
                wd.trackers.sleep[i].hours = hoursInput.value;
                saveData();
            };

            wakeInput.addEventListener('change', () => { updateSleepData(); calculateSleep(); });
            wakeAmPm.addEventListener('change', () => { updateSleepData(); calculateSleep(); });
            bedInput.addEventListener('change', () => { updateSleepData(); calculateSleep(); });
            bedAmPm.addEventListener('change', () => { updateSleepData(); calculateSleep(); });
            hoursInput.addEventListener('input', updateSleepData);

            box.appendChild(wakeContainer);
            box.appendChild(hoursContainer);
            box.appendChild(bedContainer);
            sleepGrid.appendChild(box);
        }
    }

    // --- Food ---
    function renderFood() {
        const wd = weekData();
        if (!wd.trackers.food) wd.trackers.food = { breakfast: false, lunch: false, dinner: false, snack: false };

        Object.keys(mealInputs).forEach(key => {
            const div = mealInputs[key];
            if (!div) return;

            div.classList.remove('state-check');
            if (wd.trackers.food[key]) div.classList.add('state-check');

            // Clone to remove old listeners
            const newDiv = div.cloneNode(true);
            div.parentNode.replaceChild(newDiv, div);
            mealInputs[key] = newDiv; // Update reference

            newDiv.addEventListener('click', () => {
                const isChecked = newDiv.classList.toggle('state-check');
                weekData().trackers.food[key] = isChecked;
                saveData();
            });
        });
    }

    // --- Unique Event ---
    function renderUniqueEvent() {
        const wd = weekData();
        const el = document.getElementById('unique-event-input');
        el.value = wd.trackers.uniqueEvent || '';

        const newEl = el.cloneNode(true);
        el.parentNode.replaceChild(newEl, el);

        newEl.addEventListener('input', (e) => {
            weekData().trackers.uniqueEvent = e.target.value;
            saveData();
        });
    }

    // --- Fitness ---
    function renderFitness() {
        const wd = weekData();
        if (!wd.trackers.fitness) wd.trackers.fitness = { type: '', duration: '' };

        const fitType = document.getElementById('fitness-type');
        const fitDur = document.getElementById('fitness-duration');

        fitType.value = wd.trackers.fitness.type || '';
        fitDur.value = wd.trackers.fitness.duration || '';

        const newType = fitType.cloneNode(true);
        const newDur = fitDur.cloneNode(true);
        fitType.parentNode.replaceChild(newType, fitType);
        fitDur.parentNode.replaceChild(newDur, fitDur);

        newType.addEventListener('input', (e) => { weekData().trackers.fitness.type = e.target.value; saveData(); });
        newDur.addEventListener('input', (e) => { weekData().trackers.fitness.duration = e.target.value; saveData(); });
    }

    // --- Phase 4a: Habit Templates ---
    const TEMPLATES = {
        'Morning Routine': ['Wake up early', 'Drink water', 'Stretch / Exercise', 'Healthy breakfast', 'Journal / Gratitude'],
        'Fitness Week': ['Cardio session', 'Strength training', 'Yoga / Flexibility', 'Walk 10k steps', 'Meal prep'],
        'Study Plan': ['Read 30 min', 'Review notes', 'Practice problems', 'Flashcards', 'Summarize lesson'],
        'Self Care': ['Skincare routine', 'Meditate 10 min', 'Social time', 'No screens 1hr before bed', 'Creative hobby']
    };

    const templateBtn = document.getElementById('template-btn');
    const templateDropdown = document.getElementById('template-dropdown');

    if (templateBtn && templateDropdown) {
        // Build dropdown
        Object.keys(TEMPLATES).forEach(name => {
            const opt = document.createElement('div');
            opt.className = 'template-option';
            opt.textContent = name;
            opt.addEventListener('click', () => {
                const tasks = TEMPLATES[name];
                tasks.forEach(text => {
                    weekData().tasks.push({ text, days: Array(DAYS).fill(null) });
                });
                saveData();
                renderTasks();
                renderGamification();
                templateDropdown.classList.remove('open');
            });
            templateDropdown.appendChild(opt);
        });

        templateBtn.addEventListener('click', () => {
            templateDropdown.classList.toggle('open');
        });

        // Close on outside click
        document.addEventListener('click', (e) => {
            if (!templateBtn.contains(e.target) && !templateDropdown.contains(e.target)) {
                templateDropdown.classList.remove('open');
            }
        });
    }

    // --- Phase 4b: Pomodoro Timer ---
    const pomodoroDisplay = document.getElementById('pomodoro-display');
    const pomodoroStartBtn = document.getElementById('pomodoro-start');
    const pomodoroResetBtn = document.getElementById('pomodoro-reset');
    const pomodoroLabel = document.getElementById('pomodoro-label');

    let pomodoroInterval = null;
    let pomodoroSeconds = 25 * 60;
    let pomodoroIsWork = true;
    let pomodoroRunning = false;

    function formatPomodoro(seconds) {
        const m = Math.floor(seconds / 60).toString().padStart(2, '0');
        const s = (seconds % 60).toString().padStart(2, '0');
        return `${m}:${s}`;
    }

    function updatePomodoroDisplay() {
        if (pomodoroDisplay) pomodoroDisplay.textContent = formatPomodoro(pomodoroSeconds);
        if (pomodoroLabel) pomodoroLabel.textContent = pomodoroIsWork ? 'WORK' : 'BREAK';
    }

    function playBeep() {
        try {
            const ctx = new (window.AudioContext || window.webkitAudioContext)();
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.frequency.value = 800;
            osc.type = 'square';
            gain.gain.value = 0.3;
            osc.start();
            osc.stop(ctx.currentTime + 0.3);
        } catch (e) { /* Audio not available */ }
    }

    function pomodoroTick() {
        pomodoroSeconds--;
        updatePomodoroDisplay();

        if (pomodoroSeconds <= 0) {
            playBeep();
            if (pomodoroIsWork) {
                // Award XP for completing a work session
                const profile = ensureProfile();
                profile.xp += 25;
                profile.level = calculateLevel(profile.xp);
                saveData();
                renderGamification();
                // Switch to break
                pomodoroIsWork = false;
                pomodoroSeconds = 5 * 60;
            } else {
                // Switch to work
                pomodoroIsWork = true;
                pomodoroSeconds = 25 * 60;
            }
            updatePomodoroDisplay();
        }
    }

    if (pomodoroStartBtn) {
        pomodoroStartBtn.addEventListener('click', () => {
            if (pomodoroRunning) {
                clearInterval(pomodoroInterval);
                pomodoroRunning = false;
                pomodoroStartBtn.textContent = '▶';
            } else {
                pomodoroInterval = setInterval(pomodoroTick, 1000);
                pomodoroRunning = true;
                pomodoroStartBtn.textContent = '⏸';
            }
        });
    }

    if (pomodoroResetBtn) {
        pomodoroResetBtn.addEventListener('click', () => {
            clearInterval(pomodoroInterval);
            pomodoroRunning = false;
            pomodoroIsWork = true;
            pomodoroSeconds = 25 * 60;
            updatePomodoroDisplay();
            if (pomodoroStartBtn) pomodoroStartBtn.textContent = '▶';
        });
    }

    updatePomodoroDisplay();

    // --- Phase 4c: Drag & Drop Tasks ---
    let dragIndex = null;

    function addDragHandlers() {
        const rows = taskList.querySelectorAll('.task-row');
        rows.forEach((row, index) => {
            row.setAttribute('draggable', 'true');

            row.addEventListener('dragstart', (e) => {
                dragIndex = index;
                row.classList.add('dragging');
                e.dataTransfer.effectAllowed = 'move';
            });

            row.addEventListener('dragend', () => {
                row.classList.remove('dragging');
                dragIndex = null;
            });

            row.addEventListener('dragover', (e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
                row.classList.add('drag-over');
            });

            row.addEventListener('dragleave', () => {
                row.classList.remove('drag-over');
            });

            row.addEventListener('drop', (e) => {
                e.preventDefault();
                row.classList.remove('drag-over');
                if (dragIndex === null || dragIndex === index) return;

                // Reorder
                const wd = weekData();
                const [moved] = wd.tasks.splice(dragIndex, 1);
                wd.tasks.splice(index, 0, moved);
                saveData();
                renderTasks();
            });
        });
    }

    // Patch renderTasks to add drag handlers after rendering
    const originalRenderTasks = renderTasks;
    renderTasks = function () {
        originalRenderTasks();
        addDragHandlers();
    };

    // --- Init ---
    renderAll();
});
