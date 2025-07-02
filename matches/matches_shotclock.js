// Global variables for customization
let shotTime = 45; // Default shot time in seconds
let extensionTime = 15; // Additional time for extensions
let lastThreeSecondsAudio = "../resources/audio/audio_timer_Beep.mp3"; // Audio for the last three seconds
let finalAlarmAudio = "../resources/audio/audio_timer_alarm.mp3"; // Audio for the final alarm
let lastThreeSecondsVolume = 0.5; // Volume for the last three seconds audio (0.0 to 1.0)
let finalAlarmVolume = 1.0; // Volume for the final alarm audio (0.0 to 1.0)
let timerInterval = null; // Interval for the countdown timer
let currentTime = shotTime * 10; // Current time in tenths of a second

// Key assignments
const startKey = "s"; // Start the timer
const pauseKey = "p"; // Pause the timer
const resetKey = "r"; // Reset the timer
const restartKey = " "; // Restart the timer for the next shot (spacebar)
const extensionKey = "b"; // Extend the shot time by 15 seconds

console.log(`Shot Clock Key bindings - Start: ${startKey}, Pause: ${pauseKey}, Reset: ${resetKey}, Restart: [space], Extension: ${extensionKey}, Increase Time: ArrowUp, Decrease Time: ArrowDown`);
console.log(`Match Timer Key bindings - Start: m, Pause/Resume: n, Reset: v, Increase Time: w, Decrease Time: q`);


// Timer display element
const timerDisplay = document.getElementById("shot-time");

// Helper for double press detection
let lastPageUpTime = 0;
let lastPageDownTime = 0;
const doublePressThreshold = 400; // ms

document.addEventListener("keydown", (event) => {
  console.log(`Key pressed: ${event.key} | Code: ${event.code}`);

  const now = Date.now();

  switch (event.code) {
    case "PageDown":
      if (now - lastPageDownTime < doublePressThreshold) {
        // Double press detected
        console.log("Double PageDown detected");
        // Add your double PageDown logic here
        // Example: reset and flash timer
        resetTimer();
        flashTimer();
      } else {
        resetTimer(); // Single press: reset the timer
      }
      lastPageDownTime = now;
      break;
    case "PageUp":
      if (now - lastPageUpTime < doublePressThreshold) {
        // Double press detected
        console.log("Double PageUp detected");
        // Add your double PageUp logic here
        // Example: reset, start, and flash timer
        resetTimer();
        startTimer();
        flashTimer();
      } else {
        resetTimer(); // Single press: reset the timer
        startTimer(); // Start the timer for the next shot
      }
      lastPageUpTime = now;
      break;
    default:
      // Optional: log unknown keys
      console.log("Unhandled key:", event.code);
  }
});

// Function to update the timer display
function updateDisplay() {
    const seconds = Math.floor(currentTime / 10);
    timerDisplay.innerHTML = `${seconds}`;
}

// Function to play audio with adjustable volume
function playAudio(audioFile, volume) {
    const audio = new Audio(audioFile);
    audio.volume = volume;
    audio.play();
    console.log(`Playing audio: ${audioFile} at volume: ${volume}`);
}

// Function to start the timer
function startTimer() {
    if (timerInterval) return; // Prevent multiple intervals
    timerInterval = setInterval(() => {
        if (currentTime > 0) {
            if (currentTime <= 40 && currentTime % 10 === 0) {
                playAudio(lastThreeSecondsAudio, lastThreeSecondsVolume); // Play audio for the last three seconds
            }
            currentTime--;
            updateDisplay();
        } else {
            clearInterval(timerInterval);
            timerInterval = null;
            triggerAlarm();
        }
    }, 100); // Update every 100 milliseconds
}

// Function to pause the timer
function pauseTimer() {
    clearInterval(timerInterval);
    timerInterval = null;
}

// Function to reset the timer
function resetTimer() {
  pauseTimer();
  currentTime = shotTime * 10;
  updateDisplay();
}

// Function to flash the timer display
function flashTimer() {
    const flashInterval = setInterval(() => {
        timerDisplay.style.color = timerDisplay.style.color === "red" ? "white" : "red";
    }, 200); // Toggle color every 200ms

    setTimeout(() => {
        clearInterval(flashInterval);
        timerDisplay.style.color = "white"; // Reset to white after flashing
    }, 2000); // Stop flashing after 2 seconds
}

// Function to trigger the final alarm
function triggerAlarm() {
    console.log("Alarm triggered! Time's up.");
    playAudio(finalAlarmAudio, finalAlarmVolume); // Play the final alarm audio
    flashTimer(); // Flash the timer display
}

