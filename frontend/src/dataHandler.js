import GlobalState, { ApiEndpoint } from './globalState';

import { openModal } from './components/Modal';

import { pushError } from './components/MessageDisplay';

import AbsenceModal from './components/modals/AbsenceModal';
import SubjectModal from './components/modals/SubjectModal';
import { getData, getHomework, getFromCache, fetchInst, pushHomeworkCompleted, refreshUser, getTimetable, getWeekStorageId, fetchedHW, getGrades, getNotes, getAbsences } from './api';
import { getWeekIndex, formatURLsHTML, sortByText, wait } from './util';
import { updateTT } from './view/Timetable';
import storage from './storage';
import {openGrade} from './components/modals/GradeModal';

export function openSubject(subject){
    openModal(subject.name,SubjectModal,subject,{
        mode:"wide"
    });
}

if (window.cordova){
    console.log("running in app");
}

export function homeworksCompleted(){
    return GlobalState.processedData.homeworksCompleted;
}

window.homeworksCompleted = homeworksCompleted;

export function getHWCompObjFArr(id,arr){
    id = id.toString();
    for (let p of arr){
        if (p.id == id){
            return p;
        }
    }
    return null;
}
function getHWCompObj(id){
    return getHWCompObjFArr(id,homeworksCompleted());
}

export function getHomeworkCompleted(id){
    return getHWCompObj(id)?.value == true;
}
window.getHomeworkCompleted = getHomeworkCompleted;

export function cleanHWC(arr = homeworksCompleted()){
    let ids = new Map();
    for (let i=0; i < arr.length; i++){
        let e = arr[i];
        if (!ids.has(e.id)){
            ids.set(e.id,[]);
        } else {
            ids.get(e.id).push(e);
        }
    }
    for (let [id,elems] of ids){
        let max = elems[0];
        for (let e in elems){
            if (e.changed > max.changed){
                max = e;
            }
        }
        for (let e in elems){
            if (e != max){
                arr.splice(arr.indexOf(max),1);
            }
        }
        
    }
}


window.cleanHWC = cleanHWC;
export function assignHomeworkCompletedState(id,assignState){
    
    id = id.toString();
    let state = getHWCompObj(id);
    let exists = true;
    if (state == null){
        exists = false;
        state = {id:id};
    }
    Object.assign(state,assignState);

    if (!exists){
        let arr = homeworksCompleted();
        arr.push(state);
    }
    cleanHWC();
    saveHWC();
    return state;
}
let scheduledSync = -1;
let HWCpushList = [];
export function beforePushHWC(change){
    HWCpushList.push(change);
    if (scheduledSync){
        clearTimeout(scheduledSync);
    }
    scheduledSync = setTimeout(()=>{
        if (navigator.onLine){
            cleanHWC(HWCpushList)
            syncHomeworkCompleted(HWCpushList);
            HWCpushList = [];
        }
    }, 500);
}
export function setHomeworkCompleted(id,value, sync = true){
    
    let result = assignHomeworkCompletedState(id,{
        changed: Date.now(),
        value:value,
    });

    if (sync){
        beforePushHWC(result);
    }
    
}
export function saveHWC(){
    localStorage.setItem("homeworksCompleted", JSON.stringify(homeworksCompleted()));
}
export function toggleHomeworkCompleted(id){
    console.log("toggling",id);
    return setHomeworkCompleted(id, !getHomeworkCompleted(id));
}
window.setHomeworkCompleted = setHomeworkCompleted;

export class NormalisedItem {

    obj=null;

    createDate;
    date;
    
    type="normal";
    
    key;

    header;
    icon;
    desc;

    displayState;

    onclick(){}

    map(map){
        for (let p in map){
            this[p] = this.obj[map[p]];
        }        
    }

    constructor(o) {
        this.obj = o;
        this.createDate = o.KeszitesDatuma;
        this.date = o.Datum || o.RogzitesDatuma;



        this.key = this.type+this.obj.Uid;
    }
}

export class Grade extends NormalisedItem {

    type="grade";
    value;
    textValue;
    teacher;
    theme;
    mode;
    normal=true;
    weight=null;
    gradeType;
    gradeTypeName;
    form;
    formName;
    subject;
    subjectId;
    

    onclick(){
        openGrade(this);
    }

