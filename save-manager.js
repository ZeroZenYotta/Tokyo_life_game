const SAVE_LIBRARY_KEY='tokyoLifeSlotsV1';
const EXTRA_SLOT_PRICE=5000;
let selectedSaveSlot=0;
function ensureLifeIdentity(){
 if(!S)return;
 if(!S.lifeId){
  // 旧存档没有身份字段，同一人生的旧快照仍需共享扣费记录。
  const fingerprint=`${S.lifeSeed??'legacy'}|${S.name}|${S.background||''}|${S.trait||''}`;
  let hash=2166136261;for(const char of fingerprint){hash^=char.codePointAt(0);hash=Math.imul(hash,16777619)}
  S.lifeId=`legacy-${hash>>>0}`;
 }
 if(!Number.isFinite(S.slotUnlockPaid))S.slotUnlockPaid=0;
}
function validGameSnapshot(data){
 return data&&typeof data==='object'&&typeof data.name==='string'&&
 ['age','money','energy','study','skill','social','health','month','turn'].every(key=>Number.isFinite(data[key]))&&
 data.relations&&typeof data.relations==='object'&&data.met&&Array.isArray(data.logs)&&Array.isArray(data.usedEvents);
}
function newSlotRecord(snapshot){
 return {savedAt:new Date().toISOString(),state:JSON.parse(JSON.stringify(snapshot))};
}
function readSaveLibrary(){
 const raw=localStorage.getItem(SAVE_LIBRARY_KEY);
 if(raw){
  const data=JSON.parse(raw);
  if(!Array.isArray(data.slots)||data.slots.length!==8||!Array.isArray(data.unlocked)||data.unlocked.length!==8)throw Error('存档库格式异常');
  data.unlocked[0]=true;data.unlocked[1]=true;
  if(!data.purchases||typeof data.purchases!=='object')data.purchases={};
  return data;
 }
 const data={version:1,slots:Array(8).fill(null),unlocked:Array.from({length:8},(_,i)=>i<2),purchases:{}};
 // 第一次启用多档位时保留已有的单档进度。
 const legacy=localStorage.getItem('tokyoLifeSaveV1');
 if(legacy){try{const state=JSON.parse(legacy);if(validGameSnapshot(state))data.slots[0]=newSlotRecord(state)}catch(error){/* 无效旧档不覆盖，也不影响新档位。 */}}
 localStorage.setItem(SAVE_LIBRARY_KEY,JSON.stringify(data));
 return data;
}
function writeSaveLibrary(data){localStorage.setItem(SAVE_LIBRARY_KEY,JSON.stringify(data))}
function reconcileSlotPurchases(library){
 ensureLifeIdentity();
 const paid=Number(library.purchases[S.lifeId]||0),owed=Math.max(0,paid-S.slotUnlockPaid);
 if(owed){S.money=Math.max(0,S.money-owed);S.slotUnlockPaid=paid}
}
function restoreGameSnapshot(snapshot){
 if(!validGameSnapshot(snapshot))throw Error('存档内容无法读取');
 const previous=S;
 try{
  S=JSON.parse(JSON.stringify(snapshot));ensureLifeIdentity();reconcileSlotPurchases(readSaveLibrary());
  plannerSelected=null;plannerCategory='study';ensurePlanner();
  document.getElementById('noticeWindow').close();
  document.getElementById('modal').classList.add('hidden');
  document.getElementById('welcome').classList.add('hidden');document.getElementById('game').classList.remove('hidden');
  closeSections();render();save(false);
 }catch(error){S=previous;throw error}
}
function selectSaveSlot(index){
 if(!Number.isInteger(index)||index<0||index>7)return;
 selectedSaveSlot=index;renderSaveManagers();
}
function saveToSlot(index=selectedSaveSlot){
 if(!S){toast('先开始新人生，再保存到档位。');return}
 try{
  const library=readSaveLibrary();
  if(!Number.isInteger(index)||index<0||index>7||!library.unlocked[index]){toast('这个档位尚未解锁。');return}
  if(library.slots[index]&&!confirm(`覆盖存档 ${index+1}？原来的进度将被替换。`))return;
  ensureLifeIdentity();library.slots[index]=newSlotRecord(S);writeSaveLibrary(library);
  selectedSaveSlot=index;save(false);renderSaveManagers();toast(`已保存到存档 ${index+1}。`);
 }catch(error){toast('保存失败，可能是浏览器存储空间不足。原有档位会保留。')}
}
function loadFromSlot(index=selectedSaveSlot){
 try{
  const library=readSaveLibrary();
  if(!Number.isInteger(index)||index<0||index>7||!library.unlocked[index]){toast('这个档位尚未解锁。');return}
  const record=library.slots[index];if(!record){toast('这个档位还没有存档。');return}
  if(!validGameSnapshot(record.state)){toast('这个存档已损坏，未替换当前进度。');return}
  if(S&&!confirm(`读取存档 ${index+1}？将替换当前游玩进度。`))return;
  restoreGameSnapshot(record.state);toast(`已读取存档 ${index+1}。`);
 }catch(error){toast('读取失败，未替换当前进度。')}
}
function deleteSaveSlot(index=selectedSaveSlot){
 try{
  const library=readSaveLibrary();if(!Number.isInteger(index)||index<0||index>7||!library.unlocked[index]||!library.slots[index])return;
  if(!confirm(`删除存档 ${index+1}？删除后无法恢复。`))return;
  library.slots[index]=null;writeSaveLibrary(library);renderSaveManagers();toast(`已删除存档 ${index+1}，档位仍可使用。`);
 }catch(error){toast('删除失败，原有存档会保留。')}
}
function unlockSaveSlot(index=selectedSaveSlot){
 if(!S){toast('请先开始人生，使用游戏内日元解锁。');return}
 try{
  const library=readSaveLibrary();if(!Number.isInteger(index)||index<2||index>7||library.unlocked[index])return;
  if(S.money<EXTRA_SLOT_PRICE){toast('游戏内资金不足，需要5,000日元。');return}
  if(!confirm(`花费游戏内 ${EXTRA_SLOT_PRICE.toLocaleString()} 日元解锁档位 ${index+1}？这会扣除当前角色资金。`))return;
  ensureLifeIdentity();
  library.unlocked[index]=true;library.purchases[S.lifeId]=Number(library.purchases[S.lifeId]||0)+EXTRA_SLOT_PRICE;
  writeSaveLibrary(library);
  S.money-=EXTRA_SLOT_PRICE;S.slotUnlockPaid=library.purchases[S.lifeId];
  save(false);render();renderSaveManagers();toast(`档位 ${index+1} 已解锁，存档和读档共用。`);
 }catch(error){toast('解锁失败，请检查浏览器存储是否可用。')}
}
function formatSaveTime(value){
 const date=new Date(value);return Number.isNaN(date.getTime())?'时间未知':date.toLocaleString('zh-CN',{timeZone:'Asia/Tokyo',hour12:false});
}
function renderSaveManagers(){
 let library;
 try{library=readSaveLibrary()}catch(error){
  for(const id of ['saveManager','loadManager'])document.getElementById(id).innerHTML='<p class="save-message">暂时无法读取本地存档库。请检查浏览器是否允许保存数据。</p>';
  return;
 }
 for(const mode of ['save','load']){
  const isSave=mode==='save',record=library.slots[selectedSaveSlot],unlocked=library.unlocked[selectedSaveSlot];
  const preview=record?.state,valid=validGameSnapshot(preview);
  const slotHtml=library.slots.map((slot,i)=>`<button class="save-slot ${library.unlocked[i]?'':'slot-locked'}" aria-pressed="${i===selectedSaveSlot}" onclick="selectSaveSlot(${i})"><b>${library.unlocked[i]?'📁':'🔒'} 档位 ${i+1}</b><small>${!library.unlocked[i]?'待解锁':slot?escapeHtml(slot.state?.name||'已有存档'):'空白档位'}</small><span>${!library.unlocked[i]?'5,000円':i<2?'免费档位':'已解锁'}</span></button>`).join('');
  const detail=!unlocked?`<div class="slot-lock-icon">🔒</div><h3>扩展档位 ${selectedSaveSlot+1}</h3><p>花费 <b>5,000 游戏内日元</b> 解锁，扣除当前角色资金。解锁后，存档和读档均可使用。</p><button class="primary" onclick="unlockSaveSlot()" ${!S||S.money<EXTRA_SLOT_PRICE?'disabled':''}>解锁此档位</button><p class="save-caption">${S?`当前资金：${S.money.toLocaleString()}円`:'开始游戏后可以解锁。'}</p>`:
   `<h3>档位 ${selectedSaveSlot+1}${record?' · 已保存':' · 空白'}</h3>${record&&valid?`<div class="save-preview"><b>${escapeHtml(preview.name)}</b><p>${preview.age}岁 · 第${preview.year||1}年${preview.month}月${preview.day||1}日 ${periodNames[preview.period||0]}</p><p>资金 ${preview.money.toLocaleString()}円<br>精力 ${preview.energy}% · 健康 ${preview.health}<br>证书 ${preview.certificates?.length||0} 张</p><small>保存于 ${escapeHtml(formatSaveTime(record.savedAt))}（日本时间）</small></div>`:record?'<p>此存档内容异常，可以删除后重新保存。</p>':'<p>还没有故事保存在这里。</p>'}<div class="save-operations">${isSave?`<button class="primary" onclick="saveToSlot()" ${!S?'disabled':''}>${record?'覆盖保存':'保存当前人生'}</button><button class="danger-button" onclick="deleteSaveSlot()" ${!record?'disabled':''}>删除此存档</button>`:`<button class="primary" onclick="loadFromSlot()" ${!valid?'disabled':''}>读取此存档</button>`}</div>${isSave&&S?`<p class="save-caption">将保存：${escapeHtml(S.name)} · 第${S.year}年${S.month}月${S.day}日 ${periodNames[S.period]}</p>`:''}`;
  document.getElementById(isSave?'saveManager':'loadManager').innerHTML=`<p class="save-message">共8个档位 · 前2个免费 · 后6个每格5,000游戏内日元。${isSave?'选择左侧档位，在右侧保存或删除。':'选择左侧档位，在右侧读取。'}自动续玩单独保留，不占手动档位。</p><div class="save-layout"><section class="save-catalog" aria-label="八个存档位"><h3>我的存档</h3><div class="save-slots">${slotHtml}</div></section><section class="save-details" aria-label="档位详情">${detail}</section></div>`;
 }
}
