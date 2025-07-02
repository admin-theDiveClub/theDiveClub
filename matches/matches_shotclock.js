// === SHOT CLOCK VARIABLES ===
let shotTime = 45; // Default shot time in seconds
let extensionTime = 15; // Extension time in seconds
let shotClockInterval = null;
let shotCurrentTime = shotTime * 10; // tenths of a second
let shotClockActive = false;
let focusedPlayer = "home"; // "home" or "away"
let homeExtensionUsed = false;
let awayExtensionUsed = false;
let lastFiveSecondsAudio = "../resources/audio/audio_timer_Beep_1.mp3";
let finalAlarmAudio = "../resources/audio/audio_timer_alarm_1.mp3";
let lastFiveSecondsVolume = 0.5;
let finalAlarmVolume = 1.0;

console.warn(`
SHOT CLOCK KEYS:
  Pg Up / <- : Home player next shot (single: start/restart, double: reset)
  Pg Dn / -> : Away player next shot (single: start/restart, double: reset)
  e / b      : Extension for focused player (single: apply, double: next frame)
  p          : Next frame (same as double extension)
  ArrowUp    : Increase shot time by 5s
  ArrowDown  : Decrease shot time by 5s
  r          : Decrease extension time by 5s
  t          : Increase extension time by 5s

MATCH CLOCK KEYS:
  m : Start match timer (reset + start)
  n : Pause/resume match timer
  x : Reset match timer
  w : Increase match time by 1 minute
  s : Decrease match time by 1 minute
`);

// Shot clock key assignments
const shotKeys = {
  homeNextShot: "PageUp",
  awayNextShot: "PageDown",
  homeNextShotAlt: "ArrowLeft",
  awayNextShotAlt: "ArrowRight",
  extension: "b",
  extensionAlt: "e"
};
const doublePressThreshold = 400; // ms

// === MATCH CLOCK VARIABLES ===
let matchTimeMinutes = 50;
let matchCurrentTime = matchTimeMinutes * 60;
let matchTimerInterval = null;

// Match clock key assignments
const matchKeys = {
  start: "m",
  pauseResume: "n",
  reset: "x",
  increase: "w",
  decrease: "s"
};

// === DOM ELEMENTS ===
const shotTimerDisplay = document.getElementById("shot-time");
const matchTimerDisplay = document.getElementById("match-time");
const homeExtensionContainer = document.getElementById("home-extension-container");
const awayExtensionContainer = document.getElementById("away-extension-container");

// === SHOT CLOCK FUNCTIONS ===
function updateShotDisplay() {
  const seconds = Math.floor(shotCurrentTime / 10);
  shotTimerDisplay.innerHTML = `${seconds}`;
}

function playAudio(audioFile, volume) {
  const audio = new Audio(audioFile);
  audio.volume = volume;
  audio.play();
}

function startShotClock() {
  if (shotClockInterval) return;
  shotClockActive = true;
  shotClockInterval = setInterval(() => {
    if (shotCurrentTime > 0) {
      // Play beep for last 5 seconds (50 tenths)
      if (shotCurrentTime <= 60 && shotCurrentTime % 10 === 0) {
        playAudio(lastFiveSecondsAudio, lastFiveSecondsVolume);
      }
      shotCurrentTime--;
      updateShotDisplay();
    } else {
      clearInterval(shotClockInterval);
      shotClockInterval = null;
      shotClockActive = false;
      triggerShotAlarm();
    }
  }, 100);
}

function pauseShotClock() {
  clearInterval(shotClockInterval);
  shotClockInterval = null;
  shotClockActive = false;
}

function resetShotClock() {
  pauseShotClock();
  shotCurrentTime = shotTime * 10;
  updateShotDisplay();
}

function restartShotClock() {
  resetShotClock();
  startShotClock();
}

function flashShotTimer() {
  const flashInterval = setInterval(() => {
    shotTimerDisplay.style.color = shotTimerDisplay.style.color === "red" ? "white" : "red";
  }, 200);
  setTimeout(() => {
    clearInterval(flashInterval);
    shotTimerDisplay.style.color = "white";
  }, 2000);
}

function triggerShotAlarm() {
  playAudio(finalAlarmAudio, finalAlarmVolume);
  flashShotTimer();
}

