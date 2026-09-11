import { initializeApp } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-app.js";
import { getDatabase, ref, set, get, onValue, update, push } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-database.js";

const firebaseConfig = { apiKey:"AIzaSyBF4A5AGcR0eb5ZsuEiUG-Gg9Vfr119yg", authDomain:"kelime-oyunu-57a0b.firebaseapp.com", databaseURL:"https://kelime-oyunu-57a0b-default-rtdb.firebaseio.com", projectId:"kelime-oyunu-57a0b", storageBucket:"kelime-oyunu-57a0b.firebasestorage.app", messagingSenderId:"580383166978", appId:"1:580383166978:web:f0d428220ab83e33bb4d1b", measurementId:"G-PKEB0K17PX" };
const db = getDatabase(initializeApp(firebaseConfig));

let roomId=null, playerNumber=null, currentRound=1, timerInterval=null, secondsLeft=30, gameFinished=false;
const $=id=>document.getElementById(id);
const menu=$("menu"), waiting=$("waiting"), game=$("game"), result=$("result");
const nameInput=$("nameInput"), roomInput=$("roomInput"), roomCodeDisplay=$("roomCodeDisplay"), waitingText=$("waitingText");
const wordInput=$("wordInput"), status=$("status"), roundNumber=$("roundNumber"), word1=$("word1"), word2=$("word2");
const player1Name=$("player1Name"), player2Name=$("player2Name"), score1=$("score1"), score2=$("score2");
const timerEl=$("timer"), words=$("words"), resultTitle=$("resultTitle"), resultText=$("resultText"), finalScores=$("finalScores");
const emojiFeed=$("emojiFeed"), historyList=$("historyList");

