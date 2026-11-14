// 每周七天，每天上午／下午两个时段；历史计划与课程解锁进度一起存档。
const plannerActivities=[
 {id:'jp-basic',group:'study',icon:'📗',name:'初级日语 · 日常会话',energy:-14,study:5,social:2},
 {id:'jp-mid',group:'study',icon:'📘',name:'中级日语 · 阅读写作',energy:-18,study:7,skill:2},
 {id:'jp-advanced',group:'study',icon:'📕',name:'高级日语 · 深度表达',energy:-22,study:9,skill:3},
 ...['N5','N4','N3','N2','N1'].map((level,i)=>({id:'jlpt-'+level,group:'study',icon:'📝',name:'JLPT '+level+' 备考',energy:-(12+i*3),study:4+i,skill:1})),
 {id:'listening',group:'study',icon:'🎧',name:'日语听力与跟读',energy:-10,study:4,social:1},
 {id:'english',group:'study',icon:'🔤',name:'英语交流',energy:-14,study:3,social:3},
 {id:'coding',group:'study',icon:'💻',name:'编程入门',energy:-18,skill:6,study:2},
 {id:'design',group:'study',icon:'🎨',name:'设计与插画',energy:-15,skill:5},
 {id:'photo',group:'study',icon:'📷',name:'摄影练习',energy:-12,skill:4,health:1},
 {id:'cooking',group:'study',icon:'🍳',name:'料理练习',energy:-10,skill:3,health:3,money:-100},
 {id:'finance',group:'study',icon:'📊',name:'理财基础',energy:-12,study:3,skill:3},
 {id:'speaking',group:'study',icon:'🎤',name:'表达与演讲',energy:-12,social:5,skill:2},
 {id:'park',group:'fun',icon:'🌳',name:'公园散步',energy:18,health:4},
 {id:'mall',group:'fun',icon:'🛍️',name:'商场闲逛',energy:10,social:2,money:-200},
 {id:'coffee',group:'fun',icon:'☕',name:'咖啡馆小憩',energy:22,money:-150},
 {id:'movie',group:'fun',icon:'🎬',name:'电影院看电影',energy:20,study:1,money:-200},
 {id:'museum',group:'fun',icon:'🏛️',name:'美术馆看展',energy:10,study:3,skill:2,money:-100},
 {id:'bookstore',group:'fun',icon:'📚',name:'书店寻宝',energy:12,study:3},
 {id:'karaoke',group:'fun',icon:'🎵',name:'朋友卡拉 OK',energy:15,social:5,money:-250},
 {id:'onsen',group:'fun',icon:'♨️',name:'温泉放松',energy:35,health:5,money:-400},
 {id:'gym',group:'fun',icon:'🏃',name:'慢跑与健身',energy:-10,health:8},
 {id:'river',group:'fun',icon:'🌇',name:'河畔看日落',energy:20,health:2},
 {id:'picnic',group:'fun',icon:'🧺',name:'周末野餐',energy:18,health:3,social:2,money:-100},
 {id:'games',group:'fun',icon:'🎮',name:'在家玩游戏',energy:25},
 {id:'sleep',group:'fun',icon:'💤',name:'在家休息',energy:35,health:5},
 {id:'festival',group:'fun',icon:'🏮',name:'街区祭典',energy:8,social:5,money:-150}
];
const weekNames=['周一','周二','周三','周四','周五','周六','周日'];
let plannerCategory='study';
let plannerSelected=null;
const monthLength=month=>[31,28,31,30,31,30,31,31,30,31,30,31][month-1];
const periodNames=['上午','下午'];
function currentPlannerSlot(){return S.calendarTick*2+S.period}
function ensurePlanner(){
 if(!Number.isInteger(S.day))S.day=1;
 if(!Number.isInteger(S.calendarTick))S.calendarTick=0;
 if(S.period!==0&&S.period!==1)S.period=0;
 if(!S.planner||typeof S.planner!=='object')S.planner={entries:{}};
 if(!S.planner.entries||typeof S.planner.entries!=='object')S.planner.entries={};
 if(S.planner.version!==2){
  const entries={};
  for(const [day,entry] of Object.entries(S.planner.entries)){
   if(!/^\d+$/.test(day)||!entry||typeof entry!=='object')continue;
   entries[Number(day)*2]={...entry,id:entry.id==='jp-start'?'jp-basic':entry.id};
  }
  S.planner={version:2,entries,basicPracticeSlots:Object.entries(entries).filter(([,entry])=>entry.id==='jp-basic').map(([slot])=>Number(slot))};
 }
 delete S.planner.mode;
 if(!Array.isArray(S.planner.basicPracticeSlots))S.planner.basicPracticeSlots=[];
 S.planner.basicPracticeSlots=[...new Set(S.planner.basicPracticeSlots.filter(slot=>Number.isInteger(slot)&&slot>=0))];
 ensureLifeSystems();
 if(plannerSelected===null||plannerSelected<currentPlannerSlot())plannerSelected=currentPlannerSlot();
}
function basicJapaneseCount(){return Math.min(8,S.planner.basicPracticeSlots.length)}
function isActivityLocked(activity){
 if(activity.id==='jp-advanced')return courseCompletedCount('jp-mid')<8;
 return (activity.id==='jp-mid'||activity.id.startsWith('jlpt-')||activity.id==='listening')&&basicJapaneseCount()<8;
}
function plannerDate(tick){
 let month=S.month,day=S.day+tick-S.calendarTick;
 while(day<1){month=month===1?12:month-1;day+=monthLength(month)}
 while(day>monthLength(month)){day-=monthLength(month);month=month===12?1:month+1}
 return {month,day};
}
function plannerRange(){
 const start=Math.floor(S.calendarTick/7)*7;
 return Array.from({length:7},(_,i)=>start+i);
}
function plannerSlots(){return plannerRange().flatMap(day=>[day*2,day*2+1])}
function activityEffects(a){
 return [['energy','精力'],['study','学识'],['skill','技能'],['social','社交'],['health','健康'],['money','资金']].filter(([key])=>a[key]).map(([key,label])=>label+(a[key]>0?'+':'')+a[key]+(key==='money'?'円':'')).join(' · ');
}
function selectPlannerSlot(slot){
 if(slot<currentPlannerSlot()||!plannerSlots().includes(slot))return;
 plannerSelected=slot;renderActions();
}
function setPlannerCategory(category){plannerCategory=category==='fun'?'fun':'study';renderActions()}
function assignPlannerActivity(id){
 ensurePlanner();if(S.ending)return;
 const activity=plannerActivities.find(a=>a.id===id);
 if(!activity||!plannerSlots().includes(plannerSelected)||plannerSelected<currentPlannerSlot())return;
 if(S.planner.entries[plannerSelected]?.system){toast('考试和养病属于系统固定时段，不能替换。');return}
 if(isActivityLocked(activity)){toast(activity.id==='jp-advanced'?'先实际完成中级日语 8 次。':'先在 8 个不同时段安排初级日语，再学习后续日语课程。');return}
 S.planner.entries[plannerSelected]={id};
 if(id==='jp-basic'&&!S.planner.basicPracticeSlots.includes(plannerSelected))S.planner.basicPracticeSlots.push(plannerSelected);
 const next=plannerSlots().find(slot=>slot>plannerSelected&&!S.planner.entries[slot]);
 if(next!==undefined)plannerSelected=next;
 renderActions();save(false);
}
function clearPlannerDay(){
 ensurePlanner();if(S.ending||plannerSelected<currentPlannerSlot()||S.planner.entries[plannerSelected]?.system)return;
 delete S.planner.entries[plannerSelected];renderActions();save(false);
}
function renderActions(){
 ensurePlanner();
 const days=plannerRange();if(!plannerSlots().includes(plannerSelected))plannerSelected=currentPlannerSlot();
 const selectedDate=plannerDate(Math.floor(plannerSelected/2)),locked=!!S.ending;
 const firstDate=plannerDate(days[0]),lastDate=plannerDate(days[6]);
 const slotHtml=days.map(day=>{
  const date=plannerDate(day);
  return `<div class="schedule-day"><div class="day-heading"><strong>${weekNames[((day%7)+7)%7]}</strong><span>${date.month}/${date.day}${day===S.calendarTick?' · 今天':''}</span></div><div class="day-slots">${[0,1].map(period=>{
   const slot=day*2+period,entry=S.planner.entries[slot],activity=plannerActivities.find(a=>a.id===entry?.id);
   const fixedLabel=entry?.id==='exam'?'🎓 JLPT 考试':entry?.id==='sick'?'🤒 生病休息':null;
   return `<button class="schedule-slot" data-slot="${slot}" aria-label="${weekNames[((day%7)+7)%7]}${periodNames[period]}" aria-pressed="${slot===plannerSelected}" ${slot<currentPlannerSlot()||locked||entry?.system?'disabled':''} onclick="selectPlannerSlot(${slot})"><strong>${periodNames[period]}${slot===currentPlannerSlot()?'<i class="now-mark">当前</i>':''}</strong><span>${entry?.done?'✓ ':''}${fixedLabel|| (activity?activity.icon+' '+activity.name:slot<currentPlannerSlot()?'已过去':'＋ 待安排')}</span></button>`;
  }).join('')}</div><div class="daily-rest">🌙 夜间固定休息 · 精力 +${DAILY_ENERGY_RECOVERY}</div></div>`;
 }).join('');
 document.getElementById('actions').innerHTML=`
 <p class="planner-clock">第 ${Math.floor(S.calendarTick/7)+1} 周 · 第${S.year}年${S.month}月${S.day}日 ${periodNames[S.period]}<small>本周 ${firstDate.month}/${firstDate.day} — ${lastDate.month}/${lastDate.day}</small></p>
 ${renderExamPanel()}
 <div class="planner-grid">
  <section class="schedule-board" aria-label="周安排">
   <h3 class="planner-heading">周安排 · 每天两格</h3>
   <div class="schedule-list">${slotHtml}</div>
   <div class="planner-tools"><button class="secondary" onclick="clearPlannerDay()" ${locked?'disabled':''}>清空选中格</button><button class="primary" id="executePlan" onclick="executePlannerDay()" ${locked||S.currentEvent?'disabled':''}>执行${periodNames[S.period]}</button></div>
  </section>
  <section class="activity-board" aria-label="可选活动">
   <h3 class="planner-heading">活动清单</h3>
   <div class="planner-tabs" aria-label="活动分类"><button aria-pressed="${plannerCategory==='study'}" onclick="setPlannerCategory('study')">学习</button><button aria-pressed="${plannerCategory==='fun'}" onclick="setPlannerCategory('fun')">娱乐</button></div>
   <p class="planner-selection">选中 ${selectedDate.month}月${selectedDate.day}日 ${periodNames[plannerSelected%2]}<br>点击活动填入左侧</p>
   ${plannerCategory==='study'?`<div class="course-progress">初级日语 ${basicJapaneseCount()} / 8 次<progress value="${basicJapaneseCount()}" max="8" aria-label="初级日语安排进度"></progress><small>${basicJapaneseCount()>=8?'中级与备考已解锁':'安排满 8 个时段解锁中级与备考'}<br>初级实际完成：${courseCompletedCount('jp-basic')} / 8 次（N5合格条件）</small></div>`:''}
   <div class="activity-list">${plannerActivities.filter(a=>a.group===plannerCategory).map(a=>{
    const courseLocked=isActivityLocked(a);
    return `<button class="activity-card ${courseLocked?'course-locked':''}" data-activity="${a.id}" onclick="assignPlannerActivity('${a.id}')" ${locked||courseLocked?'disabled':''}><b>${a.icon} ${a.name}${courseLocked?' 🔒':''}</b><small>${courseLocked?(a.id==='jp-advanced'?'实际完成中级日语 8 次后解锁':'初级日语安排满 8 次后解锁'):activityEffects(a)}</small></button>`;
   }).join('')}</div>
  </section>
 </div>
 <p class="planner-status" role="status">${S.ending?'人生已结束，可查看和回顾计划。':S.currentEvent?'有事件待选择，请先<button onclick="openSection(\'section-story\')">前往人生进程 →</button>':`精力 ${S.energy}% · 资金 ${S.money}円。每格执行一次，上午完成后进入下午，下午完成后进入次日；每天夜间固定恢复20点精力；降到−10会强制跳过7天养病。`}</p>
 <details class="other-actions"><summary>工作与生活 · 保留原有行动</summary><div class="grid2">${[['work','💼','打工兼职'],['startup','🚀','推进创业'],['social','☕','社交交友'],['explore','🗺️','探索城市']].map(([id,icon,name])=>`<button class="action" onclick="actionByKey('${id}')" ${locked||S.currentEvent?'disabled':''}><b>${icon} ${name}</b></button>`).join('')}</div></details>`;
}
function executePlannerDay(){
 ensurePlanner();if(S.ending)return;
 if(S.currentEvent){toast('先处理人生进程中的事件。');return}
 if(executeFixedExam())return;
 const slot=currentPlannerSlot(),entry=S.planner.entries[slot];
 const activity=plannerActivities.find(a=>a.id===entry?.id)||plannerActivities.find(a=>a.id==='sleep');
 if(isActivityLocked(activity)){toast('这门日语课程尚未解锁，请先安排初级日语 8 次。');return}
 if(activity.money<0&&S.money<-activity.money){toast('资金不足，可以换成免费活动。');return}
 if(activity.energy<0&&!spend(-activity.energy))return;
 if(activity.energy>0)S.energy=clamp(S.energy+activity.energy,-10,100);
 for(const key of ['study','skill','social','health'])if(activity[key])S[key]=statValue(key,S[key]+activity[key]);
 if(activity.money)S.money+=activity.money;
 S.planner.entries[slot]={id:activity.id,done:true};
 const time=`${S.month}月${S.day}日 ${periodNames[S.period]}`;
 advance(`${time} · 行程完成：${activity.name}。${activityEffects(activity)}`);
 plannerSelected=currentPlannerSlot();
 if(S.autoEventPending){S.autoEventPending=false;triggerEvent(true)}
 render();maybeEnding();save(false);
}
