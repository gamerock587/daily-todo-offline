'use strict';
const ipcRenderer = window.desktop || null;
const isElectron = Boolean(ipcRenderer);
const $ = id => document.getElementById(id);
const floatingBtn=$('floating-btn'),todoContainer=$('todo-container'),newTaskInput=$('new-task-input'),clipboardSearch=$('clipboard-search');
const STORAGE_KEYS={button:'dailyTodo.offline.button'};
const STORE_KEY='dailyTodo.offline.v1';
let state={version:1,tasks:[],snippets:[]};
let activeFeature='tasks',isExpanded=false,isDragging=false,dragMoved=false,displayLayout=null;
let rafMove=null,pendingLeft=0,pendingTop=0,dragStartX=0,dragStartY=0,screenDragStartX=0,screenDragStartY=0,btnStartX=0,btnStartY=0,mainDrivenDrag=false,lastMainDragAt=0;
const MARGIN=18;
function status(text){$('sync-status').textContent=text;}
try {const saved=localStorage.getItem(STORE_KEY);if(saved)state=TodoStore.validate(JSON.parse(saved));}catch{status('Saved data could not be read. Import a backup to recover.');}
function commit(next) {
  try {const safe=TodoStore.validate(next);localStorage.setItem(STORE_KEY,JSON.stringify(safe));state=safe;render();status('Saved on this device');return true;}
  catch(e){status('Could not save: '+e.message);return false;}
}
function render(){
  const list=$('task-list');list.replaceChildren();
  if(!state.tasks.length){const e=document.createElement('p');e.className='empty-state';e.textContent='A clear day. Add your first task above.';list.append(e);}
  for(const task of state.tasks){
    const row=document.createElement('div');row.className='task-item'+(task.completed?' completed':'');
    const toggle=document.createElement('button');toggle.className='task-checkbox';toggle.textContent=task.completed?'✓':'';toggle.setAttribute('aria-label',task.completed?'Mark incomplete':'Mark complete');toggle.setAttribute('aria-pressed',String(task.completed));
    toggle.onclick=()=>commit({...state,tasks:state.tasks.map(t=>t.id===task.id?{...t,completed:!t.completed}:t)});
    const edit=document.createElement('input');edit.className='task-content';edit.value=task.text;edit.maxLength=2000;edit.setAttribute('aria-label','Edit task');
    edit.onchange=()=>{if(!edit.value.trim()){edit.value=task.text;status('A task needs a name.');return;}commit({...state,tasks:state.tasks.map(t=>t.id===task.id?{...t,text:edit.value.trim()}:t)});};
    const del=document.createElement('button');del.className='delete-btn icon-btn';del.textContent='×';del.setAttribute('aria-label','Delete task');del.onclick=()=>{if(confirm('Delete this task?'))commit({...state,tasks:state.tasks.filter(t=>t.id!==task.id)});};
    row.append(toggle,edit,del);list.append(row);
  }
  const done=state.tasks.filter(t=>t.completed).length;$('completed-count').textContent=done;$('total-count').textContent=state.tasks.length;$('progress-bar').style.width=(state.tasks.length?100*done/state.tasks.length:0)+'%';
  renderSnippets();
}
function renderSnippets(){
  const list=$('clipboard-list');list.replaceChildren();const query=clipboardSearch.value.toLowerCase();
  for(const text of state.snippets.filter(s=>s.toLowerCase().includes(query))){
    const row=document.createElement('div');row.className='task-item';const copy=document.createElement('button');copy.className='snippet-text';copy.textContent=text;copy.title='Copy snippet';
    copy.onclick=async()=>{try{if(ipcRenderer)await ipcRenderer.writeClipboard(text);else await navigator.clipboard.writeText(text);status('Copied');}catch{status('Clipboard unavailable. Select and copy the text manually.');}};
    const del=document.createElement('button');del.className='icon-btn';del.textContent='×';del.setAttribute('aria-label','Delete snippet');del.onclick=()=>commit({...state,snippets:state.snippets.filter(s=>s!==text)});row.append(copy,del);list.append(row);
  }
  if(!list.children.length){const e=document.createElement('p');e.className='empty-state';e.textContent='No saved snippets.';list.append(e);}
}
document.body.classList.add(isElectron?'electron-shell':'web-app');
$('date-label').textContent=new Date().toLocaleDateString(undefined,{weekday:'long',month:'long',day:'numeric'});
$('add-form').onsubmit=e=>{e.preventDefault();const text=newTaskInput.value.trim();if(!text)return;if(commit({...state,tasks:[...state.tasks,{id:crypto.randomUUID(),text,completed:false}]}))newTaskInput.value='';newTaskInput.focus();};
for(const feature of ['tasks','clipboard'])$(feature+'-tab').onclick=()=>{activeFeature=feature;for(const f of ['tasks','clipboard']){$(f+'-panel').classList.toggle('hidden',f!==feature);$(f+'-tab').classList.toggle('active',f===feature);}positionPanel();};
clipboardSearch.oninput=renderSnippets;
$('clip-paste-btn').onclick=async()=>{try{const text=(ipcRenderer?await ipcRenderer.readClipboard():await navigator.clipboard.readText()).trim();if(!text)return status('Clipboard is empty.');if(text.length>20000)return status('Snippet is too long.');commit({...state,snippets:[text,...state.snippets.filter(s=>s!==text)].slice(0,1000)});}catch{status('Clipboard access is unavailable. Use the desktop app or grant browser permission.');}};
$('clip-clear-btn').onclick=()=>{if(state.snippets.length&&confirm('Delete all saved snippets?'))commit({...state,snippets:[]});};
$('export-btn').onclick=()=>{const url=URL.createObjectURL(new Blob([JSON.stringify(state,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='daily-todo-backup.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);status('Backup exported. Keep it private.');};
$('import-file').onchange=async e=>{const file=e.target.files[0];if(!file)return;try{if(file.size>5*1024*1024)throw new Error('Backup must be smaller than 5 MB.');const data=TodoStore.validate(JSON.parse(await file.text()));if(confirm('Replace current tasks and snippets with this backup?'))commit(data);}catch(error){status(error.message);}finally{e.target.value='';}};
function enableMouse() {
  if (ipcRenderer) ipcRenderer.send('set-ignore-mouse', false);
}

function disableMouse() {
  if (ipcRenderer && !isExpanded && !isDragging) {
    ipcRenderer.send('set-ignore-mouse', true);
  }
}

async function refreshDisplayLayout() {
  if (!ipcRenderer) return;
  try {
    displayLayout = await ipcRenderer.invoke('get-display-layout');
  } catch {
    displayLayout = null;
  }
}

function onPanelClose() {
  if (!isElectron) return;
  isExpanded = false;
  todoContainer.classList.add('hidden');
  todoContainer.classList.remove('visible');
  disableMouse();
}

function openList() {
  isExpanded = true;
  enableMouse();
  positionPanel();
  todoContainer.classList.remove('hidden');
  todoContainer.classList.add('visible');
  setTimeout(() => {
    if (activeFeature === 'clipboard') clipboardSearch.focus();
    else newTaskInput.focus();
  }, 80);
}

function positionPanel() {
  if (!isElectron) return;

  const panelW = Math.min(activeFeature === 'community' ? 560 : (activeFeature === 'clipboard' ? 480 : 410), window.innerWidth - 2 * MARGIN);
  const panelH = Math.min(activeFeature === 'community' ? 720 : (activeFeature === 'clipboard' ? 690 : 590), window.innerHeight - 2 * MARGIN);
  const btnRect = floatingBtn.getBoundingClientRect();
  let left = btnRect.left + btnRect.width / 2 - panelW / 2;
  let top = btnRect.bottom + 14;

  if (left + panelW > window.innerWidth - MARGIN) left = window.innerWidth - panelW - MARGIN;
  if (left < MARGIN) left = MARGIN;
  if (top + panelH > window.innerHeight - MARGIN) top = btnRect.top - panelH - 14;
  if (top < MARGIN) top = MARGIN;

  todoContainer.style.width = `${panelW}px`;
  todoContainer.style.maxHeight = `${panelH}px`;
  todoContainer.style.left = `${left}px`;
  todoContainer.style.top = `${top}px`;
}

function clampButton(left, top) {
  const width = displayLayout?.virtualBounds?.width || window.innerWidth;
  const height = displayLayout?.virtualBounds?.height || window.innerHeight;
  return {
    left: Math.max(MARGIN, Math.min(width - floatingBtn.offsetWidth - MARGIN, left)),
    top: Math.max(MARGIN, Math.min(height - floatingBtn.offsetHeight - MARGIN, top))
  };
}

function moveButton(left, top) {
  const next = clampButton(left, top);
  floatingBtn.style.left = `${next.left}px`;
  floatingBtn.style.top = `${next.top}px`;
  floatingBtn.style.right = 'auto';
  if (isExpanded) positionPanel();
}

function restoreButtonPosition() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEYS.button) || 'null');
    if (saved) moveButton(saved.left, saved.top);
  } catch {
    // Keep the CSS default position.
  }
}

function saveButtonPosition() {
  const rect = floatingBtn.getBoundingClientRect();
  localStorage.setItem(STORAGE_KEYS.button, JSON.stringify({ left: rect.left, top: rect.top }));
}

function scheduleButtonMove() {
  if (rafMove) return;
  rafMove = requestAnimationFrame(() => {
    rafMove = null;
    moveButton(pendingLeft, pendingTop);
  });
}

function startDrag(event) {
  if (!isElectron) return;
  event.preventDefault();
  enableMouse();
  refreshDisplayLayout();
  isDragging = true;
  dragMoved = false;
  dragStartX = event.clientX;
  dragStartY = event.clientY;
  screenDragStartX = event.screenX;
  screenDragStartY = event.screenY;
  const rect = floatingBtn.getBoundingClientRect();
  btnStartX = rect.left;
  btnStartY = rect.top;
  mainDrivenDrag = Boolean(ipcRenderer);
  lastMainDragAt = 0;
  floatingBtn.classList.add('dragging');
  floatingBtn.setPointerCapture?.(event.pointerId);
  ipcRenderer?.send('start-widget-drag', {
    x: event.clientX - rect.left,
    y: event.clientY - rect.top
  });
}

function drag(event) {
  if (!isDragging) return;
  if (mainDrivenDrag && Date.now() - lastMainDragAt < 90) return;
  const dx = Number.isFinite(event.screenX) ? event.screenX - screenDragStartX : event.clientX - dragStartX;
  const dy = Number.isFinite(event.screenY) ? event.screenY - screenDragStartY : event.clientY - dragStartY;

  if (Math.abs(dx) > 3 || Math.abs(dy) > 3) dragMoved = true;
  pendingLeft = btnStartX + dx;
  pendingTop = btnStartY + dy;
  scheduleButtonMove();
}

function endDrag(event = {}) {
  if (!isDragging) return;
  isDragging = false;
  mainDrivenDrag = false;
  ipcRenderer?.send('stop-widget-drag');
  if (event.pointerId !== undefined) floatingBtn.releasePointerCapture?.(event.pointerId);
  floatingBtn.classList.remove('dragging');
  saveButtonPosition();
  if (!isExpanded) disableMouse();
}

floatingBtn.addEventListener('mouseenter', enableMouse);
floatingBtn.addEventListener('mouseleave', disableMouse);
floatingBtn.addEventListener('pointerdown', startDrag);
floatingBtn.addEventListener('pointermove', drag);
floatingBtn.addEventListener('pointerup', endDrag);
floatingBtn.addEventListener('pointercancel', endDrag);
document.addEventListener('pointerup', endDrag);
document.addEventListener('mouseup', endDrag);
floatingBtn.addEventListener('click', () => {
  if (dragMoved) {
    dragMoved = false;
    return;
  }
  isExpanded ? onPanelClose() : openList();
});

todoContainer.addEventListener('mouseenter', enableMouse);
todoContainer.addEventListener('mouseleave', disableMouse);

document.addEventListener('mousedown', event => {
  if (isElectron &&
      isExpanded &&
      !todoContainer.contains(event.target) &&
      !floatingBtn.contains(event.target)) {
    onPanelClose();
  }
});

window.addEventListener('resize', () => {
  if (isElectron) {
    refreshDisplayLayout();
    const rect = floatingBtn.getBoundingClientRect();
    moveButton(rect.left, rect.top);
    if (isExpanded) positionPanel();
  }
});

if (ipcRenderer) {
  ipcRenderer.on('widget-drag-point', (_, payload) => {
    if (!isDragging) return;
    lastMainDragAt = Date.now();
    if (payload?.layout) displayLayout = payload.layout;
    if (Math.abs((payload?.left || 0) - btnStartX) > 3 || Math.abs((payload?.top || 0) - btnStartY) > 3) {
      dragMoved = true;
    }
    moveButton(payload.left, payload.top);
  });

  ipcRenderer.on('hide-widget', () => {
    floatingBtn.classList.add('hidden');
    if (isExpanded) onPanelClose();
    ipcRenderer.send('set-ignore-mouse', true);
  });

  ipcRenderer.on('show-widget', () => {
    floatingBtn.classList.remove('hidden');
  });

  ipcRenderer.on('show-widget-center', (_, payload) => {
    if (payload?.layout) displayLayout = payload.layout;
    floatingBtn.classList.remove('hidden');
    if (isExpanded) onPanelClose();
    const fallbackLeft = (displayLayout?.virtualBounds?.width || window.innerWidth) / 2 - 29;
    const fallbackTop = (displayLayout?.virtualBounds?.height || window.innerHeight) / 2 - 29;
    const left = Number.isFinite(payload?.left) ? payload.left : fallbackLeft;
    const top = Number.isFinite(payload?.top) ? payload.top : fallbackTop;
    moveButton(left, top);
    saveButtonPosition();
    enableMouse();
    setTimeout(() => {
      if (!isExpanded && !isDragging) disableMouse();
    }, 2500);
  });
}


$('close-btn').onclick=onPanelClose;
document.addEventListener('keydown',e=>{if(e.key==='Escape')onPanelClose();});
restoreButtonPosition();refreshDisplayLayout();render();if(!isElectron)openList();