function generateRoomCode(){ const chars="ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; return Array.from({length:6},()=>chars[Math.floor(Math.random()*chars.length)]).join(""); }
function cleanWord(w){ return w.trim().toLocaleLowerCase("tr-TR"); }
function roomLink(){ return `${location.origin}${location.pathname}?room=${roomId}`; }
function playerPath(){ return playerNumber===1?"player1":"player2"; }
function playTone(type="click") { try { const C=window.AudioContext||window.webkitAudioContext; if(!C)return; const c=new C(),o=c.createOscillator(),g=c.createGain(); o.frequency.value=type==="success"?720:type==="error"?180:420; g.gain.value=.045; o.connect(g);g.connect(c.destination);o.start();o.stop(c.currentTime+.12); } catch(e){} }
function setStatus(text){ status.textContent=text; }
function stopTimer(){ if(timerInterval){clearInterval(timerInterval);timerInterval=null;} }
function startTimer(){ stopTimer(); secondsLeft=30; timerEl.textContent=secondsLeft; timerEl.classList.remove("timer-warning"); timerInterval=setInterval(async()=>{ secondsLeft--; timerEl.textContent=secondsLeft; if(secondsLeft<=5) timerEl.classList.add("timer-warning"); if(secondsLeft<=0){ stopTimer(); timerEl.classList.remove("timer-warning"); if(!hasSubmittedCurrentRound()) await submitCurrentWord("pas"); } },1000); }
function hasSubmittedCurrentRound(){ return Boolean(window.currentRoom?.[playerPath()]?.words?.[currentRound]); }

$("createRoom").addEventListener("click",async()=>{
 const name=nameInput.value.trim()||"Oyuncu 1"; roomId=generateRoomCode(); playerNumber=1;
 await set(ref(db,`rooms/${roomId}`),{player1:{joined:true,name,score:0,words:{}},player2:{joined:false,name:"Oyuncu 2",score:0,words:{}},round:1,usedWords:{},emojis:{},finished:false});
 menu.classList.add("hidden"); waiting.classList.remove("hidden"); roomCodeDisplay.textContent=roomId; listenToRoom();
});

async function joinRoom(code){ const snap=await get(ref(db,`rooms/${code}`)); if(!snap.exists()){alert("Bu oda bulunamadı.");return;} const r=snap.val(); if(r.player2?.joined){alert("Bu oda dolu.");return;}
 roomId=code;playerNumber=2; const name=nameInput.value.trim()||"Oyuncu 2"; await update(ref(db,`rooms/${code}`),{"player2/joined":true,"player2/name":name}); menu.classList.add("hidden");game.classList.remove("hidden");listenToRoom(); }
$("joinRoom").addEventListener("click",()=>{const c=roomInput.value.trim().toUpperCase(); if(!c){alert("Oda kodunu gir.");return;} joinRoom(c);});

$("copyRoom").addEventListener("click",async()=>{ try{await navigator.clipboard.writeText(roomLink());setStatus("🔗 Oda linki kopyalandı!");playTone();}catch(e){alert(roomLink());} });
$("whatsappShare").addEventListener("click",()=>{window.open(`https://wa.me/?text=${encodeURIComponent(`Kelime oyununa katıl! Oda: ${roomId}\n${roomLink()}`)}`,"_blank");});

// SADECE BU FONKSİYON KELİME HAKKI KULLANIR.
async function submitCurrentWord(word){
 if(!roomId||!playerNumber)return; const normalized=cleanWord(word); if(!normalized)return;
 const snap=await get(ref(db,`rooms/${roomId}`)); if(!snap.exists())return; const r=snap.val(); const used=r.usedWords||{};
 if(used[normalized] !== undefined && used[normalized] !== currentRound){ setStatus("🚫 Bu kelime daha önce kullanıldı!"); playTone("error"); return; }
 const player=playerPath();
 await set(ref(db,`rooms/${roomId}/${player}/words/${currentRound}`),word.trim());
 await update(ref(db,`rooms/${roomId}/usedWords`),{[normalized]:currentRound});
 wordInput.value=""; setStatus("✅ Kelimen kaydedildi. Diğer oyuncu bekleniyor."); playTone("success"); stopTimer(); checkNextRound();
}
$("submitWord").addEventListener("click",()=>submitCurrentWord(wordInput.value));
wordInput.addEventListener("keydown",e=>{if(e.key==="Enter")submitCurrentWord(wordInput.value);});

// EMOJİLER SERBESTTİR: kelime hakkı tüketmez, kelime kaydı oluşturmaz.
document.querySelectorAll(".emoji").forEach(b=>b.addEventListener("click",async()=>{
 if(!roomId||!playerNumber)return;
 const player=playerPath();
 const snap=await get(ref(db,`rooms/${roomId}/${player}`));
 const name=snap.exists()?snap.val().name:(playerNumber===1?"Oyuncu 1":"Oyuncu 2");
 await push(ref(db,`rooms/${roomId}/emojis`),{emoji:b.dataset.emoji,name,timestamp:Date.now()});
 playTone();
}));

function calculateScores(r){ let s1=0,s2=0; for(let i=1;i<=5;i++){const a=r.player1.words?.[i],b=r.player2.words?.[i];if(a&&b){if(cleanWord(a)===cleanWord(b)){s1+=10;s2+=10;}else{const la=cleanWord(a).length,lb=cleanWord(b).length;const p=Math.max(1,10-Math.abs(la-lb));s1+=p;s2+=p;}}} return [s1,s2]; }
async function checkNextRound(){ const snap=await get(ref(db,`rooms/${roomId}`));if(!snap.exists())return;const r=snap.val();const a=r.player1.words?.[currentRound],b=r.player2.words?.[currentRound];if(a&&b&&currentRound<5&&r.round===currentRound)await update(ref(db,`rooms/${roomId}`),{round:currentRound+1}); }

function renderHistory(r){
 const rows=[];
 for(let i=1;i<currentRound;i++){
  const a=r.player1?.words?.[i],b=r.player2?.words?.[i];
  if(a||b) rows.push(`<div class="history-round"><strong>Tur ${i}</strong><span>👤 ${escapeHtml(r.player1?.name||"Oyuncu 1")}: ${escapeHtml(a||"—")}</span><span>👤 ${escapeHtml(r.player2?.name||"Oyuncu 2")}: ${escapeHtml(b||"—")}</span></div>`);
 }
 historyList.innerHTML=rows.length?rows.join(""):"<p class='empty-history'>Henüz önceki tur yok.</p>";
}
function escapeHtml(value){const d=document.createElement("div");d.textContent=value;return d.innerHTML;}

let seenEmojiIds=new Set();
function showEmoji(item){
 const el=document.createElement("div");el.className="floating-emoji";el.innerHTML=`<span>${escapeHtml(item.emoji)}</span><small>${escapeHtml(item.name)}</small>`;
 emojiFeed.appendChild(el); setTimeout(()=>el.remove(),3500);
}

function listenToRoom(){ onValue(ref(db,`rooms/${roomId}`),snap=>{const r=snap.val();if(!r)return; window.currentRoom=r; const p1=r.player1||{},p2=r.player2||{};
 player1Name.textContent=`${p1.name||"Oyuncu 1"} 🧑`;player2Name.textContent=`${p2.name||"Oyuncu 2"} 🧑`; const scores=calculateScores(r); score1.textContent=scores[0];score2.textContent=scores[1];
 if(p1.joined&&p2.joined){waiting.classList.add("hidden");game.classList.remove("hidden");waitingText.textContent="Oyun başladı!";}
 currentRound=r.round||1;roundNumber.textContent=currentRound; renderHistory(r);
 const a=p1.words?.[currentRound]||"",b=p2.words?.[currentRound]||"";
 if(a&&b){words.classList.remove("hidden");word1.textContent=a;word2.textContent=b;if(cleanWord(a)===cleanWord(b)){setStatus("🎯 Aynı kelime! +10 puan");playTone("success");}else setStatus("🔄 Kelimeler farklı. Puan verildi.");if(currentRound>=5)finishGame(r);}
 else if(p1.joined&&p2.joined&&!hasSubmittedCurrentRound()&&!gameFinished){setStatus("Sıra sende. Kelimeni yaz!");startTimer();}
 });
 onValue(ref(db,`rooms/${roomId}/emojis`),snap=>{snap.forEach(child=>{if(!seenEmojiIds.has(child.key)){seenEmojiIds.add(child.key);showEmoji(child.val());}});});
}

function finishGame(r){ if(gameFinished)return;gameFinished=true;stopTimer();game.classList.add("hidden");result.classList.remove("hidden");const [s1,s2]=calculateScores(r);resultTitle.textContent="🎉 Oyun Bitti!";resultText.textContent="5 tur tamamlandı.";finalScores.textContent=`${r.player1.name}: ${s1} puan  •  ${r.player2.name}: ${s2} puan`;playTone("success"); }
$("newGame").addEventListener("click",()=>location.reload());

const params=new URLSearchParams(location.search);const invited=params.get("room");if(invited){roomInput.value=invited.toUpperCase();setStatus("Arkadaşının odasına katılmak için adını yazıp Oyuna Katıl'a bas.");}
