import { initializeApp } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-app.js";

import {
    getDatabase,
    ref,
    set,
    get,
    onValue,
    update
} from "https://www.gstatic.com/firebasejs/12.18.0/firebase-database.js";


// ======================================================
// FIREBASE AYARLARI
// ======================================================

const firebaseConfig = {
  apiKey: "AIzaSyBF4A5AGYcR0eb5ZsuEiUG-Gg9Vfr119yg",
  authDomain: "kelime-oyunu-57a0b.firebaseapp.com",
    
  databaseURL: "https://kelime-oyunu-57a0b-default-rtdb.firebaseio.com",
    
  projectId: "kelime-oyunu-57a0b",
  storageBucket: "kelime-oyunu-57a0b.firebasestorage.app",
  messagingSenderId: "580383166978",
  appId: "1:580383166978:web:f0d428220ab83e33bb4d1b",
  measurementId: "G-PKEB0K17PX"
};


// Firebase'i başlat

const app = initializeApp(firebaseConfig);

const db = getDatabase(app);


// ======================================================
// DEĞİŞKENLER
// ======================================================

let roomId = null;

let playerNumber = null;

let currentRound = 1;


// ======================================================
// HTML ELEMANLARI
// ======================================================

const menu = document.getElementById("menu");

const waiting = document.getElementById("waiting");

const game = document.getElementById("game");

const result = document.getElementById("result");

const createRoomButton =
    document.getElementById("createRoom");

const joinRoomButton =
    document.getElementById("joinRoom");

const roomInput =
    document.getElementById("roomInput");

const roomCodeDisplay =
    document.getElementById("roomCodeDisplay");

const waitingText =
    document.getElementById("waitingText");

const wordInput =
    document.getElementById("wordInput");

const submitWord =
    document.getElementById("submitWord");

const status =
    document.getElementById("status");

const roundNumber =
    document.getElementById("roundNumber");

const word1 =
    document.getElementById("word1");

const word2 =
    document.getElementById("word2");

const words =
    document.getElementById("words");

const resultTitle =
    document.getElementById("resultTitle");

const resultText =
    document.getElementById("resultText");

const newGame =
    document.getElementById("newGame");


// ======================================================
// ODA KODU ÜRET
// ======================================================

function generateRoomCode() {

    const characters =
        "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

    let code = "";

    for (let i = 0; i < 6; i++) {

        code += characters[
            Math.floor(
                Math.random() * characters.length
            )
        ];

    }

    return code;

}


// ======================================================
// ODA OLUŞTUR
// ======================================================

createRoomButton.addEventListener(
    "click",
    async () => {

        roomId = generateRoomCode();

        playerNumber = 1;

        const roomRef =
            ref(db, "rooms/" + roomId);

        await set(roomRef, {

            player1: {
                joined: true,
                words: {}
            },

            player2: {
                joined: false,
                words: {}
            },

            round: 1,

            finished: false

        });


        menu.classList.add("hidden");

        waiting.classList.remove("hidden");

        roomCodeDisplay.textContent = roomId;

        listenToRoom();

    }
);


// ======================================================
// ODAYA KATIL
// ======================================================

joinRoomButton.addEventListener(
    "click",
    async () => {

        const code =
            roomInput.value
                .trim()
                .toUpperCase();

        if (!code) {

            alert("Oda kodunu gir.");

            return;

        }


        const roomRef =
            ref(db, "rooms/" + code);

        const snapshot =
            await get(roomRef);


        if (!snapshot.exists()) {

            alert("Bu oda bulunamadı.");

            return;

        }


        const room =
            snapshot.val();


        if (room.player2.joined) {

            alert("Bu oda dolu.");

            return;

        }


        roomId = code;

        playerNumber = 2;


        await update(roomRef, {

            "player2/joined": true

        });


        menu.classList.add("hidden");

        game.classList.remove("hidden");

        status.textContent =
            "Oyun başladı! Kelimeni yaz.";

        listenToRoom();

    }
);


