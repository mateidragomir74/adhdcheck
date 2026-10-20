// DOM UI overlay for Storm Watch (speech banner, start button, practice hand, celebration).
// High contrast, child-friendly, colorful, responsive.

const CSS = `
.sw-root{position:relative;width:100%;height:100%;overflow:hidden;touch-action:none;user-select:none;-webkit-user-select:none;-webkit-touch-callout:none;-webkit-tap-highlight-color:transparent;
background:linear-gradient(180deg,#151042 0%,#241e63 35%,#3a3182 68%,#4f4296 100%)}
.sw-root>canvas{position:absolute;inset:0;width:100%;height:100%;display:block}
.sw-ui{position:absolute;inset:0;pointer-events:none;font-family:ui-rounded,"SF Pro Rounded","Arial Rounded MT Bold","Nunito","Varela Round",system-ui,sans-serif}

/* Top message banner: fixed at top with high contrast, never covers the central lantern/stimulus */
.sw-banner-wrap{position:absolute;top:20px;left:0;right:0;display:flex;justify-content:center;padding:0 16px;z-index:20;pointer-events:none}
.sw-banner{position:relative;transform:translateY(-16px) scale(.92);opacity:0;
width:max-content;max-width:min(92vw,660px);box-sizing:border-box;padding:16px 28px;border-radius:24px;
background:#ffffff;color:#18113c;font-size:clamp(17px,2.4vw,23px);line-height:1.35;font-weight:800;text-align:center;
border:3.5px solid #ffcc00;box-shadow:0 6px 0 #c2b5e8,0 14px 32px rgba(12,8,48,.45);
transition:opacity .2s ease-out,transform .25s cubic-bezier(.16,1,.3,1)}
.sw-banner.on{opacity:1;transform:translateY(0) scale(1)}
.sw-banner-sub{display:block;font-size:clamp(14px,1.9vw,17px);font-weight:600;color:#5a4f82;margin-top:4px}

/* Big inviting "I'm Ready! ▶" button */
.sw-start-wrap{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;z-index:25;pointer-events:none;transition:opacity .25s ease-out}
.sw-start-wrap.off{opacity:0;pointer-events:none;display:none}
.sw-ready-card{background:rgba(255,255,255,0.96);border-radius:28px;padding:24px 36px;text-align:center;box-shadow:0 12px 36px rgba(10,6,40,0.5);border:4px solid #ffcc00;margin-bottom:28px;max-width:min(90vw,520px);pointer-events:auto}
.sw-ready-title{font-size:clamp(26px,4vw,36px);font-weight:900;color:#18113c;margin-bottom:8px}
.sw-ready-text{font-size:clamp(16px,2.2vw,20px);color:#4a3f78;font-weight:700;line-height:1.35}
.sw-start-btn{display:inline-flex;align-items:center;justify-content:center;gap:12px;
margin-top:20px;
min-height:64px;padding:16px 48px;border-radius:36px;
background:linear-gradient(180deg,#ffd043 0%,#f59e0b 60%,#d97706 100%);
color:#ffffff;font-size:clamp(20px,2.8vw,28px);font-weight:900;border:4px solid #ffffff;
box-shadow:0 8px 0 #b45309,0 16px 32px rgba(12,8,48,.5);cursor:pointer;pointer-events:auto;
transition:transform .15s ease-out,box-shadow .15s ease-out}
.sw-start-btn:hover{transform:translateY(-2px) scale(1.02);box-shadow:0 10px 0 #b45309,0 20px 38px rgba(12,8,48,.6)}
.sw-start-btn:active{transform:translateY(4px);box-shadow:0 4px 0 #b45309,0 8px 18px rgba(12,8,48,.4)}

/* Practice hand */
.sw-hand{position:absolute;left:50%;top:58%;width:96px;height:118px;margin-left:-30px;opacity:0;transition:opacity .2s ease-out;z-index:15}
.sw-hand.on{opacity:1}
.sw-hand.on svg{animation:sw-press .9s cubic-bezier(.16,1,.3,1) infinite}
.sw-hand .sw-ripple{position:absolute;left:30px;top:2px;width:56px;height:56px;margin:-28px 0 0 -28px;border-radius:50%;border:5px solid #ffffff;opacity:0}
.sw-hand.on .sw-ripple{animation:sw-rip .9s ease-out infinite}
@keyframes sw-press{0%{transform:translate(14px,26px)}45%{transform:translate(0,0) scale(.94)}60%{transform:translate(0,0) scale(.94)}100%{transform:translate(14px,26px)}}
@keyframes sw-rip{0%,40%{transform:scale(.3);opacity:0}50%{opacity:.9}100%{transform:scale(1.5);opacity:0}}

/* Rain & Screen Water Droplets Overlay - Always active during the storm */
.sw-rain{position:absolute;inset:0;pointer-events:none;overflow:hidden;display:block;z-index:18}
.sw-rain-streaks{position:absolute;inset:0;pointer-events:none}
.sw-rain-drop{position:absolute;background:linear-gradient(to bottom,rgba(255,255,255,0) 0%,rgba(210,240,255,.75) 35%,rgba(255,255,255,.95) 100%);width:2.5px;border-radius:2px;animation:sw-fall linear infinite;filter:drop-shadow(0 0 3px rgba(160,220,255,.85))}
@keyframes sw-fall{0%{transform:translateY(-60px) translateX(0)}100%{transform:translateY(115vh) translateX(65px)}}

/* Realistic water droplets / condensation beads on the screen glass */
.sw-water-drops{position:absolute;inset:0;pointer-events:none;overflow:hidden}
.sw-droplet{position:absolute;border-radius:50%;
background:radial-gradient(circle at 35% 28%,rgba(255,255,255,0.98) 0%,rgba(255,255,255,0.45) 24%,rgba(140,200,255,0.18) 55%,rgba(50,110,210,0.6) 88%,rgba(15,40,110,0.75) 100%);
box-shadow:inset -2px -2px 3px rgba(0,0,0,0.5), inset 2px 2px 3px rgba(255,255,255,0.95), 0 3px 6px rgba(5,2,25,0.45);
border:1px solid rgba(255,255,255,0.55);
backdrop-filter:blur(0.5px);
}
.sw-droplet::after{content:'';position:absolute;top:18%;left:22%;width:32%;height:32%;background:#ffffff;border-radius:50%;opacity:0.95}
.sw-droplet.drip{animation:sw-drip 7.5s cubic-bezier(.4, 0, .2, 1) infinite}
@keyframes sw-drip{
  0%{transform:translateY(0) scale(1,1);opacity:0.92}
  35%{transform:translateY(0) scale(1,1.25);opacity:0.95}
  45%{transform:translateY(24px) scale(0.9,1.4);opacity:0.95}
  65%{transform:translateY(80px) scale(0.9,1.2);opacity:0.9}
  84%{transform:translateY(150px) scale(0.85,1.05);opacity:0.8}
  95%{transform:translateY(220px) scale(0.7,0.9);opacity:0.35}
  100%{transform:translateY(240px) scale(0.5,0.7);opacity:0}
}

/* Distracting Multi-Strobe Lightning Flash & SVG Bolt */
.sw-flash{position:absolute;inset:0;background:radial-gradient(ellipse at 50% 30%,rgba(255,255,255,0.95),rgba(195,240,255,0.85));opacity:0;pointer-events:none;z-index:26}
.sw-flash.strobe{animation:sw-lightning-strobe 0.48s ease-out forwards}
@keyframes sw-lightning-strobe{
  0%{opacity:0}
  4%{opacity:0.95}
  16%{opacity:0.25}
  22%{opacity:1.0}
  32%{opacity:0.8}
  55%{opacity:0.35}
  100%{opacity:0}
}
.sw-lightning-bolt{position:absolute;top:0;width:320px;height:75%;pointer-events:none;opacity:0;z-index:27;filter:drop-shadow(0 0 10px #38bdf8) drop-shadow(0 0 24px #ffffff)}
.sw-lightning-bolt.on{animation:sw-bolt-strobe 0.48s ease-out forwards}
@keyframes sw-bolt-strobe{
  0%{opacity:0;transform:scale(0.98)}
  4%{opacity:1;transform:scale(1)}
  16%{opacity:0.3;transform:scale(1)}
  22%{opacity:1;transform:scale(1.02)}
  32%{opacity:0.85;transform:scale(1)}
  55%{opacity:0.25;transform:scale(1)}
  100%{opacity:0;transform:scale(1)}
}

/* Dual Jars HUD: bottom-left near Luma & the jars */
.sw-jars-hud{position:absolute;left:24px;bottom:24px;display:flex;align-items:center;gap:12px;z-index:20;pointer-events:none}
.sw-jar-pill{display:flex;align-items:center;gap:8px;padding:8px 18px;border-radius:24px;
background:rgba(24,17,60,0.92);color:#ffffff;box-shadow:0 6px 18px rgba(0,0,0,0.45);
font-size:clamp(13px,1.7vw,16px);font-weight:800;letter-spacing:0.3px;
transition:transform 0.18s cubic-bezier(0.175,0.885,0.32,1.275)}
.sw-pill-firefly{border:3px solid #ffcc00}
.sw-pill-owl{border:3px solid #f97316}
.sw-jar-pill.pulse{transform:scale(1.2)}
.sw-jar-icon{font-size:20px;line-height:1}
.sw-firefly-num{color:#ffd043;font-size:clamp(17px,2.2vw,22px);font-weight:900}
.sw-owl-num{color:#fb923c;font-size:clamp(17px,2.2vw,22px);font-weight:900}

/* Celebration end screen */
.sw-celebrate{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;
background:radial-gradient(ellipse at 50% 40%,rgba(35,26,79,.95),rgba(15,10,45,.98));opacity:0;pointer-events:none;transition:opacity .4s ease-out;z-index:30}
.sw-celebrate.on{opacity:1;pointer-events:auto}
.sw-stars{font-size:56px;margin-bottom:14px;animation:sw-bounce 1.2s ease-in-out infinite alternate}
@keyframes sw-bounce{from{transform:scale(.95)}to{transform:scale(1.15)}}
.sw-msg{color:#ffffff;font-size:clamp(22px,3.8vw,34px);font-weight:900;text-align:center;padding:0 24px;max-width:560px;line-height:1.35;margin-bottom:24px}

@media (prefers-reduced-motion: reduce){
  .sw-hand.on svg{animation:none}
  .sw-rain-drop{animation:none;display:none}
  .sw-stars{animation:none}
}
`;

