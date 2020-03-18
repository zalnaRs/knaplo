Vue.component('k-recent', {
    props: {
      recent: {
          type: Object,
          required: true,
      },
      ignoremode : {
          type: Boolean,
          required: false
      }
    },
    data(){
        return {};
    },
    methods: {
        expandNote(note){
            data.viewedNote = Object.assign(data.viewedNote, JSON.parse(JSON.stringify(note)));
            data.viewedNote.show = true;
        },
        checkShowRecent(mode){
            return data.recentMode == "all" || data.recentMode == mode;
        },
        shortenNote(text){
            let limit = 70;
            if (text.length > limit){
                let textarr = text.slice(0,limit).split(" ");
                textarr.pop();
                return textarr.join(" ")+"...";
            } else {
                return text;
            }
        },
        formatDate,
        getDayOfWeek,
    },
    template: /* html */`
    <span v-show="checkShowRecent(recent.recentType) || ignoremode">
        <div v-if="recent.recentType == 'grade'" class="grade gradeLike recent">
            <span class="left" :data-grade="recent.value">
                {{ recent.value }}
            </span>
            <span class="right">
                <div class="header">
                    {{ recent.subject }}
                </div>
                <span class="bottom">{{ recent.theme ? recent.theme : recent.mode }}</span>
            </span>
            <span class="date"><b>{{ getDayOfWeek(new Date(recent.date)) }}</b><br><i>{{ formatDate(new Date(recent.date)) }}</i></span>
        </div>
        <div v-if="recent.recentType == 'absence'" class="absence gradeLike recent" v-bind:class="{ justified: recent.justified }">
            <span class="left" :data-grade="recent.value">
                <svg class="feather">
                    <use xlink:href="/node_modules/feather-icons/dist/feather-sprite.svg#clock"/>
                </svg>
            </span>
            <span class="right">
                <div class="header">
                    {{ recent.TypeName }} - 
                    <span v-if="recent.justified">Igazolt ({{ recent.JustificationTypeName }})</span>
                    <span v-if="!recent.justified">Igazolatlan</span>
                </div>
                <span class="bottom">
                    <span v-if="recent.Type=='AbsentDay'">Érintett órák: {{ recent.lessons.join(", ") }}</span>
                    <span v-if="recent.Type!='AbsentDay'">{{ recent.NumberOfLessons }}. Óra - {{ recent.Subject }}<i v-if="recent.Type=='Delay'">, {{ recent.DelayTimeMinutes }} perc</i></span>
                </span>
            </span>
            <span class="date"><b>{{ getDayOfWeek(new Date(recent.date)) }}</b><br><i>{{ formatDate(new Date(recent.date)) }}</i></span>
        </div>
        <div v-if="recent.recentType == 'note'" class="note gradeLike recent" v-on:click="expandNote(recent)">
            <span class="left" :data-grade="recent.value">
                <svg class="feather">
                    <use xlink:href="/node_modules/feather-icons/dist/feather-sprite.svg#message-square"/>
                </svg>
            </span>
            <span class="right">
                <div class="header">
                    {{ recent.Title }}
                </div>
                <span class="bottom">
                    {{ shortenNote(recent.Content) }}        
                </span>
            </span>
            
            



            <span class="date"><b>{{ getDayOfWeek(new Date(recent.date)) }}</b><br><i>{{ formatDate(new Date(recent.date)) }}</i></span>
            
        </div>
    </span>
    `
})