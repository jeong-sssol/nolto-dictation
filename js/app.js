
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

// 2. Firebase 초기화
firebase.initializeApp(firebaseConfig);
const db = firebase.database();
const dbRef = db.ref('nolto_data_v9');

// 3. App 객체
const App = {
    localData: null,
    
    init: () => {
        // 서버에서 값이 바뀔 때마다 실시간 감지
        dbRef.on('value', (snapshot) => {
            const data = snapshot.val();
            if (data) {
                // 🔥 Firebase가 빈 폴더를 지워버리는 현상 완벽 방어
                if (!data.groups) data.groups = {};
                if (!data.settings) data.settings = {};
                if (!data.settings.passwords) data.settings.passwords = {};
                if (!data.settings.answers) data.settings.answers = {};
                
                App.localData = data;
                window.dispatchEvent(new Event('app-sync')); 
                
                // 학생 화면 셀렉트 박스 동기화 (모둠 수가 변경되었을 때만)
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
                // 데이터가 아예 없으면 초기화 실행
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
                teacherFontSize: 24,
                isLocked: false,
                timerEnd: null,
                currentEffect: null, 
                clearTrigger: 0 
            },
            groups: {
                "0": { dummy: true } // 파이어베이스 삭제 방지용 더미
            }
        };
        dbRef.set(defaultData);
    },

    getData: () => {
        let data = App.localData;
        if (!data) {
            return {
                settings: { adminPassword: '1234', groupCount: 6, passwords: {}, totalRounds: 3, answers: {}, currentRound: 1, teacherFontSize: 24, isLocked: false, timerEnd: null, currentEffect: null, clearTrigger: 0 },
                groups: {}
            };
        }
        // 원본 데이터를 보호하기 위해 복사본 리턴
        let cloned = JSON.parse(JSON.stringify(data));
        if (!cloned.groups) cloned.groups = {};
        if (!cloned.settings) cloned.settings = {};
        if (!cloned.settings.passwords) cloned.settings.passwords = {};
        if (!cloned.settings.answers) cloned.settings.answers = {};
        return cloned;
    },

    saveData: (data) => {
        // Optimistic UI Update: 서버 응답을 기다리지 않고 화면을 먼저 0.001초 만에 갱신
        App.localData = JSON.parse(JSON.stringify(data)); 
        window.dispatchEvent(new Event('app-sync')); 
        
        // 서버에는 백그라운드로 전송
        dbRef.set(data); 
    },

    getSettings: () => App.getData().settings,
    
    saveSettings: (adminPw, groupCount, passwords, totalRounds, answers, tFontSize) => {
        const data = App.getData();
        data.settings.adminPassword = adminPw;
        data.settings.groupCount = groupCount;
        data.settings.passwords = passwords;
        data.settings.totalRounds = totalRounds;
        data.settings.answers = answers;
        data.settings.teacherFontSize = tFontSize;
        if(data.settings.currentRound > totalRounds) data.settings.currentRound = 1;
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

    triggerEffect: (type, targetIds) => {
        const data = App.getData();
        data.settings.currentEffect = {
            type: type, 
            targets: targetIds, 
            ts: Date.now()
        };
        App.saveData(data);
    },

    triggerClearAll: () => {
        const data = App.getData();
        data.settings.clearTrigger = Date.now();
        App.saveData(data);
    },

    getGroup: (groupId) => {
        const data = App.getData();
        if (!data.groups[groupId]) {
            data.groups[groupId] = { master: '', customName: '', members: [], membersData: {} };
        }
        if (!data.groups[groupId].members) data.groups[groupId].members = [];
        if (!data.groups[groupId].membersData) data.groups[groupId].membersData = {};
        return data.groups[groupId];
    },
    
    joinMember: (groupId, name) => {
        const data = App.getData();
        if (!data.groups[groupId]) {
            data.groups[groupId] = { master: name, customName: '', members: [], membersData: {} };
        }
        if (!data.groups[groupId].members) data.groups[groupId].members = [];
        if (!data.groups[groupId].membersData) data.groups[groupId].membersData = {};

        if (!data.groups[groupId].members.includes(name)) {
            data.groups[groupId].members.push(name);
        }
        if (!data.groups[groupId].membersData[name]) {
            data.groups[groupId].membersData[name] = { type: 'pen', data: '', color: '#ffffff', size: 5 };
        }
        if (!data.groups[groupId].master || !data.groups[groupId].members.includes(data.groups[groupId].master)) {
            data.groups[groupId].master = name;
        }
        App.saveData(data);
    },

    setMaster: (groupId, newMaster) => {
        const data = App.getData();
        if(data.groups[groupId]) {
            data.groups[groupId].master = newMaster;
            App.saveData(data);
        }
    },

    setGroupName: (groupId, customName) => {
        const data = App.getData();
        if (data.groups[groupId]) {
            data.groups[groupId].customName = customName;
            App.saveData(data);
        }
    },

    updateMemberBoard: (groupId, memberName, boardObj) => {
        const data = App.getData();
        if(!data.groups[groupId]) return;
        if(!data.groups[groupId].membersData) data.groups[groupId].membersData = {};
        
        if(!data.groups[groupId].membersData[memberName]) {
            data.groups[groupId].membersData[memberName] = {};
        }
        data.groups[groupId].membersData[memberName] = { 
            ...data.groups[groupId].membersData[memberName], 
            ...boardObj 
        };
        App.saveData(data);
    },

    getAllGroups: () => {
        const data = App.getData();
        return data.groups || {};
    },
    
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
            if (cStr[i] === sStr[i]) {
                correctCount++;
                htmlResult += `<span>${sStr[i]}</span>`;
            } else {
                htmlResult += `<span class="wrong-char">${sStr[i] !== ' ' ? sStr[i] : 'X'}</span>`;
            }
        }
        return {
            rate: Math.round((correctCount / cStr.length) * 100),
            correctCount: correctCount,
            totalCount: cStr.length,
            html: htmlResult
        };
    }
};

App.init(); // 스크립트 실행 시 즉시 Firebase 리스닝 시작