    constructor(o) {
        super(o);
        this.map({
            value:"SzamErtek",
            teacher:"ErtekeloTanarNeve",
            form:"Jelleg",
            formName:"FormName",
            theme:"Tema",
            textValue:"SzovegesErtek",
            gradeType:"Type",
            gradeTypeName:"TypeName",
            weight:"SulySzazalekErteke",
        });
        this.formName = o.ErtekFajta?.Leiras;
        this.mode = o.Mod?.Leiras;
        this.subject = o.Tantargy?.Nev;
        this.subjectId = o.Tantargy?.Uid;
        if (this.form == "Magatartas" || this.form == "Szorgalom"){
            this.normal = false;
            if (this.subject == "Magatartas"){
                this.subject = "Magatartás";
            }
            if (this.textValue == "Jó" || this.textValue == "Példás"){
                this.icon = "fi/smile";
            } else {
                this.icon = "fi/frown";
            }
        } else {
            this.icon = "text/"+this.value;
        }
        if (!this.icon){
            this.icon = "#";
        }
        this.header = this.subject;
        this.desc = this.theme || this.mode || this.textValue;
        this.displayState = this.value;
    }
}

export class Absence extends NormalisedItem {

    type="absence";
    absenceTypeName;
    subject;
    lesson;
    delayMinutes;
    justified;
    justificationTypeName;

    isDelay(){
        return this.absenceType == "keses";
    }

    constructor(o) {
        super(o);
        this.map({
            /* absenceType:"Type",
            subject:"Subject",
            lesson:"NumberOfLessons",
            delayMinutes:"DelayTimeMinutes", */
            delayMinutes:"KesesPercben",
            teacher:"RogzitoTanarNeve"
        });
        this.absenceType = o.Tipus?.Nev;
        this.absenceTypeName = o.Tipus?.Leiras;
        this.subject = o.Tantargy?.Nev;
        this.lesson = o.Ora?.Oraszam;
        this.justificationTypeName = o.IgazolasTipusa?.Leiras;
        this.justified = o.IgazolasAllapota == "Igazolt";
        
        
    
        this.header = `${this.absenceTypeName} - ${this.justified ? `Igazolt (${this.justificationTypeName})` : 'Igazolatlan'}`;
        this.desc = `${this.lesson ? `${this.lesson || "#"}. Óra - `:''}${this.subject}${this.isDelay() ? `, ${this.delayMinutes} perc`:''}`;
        this.icon = "fi/clock";
        this.displayState = this.justified;
    }
}
export class AbsentDay extends Absence {

    absences = [];

    push(lesson){
        this.absences.push(lesson);
        this.absences.sort((a,b)=>{
            return a.lesson-b.lesson;
        })
        let lessons = this.absences.map((e)=>e.lesson);
        
        this.desc = `Érintett órák: ${lessons.join(", ")}`;
    }

    onclick(){
        openModal(`Hiányzások`,AbsenceModal,this);
    }

    constructor(o) {
        super(o);
        

        this.header = `${o.TypeName} - ${this.justified ? `Igazolt (${o.JustificationTypeName})` : 'Igazolatlan'}`;
        this.desc="";

        this.icon = "fi/clock";
        this.displayState = this.justified;
    }


}
import { openNote } from './components/modals/NoteModal';
export class Note extends NormalisedItem {
    type="note";
    
    title;
    content;
    teacher;
    noteType;

    onclick(){
        openNote(this);
        /* openModal(this.title,formatURLsHTML(this.content)); */
    }

    constructor(o) {
        super(o);
        this.map({
            title:"Cim",
            content:"Tartalom",
            teacher:"KeszitoTanarNeve",
        });
        this.noteType = o.Tipus?.Leiras;

        function shorten(text){
            let limit = 70;
            if (text.length > limit){
                let textarr = text.slice(0,limit).split(" ");
                textarr.pop();
                return textarr.join(" ")+"...";
            } else {
                return text;
            }
        }

        this.header = this.title;
        this.desc = shorten(this.content);
        this.icon = "fi/message-square";
    }
}

function updateArray(arr,n){
    arr.splice(0,arr.length);
    arr.push(...n);
}

export function getSubjectRounding(subject){
    let roundings = GlobalState.subjectRoundings || {};
    return (roundings[subject] || 50);
}
export function clearSubjectRoundings(){
    GlobalState.subjectRoundings = {};

    storage.removeItem("roundings");
}
window.clearSubjectRoundings = clearSubjectRoundings;
export function setSubjectRounding(subject, v){
    let d = GlobalState.subjectRoundings || {};
    d[subject] = v;
    GlobalState.subjectRoundings = Object.assign({},d);
    storage.setJSON("roundings", d);
}
window.setSubjectRounding = setSubjectRounding;

export function roundSubject(subject){
    let r = getSubjectRounding(subject.id)/100;
    let avg = subject.average;
    let roundAt = Math.floor(avg)+r;
    if (avg >= roundAt){
        return Math.ceil(avg);
    } else {
        return Math.floor(avg);
    } 
}
window.roundSubject = roundSubject;
export function calcAvg(subject, avgCalc = {}){
    let sum = 0;
    let count = 0;

    for (let [grade, c] of Object.entries(avgCalc)){
        sum += c * parseInt(grade);
        count+=c;
    }
    

    for (let grade of subject.grades){
        var w = grade.weight/100;
        if (grade.value > 0){
            sum += grade.value*w;
            count += w;
        }
    }
    return sum/count;
}
export function getAverage(){
    let sum = 0;
    let count = 0;
    for (let subject of GlobalState.processedData.subjects){
        let round = roundSubject(subject);
        if (!isNaN(round)){
            sum += round;
            count++;
        }
        
    }
    return sum / count;
}
window.getAverage = getAverage;

