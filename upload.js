(function () {
  'use strict';

  const config = window.HANDELSER_CONFIG || {};
  const dataApi = window.HandelserData;
  const icons = window.HandelserIcons;
  const facts = window.HandelserFacts;
  const sudokuApi = window.HandelserSudoku;
  const $ = (id) => document.getElementById(id);
  const autoLoginPanel = $('friend-auto-login-panel');
  const loginPanel = $('friend-login-panel');
  const loginForm = $('friend-login-form');
  const pinInput = $('friend-pin');
  const loginStatus = $('friend-login-status');
  const FRIEND_REDIRECT_KEY = 'handelser_friend_redirect_pin';
  const workspace = $('friend-workspace');
  const memoryForm = $('memory-form');
  const formStatus = $('memory-form-status');
  const submitButton = $('submit-memory-btn');
  const cancelEditButton = $('cancel-edit-btn');
  const previewPanel = $('preview-panel');
  const previewCard = $('preview-card');
  const submissions = $('my-submissions');
  const toast = $('toast');
  const imageInput = $('image-upload');
  const imagePreview = $('image-preview');
  const imageSizeStatus = $('image-size-status');
  const dailyStatus = $('daily-limit-status');
  const messageInput = $('memory-message');
  const emojiToggle = $('emoji-toggle');
  const emojiPicker = $('emoji-picker');

  if (!dataApi || typeof dataApi.verifyFriend !== 'function' || !icons || !facts || !sudokuApi) {
    if (autoLoginPanel) autoLoginPanel.hidden = true;
    if (loginPanel) loginPanel.hidden = false;
    if (loginStatus) {
      loginStatus.textContent = 'Appens filer kunde inte läsas in. Ladda om sidan efter att publiceringen är klar.';
      loginStatus.className = 'form-status error';
    }
    return;
  }

  const TOKEN_KEY = 'handelser_contributor_token';
  const NAME_KEY = 'handelser_friend_name';
  const contributorToken = localStorage.getItem(TOKEN_KEY) || (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`);
  localStorage.setItem(TOKEN_KEY,contributorToken);

  let friendPin = '';
  let currentType = 'text';
  let editingId = '';
  let compressedImage = '';
  let compressedImageBlob = null;
  let previousImage = '';
  let previousImagePath = '';
  let currentSudoku = sudokuApi.generate();
  let currentFact = null;
  let quizCount = 1;
  let toastTimer = null;
  let dailyTimer = null;
  let friendTimelineLoading = false;
  let friendTimelineSignature = '';
  let mySubmissionsLoading = false;
  let mySubmissionsSignature = '';

  $('mode-badge').textContent = config.mode==='local' ? 'Lokalt testläge' : 'Säker livekoppling';

  function el(tag,className,text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text!==undefined) node.textContent = text;
    return node;
  }
  function icon(name,className) { return icons.icon(name,className); }
  function typeLabel(type) { return ({text:'Hälsning',image:'Bild',quiz:'Miniquiz',youtube:'Videoklipp / YouTube',sudoku:'Sudoku',fact:'Onödig fakta'})[type] || 'Händelse'; }
  function typeIcon(type) { return ({text:'message',image:'image',quiz:'quiz',youtube:'link',sudoku:'sudoku',fact:'fact'})[type] || 'flower'; }
  function formCopy(type) {
    return ({
      text:{title:'Skicka en hälsning',intro:'Skriv något personligt som öppnas på den tid du väljer.'},
      image:{title:'Dela en bild',intro:'Välj en bild och skriv några ord som visas tillsammans med den.'},
      quiz:{title:'Skapa ett miniquiz',intro:'Skapa 1 till 4 frågor som öppnas på den tid du väljer.'},
      youtube:{title:'Skicka ett videoklipp',intro:'Dela ett YouTube-klipp eller en annan videolänk tillsammans med ett personligt meddelande.'},
      sudoku:{title:'Lägg in ett sudoku',intro:'Lägg in ett lätt sudoku tillsammans med en hälsning.'},
      fact:{title:'Dela onödig fakta',intro:'Välj en rolig fakta eller skriv en egen.'}
    })[type] || {title:'Skicka något fint',intro:'Välj vad du vill skicka.'};
  }
  function updateFormCopy(type) {
    const copy=formCopy(type);
    $('form-title').textContent=copy.title;
    $('form-intro').textContent=copy.intro;
    const titleInput=$('memory-title');
    if(titleInput){
      titleInput.placeholder=({
        text:'Skriv en rubrik om du vill',
        image:'Ge bilden en rubrik om du vill',
        quiz:'Namnge quizet om du vill',
        youtube:'Skriv vad klippet handlar om, om du vill',
        sudoku:'Lägg till en rubrik om du vill',
        fact:'Ge faktan en rubrik om du vill'
      })[type] || 'Skriv en rubrik om du vill';
    }
    const panel=$('create-panel');
    if(panel){panel.className=`panel entry-theme-${type}`;panel.dataset.entryType=type;}
  }
  function defaultMessageForType(type) {
    return ({
      image:'En bild till dig 💚',
      quiz:'Ett litet quiz till dig',
      youtube:'Ett klipp jag ville dela med dig',
      sudoku:'Ett litet sudoku när du känner för det',
      fact:'Lite fullständigt onödig kunskap för dagen'
    })[type] || '';
  }
  function updateMessageRequirement(type) {
    const optionalLabel=$('message-optional-label');
    const helper=$('message-helper-text');
    const optional=type!=='text';
    messageInput.required=!optional;
    if(optionalLabel)optionalLabel.hidden=!optional;
    messageInput.placeholder=optional?'Skriv några personliga ord, eller lämna tomt så lägger appen in en liten standardhälsning...':'Skriv några personliga ord som visas tillsammans med händelsen...';
    if(helper)helper.textContent=optional?'Frivilligt. Om du lämnar tomt används en varm liten standardtext.':'Meddelandet är själva hälsningen och behöver fyllas i.';
  }
  function initials(name) {
    const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
    return parts.length ? (parts[0][0]+(parts.length>1?parts[parts.length-1][0]:'')).toLocaleUpperCase('sv-SE') : '♥';
  }
  function setStatus(element,message,kind) {
    element.textContent = message || '';
    element.className = `form-status${kind?` ${kind}`:''}`;
  }
  function showToast(message,options={}) {
    toast.replaceChildren();
    toast.classList.toggle('toast-with-flower',Boolean(options.flower));
    if(options.flower){
      const mark=el('span','toast-flower');
      const source=document.querySelector('.panel-floral-mark img')?.src || 'flower-mark.svg';
      const image=document.createElement('img');
      image.src=source;
      image.alt='';
      mark.appendChild(image);
      toast.appendChild(mark);
    }
    const copy=el('span','toast-copy');
    copy.appendChild(el('strong','toast-title',message));
    if(options.detail)copy.appendChild(el('small','toast-detail',options.detail));
    toast.appendChild(copy);
    toast.hidden = false;
    requestAnimationFrame(() => toast.classList.add('show'));
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => { toast.hidden = true; },250);
    },Number(options.duration || 3000));
  }
  function showSaveCelebration(payload) {
    showToast('Händelsen är sparad',{
      flower:true,
      detail:`Den öppnas ${formatUnlock(payload.unlock_at)}.`,
      duration:4200
    });
  }
  const fallbackEmojis = ['💚','❤️','🫶','🥰','😊','🤗','✨','🌸','🌿','☀️','🌈','💪','😂','🎵','☕','🙏','🎉','💐','🌻','🍀','⭐️','🩷','🤍','🤎','💙','😄','😌','😘','🙌','👍'];
  function insertEmoji(value) {
    const start=Number.isFinite(messageInput.selectionStart)?messageInput.selectionStart:messageInput.value.length;
    const end=Number.isFinite(messageInput.selectionEnd)?messageInput.selectionEnd:start;
    const nextLength=messageInput.value.length-(end-start)+value.length;
    if(nextLength>messageInput.maxLength){showToast('Meddelandet har nått maxlängden');return;}
    messageInput.focus();
    if(typeof messageInput.setRangeText==='function') messageInput.setRangeText(value,start,end,'end');
    else messageInput.value=`${messageInput.value.slice(0,start)}${value}${messageInput.value.slice(end)}`;
    messageInput.dispatchEvent(new Event('input',{bubbles:true}));
  }
  function setEmojiPicker(open) {
    emojiPicker.hidden=!open;
    emojiToggle.setAttribute('aria-expanded',String(open));
    emojiToggle.classList.toggle('active',open);
  }
  function buildFallbackEmojiPicker() {
    if (!emojiPicker || emojiPicker.dataset.fallbackBuilt === 'true') return;
    emojiPicker.innerHTML = '';
    emojiPicker.classList.add('emoji-picker-fallback');
    fallbackEmojis.forEach((value)=>{
      const button=document.createElement('button');
      button.type='button';
      button.className='emoji-choice';
      button.textContent=value;
      button.setAttribute('aria-label',`Lägg till ${value}`);
      button.addEventListener('click',()=>{insertEmoji(value);setEmojiPicker(false);});
      emojiPicker.appendChild(button);
    });
    emojiPicker.dataset.fallbackBuilt = 'true';
  }
  if (emojiPicker && emojiPicker.tagName && emojiPicker.tagName.toLowerCase() === 'emoji-picker' && window.customElements && window.customElements.whenDefined) {
    Promise.race([
      window.customElements.whenDefined('emoji-picker').then(()=>true),
      new Promise((resolve)=>window.setTimeout(()=>resolve(false),2800))
    ]).then((ready) => {
      if(!ready){buildFallbackEmojiPicker();return;}
      emojiPicker.classList.remove('emoji-picker-fallback');
      emojiPicker.addEventListener('emoji-click', (event) => {
        const detail = event && event.detail ? event.detail : {};
        const value = detail.unicode || (detail.emoji && detail.emoji.unicode) || '';
        if (value) {
          insertEmoji(value);
          setEmojiPicker(false);
        }
      });
    }).catch(() => { buildFallbackEmojiPicker(); });
  } else {
    buildFallbackEmojiPicker();
  }
  function localDateTimeValue(date) {
    const value = new Date(date);
    return new Date(value.getTime()-value.getTimezoneOffset()*60000).toISOString().slice(0,16);
  }
  function defaultUnlockTime() {
    const date = new Date(Date.now()+60*60000);
    date.setMinutes(Math.ceil(date.getMinutes()/15)*15,0,0);
    return localDateTimeValue(date);
  }
  function formatUnlock(value) {
    return new Date(value).toLocaleString('sv-SE',{weekday:'long',day:'numeric',month:'long',hour:'2-digit',minute:'2-digit'});
  }
  function friendTimelineDay(value) {
    return new Date(value).toLocaleDateString('sv-SE',{weekday:'long',day:'numeric',month:'long'});
  }
  function friendTimelineTime(value) {
    return new Date(value).toLocaleTimeString('sv-SE',{hour:'2-digit',minute:'2-digit'});
  }
  function friendTimelineKey(value) {
    const date=new Date(value);
    return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
  }
  async function renderFriendTimeline() {
    const host=$('friend-timeline');
    if(!host||!friendPin||friendTimelineLoading)return;
    const hasRenderedContent=Boolean(host.dataset.rendered==='true');
    friendTimelineLoading=true;
    if(!hasRenderedContent){
      host.innerHTML='<div class="loading-state"><span class="soft-spinner" aria-hidden="true"></span><p>Hämtar tidslinjen...</p></div>';
    }
    try {
      const rows=await dataApi.getFriendTimeline(friendPin);
      const signature=JSON.stringify(rows.map((row)=>String(row.unlock_at||'')));
      if(hasRenderedContent&&signature===friendTimelineSignature)return;

      const fragment=document.createDocumentFragment();
      if(!rows.length){
        const empty=el('div','friend-timeline-empty');
        const flower=document.createElement('img');
        flower.src=document.querySelector('.panel-floral-mark img')?.src || 'flower-mark.svg';
        flower.alt='';
        empty.append(flower,el('h3','','Tidslinjen väntar på sin första händelse'),el('p','','När något läggs till syns datum och tid här.'));
        fragment.appendChild(empty);
      } else {
        const groups=new Map();
        rows.forEach((row)=>{
          const key=friendTimelineKey(row.unlock_at);
          if(!groups.has(key))groups.set(key,[]);
          groups.get(key).push(row);
        });
        let index=0;
        groups.forEach((items)=>{
          const section=el('section','friend-day-group');
          const heading=el('div','friend-day-heading');
          heading.append(el('h3','',friendTimelineDay(items[0].unlock_at)),el('span','',`${items.length} ${items.length===1?'händelse':'händelser'}`));
          section.appendChild(heading);
          items.forEach((item)=>{
            const variant=(index%4)+1;
            const article=el('article',`friend-timeline-item mystery-variant-${variant}`);
            const node=el('span','friend-timeline-node');
            const card=el('div','friend-overview-card');
            const top=el('div','friend-overview-top');
            const time=el('span','friend-overview-time');
            time.append(icon('clock'),document.createTextNode(friendTimelineTime(item.unlock_at)));
            top.appendChild(time);
            const body=el('div','friend-overview-body');
            const orb=el('span','friend-overview-orb');
            orb.appendChild(icon('lock'));
            const copy=el('div','friend-overview-copy');
            copy.append(el('strong','','Något väntar på att öppnas'),el('p','','Innehållet är bara för mottagaren.'));
            body.append(orb,copy);
            const motif=el('span','friend-overview-motif');
            motif.setAttribute('aria-hidden','true');
            card.append(top,body,motif);
            article.append(node,card);
            section.appendChild(article);
            index+=1;
          });
          fragment.appendChild(section);
        });
      }
      host.replaceChildren(fragment);
      host.dataset.rendered='true';
      friendTimelineSignature=signature;
    } catch(error) {
      if(hasRenderedContent){
        showToast('Tidslinjen kunde inte uppdateras just nu');
      } else {
        host.innerHTML='';
        const state=el('div','error-state');
        state.append(el('p','',`Tidslinjen kunde inte hämtas: ${error.message}`));
        host.appendChild(state);
      }
    } finally {
      friendTimelineLoading=false;
    }
  }
  function parseYouTubeId(value) {
    const raw = String(value || '').trim();
    if (!raw) return '';
    if (/^[A-Za-z0-9_-]{11}$/.test(raw)) return raw;
    try {
      const url = new URL(raw);
      if (url.hostname.includes('youtu.be')) return url.pathname.split('/').filter(Boolean)[0] || '';
      if (url.searchParams.get('v')) return url.searchParams.get('v');
      const parts = url.pathname.split('/').filter(Boolean);
      const marker = parts.findIndex((part) => ['embed','shorts','live'].includes(part));
      if (marker>=0) return parts[marker+1] || '';
    } catch (_) {}
    return '';
  }

  function parseSafeUrl(value) {
    const raw=String(value || '').trim();
    if (!raw) return '';
    try { const url=new URL(raw); return url.protocol==='https:' ? url.href : ''; } catch (_) { return ''; }
  }

  function emptyQuizQuestion() { return {question:'',options:['','','',''],answer:'',explanation:''}; }
  function readQuizEditorQuestions() {
    return Array.from(document.querySelectorAll('.quiz-question-card')).map((card,index) => {
      const optionInputs=Array.from(card.querySelectorAll('[data-quiz-option]'));
      const rawOptions=optionInputs.map((input)=>input.value.trim());
      const selected=Number(card.querySelector(`input[name="quiz-correct-${index}"]:checked`)?.value || 0);
      return {
        question:card.querySelector('[data-quiz-question]').value.trim(),
        options:rawOptions.filter(Boolean),
        answer:rawOptions[selected] || '',
        explanation:card.querySelector('[data-quiz-explanation]').value.trim()
      };
    });
  }
  function renderQuizEditor(values,countOverride) {
    const editor=$('quiz-questions-editor');
    if(!editor)return;
    const source=Array.isArray(values)?values:[];
    quizCount=Math.max(1,Math.min(4,Number(countOverride || source.length || quizCount || 1)));
    document.querySelectorAll('[data-quiz-count]').forEach((button)=>button.classList.toggle('active',Number(button.dataset.quizCount)===quizCount));
    editor.innerHTML='';
    for(let questionIndex=0;questionIndex<quizCount;questionIndex+=1){
      const value={...emptyQuizQuestion(),...(source[questionIndex]||{})};
      const section=el('section','quiz-question-card');
      const heading=el('div','quiz-question-editor-heading');
      heading.append(el('span','quiz-question-number',`Fråga ${questionIndex+1}`),el('span','quiz-question-progress',`${questionIndex+1} av ${quizCount}`));
      section.appendChild(heading);
      const questionField=el('div','field');
      const questionLabel=el('label','',`Frågetext`); const questionId=`quiz-question-${questionIndex}`; questionLabel.htmlFor=questionId;
      const question=document.createElement('textarea'); question.className='textarea'; question.id=questionId; question.dataset.quizQuestion=String(questionIndex); question.maxLength=600; question.placeholder='Skriv en kort fråga...'; question.value=value.question||'';
      questionField.append(questionLabel,question); section.appendChild(questionField);
      const fieldset=el('fieldset','clean-fieldset quiz-answer-fieldset'); const legend=el('legend','form-label','Svarsalternativ och rätt svar'); fieldset.appendChild(legend);
      const options=Array.isArray(value.options)&&value.options.length?value.options:['','','',''];
      const padded=[...options]; while(padded.length<4)padded.push('');
      padded.slice(0,4).forEach((option,optionIndex)=>{
        const row=el('div','quiz-option-row'); const radio=document.createElement('input'); radio.type='radio'; radio.name=`quiz-correct-${questionIndex}`; radio.value=String(optionIndex); radio.checked=value.answer?option===value.answer:optionIndex===0; radio.setAttribute('aria-label',`Fråga ${questionIndex+1}, alternativ ${optionIndex+1} är rätt`);
        const input=document.createElement('input'); input.className='text-input'; input.dataset.quizOption=String(optionIndex); input.maxLength=160; input.placeholder=`Svarsalternativ ${optionIndex+1}${optionIndex>1?' (frivilligt)':''}`; input.value=option||'';
        row.append(radio,input); fieldset.appendChild(row);
      });
      fieldset.appendChild(el('small','','Markera cirkeln vid rätt svar. Minst två alternativ behövs.')); section.appendChild(fieldset);
      const explanationField=el('div','field'); const explanationLabel=el('label'); const explanationId=`quiz-explanation-${questionIndex}`; explanationLabel.htmlFor=explanationId; explanationLabel.append(document.createTextNode('Liten förklaring efter svaret '),el('span','optional-label','frivillig'));
      const explanation=document.createElement('textarea'); explanation.className='textarea'; explanation.id=explanationId; explanation.dataset.quizExplanation=String(questionIndex); explanation.maxLength=1000; explanation.placeholder='En kort rolig förklaring eller bakgrund...'; explanation.value=value.explanation||'';
      explanationField.append(explanationLabel,explanation); section.appendChild(explanationField); editor.appendChild(section);
    }
  }
  function changeQuizCount(count) { renderQuizEditor(readQuizEditorQuestions(),count); }

  function renderSudokuGrid(container,puzzle,interactive) {
    container.innerHTML = '';
    sudokuApi.normalize(puzzle).split('').forEach((value,index) => {
      const cell = el(interactive?'input':'div',`sudoku-cell${value!=='0'?' given':''}`);
      if (interactive) {
        cell.type = 'text'; cell.inputMode = 'numeric'; cell.maxLength = 1; cell.value = value==='0'?'':value;
        cell.disabled = value!=='0'; cell.setAttribute('aria-label',`Ruta ${index+1}`);
      } else cell.textContent = value==='0'?'':value;
      if (index%4===1) cell.classList.add('box-right');
      if (Math.floor(index/4)===1) cell.classList.add('box-bottom');
      container.appendChild(cell);
    });
  }
  function newSudoku() {
    currentSudoku = sudokuApi.generate();
    renderSudokuGrid($('sudoku-editor-grid'),currentSudoku.puzzle,false);
  }

  function updateFactChoiceUI() {
    const mode = document.querySelector('input[name="fact-mode"]:checked')?.value || 'bank';
    $('fact-bank-fields').hidden = mode!=='bank';
    $('fact-custom-fields').hidden = mode!=='custom';
    $('fact-bank-choice').classList.toggle('active',mode==='bank');
    $('fact-custom-choice').classList.toggle('active',mode==='custom');
  }
  async function fetchRandomFact() {
    const button = $('random-fact-btn');
    button.disabled = true;
    $('fact-pick').textContent = 'Letar efter något lagom onödigt...';
    try {
      currentFact = await dataApi.getRandomFact(friendPin,$('fact-category').value);
      $('fact-pick').textContent = currentFact.text;
    } catch (error) {
      currentFact = null;
      $('fact-pick').textContent = error.message;
    } finally { button.disabled = false; }
  }

  function selectType(type) {
    currentType = type;
    document.querySelectorAll('.type-button').forEach((button) => button.classList.toggle('active',button.dataset.type===type));
    document.querySelectorAll('.type-fields').forEach((group) => { group.hidden = group.dataset.fields!==type; });
    updateFormCopy(type);
    updateMessageRequirement(type);
    previewPanel.hidden = true;
    if (type==='sudoku') renderSudokuGrid($('sudoku-editor-grid'),currentSudoku.puzzle,false);
    if (type==='fact' && !currentFact && friendPin) fetchRandomFact();
    scheduleDailyCheck();
  }

  function loadImageElement(file) {
    return new Promise((resolve,reject) => {
      const objectUrl = URL.createObjectURL(file);
      const image = new Image();
      image.onload = () => { URL.revokeObjectURL(objectUrl); resolve(image); };
      image.onerror = () => { URL.revokeObjectURL(objectUrl); reject(new Error('Bilden kunde inte läsas. Prova JPG, PNG eller WebP.')); };
      image.src = objectUrl;
    });
  }
  function dataUrlToBlob(dataUrl) {
    const parts=String(dataUrl).split(',');
    const match=/^data:([^;]+);base64$/.exec(parts[0] || '');
    if(!match || !parts[1]) throw new Error('Bilden kunde inte komprimeras');
    const binary=atob(parts[1]);
    const bytes=new Uint8Array(binary.length);
    for(let index=0;index<binary.length;index+=1) bytes[index]=binary.charCodeAt(index);
    return new Blob([bytes],{type:match[1]});
  }
  function canvasToJpegBlob(canvas,quality) {
    if(typeof canvas.toBlob!=='function') return Promise.resolve(dataUrlToBlob(canvas.toDataURL('image/jpeg',quality)));
    return new Promise((resolve,reject)=>{
      canvas.toBlob((blob)=>blob?resolve(blob):reject(new Error('Bilden kunde inte komprimeras')),'image/jpeg',quality);
    });
  }
  function blobToDataUrl(blob) {
    return new Promise((resolve,reject)=>{
      const reader=new FileReader();
      reader.onload=()=>resolve(String(reader.result || ''));
      reader.onerror=()=>reject(new Error('Förhandsvisningen kunde inte skapas'));
      reader.readAsDataURL(blob);
    });
  }
  async function compressImage(file) {
    if (!file) return '';
    if (!file.type.startsWith('image/')) throw new Error('Filen verkar inte vara en bild');
    let image = null; let shouldClose = false;
    if ('createImageBitmap' in window) {
      image = await createImageBitmap(file).catch(() => null);
      shouldClose = Boolean(image && typeof image.close==='function');
    }
    if (!image) image = await loadImageElement(file);
    const width = image.width || image.naturalWidth; const height = image.height || image.naturalHeight;
    if (!width || !height) throw new Error('Bilden saknar läsbara dimensioner');
    const maxDimension = Number(config.maxImageDimension || 1400);
    const ratio = Math.min(1,maxDimension/Math.max(width,height));
    let canvas = document.createElement('canvas');
    canvas.width = Math.max(1,Math.round(width*ratio));
    canvas.height = Math.max(1,Math.round(height*ratio));
    let context = canvas.getContext('2d',{alpha:false});
    if (!context) throw new Error('Webbläsaren kunde inte förbereda bilden');
    context.fillStyle = '#ffffff';
    context.fillRect(0,0,canvas.width,canvas.height);
    context.drawImage(image,0,0,canvas.width,canvas.height);
    if (shouldClose) image.close();

    const maxBytes = Number(config.maxImageBytes || 360000);
    let quality = .82;
    let blob = await canvasToJpegBlob(canvas,quality);
    while (blob.size>maxBytes && quality>.38) {
      quality=Math.max(.38,quality-.07);
      blob=await canvasToJpegBlob(canvas,quality);
    }
    while (blob.size>maxBytes && Math.max(canvas.width,canvas.height)>720) {
      const smaller=document.createElement('canvas');
      smaller.width=Math.max(1,Math.round(canvas.width*.86));
      smaller.height=Math.max(1,Math.round(canvas.height*.86));
      const smallerContext=smaller.getContext('2d',{alpha:false});
      if(!smallerContext) throw new Error('Webbläsaren kunde inte förbereda bilden');
      smallerContext.fillStyle='#ffffff';
      smallerContext.fillRect(0,0,smaller.width,smaller.height);
      smallerContext.drawImage(canvas,0,0,smaller.width,smaller.height);
      canvas=smaller;
      context=smallerContext;
      quality=.62;
      blob=await canvasToJpegBlob(canvas,quality);
      while(blob.size>maxBytes && quality>.38){
        quality=Math.max(.38,quality-.06);
        blob=await canvasToJpegBlob(canvas,quality);
      }
    }
    if (blob.size>maxBytes) throw new Error('Bilden är fortfarande för stor efter komprimering');
    const dataUrl=await blobToDataUrl(blob);
    return {dataUrl,blob};
  }

  function collectPayload(options) {
    const allowIncomplete = Boolean(options && options.allowIncomplete);
    const name = $('friend-name').value.trim();
    const unlockValue = $('unlock-date').value;
    const title = $('memory-title').value.trim();
    const bodyInput = $('memory-message').value.trim();
    const body = bodyInput || defaultMessageForType(currentType);
    if (!allowIncomplete && !name) throw new Error('Skriv ditt namn');
    if (!allowIncomplete && !unlockValue) throw new Error('Välj datum och tid');
    if (!allowIncomplete && currentType==='text' && !bodyInput) throw new Error('Skriv ett personligt meddelande');
    const payload = {
      friend_name:name || 'Din vän',unlock_at:unlockValue?new Date(unlockValue).toISOString():new Date().toISOString(),content_type:currentType,
      title,body,image_data:'',image_blob:null,image_path:'',previous_image_path:previousImagePath,youtube_id:'',quiz_question:'',quiz_options:[],quiz_answer:'',quiz_explanation:'',extra_data:{}
    };
    if (currentType==='image') {
      payload.image_data = compressedImage || previousImage;
      payload.image_blob = compressedImageBlob;
      payload.image_path = previousImagePath;
      payload.previous_image_path = previousImagePath;
      if (!allowIncomplete && !payload.image_data && !payload.image_path && !payload.image_blob) throw new Error('Välj en bild');
    }
    if (currentType==='quiz') {
      const questions=readQuizEditorQuestions().slice(0,4);
      if (!allowIncomplete) {
        if (!questions.length) throw new Error('Miniquizet behöver minst en fråga');
        questions.forEach((question,index)=>{
          if (!question.question) throw new Error(`Skriv fråga ${index+1}`);
          if (question.options.length<2) throw new Error(`Fråga ${index+1} behöver minst två svarsalternativ`);
          if (!question.answer) throw new Error(`Markera ett ifyllt rätt svar på fråga ${index+1}`);
        });
      }
      Object.assign(payload,dataApi.encodeQuizQuestions(questions));
    }
    if (currentType==='youtube') {
      const linkUrl=parseSafeUrl($('youtube-url').value);
      payload.youtube_id = parseYouTubeId(linkUrl);
      payload.extra_data = {...payload.extra_data,link_url:linkUrl};
      if (!allowIncomplete && !linkUrl) throw new Error('Klistra in en giltig https-länk');
    }
    if (currentType==='sudoku') {
      payload.extra_data = {sudoku_puzzle:currentSudoku.puzzle,sudoku_solution:currentSudoku.solution,sudoku_size:4};
    }
    if (currentType==='fact') {
      const mode = document.querySelector('input[name="fact-mode"]:checked')?.value || 'bank';
      if (mode==='bank') {
        if (!allowIncomplete && (!currentFact || !currentFact.text)) throw new Error('Hämta en fakta först');
        payload.extra_data = {fact_mode:'bank',fact_id:currentFact?.id || '',fact_category:currentFact?.category || '',fact_text:currentFact?.text || ''};
      } else {
        const factText = $('custom-fact').value.trim();
        if (!allowIncomplete && !factText) throw new Error('Skriv din onödiga fakta');
        payload.extra_data = {fact_mode:'custom',fact_id:'',fact_category:'Egen',fact_text:factText};
      }
    }
    return payload;
  }

  function makeSender(payload) {
    const sender = el('div','sender-row');
    sender.appendChild(el('div','sender-avatar',initials(payload.friend_name)));
    const copy = el('div','sender-copy'); copy.append(el('span','','Från'),el('strong','',payload.friend_name || 'Din vän'));
    sender.appendChild(copy); return sender;
  }
  function makePreviewInner(payload) {
    const inner = el('div','preview-card-inner');
    const top = el('div','card-topline');
    const time = el('span','card-time'); time.append(icon('clock','time-icon'),document.createTextNode(new Date(payload.unlock_at).toLocaleTimeString('sv-SE',{hour:'2-digit',minute:'2-digit'})));
    const badge = el('span','card-type'); badge.append(icon(typeIcon(payload.content_type),'badge-icon'),document.createTextNode(typeLabel(payload.content_type)));
    top.append(time,badge); inner.append(top,makeSender(payload));
    if (payload.title) inner.appendChild(el('h3','memory-title',payload.title));
    inner.appendChild(el('p','memory-body',payload.body || 'Ditt personliga meddelande visas här.'));
    return inner;
  }
  function renderPreview() {
    const payload = collectPayload({allowIncomplete:true});
    previewCard.innerHTML = '';
    const card = el('article',`preview-memory-card type-${payload.content_type}`);
    if (payload.content_type==='youtube') {
      if(payload.youtube_id){
        const video = el('div','preview-video preview-media-first');
        video.style.backgroundImage = `linear-gradient(rgba(45,66,55,.18),rgba(45,66,55,.42)),url("https://i.ytimg.com/vi/${encodeURIComponent(payload.youtube_id)}/hqdefault.jpg")`;
        const play = el('div','play-button preview-play'); play.appendChild(icon('play','play-icon')); video.appendChild(play); card.appendChild(video);
      } else {
        const linkCard=el('div','preview-link-card preview-media-first'); const mark=el('span','preview-link-icon'); mark.appendChild(icon('link'));
        let host='Videoklipp'; try{host=new URL(payload.extra_data.link_url).hostname.replace(/^www\./,'');}catch(_){}
        linkCard.append(mark,el('strong','',host),el('small','','Öppnas i originalappen eller webbläsaren')); card.appendChild(linkCard);
      }
    }
    card.appendChild(makePreviewInner(payload));
    if (payload.content_type==='image') {
      if (payload.image_data) { const img = document.createElement('img'); img.className='memory-image'; img.src=payload.image_data; img.alt='Förhandsvisning av vald bild'; card.appendChild(img); }
      else { const placeholder=el('div','preview-media-placeholder'); placeholder.append(icon('image'),document.createTextNode('Din bild visas här')); card.appendChild(placeholder); }
    }
    if (payload.content_type==='quiz') {
      const questions=dataApi.decodeQuizQuestions(payload,true); const first=questions[0]||emptyQuizQuestion();
      const quiz=el('div','preview-quiz'); const previewTop=el('div','preview-quiz-top'); previewTop.append(el('strong','',`Miniquiz · ${questions.length||1} ${questions.length===1?'fråga':'frågor'}`),el('span','',`1 av ${questions.length||1}`)); quiz.appendChild(previewTop);
      quiz.appendChild(el('p','preview-quiz-question',first.question || 'Din första fråga visas här'));
      (first.options.length?first.options:['Svarsalternativ 1','Svarsalternativ 2']).forEach((option)=>quiz.appendChild(el('div','preview-option',option)));
      if(questions.length>1)quiz.appendChild(el('small','preview-more-questions',`+ ${questions.length-1} ${questions.length===2?'fråga':'frågor'} till`)); card.appendChild(quiz);
    }
    if (payload.content_type==='sudoku') {
      const block=el('div','preview-activity-block sudoku-card-block');
      const label=el('div','activity-card-label'); label.append(icon('sudoku'),document.createTextNode('Lätt 4 × 4-sudoku')); block.appendChild(label);
      const grid=el('div','sudoku-grid preview-sudoku-grid'); renderSudokuGrid(grid,payload.extra_data.sudoku_puzzle,false); block.appendChild(grid); card.appendChild(block);
    }
    if (payload.content_type==='fact') {
      const block=el('div','preview-activity-block fact-card-block');
      const label=el('div','activity-card-label'); label.append(icon('fact'),document.createTextNode('Visste du att...')); block.append(label,el('p','fact-text',payload.extra_data.fact_text || 'Din fakta visas här.')); card.appendChild(block);
    }
    previewCard.appendChild(card); previewPanel.hidden=false; previewPanel.scrollIntoView({behavior:'smooth',block:'start'});
  }

  async function updateDailyStatus() {
    clearTimeout(dailyTimer);
    if (!friendPin || !$('unlock-date').value) { dailyStatus.textContent=''; dailyStatus.className='daily-limit-status'; return; }
    dailyStatus.textContent='Kontrollerar dagen...'; dailyStatus.className='daily-limit-status';
    try {
      const unlockAt=new Date($('unlock-date').value).toISOString();
      const capacity=await dataApi.getDayCapacity(friendPin,unlockAt,editingId || '');
      let typeAvailable=true;
      if(['sudoku','fact'].includes(currentType)) typeAvailable=await dataApi.checkDailyAvailability(friendPin,currentType,unlockAt,editingId || '');
      if(!capacity.available){
        dailyStatus.textContent=`Dagen är full med ${capacity.limit} händelser. Välj en annan dag eller be admin höja gränsen.`;
        dailyStatus.className='daily-limit-status unavailable';
      } else if(!typeAvailable){
        dailyStatus.textContent=`Det finns redan ${currentType==='sudoku'?'ett sudoku':'onödig fakta'} den här dagen.`;
        dailyStatus.className='daily-limit-status unavailable';
      } else {
        const countText=`${capacity.count} av ${capacity.limit} händelser är planerade den dagen.`;
        const special=['sudoku','fact'].includes(currentType)?` Plats finns för ${currentType==='sudoku'?'sudoku':'onödig fakta'}.`:'';
        dailyStatus.textContent=countText+special;
        dailyStatus.className=`daily-limit-status ${capacity.count>=Math.max(1,capacity.limit-2)?'warning':'available'}`;
      }
    } catch (error) { dailyStatus.textContent=error.message; dailyStatus.className='daily-limit-status unavailable'; }
  }
  function scheduleDailyCheck() { clearTimeout(dailyTimer); dailyTimer=setTimeout(updateDailyStatus,180); }

  function resetForm() {
    editingId=''; compressedImage=''; compressedImageBlob=null; previousImage=''; previousImagePath=''; currentFact=null; currentSudoku=sudokuApi.generate();
    memoryForm.reset(); $('friend-name').value=localStorage.getItem(NAME_KEY)||''; $('unlock-date').value=defaultUnlockTime();
    imagePreview.hidden=true; imagePreview.removeAttribute('src'); imageSizeStatus.textContent='';
    submitButton.querySelector('span:last-child').textContent='Spara händelsen'; cancelEditButton.hidden=true; previewPanel.hidden=true;
    renderQuizEditor([],1); renderSudokuGrid($('sudoku-editor-grid'),currentSudoku.puzzle,false);
    document.querySelector('input[name="fact-mode"][value="bank"]').checked=true; updateFactChoiceUI(); $('fact-pick').textContent='Tryck på knappen så väljer appen något.'; $('custom-fact').value='';
    selectType('text'); setStatus(formStatus,''); dailyStatus.textContent='';
  }

  function createHelpPanel(item) {
    const panel=el('div','help-request-panel'); panel.hidden=true;
    const label=el('label','form-label','Vad behöver du hjälp med?');
    const select=document.createElement('select'); select.className='text-input';
    [['change','Jag vill ändra något'],['delete','Jag vill ta bort bidraget']].forEach(([value,text])=>{const option=document.createElement('option');option.value=value;option.textContent=text;select.appendChild(option);});
    const message=document.createElement('textarea'); message.className='textarea'; message.maxLength=1000; message.placeholder='Skriv gärna kort vad admin ska hjälpa till med...';
    const actions=el('div','help-request-actions'); const cancel=el('button','ghost-button compact-button','Avbryt'); cancel.type='button'; cancel.addEventListener('click',()=>{panel.hidden=true;});
    const send=el('button','primary-button compact-button button-with-icon'); send.type='button'; send.append(icon('check'),document.createTextNode('Skicka till admin'));
    send.addEventListener('click',async()=>{send.disabled=true;try{await dataApi.requestAdminHelp(friendPin,contributorToken,item.id,select.value,message.value);showToast('Din förfrågan har skickats till admin');panel.hidden=true;}catch(error){showToast(error.message);}finally{send.disabled=false;}});
    actions.append(cancel,send); panel.append(label,select,message,actions); return panel;
  }

  async function renderMySubmissions() {
    if(!submissions||!friendPin||mySubmissionsLoading)return;
    const hasRenderedContent=Boolean(submissions.dataset.rendered==='true');
    mySubmissionsLoading=true;
    if(!hasRenderedContent){
      submissions.innerHTML='<div class="loading-state"><span class="soft-spinner" aria-hidden="true"></span><p>Hämtar dina bidrag</p></div>';
    }
    try {
      const items=await dataApi.getMyMemories(friendPin,contributorToken);
      const signature=JSON.stringify(items.map((item)=>({
        id:String(item.id||''),
        updated_at:String(item.updated_at||''),
        unlock_at:String(item.unlock_at||''),
        content_type:String(item.content_type||''),
        title:String(item.title||''),
        friend_name:String(item.friend_name||''),
        opened:new Date(item.unlock_at)<=new Date()
      })));
      if(hasRenderedContent&&signature===mySubmissionsSignature)return;

      const fragment=document.createDocumentFragment();
      if (!items.length) {
        const empty=el('div','empty-state');
        empty.appendChild(el('p','','Du har inte skapat något från den här enheten ännu.'));
        fragment.appendChild(empty);
      } else {
        items.forEach((item) => {
          const card=el('article','submission-card'); const top=el('div','submission-card-top'); const typeMark=el('div','submission-type-icon'); typeMark.appendChild(icon(typeIcon(item.content_type)));
          const copy=el('div','submission-copy'); copy.appendChild(el('h3','',item.title || typeLabel(item.content_type))); copy.appendChild(el('div','submission-meta',`${formatUnlock(item.unlock_at)} · från ${item.friend_name}`));
          const badges=el('div','submission-badges'); badges.appendChild(el('span','card-type',new Date(item.unlock_at)<=new Date()?'öppnad':'väntar'));
          copy.appendChild(badges); top.append(typeMark,copy); card.appendChild(top);
          const actions=el('div','submission-actions');
          const edit=el('button','small-button button-with-icon'); edit.type='button'; edit.append(icon('edit'),document.createTextNode('Ändra')); edit.addEventListener('click',()=>startEdit(item,false));
          const duplicate=el('button','small-button button-with-icon'); duplicate.type='button'; duplicate.append(icon('copy'),document.createTextNode('Kopiera')); duplicate.addEventListener('click',()=>startEdit(item,true));
          const remove=el('button','small-button delete button-with-icon'); remove.type='button'; remove.append(icon('trash'),document.createTextNode('Ta bort')); remove.addEventListener('click',async()=>{
            if (!confirm('Ta bort den här händelsen?')) return;
            try { await dataApi.deleteMemory(friendPin,contributorToken,item.id); showToast('Händelsen togs bort'); await renderMySubmissions(); } catch(error){ showToast(error.message); }
          });
          const help=el('button','small-button button-with-icon'); help.type='button'; help.append(icon('shield'),document.createTextNode('Be admin om hjälp'));
          const helpPanel=createHelpPanel(item); help.addEventListener('click',()=>{helpPanel.hidden=!helpPanel.hidden;});
          actions.append(edit,duplicate,remove,help); card.append(actions,helpPanel); fragment.appendChild(card);
        });
      }
      submissions.replaceChildren(fragment);
      submissions.dataset.rendered='true';
      mySubmissionsSignature=signature;
    } catch(error){
      if(hasRenderedContent){
        showToast('Mina bidrag kunde inte uppdateras just nu');
      } else {
        submissions.innerHTML='';
        const state=el('div','error-state');
        state.appendChild(el('p','',error.message));
        submissions.appendChild(state);
      }
    } finally {
      mySubmissionsLoading=false;
    }
  }

  async function startEdit(item,duplicate=false) {
    editingId=duplicate?'':(item.id||'');
    compressedImage=''; compressedImageBlob=null; previousImage=''; previousImagePath=duplicate?'':(item.image_path||'');
    selectType(item.content_type||'text');
    $('friend-name').value=item.friend_name||''; $('unlock-date').value=localDateTimeValue(item.unlock_at||new Date()); $('memory-title').value=item.title||''; $('memory-message').value=item.body||'';
    $('youtube-url').value=item.extra_data?.link_url || (item.youtube_id?`https://youtu.be/${item.youtube_id}`:'');
    const quizQuestions=dataApi.decodeQuizQuestions(item,true); renderQuizEditor(quizQuestions,quizQuestions.length||1);
    if (item.content_type==='sudoku') { currentSudoku={puzzle:item.extra_data?.sudoku_puzzle||sudokuApi.generate().puzzle,solution:item.extra_data?.sudoku_solution||sudokuApi.generate().solution}; renderSudokuGrid($('sudoku-editor-grid'),currentSudoku.puzzle,false); }
    if (item.content_type==='fact') {
      const mode=item.extra_data?.fact_mode==='custom'?'custom':'bank'; document.querySelector(`input[name="fact-mode"][value="${mode}"]`).checked=true; updateFactChoiceUI();
      if (mode==='custom') $('custom-fact').value=item.extra_data?.fact_text||'';
      else { currentFact={id:item.extra_data?.fact_id||'',category:item.extra_data?.fact_category||'',text:item.extra_data?.fact_text||''}; $('fact-pick').textContent=currentFact.text||'Hämta en ny fakta.'; }
    }
    if (item.content_type==='image') {
      imageSizeStatus.textContent='Hämtar bilden...';
      try {
        const url=item.image_data || await dataApi.getFriendImageUrl(friendPin,contributorToken,item.id);
        if (duplicate) {
          const response=await fetch(url,{cache:'no-store'});
          if (!response.ok) throw new Error('Bilden kunde inte kopieras');
          compressedImageBlob=await response.blob(); compressedImage=url;
          imageSizeStatus.textContent='Bilden kopieras som en ny fil när du sparar.';
        } else {
          previousImage=url;
          imageSizeStatus.textContent='Nuvarande bild behålls om du inte väljer en ny.';
        }
        imagePreview.src=url; imagePreview.hidden=false;
      } catch (error) {
        imagePreview.hidden=true; imageSizeStatus.textContent=duplicate?'Välj bilden på nytt för kopian.':'Bilden kunde inte förhandsvisas, men den behålls om du sparar.';
      }
    } else { imagePreview.hidden=true; imageSizeStatus.textContent=''; }
    $('form-title').textContent=editingId?'Ändra händelse':'Kopiera händelse'; $('form-intro').textContent=editingId?'Gör ändringarna och spara när allt ser rätt ut.':'Justera innehållet och välj en ny tid innan du sparar.'; submitButton.querySelector('span:last-child').textContent=editingId?'Spara ändringarna':'Spara som ny'; cancelEditButton.hidden=false;
    switchTab('create'); scheduleDailyCheck(); window.scrollTo({top:0,behavior:'smooth'});
  }
  function switchTab(tab) {
    document.querySelectorAll('.tab-button').forEach((button)=>button.classList.toggle('active',button.dataset.tab===tab));
    $('create-panel').hidden=tab!=='create';
    $('mine-panel').hidden=tab!=='mine';
    $('friend-timeline-panel').hidden=tab!=='timeline';
    previewPanel.hidden=true;
    if(tab==='mine')renderMySubmissions();
    if(tab==='timeline')renderFriendTimeline();
  }

  facts.categories.forEach((category)=>{ const option=document.createElement('option'); option.value=category; option.textContent=category; $('fact-category').appendChild(option); });
  document.querySelectorAll('.type-button').forEach((button)=>button.addEventListener('click',()=>selectType(button.dataset.type)));
  document.querySelectorAll('[data-quiz-count]').forEach((button)=>button.addEventListener('click',()=>changeQuizCount(Number(button.dataset.quizCount))));
  document.querySelectorAll('.tab-button').forEach((button)=>button.addEventListener('click',()=>switchTab(button.dataset.tab)));
  document.querySelectorAll('input[name="fact-mode"]').forEach((radio)=>radio.addEventListener('change',updateFactChoiceUI));
  $('new-sudoku-btn').addEventListener('click',newSudoku); $('random-fact-btn').addEventListener('click',fetchRandomFact);
  $('unlock-date').addEventListener('change',scheduleDailyCheck); cancelEditButton.addEventListener('click',resetForm);
  emojiToggle.addEventListener('click',()=>setEmojiPicker(emojiPicker.hidden));
  document.addEventListener('click',(event)=>{if(!emojiPicker.hidden&&!event.target.closest('.emoji-tools'))setEmojiPicker(false);});
  document.addEventListener('keydown',(event)=>{if(event.key==='Escape'&&!emojiPicker.hidden)setEmojiPicker(false);});
  $('preview-memory-btn').addEventListener('click',()=>{ try{renderPreview();}catch(error){setStatus(formStatus,error.message,'error');} });
  $('close-preview-btn').addEventListener('click',()=>{previewPanel.hidden=true;});

  imageInput.addEventListener('change',async()=>{
    const file=imageInput.files&&imageInput.files[0]; if(!file)return; imageSizeStatus.textContent='Komprimerar bilden...';
    try { const result=await compressImage(file); compressedImage=result.dataUrl; compressedImageBlob=result.blob; const bytes=result.blob.size; imagePreview.src=compressedImage; imagePreview.hidden=false; imageSizeStatus.textContent=`Klar. Cirka ${Math.round(bytes/1024)} kB efter komprimering.`; }
    catch(error){ compressedImage=''; compressedImageBlob=null; imageInput.value=''; imagePreview.hidden=true; imageSizeStatus.textContent=error.message; }
  });

  function verifyWithTimeout(promise) {
    return Promise.race([
      promise,
      new Promise((_,reject)=>setTimeout(()=>reject(new Error('Kontrollen tog för lång tid. Kontrollera anslutningen och försök igen.')),15000))
    ]);
  }

  async function enterFriend(pin,{redirected=false}={}) {
    if(!pin){ autoLoginPanel.hidden=true; loginPanel.hidden=false; return; }
    autoLoginPanel.hidden=!redirected;
    loginPanel.hidden=redirected;
    workspace.hidden=true;
    setStatus(loginStatus,'Kontrollerar koden...');
    try {
      await verifyWithTimeout(dataApi.verifyFriend(pin));
      friendPin=pin;
      autoLoginPanel.hidden=true;
      loginPanel.hidden=true;
      workspace.hidden=false;
      setStatus(loginStatus,'');
      resetForm();
    }
    catch(error){
      autoLoginPanel.hidden=true;
      loginPanel.hidden=false;
      workspace.hidden=true;
      setStatus(loginStatus,error.message,'error');
      pinInput.focus();
    }
  }

  loginForm.addEventListener('submit',async(event)=>{
    event.preventDefault();
    await enterFriend(pinInput.value.trim());
  });

  memoryForm.addEventListener('submit',async(event)=>{
    event.preventDefault(); submitButton.disabled=true; setStatus(formStatus,editingId?'Sparar ändringarna...':'Förbereder händelsen...');
    try {
      const payload=collectPayload(); localStorage.setItem(NAME_KEY,payload.friend_name);
      const wasEditing=Boolean(editingId);
      if(wasEditing){ await dataApi.updateMemory(friendPin,contributorToken,editingId,payload); }
      else { await dataApi.addMemory(friendPin,contributorToken,payload); }
      resetForm(); setStatus(formStatus,`Sparat. Den öppnas ${formatUnlock(payload.unlock_at)}.`,'success');
      if(wasEditing)showToast('Ändringarna är sparade'); else showSaveCelebration(payload);
    } catch(error){ setStatus(formStatus,error.message,'error'); }
    finally { submitButton.disabled=false; }
  });

  dataApi.subscribe(()=>{
    if(!friendPin)return;
    if(!$('mine-panel').hidden)renderMySubmissions();
    if(!$('friend-timeline-panel').hidden)renderFriendTimeline();
  });
  renderQuizEditor([],1); newSudoku(); $('unlock-date').value=defaultUnlockTime(); updateFactChoiceUI();

  const redirectedPin=sessionStorage.getItem(FRIEND_REDIRECT_KEY)||'';
  if(redirectedPin){
    sessionStorage.removeItem(FRIEND_REDIRECT_KEY);
    pinInput.value=redirectedPin;
    enterFriend(redirectedPin,{redirected:true});
  } else {
    autoLoginPanel.hidden=true;
    loginPanel.hidden=false;
    pinInput.focus();
  }
})();
