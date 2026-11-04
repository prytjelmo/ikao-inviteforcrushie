const TEST_MODE = false;   // true = never remembers "Yes" (for testing). Set to false before sending the link!

// ---------- Screen switching ----------
function showScreen(id) {
    document.querySelectorAll(".screen").forEach((s) => s.classList.remove("active"));
    const target = document.getElementById(id);
    if (target) {
        target.classList.add("active");
    }
}

// ---------- Notification to my phone (ntfy.sh) ----------
const NTFY_TOPIC = "ikao-invite052504111603"; // <-- change to YOUR topic from the ntfy app

function notifyMe(title, message, tags) {
    try {
        fetch("https://ntfy.sh/" + NTFY_TOPIC, {
            method: "POST",
            body: message,
            headers: {
                Title: title,          // keep the title plain text (no emoji)
                Priority: "high",
                Tags: tags || "heart", // emoji shortcodes, e.g. "tada,heart"
            },
            keepalive: true, // still sends if she closes the page right away
        }).catch(() => { });
    } catch (e) { /* never break the site because of a notification */ }
}

// ---------- Background music ----------
const bgm = document.getElementById("bgm");
const musicBtn = document.getElementById("musicBtn");
const MUSIC_VOLUME = 0.6; // 0 to 1 (desktop and Android only; iPhone uses its own volume buttons)

function startMusic() {
    if (!bgm) return;

    bgm.volume = 0;
    const playing = bgm.play();

    if (playing && playing.catch) {
        playing.catch(() => { }); // file missing or blocked: the site keeps working without music
    }

    // fade in over ~2 seconds
    let v = 0;
    const fade = setInterval(() => {
        v = Math.min(v + 0.03, MUSIC_VOLUME);
        bgm.volume = v;
        if (v >= MUSIC_VOLUME) clearInterval(fade);
    }, 100);

    musicBtn.classList.remove("hidden");
}

musicBtn.addEventListener("click", () => {
    if (bgm.paused) {
        bgm.play();
        musicBtn.textContent = "🔊";
    } else {
        bgm.pause();
        musicBtn.textContent = "🔇";
    }
});

// ---------- Loading screen ----------
function runLoader() {
    const fill = document.getElementById("heartFill");
    const percentEl = document.getElementById("loaderPercent");
    const textEl = document.getElementById("loaderText");

    const DURATION = 4500; // total loading time in ms

    // Heart fill goes from y=90 (empty) to y=0 (full)
    const EMPTY_Y = 90;
    const FULL_Y = -2;

    // Rotating lines: they change at these percentages
    const messages = [
        { at: 0, text: "Preparing something for you..." },
        { at: 35, text: "Adding a little magic..." },
        { at: 70, text: "Almost there..." },
        { at: 95, text: "Ready." },
    ];
    let currentMsg = 0;

    function setMessage(text) {
        textEl.classList.add("fade");
        setTimeout(() => {
            textEl.textContent = text;
            textEl.classList.remove("fade");
        }, 400);
    }

    const easeInOut = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);

    let start = null;

    function frame(now) {
        if (start === null) start = now;
        const t = Math.min((now - start) / DURATION, 1);
        const progress = easeInOut(t) * 100;

        // move the fill up
        const y = EMPTY_Y + (FULL_Y - EMPTY_Y) * (progress / 100);
        fill.setAttribute("y", y);
        percentEl.textContent = Math.round(progress) + "%";

        // change message when we pass a threshold
        const next = messages[currentMsg + 1];
        if (next && progress >= next.at) {
            currentMsg++;
            setMessage(next.text);
        }

        if (t < 1) {
            requestAnimationFrame(frame);
        } else {
            // finished: show "tap to continue" and wait for tap
            setTimeout(() => {
                const loader = document.getElementById("loader");
                const hint = document.getElementById("tapHint");
                hint.classList.add("show");
                loader.classList.add("ready");

                loader.addEventListener(
                    "click",
                    () => {
                        startMusic();          // <-- add this
                        notifyMe("She opened it", "She tapped through the loading screen 👀", "eyes");
                        showScreen("message");
                        startMessage();
                    },
                    { once: true }
                );
            }, 500);
        }
    }

    requestAnimationFrame(frame);
}

