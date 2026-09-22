let tvCurrentRound = 1;
let tvAnsStr = "";
let boxData = []; 
let isSpacingActive = false;
let tvLastEffectTs = 0;
let tvLastAudioTs = 0;
let tvLastRevealTs = 0;
let tvLastHideAllTs = 0; 

const audioPlayer = document.getElementById('tv-audio-player');
let playTimeout = null;
let countdownInterval = null;
let audioCtx = null;

function initTVAudio() {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    audioCtx.resume().then(() => {
        document.getElementById('tv-init-overlay').classList.add('hidden');
    });
    audioPlayer.play().then(() => {
        audioPlayer.pause();
    }).catch(e => console.log("Init Audio Error: ", e));
}

document.getElementById('audio-upload').addEventListener('change', function(e) {
    const file = e.target.files[0];
    if (file) {
        audioPlayer.src = URL.createObjectURL(file);
        audioPlayer.load();
    }
});

function playBeep(freq = 440, type = 'sine', duration = 0.2) {
    if(!audioCtx) return;
    try {
        const oscillator = audioCtx.createOscillator();
        const gainNode = audioCtx.createGain();
        oscillator.type = type;
        oscillator.frequency.setValueAtTime(freq, audioCtx.currentTime);
        gainNode.gain.setValueAtTime(0.5, audioCtx.currentTime);
        oscillator.connect(gainNode);
        gainNode.connect(audioCtx.destination);
        oscillator.start();
        setTimeout(() => oscillator.stop(), duration * 1000);
    } catch(e) {}
}

window.addEventListener('app-sync', () => {
    const settings = App.getSettings();
    const currentAns = settings.answers[settings.currentRound] || '';
    
    if (settings.currentRound !== tvCurrentRound || currentAns !== tvAnsStr) {
        tvCurrentRound = settings.currentRound;
        tvAnsStr = currentAns;
        document.getElementById('tv-round-display').innerText = `Round ${tvCurrentRound}`;
        renderTVBoard();
    }

    if (settings.audioCommand && settings.audioCommand.ts > tvLastAudioTs) {
        tvLastAudioTs = settings.audioCommand.ts;
        executeAudioCommand(settings.audioCommand.type, settings);
    }

    if (settings.revealTrigger && settings.revealTrigger > tvLastRevealTs) {
        tvLastRevealTs = settings.revealTrigger;
        revealAllSequentially(settings.revealSpeed || 0.2);
    }

    if (settings.hideAllTrigger && settings.hideAllTrigger > tvLastHideAllTs) {
        tvLastHideAllTs = settings.hideAllTrigger;
        hideAllBoxes();
    }

    if (settings.currentEffect && settings.currentEffect.ts > tvLastEffectTs) {
        tvLastEffectTs = settings.currentEffect.ts;
        playTVEffect(settings.currentEffect);
    }
});

function hideAllBoxes() {
    document.getElementById('tv-word-container').classList.remove('tv-space-active');
    boxData.forEach(item => {
        if (item.revealed) {
            item.revealed = false;
            const box = document.getElementById(`tv-box-${item.id}`);
            const inner = box.querySelector('.char-inner');
            box.classList.remove('flipped');
            inner.innerText = item.id; 
        }
    });
}

function getChoseong(char) {
    const cho = ["ㄱ","ㄲ","ㄴ","ㄷ","ㄸ","ㄹ","ㅁ","ㅂ","ㅃ","ㅅ","ㅆ","ㅇ","ㅈ","ㅉ","ㅊ","ㅋ","ㅌ","ㅍ","ㅎ"];
    const code = char.charCodeAt(0) - 44032;
    if (code > -1 && code < 11172) return cho[Math.floor(code / 588)];
    return char;
}

function renderTVBoard() {
    const container = document.getElementById('tv-word-container');
    container.innerHTML = '';
    boxData = [];
    container.classList.remove('tv-space-active');

    if (!tvAnsStr) {
        container.innerHTML = `<h2 style="color:white; font-size:3rem;">이 라운드의 정답 가사가 세팅되지 않았습니다.</h2>`;
        return;
    }

    let numberCount = 1;
    const rows = tvAnsStr.split('/');

    rows.forEach(rowText => {
        const rowDiv = document.createElement('div');
        rowDiv.className = 'tv-row'; 

        let currentWordGroup = document.createElement('div');
        currentWordGroup.className = 'tv-word-group';

        for (let i = 0; i < rowText.length; i++) {
            if (rowText[i] === ' ') {
                if(boxData.length > 0) boxData[boxData.length-1].isSpaceAfter = true;
                continue; 
            }

            const isSpaceAfter = (rowText[i+1] === ' ' || rowText[i+1] === undefined);
            const item = {
                id: numberCount,
                char: rowText[i],
                cho: getChoseong(rowText[i]),
                isSpaceAfter: isSpaceAfter,
                revealed: false
            };
            boxData.push(item);

            const box = document.createElement('div');
            box.className = `tv-char-box color-${(numberCount - 1) % 3}`; 
            box.id = `tv-box-${numberCount}`;
            
            const inner = document.createElement('div');
            inner.className = 'char-inner';
            inner.innerText = numberCount;
            box.appendChild(inner);

            box.onclick = () => revealSingleBox(item.id, true);

            currentWordGroup.appendChild(box);

            if (isSpaceAfter) {
                rowDiv.appendChild(currentWordGroup);
                currentWordGroup = document.createElement('div');
                currentWordGroup.className = 'tv-word-group';
            }
            numberCount++;
        }
        rowDiv.appendChild(currentWordGroup);
        container.appendChild(rowDiv);
    });
}

