(function () {
  'use strict';

  const config = window.HANDELSER_CONFIG || {};
  const dataApi = window.HandelserData;
  const icons = window.HandelserIcons;
  const sudokuApi = window.HandelserSudoku;
  const autoLoginPanel = document.getElementById('admin-auto-login-panel');
  const loginPanel = document.getElementById('admin-login-panel');
  const loginForm = document.getElementById('admin-login-form');
  const loginStatus = document.getElementById('admin-login-status');
  const workspace = document.getElementById('admin-workspace');
  const ADMIN_REDIRECT_KEY = 'handelser_admin_redirect_pin';
  const list = document.getElementById('admin-list');
  const stats = document.getElementById('admin-stats');
  const dialog = document.getElementById('edit-dialog');
  const editForm = document.getElementById('admin-edit-form');
  const editStatus = document.getElementById('admin-edit-status');
  const toast = document.getElementById('toast');
  const helpList = document.getElementById('admin-help-list');
  const requestBadge = document.getElementById('request-count-badge');
  const dailyLimitInput = document.getElementById('daily-limit-input');
  const dailyLimitStatus = document.getElementById('daily-limit-status');
  const recipientNameInput = document.getElementById('recipient-name-input');
  const presentationStatus = document.getElementById('presentation-status');
  const previewName = document.getElementById('admin-preview-name');
  const deleteAllDialog = document.getElementById('delete-all-dialog');
  const deleteAllForm = document.getElementById('delete-all-form');
  const deleteAllStatus = document.getElementById('delete-all-status');
  const selectionToolbar = document.getElementById('admin-selection-toolbar');
  const selectionToggle = document.getElementById('toggle-selection-btn');
  const selectAllInput = document.getElementById('select-all-items');
  const selectedCount = document.getElementById('selected-items-count');
  const deleteSelectedButton = document.getElementById('delete-selected-btn');
  const deleteItemsDialog = document.getElementById('delete-items-dialog');
  const deleteItemsForm = document.getElementById('delete-items-form');
  const deleteItemsTitle = document.getElementById('delete-items-title');
  const deleteItemsMessage = document.getElementById('delete-items-message');
  const deleteItemsSummary = document.getElementById('delete-items-summary');
  const deleteItemsStatus = document.getElementById('delete-items-status');
  let adminPin = '';
  let items = [];
  let editing = null;
  let adminQuizCount = 1;
  let toastTimer = null;
  let selectionMode = false;
  let selectedIds = new Set();
  let pendingDeleteIds = [];
  let adminEditImageBlob = null;
  let adminEditImageData = '';
  let adminEditSudoku = null;

  if (!dataApi || typeof dataApi.verifyAdmin !== 'function' || !icons || !sudokuApi) {
    if (autoLoginPanel) autoLoginPanel.hidden = true;
    if (loginPanel) loginPanel.hidden = false;
    if (loginStatus) {
      loginStatus.textContent = 'Appens filer kunde inte läsas in. Ladda om sidan efter att publiceringen är klar.';
      loginStatus.className = 'form-status error';
    }
    return;
  }

  document.getElementById('admin-mode-badge').textContent = config.mode==='local' ? 'Lokalt testläge' : 'Säker livekoppling';
  document.getElementById('local-tools').hidden = config.mode!=='local';

  function icon(name,className) { return icons.icon(name,className); }
  function typeName(type) { return ({text:'Hälsning',image:'Bild',quiz:'Miniquiz',youtube:'Videoklipp / YouTube',sudoku:'Sudoku',fact:'Onödig fakta'})[type] || type; }
  function typeIcon(type) { return ({text:'message',image:'image',quiz:'quiz',youtube:'link',sudoku:'sudoku',fact:'fact'})[type] || 'flower'; }
  function defaultMessageForType(type) {
    return ({image:'En bild till dig 💚',quiz:'Ett litet quiz till dig',youtube:'Ett klipp jag ville dela med dig',sudoku:'Ett litet sudoku när du känner för det',fact:'Lite fullständigt onödig kunskap för dagen'})[type] || '';
  }
  function renderAdminSudoku(puzzle) {
    const grid=document.getElementById('admin-sudoku-preview-grid');
    if(!grid)return;
    grid.innerHTML='';
    String(puzzle || '').padEnd(16,'0').slice(0,16).split('').forEach((value,index)=>{
      const cell=document.createElement('span'); cell.className=`sudoku-cell${value!=='0'?' given':''}`; cell.textContent=value==='0'?'':value;
      if(index%4===1)cell.classList.add('box-right'); if(Math.floor(index/4)===1)cell.classList.add('box-bottom'); grid.appendChild(cell);
    });
  }
  function dataUrlToBlob(dataUrl) {
    const parts=String(dataUrl).split(','); const match=/^data:([^;]+);base64$/.exec(parts[0] || '');
    if(!match||!parts[1])throw new Error('Bilden kunde inte komprimeras');
    const binary=atob(parts[1]); const bytes=new Uint8Array(binary.length); for(let index=0;index<binary.length;index+=1)bytes[index]=binary.charCodeAt(index);
    return new Blob([bytes],{type:match[1]});
  }
  function canvasToBlob(canvas,quality) {
    if(typeof canvas.toBlob!=='function')return Promise.resolve(dataUrlToBlob(canvas.toDataURL('image/jpeg',quality)));
    return new Promise((resolve,reject)=>canvas.toBlob((blob)=>blob?resolve(blob):reject(new Error('Bilden kunde inte komprimeras')),'image/jpeg',quality));
  }
  function blobToDataUrl(blob) {
    return new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result||''));reader.onerror=()=>reject(new Error('Förhandsvisningen kunde inte skapas'));reader.readAsDataURL(blob);});
  }
  async function compressAdminImage(file) {
    if(!file||!String(file.type||'').startsWith('image/'))throw new Error('Filen verkar inte vara en bild');
    let image=null,closeImage=false;
    if('createImageBitmap' in window){image=await createImageBitmap(file).catch(()=>null);closeImage=Boolean(image&&typeof image.close==='function');}
    if(!image){image=await new Promise((resolve,reject)=>{const url=URL.createObjectURL(file);const img=new Image();img.onload=()=>{URL.revokeObjectURL(url);resolve(img);};img.onerror=()=>{URL.revokeObjectURL(url);reject(new Error('Bilden kunde inte läsas'));};img.src=url;});}
    const width=image.width||image.naturalWidth,height=image.height||image.naturalHeight;if(!width||!height)throw new Error('Bilden saknar läsbara dimensioner');
    const maxDimension=Number(config.maxImageDimension||1400);let ratio=Math.min(1,maxDimension/Math.max(width,height));
    let canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(width*ratio));canvas.height=Math.max(1,Math.round(height*ratio));canvas.getContext('2d',{alpha:false}).drawImage(image,0,0,canvas.width,canvas.height);if(closeImage)image.close();
    const maxBytes=Number(config.maxImageBytes||360000);let blob=null;
    for(const quality of [.86,.78,.7,.62,.54]){blob=await canvasToBlob(canvas,quality);if(blob.size<=maxBytes)break;}
    while(blob&&blob.size>maxBytes&&Math.max(canvas.width,canvas.height)>720){const smaller=document.createElement('canvas');smaller.width=Math.round(canvas.width*.82);smaller.height=Math.round(canvas.height*.82);smaller.getContext('2d',{alpha:false}).drawImage(canvas,0,0,smaller.width,smaller.height);canvas=smaller;blob=await canvasToBlob(canvas,.62);}
    if(!blob||blob.size>500000)throw new Error('Bilden blev fortfarande för stor. Prova en annan bild.');
    return {blob,dataUrl:await blobToDataUrl(blob)};
  }
  function setStatus(element,message,kind) {
    element.textContent = message || '';
    element.className = `form-status${kind?` ${kind}`:''}`;
  }
  function showToast(message) {
    toast.textContent = message;
    toast.hidden = false;
    requestAnimationFrame(() => toast.classList.add('show'));
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => { toast.hidden = true; },250);
    },2800);
  }
  function localValue(value) {
    const date = new Date(value);
    return new Date(date.getTime()-date.getTimezoneOffset()*60000).toISOString().slice(0,16);
  }
  function previewText(item) {
    if (item.body) return item.body;
    if (item.content_type==='quiz') { const questions=dataApi.decodeQuizQuestions(item,true); return questions.length?`${questions.length} ${questions.length===1?'fråga':'frågor'} · ${questions[0].question}`:'Miniquiz utan frågor'; }
    if (item.content_type==='youtube') return item.extra_data?.link_url || (item.youtube_id?`YouTube: ${item.youtube_id}`:'Videoklipp / YouTube');
    if (item.content_type==='image') return 'Bild';
    if (item.content_type==='sudoku') return 'Lätt 4 × 4-sudoku';
    if (item.content_type==='fact') return item.extra_data?.fact_text || 'Onödig fakta';
    return 'Inget meddelande';
  }

  function itemDeleteLabel(item) {
    const title=item.title || typeName(item.content_type);
    const sender=item.friend_name || 'Okänd avsändare';
    const when=new Date(item.unlock_at).toLocaleString('sv-SE',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'});
    return `${title} · ${sender} · ${when}`;
  }
  function updateSelectionToolbar() {
    const validIds=new Set(items.map((item)=>item.id));
    selectedIds=new Set(Array.from(selectedIds).filter((id)=>validIds.has(id)));
    const count=selectedIds.size;
    selectionToolbar.hidden=!selectionMode;
    selectionToggle.setAttribute('aria-expanded',String(selectionMode));
    selectionToggle.classList.toggle('active',selectionMode);
    const toggleLabel=selectionToggle.querySelector('span:last-child');
    if(toggleLabel)toggleLabel.textContent=selectionMode?'Klart':'Välj flera';
    selectedCount.textContent=`${count} ${count===1?'vald':'valda'}`;
    deleteSelectedButton.disabled=count===0;
    const allSelected=items.length>0&&count===items.length;
    selectAllInput.checked=allSelected;
    selectAllInput.indeterminate=count>0&&!allSelected;
  }
  function setSelectionMode(open) {
    selectionMode=Boolean(open);
    if(!selectionMode)selectedIds.clear();
    updateSelectionToolbar();
    loadItems();
  }
  function setItemSelected(id,selected) {
    if(selected)selectedIds.add(id);else selectedIds.delete(id);
    const card=list.querySelector(`[data-memory-id="${CSS.escape(String(id))}"]`);
    if(card){card.classList.toggle('selected',selected);const input=card.querySelector('[data-select-memory]');if(input)input.checked=selected;}
    updateSelectionToolbar();
  }
  function closeDeleteItemsDialog() {
    deleteItemsDialog.hidden=true;
    pendingDeleteIds=[];
    deleteItemsSummary.innerHTML='';
    setStatus(deleteItemsStatus,'');
    document.body.classList.remove('dialog-open');
  }
  function openDeleteItemsDialog(ids) {
    const unique=Array.from(new Set(ids)).filter((id)=>items.some((item)=>item.id===id));
    if(!unique.length)return;
    pendingDeleteIds=unique;
    const selectedItems=unique.map((id)=>items.find((item)=>item.id===id)).filter(Boolean);
    const plural=selectedItems.length>1;
    deleteItemsTitle.textContent=plural?`Radera ${selectedItems.length} händelser?`:'Radera händelsen?';
    deleteItemsMessage.textContent=plural?'Alla valda händelser och tillhörande bilder tas bort permanent. Detta går inte att ångra.':'Händelsen och eventuell tillhörande bild tas bort permanent. Detta går inte att ångra.';
    deleteItemsSummary.innerHTML='';
    selectedItems.slice(0,6).forEach((item)=>{const row=document.createElement('div');row.className='delete-summary-row';row.textContent=itemDeleteLabel(item);deleteItemsSummary.appendChild(row);});
    if(selectedItems.length>6){const more=document.createElement('div');more.className='delete-summary-more';more.textContent=`+ ${selectedItems.length-6} till`;deleteItemsSummary.appendChild(more);}
    const confirmLabel=document.querySelector('#confirm-delete-items-btn span:last-child');
    if(confirmLabel)confirmLabel.textContent=plural?`Radera ${selectedItems.length} permanent`:'Radera permanent';
    deleteItemsDialog.hidden=false;
    document.body.classList.add('dialog-open');
    document.getElementById('cancel-delete-items-btn').focus();
  }

  function emptyQuizQuestion(){return {question:'',options:['','','',''],answer:'',explanation:''};}
  function readAdminQuizQuestions(){
    return Array.from(document.querySelectorAll('#edit-quiz-questions .quiz-question-card')).map((card,index)=>{
      const rawOptions=Array.from(card.querySelectorAll('[data-admin-quiz-option]')).map((input)=>input.value.trim());
      const selected=Number(card.querySelector(`input[name="admin-quiz-correct-${index}"]:checked`)?.value||0);
      return {question:card.querySelector('[data-admin-quiz-question]').value.trim(),options:rawOptions.filter(Boolean),answer:rawOptions[selected]||'',explanation:card.querySelector('[data-admin-quiz-explanation]').value.trim()};
    });
  }
  function renderAdminQuizEditor(values,countOverride){
    const editor=document.getElementById('edit-quiz-questions');
    if(!editor)return;
    const source=Array.isArray(values)?values:[]; adminQuizCount=Math.max(1,Math.min(4,Number(countOverride||source.length||adminQuizCount||1)));
    document.querySelectorAll('[data-admin-quiz-count]').forEach((button)=>button.classList.toggle('active',Number(button.dataset.adminQuizCount)===adminQuizCount));
    editor.innerHTML='';
    for(let questionIndex=0;questionIndex<adminQuizCount;questionIndex+=1){
      const value={...emptyQuizQuestion(),...(source[questionIndex]||{})}; const section=document.createElement('section'); section.className='quiz-question-card';
      const heading=document.createElement('div'); heading.className='quiz-question-editor-heading'; const number=document.createElement('span'); number.className='quiz-question-number'; number.textContent=`Fråga ${questionIndex+1}`; const progress=document.createElement('span'); progress.className='quiz-question-progress'; progress.textContent=`${questionIndex+1} av ${adminQuizCount}`; heading.append(number,progress); section.appendChild(heading);
      const qField=document.createElement('div'); qField.className='field'; const qLabel=document.createElement('label'); qLabel.textContent='Frågetext'; const q=document.createElement('textarea'); q.className='textarea'; q.dataset.adminQuizQuestion=String(questionIndex); q.maxLength=600; q.value=value.question||''; qField.append(qLabel,q); section.appendChild(qField);
      const fieldset=document.createElement('fieldset'); fieldset.className='clean-fieldset quiz-answer-fieldset'; const legend=document.createElement('legend'); legend.className='form-label'; legend.textContent='Svarsalternativ och rätt svar'; fieldset.appendChild(legend);
      const padded=Array.isArray(value.options)?[...value.options]:[]; while(padded.length<4)padded.push(''); padded.slice(0,4).forEach((option,optionIndex)=>{ const row=document.createElement('div'); row.className='quiz-option-row'; const radio=document.createElement('input'); radio.type='radio'; radio.name=`admin-quiz-correct-${questionIndex}`; radio.value=String(optionIndex); radio.checked=value.answer?option===value.answer:optionIndex===0; const input=document.createElement('input'); input.className='text-input'; input.dataset.adminQuizOption=String(optionIndex); input.maxLength=160; input.placeholder=`Svarsalternativ ${optionIndex+1}${optionIndex>1?' (frivilligt)':''}`; input.value=option||''; row.append(radio,input); fieldset.appendChild(row); }); section.appendChild(fieldset);
      const eField=document.createElement('div'); eField.className='field'; const eLabel=document.createElement('label'); eLabel.textContent='Förklaring efter svaret (frivillig)'; const explanation=document.createElement('textarea'); explanation.className='textarea'; explanation.dataset.adminQuizExplanation=String(questionIndex); explanation.maxLength=1000; explanation.value=value.explanation||''; eField.append(eLabel,explanation); section.appendChild(eField); editor.appendChild(section);
    }
  }

  function safeUrl(value) {
    try { const url=new URL(String(value || '').trim()); return url.protocol==='https:'?url.href:''; } catch (_) { return ''; }
  }
  function parseYouTubeId(value) {
    const raw=String(value || '').trim(); if(!raw)return '';
    if(/^[A-Za-z0-9_-]{11}$/.test(raw))return raw;
    try{const url=new URL(raw);if(url.hostname.includes('youtu.be'))return url.pathname.split('/').filter(Boolean)[0]||'';if(url.searchParams.get('v'))return url.searchParams.get('v');const parts=url.pathname.split('/').filter(Boolean);const marker=parts.findIndex((part)=>['embed','shorts','live'].includes(part));return marker>=0?(parts[marker+1]||''):'';}catch(_){return '';}
  }

  function renderStats() {
    const now = new Date();
    const unlocked = items.filter((item) => new Date(item.unlock_at)<=now).length;
    const future = items.length-unlocked;
    stats.innerHTML = '';
    [['Totalt',items.length],['Öppnade',unlocked],['På väg',future]].forEach(([label,value]) => {
      const card = document.createElement('div');
      card.className = 'stat-card';
      card.append(document.createElement('strong'),document.createElement('span'));
      card.children[0].textContent = value;
      card.children[1].textContent = label;
      stats.appendChild(card);
    });
  }

  async function loadSettings() {
    try { const settings=await dataApi.getAdminSettings(adminPin); dailyLimitInput.value=Number(settings?.daily_limit || 6); }
    catch(error){setStatus(dailyLimitStatus,error.message,'error');}
  }

  function renderPresentationPreview() {
    const name=String(recipientNameInput.value || '').trim();
    previewName.textContent=name?`Hej ${name}`:'Hej';
  }

  async function loadPresentation() {
    try {
      const value=await dataApi.getAdminPresentation(adminPin);
      recipientNameInput.value=String(value?.recipient_name || '');
      renderPresentationPreview();
      setStatus(presentationStatus,'');
    } catch(error) { setStatus(presentationStatus,error.message,'error'); }
  }

  async function loadHelpRequests() {
    helpList.innerHTML='<div class="loading-state"><span class="soft-spinner"></span><p>Hämtar förfrågningar</p></div>';
    try{
      const requests=await dataApi.getAdminHelpRequests(adminPin); helpList.innerHTML='';
      requestBadge.textContent=String(requests.length); requestBadge.hidden=!requests.length;
      if(!requests.length){helpList.innerHTML='<div class="empty-state"><p>Inga öppna förfrågningar.</p></div>';return;}
      requests.forEach((request)=>{
        const memory=request.memory || items.find((item)=>item.id===request.memory_id) || null;
        const card=document.createElement('article');card.className='submission-card help-request-card';
        const top=document.createElement('div');top.className='submission-card-top';const mark=document.createElement('div');mark.className='submission-type-icon';mark.appendChild(icon(request.request_type==='delete'?'trash':'edit'));
        const copy=document.createElement('div');copy.className='submission-copy';const title=document.createElement('h3');title.textContent=request.request_type==='delete'?'Önskar radera':'Önskar ändra';
        const meta=document.createElement('div');meta.className='submission-meta';meta.textContent=memory?`${memory.title || typeName(memory.content_type)} · ${memory.friend_name}`:'Bidraget finns inte längre';
        const message=document.createElement('p');message.className='submission-preview';message.textContent=request.message || 'Inget extra meddelande.';copy.append(title,meta,message);top.append(mark,copy);card.appendChild(top);
        const actions=document.createElement('div');actions.className='submission-actions';
        if(memory){const open=document.createElement('button');open.className='small-button button-with-icon';open.type='button';open.append(icon('edit'),document.createTextNode('Öppna bidraget'));open.addEventListener('click',()=>openEdit(memory));actions.appendChild(open);}
        const done=document.createElement('button');done.className='small-button button-with-icon';done.type='button';done.append(icon('check'),document.createTextNode('Markera klar'));done.addEventListener('click',async()=>{try{await dataApi.resolveAdminHelpRequest(adminPin,request.id);showToast('Förfrågan markerades som klar');await loadHelpRequests();}catch(error){showToast(error.message);}});actions.appendChild(done);card.appendChild(actions);helpList.appendChild(card);
      });
    }catch(error){helpList.innerHTML=`<div class="error-state"><p>${error.message}</p></div>`;}
  }

  async function loadDashboard(){await Promise.all([loadItems(),loadSettings(),loadPresentation()]);await loadHelpRequests();}

  async function loadItems() {
    list.innerHTML = '<div class="loading-state"><span class="soft-spinner"></span><p>Hämtar tidslinjen</p></div>';
    try {
      items = await dataApi.getAdminMemories(adminPin);
      const validIds=new Set(items.map((item)=>item.id));
      selectedIds=new Set(Array.from(selectedIds).filter((id)=>validIds.has(id)));
      renderStats();
      list.innerHTML = '';
      if (!items.length) {
        list.innerHTML = '<div class="empty-state"><p>Det finns inga bidrag ännu.</p></div>';
        if(selectionMode)setSelectionMode(false);else updateSelectionToolbar();
        return;
      }
      items.forEach((item) => {
        const card = document.createElement('article');
        card.className = 'submission-card admin-submission-card';
        card.dataset.memoryId=String(item.id);
        if(selectionMode){
          card.classList.add('selection-enabled');
          const selectLabel=document.createElement('label');selectLabel.className='admin-select-control';
          const selectInput=document.createElement('input');selectInput.type='checkbox';selectInput.dataset.selectMemory=String(item.id);selectInput.checked=selectedIds.has(item.id);selectInput.setAttribute('aria-label',`Välj ${item.title || typeName(item.content_type)}`);
          const selectMark=document.createElement('span');selectMark.setAttribute('aria-hidden','true');selectLabel.append(selectInput,selectMark);card.appendChild(selectLabel);
          card.classList.toggle('selected',selectInput.checked);
          selectInput.addEventListener('change',()=>setItemSelected(item.id,selectInput.checked));
          card.addEventListener('click',(event)=>{if(event.target.closest('button,input,label,a'))return;setItemSelected(item.id,!selectedIds.has(item.id));});
        }
        const top = document.createElement('div');
        top.className = 'submission-card-top';
        const typeMark = document.createElement('div');
        typeMark.className = 'submission-type-icon';
        typeMark.appendChild(icon(typeIcon(item.content_type)));
        const copy = document.createElement('div');
        copy.className = 'submission-copy';
        const title = document.createElement('h3');
        title.textContent = item.title || typeName(item.content_type);
        const meta = document.createElement('div');
        meta.className = 'submission-meta';
        meta.textContent = `${new Date(item.unlock_at).toLocaleString('sv-SE',{weekday:'short',day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})} · ${item.friend_name}`;
        const preview = document.createElement('p');
        preview.className = 'submission-preview';
        preview.textContent = previewText(item).slice(0,180);
        const badges = document.createElement('div');
        badges.className = 'submission-badges';
        const badge = document.createElement('span');
        badge.className = 'card-type';
        badge.textContent = typeName(item.content_type);
        badges.appendChild(badge);
        copy.append(title,meta,preview,badges);
        top.append(typeMark,copy);
        card.appendChild(top);
        if (item.content_type==='image' && (item.image_path || item.image_data)) {
          const imageWrap=document.createElement('button'); imageWrap.type='button'; imageWrap.className='admin-image-preview-button'; imageWrap.setAttribute('aria-label','Öppna bilden stort');
          const image=document.createElement('img'); image.className='admin-image-preview'; image.alt=`Bild från ${item.friend_name}`; image.loading='lazy';
          const loading=document.createElement('span'); loading.className='admin-image-loading'; loading.textContent='Hämtar bild...'; imageWrap.append(image,loading); card.appendChild(imageWrap);
          Promise.resolve(item.image_data || dataApi.getAdminImageUrl(adminPin,item.id)).then((url)=>{
            if (!url) throw new Error('Ingen bild');
            image.src=url; loading.remove(); imageWrap.addEventListener('click',()=>window.open(url,'_blank','noopener,noreferrer'));
          }).catch(()=>{loading.textContent='Bilden kunde inte hämtas'; imageWrap.disabled=true;});
        }

        const actions = document.createElement('div');
        actions.className = 'submission-actions';
        const edit = document.createElement('button');
        edit.className = 'small-button button-with-icon';
        edit.type = 'button';
        edit.append(icon('edit'),document.createTextNode('Ändra'));
        edit.addEventListener('click',() => openEdit(item));
        const remove = document.createElement('button');
        remove.className = 'small-button delete button-with-icon';
        remove.type = 'button';
        remove.append(icon('trash'),document.createTextNode('Ta bort'));
        remove.addEventListener('click',() => openDeleteItemsDialog([item.id]));
        actions.append(edit,remove);
        card.appendChild(actions);
        list.appendChild(card);
      });
      updateSelectionToolbar();
    } catch (error) { list.innerHTML = `<div class="error-state"><p>${error.message}</p></div>`; }
  }

  function openEdit(item) {
    editing = item;
    adminEditImageBlob=null; adminEditImageData='';
    document.getElementById('edit-friend-name').value = item.friend_name || '';
    document.getElementById('edit-unlock-at').value = localValue(item.unlock_at);
    document.getElementById('edit-title').value = item.title || '';
    document.getElementById('edit-body').value = item.body || '';
    document.getElementById('edit-youtube-id').value = item.extra_data?.link_url || (item.youtube_id?`https://youtu.be/${item.youtube_id}`:'');
    document.getElementById('edit-fact-text').value = item.extra_data?.fact_text || '';
    const quizQuestions=dataApi.decodeQuizQuestions(item,true); renderAdminQuizEditor(quizQuestions,quizQuestions.length||1);
    const optional=item.content_type!=='text'; document.getElementById('admin-message-optional-label').hidden=!optional; document.getElementById('edit-body').required=!optional;
    document.getElementById('edit-youtube-field').hidden = item.content_type!=='youtube';
    document.getElementById('edit-image-field').hidden = item.content_type!=='image';
    document.getElementById('edit-fact-field').hidden = item.content_type!=='fact';
    document.getElementById('edit-sudoku-field').hidden = item.content_type!=='sudoku';
    document.getElementById('edit-quiz-fields').hidden = item.content_type!=='quiz';
    const preview=document.getElementById('admin-edit-image-preview'); const imageStatus=document.getElementById('admin-edit-image-status'); const imageInput=document.getElementById('admin-image-upload');
    imageInput.value=''; preview.hidden=true; preview.removeAttribute('src'); imageStatus.textContent='Nuvarande bild behålls om du inte väljer en ny.';
    if(item.content_type==='image'){
      const imageMemoryId=item.id;
      imageStatus.textContent='Hämtar nuvarande bild...';
      Promise.resolve(item.image_data||dataApi.getAdminImageUrl(adminPin,item.id)).then((url)=>{if(!url)throw new Error('Ingen bild');if(editing?.id!==imageMemoryId)return;preview.src=url;preview.hidden=false;imageStatus.textContent='Nuvarande bild behålls om du inte väljer en ny.';}).catch(()=>{if(editing?.id===imageMemoryId)imageStatus.textContent='Bilden kunde inte förhandsvisas, men den behålls om du sparar.';});
    }
    if(item.content_type==='sudoku'){
      const generated=sudokuApi.generate();
      adminEditSudoku={puzzle:item.extra_data?.sudoku_puzzle||generated.puzzle,solution:item.extra_data?.sudoku_solution||generated.solution};renderAdminSudoku(adminEditSudoku.puzzle);
    } else adminEditSudoku=null;
    setStatus(editStatus,'');
    dialog.hidden = false; document.body.classList.add('dialog-open');
  }
  function closeEdit() { editing = null; dialog.hidden = true; document.body.classList.remove('dialog-open'); }

  function verifyWithTimeout(promise) {
    return Promise.race([
      promise,
      new Promise((_,reject)=>setTimeout(()=>reject(new Error('Kontrollen tog för lång tid. Kontrollera anslutningen och försök igen.')),15000))
    ]);
  }

  async function enterAdmin(pin,{redirected=false}={}) {
    if(!pin){ autoLoginPanel.hidden=true; loginPanel.hidden=false; return; }
    autoLoginPanel.hidden=!redirected;
    loginPanel.hidden=redirected;
    workspace.hidden=true;
    setStatus(loginStatus,'Kontrollerar koden...');
    try {
      await verifyWithTimeout(dataApi.verifyAdmin(pin));
      adminPin = pin;
      autoLoginPanel.hidden = true;
      loginPanel.hidden = true;
      workspace.hidden = false;
      setStatus(loginStatus,'');
      await loadDashboard();
    } catch (error) {
      autoLoginPanel.hidden=true;
      loginPanel.hidden=false;
      workspace.hidden=true;
      setStatus(loginStatus,error.message,'error');
      document.getElementById('admin-pin').focus();
    }
  }

  loginForm.addEventListener('submit',async (event) => {
    event.preventDefault();
    await enterAdmin(document.getElementById('admin-pin').value.trim());
  });

  editForm.addEventListener('submit',async (event) => {
    event.preventDefault();
    if (!editing) return;
    const button = document.getElementById('save-admin-edit-btn');
    button.disabled = true;
    setStatus(editStatus,'Sparar...');
    try {
      const bodyInput=document.getElementById('edit-body').value.trim();
      const payload = {
        ...editing,
        friend_name:document.getElementById('edit-friend-name').value.trim(),
        unlock_at:new Date(document.getElementById('edit-unlock-at').value).toISOString(),
        title:document.getElementById('edit-title').value.trim(),
        body:bodyInput || defaultMessageForType(editing.content_type),
        youtube_id:parseYouTubeId(document.getElementById('edit-youtube-id').value.trim()),
        previous_image_path:editing.image_path || '',
        image_blob:adminEditImageBlob,
        image_data:adminEditImageData || editing.image_data || ''
      };
      if(payload.content_type==='youtube'){
        const linkUrl=safeUrl(document.getElementById('edit-youtube-id').value);
        if(!linkUrl)throw new Error('Klistra in en giltig https-länk');
        payload.extra_data={...(payload.extra_data||{}),link_url:linkUrl};
      }
      if(payload.content_type==='text'&&!bodyInput)throw new Error('Hälsningar behöver ett personligt meddelande');
      if(payload.content_type==='fact'){
        const factText=document.getElementById('edit-fact-text').value.trim(); if(!factText)throw new Error('Skriv den onödiga faktan');
        payload.extra_data={...(payload.extra_data||{}),fact_mode:'custom',fact_id:'',fact_category:'Egen',fact_text:factText};
      }
      if(payload.content_type==='sudoku'){
        if(!adminEditSudoku)adminEditSudoku=sudokuApi.generate();
        payload.extra_data={...(payload.extra_data||{}),sudoku_puzzle:adminEditSudoku.puzzle,sudoku_solution:adminEditSudoku.solution,sudoku_size:4};
      }
      if(payload.content_type==='quiz'){
        const questions=readAdminQuizQuestions(); questions.forEach((question,index)=>{if(!question.question)throw new Error(`Skriv fråga ${index+1}`);if(question.options.length<2)throw new Error(`Fråga ${index+1} behöver minst två svar`);if(!question.answer)throw new Error(`Markera rätt svar på fråga ${index+1}`);});
        Object.assign(payload,dataApi.encodeQuizQuestions(questions));
      }
      await dataApi.adminUpdate(adminPin,editing.id,payload);
      closeEdit();
      showToast('Ändringarna är sparade');
      await loadDashboard();
    } catch (error) { setStatus(editStatus,error.message,'error'); }
    finally { button.disabled = false; }
  });

  document.querySelectorAll('[data-admin-quiz-count]').forEach((button)=>button.addEventListener('click',()=>renderAdminQuizEditor(readAdminQuizQuestions(),Number(button.dataset.adminQuizCount))));
  renderAdminQuizEditor([],1);
  document.getElementById('admin-new-sudoku-btn').addEventListener('click',()=>{adminEditSudoku=sudokuApi.generate();renderAdminSudoku(adminEditSudoku.puzzle);showToast('Ett nytt sudoku är redo att sparas');});
  document.getElementById('admin-image-upload').addEventListener('change',async(event)=>{
    const file=event.target.files&&event.target.files[0]; if(!file)return;
    const status=document.getElementById('admin-edit-image-status'); const preview=document.getElementById('admin-edit-image-preview'); status.textContent='Komprimerar bilden...';
    try{const result=await compressAdminImage(file);adminEditImageBlob=result.blob;adminEditImageData=result.dataUrl;preview.src=result.dataUrl;preview.hidden=false;status.textContent=`Ny bild klar. Cirka ${Math.round(result.blob.size/1024)} kB.`;}
    catch(error){adminEditImageBlob=null;adminEditImageData='';event.target.value='';status.textContent=error.message;}
  });
  document.getElementById('close-edit-btn').addEventListener('click',closeEdit);
  dialog.addEventListener('click',(event) => { if (event.target===dialog) closeEdit(); });
  selectionToggle.addEventListener('click',()=>setSelectionMode(!selectionMode));
  document.getElementById('cancel-selection-btn').addEventListener('click',()=>setSelectionMode(false));
  selectAllInput.addEventListener('change',()=>{selectedIds=selectAllInput.checked?new Set(items.map((item)=>item.id)):new Set();loadItems();});
  deleteSelectedButton.addEventListener('click',()=>openDeleteItemsDialog(Array.from(selectedIds)));
  document.getElementById('cancel-delete-items-btn').addEventListener('click',closeDeleteItemsDialog);
  deleteItemsDialog.addEventListener('click',(event)=>{if(event.target===deleteItemsDialog)closeDeleteItemsDialog();});
  deleteItemsForm.addEventListener('submit',async(event)=>{
    event.preventDefault();
    if(!pendingDeleteIds.length)return;
    const ids=[...pendingDeleteIds];
    const button=document.getElementById('confirm-delete-items-btn');
    button.disabled=true;
    try{
      for(let index=0;index<ids.length;index+=1){
        setStatus(deleteItemsStatus,ids.length>1?`Raderar ${index+1} av ${ids.length}...`:'Raderar händelsen...');
        await dataApi.adminDelete(adminPin,ids[index]);
      }
      ids.forEach((id)=>selectedIds.delete(id));
      const count=ids.length;
      closeDeleteItemsDialog();
      if(selectionMode&&selectedIds.size===0)selectionMode=false;
      showToast(count===1?'Händelsen och eventuell bild raderades':`${count} händelser och tillhörande bilder raderades`);
      await loadDashboard();
    }catch(error){setStatus(deleteItemsStatus,error.message,'error');}
    finally{button.disabled=false;}
  });
  document.getElementById('refresh-admin-btn').addEventListener('click',loadDashboard);
  document.getElementById('reset-demo-btn').addEventListener('click',async () => {
    if (!confirm('Återställa all lokal testdata till originalexemplen?')) return;
    await dataApi.resetLocalDemo();
    showToast('Testdatan är återställd');
    await loadDashboard();
  });
  recipientNameInput.addEventListener('input',renderPresentationPreview);
  document.getElementById('presentation-form').addEventListener('submit',async(event)=>{
    event.preventDefault();
    setStatus(presentationStatus,'Sparar...');
    try {
      await dataApi.updateAdminPresentation(adminPin,{recipient_name:recipientNameInput.value,welcome_message:''});
      renderPresentationPreview();
      setStatus(presentationStatus,'Namnet är sparat.','success');
      showToast('Namnet uppdaterades');
    } catch(error) { setStatus(presentationStatus,error.message,'error'); }
  });
  document.getElementById('daily-limit-form').addEventListener('submit',async(event)=>{event.preventDefault();setStatus(dailyLimitStatus,'Sparar...');try{await dataApi.updateAdminSettings(adminPin,{daily_limit:Number(dailyLimitInput.value)});setStatus(dailyLimitStatus,`Gränsen är nu ${Number(dailyLimitInput.value)} per dag.`,'success');showToast('Dagens gräns uppdaterades');}catch(error){setStatus(dailyLimitStatus,error.message,'error');}});
  function closeDeleteAllDialog(){deleteAllDialog.hidden=true;deleteAllForm.reset();setStatus(deleteAllStatus,'');document.body.classList.remove('dialog-open');}
  document.getElementById('delete-all-btn').addEventListener('click',()=>{deleteAllDialog.hidden=false;document.body.classList.add('dialog-open');document.getElementById('delete-admin-pin').focus();});
  document.getElementById('cancel-delete-all-btn').addEventListener('click',closeDeleteAllDialog);
  deleteAllDialog.addEventListener('click',(event)=>{if(event.target===deleteAllDialog)closeDeleteAllDialog();});
  deleteAllForm.addEventListener('submit',async(event)=>{
    event.preventDefault();
    const pin=document.getElementById('delete-admin-pin').value.trim();
    const confirmation=document.getElementById('delete-confirmation').value.trim();
    const button=document.getElementById('confirm-delete-all-btn');
    if(pin!==adminPin){setStatus(deleteAllStatus,'Adminkoden stämmer inte.','error');return;}
    button.disabled=true;setStatus(deleteAllStatus,'Raderar bilder och innehåll...');
    try{await dataApi.adminDeleteAll(pin,confirmation);closeDeleteAllDialog();showToast('Tidslinjens innehåll är permanent raderat');await loadDashboard();}
    catch(error){setStatus(deleteAllStatus,error.message,'error');}
    finally{button.disabled=false;}
  });
  document.addEventListener('keydown',(event)=>{if(event.key!=='Escape')return;if(!deleteItemsDialog.hidden)closeDeleteItemsDialog();else if(!deleteAllDialog.hidden)closeDeleteAllDialog();});
  dataApi.subscribe(() => { if (adminPin) loadDashboard(); });
  const redirectedPin=sessionStorage.getItem(ADMIN_REDIRECT_KEY)||'';
  if(redirectedPin){
    sessionStorage.removeItem(ADMIN_REDIRECT_KEY);
    document.getElementById('admin-pin').value=redirectedPin;
    enterAdmin(redirectedPin,{redirected:true});
  } else {
    autoLoginPanel.hidden=true;
    loginPanel.hidden=false;
    document.getElementById('admin-pin').focus();
  }

})();
