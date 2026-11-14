// 游戏内的简化日历与考试规则，不对应现实考试的报名或出分日期。
const DAILY_ENERGY_RECOVERY=20;
const JLPT_REQUIREMENTS={
 N5:[['jp-basic',8]],
 N4:[['jp-basic',8],['jp-mid',8]],
 N3:[['jp-basic',8],['jp-mid',8],['jp-advanced',8]],
 N2:[['jp-basic',8],['jp-mid',8],['jp-advanced',8],['jlpt-N2',8]],
 N1:[['jp-basic',8],['jp-mid',8],['jp-advanced',8],['jlpt-N1',8]]
};
function ensureLifeSystems(){
 if(!Number.isInteger(S.year)||S.year<1)S.year=1;
 if(!Array.isArray(S.exams))S.exams=[];
 if(!Array.isArray(S.certificates))S.certificates=[];
 if(!Array.isArray(S.notices))S.notices=[];
 if(!Array.isArray(S.sickHistory))S.sickHistory=[];
}
function gameSerial(year=S.year,month=S.month,day=S.day){
 return (year-1)*365+Array.from({length:month-1},(_,i)=>monthLength(i+1)).reduce((a,b)=>a+b,0)+day-1;
}
function serialDate(serial){
 const year=Math.floor(serial/365)+1;let day=serial%365+1,month=1;
 while(day>monthLength(month)){day-=monthLength(month);month++}
 return `第${year}年${month}月${day}日`;
}
function gameTime(){return `第${S.year}年${S.month}月${S.day}日 ${periodNames[S.period]}`}
function courseCompletedCount(id){
 return Object.values(S.planner.entries).filter(entry=>entry.id===id&&entry.done&&!entry.skipped).length;
}
function courseName(id){return plannerActivities.find(a=>a.id===id)?.name||id}
function requirementText(level){
 return JLPT_REQUIREMENTS[level].map(([id,count])=>`${courseName(id)} ${courseCompletedCount(id)}/${count} 次`).join('；');
}
function examRegistrationSession(){
 const month=S.month===4?7:S.month===9?12:null;
 return month?{year:S.year,month,key:`${S.year}-${month}`}:null;
}
function registerExam(level){
 ensurePlanner();if(S.ending||!JLPT_REQUIREMENTS[level])return;
 const session=examRegistrationSession();
 if(!session){toast('报名仅在游戏内每年 4 月和 9 月开放。');return}
 if(S.exams.some(exam=>exam.key===session.key)){toast('本场考试已报名，每场只能选择一个等级。');return}
 const examOn=gameSerial(session.year,session.month,1),slot=(S.calendarTick+examOn-gameSerial())*2;
 S.exams.push({...session,level,examOn,resultOn:examOn+45,slot,status:'registered'});
 S.planner.entries[slot]={id:'exam',system:true,examKey:session.key};
 log(`${gameTime()} · 已报名 JLPT ${level}，考试日期为${serialDate(examOn)}，成绩在考后45天送达。`);
 render();save(false);toast(`已报名 JLPT ${level}；考试时会检查实际学习次数。`);
}
function sitExam(exam,missed=false){
 if(exam.status!=='registered')return;
 exam.requirements=JLPT_REQUIREMENTS[exam.level].map(([id,count])=>({id,required:count,completed:courseCompletedCount(id)}));
 exam.passed=!missed&&exam.requirements.every(item=>item.completed>=item.required);
 exam.missed=missed;exam.status='waiting';
 if(!missed)S.planner.entries[exam.slot]={id:'exam',system:true,examKey:exam.key,done:true};
 log(`${serialDate(exam.examOn)} · JLPT ${exam.level} ${missed?'缺考（因养病或错过固定考试时段）':'考试已完成'}，成绩将于${serialDate(exam.resultOn)}通知。`);
}
function queueNotice(id,title,body){
 if(!S.notices.some(notice=>notice.id===id))S.notices.push({id,title,body,read:false});
}
function processLifeCalendar(sick=false){
 ensureLifeSystems();const today=gameSerial();
 for(const exam of S.exams){
  if(exam.status==='registered'&&(today>exam.examOn||(today===exam.examOn&&(sick||S.period>0))))sitExam(exam,true);
  if(exam.status==='waiting'&&today>=exam.resultOn){
   exam.status='result';
   const title=`JLPT ${exam.level} · ${exam.passed?'合格':'不合格'}`;
   const reason=exam.missed?'你错过了本次固定考试时段。':exam.passed?'你已完成该等级所需课程。':`考试当天所需课程尚未完成：${exam.requirements.map(item=>`${courseName(item.id)} ${item.completed}/${item.required}次`).join('；')}。`;
   if(exam.passed&&!S.certificates.some(cert=>cert.examKey===exam.key)){
    S.certificates.push({examKey:exam.key,level:exam.level,date:serialDate(exam.resultOn)});
    log(`${serialDate(exam.resultOn)} · 获得 JLPT ${exam.level} 游戏内证书。`);
   }else if(!exam.passed)log(`${serialDate(exam.resultOn)} · 收到考试通知：JLPT ${exam.level} 不合格。`);
   queueNotice(`exam-${exam.key}`,title,`${serialDate(exam.resultOn)}，你的考试成绩通知已送达。${reason}${exam.passed?'证书已存入人生记录。':'本次未获得证书，可报名下一场考试。'}`);
  }
 }
}
function advanceCalendarSlot({recover=true,sick=false}={}){
 const nextDay=S.period===1;S.period=nextDay?0:1;
 if(nextDay){
  S.turn++;S.calendarTick++;S.day++;
  if(S.day>monthLength(S.month)){
   S.day=1;S.month++;
   if(S.month>12){S.month=1;S.year++;S.age++;log(`你迎来了${S.age}岁。新的一年开始了。`)}
   S.money=Math.max(0,S.money-300);log('支付每月生活开销：-300円（原型数值）。');
  }
  if(recover)S.energy=clamp(S.energy+DAILY_ENERGY_RECOVERY,-10,100);
 }
 processLifeCalendar(sick);
 return nextDay;
}
function forceSickWeek(){
 const start=gameTime(),startSlot=currentPlannerSlot();
 S.health=clamp(S.health-10);S.autoEventPending=false;S.currentEvent=null;
 for(let i=0;i<14;i++){
  const slot=currentPlannerSlot(),entry=S.planner.entries[slot];
  if(entry?.id==='exam'){
   const exam=S.exams.find(item=>item.key===entry.examKey);if(exam)sitExam(exam,true);
  }
  S.planner.entries[slot]={id:'sick',system:true,done:true,skipped:true};
  advanceCalendarSlot({recover:false,sick:i<13});
 }
 S.energy=100;plannerSelected=currentPlannerSlot();
 S.sickHistory.push({start,end:gameTime(),startSlot,endSlot:currentPlannerSlot()});
 log(`${start} — ${gameTime()} · 精力降到−10，强制养病一周；原有14个时段安排跳过，精力恢复100%。`);
 queueNotice(`sick-${startSlot}`,'过劳生病 · 强制休息一周',`精力已降到−10。系统已跳过从${start}起的七天行程，全部改为养病，学习不计入完成次数。现在是${gameTime()}，精力恢复100%，健康减少10点。`);
}
function executeFixedExam(){
 const entry=S.planner.entries[currentPlannerSlot()];if(entry?.id!=='exam')return false;
 const exam=S.exams.find(item=>item.key===entry.examKey);
 if(exam&&exam.status==='registered'){
  spend(20);sitExam(exam);advance(`${gameTime()} · 参加 JLPT ${exam.level} 考试。`);
  plannerSelected=currentPlannerSlot();render();save(false);
 }
 return true;
}
function renderExamPanel(){
 const session=examRegistrationSession(),registration=session&&S.exams.find(exam=>exam.key===session.key);
 const pending=S.exams.filter(exam=>exam.status!=='result');
 return `<details class="exam-board"><summary>🎓 JLPT 考试${registration?' · 已报名 '+registration.level:session?' · 报名开放':''}</summary><p>游戏内固定7月1日、12月1日上午考试，4月和9月报名；每场限报一个等级，考后45天通知。考试时按实际完成课程判定，报名和安排课程不等于学完。</p>${session?registration?`<p>已报名：JLPT ${registration.level}</p>`:`<div class="exam-levels">${Object.keys(JLPT_REQUIREMENTS).map(level=>`<button class="secondary" onclick="registerExam('${level}')" ${S.ending?'disabled':''}>报名 ${level}</button>`).join('')}</div>`:'<p>当前不在报名期，下一次在4月或9月开放。</p>'}<details><summary>各等级合格条件</summary>${Object.keys(JLPT_REQUIREMENTS).map(level=>`<p><b>${level}</b>：${requirementText(level)}</p>`).join('')}</details>${pending.map(exam=>`<p>${exam.level} · ${exam.status==='registered'?`考试：${serialDate(exam.examOn)}（系统固定时段）`:`已考完，等待${serialDate(exam.resultOn)}成绩`}</p>`).join('')}</details>`;
}
function renderAchievements(){
 const html=S.certificates.length?S.certificates.map(cert=>`<div class="certificate">🏅 JLPT ${cert.level} 游戏内证书<small>${cert.date} 获得</small></div>`).join(''):'<p class="section-caption">尚未获得证书。完成课程并通过考试后，证书会永久保存在这里。</p>';
 document.getElementById('certificates').innerHTML=`<h3>我的证书</h3>${html}${S.exams.some(exam=>exam.status==='result')?`<details><summary>考试记录</summary>${S.exams.filter(exam=>exam.status==='result').map(exam=>`<p>${serialDate(exam.examOn)} · ${exam.level} · ${exam.passed?'合格':'不合格'}</p>`).join('')}</details>`:''}${S.sickHistory.length?`<details><summary>养病记录（${S.sickHistory.length}次）</summary>${S.sickHistory.map(item=>`<p>${item.start} — ${item.end} · 强制养病一周</p>`).join('')}</details>`:''}`;
}
function showPendingNotice(){
 if(!S)return;const dialog=document.getElementById('noticeWindow');
 const notice=S.notices.find(item=>!item.read);if(!notice||dialog.open)return;
 document.getElementById('noticeTitle').textContent=notice.title;
 document.getElementById('noticeBody').textContent=notice.body;
 dialog.dataset.noticeId=notice.id;dialog.showModal();
}
function acknowledgeNotice(){
 const dialog=document.getElementById('noticeWindow'),notice=S.notices.find(item=>item.id===dialog.dataset.noticeId);
 if(notice)notice.read=true;dialog.close();save(false);showPendingNotice();
}