function revealSingleBox(id, permanent = false) {
    const item = boxData.find(d => d.id === id);
    if(item && !item.revealed) {
        if(permanent) item.revealed = true;
        const box = document.getElementById(`tv-box-${id}`);
        const inner = box.querySelector('.char-inner');
        box.classList.add('flipped');
        inner.innerText = item.char; 
    }
}

function showToast(msg) {
    const toast = document.getElementById('tv-toast');
    toast.innerText = msg;
    toast.classList.remove('hidden');
    setTimeout(() => toast.classList.add('hidden'), 4000);
}

function executeAudioCommand(type, settings) {
    if(!audioPlayer.src || audioPlayer.src.includes('tv.html') || audioPlayer.src.includes('tv_wjsrhkdvks820.html')) return alert("하단의 파일 선택 버튼으로 음악을 넣어주세요.");
    clearTimeout(playTimeout);
    clearInterval(countdownInterval);
    audioPlayer.pause();
    
    document.getElementById('tv-countdown-number').classList.add('hidden');
    
    const timings = settings.timings || {};
    const rData = timings[tvCurrentRound] || {iSM:0, iSS:0, iEM:0, iES:0, aSM:0, aSS:0, aEM:0, aES:0};
    
    const iStart = (rData.iSM * 60) + rData.iSS;
    const iEnd = (rData.iEM * 60) + rData.iES;
    const aStart = (rData.aSM * 60) + rData.aSS;
    const aEnd = (rData.aEM * 60) + rData.aES;

    if (type === 'intro_then_answer') {
        playIntroThenAnswer(iStart, iEnd, aStart, aEnd, false, settings.revealSpeed);
    } else if (type === 'answer') {
        startAnswerWithCountdown(aStart, aEnd, false, settings.revealSpeed);
    } else if (type === 'answer_and_reveal') {
        startAnswerWithCountdown(aStart, aEnd, true, settings.revealSpeed);
    } else if (type === 'stop') {
        audioPlayer.pause();
    }
}

function playIntroThenAnswer(iStart, iEnd, aStart, aEnd, shouldReveal, speedStr) {
    showToast("🎵 인트로 재생");
    audioPlayer.currentTime = iStart;
    audioPlayer.play();
    const duration = (iEnd - iStart) * 1000;
    
    if(duration > 0) {
        playTimeout = setTimeout(() => {
            audioPlayer.pause();
            startAnswerWithCountdown(aStart, aEnd, shouldReveal, speedStr);
        }, duration);
    } else {
        startAnswerWithCountdown(aStart, aEnd, shouldReveal, speedStr);
    }
}

function startAnswerWithCountdown(aStart, aEnd, shouldReveal, speedStr) {
    const num = document.getElementById('tv-countdown-number');
    num.classList.remove('hidden');
    
    let cnt = 3;
    num.innerText = cnt;
    playBeep(440, 'sine', 0.1); 
    
    countdownInterval = setInterval(() => {
        cnt--;
        if(cnt > 0) {
            num.innerText = cnt;
            playBeep(440, 'sine', 0.1);
        } else {
            clearInterval(countdownInterval);
            num.classList.add('hidden');
            playBeep(880, 'sine', 0.3); 
            
            showToast("🎵 정답 구간 재생");
            audioPlayer.currentTime = aStart;
            audioPlayer.play();
            const duration = (aEnd - aStart) * 1000;
            if(duration > 0) playTimeout = setTimeout(() => audioPlayer.pause(), duration);
            
            if(shouldReveal) revealAllSequentially(speedStr);
        }
    }, 1000);
}

function revealAllSequentially(speedStr) {
    document.getElementById('tv-word-container').classList.add('tv-space-active');
    const speed = parseFloat(speedStr) || 0.2;
    const unrevealed = boxData.filter(d => !d.revealed);
    unrevealed.forEach((item, index) => {
        setTimeout(() => revealSingleBox(item.id, true), index * (speed * 1000));
    });
}

function playTVEffect(effect) {
    const overlay = document.getElementById('effect-overlay');
    const content = document.getElementById('effect-content');
    overlay.classList.remove('hidden');
    document.querySelectorAll('.particle').forEach(p => p.remove());

    const groupsData = App.getAllGroups();
    let targetNames = [];
    effect.targets.forEach(gId => {
        const gData = groupsData[gId];
        if(gData && gData.customName) targetNames.push(`${gId}조[${gData.customName}]`);
        else targetNames.push(`${gId}조`);
    });

    if (effect.type === 'boom') {
        content.innerHTML = `<div class="boom-text">💥 땡! 오답!<br><span style="color:#f1c40f;">${targetNames.join(', ')}</span></div>`;
        createParticles(['🍿', '💣', '💨'], 60);
    } else if (effect.type === 'oneshot') {
        content.innerHTML = `<div class="oneshot-text">📸 원샷 축하합니다!<br><span style="color:#fff; text-shadow: 2px 2px #d32f2f;">${targetNames.join('<br>')}</span></div>`;
        createParticles(['🎉', '🎊', '✨', '🥇'], 100);
    }

    setTimeout(() => { overlay.classList.add('hidden'); content.innerHTML = ''; }, 5000);
}

function createParticles(emojis, count) {
    for(let i=0; i<count; i++) {
        const p = document.createElement('div');
        p.className = 'particle';
        p.innerText = emojis[Math.floor(Math.random() * emojis.length)];
        p.style.left = Math.random() * 100 + 'vw';
        p.style.animationDuration = (Math.random() * 2 + 2) + 's';
        p.style.animationDelay = (Math.random() * 1) + 's';
        p.style.fontSize = (Math.random() * 2 + 2) + 'rem';
        document.body.appendChild(p);
        setTimeout(() => p.remove(), 4500); 
    }
}
