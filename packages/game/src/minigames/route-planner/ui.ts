// DOM layer over the 3D canvas: speech bubble, start button, practice hand. Same look as Bridge Wait and Treasure
// Choice. Pointer events pass through (pointer-events: none); the game container itself takes every pointerdown.
// Nothing here ever shows a number, a move count or a timer.
const CSS = `
.rp-root{position:relative;width:100%;height:100%;overflow:hidden;touch-action:none;user-select:none;-webkit-user-select:none;-webkit-touch-callout:none;-webkit-tap-highlight-color:transparent;
background:linear-gradient(180deg,#0e1442 0%,#232a73 20%,#5a4aa6 34%,#c4719f 44%,#f4a77f 52%,#f4a77f 100%)}
.rp-root>canvas{position:absolute;inset:0;width:100%;height:100%;display:block}
.rp-ui{position:absolute;inset:0;pointer-events:none;font-family:ui-rounded,"SF Pro Rounded","Arial Rounded MT Bold","Nunito","Varela Round",system-ui,sans-serif}
.rp-anchor{position:absolute;left:0;top:0;will-change:transform}
.rp-vignette{position:absolute;inset:0;background:radial-gradient(120% 95% at 50% 58%,rgba(14,20,66,0) 55%,rgba(14,20,66,.42) 100%)}
.rp-bubble{position:relative;transform:translate(-50%,-100%) scale(.6);transform-origin:50% 100%;opacity:0;
width:max-content;max-width:min(84vw,520px);box-sizing:border-box;padding:14px 22px;border-radius:26px;
background:#fffdf7;color:#2a1f5c;font-size:clamp(18px,2.8vw,27px);line-height:1.28;font-weight:800;text-align:center;
box-shadow:0 5px 0 #d9cff5,0 14px 30px rgba(12,8,48,.38);transition:opacity .16s ease-out,transform .3s cubic-bezier(.16,1,.3,1)}
.rp-bubble.on{opacity:1;transform:translate(-50%,-100%) scale(1)}
.rp-tail{position:absolute;bottom:-15px;width:0;height:0;border-left:13px solid transparent;border-right:13px solid transparent;border-top:17px solid #fffdf7;transform:translateX(-50%)}
.rp-play{position:absolute;left:50%;top:70%;width:128px;height:128px;margin:-64px 0 0 -64px;border-radius:50%;
background:radial-gradient(circle at 35% 30%,#7ff0e1,#2fbfae 60%,#1f9e95);box-shadow:0 7px 0 #167a73,0 16px 30px rgba(12,8,48,.4),inset 0 -6px 0 rgba(0,0,0,.08);
border:6px solid #fffdf7;transition:transform .25s cubic-bezier(.16,1,.3,1),opacity .2s ease-out}
.rp-play::after{content:"";position:absolute;left:50%;top:50%;margin:-26px 0 0 -16px;border-left:44px solid #fffdf7;border-top:26px solid transparent;border-bottom:26px solid transparent;filter:drop-shadow(0 3px 0 rgba(22,122,115,.6))}
.rp-play::before{content:"";position:absolute;inset:-18px;border-radius:50%;border:5px solid rgba(255,253,247,.55);animation:rp-ring 1.8s ease-out infinite}
.rp-play.off{opacity:0;transform:scale(.4)}
@media (orientation: portrait){.rp-play{top:84%}}
@keyframes rp-ring{0%{transform:scale(.85);opacity:.9}100%{transform:scale(1.3);opacity:0}}
.rp-hand{position:absolute;left:0;top:0;width:96px;height:118px;opacity:0;transition:opacity .2s ease-out;will-change:transform}
.rp-hand.on{opacity:1}
.rp-hand.on svg{animation:rp-press .9s cubic-bezier(.16,1,.3,1) infinite}
.rp-hand .rp-ripple{position:absolute;left:30px;top:2px;width:56px;height:56px;margin:-28px 0 0 -28px;border-radius:50%;border:5px solid #fffdf7;opacity:0}
.rp-hand.on .rp-ripple{animation:rp-rip .9s ease-out infinite}
@keyframes rp-press{0%{transform:translate(14px,26px)}45%{transform:translate(0,0) scale(.94)}60%{transform:translate(0,0) scale(.94)}100%{transform:translate(14px,26px)}}
@keyframes rp-rip{0%,40%{transform:scale(.3);opacity:0}50%{opacity:.9}100%{transform:scale(1.5);opacity:0}}
@media (prefers-reduced-motion: reduce){.rp-play::before{animation:none}.rp-hand.on svg{animation:none}.rp-hand.on .rp-ripple{animation:none;opacity:.8}}
`;

