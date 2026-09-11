import { initializeApp } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-app.js";
import { getDatabase, ref, set, get, onValue, update, push } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-database.js";

const firebaseConfig={apiKey:"AIzaSyBF4A5AGYcR0eb5ZsuEiUG-Gg9Vfr119yg",authDomain:"kelime-oyunu-57a0b.firebaseapp.com",databaseURL:"https://kelime-oyunu-57a0b-default-rtdb.firebaseio.com",projectId:"kelime-oyunu-57a0b",storageBucket:"kelime-oyunu-57a0b.firebasestorage.app",messagingSenderId:"580383166978",appId:"1:580383166978:web:f0d428220ab83e33bb4d1b",measurementId:"G-PKEB0K17PX"};
const db=getDatabase(initializeApp(firebaseConfig));
let roomId=null,playerNumber=null,currentRound=1,timerInterval=null,gameFinished=false,seenEmojiIds=new Set(),lastRoundRendered=0;
const $=id=>document.getElementById(id);
const menu=$("menu"),waiting=$("waiting"),game=$("game"),result=$("result"),nameInput=$("nameInput"),roomInput=$("roomInput"),roomCodeDisplay=$("roomCodeDisplay"),waitingText=$("waitingText"),wordInput=$("wordInput"),status=$("status"),roundNumber=$("roundNumber"),score1=$("score1"),score2=$("score2"),timerEl=$("timer"),currentWords=$("currentWords"),word1=$("word1"),word2=$("word2"),currentName1=$("currentName1"),currentName2=$("currentName2"),tableName1=$("tableName1"),tableName2=$("tableName2"),tableStatus1=$("tableStatus1"),tableStatus2=$("tableStatus2"),tableWord1=$("tableWord1"),tableWord2=$("tableWord2"),historyList=$("historyList"),emojiFeed=$("emojiFeed"),resultTitle=$("resultTitle"),resultText=$("resultText"),finalScores=$("finalScores"),resultBadge=$("resultBadge"),turnTitle=$("turnTitle");

function generateRoomCode(){const c="ABCDEFGHJKLMNPQRSTUVWXYZ23456789";return Array.from({length:6},()=>c[Math.floor(Math.random()*c.length)]).join("");}
// Büyük/küçük harf, Türkçe noktalı/noktasız harf ve aksan farklarını yok sayar.
function normalizeWord(w){return String(w||"").trim().toLocaleLowerCase("tr-TR").replace(/[ıİiI]/g,"i").replace(/[ğĞ]/g,"g").replace(/[şŞ]/g,"s").replace(/[üÜ]/g,"u").replace(/[öÖ]/g,"o").replace(/[çÇ]/g,"c").normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-z0-9]/g,"");}
function escapeHtml(v){const d=document.createElement("div");d.textContent=String(v??"");return d.innerHTML;}
function playerPath(){return playerNumber===1?"player1":"player2";}
function otherPath(){return playerNumber===1?"player2":"player1";}
function roomLink(){return `${location.origin}${location.pathname}?room=${roomId}`;}
function playTone(kind="click"){try{const C=window.AudioContext||window.webkitAudioContext;if(!C)return;const c=new C(),o=c.createOscillator(),g=c.createGain();o.frequency.value=kind==="success"?760:kind==="error"?180:420;g.gain.value=.045;o.connect(g);g.connect(c.destination);o.start();o.stop(c.currentTime+.12);}catch(e){}}
function stopTimer(){if(timerInterval){clearInterval(timerInterval);timerInterval=null;}}
function mySubmitted(r){return Boolean(r?.[playerPath()]?.words?.[currentRound]);}

function startTimer(r){stopTimer();if(gameFinished||mySubmitted(r)||r.finished)return;const started=Number(r.roundStartedAt||Date.now());const tick=()=>{const left=Math.max(0,60-Math.floor((Date.now()-started)/1000));timerEl.textContent=left;if(left<=10)timerEl.classList.add("timer-warning");else timerEl.classList.remove("timer-warning");if(left<=0){stopTimer();advanceAfterTimeout();}};tick();timerInterval=setInterval(tick,1000);}
async function advanceAfterTimeout(){const snap=await get(ref(db,`rooms/${roomId}`));if(!snap.exists())return;const r=snap.val();if(r.finished||r.round!==currentRound)return;const a=r.player1?.words?.[currentRound],b=r.player2?.words?.[currentRound];if(a&&b)return;if(currentRound<5){await update(ref(db,`rooms/${roomId}`),{round:currentRound+1,roundStartedAt:Date.now()});}else{await update(ref(db,`rooms/${roomId}`),{finished:true,winnerRound:0});}}

$("createRoom").addEventListener("click",async()=>{try{const name=nameInput.value.trim()||"Oyuncu 1";roomId=generateRoomCode();playerNumber=1;await set(ref(db,`rooms/${roomId}`),{player1:{joined:true,name,words:{}},player2:{joined:false,name:"Oyuncu 2",words:{}},round:1,roundStartedAt:Date.now(),emojis:{},finished:false,winnerRound:0});menu.classList.add("hidden");waiting.classList.remove("hidden");roomCodeDisplay.textContent=roomId;listenToRoom();}catch(e){alert("Oda oluşturulamadı: "+e.message);}});

