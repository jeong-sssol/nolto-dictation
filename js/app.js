// 1. Firebase 설정 (선생님의 고유 열쇠)
const firebaseConfig = {
    apiKey: "AIzaSyBC1SxIW-8_RuDojcEv8vXpRqs0qEVGrEA",
    authDomain: "nolto-dictation.firebaseapp.com",
    databaseURL: "https://nolto-dictation-default-rtdb.firebaseio.com",
    projectId: "nolto-dictation",
    storageBucket: "nolto-dictation.firebasestorage.app",
    messagingSenderId: "490060326215",
    appId: "1:490060326215:web:7f4e511b6df2587f819862"
};

// 2. Firebase 초기화 및 연결
firebase.initializeApp(firebaseConfig);
const db = firebase.database();
const dbRef = db.ref('nolto_data_v9'); // 데이터베이스 저장 공간 이름

// 3. App 객체 (localStorage에서 Firebase 실시간 통신으로 완벽 대체)
const App = {
    localData: null,
    
    init: () => {
        // Firebase 실시간 동기화 감지 (데이터가 변할 때마다 즉시 작동!)
        dbRef.on('value', (snapshot) => {
            const data = snapshot.val();
            if (data) {
                App.localData = data;
                window.dispatchEvent(new Event('app-sync')); 
                
                // (방어 코드) 최초 접속 시 학생 화면의 모둠 개수를 동기화
                const groupSelect = document.getElementById('group-select');
                if (groupSelect && groupSelect.options.length !== data.settings.groupCount) {
                    groupSelect.innerHTML = '';
                    for(let i=1; i<=data.settings.groupCount; i++) {
                        groupSelect.innerHTML += `<option value="${i}">${i} 모둠</option>`;
                    }
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
                teacherFontSize: 24,
                isLocked: false,
                timerEnd: null,
                currentEffect: null, 
                clearTrigger: 0 
            },
            groups: {}
        };
        dbRef.set(defaultData); // Firebase 서버에 초기화 데이터 전송
    },

    // 데이터를 가져오는 중 에러가 나지 않도록 뼈대를 유지
    getData: () => App.localData || {
        settings: { adminPassword: '1234', groupCount: 6, passwords: {}, totalRounds: 3, answers: {}, currentRound: 1, teacherFontSize: 24, isLocked: false, timerEnd: null, currentEffect: null, clearTrigger: 0 },
        groups: {}
    },

    saveData: (data) => {
        dbRef.set(data); // 로컬 저장소 대신 Firebase 서버에 저장
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
        return data.groups[groupId];
    },
    
    joinMember: (groupId, name) => {
        const data = App.getData();
        if (!data.groups[groupId]) {
            data.groups[groupId] = { master: name, customName: '', members: [], membersData: {} };
        }
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
        data.groups[groupId].master = newMaster;
        App.saveData(data);
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
        if(!data.groups[groupId].membersData[memberName]) {
            data.groups[groupId].membersData[memberName] = {};
        }
        data.groups[groupId].membersData[memberName] = { 
            ...data.groups[groupId].membersData[memberName], 
            ...boardObj 
        };
        App.saveData(data);
    },

    getAllGroups: () => App.getData().groups,
    
    clearAllBoards: () => {
        const data = App.getData();
        for (let key in data.groups) {
            for (let member in data.groups[key].membersData) {
                data.groups[key].membersData[member].data = '';
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

App.init(); // 스크립트가 로드되자마자 Firebase 감지 시작!