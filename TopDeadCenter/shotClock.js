// Global variables for customization
let shotTime = 5; // Default shot time in seconds
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
const extensionKey = "e"; // Extend the shot time by 15 seconds

console.log(`Key bindings - Start: ${startKey}, Pause: ${pauseKey}, Reset: ${resetKey}`);


// Timer display element
const timerDisplay = document.getElementById("shot-time");

// Function to update the timer display
function updateDisplay() {
    const seconds = Math.floor(currentTime / 10);
    const tenths = currentTime % 10;
    timerDisplay.innerHTML = `${seconds}<sub>.${tenths}</sub>`;
}

// Function to play audio with adjustable volume
function playAudio(audioFile, volume) {
    const audio = new Audio(audioFile);
    audio.volume = volume;
    audio.play();
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
            currentTime += extensionTime * 10; // Add extension time in tenths of a second
            updateDisplay();    
            console.log(`Shot time extended by ${extensionTime} seconds. New shot time: ${shotTime} seconds`);
            break;
    }
});

// Initialize the display
updateDisplay();

// Global variables
let match = {};
let players = {
  H: { anonymous: true, id: null, username: null, name: null, nickname: null },
  A: { anonymous: true, id: null, username: null, name: null, nickname: null },
};

// Function to get match ID
function GetMatchID() {
  let matchID = new URLSearchParams(window.location.search).get('matchID');
  if (!matchID) {
    matchID = localStorage.getItem('matchID') || sessionStorage.getItem('matchID');
  }
  if (matchID) {
    localStorage.setItem('matchID', matchID);
    sessionStorage.setItem('matchID', matchID);
    return matchID;
  } else {
    window.location.href = "../matches/create.html";
  }
}

// Function to fetch match data
async function GetMatch(matchID) {
  const response = await supabase.from('tbl_matches').select('*').eq('id', matchID);
  return response.error ? null : response.data[0];
}

// Function to fetch player profiles
async function GetPlayerProfiles(playerID) {
  const response = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(playerID)
    ? await supabase.from('tbl_players').select('*').eq('id', playerID)
    : await supabase.from('tbl_players').select('*').eq('username', playerID);
  return response.data[0];
}

// Function to populate player data
async function PopulatePlayerData(match) 
{
  const response_H = await GetPlayerProfiles(match.player_H);
  if (response_H) {
    players.H = {
      anonymous: false,
      id: response_H.id,
      username: response_H.username,
      name: response_H.surname ? `${response_H.name} ${response_H.surname}` : response_H.name,
      nickname: response_H.nickname,
    };
  } else {
    players.H.name = match.player_H;
    players.H.username = match.player_H;
  }

  const response_A = await GetPlayerProfiles(match.player_A);
  if (response_A) {
    players.A = {
      anonymous: false,
      id: response_A.id,
      username: response_A.username,
      name: response_A.surname ? `${response_A.name} ${response_A.surname}` : response_A.name,
      nickname: response_A.nickname,
    };
  } else {
    players.A.name = match.player_A;
    players.A.username = match.player_A;
  }
}

// Function to update player UI
async function UI_UpdatePlayerProfiles() {
document.getElementById('player-H-name').innerHTML = `<h2>${players.H.name || players.H.username || 'Unknown Player'}</h2>`;
document.getElementById('player-A-name').innerHTML = `<h2>${players.A.name || players.A.username || 'Unknown Player'}</h2>`;

  const r_H = await supabase.storage.from('bucket-profile-pics').getPublicUrl(players.H.id);
  if (r_H.data && r_H.data.publicUrl && !r_H.data.publicUrl.endsWith('null')) {
    const imgElement_H = document.getElementById('player-H-pic');
    const img = new Image();
    img.onload = () => (imgElement_H.src = r_H.data.publicUrl);
    img.src = r_H.data.publicUrl;
  }

  const r_A = await supabase.storage.from('bucket-profile-pics').getPublicUrl(players.A.id);
  if (r_A.data && r_A.data.publicUrl && !r_A.data.publicUrl.endsWith('null')) {
    const imgElement_A = document.getElementById('player-A-pic');
    const img = new Image();
    img.onload = () => (imgElement_A.src = r_A.data.publicUrl);
    img.src = r_A.data.publicUrl;
  }
}

// Initialize match and player data
async function Initialize() {
  const matchID = GetMatchID();
  match = await GetMatch(matchID);
  if (match) {
    await PopulatePlayerData(match);
    await UI_UpdatePlayerProfiles();
  }
}

// Call Initialize on page load
Initialize();