// Event listener for keyboard controls
document.addEventListener("keydown", (event) => {
    switch (event.key.toLowerCase()) {
        case startKey:
            startTimer();
            break;
        case pauseKey:
            pauseTimer();
            break;
        case resetKey:
            resetTimer();
            break;
        case restartKey:
            resetTimer(); // Reset the timer
            startTimer(); // Start the timer for the next shot
            break;
        case "arrowup": // Increase shotTime by 5 seconds
            shotTime += 5;
            currentTime = shotTime * 10; // Update current time
            updateDisplay();
            console.log(`Shot time increased to ${shotTime} seconds`);
            break;
        case "arrowdown": // Decrease shotTime by 5 seconds, minimum 5 seconds
            shotTime = Math.max(5, shotTime - 5);
            currentTime = shotTime * 10; // Update current time
            updateDisplay();
            console.log(`Shot time decreased to ${shotTime} seconds`);
            break;
        case extensionKey:
            // Double press detection for extension key
            if (!window.lastExtensionKeyTime) window.lastExtensionKeyTime = 0;
            const extensionNow = Date.now();
            if (extensionNow - window.lastExtensionKeyTime < doublePressThreshold) {
          // Double press: add double extension time
          currentTime += extensionTime * 2 * 10;
          updateDisplay();
          console.log(`Double extension: Shot time extended by ${extensionTime * 2} seconds. New shot time: ${Math.floor(currentTime / 10)} seconds`);
            } else {
          // Single press: add extension time
          currentTime += extensionTime * 10;
          updateDisplay();
          console.log(`Shot time extended by ${extensionTime} seconds. New shot time: ${Math.floor(currentTime / 10)} seconds`);
            }
            window.lastExtensionKeyTime = extensionNow;
            break;
    }
});

// Initialize the display
updateDisplay();


// Global variables for match timer
let matchTimeMinutes = 50; // Default match time in minutes
let matchCurrentTime = matchTimeMinutes * 60; // Current time in seconds
let matchTimerInterval = null;

// Match timer display element
const matchTimerDisplay = document.getElementById("match-time");

// Function to update the match timer display
function updateMatchDisplay() {
  const minutes = Math.floor(matchCurrentTime / 60);
  const seconds = matchCurrentTime % 60;
  matchTimerDisplay.innerHTML = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

// Function to pause the match timer
function pauseMatchTimer() {
  clearInterval(matchTimerInterval);
  matchTimerInterval = null;
}

// Function to reset the match timer
function resetMatchTimer() {
  pauseMatchTimer();
  matchCurrentTime = matchTimeMinutes * 60;
  updateMatchDisplay();
  // Clear stored remaining time in local and session storage
  localStorage.removeItem("matchTimerRemaining");
  sessionStorage.removeItem("matchTimerRemaining");
}

// Event listener for match timer controls
document.addEventListener("keydown", (event) => {
  switch (event.key.toLowerCase()) {
    case "m": // Start the match timer
      startMatchTimer();
      break;
    case "n": // Pause/Start toggle
      if (matchTimerInterval) {
        pauseMatchTimer();
      } else {
        startMatchTimer();
      }
      break;
    case "v": // Restart the match timer
      resetMatchTimer();
      break;
    case "q": // Decrease match time by 1 minute, minimum 1 minute
      matchTimeMinutes = Math.max(1, matchTimeMinutes - 1);
      matchCurrentTime = matchTimeMinutes * 60; // Update current time
      updateMatchDisplay();
      console.log(`Match time decreased to ${matchTimeMinutes} minutes`);
      break;
    case "w": // Increase match time by 1 minute
      matchTimeMinutes += 1;
      matchCurrentTime = matchTimeMinutes * 60; // Update current time
      updateMatchDisplay();
      console.log(`Match time increased to ${matchTimeMinutes} minutes`);
      break;
  }
});

// Initialize the match timer display
updateMatchDisplay();

// Function to flash the match timer display
function flashMatchTimer() {
  const flashInterval = setInterval(() => {
    matchTimerDisplay.style.color = matchTimerDisplay.style.color === "red" ? "white" : "red";
  }, 200); // Toggle color every 200ms

  setTimeout(() => {
    clearInterval(flashInterval);
    matchTimerDisplay.style.color = "white"; // Reset to white after flashing
  }, 2000); // Stop flashing after 2 seconds
}

// Function to trigger the final alarm for the match timer
function triggerMatchAlarm() {
  console.log("Match alarm triggered! Time's up.");
  playAudio(finalAlarmAudio, finalAlarmVolume); // Play the final alarm audio
  flashMatchTimer(); // Flash the match timer display
}

// Update the match timer logic to call triggerMatchAlarm when time is up
function startMatchTimer() {
  if (matchTimerInterval) return; // Prevent multiple intervals

  matchTimerInterval = setInterval(() => {
    if (matchCurrentTime > 0) {
      matchCurrentTime--;
      updateMatchDisplay();
      // Store remaining time every second
      localStorage.setItem("matchTimerRemaining", matchCurrentTime);
      sessionStorage.setItem("matchTimerRemaining", matchCurrentTime);
    } else {
      clearInterval(matchTimerInterval);
      matchTimerInterval = null;
      // Clear storage when timer ends
      localStorage.removeItem("matchTimerRemaining");
      sessionStorage.removeItem("matchTimerRemaining");
      triggerMatchAlarm(); // Call the alarm function when match time is up
    }
  }, 1000); // Update every second
}

// On page load, check if timer was running and update matchCurrentTime accordingly
(function restoreMatchTimer() {
  const storedRemaining = localStorage.getItem("matchTimerRemaining") || sessionStorage.getItem("matchTimerRemaining");
  if (storedRemaining !== null && !isNaN(Number(storedRemaining))) {
    matchCurrentTime = Number(storedRemaining);
    updateMatchDisplay();
    startMatchTimer(); // Start the timer if it was running
    // Optionally, you could auto-restart the timer here if desired
    // if (matchCurrentTime > 0) startMatchTimer();
    if (matchCurrentTime === 0) {
      triggerMatchAlarm();
    }
  }
})();