function applyExtension(player) {
  if (player === "home" && !homeExtensionUsed) {
    shotCurrentTime += extensionTime * 10;
    homeExtensionUsed = true;
    if (homeExtensionContainer) homeExtensionContainer.style.display = "none";
    updateShotDisplay();
  } else if (player === "away" && !awayExtensionUsed) {
    shotCurrentTime += extensionTime * 10;
    awayExtensionUsed = true;
    if (awayExtensionContainer) awayExtensionContainer.style.display = "none";
    updateShotDisplay();
  }
}

function resetExtensions() {
  homeExtensionUsed = false;
  awayExtensionUsed = false;
  if (homeExtensionContainer) homeExtensionContainer.style.display = "";
  if (awayExtensionContainer) awayExtensionContainer.style.display = "";
}

// === PLAYER FOCUS HANDLING ===
function setFocus(player) {
  focusedPlayer = player;
  const homeContainer = document.getElementById("player-home-container");
  const awayContainer = document.getElementById("player-away-container");
  if (homeContainer && awayContainer) {
    if (player === "home") {
      homeContainer.style.boxShadow = "inset 0 0 200px 20px rgba(0, 186, 245, 0.25)";
      awayContainer.style.boxShadow = "";
    } else {
      awayContainer.style.boxShadow = "inset 0 0 200px 20px rgba(0, 186, 245, 0.25)";
      homeContainer.style.boxShadow = "";
    }
  }
}

// === SHOT CLOCK CONTROL LOGIC ===
let lastHomeNextShotTime = 0;
let lastAwayNextShotTime = 0;
let lastExtensionKeyTime = 0;
let lastHomeNextShotAltTime = 0;
let lastAwayNextShotAltTime = 0;

document.addEventListener("keydown", (event) => {
  const now = Date.now();

  // Home player: PageUp or ArrowRight
  if (event.code === shotKeys.homeNextShot || event.code === shotKeys.homeNextShotAlt) {
    setFocus("home");
    let lastTime = event.code === "PageUp" ? lastHomeNextShotTime : lastHomeNextShotAltTime;
    if (now - lastTime < doublePressThreshold) {
      resetShotClock();
    } else {
      restartShotClock();
    }
    if (event.code === "PageUp") lastHomeNextShotTime = now;
    else lastHomeNextShotAltTime = now;
    event.preventDefault();
    return;
  }

  // Away player: PageDown or ArrowLeft
  if (event.code === shotKeys.awayNextShot || event.code === shotKeys.awayNextShotAlt) {
    setFocus("away");
    let lastTime = event.code === "PageDown" ? lastAwayNextShotTime : lastAwayNextShotAltTime;
    if (now - lastTime < doublePressThreshold) {
      resetShotClock();
    } else {
      restartShotClock();
    }
    if (event.code === "PageDown") lastAwayNextShotTime = now;
    else lastAwayNextShotAltTime = now;
    event.preventDefault();
    return;
  }

  // Extension for focused player: 'b' or 'e'
  if (event.key.toLowerCase() === shotKeys.extension || event.key.toLowerCase() === shotKeys.extensionAlt) {
    const extensionNow = Date.now();
    if (extensionNow - lastExtensionKeyTime < doublePressThreshold) {
      resetShotClock();
      resetExtensions(); // Reset extensions only on next frame
      nextFramePlaceholder();
    } else {
      applyExtension(focusedPlayer);
    }
    lastExtensionKeyTime = extensionNow;
    event.preventDefault();
    return;
  }

  // p key: Next Frame (same as double extension)
  if (event.key.toLowerCase() === "p") {
    resetShotClock();
    resetExtensions(); // Reset extensions only on next frame
    nextFramePlaceholder();
    event.preventDefault();
    return;
  }

  // Up/Down arrows: shotTime +/- 5s
  if (event.code === "ArrowUp") {
    shotTime += 5;
    shotCurrentTime = shotTime * 10;
    updateShotDisplay();
    return;
  }
  if (event.code === "ArrowDown") {
    shotTime = Math.max(5, shotTime - 5);
    shotCurrentTime = shotTime * 10;
    updateShotDisplay();
    return;
  }

  // r/t: extensionTime +/- 5s
  if (event.key.toLowerCase() === "r") {
    extensionTime = Math.max(5, extensionTime - 5);
    console.log(`Extension time decreased to ${extensionTime} seconds`);
    return;
  }
  if (event.key.toLowerCase() === "t") {
    extensionTime += 5;
    console.log(`Extension time increased to ${extensionTime} seconds`);
    return;
  }
});