export var homeworkMap = new Map();
function processHomeworks(homeworks){
    let promises = [];
    let processed = [];
    let index = 0;
    let hadContent = !(GlobalState.processedData.homeworks.length == 0);
    for (let e of homeworks){
        index++;
        promises.push(new Promise(function(resolve,reject){
            
            if (storage.has(`data/homework/${e.id}`)){
                let hw = storage.getJSON(`data/homework/${e.id}`);
                e.homework = hw;
                if (!homeworkMap.has(e.id)){
                    homeworkMap.set(e.id,e);
                }
                processed.push(e);
                updateArray(GlobalState.processedData.homeworks,[...homeworkMap.values()]);

                if (!hw.IsMegoldva && navigator.onLine){
                    
                    setTimeout(()=>{
                        getHomework(e.id,true).then((result)=>{
                            e.homework = result;
                            homeworkMap.set(e.id,e);
                            updateArray(GlobalState.processedData.homeworks,[...homeworkMap.values()]);
                        })
                    },100);       
                }
            } else if (navigator.onLine) {
                getHomework(e.id).then((result)=>{
                    e.homework = result;
                    homeworkMap.set(e.id,e);
                    processed.push(e);
                    updateArray(GlobalState.processedData.homeworks,[...homeworkMap.values()]);
                    resolve(e);
                }).catch(()=>{
                    console.log("Couldn't get homework!",e);
                    resolve();
                })
            }
        }));
    }
    Promise.all(promises).then((values)=>{
        if (homeworks.length != processed.length){
            pushError("Nem sikerült minden házit lekérni");
        }
        updateArray(GlobalState.processedData.homeworks,[...homeworkMap.values()]);
    })
}

let weekReactiveRequested = [];
export function getWeekReactive(i){
    let weeksAfter = i;
    let {first, last} = getWeekIndex(i);
    let o = {
        first,last,
        week:first.toDateString(),
        active:i==0,
        days:[]
    };
    let id = getWeekStorageId(weeksAfter);
    if (getFromCache(id)){
        o.days = getWeekDaysTT(getFromCache(id));
    }

    if (navigator.onLine && !weekReactiveRequested.includes(i) ){
        weekReactiveRequested.push(i);
        getTimetable(i).then((d)=>{
            updateArray(o.days,getWeekDaysTT(d));
        })
    }
    return o;
}
window.getWeekReactive = getWeekReactive;

export function getWeekDaysTT(lessons){
    let daysMap = {};
    for (let e of lessons){
        
        let day = (new Date(e.Datum)).toDateString();
        if (!daysMap[day]){
            daysMap[day] = {
                day,
                date:e.Datum,
                lessons:[]
            };
        }
        daysMap[day].lessons.push(e);
    }
    
    let days = Object.values(daysMap);
    for (let day of days){
        day.lessons.sort((a,b)=>{
            return new Date(a.KezdetIdopont) - new Date(b.KezdetIdopont);
        })
    }
    return Object.values(daysMap).sort((a,b)=>{
        return new Date(a.date) - new Date(b.date);
    });
}
window.getWeekDaysTT = getWeekDaysTT;
function processTimetable(result){
    if (result){
        let list = GlobalState.lessonsList = result;

        
        let days = getWeekDaysTT(list);
        for (let day of days){
            day.lessons.sort((a,b)=>{
                return new Date(a.StartTime) - new Date(b.StartTime);
            })
        }

        let weeksMap = {};
        for (let e of days){
            let date = new Date(e.day);
            
            let current = date.getDay() - 1;
            if (current == -1){
                current = 6;
            }
            let first = date.getDate() - current;
            let last = first + 6;

            first = new Date(date.setDate(first));
            last = new Date(date.setDate(last));

            

            let week = first.toDateString();

            let active = first < new Date() && new Date() < last;

            if (!weeksMap[week]){
                weeksMap[week] = {
                    week,
                    first,
                    last,
                    active,
                    days:[]
                }
            }
            weeksMap[week].days.push(e);
        }
        let weeks = Object.values(weeksMap);
        for (let week of weeks){
            week.days.sort((a,b)=>{
                return new Date(a.day) - new Date(b.day);
            })
        }

        updateArray(GlobalState.processedData.timetable.weeks, weeks);
    }
}