// ---------- Message screen ----------
function startMessage() {
    const msg = document.getElementById("message");
    const hint = document.getElementById("msgHint");

    // wait until all lines have appeared, then allow the tap
    const WAIT = 7000; // ms (about 1.3s per line)

    setTimeout(() => {
        hint.classList.add("show");
        msg.classList.add("ready");
        msg.addEventListener(
            "click",
            () => {
                showScreen("letter");
                startLetter();
            },
            { once: true }
        );
    }, WAIT);
}

// ---------- Letter screen (typing effect) ----------
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let skipTyping = false;   // tapping the letter while it types shows the rest right away

function typeText(el, speed) {
    return new Promise((resolve) => {
        const full = el.dataset.full;
        const typed = el.querySelector(".typed");
        const untyped = el.querySelector(".untyped");
        let i = 0;

        el.classList.add("typing");

        function step() {
            if (skipTyping) i = full.length; else i++;
            typed.textContent = full.slice(0, i);
            untyped.textContent = full.slice(i);

            if (i >= full.length) {
                el.classList.remove("typing");
                resolve();
                return;
            }
            // pause a little longer after punctuation
            const ch = full[i - 1];
            setTimeout(step, ".,!?".includes(ch) ? speed * 5 : speed);
        }
        step();
    });
}

// Shrinks the letter text until the whole card fits on screen (no scrolling)
function fitLetter() {
    const letter = document.getElementById("letter");
    const box = letter.querySelector(".letter-box");
    const cs = getComputedStyle(letter);
    const available =
        letter.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom);

    box.style.fontSize = ""; // start from the normal size
    let size = parseFloat(getComputedStyle(box).fontSize);
    const MIN = 10; // never go smaller than this (px)

    while (box.offsetHeight > available && size > MIN) {
        size -= 0.5;
        box.style.fontSize = size + "px";
    }
}

// re-fit when the phone rotates or the window changes size
window.addEventListener("resize", fitLetter);
window.addEventListener("orientationchange", () => setTimeout(fitLetter, 200));

function startLetter() {
    const letter = document.getElementById("letter");
    const hint = document.getElementById("letterHint");
    const parts = [...letter.querySelectorAll(".letter-title, .letter-para")];

    const SPEED = 22; // ms per letter. Higher = slower

    skipTyping = false;

    // Hide all the text first, but keep its space so the box doesn't jump around
    parts.forEach((el) => {
        el.dataset.full = el.textContent.trim().replace(/\s+/g, " ");
        el.innerHTML = '<span class="typed"></span><span class="untyped"></span>';
        el.querySelector(".untyped").textContent = el.dataset.full;
    });

    fitLetter();
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(fitLetter);

    (async () => {
        await sleep(1000);

        // a tap while it's typing shows the rest of the letter immediately
        const skip = () => { skipTyping = true; };
        letter.addEventListener("click", skip);

        for (const el of parts) {
            await typeText(el, SPEED);
            if (!skipTyping) await sleep(600);
        }

        letter.removeEventListener("click", skip);

        // finished: show "Tap to continue" and wait for the tap
        hint.classList.add("show");
        letter.classList.add("ready");
        await sleep(500); // so a quick double tap can't skip past the letter

        letter.addEventListener(
            "click",
            () => {
                showScreen("invite");
                initInvite();
            },
            { once: true }
        );
    })();
}