async function joinRoom(code){try{const snap=await get(ref(db,`rooms/${code}`));if(!snap.exists()){alert("Bu oda bulunamadı.");return;}if(snap.val().player2?.joined){alert("Bu oda dolu.");return;}roomId=code;playerNumber=2;const name=nameInput.value.trim()||"Oyuncu 2";await update(ref(db,`rooms/${code}`),{"player2/joined":true,"player2/name":name});menu.classList.add("hidden");game.classList.remove("hidden");listenToRoom();}catch(e){alert("Odaya katılınamadı: "+e.message);}}
$("joinRoom").addEventListener("click",()=>{const c=roomInput.value.trim().toUpperCase();if(c)joinRoom(c);else alert("Oda kodunu gir.");});
$("copyRoom").addEventListener("click",async()=>{try{await navigator.clipboard.writeText(roomLink());alert("🔗 Oda linki kopyalandı!");}catch(e){prompt("Oda linkini kopyala:",roomLink());}});
$("whatsappShare").addEventListener("click",()=>window.open(`https://wa.me/?text=${encodeURIComponent(`⚡ Kelime Düellosu'na katıl!\nOda: ${roomId}\n${roomLink()}`)}`,"_blank"));

// Kelime gönderildiğinde rakibin daha önceki tüm turlardaki kelimeleri de kontrol edilir.
// Böylece aynı kelime hangi turda ortaya çıkarsa oyun anında biter.
async function submitCurrentWord(rawWord){if(gameFinished||!roomId||!playerNumber)return;const word=String(rawWord||"").trim();const normalized=normalizeWord(word);if(!normalized){alert("Geçerli bir kelime yaz.");return;}const roomRef=ref(db,`rooms/${roomId}`);const snap=await get(roomRef);if(!snap.exists())return;const r=snap.val();if(r.finished||r.round!==currentRound)return;if(mySubmitted(r)){setStatus("Bu adımda kelimeni zaten gönderdin.");return;}
  await set(ref(db,`rooms/${roomId}/${playerPath()}/words/${currentRound}`),word);
  wordInput.value="";playTone("success");
  const freshSnap=await get(roomRef);if(!freshSnap.exists())return;const fresh=freshSnap.val();
  const opponent=fresh[otherPath()]?.words||{};let matchedRound=null;
  for(let i=1;i<=5;i++){if(opponent[i]&&normalizeWord(opponent[i])===normalized){matchedRound=i;break;}}
  if(matchedRound){await update(roomRef,{finished:true,winnerRound:matchedRound,matchedWord:word});setStatus(`🎯 EŞLEŞME BULUNDU! ${matchedRound}. adım`);return;}
  setStatus("✅ Kelimen gönderildi. Rakibin durumu tabloda görünüyor.");await checkRound();
}
$("submitWord").addEventListener("click",()=>submitCurrentWord(wordInput.value));wordInput.addEventListener("keydown",e=>{if(e.key==="Enter"){e.preventDefault();submitCurrentWord(wordInput.value);}});

// Emoji tamamen serbesttir; kelime hakkı tüketmez.
document.querySelectorAll(".emoji").forEach(btn=>btn.addEventListener("click",async()=>{if(!roomId||gameFinished)return;const me=window.currentRoom?.[playerPath()]||{};await push(ref(db,`rooms/${roomId}/emojis`),{emoji:btn.dataset.emoji,name:me.name||"Oyuncu",timestamp:Date.now()});playTone();}));

function calculateScores(r){let s1=0,s2=0;for(let i=1;i<=5;i++){const a=r.player1?.words?.[i],b=r.player2?.words?.[i];if(a&&b&&normalizeWord(a)===normalizeWord(b)){s1+=100;s2+=100;}else if(a&&b){s1+=10;s2+=10;}}return[s1,s2];}
async function checkRound(){const snap=await get(ref(db,`rooms/${roomId}`));if(!snap.exists())return;const r=snap.val(),a=r.player1?.words?.[currentRound],b=r.player2?.words?.[currentRound];if(!a||!b)return;if(normalizeWord(a)===normalizeWord(b)){await update(ref(db,`rooms/${roomId}`),{finished:true,winnerRound:currentRound,matchedWord:a});return;}if(currentRound<5&&r.round===currentRound){await update(ref(db,`rooms/${roomId}`),{round:currentRound+1,roundStartedAt:Date.now()});}else if(currentRound>=5){await update(ref(db,`rooms/${roomId}`),{finished:true,winnerRound:0});}}

function renderHistory(r){let html="";for(let i=1;i<currentRound;i++){const a=r.player1?.words?.[i],b=r.player2?.words?.[i];if(a||b)html+=`<div class="history-round"><strong>Adım ${i}</strong><span>👤 ${escapeHtml(r.player1?.name||"Oyuncu 1")}: <b>${escapeHtml(a||"—")}</b></span><span>👤 ${escapeHtml(r.player2?.name||"Oyuncu 2")}: <b>${escapeHtml(b||"—")}</b></span></div>`;}historyList.innerHTML=html||"<p class='empty-history'>Henüz tamamlanan bir adım yok.</p>";}
function renderTable(r){const p1=r.player1||{},p2=r.player2||{},a=p1.words?.[currentRound],b=p2.words?.[currentRound],bothSubmitted=Boolean(a&&b);tableName1.textContent=p1.name||"Oyuncu 1";tableName2.textContent=p2.name||"Oyuncu 2";currentName1.textContent=p1.name||"Oyuncu 1";currentName2.textContent=p2.name||"Oyuncu 2";tableWord1.textContent=bothSubmitted?(a||"—"):"🔒 Gizli";tableWord2.textContent=bothSubmitted?(b||"—"):"🔒 Gizli";tableStatus1.textContent=a?"✅ HAZIR":"🤔 Düşünüyor...";tableStatus2.textContent=b?"✅ HAZIR":"🤔 Düşünüyor...";word1.textContent=bothSubmitted?(a||"—"):"🔒 Gizli";word2.textContent=bothSubmitted?(b||"—"):"🔒 Gizli";currentWords.classList.toggle("hidden",!(a||b));}
function updateStatus(r){const me=r[playerPath()]||{},other=r[otherPath()]||{},a=r.player1?.words?.[currentRound],b=r.player2?.words?.[currentRound];if(a&&b){if(normalizeWord(a)===normalizeWord(b))setStatus(`🎯 KELİME BULUNDU! ${r.player1.name} ve ${r.player2.name}`);else setStatus(`❌ Bu adımda bulunmadı • ${r.player1.name} ve ${r.player2.name}`);}else if(me.words?.[currentRound]){setStatus(`⏳ ${other.name||"Rakip"} düşünüyor...`);}else if(other.words?.[currentRound]){setStatus(`🟢 ${other.name||"Rakip"} HAZIR — senin kelimeni bekliyor.`);}else{setStatus(`🟡 ${other.name||"Rakip"} düşünüyor...`);} }
function setStatus(t){status.textContent=t;}
function showEmoji(item){const el=document.createElement("div");el.className="floating-emoji";el.innerHTML=`<span>${escapeHtml(item.emoji)}</span><small>${escapeHtml(item.name)}</small>`;emojiFeed.appendChild(el);setTimeout(()=>el.remove(),3500);}

function finishGame(r){if(gameFinished)return;gameFinished=true;stopTimer();game.classList.add("hidden");waiting.classList.add("hidden");result.classList.remove("hidden");const[s1,s2]=calculateScores(r),round=r.winnerRound||0; if(round){const a=r.player1.words?.[round],b=r.player2.words?.[round];resultBadge.textContent="🎉";resultTitle.textContent="KELİME BULUNDU — KAZANILDI!";resultText.textContent=`${round}. adımda eşleşme bulundu. Oyun sonlandırıldı.`;finalScores.innerHTML=`<div><b>${escapeHtml(r.player1.name)}</b>: ${escapeHtml(a||r.matchedWord||"—")}</div><div><b>${escapeHtml(r.player2.name)}</b>: ${escapeHtml(b||r.matchedWord||"—")}</div><hr><div>🏆 ${s1} - ${s2}</div>`;playTone("success");}else{resultBadge.textContent="😔";resultTitle.textContent="KELİME BULUNAMADI";resultText.textContent="5 adım tamamlandı, eşleşen kelime bulunamadı.";finalScores.innerHTML=`<div>${escapeHtml(r.player1.name)}: ${s1} puan</div><div>${escapeHtml(r.player2.name)}: ${s2} puan</div>`;playTone("error");}}

function listenToRoom(){onValue(ref(db,`rooms/${roomId}`),snap=>{const r=snap.val();if(!r)return;window.currentRoom=r;const p1=r.player1||{},p2=r.player2||{};if(p1.joined&&p2.joined){waiting.classList.add("hidden");game.classList.remove("hidden");}else{waiting.classList.remove("hidden");waitingText.textContent=`${p1.name||"Oyuncu 1"} hazır. Diğer oyuncu bekleniyor...`;}
currentRound=Number(r.round||1);roundNumber.textContent=currentRound;const sc=calculateScores(r);score1.textContent=sc[0];score2.textContent=sc[1];renderTable(r);renderHistory(r);updateStatus(r);if(r.finished){finishGame(r);return;}if(currentRound!==lastRoundRendered){lastRoundRendered=currentRound;startTimer(r);}else if(!mySubmitted(r))startTimer(r);else stopTimer();});
onValue(ref(db,`rooms/${roomId}/emojis`),snap=>snap.forEach(ch=>{if(!seenEmojiIds.has(ch.key)){seenEmojiIds.add(ch.key);showEmoji(ch.val());}}));}

$("newGame").addEventListener("click",()=>location.reload());
const invited=new URLSearchParams(location.search).get("room");if(invited)roomInput.value=invited.toUpperCase();
