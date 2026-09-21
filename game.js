(() => {
  const NAMES = ["JIJ", "WEST", "NOORD", "OOST"];
  const SUIT_SYM = ["♣", "♦", "♠", "♥"];
  const RANK_SYM = ["2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K", "A"];
  const PASS_DIR = [1, 3, 2, 0];
  const PASS_TXT = ["3 kaarten naar links", "3 kaarten naar rechts", "3 kaarten over", "Geen passen"];
  const SLOT = ["slot-s", "slot-w", "slot-n", "slot-e"];
  const LIMIT = 100;
  const $ = (id) => document.getElementById(id);
  const state = { scores:[0,0,0,0], round:0, hands:[[],[],[],[]], selected:[], mode:"idle", trick:[], lead:0, turn:0, heartsBroken:false, firstTrick:true, busy:false };
  function card(suit, rank) { return { id: suit * 13 + rank, suit, rank }; }
  function isRed(c) { return c.suit === 1 || c.suit === 3; }
  function isQS(c) { return c.suit === 2 && c.rank === 10; }
  function isHeart(c) { return c.suit === 3; }
  function points(c) { return isHeart(c) ? 1 : isQS(c) ? 13 : 0; }
  function label(c) { return RANK_SYM[c.rank] + SUIT_SYM[c.suit]; }
  function sortHand(list) { list.sort((a, b) => a.suit - b.suit || a.rank - b.rank); return list; }
  function deck() {
    const d = [];
    for (let s = 0; s < 4; s++) for (let r = 0; r < 13; r++) d.push(card(s, r));
    for (let i = d.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [d[i], d[j]] = [d[j], d[i]]; }
    return d;
  }
  function deal() {
    const d = deck();
    state.hands = [[], [], [], []];
    d.forEach((c, i) => state.hands[i % 4].push(c));
    state.hands.forEach(sortHand);
    state.selected = []; state.trick = []; state.heartsBroken = false; state.firstTrick = true;
    if (PASS_DIR[state.round % 4] === 0) startPlay();
    else {
      state.mode = "pass";
      setStatus(PASS_TXT[state.round % 4] + ". Tik 3 kaarten, daarna GEEF DOOR.");
      $("btn-act").textContent = "GEEF DOOR";
      $("btn-act").disabled = true;
    }
    render();
  }
  function startPlay() {
    const twoClubs = card(0, 0).id;
    state.lead = state.hands.findIndex((h) => h.some((c) => c.id === twoClubs));
    state.turn = state.lead; state.mode = "play";
    $("btn-act").textContent = "SLEEP"; $("btn-act").disabled = true;
    setStatus(state.lead === 0 ? "Sleep 2♣ naar het midden." : NAMES[state.lead] + " opent met 2♣.");
    render();
    if (state.turn !== 0) queueAI();
  }
  function legal(hand) {
    const trick = state.trick;
    const leadSuit = trick.length ? trick[0].card.suit : null;
    const follow = leadSuit === null ? hand : hand.filter((c) => c.suit === leadSuit);
    let pool = follow.length ? follow : hand.slice();
    if (state.firstTrick) {
      if (trick.length === 0) return hand.filter((c) => c.id === 0);
      const safe = pool.filter((c) => points(c) === 0);
      if (safe.length) pool = safe;
    }
    if (trick.length === 0 && !state.heartsBroken) {
      const nonH = pool.filter((c) => !isHeart(c));
      if (nonH.length) pool = nonH;
    }
    return pool;
  }
  function danger(c) { return points(c) * 10 + c.rank + (isQS(c) ? 40 : 0); }
  function pickPass(hand) { return hand.slice().sort((a, b) => danger(b) - danger(a)).slice(0, 3); }
  function currentWinner() {
    const leadSuit = state.trick[0].card.suit;
    let best = state.trick[0];
    for (const play of state.trick) if (play.card.suit === leadSuit && play.card.rank > best.card.rank) best = play;
    return best;
  }
  function pickPlay(hand) {
    const opts = legal(hand);
    if (!opts.length) return hand[0];
    if (state.trick.length === 0) {
      const safe = opts.filter((c) => points(c) === 0).sort((a, b) => a.rank - b.rank);
      return safe[0] || opts.slice().sort((a, b) => danger(a) - danger(b))[0];
    }
    const leadSuit = state.trick[0].card.suit;
    const following = opts.filter((c) => c.suit === leadSuit);
    const high = Math.max(...state.trick.filter((p) => p.card.suit === leadSuit).map((p) => p.card.rank));
    if (following.length) {
      const under = following.filter((c) => c.rank < high).sort((a, b) => b.rank - a.rank);
      if (under.length) return under[0];
      return following.slice().sort((a, b) => a.rank - b.rank)[0];
    }
    return opts.slice().sort((a, b) => danger(b) - danger(a))[0];
  }
  function doPass() {
    const dir = PASS_DIR[state.round % 4];
    const given = [null, null, null, null];
    given[0] = state.selected.slice();
    for (let p = 1; p < 4; p++) given[p] = pickPass(state.hands[p]);
    const recv = [[], [], [], []];
    for (let p = 0; p < 4; p++) {
      recv[(p + dir) % 4] = given[p];
      state.hands[p] = state.hands[p].filter((c) => !given[p].some((g) => g.id === c.id));
    }
    for (let p = 0; p < 4; p++) state.hands[p].push(...recv[p]);
    state.hands.forEach(sortHand); state.selected = []; startPlay();
  }
  function playCard(player, c) {
    state.hands[player] = state.hands[player].filter((x) => x.id !== c.id);
    state.trick.push({ player, card: c });
    if (isHeart(c)) state.heartsBroken = true;
    render();
    if (state.trick.length === 4) { state.busy = true; setTimeout(endTrick, 850); }
    else {
      state.turn = (player + 1) % 4;
      if (state.turn !== 0) queueAI();
      else { state.busy = false; setStatus("Sleep een geldige kaart naar het midden."); render(); }
    }
  }
  function endTrick() {
    const win = currentWinner();
    const pts = state.trick.reduce((n, p) => n + points(p.card), 0);
    if (!state._taken) state._taken = [[], [], [], []];
    state._taken[win.player].push(...state.trick.map((p) => p.card));
    state.trick = []; state.firstTrick = false; state.lead = win.player; state.turn = win.player; state.busy = false;
    if (state.hands[0].length === 0 && state.hands[1].length === 0) { finishRound(); return; }
    setStatus(NAMES[win.player] + " wint de slag" + (pts ? " (+" + pts + ")" : "") + ".");
    render();
    if (state.turn !== 0) queueAI();
  }
  function finishRound() {
    const taken = state._taken || [[], [], [], []];
    const got = taken.map((list) => list.reduce((n, c) => n + points(c), 0));
    const moon = got.findIndex((n) => n === 26);
    let msg;
    if (moon >= 0) { for (let p = 0; p < 4; p++) if (p !== moon) state.scores[p] += 26; msg = NAMES[moon] + " schiet de maan! Anderen +26."; }
    else { for (let p = 0; p < 4; p++) state.scores[p] += got[p]; msg = "Ronde: JIJ " + got[0] + " · W " + got[1] + " · N " + got[2] + " · O " + got[3]; }
    state._taken = [[], [], [], []]; state.round += 1;
    const over = state.scores.some((s) => s >= LIMIT);
    showOverlay(over, msg, got, moon);
    state.mode = over ? "over" : "idle";
    $("btn-act").textContent = over ? "OPNIEUW" : "VOLGENDE";
    $("btn-act").disabled = false;
    render();
  }
  function queueAI() {
    state.busy = true; $("btn-act").disabled = true;
    setTimeout(() => { const p = state.turn; const c = pickPlay(state.hands[p]); setStatus(NAMES[p] + " speelt " + label(c) + "."); playCard(p, c); }, 420);
  }
  function setStatus(t) { $("status").textContent = t; }
  function cardEl(c, extra) {
    const d = document.createElement("div");
    d.className = "pcard" + (isRed(c) ? " red" : "") + (extra ? " " + extra : "");
    d.innerHTML = "<div>" + RANK_SYM[c.rank] + "</div><div class='big'>" + SUIT_SYM[c.suit] + "</div><div style='text-align:right'>" + RANK_SYM[c.rank] + "</div>";
    return d;
  }
  function overTrick(x, y) {
    const box = $("trick").getBoundingClientRect();
    return x >= box.left && x <= box.right && y >= box.top && y <= box.bottom;
  }
  function bindDrag(el, c, canPlay) {
    let sx=0,sy=0,ox=0,oy=0,dragging=false,moved=false;
    const down = (ev) => {
      const p = ev.touches ? ev.touches[0] : ev;
      sx=p.clientX; sy=p.clientY;
      const r = el.getBoundingClientRect();
      ox=p.clientX-r.left; oy=p.clientY-r.top;
      dragging=true; moved=false;
    };
    const move = (ev) => {
      if (!dragging) return;
      const p = ev.touches ? ev.touches[0] : ev;
      if (!moved && Math.hypot(p.clientX-sx,p.clientY-sy)<8) return;
      if (!canPlay) return;
      moved=true; ev.preventDefault();
      el.classList.add("drag");
      el.style.left=(p.clientX-ox)+"px"; el.style.top=(p.clientY-oy)+"px";
      $("trick").classList.toggle("hot", overTrick(p.clientX,p.clientY));
    };
    const up = (ev) => {
      if (!dragging) return;
      dragging=false;
      const p = (ev.changedTouches && ev.changedTouches[0]) || ev;
      $("trick").classList.remove("hot");
      if (moved && canPlay && overTrick(p.clientX,p.clientY)) { playCard(0,c); return; }
      el.classList.remove("drag"); render();
    };
    el.addEventListener("pointerdown", down);
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    el.addEventListener("touchstart", down, {passive:true});
    window.addEventListener("touchmove", move, {passive:false});
    window.addEventListener("touchend", up);
  }
  function render() {
    $("scores").innerHTML = NAMES.map((n,i)=>"<div class='score"+(i===0?" you":"")+"'><b>"+n+"</b><span>"+state.scores[i]+"</span></div>").join("");
    $("n-count").textContent=state.hands[2].length; $("w-count").textContent=state.hands[1].length; $("e-count").textContent=state.hands[3].length;
    ["slot-s","slot-w","slot-n","slot-e"].forEach((id)=>{ $(id).innerHTML=""; });
    state.trick.forEach((p)=>$(SLOT[p.player]).appendChild(cardEl(p.card)));
    const hand=$("hand"); hand.innerHTML="";
    const cards=state.hands[0];
    const legalSet=new Set((state.mode==="play"&&state.turn===0&&!state.busy?legal(cards):cards).map((c)=>c.id));
    const w=hand.clientWidth|| (window.innerWidth-12);
    for (let suit=0; suit<4; suit++) {
      const row=document.createElement("div"); row.className="row";
      const tag=document.createElement("div"); tag.className="row-tag"; tag.textContent=SUIT_SYM[suit]; row.appendChild(tag);
      const group=cards.filter((c)=>c.suit===suit);
      const n=group.length, cw=46, leftPad=18;
      const span=n>1?Math.min(cw,(w-leftPad-cw)/(n-1)):0;
      group.forEach((c,i)=>{
        const el=cardEl(c,"hcard");
        el.style.left=(leftPad+i*span)+"px"; el.style.zIndex=String(i+1);
        if (state.selected.some((s)=>s.id===c.id)) el.classList.add("on");
        const canPlay=state.mode==="play"&&state.turn===0&&!state.busy&&legalSet.has(c.id);
        if (state.mode==="play"&&state.turn===0&&!legalSet.has(c.id)) el.classList.add("off");
        if (state.mode==="pass") {
          el.addEventListener("click", ()=>{
            const idx=state.selected.findIndex((s)=>s.id===c.id);
            if (idx>=0) state.selected.splice(idx,1);
            else if (state.selected.length<3) state.selected.push(c);
            render();
          });
        } else bindDrag(el,c,canPlay);
        row.appendChild(el);
      });
      hand.appendChild(row);
    }
    if (state.mode==="pass") $("btn-act").disabled=state.selected.length!==3;
    if (state.mode==="play") $("btn-act").disabled=true;
  }
  function act() {
    if (state.mode==="pass"&&state.selected.length===3) doPass();
    else if (state.mode==="idle") { $("overlay").classList.remove("show"); deal(); }
    else if (state.mode==="over") { $("overlay").classList.remove("show"); newGame(); }
  }
  function showOverlay(over,msg,got,moon) {
    const winner=state.scores.indexOf(Math.min(...state.scores));
    $("panel").innerHTML="<h1>"+(over?"EINDE SPEL":"RONDE KLAAR")+"</h1><p>"+msg+"</p><div class='rows'>"+
      NAMES.map((n,i)=>"<div><span>"+n+(moon===i?" ☽":"")+"</span><span>"+(got?got[i]+" → ":"")+state.scores[i]+"</span></div>").join("")+
      "</div><p>"+(over?NAMES[winner]+" wint met de laagste score.":"Tot "+LIMIT+" punten.")+"</p>";
    $("overlay").classList.add("show");
  }
  function newGame() { state.scores=[0,0,0,0]; state.round=0; state._taken=[[],[],[],[]]; $("overlay").classList.remove("show"); deal(); }
  $("btn-new").addEventListener("click", newGame);
  $("btn-act").addEventListener("click", act);
  $("overlay").addEventListener("click", ()=>{ if (state.mode==="idle"||state.mode==="over") act(); else $("overlay").classList.remove("show"); });
  window.addEventListener("resize", render);
  $("panel").innerHTML="<h1>HARTENJAGEN</h1><p>Sleep een geldige kaart naar het midden om te spelen. Jouw kaarten staan in 4 rijen per kleur.</p>";
  $("overlay").classList.add("show");
  $("btn-act").textContent="START"; $("btn-act").disabled=false; state.mode="idle"; render();
})();