// ---------- Invite screen ----------
function initInvite() {
    const invite = document.getElementById("invite");
    const btnGroup = document.querySelector(".btn-group");
    const btnYes = document.getElementById("btnYes");
    const btnNo = document.getElementById("btnNo");
    const celeb = document.getElementById("celebration");
    const witty = document.getElementById("wittyLine");

    if (!btnYes || !btnNo) return;

    const MAX_TAPS = 5; // on this tap, "No" becomes "Yes"
    const noResponses = ["luuhh? 🥺", "please? 🌸", "halaaa, cge na ba! 😜", "Last chance... 💕"];
    const WITTY_LINE = "Nope: bawal mag \"No\" hehe 😌";

    let taps = 0;
    let placeholder = null;
    let converted = false;

    let notified = false; // add this line next to `let taps = 0;`

    function celebrate() {
        invite.querySelector(".invite-box").classList.add("shine");
        btnGroup.style.display = "none";
        btnNo.style.display = "none";   // hides the floating No button if it's still running around
        witty.classList.add("hidden");
        celeb.classList.remove("hidden");
        spawnHearts();

        if (!notified) {
            notified = true;
            const tries = taps === 0
                ? "She said YES right away! 💖"
                : `She said YES after tapping No ${taps} time${taps > 1 ? "s" : ""} 😄💖`;
            notifyMe("She said YES!", tries, "tada,heart");
        }

        rememberYes();
        setTimeout(() => document.getElementById("btnDetails").classList.remove("hidden"), 3500);
    }

    function overlaps(x, y, w, h, r, gap) {
        return x < r.right + gap && x + w > r.left - gap &&
            y < r.bottom + gap && y + h > r.top - gap;
    }

    function moveNo() {
        // first time: lift the button out so it can roam the whole screen
        if (!placeholder) {
            const r = btnNo.getBoundingClientRect();
            placeholder = btnNo.cloneNode(true);
            placeholder.removeAttribute("id");
            placeholder.style.visibility = "hidden";
            placeholder.setAttribute("aria-hidden", "true");
            btnGroup.insertBefore(placeholder, btnNo); // keeps Yes where it is

            invite.appendChild(btnNo);
            btnNo.classList.add("is-dodging");
            btnNo.style.left = r.left + "px";
            btnNo.style.top = r.top + "px";
            void btnNo.offsetWidth; // so the move animates
        }

        const w = btnNo.offsetWidth;
        const h = btnNo.offsetHeight;
        const pad = 16;
        const yesRect = btnYes.getBoundingClientRect();
        const curX = parseFloat(btnNo.style.left);
        const curY = parseFloat(btnNo.style.top);

        let x, y, tries = 0;
        do {
            x = pad + Math.random() * (window.innerWidth - w - pad * 2);
            y = pad + Math.random() * (window.innerHeight - h - pad * 2);
            tries++;
        } while (
            tries < 40 &&
            (overlaps(x, y, w, h, yesRect, 20) || Math.hypot(x - curX, y - curY) < 120)
        );

        btnNo.style.left = x + "px";
        btnNo.style.top = y + "px";
    }

    function convertToYes() {
        converted = true;

        // put the button back next to the real Yes
        btnGroup.insertBefore(btnNo, placeholder);
        placeholder.remove();
        btnNo.classList.remove("is-dodging", "btn-no");
        btnNo.style.left = "";
        btnNo.style.top = "";
        btnNo.classList.add("btn-yes", "btn-pop");
        btnNo.textContent = "Yes 💖";

        witty.textContent = WITTY_LINE;
        witty.classList.remove("hidden");
    }

    btnYes.addEventListener("click", celebrate);

    btnNo.addEventListener("click", () => {
        if (converted) {
            celebrate();
            return;
        }
        taps++;
        if (taps >= MAX_TAPS) {
            convertToYes();
        } else {
            btnNo.textContent = noResponses[taps - 1];
            moveNo();
        }
    });
}

// ---------- Heart Confetti ----------
function spawnHearts() {
    const symbols = ["💖", "🌸", "💕", "✨", "🌷", "💗"];

    const w = window.innerWidth;
    const h = window.innerHeight;
    const small = w < 600;

    const COUNT = small ? 22 : 30;
    const minSize = small ? 20 : 26;
    const maxSize = small ? 34 : 46;
    const edge = 28; // keep hearts this far from the left and right edges

    for (let i = 0; i < COUNT; i++) {
        setTimeout(() => {
            const size = minSize + Math.random() * (maxSize - minSize);
            const dur = 2.8 + Math.random() * 1.4;

            const p = document.createElement("div");
            p.className = "particle";
            p.textContent = symbols[Math.floor(Math.random() * symbols.length)];

            p.style.fontSize = size + "px";
            p.style.left = edge + Math.random() * Math.max(w - size - edge * 2, 0) + "px";

            // how high it floats: 55% to 90% of the screen height
            p.style.setProperty("--rise", h * (0.55 + Math.random() * 0.35) + "px");
            // small sideways wobble
            p.style.setProperty("--drift", (Math.random() * 56 - 28) + "px");
            p.style.setProperty("--spin", (Math.random() * 50 - 25) + "deg");
            p.style.setProperty("--dur", dur + "s");

            document.body.appendChild(p);
            setTimeout(() => p.remove(), dur * 1000 + 200);
        }, i * 90);
    }
}

