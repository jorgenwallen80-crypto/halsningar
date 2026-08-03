(function () {
  'use strict';

  const config = window.HANDELSER_CONFIG;
  const dataApi = window.HandelserData;
  const icons = window.HandelserIcons;
  const sudokuApi = window.HandelserSudoku;
  const $ = (id) => document.getElementById(id);
  const appShell = $('app-shell');
  const gate = $('viewer-gate');
  const loginForm = $('viewer-login-form');
  const pinInput = $('viewer-pin');
  const rememberInput = $('remember-viewer');
  const loginStatus = $('viewer-login-status');
  const timeline = $('timeline-container');
  const dateHeader = $('date-header');
  const welcomeCopy = $('welcome-copy');
  const recipientGreeting = $('recipient-greeting');
  const progressText = $('progress-text');
  const progressNumber = $('progress-number');
  const progressRing = $('progress-ring');
  const progressBar = $('progress-bar');
  const nextMessage = $('next-message');
  const toast = $('toast');
  const lockButton = $('lock-app-btn');

  const REMEMBER_KEY = 'handelser_viewer_pin';
  const SESSION_KEY = 'handelser_viewer_pin_session';
  const KNOWN_IDS_KEY = 'handelser_viewer_known_ids';
  const OPENED_IDS_KEY = 'handelser_viewer_opened_ids';
  const FRIEND_REDIRECT_KEY = 'handelser_friend_redirect_pin';
  const ADMIN_REDIRECT_KEY = 'handelser_admin_redirect_pin';
  const mysteryIcons = ['gift','flower','leaf','heart','sun'];
  const mysteryTitles = ['Något väntar här','En liten sak är på väg','Den här öppnas lite senare','Psst, något finns här','Snart visar den sig'];
  const mysterySubtitles = [
    'Innehållet visar sig när tiden är inne.',
    'Du behöver bara vara nyfiken en liten stund till.',
    'Ingen brådska. Den blir redo när tiden är inne.',
    'Det kan vara stort, litet eller bara lite knasigt.',
    'Innehållet öppnas när det är dags.'
  ];

  let viewerPin = '';
  let presentation = {recipient_name:'',welcome_message:'Här väntar små händelser att öppna när du vill och orkar.'};
  let memories = [];
  let previousUnlockedIds = new Set();
  let didInitialLoad = false;
  let nextUnlockTimer = null;
  let countdownTimer = null;
  let toastTimer = null;
  let lastTimelineSignature = '';
  let syncTimer = null;
  let openedIds = readOpenedIds();
  const imageUrlCache = new Map();
  let waitDialogTimer = null;
  const quizStates = new Map();

  function el(tag,className,text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text!==undefined) node.textContent = text;
    return node;
  }
  function icon(name,className,label) { return icons.icon(name,className,label); }
  function nowMs() { return typeof dataApi.nowMs==='function' ? dataApi.nowMs() : Date.now(); }
  function stockholmParts(value) {
    const parts=new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Stockholm',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date(value));
    const result={}; parts.forEach((part)=>{if(part.type!=='literal')result[part.type]=part.value;}); return result;
  }
  function dayKey(value) {
    const parts=stockholmParts(value);
    return `${parts.year}-${parts.month}-${parts.day}`;
  }
  function dayIndex(value) {
    const parts=stockholmParts(value);
    return Date.UTC(Number(parts.year),Number(parts.month)-1,Number(parts.day))/86400000;
  }
  function formatTime(value) { return new Date(value).toLocaleTimeString('sv-SE',{timeZone:'Europe/Stockholm',hour:'2-digit',minute:'2-digit'}); }
  function formatDay(value) {
    const target = new Date(value);
    const diff = Math.round(dayIndex(target)-dayIndex(nowMs()));
    if (diff===0) return 'Idag';
    if (diff===1) return 'Imorgon';
    if (diff===-1) return 'Igår';
    return target.toLocaleDateString('sv-SE',{timeZone:'Europe/Stockholm',weekday:'long',day:'numeric',month:'long'});
  }
  function typeLabel(type) { return ({text:'Hälsning',image:'Bild',quiz:'Miniquiz',youtube:'Videoklipp',sudoku:'Sudoku',fact:'Onödig fakta'})[type] || 'Händelse'; }
  function typeIcon(type) { return ({text:'message',image:'image',quiz:'quiz',youtube:'youtube',sudoku:'sudoku',fact:'fact'})[type] || 'flower'; }
  function initials(name) {
    const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return '♥';
    return (parts[0][0]+(parts.length>1?parts[parts.length-1][0]:'')).toLocaleUpperCase('sv-SE');
  }
  function readOpenedIds() {
    try { const value=JSON.parse(localStorage.getItem(OPENED_IDS_KEY)||'[]'); return new Set(Array.isArray(value)?value:[]); } catch (_) { return new Set(); }
  }
  function saveOpenedIds() { try { localStorage.setItem(OPENED_IDS_KEY,JSON.stringify(Array.from(openedIds))); } catch (_) {} }
  function markOpened(id) { openedIds.add(id); saveOpenedIds(); renderTimeline(); updateProgress(); }
  function waitParts(unlockAt) {
    const diff=Math.max(0,new Date(unlockAt).getTime()-nowMs());
    const totalMinutes=Math.max(0,Math.ceil(diff/60000));
    const days=Math.floor(totalMinutes/1440);
    const hours=Math.floor((totalMinutes%1440)/60);
    const minutes=totalMinutes%60;
    return {diff,days,hours,minutes};
  }
  function showWaitDialog(memory) {
    let overlay=document.getElementById('wait-overlay');
    if(!overlay){
      overlay=el('div','wait-overlay'); overlay.id='wait-overlay'; overlay.hidden=true;
      const panel=el('div','wait-dialog'); panel.setAttribute('role','dialog'); panel.setAttribute('aria-modal','true'); panel.setAttribute('aria-labelledby','wait-dialog-title');
      const close=el('button','wait-close'); close.type='button'; close.setAttribute('aria-label','Stäng'); close.appendChild(icon('close'));
      const mark=el('div','wait-dialog-mark'); mark.appendChild(icon('lock'));
      panel.append(close,mark,el('p','eyebrow','INTE RIKTIGT ÄN'),el('h2','', 'Du får vänta lite till'),el('p','wait-dialog-copy','Den här händelsen är fortfarande låst.'),el('div','wait-countdown'),el('p','wait-unlock-time'));
      overlay.appendChild(panel); document.body.appendChild(overlay);
      const closeDialog=()=>{clearInterval(waitDialogTimer);waitDialogTimer=null;overlay.hidden=true;document.body.classList.remove('dialog-open');};
      close.addEventListener('click',closeDialog); overlay.addEventListener('click',(event)=>{if(event.target===overlay)closeDialog();});
      document.addEventListener('keydown',(event)=>{if(event.key==='Escape'&&!overlay.hidden)closeDialog();});
    }
    const countdown=overlay.querySelector('.wait-countdown'); const time=overlay.querySelector('.wait-unlock-time');
    function renderWait(){
      const parts=waitParts(memory.unlock_at);
      countdown.innerHTML='';
      [['dagar',parts.days],['timmar',parts.hours],['minuter',parts.minutes]].forEach(([label,value])=>{const box=el('div','wait-count-unit');box.append(el('strong','',String(value)),el('span','',label));countdown.appendChild(box);});
      time.textContent=`Blir redo ${formatDay(memory.unlock_at).toLocaleLowerCase('sv-SE')} klockan ${formatTime(memory.unlock_at)}.`;
      if(parts.diff<=0){ clearInterval(waitDialogTimer); waitDialogTimer=null; overlay.hidden=true; document.body.classList.remove('dialog-open'); refreshTimeline({announce:true}); }
    }
    clearInterval(waitDialogTimer); renderWait(); waitDialogTimer=setInterval(renderWait,1000); overlay.hidden=false; document.body.classList.add('dialog-open');
  }

  function showToast(message) {
    toast.textContent = message; toast.hidden = false; requestAnimationFrame(() => toast.classList.add('show'));
    clearTimeout(toastTimer); toastTimer = setTimeout(() => { toast.classList.remove('show'); setTimeout(() => { toast.hidden=true; },260); },3200);
  }
  function setGateStatus(message,kind) { loginStatus.textContent=message||''; loginStatus.className=`form-status${kind?` ${kind}`:''}`; }
  function storedPin() { return localStorage.getItem(REMEMBER_KEY)||sessionStorage.getItem(SESSION_KEY)||''; }
  function savePin(pin) {
    if (rememberInput.checked) { localStorage.setItem(REMEMBER_KEY,pin); sessionStorage.removeItem(SESSION_KEY); }
    else { sessionStorage.setItem(SESSION_KEY,pin); localStorage.removeItem(REMEMBER_KEY); }
  }
  function clearPin() { localStorage.removeItem(REMEMBER_KEY); sessionStorage.removeItem(SESSION_KEY); viewerPin=''; }

  function updateHeader() {
    const now=new Date(nowMs());
    dateHeader.textContent=now.toLocaleDateString('sv-SE',{timeZone:'Europe/Stockholm',weekday:'long',day:'numeric',month:'long'});
    const name=String(presentation?.recipient_name || config.recipientName || '').trim();
    const message=String(presentation?.welcome_message || '').trim() || 'Här väntar små händelser att öppna när du vill och orkar.';
    recipientGreeting.textContent=name?`Hej ${name}`:'Hej';
    welcomeCopy.textContent=message;
  }
  function updateProgress() {
    const todays=memories.filter((item)=>dayKey(item.unlock_at)===dayKey(nowMs()));
    const opened=todays.filter((item)=>item.is_unlocked&&openedIds.has(item.id)).length; const ready=todays.filter((item)=>item.is_unlocked&&!openedIds.has(item.id)).length; const total=todays.length; const fraction=total?opened/total:0;
    progressNumber.textContent=`${opened}/${total}`; progressRing.style.setProperty('--progress',`${Math.round(fraction*360)}deg`); progressBar.style.width=`${Math.round(fraction*100)}%`;
    if(!total) progressText.textContent='En lugn dag utan planerade tider';
    else if(opened===total) progressText.textContent='Alla dagens händelser är öppnade';
    else if(ready>0&&opened===0) progressText.textContent=`${ready} ${ready===1?'händelse är redo':'händelser är redo'} att öppnas`;
    else if(opened===0) progressText.textContent=`${total} ${total===1?'händelse väntar':'händelser väntar'} idag`;
    else progressText.textContent=`${opened} av ${total} öppnade idag`;
  }
  function updateCountdown() {
    const now=nowMs(); const next=memories.find((item)=>!item.is_unlocked&&new Date(item.unlock_at).getTime()>now);
    if(!next){ nextMessage.textContent=memories.length?'Tidslinjen är lugn just nu.':'Inga händelser är planerade ännu.'; return; }
    const ms=new Date(next.unlock_at).getTime()-now; const minutes=Math.max(0,Math.floor(ms/60000)); const hours=Math.floor(minutes/60); const remaining=minutes%60; const days=Math.floor(ms/86400000);
    if(days>=1) nextMessage.textContent=`Nästa händelse blir redo ${formatDay(next.unlock_at).toLocaleLowerCase('sv-SE')} klockan ${formatTime(next.unlock_at)}.`;
    else if(hours>=1) nextMessage.textContent=`Nästa händelse blir redo om ${hours} h ${remaining} min.`;
    else if(minutes>=1) nextMessage.textContent=`Nästa händelse blir redo om ${minutes} min.`;
    else nextMessage.textContent='Nästa händelse blir redo alldeles strax.';
  }
  function scheduleNextUnlock() {
    clearTimeout(nextUnlockTimer); clearInterval(countdownTimer); updateCountdown(); countdownTimer=setInterval(updateCountdown,30000);
    const now=nowMs(); const next=memories.find((item)=>!item.is_unlocked&&new Date(item.unlock_at).getTime()>now); if(!next)return;
    const delay=Math.min(new Date(next.unlock_at).getTime()-now+700,2147480000); nextUnlockTimer=setTimeout(()=>refreshTimeline({announce:true}),Math.max(500,delay));
  }

  function createBadge(memory) {
    const badge=el('span','card-type'); badge.append(icon(typeIcon(memory.content_type),'badge-icon'),document.createTextNode(typeLabel(memory.content_type))); return badge;
  }
  function createSender(memory) {
    const row=el('div','sender-row'); row.appendChild(el('div','sender-avatar',initials(memory.friend_name)));
    const copy=el('div','sender-copy'); copy.append(el('span','','Från'),el('strong','',memory.friend_name||'någon som tänker på dig')); row.appendChild(copy); return row;
  }
  function createTopline(memory) {
    const top=el('div','card-topline'); const time=el('span','card-time'); time.append(icon('clock','time-icon'),document.createTextNode(formatTime(memory.unlock_at))); top.append(time,createBadge(memory)); return top;
  }

  function makeCardInteractive(card,handler,label) {
    card.classList.add('interactive-card'); card.tabIndex=0; card.setAttribute('role','button'); card.setAttribute('aria-label',label);
    card.addEventListener('click',handler); card.addEventListener('keydown',(event)=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();handler();}});
  }
  function createLockedCard(memory,index,isNext) {
    const item=el('article',`timeline-item locked${isNext?' next-up':''}`); item.dataset.memoryId=memory.id; item.style.animationDelay=`${Math.min(index*.055,.4)}s`; item.appendChild(el('span','timeline-node'));
    const card=el('div','memory-card'); const inner=el('div','memory-card-inner'); const top=el('div','card-topline'); const time=el('span','card-time');
    time.append(icon('clock','time-icon'),document.createTextNode(formatTime(memory.unlock_at))); const badge=el('span','card-type'); badge.append(icon('lock','badge-icon'),document.createTextNode(isNext?'nästa':'väntar')); top.append(time,badge); inner.appendChild(top);
    const stage=el('div','locked-stage'); const orb=el('div','mystery-orb'); orb.appendChild(icon(mysteryIcons[index%mysteryIcons.length],'mystery-icon')); stage.appendChild(orb);
    const copy=el('div','locked-copy'); copy.append(el('strong','',isNext?'Nästa händelse':mysteryTitles[index%mysteryTitles.length]),el('p','',isNext?'Något väntar här. Tryck om du vill se hur länge det är kvar.':mysterySubtitles[index%mysterySubtitles.length])); stage.appendChild(copy); inner.appendChild(stage);
    card.append(inner,el('span','locked-shimmer')); makeCardInteractive(card,()=>showWaitDialog(memory),`Låst händelse. Blir redo ${formatDay(memory.unlock_at)} klockan ${formatTime(memory.unlock_at)}`); item.appendChild(card); return item;
  }
  function createReadyCard(memory,index) {
    const item=el('article','timeline-item ready'); item.dataset.memoryId=memory.id; item.style.animationDelay=`${Math.min(index*.055,.4)}s`; item.appendChild(el('span','timeline-node'));
    const card=el('div','memory-card'); const inner=el('div','memory-card-inner'); const top=el('div','card-topline'); const time=el('span','card-time');
    time.append(icon('clock','time-icon'),document.createTextNode(formatTime(memory.unlock_at))); const badge=el('span','card-type ready-badge'); badge.append(icon('gift','badge-icon'),document.createTextNode('redo')); top.append(time,badge); inner.appendChild(top);
    const stage=el('div','locked-stage ready-stage'); const orb=el('div','mystery-orb ready-orb'); orb.appendChild(icon('gift','mystery-icon')); stage.appendChild(orb);
    const copy=el('div','locked-copy'); copy.append(el('strong','','Redo att öppnas'),el('p','','Tryck när du känner för det. Den ligger kvar tills dess.')); stage.appendChild(copy); inner.appendChild(stage);
    const button=el('span','ready-open-label'); button.append(icon('sparkle'),document.createTextNode('Öppna händelsen')); inner.appendChild(button); card.appendChild(inner);
    makeCardInteractive(card,()=>markOpened(memory.id),'Öppna händelsen'); item.appendChild(card); return item;
  }

  function appendMessage(memory,wrap) { if(memory.title)wrap.appendChild(el('h3','memory-title',memory.title)); if(memory.body)wrap.appendChild(el('p','memory-body',memory.body)); }
  async function resolveViewerImage(memory) {
    if (memory.image_data) return memory.image_data;
    if (imageUrlCache.has(memory.id)) return imageUrlCache.get(memory.id);
    const promise=dataApi.getViewerImageUrl(viewerPin,memory.id).then((url)=>{
      if (!url) throw new Error('Bilden kunde inte hämtas');
      memory.image_data=url;
      return url;
    }).catch((error)=>{
      imageUrlCache.delete(memory.id);
      throw error;
    });
    imageUrlCache.set(memory.id,promise);
    return promise;
  }
  async function showImageDialog(memory) {
    let overlay=document.getElementById('image-lightbox-overlay');
    if(!overlay){
      overlay=el('div','image-lightbox-overlay'); overlay.id='image-lightbox-overlay'; overlay.hidden=true;
      const panel=el('div','image-lightbox'); panel.setAttribute('role','dialog'); panel.setAttribute('aria-modal','true'); panel.setAttribute('aria-label','Öppnad bild');
      const close=el('button','image-lightbox-close'); close.type='button'; close.setAttribute('aria-label','Stäng bilden'); close.appendChild(icon('close'));
      const stage=el('div','image-lightbox-stage'); const image=document.createElement('img'); image.className='image-lightbox-image'; const loading=el('div','image-lightbox-loading','Hämtar bilden...'); stage.append(image,loading);
      panel.append(close,stage); overlay.appendChild(panel); document.body.appendChild(overlay);
      const closeDialog=()=>{overlay.hidden=true;document.body.classList.remove('dialog-open');};
      close.addEventListener('click',closeDialog); overlay.addEventListener('click',(event)=>{if(event.target===overlay)closeDialog();});
      document.addEventListener('keydown',(event)=>{if(event.key==='Escape'&&!overlay.hidden)closeDialog();});
    }
    const image=overlay.querySelector('.image-lightbox-image');
    const loading=overlay.querySelector('.image-lightbox-loading');
    image.removeAttribute('src'); image.hidden=true; loading.hidden=false;
    overlay.hidden=false; document.body.classList.add('dialog-open');
    window.setTimeout(()=>overlay.querySelector('.image-lightbox-close')?.focus(),0);
    try {
      image.src=await resolveViewerImage(memory);
      image.alt=memory.title||`Bild från ${memory.friend_name||'en vän'}`;
      image.hidden=false; loading.hidden=true;
    } catch (error) {
      loading.textContent=error.message || 'Bilden kunde inte hämtas';
    }
  }
  function createImage(memory) {
    const figure=el('figure','memory-media image-media image-preview-media');
    const button=el('button','image-preview-button'); button.type='button'; button.setAttribute('aria-label','Visa bilden större');
    const img=document.createElement('img'); img.className='memory-image image-preview-thumb'; img.alt=memory.title||`Bild från ${memory.friend_name||'en vän'}`; img.loading='lazy'; img.hidden=true;
    const loading=el('span','image-preview-loading','Hämtar bilden...');
    const hint=el('span','image-preview-hint'); hint.append(icon('expand'),document.createTextNode('Visa bilden'));
    button.append(img,loading,hint); button.disabled=true;
    resolveViewerImage(memory).then((url)=>{img.src=url;img.hidden=false;loading.hidden=true;button.disabled=false;}).catch((error)=>{loading.textContent=error.message||'Bilden kunde inte hämtas';});
    button.addEventListener('click',()=>showImageDialog(memory)); figure.appendChild(button); return figure;
  }
  function safeLink(value) {
    try { const url=new URL(String(value || '').trim()); return url.protocol==='https:' ? url.href : ''; } catch (_) { return ''; }
  }
  function createVideo(memory) {
    const url=safeLink(memory.extra_data?.link_url || memory.extra_data?.media_url || (memory.youtube_id?`https://youtu.be/${memory.youtube_id}`:''));
    const youtubeId=memory.youtube_id || '';
    const wrap=el('div','linked-media memory-media media-first');
    if(youtubeId){
      const cover=el('div','video-cover linked-media-cover');
      cover.classList.add('has-thumbnail');
      cover.style.backgroundImage=`linear-gradient(rgba(45,66,55,.16),rgba(45,66,55,.42)),url("https://i.ytimg.com/vi/${encodeURIComponent(youtubeId)}/hqdefault.jpg")`;
      const play=el('button','play-button'); play.type='button'; play.setAttribute('aria-label','Spela klippet här'); play.appendChild(icon('play','play-icon'));
      play.addEventListener('click',()=>{
        const iframe=document.createElement('iframe'); iframe.className='video-frame'; iframe.src=`https://www.youtube-nocookie.com/embed/${encodeURIComponent(youtubeId)}?autoplay=1&rel=0`; iframe.title=memory.title||'YouTube-klipp'; iframe.allow='autoplay; encrypted-media; picture-in-picture'; iframe.allowFullscreen=true; cover.replaceWith(iframe);
      });
      cover.appendChild(play); wrap.appendChild(cover);
    } else {
      const card=el('div','external-link-card'); const mark=el('div','external-link-icon'); mark.appendChild(icon('link'));
      let host='Videoklipp'; try{host=new URL(url).hostname.replace(/^www\./,'');}catch(_){}
      const copy=el('div','external-link-copy'); copy.append(el('strong','',host),el('span','','Öppnas i originalappen eller webbläsaren'));
      card.append(mark,copy); wrap.appendChild(card);
    }
    if(url){
      const open=document.createElement('a'); open.className='secondary-button compact-button button-with-icon media-open-link'; open.href=url; open.target='_blank'; open.rel='noopener noreferrer';
      open.append(icon('external-link'),document.createTextNode(youtubeId?'Öppna i YouTube':'Öppna videoklippet')); wrap.appendChild(open);
    }
    return wrap;
  }
  function createQuiz(memory) {
    const questions=dataApi.decodeQuizQuestions(memory,false);
    const total=Math.max(1,questions.length);
    let state=quizStates.get(memory.id);
    if(!state||state.total!==total){state={total,index:0,score:0,answers:{},completed:false};quizStates.set(memory.id,state);}
    const quiz=el('div','quiz-box miniquiz-box');
    function render(){
      quiz.innerHTML='';
      const title=el('div','quiz-label'); title.append(icon('quiz','quiz-label-icon'),document.createTextNode('Miniquiz')); quiz.appendChild(title);
      if(state.completed){
        const summary=el('div','miniquiz-summary'); const mark=el('div','miniquiz-summary-icon'); mark.appendChild(icon('check'));
        summary.append(mark,el('strong','',`${state.score} av ${total} rätt`),el('p','',state.score===total?'Full pott. Snyggt jobbat!':'Klart! Miniquizet är avklarat.'));
        quiz.appendChild(summary); return;
      }
      const index=Math.min(state.index,total-1); const question=questions[index]||{question:memory.quiz_question||'Dagens fråga',options:Array.isArray(memory.quiz_options)?memory.quiz_options:[]};
      const progress=el('div','miniquiz-progress'); progress.append(el('span','',`Fråga ${index+1} av ${total}`));
      const dots=el('div','miniquiz-dots'); for(let i=0;i<total;i+=1){const dot=el('span',`miniquiz-dot${i<index?' done':i===index?' active':''}`);dots.appendChild(dot);} progress.appendChild(dots); quiz.appendChild(progress);
      quiz.appendChild(el('p','quiz-question',question.question||`Fråga ${index+1}`));
      const options=el('div','quiz-options'); const result=el('p','quiz-result'); result.hidden=true; result.setAttribute('aria-live','polite');
      const next=el('button','secondary-button compact-button miniquiz-next button-with-icon'); next.type='button'; next.hidden=true; next.append(icon(index===total-1?'check':'arrow-right'),document.createTextNode(index===total-1?'Visa resultat':'Nästa fråga'));
      const saved=state.answers[index];
      (Array.isArray(question.options)?question.options:[]).forEach((option)=>{
        const button=el('button','quiz-option',option); button.type='button';
        if(saved){button.disabled=true;if(saved.selected===option)button.classList.add(saved.correct?'correct':'incorrect');}
        button.addEventListener('click',async()=>{
          if(state.answers[index])return;
          Array.from(options.children).forEach((child)=>{child.disabled=true;}); result.hidden=false; result.textContent='Kollar svaret...';
          try{
            const response=await dataApi.checkQuiz(viewerPin,memory.id,index,option);
            state.answers[index]={selected:option,correct:Boolean(response.correct),explanation:response.explanation||'',correctAnswer:response.correct_answer||''};
            if(response.correct)state.score+=1;
            button.classList.add(response.correct?'correct':'incorrect');
            result.textContent=response.correct?`Rätt! ${response.explanation||'Snyggt fångat.'}`:`Inte riktigt.${response.correct_answer?` Rätt svar är ${response.correct_answer}.`:''}${response.explanation?` ${response.explanation}`:''}`;
            next.hidden=false;
          }catch(error){Array.from(options.children).forEach((child)=>{child.disabled=false;});result.textContent=error.message;}
        }); options.appendChild(button);
      });
      if(saved){
        result.hidden=false;
        result.textContent=saved.correct?`Rätt! ${saved.explanation||'Snyggt fångat.'}`:`Inte riktigt.${saved.correctAnswer?` Rätt svar är ${saved.correctAnswer}.`:''}${saved.explanation?` ${saved.explanation}`:''}`;
        next.hidden=false;
      }
      next.addEventListener('click',()=>{if(index===total-1)state.completed=true;else state.index=index+1;render();});
      quiz.append(options,result,next);
    }
    render(); return quiz;
  }

  function sudokuStorageKey(id) { return `handelser_sudoku_state_${id}`; }
  function loadSudokuState(memory) {
    const puzzle=sudokuApi.normalize(memory.extra_data?.sudoku_puzzle); const solution=sudokuApi.normalize(memory.extra_data?.sudoku_solution);
    try {
      const saved=JSON.parse(localStorage.getItem(sudokuStorageKey(memory.id))||'null');
      if(saved&&Array.isArray(saved.values)&&saved.values.length===16) return {puzzle,solution,values:saved.values.map(String),completed:Boolean(saved.completed)};
    } catch(_){}
    return {puzzle,solution,values:puzzle.split('').map((value)=>value==='0'?'':value),completed:false};
  }
  function saveSudokuState(memory,state) { localStorage.setItem(sudokuStorageKey(memory.id),JSON.stringify({values:state.values,completed:state.completed})); }
  function createSudoku(memory) {
    const state=loadSudokuState(memory); const block=el('div','sudoku-card-block'); const label=el('div','activity-card-label'); label.append(icon('sudoku'),document.createTextNode('Lätt 4 × 4-sudoku')); block.appendChild(label);
    const intro=el('p','activity-help','Fyll varje rad, kolumn och 2 × 2-ruta med siffrorna 1–4. Ingen tidtagning.'); block.appendChild(intro);
    const grid=el('div','sudoku-grid'); let selected=-1; const inputs=[];
    function selectCell(index){ selected=index; inputs.forEach((input,i)=>input.classList.toggle('selected',i===index)); }
    state.puzzle.split('').forEach((given,index)=>{
      const input=document.createElement('input'); input.className=`sudoku-cell${given!=='0'?' given':''}`; input.type='text'; input.inputMode='numeric'; input.maxLength=1; input.value=state.values[index]||''; input.disabled=given!=='0'||state.completed; input.setAttribute('aria-label',`Sudokuruta ${index+1}`);
      if(index%4===1)input.classList.add('box-right'); if(Math.floor(index/4)===1)input.classList.add('box-bottom');
      input.addEventListener('focus',()=>selectCell(index)); input.addEventListener('click',()=>selectCell(index));
      input.addEventListener('input',()=>{ input.value=input.value.replace(/[^1-4]/g,'').slice(0,1); state.values[index]=input.value; input.classList.remove('wrong'); saveSudokuState(memory,state); });
      inputs.push(input); grid.appendChild(input);
    }); block.appendChild(grid);
    const pad=el('div','sudoku-number-pad'); ['1','2','3','4'].forEach((number)=>{ const button=el('button','sudoku-number',number); button.type='button'; button.disabled=state.completed; button.addEventListener('click',()=>{ if(selected<0||inputs[selected].disabled)return; inputs[selected].value=number; state.values[selected]=number; inputs[selected].classList.remove('wrong'); saveSudokuState(memory,state); }); pad.appendChild(button); }); block.appendChild(pad);
    const status=el('p','sudoku-status'); status.setAttribute('aria-live','polite'); if(state.completed){status.textContent='Klart! Snyggt löst 🌿'; block.classList.add('completed');}
    const actions=el('div','sudoku-actions');
    const hint=el('button','small-button button-with-icon'); hint.type='button'; hint.disabled=state.completed; hint.append(icon('sparkle'),document.createTextNode('Visa en siffra')); hint.addEventListener('click',()=>{
      const candidates=state.values.map((value,index)=>({value,index})).filter(({value,index})=>state.puzzle[index]==='0'&&value!==state.solution[index]);
      if(!candidates.length){status.textContent='Alla siffror ser redan rätt ut.';return;} const target=candidates[0].index; state.values[target]=state.solution[target]; inputs[target].value=state.solution[target]; inputs[target].classList.remove('wrong'); saveSudokuState(memory,state); status.textContent='En siffra fylldes i.';
    });
    const check=el('button','secondary-button compact-button button-with-icon'); check.type='button'; check.disabled=state.completed; check.append(icon('check'),document.createTextNode('Kontrollera')); check.addEventListener('click',()=>{
      let wrong=0,empty=0; state.values.forEach((value,index)=>{ const input=inputs[index]; input.classList.remove('wrong'); if(!value)empty+=1; else if(value!==state.solution[index]){wrong+=1;if(!input.disabled)input.classList.add('wrong');} });
      if(!wrong&&!empty){ state.completed=true; saveSudokuState(memory,state); block.classList.add('completed'); inputs.forEach((input)=>{input.disabled=true;}); pad.querySelectorAll('button').forEach((button)=>{button.disabled=true;}); hint.disabled=true; check.disabled=true; status.textContent='Klart! Snyggt löst 🌿'; }
      else if(wrong)status.textContent=`${wrong===1?'En ruta verkar':'Några rutor verkar'} behöva en ny titt.`; else status.textContent='Några rutor är fortfarande tomma.';
    }); actions.append(hint,check); block.append(actions,status); return block;
  }
  function createFact(memory) {
    const block=el('div','fact-card-block'); const label=el('div','activity-card-label'); label.append(icon('fact'),document.createTextNode('Visste du att...')); block.appendChild(label);
    block.appendChild(el('p','fact-text',memory.extra_data?.fact_text||'Den här faktan verkar ha tagit en liten omväg.'));
    if(memory.extra_data?.fact_category&&memory.extra_data.fact_category!=='Egen') block.appendChild(el('span','fact-category',memory.extra_data.fact_category));
    return block;
  }

  function createUnlockedCard(memory,index) {
    const item=el('article',`timeline-item unlocked type-${memory.content_type}`); item.dataset.memoryId=memory.id; item.style.animationDelay=`${Math.min(index*.055,.4)}s`; item.appendChild(el('span','timeline-node'));
    const card=el('div','memory-card');
    if(memory.content_type==='youtube'&&(memory.youtube_id||memory.extra_data?.link_url||memory.extra_data?.media_url)) card.appendChild(createVideo(memory));
    const inner=el('div','memory-card-inner'); inner.append(createTopline(memory),createSender(memory)); appendMessage(memory,inner); card.appendChild(inner);
    if(memory.content_type==='image'&&(memory.image_data||memory.image_path))card.appendChild(createImage(memory));
    if(memory.content_type==='quiz'){const wrap=el('div','card-content-block');wrap.appendChild(createQuiz(memory));card.appendChild(wrap);}
    if(memory.content_type==='sudoku'){const wrap=el('div','card-content-block activity-content-block');wrap.appendChild(createSudoku(memory));card.appendChild(wrap);}
    if(memory.content_type==='fact'){const wrap=el('div','card-content-block activity-content-block');wrap.appendChild(createFact(memory));card.appendChild(wrap);}
    item.appendChild(card); return item;
  }

  function renderTimeline() {
    timeline.innerHTML=''; timeline.setAttribute('aria-busy','false');
    if(!memories.length){ const empty=el('div','empty-state'); const mark=el('div','empty-icon'); mark.appendChild(icon('flower')); empty.append(mark,el('p','','Det är lugnt här just nu. Nästa händelse dyker upp när någon har lagt in något.')); timeline.appendChild(empty); return; }
    const groups=new Map(); memories.forEach((memory)=>{const key=dayKey(memory.unlock_at);if(!groups.has(key))groups.set(key,[]);groups.get(key).push(memory);});
    const next=memories.find((item)=>!item.is_unlocked&&new Date(item.unlock_at).getTime()>nowMs()); const nextId=next?next.id:null; let index=0;
    groups.forEach((items)=>{ const section=el('section','day-group'); const heading=el('div','day-heading'); heading.appendChild(el('h2','',formatDay(items[0].unlock_at))); const waiting=items.filter((item)=>!item.is_unlocked).length; const ready=items.filter((item)=>item.is_unlocked&&!openedIds.has(item.id)).length; const opened=items.filter((item)=>item.is_unlocked&&openedIds.has(item.id)).length; let summary=`${items.length} ${items.length===1?'händelse':'händelser'}`; if(opened&&ready)summary=`${opened} öppnade, ${ready} redo`; else if(ready&&waiting)summary=`${ready} redo, ${waiting} väntar`; else if(ready)summary=`${ready} ${ready===1?'redo att öppnas':'redo att öppnas'}`; else if(waiting&&opened)summary=`${opened} öppnade, ${waiting} väntar`; else if(waiting)summary=`${waiting} ${waiting===1?'händelse väntar':'händelser väntar'}`; else if(opened)summary=`${opened} ${opened===1?'öppnad':'öppnade'}`; heading.appendChild(el('span','',summary)); section.appendChild(heading); items.forEach((memory)=>{section.appendChild(!memory.is_unlocked?createLockedCard(memory,index,memory.id===nextId):openedIds.has(memory.id)?createUnlockedCard(memory,index):createReadyCard(memory,index));index+=1;}); timeline.appendChild(section); });
  }

  function readKnownIds() {
    try { const value=JSON.parse(localStorage.getItem(KNOWN_IDS_KEY)||'[]'); return new Set(Array.isArray(value)?value:[]); } catch (_) { return new Set(); }
  }
  function saveKnownIds(ids) { try { localStorage.setItem(KNOWN_IDS_KEY,JSON.stringify(Array.from(ids))); } catch (_) {} }

  async function refreshTimeline(options) {
    const opts=options||{};
    try{
      const [fresh,freshPresentation]=await Promise.all([dataApi.getTimeline(viewerPin),dataApi.getViewerPresentation(viewerPin)]);
      presentation=freshPresentation || presentation;
      updateHeader();
      const freshIds=new Set(fresh.map((item)=>item.id));
      Array.from(imageUrlCache.keys()).forEach((id)=>{if(!freshIds.has(id))imageUrlCache.delete(id);});
      const knownIds=didInitialLoad?new Set(memories.map((item)=>item.id)):readKnownIds();
      const addedIds=Array.from(freshIds).filter((id)=>!knownIds.has(id));
      const freshUnlocked=new Set(fresh.filter((item)=>item.is_unlocked).map((item)=>item.id));
      const newlyUnlocked=didInitialLoad?Array.from(freshUnlocked).filter((id)=>!previousUnlockedIds.has(id)):[];
      const signature=JSON.stringify(fresh); memories=fresh; openedIds=new Set(Array.from(openedIds).filter((id)=>freshIds.has(id))); saveOpenedIds(); previousUnlockedIds=freshUnlocked;
      if(signature!==lastTimelineSignature){renderTimeline();lastTimelineSignature=signature;}
      updateProgress(); scheduleNextUnlock(); saveKnownIds(freshIds);
      if(addedIds.length && (didInitialLoad || knownIds.size)) {
        if(didInitialLoad) showToast(addedIds.length>1?`${addedIds.length} nya händelser har lagts till`:'Någon har lagt till en ny händelse');
        else showToast(addedIds.length>1?`${addedIds.length} nya händelser har kommit sedan sist`:'En ny händelse har kommit sedan sist');
      } else if((opts.announce||newlyUnlocked.length)&&newlyUnlocked.length) {
        showToast(newlyUnlocked.length>1?'Flera händelser är redo att öppnas':'En ny händelse är redo att öppnas');
      }
      didInitialLoad=true;
    }catch(error){
      if(/fel kod/i.test(error.message)){clearPin();appShell.hidden=true;gate.hidden=false;setGateStatus('Koden stämde inte. Försök igen.','error');return;}
      timeline.innerHTML=''; const state=el('div','error-state'); state.appendChild(el('p','',`Tidslinjen kunde inte hämtas: ${error.message}`)); const retry=el('button','secondary-button button-with-icon');retry.type='button';retry.append(icon('refresh'),document.createTextNode('Försök igen'));retry.addEventListener('click',()=>refreshTimeline());state.appendChild(retry);timeline.appendChild(state);
    }
  }

  async function openApp(pin) {
    viewerPin=pin;setGateStatus('Öppnar din dag...');
    try{const [,freshPresentation]=await Promise.all([dataApi.getTimeline(pin),dataApi.getViewerPresentation(pin)]);presentation=freshPresentation || presentation;savePin(pin);gate.hidden=true;appShell.hidden=false;updateHeader();await refreshTimeline();setGateStatus('');return true;}
    catch(error){viewerPin='';throw error;}
  }

  function isWrongCode(error) {
    return /fel kod/i.test(String(error?.message||''));
  }

  async function routeFromSharedCode(pin) {
    setGateStatus('Kontrollerar koden...');
    try {
      await openApp(pin);
      return;
    } catch (error) {
      if (!isWrongCode(error)) { setGateStatus(error.message||'Kunde inte kontrollera koden.','error'); return; }
    }
    try {
      await dataApi.verifyFriend(pin);
      clearPin();
      sessionStorage.setItem(FRIEND_REDIRECT_KEY,pin);
      window.location.assign('/vanner/');
      return;
    } catch (error) {
      if (!isWrongCode(error)) { setGateStatus(error.message||'Kunde inte kontrollera koden.','error'); return; }
    }
    try {
      await dataApi.verifyAdmin(pin);
      clearPin();
      sessionStorage.setItem(ADMIN_REDIRECT_KEY,pin);
      window.location.assign('/admin/');
    } catch (error) {
      setGateStatus(isWrongCode(error)?'Koden stämde inte. Försök igen.':(error.message||'Kunde inte kontrollera koden.'),'error');
    }
  }

  loginForm.addEventListener('submit',(event)=>{event.preventDefault();const pin=pinInput.value.trim();if(pin)routeFromSharedCode(pin);});
  lockButton.addEventListener('click',()=>{clearPin();appShell.hidden=true;gate.hidden=false;pinInput.value='';pinInput.focus();});
  dataApi.subscribe(()=>{if(viewerPin)refreshTimeline({announce:true});});
  clearInterval(syncTimer); syncTimer=setInterval(()=>{if(viewerPin&&!document.hidden)refreshTimeline();},Math.max(5000,Number(config.pollIntervalMs||12000)));
  document.addEventListener('visibilitychange',()=>{if(!document.hidden&&viewerPin)refreshTimeline();});
  window.addEventListener('online',()=>{if(viewerPin)refreshTimeline();});
  updateHeader(); const remembered=storedPin(); if(remembered){rememberInput.checked=Boolean(localStorage.getItem(REMEMBER_KEY));openApp(remembered).catch((error)=>{clearPin();gate.hidden=false;setGateStatus(isWrongCode(error)?'Koden behöver anges igen.':(error.message||'Kunde inte öppna appen.'),'error');pinInput.focus();});}else{gate.hidden=false;pinInput.focus();}
})();
