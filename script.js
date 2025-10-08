///////////////
// PARAMETERS //
///////////////

const queryString = window.location.search;
const urlParams = new URLSearchParams(queryString);

const client_id = urlParams.get("client_id") || "";
const client_secret = urlParams.get("client_secret") || "";
let refresh_token = urlParams.get("refresh_token") || "";
let access_token = "";

const visibilityDuration = urlParams.get("duration") || 0;
const hideAlbumArt = urlParams.has("hideAlbumArt");
const design = parseInt(urlParams.get("design")) || 1;

// Apply design class to body
document.body.classList.add(`design-${design}`);

let currentState = false;
let currentSongUri = "";

if (![1, 2, 3].includes(design)) {
	console.warn(`Unknown design "${design}", using default.`);
}

//////////////////////////////
// LOADING / STATUS HANDLER //
//////////////////////////////

const statusContainer = document.getElementById("statusContainer");

function showStatus(message = "Connecting to Spotify...") {
	if (!statusContainer) return;
	statusContainer.innerHTML = `<span>${message}</span>`;
	statusContainer.classList.add("active");
}

function hideStatus(delay = 800) {
	if (!statusContainer) return;
	setTimeout(() => {
		statusContainer.classList.remove("active");
	}, delay);
}

/////////////////
// SPOTIFY API //
/////////////////

async function RefreshAccessToken() {
	console.debug(`Client ID: ${client_id}`);
	console.debug(`Client Secret: ${client_secret}`);
	console.debug(`Refresh Token: ${refresh_token}`);

	showStatus("Refreshing Spotify access...");

	let body = "grant_type=refresh_token";
	body += "&refresh_token=" + refresh_token;
	body += "&client_id=" + client_id;

	try {
		const response = await fetch("https://accounts.spotify.com/api/token", {
			method: "POST",
			headers: {
				'Authorization': `Basic ${btoa(client_id + ":" + client_secret)}`,
				'Content-Type': 'application/x-www-form-urlencoded'
			},
			body: body
		});

		if (response.ok) {
			const responseData = await response.json();
			console.debug(responseData);
			access_token = responseData.access_token;
			hideStatus(); // hide loading screen
		} else {
			showStatus(`Auth error: ${response.status}`);
			console.error(`${response.status}`);
		}
	} catch (err) {
		console.error("Access token refresh failed:", err);
		showStatus("Failed to connect. Retrying...");
		setTimeout(RefreshAccessToken, 3000);
	}
}

async function GetCurrentlyPlaying() {
	try {
		const response = await fetch("https://api.spotify.com/v1/me/player/currently-playing", {
			method: "GET",
			headers: {
				'Authorization': `Bearer ${access_token}`,
				'Content-Type': 'application/json'
			}
		});

		if (response.ok) {
			const responseData = await response.json();
			console.debug(responseData);
			UpdatePlayer(responseData);
			hideStatus(400);
		} else {
			switch (response.status) {
				case 401:
					console.debug(`${response.status}`);
					showStatus("Refreshing credentials...");
					await RefreshAccessToken();
					break;
				case 204:
					showStatus("No track playing...");
					SetVisibility(false);
					break;
				default:
					showStatus(`Spotify error: ${response.status}`);
					console.error(`${response.status}`);
			}
		}

		setTimeout(() => {
			GetCurrentlyPlaying();
		}, 1500);
	} catch (error) {
		console.debug(error);
		SetVisibility(false);
		showStatus("Reconnecting to Spotify...");
		setTimeout(() => {
			GetCurrentlyPlaying();
		}, 2000);
	}
}

//////////////////////
// PLAYER UPDATER	 //
//////////////////////

