// === SHOT CLOCK VARIABLES ===
let shotTime = 45; // Default shot time in seconds
let extensionTime = 15; // Extension time in seconds
let shotClockInterval = null;
let shotCurrentTime = shotTime * 10; // tenths of a second
let shotClockActive = false;
let focusedPlayer = "home"; // "home" or "away"
let homeExtensionUsed = false;
let awayExtensionUsed = false;
let lastFiveSecondsAudio = "../resources/audio/sound_secondsTime.wav";
let finalAlarmAudio = "../resources/audio/sound_endTime.wav";
let lastFiveSecondsVolume = 1.0;
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

const home_extensionText = document.getElementById("home-extension-text");
const away_extensionText = document.getElementById("away-extension-text");

// === SHOT CLOCK FUNCTIONS ===
function updateShotDisplay() {
  const seconds = Math.floor(shotCurrentTime / 10);
  shotTimerDisplay.innerHTML = `${seconds}`;
}

async function UpdateDatabaseTimers (_matchID, _matchTime, _shotTime)
{
  // Update tbl_timers with new matchTime and shotTime for the given matchID
  response = await supabase
    .from('tbl_timers')
    .update({ matchTime: _matchTime, shotTime: _shotTime })
    .eq('matchID', _matchID);
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
      if (shotCurrentTime <= 60 && shotCurrentTime > 10 && shotCurrentTime % 10 === 0) {
        playAudio(lastFiveSecondsAudio, lastFiveSecondsVolume);
      }
      // Trigger final alarm at 0.9s or less (shotCurrentTime < 10)
      if (shotCurrentTime < 10) {
        clearInterval(shotClockInterval);
        shotClockInterval = null;
        shotClockActive = false;
        triggerShotAlarm();
        shotCurrentTime = 0; // Ensure display shows 0
        updateShotDisplay();
        return;
      }
      shotCurrentTime--;
      updateShotDisplay();
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

  // Convert matchCurrentTime to "mm:ss" format as text
  const matchMinutes = Math.floor(matchCurrentTime / 60);
  const matchSeconds = (matchCurrentTime % 60).toString().padStart(2, "0");
  const matchTimeText = `${matchMinutes}:${matchSeconds}`;
  
  UpdateDatabaseTimers(
    localStorage.getItem('matchID'),
    matchTimeText,
    Math.floor(shotCurrentTime / 10)
  );
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
    //if (homeExtensionContainer) homeExtensionContainer.style.display = "none";
    home_extensionText.style.color = "black";
    updateShotDisplay();
  } else if (player === "away" && !awayExtensionUsed) {
    shotCurrentTime += extensionTime * 10;
    awayExtensionUsed = true;
    //if (awayExtensionContainer) awayExtensionContainer.style.display = "none";
    away_extensionText.style.color = "black";
    updateShotDisplay();
  }
}

function resetExtensions() {
  homeExtensionUsed = false;
  awayExtensionUsed = false;
  home_extensionText.style.color = "rgba(236, 0, 140, 1)";
  away_extensionText.style.color = "rgba(236, 0, 140, 1)";
  //if (homeExtensionContainer) homeExtensionContainer.style.display = "";
  //if (awayExtensionContainer) awayExtensionContainer.style.display = "";
}

// === PLAYER FOCUS HANDLING ===
function setFocus(player) {
  focusedPlayer = player;
  const homeContainer = document.getElementById("player-home-container");
  const awayContainer = document.getElementById("player-away-container");
  if (homeContainer && awayContainer) {
    if (player === "home") {
      homeContainer.style.boxShadow = "inset 0 0 200px 20px rgba(236, 0, 140, 0.5)";
      awayContainer.style.boxShadow = "";
    } else {
      awayContainer.style.boxShadow = "inset 0 0 200px 20px rgba(236, 0, 140, 0.5)";
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

// === MATCH CLOCK FUNCTIONS ===
function updateMatchDisplay() {
  const minutes = Math.floor(matchCurrentTime / 60);
  const seconds = matchCurrentTime % 60;
  matchTimerDisplay.innerHTML = `${minutes}:${seconds.toString().padStart(2, "0")}`;
  
  // Convert matchCurrentTime to "mm:ss" format as text
  const matchMinutes = Math.floor(matchCurrentTime / 60);
  const matchSeconds = (matchCurrentTime % 60).toString().padStart(2, "0");
  const matchTimeText = `${matchMinutes}:${matchSeconds}`;

  UpdateDatabaseTimers(
    localStorage.getItem('matchID'),
    matchTimeText,
    Math.floor(shotCurrentTime / 10)
  );
}

function startMatchTimer() {
  if (matchTimerInterval) return;
  matchTimerInterval = setInterval(() => {
    if (matchCurrentTime > 0) {
      // Play beep for last 5 seconds
      if (matchCurrentTime <= 6 && matchCurrentTime > 0) {
        playAudio(lastFiveSecondsAudio, lastFiveSecondsVolume);
      }
      // Trigger final alarm at <1s (0.9s)
      if (matchCurrentTime < 1) {
        clearInterval(matchTimerInterval);
        matchTimerInterval = null;
        triggerMatchAlarm();
        matchCurrentTime = 0; // Ensure display shows 0
        updateMatchDisplay();
        return;
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
