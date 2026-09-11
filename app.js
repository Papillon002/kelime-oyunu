import { initializeApp } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-app.js";
import { getDatabase, ref, set, get, onValue, update, push } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-database.js";

const firebaseConfig={apiKey:"AIzaSyBF4A5AGcY0eb5ZsuEiUG-GG9vfr119yg",authDomain:"kelime-oyunu-57a0b.firebaseapp.com",databaseURL:"https://kelime-oyunu-57a0b-default-rtdb.firebaseio.com",projectId:"kelime-oyunu-57a0b",storageBucket:"kelime-oyunu-57a0b.firebasestorage.app",messagingSenderId:"580383166978",appId:"1:580383166978:web:f0d428220ab83e33bb4d1b",measurementId:"G-PKEB0K17PX"};
const db=getDatabase(initializeApp(firebaseConfig));
let roomId=null,playerNumber=null,currentRound=1,timerInterval=null,gameFinished=false,lastRoundRendered=0;
const $=id=>document.getElementById(id);
const menu=$("menu"),waiting=$("waiting"),game=$("game"),result=$("result"),nameInput=$("nameInput"),roomInput=$("roomInput"),roomCodeDisplay=$("roomCodeDisplay"),waitingText=$("waitingText"),wordInput=$("wordInput"),status=$("status"),roundNumber=$("roundNumber"),roundTotal=$("roundTotal"),timerEl=$("timer"),playerCountLabel=$("playerCountLabel"),playersTable=$("playersTable"),currentWords=$("currentWords"),currentWordsBody=$("currentWordsBody"),historyList=$("historyList"),emojiFeed=$("emojiFeed"),resultTitle=$("resultTitle"),resultText=$("resultText"),finalResult=$("finalResult"),resultBadge=$("resultBadge"),playerCountSelect=$("playerCount");

function generateRoomCode(){const c="ABCDEFGHJKLMNPQRSTUVWXYZ23456789";return Array.from({length:6},()=>c[Math.floor(Math.random()*c.length)]).join("");}

// Turkish/case-insensitive comparison: silgi = sılgi = Silgı = SİLGİ.
function normalizeWord(w){return String(w||"").trim().toLocaleLowerCase("tr-TR").replace(/[ıİiI]/g,"i").replace(/[ğĞ]/g,"g").replace(/[şŞ]/g,"s").replace(/[üÜ]/g,"u").replace(/[öÖ]/g,"o").replace(/[çÇ]/g,"c").normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-z0-9]/g,"");}
function escapeHtml(v){const d=document.createElement("div");d.textContent=String(v??"");return d.innerHTML;}
function playerPath(n=playerNumber){return `player${n}`;}
function roomLink(){return `${location.origin}${location.pathname}?room=${roomId}`;}
function playTone(kind="click"){try{const C=window.AudioContext||window.webkitAudioContext;if(!C)return;const c=new C(),o=c.createOscillator(),g=c.createGain();o.frequency.value=kind==="success"?760:kind==="error"?180:420;g.gain.value=.045;o.connect(g);g.connect(c.destination);o.start();o.stop(c.currentTime+.12);}catch(e){}}
function stopTimer(){if(timerInterval){clearInterval(timerInterval);timerInterval=null;}}
function getPlayers(r){return Array.from({length:Number(r.maxPlayers||2)},(_,i)=>({number:i+1,...(r[`player${i+1}`]||{})}));}
function getJoinedPlayers(r){return getPlayers(r).filter(p=>p.joined);}
function mySubmitted(r){return Boolean(r?.[playerPath()]?.words?.[currentRound]);}
function allSubmitted(r){const players=getJoinedPlayers(r),total=Number(r.maxPlayers||2);return players.length===total&&players.every(p=>p.words?.[currentRound]);}
function roundSeconds(r){return Number(r.roundDuration||60);}

