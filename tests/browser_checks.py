"""Run game integration checks in headless Chrome (no third-party packages)."""
from pathlib import Path
import html
import json
import os
import re
import shutil
import subprocess
import tempfile

ROOT = Path(__file__).resolve().parents[1]
CHROME = os.environ.get('CHROME_PATH') or shutil.which('google-chrome') or r'C:\Program Files\Google\Chrome\Application\chrome.exe'
CHECKS = r'''
<script>
(async()=>{
const checks=[];const check=(ok,label)=>{if(!ok)throw Error(label);checks.push(label)};
const wait=()=>new Promise(r=>setTimeout(r,30));const click=async s=>{document.querySelector(s).click();await wait()};
try{
const originalRandom=Math.random;
try{for(const roll of [0,.3,.6,.9]){Math.random=()=>roll;newGame('初始设定测试');check(S.money===200000&&S.energy===100&&S.health===90&&S.age===24,'Fixed starting stats across backgrounds '+roll)}}finally{Math.random=originalRandom}
for(const action of ['study','work','startup','social']){
 newGame('能力测试');S.study=120;S.skill=120;S.social=120;act(action);
 check(S.study>=120&&S.skill>=120&&S.social>=120&&[S.study,S.skill,S.social].some(v=>v>120),'Uncapped growth in '+action);
}
newGame('互动测试');S.social=150;interact('haru');check(S.social===151,'Social grows beyond 100 in interactions');
for(const [index,stat] of [[1,'study'],[2,'skill'],[0,'social']]){
 newGame('事件测试');S[stat]=150;S.currentEvent=JSON.parse(JSON.stringify(eventPool[index]));choose(0);check(S[stat]>150,'Uncapped event growth '+stat);
}
for(const [id,stat] of [['jp-basic','study'],['coding','skill'],['speaking','social']]){
 newGame('行程成长测试');S[stat]=150;ensurePlanner();S.planner.entries[0]={id};executePlannerDay();check(S[stat]>150,'Uncapped planned growth '+stat);
}
newGame('恢复测试');ensurePlanner();S.energy=95;S.health=98;executePlannerDay();check(S.energy===100&&S.health===100,'Energy and health stay capped at 100');
S.study=160;S.skill=170;S.social=180;stats();check([...document.querySelectorAll('#stats .stat')].slice(2,5).every(e=>e.textContent.includes('累计点数')&&!e.textContent.includes('/100')),'Abilities display points rather than completion rates');
save(false);S=null;load();check(S.study===160&&S.skill===170&&S.social===180,'Above-100 abilities survive save and load');
newGame('课程测试');openSection('section-actions');await wait();
check(document.querySelectorAll('.schedule-day').length===7&&document.querySelectorAll('.schedule-slot').length===14,'Seven days with two slots each');
check([...document.querySelectorAll('.day-heading strong')].map(e=>e.textContent).join(',')===weekNames.join(','),'Monday to Sunday order');
check(!document.getElementById('actions').textContent.includes('月安排'),'No monthly scheduling');
check(!document.querySelector('[data-activity="jp-start"]')&&document.querySelector('.activity-card').textContent.includes('初级日语'),'Removed kana course and learning visible by default');
check(document.querySelector('[data-activity="jp-mid"]').disabled&&document.querySelector('[data-activity="jlpt-N5"]').disabled,'Later Japanese courses start locked');
check(!document.querySelector('[data-activity="coding"]').disabled,'Other skills remain independent');
assignPlannerActivity('jp-mid');check(!S.planner.entries[0],'Direct assignment cannot bypass lock');
assignPlannerActivity('jp-basic');selectPlannerSlot(0);assignPlannerActivity('jp-basic');check(basicJapaneseCount()===1,'Repeating the same slot does not add credit');
for(let slot=1;slot<7;slot++){selectPlannerSlot(slot);assignPlannerActivity('jp-basic')}
check(basicJapaneseCount()===7&&document.querySelector('[data-activity="jp-mid"]').disabled,'Seven arrangements do not unlock');
selectPlannerSlot(7);assignPlannerActivity('jp-basic');check(basicJapaneseCount()===8&&!document.querySelector('[data-activity="jp-mid"]').disabled,'Eighth distinct arrangement unlocks Japanese courses');
assignPlannerActivity('jp-mid');check(S.planner.entries[8].id==='jp-mid','Unlocked intermediate course can be scheduled');
selectPlannerSlot(0);clearPlannerDay();check(basicJapaneseCount()===8,'Earned unlock is retained when a plan is changed');
save(false);S=null;load();await wait();check(basicJapaneseCount()===8&&!isActivityLocked(plannerActivities.find(a=>a.id==='jp-mid')),'Course unlock survives save and load');
S.calendarTick=6;S.day=7;S.period=1;S.turn=7;executePlannerDay();check(S.calendarTick===7&&S.day===8&&S.period===0&&plannerRange()[0]===7&&basicJapaneseCount()===8,'Sunday afternoon rolls into next week while retaining unlocks');
newGame('未解锁执行测试');ensurePlanner();S.planner.entries[0]={id:'jp-mid'};const lockedEnergy=S.energy;executePlannerDay();check(currentPlannerSlot()===0&&S.energy===lockedEnergy,'Execution cannot bypass locked course');
newGame('行程测试');openSection('section-actions');await wait();
const initialStudy=S.study,initialTick=S.calendarTick;
await click('[data-activity="jp-basic"]');check(S.planner.entries[0].id==='jp-basic','Assign morning activity');
check(S.study===initialStudy&&S.calendarTick===initialTick,'Planning alone does not change stats or time');
setPlannerCategory('fun');await click('[data-activity="park"]');check(S.planner.entries[1].id==='park','Entertainment fills afternoon slot');
selectPlannerSlot(2);assignPlannerActivity('mall');selectPlannerSlot(2);clearPlannerDay();check(!S.planner.entries[2],'Clear selected slot');
S.energy=100;await click('#executePlan');
check(S.calendarTick===0&&S.day===1&&S.period===1,'Morning execution enters afternoon of same day');
check(S.study===initialStudy+5&&S.energy===86&&S.planner.entries[0].done,'Execution applies learning effects once');
selectPlannerSlot(0);assignPlannerActivity('games');check(S.planner.entries[0].id==='jp-basic','Past slots cannot be edited');
await click('#executePlan');check(S.calendarTick===1&&S.day===2&&S.period===0&&S.planner.entries[1].done,'Afternoon execution advances to next morning');
S.energy=20;executePlannerDay();check(S.calendarTick===1&&S.period===1&&S.energy===55,'Empty slot defaults to rest');
executePlannerDay();check(S.calendarTick===2&&S.period===0&&S.currentEvent,'Day end can trigger event');
const blockedSlot=currentPlannerSlot();executePlannerDay();check(currentPlannerSlot()===blockedSlot,'Pending event blocks execution');
openSection('section-story');choose(0);check(!S.currentEvent&&currentPlannerSlot()===blockedSlot,'Event choice does not skip a slot');
check(S.logs.some(line=>line.includes('4月1日 上午')&&line.includes('初级日语')),'Execution log records date and period');
openSection('section-actions');selectPlannerSlot(currentPlannerSlot());assignPlannerActivity('onsen');S.money=0;
const poorSlot=currentPlannerSlot(),poorEnergy=S.energy;executePlannerDay();check(currentPlannerSlot()===poorSlot&&S.energy===poorEnergy,'Unaffordable activity leaves slot unchanged');
selectPlannerSlot(currentPlannerSlot());assignPlannerActivity('coding');S.energy=0;executePlannerDay();check(currentPlannerSlot()===poorSlot+15&&S.energy===100&&S.sickHistory.length===1,'Exhaustion completes action then skips 14 sick slots');
check(Object.values(S.planner.entries).filter(entry=>entry.id==='sick'&&entry.skipped).length===14,'Sick week marks 14 system rest slots');
while(S.notices.some(item=>!item.read))acknowledgeNotice();
S.planner.entries[currentPlannerSlot()]={id:'coding'};
save(false);const saved=JSON.parse(localStorage.getItem('tokyoLifeSaveV1'));S=null;load();await wait();
check(S.planner.entries[currentPlannerSlot()].id==='coding'&&S.period===saved.period,'Plans and clock survive save and load');
const old=JSON.parse(JSON.stringify(saved));old.planner={mode:'month',entries:{0:{id:'jp-start'},3:{id:'jp-basic',done:true},4:{id:'coding'}}};delete old.period;
localStorage.setItem('tokyoLifeSaveV1',JSON.stringify(old));load();await wait();
check(S.planner.version===2&&S.planner.entries[0].id==='jp-basic'&&S.planner.entries[6].done&&S.planner.entries[8].id==='coding','Old daily plans migrate to morning slots including removed course');
check(basicJapaneseCount()===2&&S.money===saved.money&&S.age===saved.age,'Migration keeps learning credit and player state');
const oldBare=JSON.parse(JSON.stringify(saved));delete oldBare.planner;delete oldBare.day;delete oldBare.calendarTick;delete oldBare.period;
localStorage.setItem('tokyoLifeSaveV1',JSON.stringify(oldBare));load();await wait();
check(S.day===1&&S.calendarTick===0&&S.period===0&&S.planner.version===2&&S.name==='行程测试','Old saves without calendar migrate');
S.month=12;S.day=31;S.period=1;S.money=1000;const age=S.age;advance('跨年测试');check(S.month===1&&S.day===1&&S.period===0&&S.age===age+1&&S.money===700,'Afternoon at year end rolls calendar and bills once');
S.month=2;S.day=28;S.period=1;advance('二月测试');check(S.month===3&&S.day===1,'February rollover');
S.currentEvent=null;S.ending=null;openSection('section-actions');
for(const width of [292,362,740]){
 panelWindow.style.width=width+'px';await wait();
 const left=document.querySelector('.schedule-board').getBoundingClientRect(),right=document.querySelector('.activity-board').getBoundingClientRect();
 check(left.right<=right.left&&Math.abs(left.top-right.top)<2,'Side-by-side panels at '+width);
 check(document.querySelector('.window-body').scrollWidth<=document.querySelector('.window-body').clientWidth,'No horizontal overflow at '+width);
 check([...document.querySelectorAll('.day-slots')].every(row=>{const [am,pm]=[...row.children].map(e=>e.getBoundingClientRect());return am.right<=pm.left&&Math.abs(am.top-pm.top)<2}),'Morning and afternoon side by side at '+width);
 for(const group of ['study','fun']){setPlannerCategory(group);check(document.querySelectorAll('.activity-card').length>=10,'Expanded '+group+' catalog at '+width)}
}
closeSections();await wait();openSection('section-actions');check(plannerCategory==='study','Learning resets as default on reopen');
S.ending='测试结局';renderActions();check(document.querySelector('#executePlan').disabled&&[...document.querySelectorAll('.activity-card')].every(e=>e.disabled),'Ended life is read-only');
// Daily energy and actual learning are independent of arranged-course credit.
newGame('每日休息测试');S.energy=40;advance('上午');check(S.energy===40&&S.period===1,'No overnight recovery at noon');advance('下午');check(S.energy===60&&S.period===0,'Fixed overnight rest restores 20 energy');
newGame('临界精力测试');S.energy=5;S.planner.entries[0]={id:'jp-basic'};executePlannerDay();check(S.energy===-9&&S.sickHistory.length===0,'Energy above minus ten does not force sickness');
S.currentEvent=null;S.planner.entries[1]={id:'jp-basic'};executePlannerDay();check(S.sickHistory.length===1&&S.energy===100,'Reaching minus ten forces a week even before nightly recovery');
newGame('课程完成测试');for(let slot=0;slot<8;slot++){selectPlannerSlot(slot);assignPlannerActivity('jp-basic')}check(courseCompletedCount('jp-basic')===0,'Scheduling eight times is not eight completed lessons');
check(plannerActivities.some(a=>a.id==='jp-advanced')&&isActivityLocked(plannerActivities.find(a=>a.id==='jp-advanced')),'Advanced Japanese is present and starts locked');
for(let slot=0;slot<8;slot++)S.planner.entries[slot]={id:'jp-mid',done:true};renderActions();check(!document.querySelector('[data-activity="jp-advanced"]').disabled,'Eight completed intermediate lessons unlock advanced Japanese');
// Game calendar: Apr/Sep registration, Jul/Dec 1 exams, results exactly 45 days later.
newGame('考试不合格测试');for(let slot=0;slot<8;slot++){selectPlannerSlot(slot);assignPlannerActivity('jp-basic')}
registerExam('N5');check(S.exams.length===1&&S.exams[0].level==='N5','Registration permits choosing a level before course completion');registerExam('N4');check(S.exams.length===1,'Cannot register twice for one session');
const failedExam=S.exams[0];check(failedExam.examOn===gameSerial(1,7,1)&&failedExam.resultOn===gameSerial(1,8,15),'July exam has August 15 results');
S.calendarTick=failedExam.slot/2;S.month=7;S.day=1;S.period=0;plannerSelected=currentPlannerSlot();render();
assignPlannerActivity('games');check(S.planner.entries[failedExam.slot].id==='exam','Fixed exam slot cannot be replaced');
executePlannerDay();check(failedExam.status==='waiting'&&!failedExam.passed&&S.period===1,'Exam fails when initial Japanese was arranged but not completed');
for(let slot=0;slot<8;slot++)S.planner.entries[slot]={id:'jp-basic',done:true};
S.month=8;S.day=14;S.period=1;processLifeCalendar();check(failedExam.status==='waiting'&&S.certificates.length===0,'No early results before 45 days');
advance('出分日');render();check(failedExam.status==='result'&&!failedExam.passed&&document.getElementById('noticeWindow').open&&document.getElementById('noticeTitle').textContent.includes('不合格'),'Fixed failure popup arrives on result day');
check(S.certificates.length===0,'Post-exam study cannot change the recorded failing result');
save(false);S=null;load();check(document.getElementById('noticeWindow').open&&S.notices.filter(item=>item.id==='exam-1-7').length===1,'Unread result survives reload without duplication');
acknowledgeNotice();check(!document.getElementById('noticeWindow').open,'Result popup requires acknowledgment');
newGame('考试合格测试');for(let slot=0;slot<8;slot++)S.planner.entries[slot]={id:'jp-basic',done:true};registerExam('N5');
const passedExam=S.exams[0];S.calendarTick=passedExam.slot/2;S.month=7;S.day=1;S.period=0;executePlannerDay();check(passedExam.passed&&passedExam.status==='waiting','Eight completed initial lessons qualify for N5');
S.month=8;S.day=15;processLifeCalendar();render();check(S.certificates.length===1&&document.getElementById('noticeTitle').textContent.includes('合格')&&document.getElementById('certificates').textContent.includes('N5'),'Passing result grants a certificate in permanent life records');
processLifeCalendar();render();check(S.certificates.length===1,'Certificate is not duplicated');acknowledgeNotice();save(false);S=null;load();check(S.certificates.length===1,'Certificate survives save and load');
newGame('报名日期测试');S.month=5;registerExam('N5');check(S.exams.length===0,'Registration closed outside April and September');S.month=9;registerExam('N4');check(S.exams[0].month===12&&S.exams[0].resultOn===gameSerial(2,1,15),'September registers December exam with next-year results');
const missedExam=S.exams[0];S.month=11;S.day=30;S.period=0;S.calendarTick=missedExam.slot/2-1;S.energy=4;S.planner.entries[currentPlannerSlot()]={id:'jp-basic'};executePlannerDay();check(missedExam.status==='waiting'&&missedExam.missed&&!missedExam.passed,'Forced sick week marks an overlapping exam as missed');
check(courseCompletedCount('jp-basic')===1,'Skipped sick lessons do not add completed-course credit');
while(S.notices.some(item=>!item.read))acknowledgeNotice();
newGame('康复日考试测试');registerExam('N5');const recoveryExam=S.exams[0];S.month=6;S.day=23;S.period=1;S.calendarTick=recoveryExam.slot/2-8;S.energy=4;S.planner.entries[currentPlannerSlot()]={id:'jp-basic'};executePlannerDay();check(S.month===7&&S.day===1&&S.period===0&&recoveryExam.status==='registered','Recovery ending on exam morning still permits attendance');
while(S.notices.some(item=>!item.read))acknowledgeNotice();
newGame('N4条件测试');for(let slot=0;slot<8;slot++)S.planner.entries[slot]={id:'jp-basic',done:true};registerExam('N4');const higher=S.exams[0];S.month=7;S.day=1;S.calendarTick=higher.slot/2;executePlannerDay();check(!higher.passed,'Higher exam level checks its additional course requirements');
// Eight manual slots, shared save/load entitlements, confirmed destructive operations.
newGame('档位测试');localStorage.removeItem(SAVE_LIBRARY_KEY);const library=readSaveLibrary();
check(library.slots.length===8&&library.unlocked.filter(Boolean).length===2,'Eight slots with exactly two free slots');
check(library.slots[0]?.state.name==='档位测试','Legacy automatic progress is retained in first slot');
const originalConfirm=window.confirm;window.confirm=()=>true;
try{
 openSection('section-save');check(document.querySelectorAll('#saveManager .save-slot').length===8&&document.querySelectorAll('#saveManager .slot-locked').length===6,'Save window shows eight slots and six grey locks');
 check(document.querySelectorAll('.hero .menu-icon').length===7&&[...document.querySelectorAll('.menu-icon')].every(e=>!!e.closest('.hero')),'Seven function icons inside title board');
 const originalMoney=S.money;saveToSlot(0);S.money=12345;saveToSlot(1);const originalSecond=readSaveLibrary().slots[1].state.money;
 check(readSaveLibrary().slots[0].state.money===originalMoney&&originalSecond===12345,'Two manual slots retain independent snapshots');
 window.confirm=()=>false;saveToSlot(0);deleteSaveSlot(0);check(readSaveLibrary().slots[0].state.money===originalMoney,'Cancelled overwrite and delete preserve data');
 window.confirm=()=>true;saveToSlot(2);check(readSaveLibrary().slots[2]===null,'Locked slot rejects saves');
 const beforeLockedLoad=S.money;loadFromSlot(2);check(S.money===beforeLockedLoad,'Locked slot rejects loading');
 S.money=4000;unlockSaveSlot(2);check(!readSaveLibrary().unlocked[2]&&S.money===4000,'Insufficient game currency cannot unlock');
 S.money=200000;saveToSlot(1);window.confirm=()=>false;unlockSaveSlot(2);check(S.money===200000&&!readSaveLibrary().unlocked[2],'Cancelled purchase does not charge');
 window.confirm=()=>true;unlockSaveSlot(2);check(readSaveLibrary().unlocked[2]&&S.money===195000,'Unlock deducts exactly 5000 game yen');
 unlockSaveSlot(2);check(S.money===195000,'Already unlocked slot cannot charge again');
 loadFromSlot(1);check(S.money===195000&&readSaveLibrary().unlocked[2],'Loading older snapshot keeps unlock and reconciles its purchase');
 loadFromSlot(1);check(S.money===195000,'Loading older snapshot repeatedly does not double charge');
 saveToSlot(2);check(readSaveLibrary().slots[2]?.state.money===195000,'Unlocked slot can be saved');
 const currentBeforeDelete=S.money;deleteSaveSlot(0);check(readSaveLibrary().slots[0]===null&&!!readSaveLibrary().slots[1]&&S.money===currentBeforeDelete,'Delete only removes selected snapshot');
 deleteSaveSlot(2);check(readSaveLibrary().unlocked[2]&&readSaveLibrary().slots[2]===null,'Deleting a paid slot keeps it unlocked');
 for(let i=3;i<8;i++)unlockSaveSlot(i);unlockSaveSlot(8);check(readSaveLibrary().unlocked.length===8&&readSaveLibrary().unlocked.every(Boolean)&&S.money===170000,'Unlocks stop at eight slots with exact total charge');
 newGame('另一个人生');check(readSaveLibrary().unlocked.every(Boolean)&&!!readSaveLibrary().slots[1],'Starting a new life preserves manual snapshots and purchased slots');
 S=null;openSection('section-load');check(panelWindow.open,'Load window works before starting a life');loadFromSlot(1);check(S.name==='档位测试'&&S.money===170000,'Manual load restores progress from home screen');
 const corrupt=readSaveLibrary();corrupt.slots[0]={savedAt:'bad',state:{name:'broken'}};writeSaveLibrary(corrupt);const goodState=S;loadFromSlot(0);check(S===goodState,'Corrupt slot does not replace current state');
 const setItem=Storage.prototype.setItem;Storage.prototype.setItem=function(key,value){if(key===SAVE_LIBRARY_KEY)throw Error('Quota');return setItem.call(this,key,value)};
 const beforeFailure=localStorage.getItem(SAVE_LIBRARY_KEY);saveToSlot(1);check(localStorage.getItem(SAVE_LIBRARY_KEY)===beforeFailure,'Failed write preserves existing slots');Storage.prototype.setItem=setItem;
 // Two free/six locked slots for responsive layout previews.
 const displayLibrary=readSaveLibrary();displayLibrary.unlocked=Array.from({length:8},(_,i)=>i<2);displayLibrary.slots=displayLibrary.slots.map((record,i)=>i<2?record:null);writeSaveLibrary(displayLibrary);
 const legacySnapshot=JSON.parse(JSON.stringify(S));delete legacySnapshot.lifeId;delete legacySnapshot.slotUnlockPaid;legacySnapshot.money=200000;
 const legacyLibrary=readSaveLibrary();legacyLibrary.purchases={};legacyLibrary.slots[1]=newSlotRecord(legacySnapshot);writeSaveLibrary(legacyLibrary);
 restoreGameSnapshot(legacySnapshot);const legacyId=S.lifeId;unlockSaveSlot(2);loadFromSlot(1);check(S.lifeId===legacyId&&S.money===195000,'Legacy snapshots share a stable identity for unlock charges');
 const previewLibrary=readSaveLibrary();previewLibrary.unlocked=Array.from({length:8},(_,i)=>i<2);previewLibrary.slots[0]=null;previewLibrary.slots[1]=newSlotRecord(S);writeSaveLibrary(previewLibrary);selectSaveSlot(1);openSection('section-save');
 for(const width of [292,362,740]){
  panelWindow.style.width=width+'px';await wait();const left=document.querySelector('#saveManager .save-catalog').getBoundingClientRect(),right=document.querySelector('#saveManager .save-details').getBoundingClientRect();
  check(left.right<=right.left&&Math.abs(left.top-right.top)<2,'Save panels are side by side at '+width);
  check(document.querySelector('.window-body').scrollWidth<=document.querySelector('.window-body').clientWidth,'Save window fits '+width);
 }
 closeSections();
 for(const width of [320,390,760]){
  document.querySelector('.app').style.width=width+'px';const hero=document.querySelector('.hero').getBoundingClientRect(),icons=[...document.querySelectorAll('.hero .menu-icon')].map(e=>e.getBoundingClientRect());
  check(icons.every(rect=>Math.abs(rect.top-icons[0].top)<1&&rect.left>=hero.left&&rect.right<=hero.right&&rect.bottom<=hero.bottom),'Seven icons fit one row inside title at '+width);
 }
 document.querySelector('.app').style.width='390px';document.querySelector('.app').style.margin='0';
}finally{window.confirm=originalConfirm}
newGame('预览');
if(location.hash==='#save'){selectedSaveSlot=1;openSection('section-save')}else if(location.hash==='#load'){selectedSaveSlot=1;openSection('section-load')}

panelWindow.style.width='362px';panelWindow.style.marginLeft='14px';
const result=document.createElement('pre');result.id='verification';result.hidden=true;result.textContent=JSON.stringify({passed:true,checks});document.body.append(result);
}catch(error){const result=document.createElement('pre');result.id='verification';result.textContent=JSON.stringify({passed:false,error:error.message,checks});document.body.append(result)}
})();
</script>
'''

