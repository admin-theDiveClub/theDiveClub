// === SHOT CLOCK VARIABLES ===
let shotTime = 45; // Default shot time in seconds
let extensionTime = 15; // Extension time in seconds
let shotClockInterval = null;
let shotCurrentTime = shotTime * 10; // tenths of a second
let shotClockActive = false;
let focusedPlayer = "home"; // "home" or "away"
let homeExtensionUsed = false;
let awayExtensionUsed = false;
let lastThreeSecondsAudio = "../resources/audio/audio_timer_Beep.mp3";
let finalAlarmAudio = "../resources/audio/audio_timer_alarm.mp3";
let lastThreeSecondsVolume = 0.5;
let finalAlarmVolume = 1.0;

// Shot clock key assignments
const shotKeys = {
  homeNextShot: "PageUp",
  awayNextShot: "PageDown",
  extension: "b"
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
      if (shotCurrentTime <= 40 && shotCurrentTime % 10 === 0) {
        playAudio(lastThreeSecondsAudio, lastThreeSecondsVolume);
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
  } else if (player === "home" && homeExtensionUsed) 
  {
    flashShotTimer();
  }
  if (player === "away" && !awayExtensionUsed) {
    shotCurrentTime += extensionTime * 10;
    awayExtensionUsed = true;
    if (awayExtensionContainer) awayExtensionContainer.style.display = "none";
    updateShotDisplay();
  } else if (player === "away" && awayExtensionUsed)
  {
    flashShotTimer();
  }
}

function resetExtensions() {
  homeExtensionUsed = false;
  awayExtensionUsed = false;
  if (homeExtensionContainer) homeExtensionContainer.style.display = "";
  if (awayExtensionContainer) awayExtensionContainer.style.display = "";
}

// === MATCH CLOCK FUNCTIONS ===
function updateMatchDisplay() {
  const minutes = Math.floor(matchCurrentTime / 60);
  const seconds = matchCurrentTime % 60;
  matchTimerDisplay.innerHTML = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

function startMatchTimer() {
  if (matchTimerInterval) return;
  matchTimerInterval = setInterval(() => {
    if (matchCurrentTime > 0) {
      matchCurrentTime--;
      updateMatchDisplay();
      localStorage.setItem("matchTimerRemaining", matchCurrentTime);
      sessionStorage.setItem("matchTimerRemaining", matchCurrentTime);
    } else {
      clearInterval(matchTimerInterval);
      matchTimerInterval = null;
      localStorage.removeItem("matchTimerRemaining");
      sessionStorage.removeItem("matchTimerRemaining");
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

function flashMatchTimer() {
  const flashInterval = setInterval(() => {
    matchTimerDisplay.style.color = matchTimerDisplay.style.color === "red" ? "white" : "red";
  }, 200);
  setTimeout(() => {
    clearInterval(flashInterval);
    matchTimerDisplay.style.color = "white";
  }, 2000);
}

function triggerMatchAlarm() {
  playAudio(finalAlarmAudio, finalAlarmVolume);
  flashMatchTimer();
}

// === PLAYER FOCUS HANDLING ===
function setFocus(player) {
  focusedPlayer = player;
  // Optionally update UI to indicate focus
  console.log(`Focus set to ${player}`);
}

// === SHOT CLOCK CONTROL LOGIC ===
let lastHomeNextShotTime = 0;
let lastAwayNextShotTime = 0;
let lastExtensionKeyTime = 0;

document.addEventListener("keydown", (event) => {
  const now = Date.now();

  // --- SHOT CLOCK CONTROLS ---
  if (event.code === shotKeys.homeNextShot) {
    setFocus("home");
    if (now - lastHomeNextShotTime < doublePressThreshold) {
      // Double PageDown: Reset shot clock for home, do not start
      resetShotClock();
    } else {
      // Single PageDown: Next Shot for home
      if (!shotClockActive) startShotClock();
      else restartShotClock();
    }
    lastHomeNextShotTime = now;
    event.preventDefault();
    return;
  }
  if (event.code === shotKeys.awayNextShot) {
    setFocus("away");
    if (now - lastAwayNextShotTime < doublePressThreshold) {
      // Double PageUp: Reset shot clock for away, do not start
      resetShotClock();
    } else {
      // Single PageUp: Next Shot for away
      if (!shotClockActive) startShotClock();
      else restartShotClock();
    }
    lastAwayNextShotTime = now;
    event.preventDefault();
    return;
  }
  if (event.key.toLowerCase() === shotKeys.extension) {
    const extensionNow = Date.now();
    if (extensionNow - lastExtensionKeyTime < doublePressThreshold) {
      // Double Extension: Next Frame logic
      resetShotClock();
      resetExtensions();
      nextFramePlaceholder();
    } else {
      // Single Extension: Apply extension for focused player
      applyExtension(focusedPlayer);
    }
    lastExtensionKeyTime = extensionNow;
    event.preventDefault();
    return;
  }

  // --- MATCH CLOCK CONTROLS ---
  switch (event.key.toLowerCase()) {
    case matchKeys.start:
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