// === PLACEHOLDER FOR NEXT FRAME LOGIC ===
function nextFramePlaceholder() {
  console.log("Next frame logic placeholder called.");
}

// === INITIALIZATION ===
updateShotDisplay();
updateMatchDisplay();

// Restore match timer if needed
(function restoreMatchTimer() {
  const storedRemaining = localStorage.getItem("matchTimerRemaining") || sessionStorage.getItem("matchTimerRemaining");
  if (storedRemaining !== null && !isNaN(Number(storedRemaining))) {
    matchCurrentTime = Number(storedRemaining);
    updateMatchDisplay();
    startMatchTimer();
    if (matchCurrentTime === 0) {
      triggerMatchAlarm();
    }
  }
})();
// === MATCH CLOCK FUNCTIONS ===
function updateMatchDisplay() {
  const minutes = Math.floor(matchCurrentTime / 60);
  const seconds = matchCurrentTime % 60;
  matchTimerDisplay.innerHTML = `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

function startMatchTimer() {
  if (matchTimerInterval) return;
  matchTimerInterval = setInterval(() => {
    if (matchCurrentTime > 0) {
      // Play beep for last 5 seconds
      if (matchCurrentTime <= 6 && matchCurrentTime > 0) {
        playAudio(lastFiveSecondsAudio, lastFiveSecondsVolume);
      }
      matchCurrentTime--;
      updateMatchDisplay();
      localStorage.setItem("matchTimerRemaining", matchCurrentTime);
      sessionStorage.setItem("matchTimerRemaining", matchCurrentTime);
    } else {
      clearInterval(matchTimerInterval);
      matchTimerInterval = null;
      triggerMatchAlarm();
    }
  }, 1000);
}

function pauseMatchTimer() {
  clearInterval(matchTimerInterval);
  matchTimerInterval = null;
}

function resetMatchTimer() {
  pauseMatchTimer();
  matchCurrentTime = matchTimeMinutes * 60;
  updateMatchDisplay();
  localStorage.removeItem("matchTimerRemaining");
  sessionStorage.removeItem("matchTimerRemaining");
}

function triggerMatchAlarm() {
  playAudio(finalAlarmAudio, finalAlarmVolume);
  matchTimerDisplay.style.color = "white";
  setTimeout(() => {
    matchTimerDisplay.style.color = "rgba(234, 0, 103, 1)";
  }, 2000);
}

// === MATCH CLOCK CONTROL LOGIC ===
document.addEventListener("keydown", (event) => {
  switch (event.key.toLowerCase()) {
    case matchKeys.start:
      resetMatchTimer();
      startMatchTimer();
      break;
    case matchKeys.pauseResume:
      if (matchTimerInterval) pauseMatchTimer();
      else startMatchTimer();
      break;
    case matchKeys.reset:
      resetMatchTimer();
      break;
    case matchKeys.increase:
      matchTimeMinutes += 1;
      matchCurrentTime = matchTimeMinutes * 60;
      updateMatchDisplay();
      break;
    case matchKeys.decrease:
      matchTimeMinutes = Math.max(1, matchTimeMinutes - 1);
      matchCurrentTime = matchTimeMinutes * 60;
      updateMatchDisplay();
      break;
  }
});

// === PLACEHOLDER FOR NEXT FRAME LOGIC ===
function nextFramePlaceholder() {
  // TODO: Implement logic to determine next breaking player based on score
  console.log("Next frame.");
}

// === INITIALIZATION ===
updateShotDisplay();
updateMatchDisplay();

// Restore match timer if needed
(function restoreMatchTimer() {
  const storedRemaining = localStorage.getItem("matchTimerRemaining") || sessionStorage.getItem("matchTimerRemaining");
  if (storedRemaining !== null && !isNaN(Number(storedRemaining))) {
    matchCurrentTime = Number(storedRemaining);
    updateMatchDisplay();
    startMatchTimer();
    if (matchCurrentTime === 0) {
      triggerMatchAlarm();
    }
  }
})();