def main():
    work = ROOT / 'work'
    work.mkdir(exist_ok=True)
    with tempfile.TemporaryDirectory(prefix='browser-check-', dir=work) as tmp:
        tmp = Path(tmp)
        source = (ROOT / 'index.html').read_text(encoding='utf-8')
        for name in ['planner.css', 'planner.js', 'life-systems.js', 'save-manager.js', 'save-manager.css']:
            source = source.replace('"'+name+'"', '"'+(ROOT/name).as_uri()+'"')
        page = tmp / 'verify.html'
        page.write_text(source.replace('</body>', CHECKS+'</body>'), encoding='utf-8')
        args = [CHROME,'--headless','--disable-gpu','--no-sandbox','--no-first-run','--allow-file-access-from-files','--window-size=500,844','--virtual-time-budget=12000','--user-data-dir='+str(tmp/'profile')]
        result = subprocess.run(args+['--dump-dom',page.as_uri()], capture_output=True, text=True, encoding='utf-8', errors='replace', timeout=40)
        matches = re.findall(r'<pre id="verification"[^>]*>(.*?)</pre>', result.stdout, re.S)
        if not matches:
            raise RuntimeError('No browser verification result: '+result.stderr[-2000:])
        report = json.loads(html.unescape(matches[-1]))
        print(json.dumps(report, ensure_ascii=False, indent=2))
        if not report['passed']:
            raise SystemExit(1)
        if os.environ.get('PLANNER_SCREENSHOT'):
            for view in ['home','save','load']:
                subprocess.run(args+['--screenshot='+str(work/(view+'-preview.png')),page.as_uri()+'#'+view],capture_output=True,timeout=40,check=True)

if __name__ == '__main__':
    main()