// ======================================================
// ODAYI DİNLE
// ======================================================

function listenToRoom() {

    const roomRef =
        ref(db, "rooms/" + roomId);


    onValue(roomRef, (snapshot) => {

        const room = snapshot.val();


        if (!room) {

            return;

        }


        // İki oyuncu da geldiyse

        if (
            room.player1.joined &&
            room.player2.joined
        ) {

            waiting.classList.add("hidden");

            game.classList.remove("hidden");

            status.textContent =
                "Kelimeni yaz.";

        }


        // Tur

        currentRound =
            room.round || 1;

        roundNumber.textContent =
            currentRound;


        // Mevcut kelimeler

        const p1Words =
            room.player1.words || {};

        const p2Words =
            room.player2.words || {};


        const currentWord1 =
            p1Words[currentRound] || "";

        const currentWord2 =
            p2Words[currentRound] || "";


        // İki oyuncu da kelime girdiyse

        if (
            currentWord1 &&
            currentWord2
        ) {

            words.classList.remove("hidden");

            word1.textContent =
                currentWord1;

            word2.textContent =
                currentWord2;


            // Aynı kelime mi?

            if (
                currentWord1.toLowerCase() ===
                currentWord2.toLowerCase()
            ) {

                status.textContent =
                    "🎯 Aynı kelime!";

            } else {

                status.textContent =
                    "🔄 Kelimeler farklı.";

            }


            // 5. tur bittiyse

            if (currentRound >= 5) {

                finishGame(
                    currentWord1,
                    currentWord2
                );

            }

        }

    });

}


// ======================================================
// KELİME GÖNDER
// ======================================================

submitWord.addEventListener(
    "click",
    async () => {

        const word =
            wordInput.value.trim();


        if (!word) {

            alert("Bir kelime yaz.");

            return;

        }


        if (!roomId) {

            return;

        }


        const playerPath =
            playerNumber === 1
                ? "player1"
                : "player2";


        const wordRef =
            ref(
                db,
                `rooms/${roomId}/${playerPath}/words/${currentRound}`
            );


        await set(wordRef, word);


        wordInput.value = "";

        status.textContent =
            "Kelimen kaydedildi. Diğer oyuncu bekleniyor.";


        // Bir sonraki tura geçişi kontrol et

        setTimeout(
            checkNextRound,
            1000
        );

    }
);


// ======================================================
// SONRAKİ TUR
// ======================================================

async function checkNextRound() {

    const roomRef =
        ref(db, "rooms/" + roomId);


    const snapshot =
        await get(roomRef);


    if (!snapshot.exists()) {

        return;

    }


    const room =
        snapshot.val();


    const p1Word =
        room.player1.words?.[currentRound];


    const p2Word =
        room.player2.words?.[currentRound];


    if (
        p1Word &&
        p2Word &&
        currentRound < 5
    ) {

        await update(
            roomRef,
            {
                round: currentRound + 1
            }
        );

    }

}


// ======================================================
// OYUNU BİTİR
// ======================================================

function finishGame(
    finalWord1,
    finalWord2
) {

    if (!result.classList.contains("hidden")) {

        return;

    }


    game.classList.add("hidden");

    result.classList.remove("hidden");


    if (
        finalWord1.toLowerCase() ===
        finalWord2.toLowerCase()
    ) {

        resultTitle.textContent =
            "🎉 KAZANDINIZ!";

        resultText.textContent =
            `İkiniz de "${finalWord1}" yazdınız.`;

    } else {

        resultTitle.textContent =
            "❌ KAYBETTİNİZ";

        resultText.textContent =
            `"${finalWord1}" ≠ "${finalWord2}"`;

    }

}


// ======================================================
// YENİ OYUN
// ======================================================

newGame.addEventListener(
    "click",
    () => {

        location.reload();

    }
);