const HAND_SVG = `<svg viewBox="0 0 96 118" width="96" height="118" aria-hidden="true">
<g fill="#ffffff" stroke="#18113c" stroke-width="5" stroke-linejoin="round" stroke-linecap="round">
<path d="M20 50 V14 a10 10 0 0 1 20 0 V46"/>
<path d="M40 44 a9 9 0 0 1 18 0 v6 a9 9 0 0 1 18 0 v6 a8 8 0 0 1 16 2 v22 c0 20 -14 34 -34 34 h-8 c-14 0 -22 -6 -30 -16 L6 82 c-5 -7 -2 -14 4 -16 c5 -2 10 0 14 5 l-4 -21 z"/>
</g></svg>`;

export interface StormWatchUi {
  root: HTMLDivElement;
  say: (text: string | null, subtext?: string) => void;
  showIntro: (on: boolean, onStart?: () => void) => void;
  showHand: (on: boolean, x?: number, y?: number) => void;
  flashLightning: () => void;
  setRain: (enabled: boolean) => void;
  setJarCounts: (fireflies: number, owls: number) => void;
  setJarCount: (count: number) => void;
  showCelebration: (on: boolean, msg?: string) => void;
  destroy: () => void;
}

export function buildUi(parent: HTMLElement): StormWatchUi {
  const style = document.createElement("style");
  style.textContent = CSS;
  document.head.appendChild(style);

  const root = document.createElement("div");
  root.className = "sw-root";

  const ui = document.createElement("div");
  ui.className = "sw-ui";

  // Flash layer
  const flash = document.createElement("div");
  flash.className = "sw-flash";
  ui.appendChild(flash);

  // SVG Lightning Bolt branching across sky
  const bolt = document.createElement("div");
  bolt.className = "sw-lightning-bolt";
  bolt.innerHTML = `<svg viewBox="0 0 320 600" width="100%" height="100%" preserveAspectRatio="none">
    <path d="M 180 0 L 160 120 L 205 135 L 135 270 L 175 285 L 90 420 L 125 435 L 50 590" fill="none" stroke="#67e8f9" stroke-width="14" stroke-linecap="round" stroke-linejoin="round" />
    <path d="M 180 0 L 160 120 L 205 135 L 135 270 L 175 285 L 90 420 L 125 435 L 50 590" fill="none" stroke="#ffffff" stroke-width="5" stroke-linecap="round" stroke-linejoin="round" />
    <path d="M 160 120 L 225 190 L 210 205 L 255 270" fill="none" stroke="#ffffff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" />
    <path d="M 135 270 L 75 335 L 90 350 L 45 405" fill="none" stroke="#ffffff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" />
  </svg>`;
  ui.appendChild(bolt);

  // Rain layer (always visible during the game)
  const rain = document.createElement("div");
  rain.className = "sw-rain";
  rain.style.display = "block";

  // Rain streaks
  const rainStreaks = document.createElement("div");
  rainStreaks.className = "sw-rain-streaks";
  for (let i = 0; i < 95; i++) {
    const drop = document.createElement("div");
    drop.className = "sw-rain-drop";
    drop.style.left = `${Math.random() * 110 - 5}%`;
    drop.style.top = `${-40 - Math.random() * 50}px`;
    drop.style.height = `${22 + Math.random() * 28}px`;
    drop.style.animationDuration = `${0.5 + Math.random() * 0.35}s`;
    drop.style.animationDelay = `${Math.random() * 1.5}s`;
    rainStreaks.appendChild(drop);
  }
  rain.appendChild(rainStreaks);

  // Water droplets / beads on the screen glass
  const waterDrops = document.createElement("div");
  waterDrops.className = "sw-water-drops";
  for (let i = 0; i < 54; i++) {
    const droplet = document.createElement("div");
    const isDrip = i % 4 === 0;
    droplet.className = isDrip ? "sw-droplet drip" : "sw-droplet";
    const size = isDrip ? (13 + Math.random() * 9) : (7 + Math.random() * 12);
    droplet.style.width = `${size}px`;
    droplet.style.height = `${isDrip ? size * (1.18 + Math.random() * 0.28) : size}px`;
    droplet.style.left = `${2 + Math.random() * 95}%`;
    droplet.style.top = `${3 + Math.random() * 92}%`;
    if (isDrip) {
      droplet.style.animationDelay = `${Math.random() * 5.5}s`;
      droplet.style.animationDuration = `${6.0 + Math.random() * 3.5}s`;
    }
    waterDrops.appendChild(droplet);
  }
  rain.appendChild(waterDrops);

  ui.appendChild(rain);

  // Fixed top message banner
  const bannerWrap = document.createElement("div");
  bannerWrap.className = "sw-banner-wrap";
  const banner = document.createElement("div");
  banner.className = "sw-banner";
  const textNode = document.createElement("span");
  const subNode = document.createElement("span");
  subNode.className = "sw-banner-sub";
  banner.appendChild(textNode);
  banner.appendChild(subNode);
  bannerWrap.appendChild(banner);
  ui.appendChild(bannerWrap);

  // Big Intro & "I'm Ready!" Card
  const startWrap = document.createElement("div");
  startWrap.className = "sw-start-wrap";

  const readyCard = document.createElement("div");
  readyCard.className = "sw-ready-card";

  const readyTitle = document.createElement("div");
  readyTitle.className = "sw-ready-title";
  readyTitle.textContent = "Ready to play? 🌟";

  const readyText = document.createElement("div");
  readyText.className = "sw-ready-text";
  readyText.textContent = "Help Luma catch glowing fireflies in the trees!";

  const startBtn = document.createElement("button");
  startBtn.type = "button";
  startBtn.className = "sw-start-btn";
  startBtn.textContent = "I'm Ready! ▶";

  readyCard.appendChild(readyTitle);
  readyCard.appendChild(readyText);
  readyCard.appendChild(startBtn);
  startWrap.appendChild(readyCard);
  ui.appendChild(startWrap);

  // Hand guide
  const hand = document.createElement("div");
  hand.className = "sw-hand";
  hand.innerHTML = `${HAND_SVG}<div class="sw-ripple"></div>`;
  ui.appendChild(hand);

  // Dual Jars HUD: bottom-left near Luma & the jars
  const jarsHud = document.createElement("div");
  jarsHud.className = "sw-jars-hud";

  // Firefly Pill
  const pillFirefly = document.createElement("div");
  pillFirefly.className = "sw-jar-pill sw-pill-firefly";
  pillFirefly.innerHTML = `<span class="sw-jar-icon">🫙 ⚡</span><span>Fireflies:</span> <span class="sw-firefly-num">0</span>`;
  const fireflyNum = pillFirefly.querySelector(".sw-firefly-num") as HTMLSpanElement;

  // Owl Pill
  const pillOwl = document.createElement("div");
  pillOwl.className = "sw-jar-pill sw-pill-owl";
  pillOwl.innerHTML = `<span class="sw-jar-icon">🦉 ✨</span><span>Owls:</span> <span class="sw-owl-num">0</span>`;
  const owlNum = pillOwl.querySelector(".sw-owl-num") as HTMLSpanElement;

  jarsHud.appendChild(pillFirefly);
  jarsHud.appendChild(pillOwl);
  ui.appendChild(jarsHud);

  // Celebration screen
  const celeb = document.createElement("div");
  celeb.className = "sw-celebrate";
  const stars = document.createElement("div");
  stars.className = "sw-stars";
  stars.textContent = "⭐ ✨ ⭐";
  const celebMsg = document.createElement("div");
  celebMsg.className = "sw-msg";
  celeb.appendChild(stars);
  celeb.appendChild(celebMsg);
  ui.appendChild(celeb);

  root.appendChild(ui);
  parent.appendChild(root);

  let onStartCb: (() => void) | undefined;
  const triggerStart = (e: Event) => {
    e.preventDefault();
    e.stopPropagation();
    onStartCb?.();
  };
  startBtn.addEventListener("pointerdown", triggerStart);
  startBtn.addEventListener("click", triggerStart);

  return {
    root,
    say(text, subtext) {
      if (!text) {
        banner.classList.remove("on");
      } else {
        textNode.textContent = text;
        if (subtext) {
          subNode.textContent = subtext;
          subNode.style.display = "block";
        } else {
          subNode.style.display = "none";
        }
        banner.classList.add("on");
      }
    },
    showIntro(on, onStart) {
      if (onStart) onStartCb = onStart;
      if (on) {
        startWrap.classList.remove("off");
        startWrap.style.display = "flex";
      } else {
        startWrap.classList.add("off");
        startWrap.style.display = "none";
      }
    },
    showHand(on, x, y) {
      if (on) {
        if (x !== undefined && y !== undefined) {
          hand.style.left = `${x}px`;
          hand.style.top = `${y}px`;
        }
        hand.classList.add("on");
      } else {
        hand.classList.remove("on");
      }
    },
    flashLightning() {
      // Reposition bolt randomly across the sky
      bolt.style.left = `${15 + Math.random() * 55}%`;
      bolt.style.transform = Math.random() < 0.5 ? "scaleX(1)" : "scaleX(-1)";

      flash.classList.remove("strobe");
      bolt.classList.remove("on");
      // Force DOM reflow to re-trigger keyframe animation cleanly
      void flash.offsetWidth;
      void bolt.offsetWidth;

      flash.classList.add("strobe");
      bolt.classList.add("on");

      setTimeout(() => {
        flash.classList.remove("strobe");
        bolt.classList.remove("on");
      }, 500);
    },
    setRain(enabled) {
      rain.style.display = enabled ? "block" : "none";
    },
    setJarCounts(fireflies, owls) {
      if (fireflyNum && fireflyNum.textContent !== String(fireflies)) {
        fireflyNum.textContent = String(fireflies);
        pillFirefly.classList.add("pulse");
        setTimeout(() => pillFirefly.classList.remove("pulse"), 200);
      }
      if (owlNum && owlNum.textContent !== String(owls)) {
        owlNum.textContent = String(owls);
        pillOwl.classList.add("pulse");
        setTimeout(() => pillOwl.classList.remove("pulse"), 200);
      }
    },
    setJarCount(count) {
      if (fireflyNum) {
        fireflyNum.textContent = String(count);
        pillFirefly.classList.add("pulse");
        setTimeout(() => pillFirefly.classList.remove("pulse"), 200);
      }
    },
    showCelebration(on, msg) {
      if (on) {
        if (msg) celebMsg.textContent = msg;
        celeb.classList.add("on");
      } else {
        celeb.classList.remove("on");
      }
    },
    destroy() {
      style.remove();
      root.remove();
    },
  };
}
