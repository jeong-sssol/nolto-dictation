// 1. Firebase 설정
const firebaseConfig = {
    apiKey: "AIzaSyBC1SxIW-8_RuDojcEv8vXpRqs0qEVGrEA",
    authDomain: "nolto-dictation.firebaseapp.com",
    databaseURL: "https://nolto-dictation-default-rtdb.firebaseio.com",
    projectId: "nolto-dictation",
    storageBucket: "nolto-dictation.firebasestorage.app",
    messagingSenderId: "490060326215",
    appId: "1:490060326215:web:7f4e511b6df2587f819862"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.database();
const dbRef = db.ref('nolto_data_v9');

const App = {
    localData: null,
    alarmAudio: new Audio('https://t1.daumcdn.net/cfile/tistory/998539425C9E5DE72B?original'),
    
    init: () => {
        dbRef.on('value', (snapshot) => {
            const data = snapshot.val();
            if (data) {
                if (!data.groups) data.groups = {};
                if (!data.settings) data.settings = {};
                if (!data.settings.passwords) data.settings.passwords = {};
                if (!data.settings.answers) data.settings.answers = {};
                if (!data.settings.timings) data.settings.timings = {};
                if (!data.hintRequests) data.hintRequests = {}; 
                
                App.localData = data;
                window.dispatchEvent(new Event('app-sync')); 
                
                const groupSelect = document.getElementById('group-select');
                if (groupSelect && groupSelect.options.length !== data.settings.groupCount) {
                    const currentVal = groupSelect.value;
                    groupSelect.innerHTML = '';
                    for(let i=1; i<=data.settings.groupCount; i++) {
                        groupSelect.innerHTML += `<option value="${i}">${i} 모둠</option>`;
                    }
                    if(currentVal) groupSelect.value = currentVal;
                }
            } else {
                App.factoryReset();
            }
        });
    },
    
    factoryReset: () => {
        const defaultData = {
            settings: { 
                adminPassword: '1234',
                groupCount: 6, 
                passwords: {1:'', 2:'', 3:'', 4:'', 5:'', 6:''}, 
                totalRounds: 3,
                answers: {1:'', 2:'', 3:''},
                timings: {1:{iSM:0,iSS:0,iEM:0,iES:0,aSM:0,aSS:0,aEM:0,aES:0}, 2:{iSM:0,iSS:0,iEM:0,iES:0,aSM:0,aSS:0,aEM:0,aES:0}, 3:{iSM:0,iSS:0,iEM:0,iES:0,aSM:0,aSS:0,aEM:0,aES:0}},
                currentRound: 1,
                teacherFontSize: 30, 
                hintLimit: 1,    
                revealSpeed: 0.2,
                hintDuration: 3, 
                isLocked: false,
                timerEnd: null,
                currentEffect: null, 
                clearTrigger: 0,
                audioCommand: null,
                revealTrigger: 0,
                hideAllTrigger: 0 
            },
            groups: { "0": { dummy: true } },
            hintRequests: { "dummy": { dummy: true } }
        };
        dbRef.set(defaultData);
    },

    getData: () => {
        let data = App.localData;
        if (!data) return { settings: { groupCount: 6, passwords: {}, answers: {}, timings:{}, hintLimit:1, hintDuration: 3, teacherFontSize: 30, revealSpeed:0.2 }, groups: {}, hintRequests: {} };
        let cloned = JSON.parse(JSON.stringify(data));
        if (!cloned.groups) cloned.groups = {};
        if (!cloned.settings) cloned.settings = {};
        if (!cloned.settings.passwords) cloned.settings.passwords = {};
        if (!cloned.settings.answers) cloned.settings.answers = {};
        if (!cloned.settings.timings) cloned.settings.timings = {};
        if (!cloned.hintRequests) cloned.hintRequests = {};
        if (typeof cloned.settings.hintDuration === 'undefined') cloned.settings.hintDuration = 3;
        return cloned;
    },

    getSettings: () => App.getData().settings,
    
    // 🌟 덮어쓰기(set) 대신 안전하게 개별 데이터(update, set) 방식으로 전면 수정
    saveSettings: (adminPw, groupCount, passwords, totalRounds, answers, timings, hintLimit, tFontSize) => {
        dbRef.child('settings').update({
            adminPassword: adminPw, groupCount: groupCount, passwords: passwords,
            totalRounds: totalRounds, answers: answers, timings: timings,
            hintLimit: hintLimit, teacherFontSize: tFontSize
        });
    },

    saveSettingsOnly: () => {
        const hintLimit = parseInt(document.getElementById('set-hint-limit').value) || 1;
        const teacherFontSize = document.getElementById('cctv-font-size').value;
        const revealSpeed = parseFloat(document.getElementById('reveal-speed').value);
        const hintDuration = parseInt(document.getElementById('set-hint-duration').value) || 3;
        dbRef.child('settings').update({ hintLimit, teacherFontSize, revealSpeed, hintDuration });
    },

    setCurrentRound: (round) => { dbRef.child('settings/currentRound').set(round); },
    setLock: (isLocked) => {
        // 🌟 명시적/암묵적 잠금 해제 시, 타이머 데이터도 완벽하게 날려서 UI 동기화
        const updates = { isLocked: isLocked };
        if (!isLocked) updates.timerEnd = null; 
        dbRef.child('settings').update(updates);
    },
    startTimer: (seconds) => { dbRef.child('settings').update({ timerEnd: Date.now() + (seconds * 1000), isLocked: false }); },
    stopTimer: () => { dbRef.child('settings/timerEnd').set(null); },
    
    playAlarm: () => { App.alarmAudio.play().catch(e => console.log("알람 자동재생 막힘")); },

    triggerEffect: (type, targetIds) => { dbRef.child('settings/currentEffect').set({ type: type, targets: targetIds, ts: Date.now() }); },
    triggerAudio: (type) => { dbRef.child('settings/audioCommand').set({ type: type, ts: Date.now() }); },
    triggerRevealAll: () => { dbRef.child('settings/revealTrigger').set(Date.now()); },
    triggerHideAll: () => { dbRef.child('settings/hideAllTrigger').set(Date.now()); },

    // 🌟 안전하고 완벽한 일괄 삭제 로직
    clearBoardsAndHints: () => {
        dbRef.once('value').then((snapshot) => {
            let data = snapshot.val();
            if(!data) return;
            let updates = {};
            updates['settings/clearTrigger'] = Date.now();
            if(data.groups) {
                for(let key in data.groups) {
                    if (key === '0' || key === 'dummy') continue;
                    updates[`groups/${key}/usedHints`] = [];
                    updates[`groups/${key}/hintCount`] = 0;
                    if(data.groups[key].membersData) {
                        for(let member in data.groups[key].membersData) {
                            updates[`groups/${key}/membersData/${member}/data`] = '';
                            updates[`groups/${key}/membersData/${member}/type`] = 'pen'; 
                        }
                    }
                }
            }
            updates['hintRequests'] = { "dummy": { dummy: true } };
            dbRef.update(updates);
        });
    },

    // 🌟 다음 반 수업 준비 완전 분리 (그룹 빈칸으로 인한 에러 방지)
    resetForNextClass: () => {
        let updates = {
            'settings/currentRound': 1, 'settings/isLocked': false, 'settings/timerEnd': null,
            'settings/clearTrigger': Date.now(), 'settings/revealTrigger': 0, 'settings/hideAllTrigger': 0, 'settings/audioCommand': null,
            'groups': { "0": { dummy: true } }, 'hintRequests': { "dummy": { dummy: true } }
        };
        dbRef.update(updates);
    },

    orderHint: (groupId, type, param='') => {
        const reqId = `req_${Date.now()}_${groupId}`;
        const updates = {};
        updates[`hintRequests/${reqId}`] = { group: groupId, type: type, param: param, ts: Date.now(), status: 'pending', alerted: false };
        
        // 트랜잭션 방식으로 힌트 사용 내역 증가
        const groupRef = dbRef.child(`groups/${groupId}`);
        groupRef.once('value').then(snap => {
            let gData = snap.val() || {};
            let usedHints = gData.usedHints || [];
            let hintCount = gData.hintCount || 0;
            usedHints.push(type);
            updates[`groups/${groupId}/usedHints`] = usedHints;
            updates[`groups/${groupId}/hintCount`] = hintCount + 1;
            dbRef.update(updates);
        });
        return reqId; 
    },

    getHintRequests: () => App.getData().hintRequests || {},

    processHint: (reqId, status) => { dbRef.child(`hintRequests/${reqId}/status`).set(status); },

    cancelHint: (reqId) => {
        dbRef.child(`hintRequests/${reqId}`).once('value').then(snap => {
            const req = snap.val();
            if(req && req.status === 'pending') {
                let updates = {};
                updates[`hintRequests/${reqId}/status`] = 'cancelled';
                const gRef = dbRef.child(`groups/${req.group}`);
                gRef.once('value').then(gSnap => {
                    let g = gSnap.val();
                    if(g) {
                        updates[`groups/${req.group}/hintCount`] = Math.max(0, (g.hintCount || 0) - 1);
                        updates[`groups/${req.group}/usedHints`] = (g.usedHints || []).filter(h => h !== req.type);
                        dbRef.update(updates);
                    }
                });
            }
        });
    },
    
    // 🌟 V53: 인덱스를 받아서 특정 힌트만 딱 삭제하고 복구시키는 함수
    executeHintCancel: (groupId, hintIndex) => {
        const gRef = dbRef.child(`groups/${groupId}`);
        gRef.once('value').then(gSnap => {
            let g = gSnap.val();
            if(g && g.hintCount > 0 && g.usedHints && g.usedHints.length > hintIndex) {
                let canceledHint = g.usedHints[hintIndex];
                let newUsedHints = [...g.usedHints];
                newUsedHints.splice(hintIndex, 1);
                
                let updates = {};
                updates[`groups/${groupId}/hintCount`] = Math.max(0, g.hintCount - 1);
                updates[`groups/${groupId}/usedHints`] = newUsedHints;
                
                dbRef.update(updates).then(() => {
                    alert(`✅ ${groupId}조의 [${canceledHint}] 힌트가 취소되고 기회가 복구되었습니다.`);
                });
            }
        });
    },

    addHintOpportunity: () => {
        dbRef.child('groups').once('value').then(snap => {
            let groups = snap.val();
            let updates = {};
            for(let key in groups) {
                if(groups[key].hintCount > 0) updates[`groups/${key}/hintCount`] = groups[key].hintCount - 1;
            }
            dbRef.update(updates);
        });
    },

    markHintAlerted: (reqId) => { dbRef.child(`hintRequests/${reqId}/alerted`).set(true); },

    getGroup: (groupId) => {
        const data = App.getData();
        if (!data.groups[groupId]) data.groups[groupId] = { master: '', customName: '', members: {}, membersData: {}, usedHints: [], hintCount: 0 };
        return data.groups[groupId];
    },
    
    // 🌟 데이터 덮어쓰기(set) 원천 차단 - 회원 접속 시 안전한 트리거 사용
    joinMember: (groupId, name) => {
        const gRef = dbRef.child(`groups/${groupId}`);
        gRef.child(`membersData/${name}`).update({ type: 'pen', data: '', color: '#ffffff', size: 5 });
        gRef.child(`members/${name}`).set(true);
        gRef.child('master').once('value').then(snap => {
            if (!snap.val() || snap.val() === '') gRef.child('master').set(name);
        });
    },

    // 🌟 학생 스스로 이름 변경하기 로직
    changeMemberName: (groupId, oldName, newName) => {
        const gRef = dbRef.child(`groups/${groupId}`);
        gRef.once('value').then(snap => {
            let gData = snap.val();
            if(gData && gData.members && gData.members[oldName]) {
                let updates = {};
                updates[`groups/${groupId}/members/${oldName}`] = null;
                updates[`groups/${groupId}/members/${newName}`] = true;
                
                if (gData.membersData && gData.membersData[oldName]) {
                    updates[`groups/${groupId}/membersData/${newName}`] = gData.membersData[oldName];
                    updates[`groups/${groupId}/membersData/${oldName}`] = null;
                } else {
                    updates[`groups/${groupId}/membersData/${newName}`] = { type: 'pen', data: '', color: '#ffffff', size: 5 };
                }
                
                if (gData.master === oldName) {
                    updates[`groups/${groupId}/master`] = newName;
                }
                dbRef.update(updates);
            }
        });
    },

    setMaster: (groupId, newMaster) => { dbRef.child(`groups/${groupId}/master`).set(newMaster); },

    setGroupName: (groupId, customName) => { dbRef.child(`groups/${groupId}/customName`).set(customName); },

    // 🌟 동시 그림/타이핑 시 덮어쓰기 데이터 파괴 오류의 핵심 원인 해결 (경로 타겟팅 업데이트)
    updateMemberBoard: (groupId, memberName, boardObj) => {
        dbRef.child(`groups/${groupId}/membersData/${memberName}`).update(boardObj);
    },

    getAllGroups: () => App.getData().groups || {},

    // 🌟 파란색 글씨 버그 수정 (단순 포함 검사가 아닌 개수 차감 방식 도입)
    gradeAnswer: (correct, submitted) => {
        if (!correct || !submitted) return { rate: 0, html: '제출된 답이 없습니다.' };
        if (submitted.startsWith('data:image')) return { rate: 0, html: '📝 손글씨 모드 (자동채점 불가)' };
        
        const cStr = correct.replace(/\s+/g, '');
        let sStr = submitted.replace(/\s+/g, '');
        if (sStr.length < cStr.length) sStr = sStr.padEnd(cStr.length, ' ');
        
        // 1. 정답의 글자별 개수 카운팅 맵 생성
        let correctFreq = {};
        for (let char of cStr) {
            correctFreq[char] = (correctFreq[char] || 0) + 1;
        }
        
        // 2. 정확히 제자리에 맞은 글자(검은색)는 미리 차감
        for (let i = 0; i < cStr.length; i++) {
            if (cStr[i] === sStr[i]) {
                correctFreq[cStr[i]]--;
            }
        }
        
        // 3. 남은 잉여 개수로 파란색(자리 틀림) 부여
        let correctCount = 0, htmlResult = '';
        for (let i = 0; i < cStr.length; i++) {
            if (cStr[i] === sStr[i]) { 
                correctCount++; 
                htmlResult += `<span>${sStr[i]}</span>`; 
            } else if (sStr[i] !== ' ' && sStr[i] !== 'X' && correctFreq[sStr[i]] && correctFreq[sStr[i]] > 0) {
                correctFreq[sStr[i]]--; // 사용된 글자는 개수 차감
                htmlResult += `<span style="color:#3498db; font-weight:bold;">${sStr[i]}</span>`;
            } else { 
                htmlResult += `<span class="wrong-char">${sStr[i] !== ' ' ? sStr[i] : 'X'}</span>`; 
            }
        }
        return { rate: Math.round((correctCount / cStr.length) * 100), correctCount: correctCount, totalCount: cStr.length, html: htmlResult };
    }
};

App.init(); 