// The Bridge Wait glove hand pointing up; the fingertip is the top-left of the box (left 30px, top 2px).
const HAND_SVG = `<svg viewBox="0 0 96 118" width="96" height="118" aria-hidden="true">
<g fill="#fffdf7" stroke="#2a1f5c" stroke-width="5" stroke-linejoin="round" stroke-linecap="round">
<path d="M20 50 V14 a10 10 0 0 1 20 0 V46"/>
<path d="M40 44 a9 9 0 0 1 18 0 v6 a9 9 0 0 1 18 0 v6 a8 8 0 0 1 16 2 v22 c0 20 -14 34 -34 34 h-8 c-14 0 -22 -6 -30 -16 L6 82 c-5 -7 -2 -14 4 -16 c5 -2 10 0 14 5 l-4 -21 z"/>
</g></svg>`;

export interface Ui {
  root: HTMLDivElement;
  say: (text: string | null) => void;
  /**
   * Place the bubble. Its tail points at (x, y), Luma's head; when `ceiling` is given (CSS px from the top), the
   * bubble's bottom is kept above it, so it never covers the board.
   */
  place: (x: number, y: number, ceiling?: number) => void;
  play: (on: boolean) => void;
  /** Show the practice hand with its fingertip at a screen point, or hide it (null). */
  handAt: (p: { x: number; y: number } | null) => void;
  destroy: () => void;
}

export function buildUi(parent: HTMLElement): Ui {
  const style = document.createElement("style");
  style.textContent = CSS;
  const root = document.createElement("div");
  root.className = "rp-root";
  const layer = document.createElement("div");
  layer.className = "rp-ui";
  const anchor = document.createElement("div");
  anchor.className = "rp-anchor";
  const bubble = document.createElement("div");
  bubble.className = "rp-bubble";
  const text = document.createElement("span");
  const tail = document.createElement("div");
  tail.className = "rp-tail";
  bubble.append(text, tail);
  anchor.append(bubble);
  const play = document.createElement("div");
  play.className = "rp-play";
  const hand = document.createElement("div");
  hand.className = "rp-hand";
  hand.innerHTML = `<div class="rp-ripple"></div>${HAND_SVG}`;
  const vignette = document.createElement("div");
  vignette.className = "rp-vignette";
  layer.append(vignette, anchor, play, hand);
  root.append(layer);
  parent.append(style, root);

  let w = 0;
  let h = 0;
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
    place(x, y, ceiling) {
      if (!w) {
        w = bubble.offsetWidth;
        h = bubble.offsetHeight;
      }
      // The anchor is the bottom centre of the bubble (tail tip 15 px lower).
      let by = y;
      if (ceiling !== undefined) by = Math.min(by, ceiling - 18);
      by = Math.max(by, h + 12);
      const vw = root.clientWidth;
      const half = w / 2;
      const cx = Math.min(Math.max(x, half + 12), vw - half - 12);
      anchor.style.transform = `translate(${cx.toFixed(1)}px, ${by.toFixed(1)}px)`;
      const tailX = Math.min(Math.max(x - cx + half, 30), w - 30);
      tail.style.left = `${tailX.toFixed(1)}px`;
    },
    play(on) {
      play.classList.toggle("off", !on);
    },
    handAt(p) {
      if (!p) {
        hand.classList.remove("on");
        return;
      }
      hand.style.transform = `translate(${(p.x - 30).toFixed(1)}px, ${(p.y - 2).toFixed(1)}px)`;
      hand.classList.add("on");
    },
    destroy() {
      root.remove();
      style.remove();
    },
  };
}