function startTimer(r){stopTimer();if(gameFinished||mySubmitted(r)||r.finished)return;const started=Number(r.roundStartedAt||Date.now()),total=roundSeconds(r);const tick=()=>{const left=Math.max(0,total-Math.floor((Date.now()-started)/1000));timerEl.textContent=left;if(left<=10)timerEl.classList.add("timer-warning");else timerEl.classList.remove("timer-warning");if(left<=0){stopTimer();advanceAfterTimeout();}};tick();timerInterval=setInterval(tick,1000);}
async function advanceAfterTimeout(){const snap=await get(ref(db,`rooms/${roomId}`));if(!snap.exists())return;const r=snap.val();if(r.finished||Number(r.round)!==currentRound)return;if(allSubmitted(r))return;if(currentRound<Number(r.totalRounds||5)){await update(ref(db,`rooms/${roomId}`),{round:currentRound+1,roundStartedAt:Date.now()});}else{await update(ref(db,`rooms/${roomId}`),{finished:true,winnerRound:0});}}

$("createRoom").addEventListener("click",async()=>{try{const name=nameInput.value.trim()||"Oyuncu 1";const maxPlayers=Number(playerCountSelect.value);const settings={2:{rounds:5,seconds:60},3:{rounds:8,seconds:90},4:{rounds:12,seconds:120},5:{rounds:15,seconds:120}}[maxPlayers];roomId=generateRoomCode();playerNumber=1;const players={};for(let i=1;i<=5;i++)players[`player${i}`]={joined:i===1,name:i===1?name:`Oyuncu ${i}`,words:{}};await set(ref(db,`rooms/${roomId}`),{...players,maxPlayers,totalRounds:settings.rounds,roundDuration:settings.seconds,round:1,roundStartedAt:Date.now(),emojis:{},finished:false,winnerRound:0});menu.classList.add("hidden");waiting.classList.remove("hidden");roomCodeDisplay.textContent=roomId;listenToRoom();}catch(e){alert("Oda oluşturulamadı: "+e.message);}});

