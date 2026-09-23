let hintCurrentRound = 1;
let hintAnsStr = "";
let boxData = []; 
let isSpacingActive = false;
let processedHints = new Set();
let tvLastRevealTs = Date.now();
let tvLastHideAllTs = Date.now(); 

window.addEventListener('app-sync', () => {
    const settings = App.getSettings();
    const currentAns = settings.answers[settings.currentRound] || '';
    
    if (settings.currentRound !== hintCurrentRound || currentAns !== hintAnsStr) {
        hintCurrentRound = settings.currentRound;
        hintAnsStr = currentAns;
        document.getElementById('tv-round-display').innerText = `Round ${hintCurrentRound} 🪄`;
        renderHintBoard();
    }

    if (settings.revealTrigger && settings.revealTrigger > tvLastRevealTs) {
        tvLastRevealTs = settings.revealTrigger;
        revealAllSequentially(settings.revealSpeed || 0.2);
    }

    if (settings.hideAllTrigger && settings.hideAllTrigger > tvLastHideAllTs) {
        tvLastHideAllTs = settings.hideAllTrigger;
        hideAllBoxes();
    }

    const hints = App.getHintRequests();
    for (let reqId in hints) {
        if (hints[reqId].status === 'approved' && !processedHints.has(reqId)) {
            processedHints.add(reqId);
            executeHint(hints[reqId].type, hints[reqId].param, hints[reqId].group);
        }
    }
});

function getChoseong(char) {
    const cho = ["ㄱ","ㄲ","ㄴ","ㄷ","ㄸ","ㄹ","ㅁ","ㅂ","ㅃ","ㅅ","ㅆ","ㅇ","ㅈ","ㅉ","ㅊ","ㅋ","ㅌ","ㅍ","ㅎ"];
    const code = char.charCodeAt(0) - 44032;
    if (code > -1 && code < 11172) return cho[Math.floor(code / 588)];
    return char;
}

function renderHintBoard() {
    const container = document.getElementById('tv-word-container');
    container.innerHTML = '';
    boxData = [];
    isSpacingActive = false;
    container.classList.remove('tv-space-active');

    if (!hintAnsStr) {
        container.innerHTML = `<h2 style="color:white; font-size:3rem;">이 라운드의 정답 가사가 세팅되지 않았습니다.</h2>`;
        return;
    }

    let numberCount = 1;
    const rows = hintAnsStr.split('/');

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
                revealed: false,
                choHintShown: false
            };
            boxData.push(item);

            const box = document.createElement('div');
            box.className = `tv-char-box color-${(numberCount - 1) % 3}`; 
            box.id = `tv-box-${numberCount}`;
            
            const inner = document.createElement('div');
            inner.className = 'char-inner';
            inner.innerText = numberCount;
            box.appendChild(inner);

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

function revertSingleBox(id) {
    const item = boxData.find(d => d.id === id);
    if(item && !item.revealed) {
        const box = document.getElementById(`tv-box-${id}`);
        const inner = box.querySelector('.char-inner');
        box.classList.remove('flipped');
        inner.innerText = item.choHintShown ? item.cho : item.id; 
        if(item.choHintShown) inner.style.color = "#e74c3c";
    }
}

function hideAllBoxes() {
    document.getElementById('tv-word-container').classList.remove('tv-space-active');
    boxData.forEach(item => {
        if (item.revealed) {
            item.revealed = false;
            const box = document.getElementById(`tv-box-${item.id}`);
            const inner = box.querySelector('.char-inner');
            box.classList.remove('flipped');
            inner.innerText = item.id; 
            inner.style.color = "inherit";
        }
    });
}

function showToast(msg) {
    const toast = document.getElementById('tv-toast');
    toast.innerText = msg;
    toast.classList.remove('hidden');
    setTimeout(() => toast.classList.add('hidden'), 4000);
}