class Subject {
    name;
    average=NaN;
    grades = [];
    id;
    constructor(id,name){
        this.name = name;
        this.id = id;
    }
}
function processGenericList(list, id, _class) {
    var proc = list.map(e=>new _class(e));
    
    if (GlobalState.rawData[id] === undefined){
        GlobalState.rawData[id] = [];
    }
    updateArray(GlobalState.rawData[id],list);
    updateArray(GlobalState.processedData[id],proc);
    

    if (id == "grades"){
        var subjects = {}
        proc.forEach(e=>{
            if(!subjects[e.subjectId]){
                subjects[e.subjectId] = new Subject(e.subjectId,e.subject);
            }
            subjects[e.subjectId].grades.push(e);
        });
        var endlist = Object.values(subjects);
        endlist.map(e=>e.average = calcAvg(e));
        

        updateArray(
            GlobalState.processedData.subjects,
            endlist
            .sort((a,b)=>sortByText(a.name,b.name))
                .sort((a,b)=>isNaN(a.average)-isNaN(b.average))    
        )
    }
}
class Homework {
    constructor(json){
        Object.assign(this,json);
    }
}
var dataLists = [
    {
        get:getGrades,
        id:"grades",
        class:Grade
    },
    {
        get:getNotes,
        id:"notes",
        class:Note
    },
    {
        get:getAbsences,
        id:"absences",
        class:Absence
    },
    {
        get:getHomeworks,
        id:"homeworks",
        class:Homework
    }
]
function updateLists(fetch) {
    return Promise.all(dataLists.map(l=>{
        return updateList(l.id,fetch);
    }));
}

function updateList(list, fetch){
    var lists = dataLists;
    
    for (let i = 0; i < lists.length; i++) {
        const e = lists[i];

        if (e.id != list){
            continue;
        }

        function process(d){
            processGenericList(d,e.id,e.class);
        }
        
        if (fetch){
            return new Promise((rs,rj)=>{
                e.get().then(d=>{
                    process(d);
                    rs();
                }).catch(rj);
            })
            
        } else {
            if (storage.has("data/"+e.id)){
                process(storage.getJSON("data/"+e.id));
            }
            return new Promise(r=>r());
        }
        
    }
    return new Promise((_,r)=>r("No such list"));
}
window.updateList = updateList;
function afterLogin(){
    let online = navigator.onLine;
    
    setImmediate(()=>{
        if (storage.has("data/studentinfo")){
            GlobalState.studentInfo = storage.getJSON("data/studentinfo");
        }
        updateLists(false);
        if (online){
            refreshUser().then(()=>{
                console.log("[afterlogin] refreshed user");

                
                getStudentInfo().then(d=>{
                    GlobalState.studentInfo = d;
                })
                
                updateLists(true).then(()=>{
                    console.log("All data successfully fetched");
                })
                
            })
        }
        
    })
}

export function refreshPage(page){
    if (!navigator.onLine){
        console.log("offline, not refreshing");
        pushError("Nincs internet");
        return new Promise(r=>r());
    }
    let actions = [
        {
            pages:["timeline"],
            action(){
                return Promise.all([
                    updateList("grades",true),
                    updateList("notes",true),
                    updateList("absences",true)
                ]);
            }
        },
        {
            pages:["more"],
            action(){
                return getStudentInfo().then(d=>{
                    GlobalState.studentInfo = d;
                });
            }
        },
        {
            pages:["more/halfyr", "avgs"],
            action(){
                return updateList("grades",true);
            }
        },
        {
            pages:["timetable"],
            action(){
                return new Promise(r=>r()); // TODO timetable refresh
            }
        },
        {
            pages:["homework"],
            action(){
                return updateList("homeworks",true);
            }
        }
    ]
    var promises = [new Promise(r=>r())];
    for (let a of actions){
        if (a.pages.includes(page)){
            promises.push(a.action());
        }
    }
    var time = Date.now();
    
    return Promise.all([
        new Promise((resolve,reject)=>{
            Promise.all(promises).then(()=>{
                var now = Date.now();
                console.log("Refreshed page in",now-time);
                resolve();
            }).catch(resolve);
        }),
        wait(1000)
    ]);
}

export function getInst(){
    let items = [];

    function map(arr){
        return arr.map((e)=>({
            code:e.InstituteCode,
            name:e.Name,
            city:e.City
        }));
    }
    
    let call = getFromCache("institute");
    if (call){
        setImmediate(()=>{
            updateArray(items, map(call.data));
        })
    }

    if (navigator.onLine){
        fetchInst().then(function(result){
            if (result){
                updateArray(items, map(result));
            }
        });   
    }
    

    return items;
}
window.getInst = getInst;

class User {
    loggedIn=false;
    creds = null;

    constructor(creds){
        this.update(creds);
    }
    update(creds){
        this.creds = creds;
        this.loggedIn = this.creds ? true : false;
    }
}
let currentUser = new User(null);

export {
    currentUser,
    User,
    afterLogin,
};