// =========================================================
// PART 2: INVITATION PAGE  (edit the details below)
// =========================================================
const INVITE = {
    herName: "Thresha Mae Sulamin",
    yourName: "Prytj Elmo Quimbo",
    subline: "A dinner date at IKAO",
    dateTime: "2026-11-21T19:00:00+08:00",   // YYYY-MM-DD T 24h time +08:00 (Philippines)
    durationHours: 2,                         // used for the calendar event
    restaurant: "IKAO",
    address: " 2nd Floor, Reefside Surf Co. Building, Matina Aplaya, Talomo, Davao City, 8000 Davao del Sur, Philippines",                  // full address
    mapsQuery: "IKAO Matina Aplaya Davao City",       // what Google Maps searches for
    venueNote: "Don't worry, cutie, I'll pick you up. Just focus on always being gorgeous. 💕",
    dressCode: "Smart casual",
    attireNote: "Wear something you feel pretty in. If you'd like a color idea, here's a palette:",
    attireWitty: "PS: whatever color or outfit you wear, you're always beautiful. 💕",
    colors: [
        { name: "Blush", hex: "#f7c3cf" },
        { name: "Rose", hex: "#b85b70" },
        { name: "Black", hex: "#1a1a1a" },
        { name: "White", hex: "#ffffff" },
        { name: "Pastel Yellow", hex: "#fdf3b0" },
        { name: "Navy Blue", hex: "#1f2a4d" },
    ],
    closingLine: "Can't wait to spend this day with you.",
};

// ---------- remember her answer ----------
function hasSaidYes() {
    if (TEST_MODE) return false;
    try { return localStorage.getItem("saidYes") === "1"; } catch (e) { return false; }
}
function rememberYes() {
    if (TEST_MODE) return;
    try { localStorage.setItem("saidYes", "1"); } catch (e) { }
}

// ---------- build the invitation page ----------
let detailsReady = false;