function executeHint(type, param, groupId) {
    const settings = App.getSettings();
    const hSec = parseFloat(settings.hintDuration) || 3;
    const ms = hSec * 1000; 
    const displaySec = hSec < 1 ? 1 : hSec;

    if (type === '전체 띄어쓰기') {
        const container = document.getElementById('tv-word-container');
        container.classList.add('tv-space-active');
        showToast(`💡 전체 띄어쓰기 (${displaySec}초 후 닫힘)`);
        setTimeout(() => { container.classList.remove('tv-space-active'); }, ms);
        
    } else if (type === '초성 2개 보기') {
        const unrevealed = boxData.filter(d => !d.revealed);
        let targets = [];
        
        if (param) {
            const parts = param.split(',').map(s => parseInt(s.trim()));
            parts.forEach(p => {
                const found = boxData.find(d => d.id === p && !d.revealed);
                if(found) targets.push(found);
            });
        }
        
        if (targets.length === 0 && unrevealed.length > 0) {
            unrevealed.sort(() => 0.5 - Math.random());
            targets = unrevealed.slice(0, 2);
        }
        
        if (targets.length === 0) return;

        targets.forEach(item => {
            item.choHintShown = true;
            const box = document.getElementById(`tv-box-${item.id}`);
            const inner = box.querySelector('.char-inner');
            inner.innerText = item.cho;
            inner.style.color = "#e74c3c";
        });
        
        showToast(`💡 지정 초성 오픈 (${displaySec}초 후 닫힘)`);
        setTimeout(() => {
            targets.forEach(item => {
                item.choHintShown = false;
                const inner = document.getElementById(`tv-box-${item.id}`).querySelector('.char-inner');
                inner.innerText = item.id;
                inner.style.color = "inherit";
            });
        }, ms);

    } else if (type === '3초 보기') {
        showToast(`💡 전체 공개 (${displaySec}초 후 닫힘)`);
        const unrevealed = boxData.filter(d => !d.revealed);
        unrevealed.forEach(item => revealSingleBox(item.id, false));
        
        const num = document.getElementById('tv-countdown-number');
        num.classList.remove('hidden');
        
        if (hSec <= 1) {
            num.innerText = '1';
            setTimeout(() => {
                num.classList.add('hidden');
                unrevealed.forEach(item => revertSingleBox(item.id));
            }, ms);
        } else {
            let cnt = Math.ceil(hSec);
            num.innerText = cnt;
            const iv = setInterval(() => {
                cnt--;
                if(cnt > 0) num.innerText = cnt;
            }, 1000);
            
            setTimeout(() => {
                clearInterval(iv);
                num.classList.add('hidden');
                unrevealed.forEach(item => revertSingleBox(item.id));
            }, ms);
        }

    } else if (type === '한 글자 보기') {
        const targetId = parseInt(param);
        const item = boxData.find(d => d.id === targetId);
        if(!item) return showToast("❌ 해당 번호를 찾을 수 없습니다.");
        if(item.revealed) return showToast("❌ 이미 열려있는 글자입니다.");
        
        showToast(`💡 ${targetId}번 글자 보기 (${displaySec}초 후 닫힘)`);
        revealSingleBox(targetId, false);
        setTimeout(() => revertSingleBox(targetId), ms);
        
    } else if (type === '오답수 알려주기') {
        const currentAns = (settings.answers[settings.currentRound] || '').replace(/\//g, '');
        const gData = App.getGroup(groupId);
        const masterName = gData.master || '';
        const mData = (gData.membersData && gData.membersData[masterName]) ? gData.membersData[masterName].data : '';

        if (!mData || mData.startsWith('data:image')) {
            showToast(`❌ ${groupId}조: 손글씨 모드이거나 제출된 답이 없어 오답 분석 불가`);
            return;
        }

        const cStr = currentAns.replace(/\s+/g, '');
        let sStr = mData.replace(/\s+/g, '');
        if (sStr.length < cStr.length) sStr = sStr.padEnd(cStr.length, ' ');

        let correctFreq = {};
        for (let char of cStr) {
            correctFreq[char] = (correctFreq[char] || 0) + 1;
        }

        for (let i = 0; i < cStr.length; i++) {
            if (cStr[i] === sStr[i]) {
                correctFreq[cStr[i]]--;
            }
        }

        let blueCount = 0;
        let redCount = 0;
        for (let i = 0; i < cStr.length; i++) {
            if (cStr[i] !== sStr[i]) {
                if (sStr[i] !== ' ' && sStr[i] !== 'X' && correctFreq[sStr[i]] && correctFreq[sStr[i]] > 0) {
                    correctFreq[sStr[i]]--;
                    blueCount++;
                } else {
                    redCount++;
                }
            }
        }

        let overlay = document.getElementById('hint-result-overlay');
        if (!overlay) {
            overlay = document.createElement('div');
            overlay.id = 'hint-result-overlay';
            overlay.style.cssText = 'position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.85); z-index:10000; display:flex; justify-content:center; align-items:center;';
            document.body.appendChild(overlay);
        }

        overlay.innerHTML = `
            <div style="background:white; padding:50px 80px; border-radius:20px; text-align:center; box-shadow:0 10px 30px rgba(0,0,0,0.5);">
                <h2 style="color:#1976d2; font-size:4rem; margin:0 0 30px 0;">[ ${groupId}조 힌트 결과 ]</h2>
                <div style="font-size:3.5rem; color:#e74c3c; margin-bottom:15px; font-weight:bold;">❌ 오답 : ${redCount}개 / <span style="font-size:2.5rem; color:#555;">${cStr.length}</span></div>
                <div style="font-size:3.5rem; color:#3498db; margin-bottom:10px; font-weight:bold;">⚠️ 이탈 : ${blueCount}개 / <span style="font-size:2.5rem; color:#555;">${cStr.length}</span></div>
            </div>
        `;
        overlay.classList.remove('hidden');

        // 🌟 V56: 오답수는 다른 힌트와 무관하게 3초 고정 (읽을 시간 확보)
        setTimeout(() => {
            overlay.classList.add('hidden');
        }, 3000);
    }
}

function revealAllSequentially(speedStr) {
    document.getElementById('tv-word-container').classList.add('tv-space-active');
    const speed = parseFloat(speedStr) || 0.2;
    const unrevealed = boxData.filter(d => !d.revealed);
    unrevealed.forEach((item, index) => {
        setTimeout(() => revealSingleBox(item.id, true), index * (speed * 1000));
    });
}