async function joinRoom(code){try{const roomRef=ref(db,`rooms/${code}`),snap=await get(roomRef);if(!snap.exists()){alert("Bu oda bulunamadı.");return;}const r=snap.val(),maxPlayers=Number(r.maxPlayers||2),free=Array.from({length:maxPlayers},(_,i)=>i+1).find(i=>!r[`player${i}`]?.joined);if(!free){alert("Bu oda dolu.");return;}roomId=code;playerNumber=free;const name=nameInput.value.trim()||`Oyuncu ${free}`;await update(roomRef,{[`player${free}/joined`]:true,[`player${free}/name`]:name});menu.classList.add("hidden");listenToRoom();}catch(e){alert("Odaya katılınamadı: "+e.message);}}
$("joinRoom").addEventListener("click",()=>{const c=roomInput.value.trim().toUpperCase();if(c)joinRoom(c);else alert("Oda kodunu gir.");});
$("copyRoom").addEventListener("click",async()=>{try{await navigator.clipboard.writeText(roomLink());alert("🔗 Davet linki kopyalandı!");}catch(e){prompt("Davet linkini kopyala:",roomLink());}});
$("whatsappShare").addEventListener("click",()=>window.open(`https://wa.me/?text=${encodeURIComponent(`⚡ Kelime Düellosu'na katıl!\nOda: ${roomId}\n${roomLink()}`)}`,"_blank"));

// A word may never be reused in a different step by any player.
// Repeating a word within the SAME step is allowed only because it can be the winning match.
async function submitCurrentWord(rawWord){
  if(gameFinished||!roomId||!playerNumber)return;
  const word=String(rawWord||"").trim(),normalized=normalizeWord(word);
  if(!normalized){alert("Geçerli bir kelime yaz.");return;}
  const roomRef=ref(db,`rooms/${roomId}`),snap=await get(roomRef);if(!snap.exists())return;
  const r=snap.val();if(r.finished||Number(r.round)!==currentRound)return;
  if(mySubmitted(r)){setStatus("Bu adımda kelimeni zaten gönderdin.");return;}

  // Reject words already used in any PREVIOUS step. This is a rule violation,
  // not a win: the player must choose another word.
  const totalPlayers=Number(r.maxPlayers||2);
  for(let p=1;p<=totalPlayers;p++){
    const words=r[`player${p}`]?.words||{};
    for(let i=1;i<currentRound;i++){
      if(words[i] && normalizeWord(words[i])===normalized){
        setStatus("⛔ Bu kelime daha önce kullanıldı. Başka bir kelime seç.");
        wordInput.focus();
        return;
      }
    }
  }

  await set(ref(db,`rooms/${roomId}/${playerPath()}/words/${currentRound}`),word);
  wordInput.value="";playTone("success");setStatus("✅ Kelimen gönderildi. Diğer oyuncular bekleniyor.");
  await checkRound();
}
$("submitWord").addEventListener("click",()=>submitCurrentWord(wordInput.value));
wordInput.addEventListener("keydown",e=>{if(e.key==="Enter"){e.preventDefault();submitCurrentWord(wordInput.value);}});

document.querySelectorAll(".emoji").forEach(btn=>btn.addEventListener("click",async()=>{if(!roomId||gameFinished)return;const me=window.currentRoom?.[playerPath()]||{};await push(ref(db,`rooms/${roomId}/emojis`),{emoji:btn.dataset.emoji,name:me.name||"Oyuncu",timestamp:Date.now()});playTone();}));

async function checkRound(){
  const snap=await get(ref(db,`rooms/${roomId}`));if(!snap.exists())return;const r=snap.val();
  if(r.finished||Number(r.round)!==currentRound||!allSubmitted(r))return;

  // Success requires EVERY player to have the SAME normalized word in THIS step.
  const players=getJoinedPlayers(r),words=players.map(p=>p.words?.[currentRound]).filter(Boolean),normalizedWords=words.map(normalizeWord);
  if(normalizedWords.length===players.length&&normalizedWords.length>0&&normalizedWords.every(n=>n===normalizedWords[0])){
    await update(ref(db,`rooms/${roomId}`),{finished:true,winnerRound:currentRound,matchedWord:words[0]});
    return;
  }

  // No full match: move to the next step. Words from this step remain permanently used.
  if(currentRound<Number(r.totalRounds||5))await update(ref(db,`rooms/${roomId}`),{round:currentRound+1,roundStartedAt:Date.now()});
  else await update(ref(db,`rooms/${roomId}`),{finished:true,winnerRound:0});
}

function renderPlayers(r){const players=getPlayers(r);playersTable.innerHTML=players.map(p=>p.joined?`<tr><td>${escapeHtml(p.name||`Oyuncu ${p.number}`)}</td><td>${p.words?.[currentRound]?"✅ HAZIR":"🤔 Düşünüyor..."}</td><td>${p.words?.[currentRound]?"🔒 Gönderildi":"—"}</td></tr>`:`<tr class="not-joined"><td>${escapeHtml(p.name||`Oyuncu ${p.number}`)}</td><td>⏳ Bekleniyor</td><td>—</td></tr>`).join("");playerCountLabel.textContent=`${getJoinedPlayers(r).length}/${r.maxPlayers}`;}
function renderCurrentWords(r){const players=getJoinedPlayers(r),visible=allSubmitted(r);currentWordsBody.innerHTML=players.map(p=>`<tr><th>${escapeHtml(p.name||"Oyuncu")}</th><td>${visible?escapeHtml(p.words?.[currentRound]||"—"):"🔒 Gizli"}</td></tr>`).join("");currentWords.classList.toggle("hidden",!players.some(p=>p.words?.[currentRound]));}
function renderHistory(r){let html="";const players=getJoinedPlayers(r);for(let i=1;i<currentRound;i++){const vals=players.map(p=>`<span>👤 ${escapeHtml(p.name||"Oyuncu")}: <b>${escapeHtml(p.words?.[i]||"—")}</b></span>`);if(players.some(p=>p.words?.[i]))html+=`<div class="history-round"><strong>Adım ${i}</strong>${vals.join("")}</div>`;}historyList.innerHTML=html||"<p class='empty-history'>Henüz tamamlanan bir adım yok.</p>";}
function updateStatus(r){const me=r[playerPath()]||{},submitted=getJoinedPlayers(r).filter(p=>p.words?.[currentRound]).length;if(submitted===Number(r.maxPlayers||2))setStatus("🔎 Herkes gönderdi. Sonuç kontrol ediliyor...");else if(me.words?.[currentRound])setStatus(`⏳ ${submitted}/${r.maxPlayers} oyuncu hazır.`);else setStatus(`🟢 ${submitted}/${r.maxPlayers} oyuncu hazır — kelimeni gönder.`);}
function setStatus(t){status.textContent=t;}
function showEmoji(item){const el=document.createElement("div");el.className="floating-emoji";el.innerHTML=`<span>${escapeHtml(item.emoji)}</span><small>${escapeHtml(item.name)}</small>`;emojiFeed.appendChild(el);setTimeout(()=>el.remove(),3500);}
function updateWaitingText(r){const joined=getJoinedPlayers(r).length,total=Number(r.maxPlayers||2);waitingText.textContent=`${joined}/${total} oyuncu hazır. Oyun tüm oyuncular katılınca başlayacak.`;}

function finishGame(r){
  if(gameFinished)return;gameFinished=true;stopTimer();game.classList.add("hidden");waiting.classList.add("hidden");result.classList.remove("hidden");
  const total=Number(r.totalRounds||5),players=getJoinedPlayers(r);
  if(r.winnerRound){
    const winningRound=Number(r.winnerRound),sameWord=r.matchedWord||players[0]?.words?.[winningRound]||"—";
    resultBadge.textContent="🎉";resultTitle.textContent="BAŞARILI! HERKES AYNI KELİMEYİ BULDU!";resultText.textContent=`Adım ${winningRound}: Tüm oyuncular aynı kelimeyi yazdı.`;
    finalResult.innerHTML=`<div class="winner-word"><b>Kelime:</b> ${escapeHtml(sameWord)}</div>`+players.map(p=>`<div><b>${escapeHtml(p.name||`Oyuncu ${p.number}`)}</b>: ${escapeHtml(p.words?.[winningRound]||sameWord)}</div>`).join("");playTone("success");
  }else{resultBadge.textContent="😔";resultTitle.textContent="KELİME BULUNAMADI";resultText.textContent=`${total} adım tamamlandı, tüm oyuncuların aynı kelimeyi yazdığı bir adım olmadı.`;finalResult.innerHTML=players.map(p=>`<div>${escapeHtml(p.name||"Oyuncu")}: oyun tamamlandı</div>`).join("");playTone("error");}
}

function listenToRoom(){
  onValue(ref(db,`rooms/${roomId}`),snap=>{
    const r=snap.val();if(!r)return;window.currentRoom=r;
    const joined=getJoinedPlayers(r),total=Number(r.maxPlayers||2);updateWaitingText(r);
    if(joined.length===total){waiting.classList.add("hidden");game.classList.remove("hidden");}else{waiting.classList.remove("hidden");game.classList.add("hidden");}
    currentRound=Number(r.round||1);roundNumber.textContent=currentRound;roundTotal.textContent=Number(r.totalRounds||5);
    renderPlayers(r);renderCurrentWords(r);renderHistory(r);updateStatus(r);
    if(r.finished){finishGame(r);return;}
    if(joined.length===total){if(currentRound!==lastRoundRendered){lastRoundRendered=currentRound;startTimer(r);}else if(!mySubmitted(r))startTimer(r);else stopTimer();}
    const emojis=r.emojis||{};Object.entries(emojis).forEach(([id,item])=>{if(!window._seenEmojiIds)window._seenEmojiIds=new Set();if(!window._seenEmojiIds.has(id)){window._seenEmojiIds.add(id);showEmoji(item);}});
  });
}

$("newGame").addEventListener("click",()=>location.href=location.pathname);

const params=new URLSearchParams(location.search),roomParam=params.get("room");
if(roomParam){roomInput.value=roomParam.toUpperCase();}
