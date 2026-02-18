# Habits Planner 🎮

A gamified, pixel-art inspired weekly planner and habit tracker desktop application. Built with **Electron**, **HTML/CSS/JS**, and **Chart.js**.

![License](https://img.shields.io/badge/license-MIT-blue.svg)

## ✨ Features

- **Weekly Planning**: Manage tasks, appointments, and habits with a smooth weekly view.
- **Gamification**:
  - **XP System**: Earn experience for completing tasks, drinking water, and logging sleep.
  - **Levels**: Level up as you improve your productivity.
  - **Streaks**: Keep your momentum going with weekly streaks.
- **Analytics Dashboard**: Visualize your progress with charts for Sleep, Mood, Task Completion, and Water intake.
- **Focus Tools**:
  - **Pomodoro Timer**: 25/5 minute work/break cycle with audio notifications.
  - **Habit Templates**: One-click setup for routines (Morning, Fitness, Study, etc.).
- **Drag & Drop**: Easily reorganize your tasks.
- **Data Persistence**: Everything is saved locally—your data stays on your machine.
- **Export**: Print or save your weekly spread as a PDF.

## 🚀 Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd habits-app
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

## 🛠️ Usage

### Development Mode
Run the app locally with hot-reloading (if configured):
```bash
npm start
```

### Build Executable
Package the app as a standalone Windows `.exe` (Portable):
```bash
npm run pack
```
This creates a `dist-packager/` folder containing the executable.

## 📂 Project Structure

- `main.js`: Electron main process (window creation, system integration).
- `index.html`: The main UI structure.
- `script.js`: Core logic (gamification, data handling, UI interactions).
- `analytics.js`: Chart.js configuration and rendering.
- `style.css`: Custom pixel-art styling and themes.
- `assets/`: Fonts (Minecraft style) and images.

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 💖 Credits

- **Fonts**: Minecraft Font (Pixelated style)
- **Charts**: [Chart.js](https://www.chartjs.org/)

