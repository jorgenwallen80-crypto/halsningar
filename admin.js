(function () {
  'use strict';

  const config = window.HANDELSER_CONFIG || {};
  const dataApi = window.HandelserData;
  const icons = window.HandelserIcons;
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
  let adminPin = '';
  let items = [];
  let editing = null;
  let adminQuizCount = 1;
  let toastTimer = null;

  if (!dataApi || typeof dataApi.verifyAdmin !== 'function' || !icons) {
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
      renderStats();
      list.innerHTML = '';
      if (!items.length) {
        list.innerHTML = '<div class="empty-state"><p>Det finns inga bidrag ännu.</p></div>';
        return;
      }
      items.forEach((item) => {
        const card = document.createElement('article');
        card.className = 'submission-card admin-submission-card';
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
        if (item.content_type==='image' && item.image_path) {
          const imageWrap=document.createElement('button'); imageWrap.type='button'; imageWrap.className='admin-image-preview-button'; imageWrap.setAttribute('aria-label','Öppna bilden stort');
          const image=document.createElement('img'); image.className='admin-image-preview'; image.alt=`Bild från ${item.friend_name}`; image.loading='lazy';
          const loading=document.createElement('span'); loading.className='admin-image-loading'; loading.textContent='Hämtar bild...'; imageWrap.append(image,loading); card.appendChild(imageWrap);
          dataApi.getAdminImageUrl(adminPin,item.id).then((url)=>{image.src=url; loading.remove(); imageWrap.addEventListener('click',()=>window.open(url,'_blank','noopener,noreferrer'));}).catch(()=>{loading.textContent='Bilden kunde inte hämtas'; imageWrap.disabled=true;});
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
        remove.addEventListener('click',async () => {
          if (!confirm('Ta bort bidraget permanent?')) return;
          try {
            await dataApi.adminDelete(adminPin,item.id);
            showToast('Bidraget togs bort');
            await loadDashboard();
          } catch (error) { showToast(error.message); }
        });
        actions.append(edit,remove);
        card.appendChild(actions);
        list.appendChild(card);
      });
    } catch (error) { list.innerHTML = `<div class="error-state"><p>${error.message}</p></div>`; }
  }

  function openEdit(item) {
    editing = item;
    document.getElementById('edit-friend-name').value = item.friend_name || '';
    document.getElementById('edit-unlock-at').value = localValue(item.unlock_at);
    document.getElementById('edit-title').value = item.title || '';
    document.getElementById('edit-body').value = item.body || '';
    document.getElementById('edit-youtube-id').value = item.extra_data?.link_url || (item.youtube_id?`https://youtu.be/${item.youtube_id}`:'');
    const quizQuestions=dataApi.decodeQuizQuestions(item,true); renderAdminQuizEditor(quizQuestions,quizQuestions.length||1);
    document.getElementById('edit-youtube-field').hidden = item.content_type!=='youtube';
    document.getElementById('edit-quiz-fields').hidden = item.content_type!=='quiz';
    setStatus(editStatus,'');
    dialog.hidden = false;
  }
  function closeEdit() { editing = null; dialog.hidden = true; }

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
      const payload = {
        ...editing,
        friend_name:document.getElementById('edit-friend-name').value.trim(),
        unlock_at:new Date(document.getElementById('edit-unlock-at').value).toISOString(),
        title:document.getElementById('edit-title').value.trim(),
        body:document.getElementById('edit-body').value.trim(),
        youtube_id:parseYouTubeId(document.getElementById('edit-youtube-id').value.trim())
      };
      if(payload.content_type==='youtube'){
        const linkUrl=safeUrl(document.getElementById('edit-youtube-id').value);
        if(!linkUrl)throw new Error('Klistra in en giltig https-länk');
        payload.extra_data={...(payload.extra_data||{}),link_url:linkUrl};
      }
      if (!payload.body) throw new Error('Alla händelser behöver ett personligt meddelande');
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
  document.getElementById('close-edit-btn').addEventListener('click',closeEdit);
  dialog.addEventListener('click',(event) => { if (event.target===dialog) closeEdit(); });
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
  document.addEventListener('keydown',(event)=>{if(event.key==='Escape'&&!deleteAllDialog.hidden)closeDeleteAllDialog();});
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