function initDetails() {
    if (detailsReady) return;
    detailsReady = true;

    const $ = (id) => document.getElementById(id);
    const when = new Date(INVITE.dateTime);
    const dateText = when.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric", timeZone: "Asia/Manila" });
    const timeText = when.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: "Asia/Manila" });

    // home
    $("invHer").textContent = INVITE.herName;
    $("invYou").textContent = INVITE.yourName;
    $("invSub").textContent = INVITE.subline;
    $("invDate").textContent = dateText;
    $("invTime").textContent = timeText;
    $("invClose").textContent = INVITE.closingLine;

    // countdown
    const pad = (n) => String(n).padStart(2, "0");
    function tick() {
        let diff = when - Date.now();
        if (diff <= 0) {
            diff = 0;
            $("invClose").textContent = "It's today! See you soon 💖";
        }
        $("cdDays").textContent = pad(Math.floor(diff / 86400000));
        $("cdHours").textContent = pad(Math.floor((diff % 86400000) / 3600000));
        $("cdMins").textContent = pad(Math.floor((diff % 3600000) / 60000));
        $("cdSecs").textContent = pad(Math.floor((diff % 60000) / 1000));
    }
    tick();
    setInterval(tick, 1000);

    // calendar grid with the day highlighted
    const y = when.getFullYear(), m = when.getMonth(), day = when.getDate();
    $("calHead").textContent = when.toLocaleDateString("en-US", { month: "long", year: "numeric" });
    const first = new Date(y, m, 1).getDay();
    const total = new Date(y, m + 1, 0).getDate();
    let grid = ["S", "M", "T", "W", "T", "F", "S"].map((d) => `<span class="cal-dow">${d}</span>`).join("");
    for (let i = 0; i < first; i++) grid += "<span></span>";
    for (let d = 1; d <= total; d++) grid += `<span class="cal-day${d === day ? " on" : ""}">${d}</span>`;
    $("calGrid").innerHTML = grid;
    $("whenLine").textContent = `${dateText} · ${timeText}`;

    // add to calendar (.ics file; iPhone and Android offer to add it)
    $("btnCal").addEventListener("click", () => {
        const fmt = (d) => d.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
        const esc = (s) => s.replace(/,/g, "\\,");
        const end = new Date(when.getTime() + INVITE.durationHours * 3600000);
        const ics = [
            "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Invite//EN", "BEGIN:VEVENT",
            "UID:" + Date.now() + "@invite",
            "DTSTAMP:" + fmt(new Date()),
            "DTSTART:" + fmt(when),
            "DTEND:" + fmt(end),
            "SUMMARY:" + esc("Dinner at " + INVITE.restaurant),
            "LOCATION:" + esc(INVITE.address),
            "DESCRIPTION:Our date",
            "END:VEVENT", "END:VCALENDAR",
        ].join("\r\n");
        const a = document.createElement("a");
        a.href = URL.createObjectURL(new Blob([ics], { type: "text/calendar;charset=utf-8" }));
        a.download = "our-date.ics";
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    });

    // venue
    $("venueName").textContent = INVITE.restaurant;
    $("venueAddress").textContent = INVITE.address;
    $("venueNote").textContent = INVITE.venueNote;
    const mapQ = encodeURIComponent(INVITE.mapsQuery || INVITE.address);
    $("venueMap").src = "https://maps.google.com/maps?q=" + mapQ + "&z=16&output=embed";
    $("mapOpen").href = "https://www.google.com/maps/search/?api=1&query=" + mapQ;
    $("btnMaps").href = "https://www.google.com/maps/dir/?api=1&destination=" + mapQ;

    // attire
    $("dressCode").textContent = INVITE.dressCode;
    $("attireNote").textContent = INVITE.attireNote;
    $("swatches").innerHTML = INVITE.colors
        .map((c) => `<span class="swatch"><i style="background:${c.hex}"></i>${c.name}</span>`)
        .join("");
    $("attireWitty").textContent = INVITE.attireWitty;

    // message: sends a notification to your phone (uses notifyMe from the ntfy step)
    const status = $("replyStatus");
    function sendReply(text) {
        text = (text || "").trim();
        if (!text) return;
        notifyMe("She sent you a message", text, "speech_balloon");
        status.textContent = "Sent 💌";
        $("replyText").value = "";
        setTimeout(() => (status.textContent = ""), 3000);
    }
    $("quickReplies").addEventListener("click", (e) => {
        const chip = e.target.closest(".chip");
        if (chip) sendReply(chip.dataset.msg);
    });
    $("btnSend").addEventListener("click", () => sendReply($("replyText").value));

    // tabs
    document.querySelectorAll(".tab").forEach((tab) => {
        tab.addEventListener("click", () => {
            document.querySelectorAll(".tab").forEach((t) => t.classList.toggle("active", t === tab));
            document.querySelectorAll(".panel").forEach((p) => p.classList.toggle("active", p.id === "tab-" + tab.dataset.tab));
        });
    });
}

// ---------- "See the details" button after she says yes ----------
document.getElementById("btnDetails").addEventListener("click", () => {
    showScreen("details");
    initDetails();
});

// ---------- START: first visit = full surprise, return visit = invitation only ----------
if (TEST_MODE) {
    // clear anything saved from earlier tests so the full flow always starts fresh
    document.documentElement.classList.remove("returning");
    try { localStorage.removeItem("saidYes"); } catch (e) { }
}
if (/reset/.test(location.search)) {
    try { localStorage.removeItem("saidYes"); } catch (e) { }
}

if (hasSaidYes()) {
    showScreen("details");
    initDetails();
    bgm.volume = MUSIC_VOLUME;
    musicBtn.textContent = "🔇";
    musicBtn.classList.remove("hidden");
    // her first tap anywhere starts the song (phones block autoplay)
    document.getElementById("details").addEventListener("click", () => {
        startMusic();
        musicBtn.textContent = "🔊";
    }, { once: true });
} else {
    runLoader();
}