function UpdatePlayer(data) {
	if (!data || !data.item) return;

	const isPlaying = data.is_playing;
	const songUri = data.item.uri;
	const albumArt = data.item.album.images.length > 0
		? data.item.album.images[0].url
		: "images/placeholder-album-art.png";
	const artist = data.item.artists[0].name;
	const name = data.item.name;
	const duration = data.item.duration_ms / 1000;
	const progress = data.progress_ms / 1000;

	// Visibility management
	if (isPlaying !== currentState) {
		if (!isPlaying) {
			console.debug("Hiding player...");
			SetVisibility(false);
		} else {
			console.debug("Showing player...");
			setTimeout(() => {
				SetVisibility(true);
				if (visibilityDuration > 0) {
					setTimeout(() => {
						SetVisibility(false, false);
					}, visibilityDuration * 1000);
				}
			}, 500);
		}
	}

	if (songUri !== currentSongUri && isPlaying) {
		currentSongUri = songUri;
		setTimeout(() => {
			SetVisibility(true);
			if (visibilityDuration > 0) {
				setTimeout(() => {
					SetVisibility(false, false);
				}, visibilityDuration * 1000);
			}
		}, 500);
	}

	// Update visuals
	UpdateAlbumArt(document.getElementById("albumArt"), albumArt);
	UpdateAlbumArt(document.getElementById("backgroundImage"), albumArt);
	UpdateTextLabel(document.getElementById("artistLabel"), artist);
	UpdateTextLabel(document.getElementById("songLabel"), name);

	// Progress
	const progressPerc = (progress / duration) * 100;
	const progressTime = ConvertSecondsToMinutes(progress);
	const timeRemaining = ConvertSecondsToMinutes(duration - progress);
	document.getElementById("progressBar").style.width = `${progressPerc}%`;
	document.getElementById("progressTime").innerHTML = progressTime;
	document.getElementById("timeRemaining").innerHTML = `-${timeRemaining}`;

	setTimeout(() => {
		document.getElementById("albumArtBack").src = albumArt;
		document.getElementById("backgroundImageBack").src = albumArt;
	}, 1000);
}

////////////////////////
// UTILITY FUNCTIONS	//
////////////////////////

function UpdateTextLabel(div, text) {
	if (div.innerText !== text) {
		div.classList.remove("text-show");
		div.classList.add("text-fade");
		setTimeout(() => {
			div.innerText = text;
			div.classList.remove("text-fade");
			div.classList.add("text-show");
		}, 300);
	}
}

function UpdateAlbumArt(div, imgsrc) {
	if (div.src !== imgsrc) {
		div.classList.remove("text-show");
		div.classList.add("text-fade");
		setTimeout(() => {
			div.src = imgsrc;
			div.classList.remove("text-fade");
			div.classList.add("text-show");
		}, 300);
	}
}

function ConvertSecondsToMinutes(time) {
	const minutes = Math.floor(time / 60);
	const seconds = Math.trunc(time - minutes * 60);
	return `${minutes}:${('0' + seconds).slice(-2)}`;
}

function SetVisibility(isVisible, updateCurrentState = true) {
	const mainContainer = document.getElementById("mainContainer");
	if (!mainContainer) return;

	mainContainer.style.opacity = isVisible ? 1 : 0;
	mainContainer.style.transform = isVisible ? "scale(1)" : "scale(0.98)";
	mainContainer.style.transition = "opacity 0.4s ease, transform 0.4s ease";

	if (updateCurrentState) currentState = isVisible;
}

//////////////////////////////
// RESPONSIVE ADJUSTMENT	 //
//////////////////////////////

window.addEventListener("resize", () => {
	const outer = document.getElementById('mainContainer');
	if (!outer) return;
	const scale = Math.min(window.innerWidth / 600, 1);
	outer.style.transform = `scale(${scale})`;
});

//////////////////////////////
// OPTIONAL: HIDE ALBUM ART //
//////////////////////////////

if (hideAlbumArt) {
	document.getElementById("albumArtBox").style.display = "none";
	document.getElementById("songInfoBox").style.width = "100%";
}

//////////////////////////////////////
// KICK OFF THE WHOLE SPOTIFY WIDGET
//////////////////////////////////////

showStatus("Connecting to Spotify...");
RefreshAccessToken();
GetCurrentlyPlaying();
