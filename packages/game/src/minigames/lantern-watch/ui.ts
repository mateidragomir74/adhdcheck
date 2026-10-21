// DOM layer over the 3D canvas: speech bubble, play button, practice hand. Adapted from ../bridge-wait/ui.ts
// (same look). Pointer events pass through (pointer-events: none); the game root takes every pointerdown.
const CSS = `
.lw-root{position:relative;width:100%;height:100%;overflow:hidden;touch-action:none;user-select:none;-webkit-user-select:none;-webkit-touch-callout:none;-webkit-tap-highlight-color:transparent;
background:linear-gradient(180deg,#0e1442 0%,#232a73 20%,#5a4aa6 34%,#c4719f 44%,#f4a77f 52%,#f4a77f 100%)}
.lw-root>canvas{position:absolute;inset:0;width:100%;height:100%;display:block}
.lw-ui{position:absolute;inset:0;pointer-events:none;font-family:ui-rounded,"SF Pro Rounded","Arial Rounded MT Bold","Nunito","Varela Round",system-ui,sans-serif}
.lw-anchor{position:absolute;left:0;top:0;will-change:transform}
.lw-bubble{position:relative;transform:translate(-50%,-100%) scale(.6);transform-origin:50% 100%;opacity:0;
width:max-content;max-width:min(84vw,520px);box-sizing:border-box;padding:16px 24px;border-radius:26px;
background:#fffdf7;color:#2a1f5c;font-size:clamp(19px,2.9vw,28px);line-height:1.28;font-weight:800;text-align:center;
box-shadow:0 5px 0 #d9cff5,0 14px 30px rgba(12,8,48,.38);transition:opacity .16s ease-out,transform .3s cubic-bezier(.16,1,.3,1)}
.lw-bubble.on{opacity:1;transform:translate(-50%,-100%) scale(1)}
.lw-tail{position:absolute;bottom:-15px;width:0;height:0;border-left:13px solid transparent;border-right:13px solid transparent;border-top:17px solid #fffdf7;transform:translateX(-50%)}
.lw-play{position:absolute;left:50%;top:72%;width:128px;height:128px;margin:-64px 0 0 -64px;border-radius:50%;
background:radial-gradient(circle at 35% 30%,#7ff0e1,#2fbfae 60%,#1f9e95);box-shadow:0 7px 0 #167a73,0 16px 30px rgba(12,8,48,.4),inset 0 -6px 0 rgba(0,0,0,.08);
border:6px solid #fffdf7;transition:transform .25s cubic-bezier(.16,1,.3,1),opacity .2s ease-out}
.lw-play::after{content:"";position:absolute;left:50%;top:50%;margin:-26px 0 0 -16px;border-left:44px solid #fffdf7;border-top:26px solid transparent;border-bottom:26px solid transparent;filter:drop-shadow(0 3px 0 rgba(22,122,115,.6))}
.lw-play::before{content:"";position:absolute;inset:-18px;border-radius:50%;border:5px solid rgba(255,253,247,.55);animation:lw-ring 1.8s ease-out infinite}
.lw-play.off{opacity:0;transform:scale(.4)}
@media (orientation: portrait){.lw-play{top:86%}}
@keyframes lw-ring{0%{transform:scale(.85);opacity:.9}100%{transform:scale(1.3);opacity:0}}
.lw-hand{position:absolute;left:0;top:0;width:96px;height:118px;opacity:0;transition:opacity .2s ease-out;will-change:transform}
.lw-hand.on{opacity:1}
.lw-hand.on.press svg{animation:lw-press .9s cubic-bezier(.16,1,.3,1) infinite}
.lw-hand.on.hold svg{transform:translate(22px,46px);opacity:.75}
.lw-hand .lw-ripple{position:absolute;left:30px;top:2px;width:56px;height:56px;margin:-28px 0 0 -28px;border-radius:50%;border:5px solid #fffdf7;opacity:0}
.lw-hand.on.press .lw-ripple{animation:lw-rip .9s ease-out infinite}
@keyframes lw-press{0%{transform:translate(14px,26px)}45%{transform:translate(0,0) scale(.94)}60%{transform:translate(0,0) scale(.94)}100%{transform:translate(14px,26px)}}
@keyframes lw-rip{0%,40%{transform:scale(.3);opacity:0}50%{opacity:.9}100%{transform:scale(1.5);opacity:0}}
@media (prefers-reduced-motion: reduce){.lw-play::before{animation:none}.lw-hand.on.press svg{animation:none}.lw-hand.on.press .lw-ripple{animation:none;opacity:.8}}
`;

