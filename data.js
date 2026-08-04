(function () {
  'use strict';

  const config = window.HANDELSER_CONFIG || {};
  const facts = (window.HandelserFacts && window.HandelserFacts.all) || [];
  const sudoku = window.HandelserSudoku;
  const STORAGE_KEY = 'handelser_local_v8';
  const CHANNEL_NAME = 'handelser_updates';
  const IMAGE_BUCKET = 'handelser-images';
  let supabase = null;
  let supabasePromise = null;
  let channel = null;
  let pollTimer = null;
  let serverAnchorMs = null;
  let performanceAnchorMs = null;

  const clone = (value) => JSON.parse(JSON.stringify(value));
  const nowIso = () => new Date().toISOString();
  const uid = () => (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`);
  const addMinutes = (date,minutes) => new Date(date.getTime()+minutes*60000).toISOString();

  function setAuthoritativeClock(value,networkHalfTripMs=0) {
    const parsed = typeof value==='number' ? value : new Date(value).getTime();
    if (!Number.isFinite(parsed)) return;
    serverAnchorMs = parsed + Math.max(0,Number(networkHalfTripMs)||0);
    performanceAnchorMs = performance.now();
  }
  function authoritativeNowMs() {
    if (Number.isFinite(serverAnchorMs) && Number.isFinite(performanceAnchorMs)) {
      return serverAnchorMs + (performance.now()-performanceAnchorMs);
    }
    return Date.now();
  }

  function stockholmDay(value) {
    return new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Stockholm',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(value));
  }

  function defaultStore() {
    const now = new Date();
    const puzzle = sudoku ? sudoku.generate() : {puzzle:'1000341000404301',solution:'1234341221434321'};
    return {
      version:8,
      settings:{daily_limit:Number(config.defaultDailyLimit || 6),recipient_name:String(config.recipientName || ''),welcome_message:'Här väntar små händelser att öppna när du vill och orkar.'},
      help_requests:[],
      memories:[
        {
          id:uid(),contributor_token:'demo',friend_name:'Anna',unlock_at:addMinutes(now,-55),content_type:'text',
          title:'En liten hälsning',body:'Du behöver inte svara på någonting. Jag ville bara skicka lite värme och säga att jag tänker på dig.',
          image_data:'',youtube_id:'',quiz_question:'',quiz_options:[],quiz_answer:'',quiz_explanation:'',extra_data:{},created_at:addMinutes(now,-140),updated_at:addMinutes(now,-140)
        },
        {
          id:uid(),contributor_token:'demo',friend_name:'Marcus',unlock_at:addMinutes(now,-25),content_type:'fact',
          title:'Dagens helt nödvändiga kunskap',body:'En liten sak att läsa och kanske le åt. Inget prov kommer senare.',
          image_data:'',youtube_id:'',quiz_question:'',quiz_options:[],quiz_answer:'',quiz_explanation:'',
          extra_data:{fact_id:'djur-01',fact_category:'Djur',fact_text:'Bläckfiskar har tre hjärtan.',fact_mode:'bank'},created_at:addMinutes(now,-120),updated_at:addMinutes(now,-120)
        },
        {
          id:uid(),contributor_token:'demo',friend_name:'Johan',unlock_at:addMinutes(now,-12),content_type:'quiz',
          title:'Tre snabba',body:'Ett litet miniquiz utan tidtagning. Ta det i din egen takt.',image_data:'',youtube_id:'',
          quiz_question:'Vilket djur har tre hjärtan?',
          quiz_options:[
            {question:'Vilket djur har tre hjärtan?',options:['Bläckfisken','Delfinen','Pingvinen']},
            {question:'Vilken planet har ett dygn som är längre än sitt år?',options:['Mars','Venus','Jupiter']},
            {question:'Vad är vanilj botaniskt kopplad till?',options:['En orkidé','Ett barrträd','En kaktus']}
          ],
          quiz_answer:JSON.stringify(['Bläckfisken','Venus','En orkidé']),
          quiz_explanation:JSON.stringify(['Bläckfiskar har faktiskt tre hjärtan.','Venus roterar så långsamt att dygnet blir längre än året.','Vanilj kommer från frökapseln hos en orkidé.']),
          extra_data:{},created_at:addMinutes(now,-110),updated_at:addMinutes(now,-110)
        },
        {
          id:uid(),contributor_token:'demo',friend_name:'Sofia',unlock_at:addMinutes(now,4),content_type:'sudoku',
          title:'Ett litet pyssel',body:'Ta det bara om du känner för det. Det är ett lätt 4 × 4-sudoku, helt utan tidtagning.',
          image_data:'',youtube_id:'',quiz_question:'',quiz_options:[],quiz_answer:'',quiz_explanation:'',
          extra_data:{sudoku_puzzle:puzzle.puzzle,sudoku_solution:puzzle.solution,sudoku_size:4},created_at:addMinutes(now,-100),updated_at:addMinutes(now,-100)
        },
        {
          id:uid(),contributor_token:'demo',friend_name:'Kusin Lina',unlock_at:addMinutes(now,70),content_type:'youtube',title:'En liten paus',
          body:'Jag valde det här klippet eftersom det alltid får mig att le. Hoppas det kan ge dig några fina minuter också.',image_data:'',youtube_id:'dQw4w9WgXcQ',
          quiz_question:'',quiz_options:[],quiz_answer:'',quiz_explanation:'',extra_data:{},created_at:addMinutes(now,-80),updated_at:addMinutes(now,-80)
        }
      ]
    };
  }

  function normalizeMemory(item) {
    return {
      ...item,
      title:item.title || '',body:item.body || '',image_data:item.image_data || '',image_path:item.image_path || '',youtube_id:item.youtube_id || '',
      quiz_question:item.quiz_question || '',quiz_options:Array.isArray(item.quiz_options)?item.quiz_options:[],quiz_answer:item.quiz_answer || '',
      quiz_explanation:item.quiz_explanation || '',extra_data:item.extra_data && typeof item.extra_data==='object' ? item.extra_data : {}
    };
  }
  function parseJsonArray(value) {
    if (Array.isArray(value)) return value;
    if (typeof value!=='string' || !value.trim()) return [];
    try { const parsed=JSON.parse(value); return Array.isArray(parsed)?parsed:[]; } catch (_) { return []; }
  }
  function decodeQuizQuestions(item,includeAnswers) {
    const memory=normalizeMemory(item || {});
    const options=Array.isArray(memory.quiz_options)?memory.quiz_options:[];
    const hasMulti=options.length>0 && options.every((entry)=>entry && typeof entry==='object' && !Array.isArray(entry));
    if (hasMulti) {
      const answers=parseJsonArray(memory.quiz_answer);
      const explanations=parseJsonArray(memory.quiz_explanation);
      return options.slice(0,4).map((entry,index)=>({
        question:String(entry.question || '').trim(),
        options:(Array.isArray(entry.options)?entry.options:[]).slice(0,4).map((value)=>String(value || '').trim()).filter(Boolean),
        answer:includeAnswers===false?'':String(answers[index] || '').trim(),
        explanation:includeAnswers===false?'':String(explanations[index] || '').trim()
      })).filter((entry)=>entry.question || entry.options.length);
    }
    if (!memory.quiz_question && !options.length) return [];
    return [{
      question:String(memory.quiz_question || '').trim(),
      options:options.slice(0,4).map((value)=>String(value || '').trim()).filter(Boolean),
      answer:includeAnswers===false?'':String(memory.quiz_answer || '').trim(),
      explanation:includeAnswers===false?'':String(memory.quiz_explanation || '').trim()
    }];
  }
  function encodeQuizQuestions(questions) {
    const clean=(Array.isArray(questions)?questions:[]).slice(0,4).map((entry)=>({
      question:String(entry.question || '').trim().slice(0,600),
      options:(Array.isArray(entry.options)?entry.options:[]).slice(0,4).map((value)=>String(value || '').trim().slice(0,160)).filter(Boolean),
      answer:String(entry.answer || '').trim().slice(0,160),
      explanation:String(entry.explanation || '').trim().slice(0,1000)
    }));
    return {
      quiz_question:clean[0]?.question || '',
      quiz_options:clean.map((entry)=>({question:entry.question,options:entry.options})),
      quiz_answer:JSON.stringify(clean.map((entry)=>entry.answer)),
      quiz_explanation:JSON.stringify(clean.map((entry)=>entry.explanation))
    };
  }
  function normalizeStore(store) {
    store.version = 8;
    store.settings = store.settings && typeof store.settings==='object' ? store.settings : {daily_limit:Number(config.defaultDailyLimit || 6),recipient_name:String(config.recipientName || ''),welcome_message:'Här väntar små händelser att öppna när du vill och orkar.'};
    store.settings.daily_limit = Math.max(1,Math.min(24,Number(store.settings.daily_limit || config.defaultDailyLimit || 6)));
    store.settings.recipient_name = String(store.settings.recipient_name || config.recipientName || '').trim().slice(0,60);
    store.settings.welcome_message = String(store.settings.welcome_message || 'Här väntar små händelser att öppna när du vill och orkar.').trim().slice(0,280);
    store.help_requests = Array.isArray(store.help_requests) ? store.help_requests : [];
    store.memories = Array.isArray(store.memories) ? store.memories.map(normalizeMemory) : [];
    delete store.reactions;
    return store;
  }
  function loadStore() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        const initial = defaultStore();
        localStorage.setItem(STORAGE_KEY,JSON.stringify(initial));
        return initial;
      }
      const normalized = normalizeStore(JSON.parse(raw));
      localStorage.setItem(STORAGE_KEY,JSON.stringify(normalized));
      return normalized;
    } catch (_) {
      const initial = defaultStore();
      localStorage.setItem(STORAGE_KEY,JSON.stringify(initial));
      return initial;
    }
  }
  function saveStore(store) {
    localStorage.setItem(STORAGE_KEY,JSON.stringify(normalizeStore(store)));
    notifyChange();
  }
  function notifyChange() {
    try {
      const bc = new BroadcastChannel(CHANNEL_NAME);
      bc.postMessage({type:'changed',at:Date.now()});
      bc.close();
    } catch (_) {}
  }
  function checkLocalPin() {
    throw new Error('Lokalt kodläge är avstängt i produktionsversionen');
  }
  function dailyTypeLabel(type) { return type==='sudoku' ? 'sudoku' : 'onödig fakta'; }
  function isDailyLimited(type) { return type==='sudoku' || type==='fact'; }
  function dayAvailableInStore(store,type,unlockAt,ignoreId) {
    if (!isDailyLimited(type)) return true;
    const day = stockholmDay(unlockAt);
    return !store.memories.some((item) => item.id!==ignoreId && item.content_type===type && stockholmDay(item.unlock_at)===day);
  }
  function dailyLimitInStore(store) {
    return Math.max(1,Math.min(24,Number(store.settings?.daily_limit || config.defaultDailyLimit || 6)));
  }
  function dayCountInStore(store,unlockAt,ignoreId) {
    const day=stockholmDay(unlockAt);
    return store.memories.filter((item)=>item.id!==ignoreId && stockholmDay(item.unlock_at)===day).length;
  }
  function assertMemoryAllowed(store,payload,ignoreId) {
    if (!dayAvailableInStore(store,payload.content_type,payload.unlock_at,ignoreId)) {
      throw new Error(`Det finns redan ${dailyTypeLabel(payload.content_type)} den här dagen. Välj en annan dag.`);
    }
    const limit=dailyLimitInStore(store);
    if (dayCountInStore(store,payload.unlock_at,ignoreId)>=limit) {
      throw new Error(`Dagen har redan nått gränsen på ${limit} händelser. Välj en annan dag eller be admin höja gränsen.`);
    }
  }
  function lockedProjection(memory,store) {
    const unlocked = authoritativeNowMs()>=new Date(memory.unlock_at).getTime();
    return {
      id:memory.id,
      unlock_at:memory.unlock_at,
      is_unlocked:unlocked,
      content_type:unlocked?memory.content_type:null,
      title:unlocked?memory.title:null,
      body:unlocked?memory.body:null,
      image_data:unlocked?memory.image_data:null,
      image_path:unlocked?memory.image_path:null,
      youtube_id:unlocked?memory.youtube_id:null,
      quiz_question:unlocked?memory.quiz_question:null,
      quiz_options:unlocked?encodeQuizQuestions(decodeQuizQuestions(memory,false)).quiz_options:null,
      quiz_explanation:null,
      extra_data:unlocked?clone(memory.extra_data || {}):null,
      friend_name:unlocked?memory.friend_name:null,
      created_at:memory.created_at
    };
  }

  async function initSupabase() {
    if (supabase) return supabase;
    if (supabasePromise) return supabasePromise;
    if (!config.supabaseUrl || config.supabaseUrl.includes('DIN_SUPABASE') || !config.supabaseAnonKey || config.supabaseAnonKey.includes('DIN_SUPABASE')) {
      throw new Error('Supabase är inte konfigurerat i config.js');
    }
    supabasePromise = import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/+esm')
      .then((module) => {
        if (!supabase) {
          supabase = module.createClient(config.supabaseUrl,config.supabaseAnonKey,{
            auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false,storageKey:'handelser-auth'}
          });
        }
        return supabase;
      })
      .catch((error) => {
        supabasePromise = null;
        throw error;
      });
    return supabasePromise;
  }
  async function rpc(name,args) {
    const result = await mediaRequest({action:'rpc',name,args:args && typeof args==='object' ? args : {}});
    return result.data;
  }

  async function mediaRequest(payload) {
    const endpoint = String(config.mediaFunctionUrl || '/.netlify/functions/hd-media');
    const response = await fetch(endpoint,{
      method:'POST',
      headers:{'content-type':'application/json'},
      cache:'no-store',
      body:JSON.stringify(payload || {})
    });
    let result={};
    try { result=await response.json(); } catch (_) {}
    if (!response.ok) throw new Error(result.error || 'Bildtjänsten kunde inte nås');
    return result;
  }
  async function uploadImage(pin,contributorToken,blob) {
    if (!(blob instanceof Blob) || !blob.size) throw new Error('Bilden saknas');
    const prepared=await mediaRequest({action:'create-upload',pin,contributorToken,contentType:blob.type || 'image/jpeg',size:blob.size});
    const client=await initSupabase();
    const {error}=await client.storage.from(IMAGE_BUCKET).uploadToSignedUrl(prepared.path,prepared.token,blob,{contentType:blob.type || 'image/jpeg',cacheControl:'3600'});
    if (error) {
      await mediaRequest({action:'cleanup-upload',pin,contributorToken,path:prepared.path}).catch(()=>{});
      throw new Error(error.message || 'Bilden kunde inte laddas upp');
    }
    return prepared.path;
  }
  async function cleanupImage(pin,contributorToken,path) {
    if (!path) return;
    await mediaRequest({action:'cleanup-upload',pin,contributorToken,path});
  }
  async function uploadAdminImage(pin,blob) {
    if (!(blob instanceof Blob) || !blob.size) throw new Error('Bilden saknas');
    const prepared=await mediaRequest({action:'create-admin-upload',pin,contentType:blob.type || 'image/jpeg',size:blob.size});
    const client=await initSupabase();
    const {error}=await client.storage.from(IMAGE_BUCKET).uploadToSignedUrl(prepared.path,prepared.token,blob,{contentType:blob.type || 'image/jpeg',cacheControl:'3600'});
    if(error){await mediaRequest({action:'cleanup-admin-upload',pin,path:prepared.path}).catch(()=>{});throw new Error(error.message || 'Bilden kunde inte laddas upp');}
    return prepared.path;
  }
  async function cleanupAdminImage(pin,path) {
    if(!path)return;
    await mediaRequest({action:'cleanup-admin-upload',pin,path});
  }

  window.HandelserData = {
    mode:config.mode || 'supabase',
    decodeQuizQuestions(item,includeAnswers=true) { return clone(decodeQuizQuestions(item,includeAnswers)); },
    encodeQuizQuestions(questions) { return clone(encodeQuizQuestions(questions)); },

    async getTimeline(pin) {
      if (config.mode==='local') {
        checkLocalPin('viewer',pin);
        setAuthoritativeClock(Date.now());
        const store = loadStore();
        return store.memories.slice().sort((a,b) => new Date(a.unlock_at)-new Date(b.unlock_at)).map((item) => lockedProjection(item,store));
      }
      const started = performance.now();
      const rows = await rpc('hd_timeline',{p_viewer_pin:pin});
      let serverNow = Array.isArray(rows) && rows.length ? rows[0].server_now : '';
      if (!serverNow) serverNow = await rpc('hd_server_clock',{p_viewer_pin:pin});
      setAuthoritativeClock(serverNow,(performance.now()-started)/2);
      return (Array.isArray(rows)?rows:[]).map((row) => {
        const {server_now,...memory} = row;
        return memory;
      });
    },
    async getViewerPresentation(pin) {
      if (config.mode==='local') {
        checkLocalPin('viewer',pin);
        const settings=loadStore().settings;
        return {recipient_name:settings.recipient_name || '',welcome_message:settings.welcome_message || ''};
      }
      const result=await rpc('hd_viewer_presentation',{p_viewer_pin:pin});
      return Array.isArray(result)?result[0]:result;
    },
    nowMs() { return authoritativeNowMs(); },
    async verifyFriend(pin) {
      if (config.mode==='local') { checkLocalPin('friend',pin); return true; }
      const ok = await rpc('hd_verify_friend',{p_friend_pin:pin});
      if (!ok) throw new Error('Fel kod');
      return true;
    },
    async getFriendTimeline(pin) {
      if (config.mode==='local') {
        checkLocalPin('friend',pin);
        return loadStore().memories
          .slice()
          .sort((a,b) => new Date(a.unlock_at)-new Date(b.unlock_at))
          .map((item) => ({unlock_at:item.unlock_at}));
      }
      const rows = await rpc('hd_friend_timeline',{p_friend_pin:pin});
      return Array.isArray(rows) ? rows.map((row) => ({unlock_at:row.unlock_at})) : [];
    },
    async verifyAdmin(pin) {
      if (config.mode==='local') { checkLocalPin('admin',pin); return true; }
      const ok = await rpc('hd_verify_admin',{p_admin_pin:pin});
      if (!ok) throw new Error('Fel kod');
      return true;
    },
    async checkDailyAvailability(pin,type,unlockAt,ignoreId) {
      if (!isDailyLimited(type)) return true;
      if (config.mode==='local') {
        checkLocalPin('friend',pin);
        return dayAvailableInStore(loadStore(),type,unlockAt,ignoreId || '');
      }
      return rpc('hd_day_available',{p_friend_pin:pin,p_content_type:type,p_unlock_at:unlockAt,p_ignore_id:ignoreId || null});
    },
    async getDayCapacity(pin,unlockAt,ignoreId) {
      if (config.mode==='local') {
        checkLocalPin('friend',pin);
        const store=loadStore();
        const count=dayCountInStore(store,unlockAt,ignoreId || '');
        const limit=dailyLimitInStore(store);
        return {count,limit,available:count<limit,remaining:Math.max(0,limit-count)};
      }
      const result=await rpc('hd_day_capacity',{p_friend_pin:pin,p_unlock_at:unlockAt,p_ignore_id:ignoreId || null});
      return Array.isArray(result)?result[0]:result;
    },
    async getRandomFact(pin,category) {
      if (config.mode==='local') {
        checkLocalPin('friend',pin);
        const store = loadStore();
        const used = new Set(store.memories.filter((item) => item.content_type==='fact').map((item) => item.extra_data && item.extra_data.fact_id).filter(Boolean));
        const filtered = facts.filter((item) => (!category || category==='Alla' || item.category===category) && !used.has(item.id));
        const fallback = facts.filter((item) => !category || category==='Alla' || item.category===category);
        const pool = filtered.length ? filtered : fallback;
        if (!pool.length) throw new Error('Det finns ingen fakta i den kategorin ännu');
        return clone(pool[Math.floor(Math.random()*pool.length)]);
      }
      const result = await rpc('hd_random_fact',{p_friend_pin:pin,p_category:category && category!=='Alla' ? category : ''});
      return Array.isArray(result) ? result[0] : result;
    },
    async addMemory(pin,contributorToken,payload) {
      if (config.mode==='local') {
        checkLocalPin('friend',pin);
        const store = loadStore();
        assertMemoryAllowed(store,payload,'');
        const memory = normalizeMemory({
          id:uid(),contributor_token:contributorToken,friend_name:payload.friend_name,unlock_at:payload.unlock_at,content_type:payload.content_type,
          title:payload.title || '',body:payload.body || '',image_data:payload.image_data || '',image_path:'',youtube_id:payload.youtube_id || '',
          quiz_question:payload.quiz_question || '',quiz_options:payload.quiz_options || [],quiz_answer:payload.quiz_answer || '',quiz_explanation:payload.quiz_explanation || '',
          extra_data:payload.extra_data || {},created_at:nowIso(),updated_at:nowIso()
        });
        store.memories.push(memory);
        saveStore(store);
        return memory.id;
      }
      let uploadedPath='';
      let imagePath=payload.image_path || '';
      try {
        if (payload.content_type==='image' && payload.image_blob) {
          uploadedPath=await uploadImage(pin,contributorToken,payload.image_blob);
          imagePath=uploadedPath;
        }
        return await rpc('hd_add_memory',{
          p_friend_pin:pin,p_contributor_token:contributorToken,p_friend_name:payload.friend_name,p_unlock_at:payload.unlock_at,p_content_type:payload.content_type,
          p_title:payload.title || '',p_body:payload.body || '',p_image_path:imagePath,p_youtube_id:payload.youtube_id || '',
          p_quiz_question:payload.quiz_question || '',p_quiz_options:payload.quiz_options || [],p_quiz_answer:payload.quiz_answer || '',p_quiz_explanation:payload.quiz_explanation || '',
          p_extra_data:payload.extra_data || {}
        });
      } catch (error) {
        if (uploadedPath) await cleanupImage(pin,contributorToken,uploadedPath).catch(()=>{});
        throw error;
      }
    },
    async getMyMemories(pin,contributorToken) {
      if (config.mode==='local') {
        checkLocalPin('friend',pin);
        const store = loadStore();
        return store.memories.filter((item) => item.contributor_token===contributorToken).sort((a,b) => new Date(a.unlock_at)-new Date(b.unlock_at)).map((item) => clone(normalizeMemory(item)));
      }
      return rpc('hd_my_memories',{p_friend_pin:pin,p_contributor_token:contributorToken});
    },
    async updateMemory(pin,contributorToken,id,payload) {
      if (config.mode==='local') {
        checkLocalPin('friend',pin);
        const store = loadStore();
        const index = store.memories.findIndex((item) => item.id===id && item.contributor_token===contributorToken);
        if (index<0) throw new Error('Händelsen kunde inte hittas');
        assertMemoryAllowed(store,payload,id);
        const {image_blob,...safePayload}=payload;
        store.memories[index] = normalizeMemory({...store.memories[index],...safePayload,id,contributor_token:contributorToken,updated_at:nowIso()});
        saveStore(store);
        return true;
      }
      const oldPath=payload.previous_image_path || '';
      let uploadedPath='';
      let imagePath=payload.content_type==='image' ? (payload.image_path || oldPath) : '';
      try {
        if (payload.content_type==='image' && payload.image_blob) {
          uploadedPath=await uploadImage(pin,contributorToken,payload.image_blob);
          imagePath=uploadedPath;
        }
        const result=await rpc('hd_update_memory',{
          p_friend_pin:pin,p_contributor_token:contributorToken,p_id:id,p_friend_name:payload.friend_name,p_unlock_at:payload.unlock_at,p_content_type:payload.content_type,
          p_title:payload.title || '',p_body:payload.body || '',p_image_path:imagePath,p_youtube_id:payload.youtube_id || '',
          p_quiz_question:payload.quiz_question || '',p_quiz_options:payload.quiz_options || [],p_quiz_answer:payload.quiz_answer || '',p_quiz_explanation:payload.quiz_explanation || '',
          p_extra_data:payload.extra_data || {}
        });
        if (oldPath && oldPath!==imagePath) await cleanupImage(pin,contributorToken,oldPath).catch(()=>{});
        return result;
      } catch (error) {
        if (uploadedPath) await cleanupImage(pin,contributorToken,uploadedPath).catch(()=>{});
        throw error;
      }
    },
    async deleteMemory(pin,contributorToken,id) {
      if (config.mode==='local') {
        checkLocalPin('friend',pin);
        const store = loadStore();
        const before = store.memories.length;
        store.memories = store.memories.filter((item) => !(item.id===id && item.contributor_token===contributorToken));
        store.help_requests = store.help_requests.filter((item)=>item.memory_id!==id);
        if (store.memories.length===before) throw new Error('Händelsen kunde inte hittas');
        saveStore(store);
        return true;
      }
      const result=await mediaRequest({action:'delete-memory',role:'friend',pin,contributorToken,memoryId:id});
      return Boolean(result.ok);
    },
    async requestAdminHelp(pin,contributorToken,memoryId,requestType,message) {
      if (config.mode==='local') {
        checkLocalPin('friend',pin);
        const store=loadStore();
        const memory=store.memories.find((item)=>item.id===memoryId && item.contributor_token===contributorToken);
        if (!memory) throw new Error('Händelsen kunde inte hittas');
        const existing=store.help_requests.find((item)=>item.memory_id===memoryId && item.contributor_token===contributorToken && item.status==='open');
        if (existing) {
          existing.request_type=requestType;
          existing.message=String(message || '').trim().slice(0,1000);
          existing.updated_at=nowIso();
        } else {
          store.help_requests.push({id:uid(),memory_id:memoryId,contributor_token:contributorToken,request_type:requestType,message:String(message || '').trim().slice(0,1000),status:'open',created_at:nowIso(),updated_at:nowIso()});
        }
        saveStore(store);
        return true;
      }
      return rpc('hd_request_admin_help',{p_friend_pin:pin,p_contributor_token:contributorToken,p_memory_id:memoryId,p_request_type:requestType,p_message:String(message || '').trim()});
    },
    async checkQuiz(pin,id,questionIndex,answer) {
      if (config.mode==='local') {
        checkLocalPin('viewer',pin);
        const memory = loadStore().memories.find((item) => item.id===id);
        if (!memory || Date.now()<new Date(memory.unlock_at).getTime()) throw new Error('Miniquizet är fortfarande låst');
        const questions=decodeQuizQuestions(memory,true);
        const question=questions[Number(questionIndex) || 0];
        if (!question) throw new Error('Frågan kunde inte hittas');
        return {
          correct:String(question.answer).trim().toLocaleLowerCase('sv-SE')===String(answer).trim().toLocaleLowerCase('sv-SE'),
          explanation:question.explanation || '',
          correct_answer:question.answer || ''
        };
      }
      const result = await rpc('hd_check_quiz',{p_viewer_pin:pin,p_id:id,p_question_index:Number(questionIndex)||0,p_answer:answer});
      return Array.isArray(result)?result[0]:result;
    },
    async checkSudoku(pin,id,values) {
      const serialized=Array.isArray(values)?values.join(''):String(values || '');
      if (config.mode==='local') {
        checkLocalPin('viewer',pin);
        const memory=loadStore().memories.find((item)=>item.id===id);
        if (!memory || Date.now()<new Date(memory.unlock_at).getTime()) throw new Error('Sudokut är fortfarande låst');
        const solution=String(memory.extra_data?.sudoku_solution || '');
        const wrong=[];
        for(let index=0;index<16;index+=1){if(serialized[index]!==solution[index])wrong.push(index);}
        return {correct:wrong.length===0,wrong_indices:wrong};
      }
      const result=await rpc('hd_check_sudoku',{p_viewer_pin:pin,p_id:id,p_values:serialized});
      return Array.isArray(result)?result[0]:result;
    },
    async getSudokuHint(pin,id,values) {
      const serialized=Array.isArray(values)?values.join(''):String(values || '');
      if (config.mode==='local') {
        checkLocalPin('viewer',pin);
        const memory=loadStore().memories.find((item)=>item.id===id);
        if (!memory || Date.now()<new Date(memory.unlock_at).getTime()) throw new Error('Sudokut är fortfarande låst');
        const solution=String(memory.extra_data?.sudoku_solution || '');
        for(let index=0;index<16;index+=1){if(serialized[index]!==solution[index])return {cell_index:index,cell_value:solution[index] || ''};}
        return {cell_index:-1,cell_value:''};
      }
      const result=await rpc('hd_sudoku_hint',{p_viewer_pin:pin,p_id:id,p_values:serialized});
      return Array.isArray(result)?result[0]:result;
    },
    async getAdminMemories(pin) {
      if (config.mode==='local') {
        checkLocalPin('admin',pin);
        const store = loadStore();
        return store.memories.slice().sort((a,b) => new Date(a.unlock_at)-new Date(b.unlock_at)).map((item) => clone(normalizeMemory(item)));
      }
      return rpc('hd_admin_memories',{p_admin_pin:pin});
    },
    async adminUpdate(pin,id,payload) {
      if (config.mode==='local') {
        checkLocalPin('admin',pin);
        const store = loadStore();
        const index = store.memories.findIndex((item) => item.id===id);
        if (index<0) throw new Error('Händelsen kunde inte hittas');
        assertMemoryAllowed(store,payload,id);
        const {image_blob,...safePayload}=payload;
        store.memories[index] = normalizeMemory({...store.memories[index],...safePayload,id,updated_at:nowIso()});
        saveStore(store);
        return true;
      }
      const oldPath=payload.previous_image_path || payload.image_path || '';
      let uploadedPath='';
      let imagePath=payload.content_type==='image' ? (payload.image_path || oldPath) : '';
      try{
        if(payload.content_type==='image'&&payload.image_blob){uploadedPath=await uploadAdminImage(pin,payload.image_blob);imagePath=uploadedPath;}
        const result=await rpc('hd_admin_update_memory',{
          p_admin_pin:pin,p_id:id,p_friend_name:payload.friend_name,p_unlock_at:payload.unlock_at,p_content_type:payload.content_type,
          p_title:payload.title || '',p_body:payload.body || '',p_image_path:imagePath,p_youtube_id:payload.youtube_id || '',
          p_quiz_question:payload.quiz_question || '',p_quiz_options:payload.quiz_options || [],p_quiz_answer:payload.quiz_answer || '',p_quiz_explanation:payload.quiz_explanation || '',
          p_extra_data:payload.extra_data || {}
        });
        if(oldPath&&oldPath!==imagePath)await cleanupAdminImage(pin,oldPath).catch(()=>{});
        return result;
      }catch(error){if(uploadedPath)await cleanupAdminImage(pin,uploadedPath).catch(()=>{});throw error;}
    },
    async adminDelete(pin,id) {
      if (config.mode==='local') {
        checkLocalPin('admin',pin);
        const store = loadStore();
        store.memories = store.memories.filter((item) => item.id!==id);
        store.help_requests = store.help_requests.filter((item)=>item.memory_id!==id);
        saveStore(store);
        return true;
      }
      const result=await mediaRequest({action:'delete-memory',role:'admin',pin,memoryId:id});
      return Boolean(result.ok);
    },
    async getAdminSettings(pin) {
      if (config.mode==='local') {
        checkLocalPin('admin',pin);
        const store=loadStore();
        return {daily_limit:dailyLimitInStore(store)};
      }
      const result=await rpc('hd_admin_settings',{p_admin_pin:pin});
      return Array.isArray(result)?result[0]:result;
    },
    async updateAdminSettings(pin,settings) {
      const dailyLimit=Math.max(1,Math.min(24,Number(settings?.daily_limit || config.defaultDailyLimit || 6)));
      if (config.mode==='local') {
        checkLocalPin('admin',pin);
        const store=loadStore(); store.settings.daily_limit=dailyLimit; saveStore(store); return true;
      }
      return rpc('hd_admin_update_settings',{p_admin_pin:pin,p_daily_limit:dailyLimit});
    },
    async getAdminPresentation(pin) {
      if (config.mode==='local') {
        checkLocalPin('admin',pin);
        const settings=loadStore().settings;
        return {recipient_name:settings.recipient_name || '',welcome_message:settings.welcome_message || ''};
      }
      const result=await rpc('hd_admin_presentation',{p_admin_pin:pin});
      return Array.isArray(result)?result[0]:result;
    },
    async updateAdminPresentation(pin,value) {
      const recipientName=String(value?.recipient_name || '').trim().slice(0,60);
      const welcomeMessage=String(value?.welcome_message || '').trim().slice(0,280);
      if (config.mode==='local') {
        checkLocalPin('admin',pin);
        const store=loadStore(); store.settings.recipient_name=recipientName; store.settings.welcome_message=welcomeMessage; saveStore(store); return true;
      }
      return rpc('hd_admin_update_presentation',{p_admin_pin:pin,p_recipient_name:recipientName,p_welcome_message:welcomeMessage});
    },
    async getAdminHelpRequests(pin) {
      if (config.mode==='local') {
        checkLocalPin('admin',pin);
        const store=loadStore();
        return store.help_requests.filter((item)=>item.status==='open').map((request)=>({
          ...clone(request),memory:clone(store.memories.find((item)=>item.id===request.memory_id) || null)
        })).sort((a,b)=>new Date(b.created_at)-new Date(a.created_at));
      }
      return rpc('hd_admin_help_requests',{p_admin_pin:pin});
    },
    async resolveAdminHelpRequest(pin,id) {
      if (config.mode==='local') {
        checkLocalPin('admin',pin);
        const store=loadStore(); const request=store.help_requests.find((item)=>item.id===id);
        if (!request) throw new Error('Förfrågan kunde inte hittas'); request.status='resolved'; request.updated_at=nowIso(); saveStore(store); return true;
      }
      return rpc('hd_admin_resolve_help',{p_admin_pin:pin,p_id:id});
    },
    async adminDeleteAll(pin,confirmation) {
      if (String(confirmation || '').trim().toLocaleUpperCase('sv-SE')!=='AVSLUTA HÄNDELSER') throw new Error('Skriv AVSLUTA HÄNDELSER för att bekräfta');
      if (config.mode==='local') {
        checkLocalPin('admin',pin);
        const store=loadStore(); store.memories=[]; store.help_requests=[]; saveStore(store); return true;
      }
      const result=await mediaRequest({action:'purge-all',pin,confirmation});
      return Boolean(result.ok);
    },
    async resetLocalDemo() {
      if (config.mode!=='local') throw new Error('Endast tillgängligt i testläge');
      localStorage.setItem(STORAGE_KEY,JSON.stringify(defaultStore()));
      notifyChange();
    },
    async getViewerImageUrl(pin,memoryId) {
      if (config.mode==='local') {
        checkLocalPin('viewer',pin);
        return loadStore().memories.find((item)=>item.id===memoryId)?.image_data || '';
      }
      const result=await mediaRequest({action:'signed-image',role:'viewer',pin,memoryId});
      return result.url || '';
    },
    async getFriendImageUrl(pin,contributorToken,memoryId) {
      if (config.mode==='local') {
        checkLocalPin('friend',pin);
        return loadStore().memories.find((item)=>item.id===memoryId && item.contributor_token===contributorToken)?.image_data || '';
      }
      const result=await mediaRequest({action:'signed-image',role:'friend',pin,contributorToken,memoryId});
      return result.url || '';
    },
    async getAdminImageUrl(pin,memoryId) {
      if (config.mode==='local') {
        checkLocalPin('admin',pin);
        return loadStore().memories.find((item)=>item.id===memoryId)?.image_data || '';
      }
      const result=await mediaRequest({action:'signed-image',role:'admin',pin,memoryId});
      return result.url || '';
    },
    subscribe(callback) {
      if (config.mode==='local') {
        let bc;
        try {
          bc = new BroadcastChannel(CHANNEL_NAME);
          bc.addEventListener('message',callback);
        } catch (_) {}
        const storageHandler = (event) => { if (event.key===STORAGE_KEY) callback(); };
        window.addEventListener('storage',storageHandler);
        return () => {
          if (bc) bc.close();
          window.removeEventListener('storage',storageHandler);
        };
      }
      initSupabase().then((client) => {
        channel = client.channel('handelser-activity').on('postgres_changes',{event:'UPDATE',schema:'public',table:'hd_activity'},callback).subscribe();
      }).catch(console.error);
      pollTimer = setInterval(callback,config.pollIntervalMs || 15000);
      return () => {
        if (pollTimer) clearInterval(pollTimer);
        if (channel && supabase) supabase.removeChannel(channel);
      };
    }
  };
})();
