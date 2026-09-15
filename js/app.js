
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
                currentRound: 1,
                teacherFontSize: 30, // 기본 폰트 사이즈
                hintLimit: 1,    
                isLocked: false,
                timerEnd: null,
                currentEffect: null, 
                clearTrigger: 0 
            },
            groups: { "0": { dummy: true } },
            hintRequests: { "dummy": { dummy: true } }
        };
        dbRef.set(defaultData);
    },

    getData: () => {
        let data = App.localData;
        if (!data) return { settings: { groupCount: 6, passwords: {}, answers: {}, hintLimit:1, teacherFontSize: 30 }, groups: {}, hintRequests: {} };
        let cloned = JSON.parse(JSON.stringify(data));
        if (!cloned.groups) cloned.groups = {};
        if (!cloned.settings) cloned.settings = {};
        if (!cloned.settings.passwords) cloned.settings.passwords = {};
        if (!cloned.settings.answers) cloned.settings.answers = {};
        if (!cloned.hintRequests) cloned.hintRequests = {};
        return cloned;
    },

    saveData: (data) => {
        App.localData = JSON.parse(JSON.stringify(data)); 
        window.dispatchEvent(new Event('app-sync')); 
        dbRef.set(data); 
    },

    getSettings: () => App.getData().settings,
    
    saveSettings: (adminPw, groupCount, passwords, totalRounds, answers, hintLimit, tFontSize) => {
        const data = App.getData();
        data.settings.adminPassword = adminPw;
        data.settings.groupCount = groupCount;
        data.settings.passwords = passwords;
        data.settings.totalRounds = totalRounds;
        data.settings.answers = answers;
        data.settings.hintLimit = hintLimit;
        data.settings.teacherFontSize = tFontSize;
        if(data.settings.currentRound > totalRounds) data.settings.currentRound = 1;
        App.saveData(data);
    },

    // 사이드바 설정 실시간 저장 (글자 크기, 힌트 리밋)
    saveSettingsOnly: () => {
        const data = App.getData();
        data.settings.hintLimit = parseInt(document.getElementById('set-hint-limit').value) || 1;
        data.settings.teacherFontSize = document.getElementById('cctv-font-size').value;
        App.saveData(data);
    },

    setCurrentRound: (round) => {
        const data = App.getData();
        data.settings.currentRound = round;
        App.saveData(data);
    },

    setLock: (isLocked) => {
        const data = App.getData();
        data.settings.isLocked = isLocked;
        if(isLocked) data.settings.timerEnd = null; 
        App.saveData(data);
    },

    startTimer: (seconds) => {
        const data = App.getData();
        data.settings.timerEnd = Date.now() + (seconds * 1000);
        data.settings.isLocked = false; 
        App.saveData(data);
    },

    stopTimer: () => {
        const data = App.getData();
        data.settings.timerEnd = null;
        App.saveData(data);
    },
    
    playAlarm: () => {
        App.alarmAudio.play().catch(e => console.log("알람 자동재생 막힘"));
    },

    triggerEffect: (type, targetIds) => {
        const data = App.getData();
        data.settings.currentEffect = { type: type, targets: targetIds, ts: Date.now() };
        App.saveData(data);
    },

    triggerClearAll: () => {
        const data = App.getData();
        data.settings.clearTrigger = Date.now();
        App.saveData(data);
    },

    // 🌟 힌트 처리 로직
    orderHint: (groupId, type) => {
        const data = App.getData();
        if(!data.groups[groupId].usedHints) data.groups[groupId].usedHints = [];
        if(typeof data.groups[groupId].hintCount === 'undefined') data.groups[groupId].hintCount = 0;
        
        data.groups[groupId].usedHints.push(type);
        data.groups[groupId].hintCount++;

        const reqId = `req_${Date.now()}_${groupId}`;
        data.hintRequests[reqId] = { group: groupId, type: type, ts: Date.now(), status: 'pending', alerted: false };
        App.saveData(data);
    },

    getHintRequests: () => App.getData().hintRequests || {},

    processHint: (reqId, status) => {
        const data = App.getData();
        if(data.hintRequests[reqId]) {
            data.hintRequests[reqId].status = status;
            App.saveData(data);
        }
    },

    resetAllHints: () => {
        const data = App.getData();
        for(let key in data.groups) {
            data.groups[key].usedHints = [];
            data.groups[key].hintCount = 0;
        }
        data.hintRequests = { "dummy": { dummy: true } }; // 내역 싹 지우기
        App.saveData(data);
    },

    markHintAlerted: (reqId) => {
        const data = App.getData();
        if(data.hintRequests[reqId]) {
            data.hintRequests[reqId].alerted = true;
            App.saveData(data);
        }
    },

    getGroup: (groupId) => {
        const data = App.getData();
        if (!data.groups[groupId]) {
            data.groups[groupId] = { master: '', customName: '', members: [], membersData: {}, usedHints: [], hintCount: 0 };
        }
        if (!data.groups[groupId].usedHints) data.groups[groupId].usedHints = [];
        if (typeof data.groups[groupId].hintCount === 'undefined') data.groups[groupId].hintCount = 0;
        return data.groups[groupId];
    },
    
    joinMember: (groupId, name) => {
        const data = App.getData();
        if (!data.groups[groupId]) {
            data.groups[groupId] = { master: name, customName: '', members: [], membersData: {}, usedHints: [], hintCount: 0 };
        }
        if (!data.groups[groupId].members) data.groups[groupId].members = [];
        if (!data.groups[groupId].membersData) data.groups[groupId].membersData = {};
        if (!data.groups[groupId].usedHints) data.groups[groupId].usedHints = [];
        if (typeof data.groups[groupId].hintCount === 'undefined') data.groups[groupId].hintCount = 0;

        if (!data.groups[groupId].members.includes(name)) data.groups[groupId].members.push(name);
        if (!data.groups[groupId].membersData[name]) data.groups[groupId].membersData[name] = { type: 'pen', data: '', color: '#ffffff', size: 5 };
        if (!data.groups[groupId].master || !data.groups[groupId].members.includes(data.groups[groupId].master)) data.groups[groupId].master = name;
        App.saveData(data);
    },

    setMaster: (groupId, newMaster) => {
        const data = App.getData();
        if(data.groups[groupId]) { data.groups[groupId].master = newMaster; App.saveData(data); }
    },

    setGroupName: (groupId, customName) => {
        const data = App.getData();
        if (data.groups[groupId]) { data.groups[groupId].customName = customName; App.saveData(data); }
    },

    updateMemberBoard: (groupId, memberName, boardObj) => {
        const data = App.getData();
        if(!data.groups[groupId]) return;
        if(!data.groups[groupId].membersData) data.groups[groupId].membersData = {};
        if(!data.groups[groupId].membersData[memberName]) data.groups[groupId].membersData[memberName] = {};
        data.groups[groupId].membersData[memberName] = { ...data.groups[groupId].membersData[memberName], ...boardObj };
        App.saveData(data);
    },

    getAllGroups: () => App.getData().groups || {},
    
    clearAllBoards: () => {
        const data = App.getData();
        if(!data.groups) return;
        for (let key in data.groups) {
            if(data.groups[key].membersData) {
                for (let member in data.groups[key].membersData) {
                    data.groups[key].membersData[member].data = '';
                }
            }
        }
        App.saveData(data);
    },

    gradeAnswer: (correct, submitted) => {
        if (!correct || !submitted) return { rate: 0, html: '제출된 답이 없습니다.' };
        if (submitted.startsWith('data:image')) return { rate: 0, html: '📝 손글씨 모드 (자동채점 불가)' };
        const cStr = correct.replace(/\s+/g, '');
        let sStr = submitted.replace(/\s+/g, '');
        if (sStr.length < cStr.length) sStr = sStr.padEnd(cStr.length, ' ');
        let correctCount = 0, htmlResult = '';
        for (let i = 0; i < cStr.length; i++) {
            if (cStr[i] === sStr[i]) { correctCount++; htmlResult += `<span>${sStr[i]}</span>`; }
            else { htmlResult += `<span class="wrong-char">${sStr[i] !== ' ' ? sStr[i] : 'X'}</span>`; }
        }
        return { rate: Math.round((correctCount / cStr.length) * 100), correctCount: correctCount, totalCount: cStr.length, html: htmlResult };
    }
};

App.init(); 