// Original cartoon glove hand pointing up; the fingertip is at (30px, 2px) of the box. Same drawing as Bridge Wait.
const HAND_SVG = `<svg viewBox="0 0 96 118" width="96" height="118" aria-hidden="true">
<g fill="#fffdf7" stroke="#2a1f5c" stroke-width="5" stroke-linejoin="round" stroke-linecap="round">
<path d="M20 50 V14 a10 10 0 0 1 20 0 V46"/>
<path d="M40 44 a9 9 0 0 1 18 0 v6 a9 9 0 0 1 18 0 v6 a8 8 0 0 1 16 2 v22 c0 20 -14 34 -34 34 h-8 c-14 0 -22 -6 -30 -16 L6 82 c-5 -7 -2 -14 4 -16 c5 -2 10 0 14 5 l-4 -21 z"/>
</g></svg>`;

export type HandMode = "off" | "press" | "hold";

export interface Ui {
  root: HTMLDivElement;
  say: (text: string | null) => void;
  /** Place the bubble above a screen point (CSS pixels). */
  place: (x: number, y: number) => void;
  play: (on: boolean) => void;
  /** press: taps the point; hold: rests just below it without tapping (a moth). */
  hand: (mode: HandMode, x?: number, y?: number) => void;
  destroy: () => void;
}

export function buildUi(parent: HTMLElement): Ui {
  const style = document.createElement("style");
  style.textContent = CSS;
  const root = document.createElement("div");
  root.className = "lw-root";
  const layer = document.createElement("div");
  layer.className = "lw-ui";
  const anchor = document.createElement("div");
  anchor.className = "lw-anchor";
  const bubble = document.createElement("div");
  bubble.className = "lw-bubble";
  const text = document.createElement("span");
  const tail = document.createElement("div");
  tail.className = "lw-tail";
  bubble.append(text, tail);
  anchor.append(bubble);
  const play = document.createElement("div");
  play.className = "lw-play";
  const hand = document.createElement("div");
  hand.className = "lw-hand";
  hand.innerHTML = `<div class="lw-ripple"></div>${HAND_SVG}`;
  layer.append(anchor, play, hand);
  root.append(layer);
  parent.append(style, root);

  let w = 0;
  return {
    root,
    say(t) {
      if (t === null) {
        bubble.classList.remove("on");
        return;
      }
      text.textContent = t;
      bubble.classList.add("on");
      w = 0;
    },
    place(x, y) {
      if (!w) w = bubble.offsetWidth;
      const vw = root.clientWidth;
      const half = w / 2;
      const cx = Math.min(Math.max(x, half + 12), vw - half - 12);
      anchor.style.transform = `translate(${cx.toFixed(1)}px, ${Math.max(y, 0).toFixed(1)}px)`;
      const tailX = Math.min(Math.max(x - cx + half, 30), w - 30);
      tail.style.left = `${tailX.toFixed(1)}px`;
    },
    play(on) {
      play.classList.toggle("off", !on);
    },
    hand(mode, x = 0, y = 0) {
      hand.classList.toggle("on", mode !== "off");
      hand.classList.toggle("press", mode === "press");
      hand.classList.toggle("hold", mode === "hold");
      // The fingertip (30, 2) lands on the point.
      if (mode !== "off") hand.style.transform = `translate(${(x - 30).toFixed(1)}px, ${(y - 2).toFixed(1)}px)`;
    },
    destroy() {
      root.remove();
      style.remove();
    },
  };
}
