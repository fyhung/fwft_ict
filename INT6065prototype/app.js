import { CONFIG } from './config.js';
import { STORIES, DEMO } from './content.js';
import { bi, plain, escapeHTML as esc, toggleLanguage, isEnglishFirst } from './i18n.js';
import { Drawing } from './drawing.js';
import { AudioStudio } from './audio.js';
import { isAudioUpload } from './media.js';
import { interpret, createStory, redraw, assess, checkConnection, hasLetters } from './gemini.js';

const $=s=>document.querySelector(s);
const audio=new AudioStudio();
const jobs=new Map();
let drawing=null, revision=0,recordId=0;
const initial=()=>({step:0,prompt:null,drawing:null,caption:'',interpretation:null,meaning:'',confirmed:'',sentences:[],illustration:null,demo:false,index:0,pinyin:true,english:true,retell:false,clip:null,clipURL:null,clipDuration:0,silent:false,recording:false,recordStarting:false,feedback:{},attempts:{},counts:{interpret:0,image:0},comments:'',tester:'',source:'',status:{}});
let state=initial();
const icon='<img src="./assets/pet.svg" alt="" width="65" height="65">';
const btn=(action,zh,en,style='',extra='')=>`<button type="button" class="button ${style}" data-action="${action}" ${extra}>${bi(zh,en)}</button>`;
const textBtn=(action,zh,en,extra='')=>`<button type="button" class="text-button" data-action="${action}" ${extra}>${plain(zh,en)}</button>`;
const pet=(zh,en)=>`<div class="pet-note">${icon}<p>${bi(zh,en)}</p></div>`;
const heading=(number,zh,en,tipZh,tipEn)=>`<div class="page-heading"><div><span class="eyebrow">CHAPTER ${number} · YOUR LITTLE STORY</span><h1>${bi(zh,en)}</h1></div>${pet(tipZh,tipEn)}</div>`;
const errorMessages={
  access:['這個金鑰未獲授權。請檢查 config.js 和模型存取權。','This key is not authorised. Check config.js and model access.'],
  request:['這次請求未被接受。請檢查金鑰、模型及媒體格式。','The request was not accepted. Check the key, model and media format.'],
  quota:['已達 API 使用限制。作品已保留，請稍後重試。','API limit reached. Your work is safe here; try again later.'],
  'quota-disabled':['這個模型的 API 配額為 0。請在 Google AI Studio 檢查專案的方案和帳單；單純重試無法開啟配額。','This model has zero API quota. Check the project plan and billing in Google AI Studio; retrying alone cannot enable quota.'],
  'audio-format':['未能轉換這段錄音。請重錄，或上傳 WAV / MP3。原錄音仍可回聽。','Could not convert this recording. Rerecord or upload WAV / MP3. Your original recording remains available.'],
  'audio-length':['這段錄音超過 15 秒，請錄短一點。','This recording is longer than 15 seconds. Please use a shorter clip.'],
  model:['找不到這個模型。請在設定中選擇可用模型。','This model is unavailable. Choose an available model in Settings.'],
  service:['AI 服務暫時無法使用。請重試。','The AI service is temporarily unavailable. Please retry.'],
  network:['無法連接 Gemini。請檢查網絡或瀏覽器連線限制。','Cannot reach Gemini. Check your connection or browser network restrictions.'],
  timeout:['這次生成逾時了。作品已保留，請重試。','Generation timed out. Your work is preserved; please retry.'],
  blocked:['AI 未能提供這次結果。請修改內容後重試。','AI could not return a result. Adjust the content and retry.'],
  format:['AI 回應格式不完整。請重試生成。','The AI response was incomplete. Please generate again.'],
  alignment:['句子與拼音未能對齊。請重新生成。','Sentence and Pinyin segments did not align. Please regenerate.'],
  image:['未能產生插圖。你仍可使用原畫練習。','An illustration could not be created. You can still practise with your drawing.'],
  upload:['請選擇 5 MB 以內的 PNG 或 JPEG 圖片。','Choose a PNG or JPEG image under 5 MB.'],
  voice:['未找到可用的普通話語音。文字和錄音功能仍可使用。','No usable Mandarin voice was found. Text and recording remain available.'],
  unsupported:['這個瀏覽器未能錄音。請使用 HTTPS 或 localhost 上的 Chrome / Edge。','Recording is unavailable. Try Chrome / Edge over HTTPS or localhost.'],
  NotAllowedError:['麥克風權限未開啟。請在瀏覽器網站設定中允許使用麥克風。','Microphone permission was not granted. Allow it in your browser site settings.'],
  NotFoundError:['找不到麥克風。請連接麥克風後重試。','No microphone was found. Connect one and retry.'],
  unknown:['這一步未能完成。作品已保留，請重試。','This step could not be completed. Your work is preserved; please retry.'],
};
function errorPair(e){const pair=errorMessages[e?.code]??errorMessages[e?.name]??errorMessages[e?.message]??errorMessages.unknown;const detail=e?.status?`HTTP ${e.status}${e.model?' · '+e.model:''}`:'';return detail?pair.map(t=>`${t} (${detail})`):pair;}
function notify(zh,en,error=false){const el=$('#notice');el.hidden=false;el.className=`notice${error?' error':''}`;el.innerHTML=bi(zh,en);}
function clearNotice(){$('#notice').hidden=true;}
function saveInputs(){
  if(drawing){state.drawing=drawing.hasContent?drawing.data():null;}
  if($('#caption'))state.caption=$('#caption').value;
  if($('#meaning'))state.meaning=$('#meaning').value;
  if($('#comments'))state.comments=$('#comments').value;
  if($('#tester'))state.tester=$('#tester').value;
}
function cancelJobs(keep=[]){for(const [name,c] of jobs){if(keep.includes(name))continue;c.abort();jobs.delete(name);if(state.status[name]?.busy)delete state.status[name];}}
function clearClip(){audio.cancelRecording();state.recording=false;state.recordStarting=false;recordId++;if(state.clipURL)URL.revokeObjectURL(state.clipURL);state.clipURL=null;state.clip=null;state.clipDuration=0;state.silent=false;}
function invalidateStory(){revision++;cancelJobs();audio.clear();clearClip();state.sentences=[];state.illustration=null;state.confirmed='';state.feedback={};state.attempts={};state.source='';state.status={};state.index=0;state.retell=false;}
async function confirmAction(zh,en){
  const d=$('#confirm-dialog');$('#confirm-title').textContent=plain('確認操作','Confirm action');$('#confirm-message').textContent=plain(zh,en);d.showModal();
  return new Promise(resolve=>{
    const finish=value=>{d.close();$('#confirm-yes').onclick=null;$('#confirm-no').onclick=null;d.removeEventListener('cancel',cancel);resolve(value);};
    const cancel=e=>{e.preventDefault();finish(false);};
    $('#confirm-yes').onclick=()=>finish(true);$('#confirm-no').onclick=()=>finish(false);d.addEventListener('cancel',cancel);
  });
}
function busyBox(name){const s=state.status[name];if(!s)return'';return `<div class="status-box ${s.busy?'busy':s.error?'error':''}" data-job="${name}" role="status">${bi(s.zh,s.en)}${s.busy?`<span class="elapsed" data-start="${s.start}"></span>`:''}${name==='image'&&s.code==='quota-disabled'?`<p><a href="https://ai.dev/rate-limit" target="_blank" rel="noopener noreferrer">${plain('檢查 Gemini 配額與方案 ↗','Check Gemini quota and plan ↗')}</a></p>`:''}</div>`;}
async function run(name,request,success,labels){
  if(jobs.has(name))return;
  saveInputs();clearNotice();const controller=new AbortController(),rev=revision;jobs.set(name,controller);state.status[name]={busy:true,start:Date.now(),zh:labels[0],en:labels[1]};render();
  try{const result=await request(controller.signal);if(controller.signal.aborted||revision!==rev||jobs.get(name)!==controller)return;delete state.status[name];success(result);}
  catch(error){if(controller.signal.aborted||revision!==rev)return;const [zh,en]=errorPair(error);state.status[name]={error:true,code:error.code,zh,en};}
  finally{if(jobs.get(name)===controller){jobs.delete(name);render();}}
}
function navigate(step){
  saveInputs();audio.stopPlayback();clearClip();cancelJobs(['image']);state.step=step;state.source='';clearNotice();render();window.scrollTo({top:0,behavior:'instant'});$('#main').focus({preventScroll:true});
}
function canVisit(step){return step===0||step===1&&state.prompt||step===2&&state.interpretation||step===3&&state.sentences.length||step===4&&state.sentences.length;}
function renderSteps(){
  const labels=[['故事','Story'],['畫畫','Draw'],['句子','Sentences'],['練說','Speak'],['回顧','Review']];
  $('#steps').innerHTML=labels.map(([zh,en],i)=>`<button class="step ${i===state.step?'active':i<state.step?'completed':''}" type="button" data-step="${i}" ${!canVisit(i)?'disabled':''} ${state.step===i?'aria-current="step"':''}><span class="step-number">${i<state.step?'✓':i+1}</span>${bi(zh,en)}</button>`).join('');
}
function welcome(){return `
  <section class="hero"><div><span class="eyebrow">A LITTLE DRAWING. A NEW WAY TO SPEAK.</span><h1>${bi('畫一個故事，\n說出你的想像。','Draw a story.\nFind your Chinese voice.')}</h1><p class="hero-description">${bi('從一張小小的圖畫開始，讓 AI 陪你把想像變成中文，一句一句，練習說出自己的故事。','Start with your own drawing. Turn your ideas into simple Chinese, then listen, speak and try again.')}</p></div><div class="hero-art"><span class="art-star" aria-hidden="true">✧</span><img class="scene" src="./assets/demo-scene.svg" alt="${plain('孩子把魚給小貓的故事插圖','Story illustration of a child giving a fish to a cat')}"><span class="art-caption">${bi('你的故事，由你創作。','A story only you can tell.')}</span></div></section>
  <section aria-labelledby="choose-title"><div class="section-heading"><h2 id="choose-title">${bi('今天，故事從哪裡開始？','Where will your story begin?')}</h2><p>${plain('選一個開頭，沒有標準答案。','Choose a beginning. There is no single right answer.')}</p></div><div class="story-grid">${STORIES.map((s,i)=>`<button class="story-card" data-story="${s.id}"><span class="story-top"><span class="story-symbol" aria-hidden="true">${s.icon}</span><span class="story-number">STORY 0${i+1}</span></span><h3>${bi(s.zh,s.en)}</h3><p>${bi(s.openingZh,s.openingEn)}</p><span class="card-link">${plain('開始這個故事','Make it your story')} <span aria-hidden="true">↗</span></span></button>`).join('')}</div></section>
  <div class="bottom-note"><p>${bi('小組原型：AI 功能會把圖畫和錄音傳送至 Google Gemini。發音建議屬實驗性質，可能有誤；重新整理頁面會清除本次作品。','Group prototype: AI features send drawings and recordings to Google Gemini. Speaking suggestions are experimental and may be wrong. Refreshing clears this activity.')}</p>${textBtn('demo','先看看示範','Explore a demo')}</div>`;}
function promptBox(){return `<div class="prompt-box"><p>${bi(state.prompt.openingZh,state.prompt.openingEn)}</p></div>`;}
function drawView(){return `${heading('01','畫出下一幕','Draw what happens next','不用畫得完美，故事才是主角。','It does not need to be perfect. Your idea is what matters.')}
  <div class="workspace"><section class="panel drawing-panel"><div class="toolbar" role="toolbar" aria-label="${plain('畫圖工具','Drawing tools')}">
  <button class="tool-button selected" data-tool="brush" aria-pressed="true">✎ ${plain('畫筆','Brush')}</button><button class="tool-button" data-tool="eraser" aria-pressed="false">▱ ${plain('橡皮擦','Eraser')}</button><span class="toolbar-divider"></span>${['#304c42','#c47759','#e1b950','#7796a6','#937fa2'].map((c,i)=>`<button class="color ${i===0?'selected':''}" style="background:${c}" data-color="${c}" aria-label="${plain(['深綠','橙紅','黃色','藍色','紫色'][i],['Dark green','Terracotta','Yellow','Blue','Purple'][i])}" aria-pressed="${i===0}"></button>`).join('')}<label class="visually-hidden" for="brush-size">${plain('畫筆粗幼','Brush size')}</label><input id="brush-size" type="range" min="3" max="35" value="7"><button class="tool-button" data-action="undo">↶ ${plain('復原','Undo')}</button><button class="tool-button" data-action="clear-drawing">${plain('清除','Clear')}</button></div>
  <div class="canvas-wrap"><canvas id="draw-canvas" aria-label="${plain('畫出故事的下一幕，可使用滑鼠、觸控筆或上傳圖片','Draw the next scene using mouse or pen, or upload a picture')}"></canvas><div id="canvas-hint" class="canvas-hint" ${state.drawing?'hidden':''}><span>✎</span>${bi('在這裡畫出你的想法','Your imagination starts here')}</div></div>
  <div class="canvas-meta"><span>${plain('滑鼠 · 觸控 · 觸控筆','Mouse · Touch · Pen')}</span><label class="upload-label" for="upload">↥ ${plain('上傳圖畫','Upload a drawing')}</label><input class="file-input" id="upload" type="file" accept="image/png,image/jpeg"></div></section>
  <aside class="panel"><span class="eyebrow">YOUR STORY STARTER</span><h3>${bi(state.prompt.zh,state.prompt.en)}</h3>${promptBox()}<label class="field-label" for="caption">${bi('加一句說明（選填）','Add a short explanation (optional)')}</label><textarea id="caption" maxlength="500" placeholder="${plain('你畫了甚麼？中文或英文都可以。','What did you draw? Chinese or English is fine.')}" >${esc(state.caption)}</textarea><p class="help">${bi('讓 AI 更了解你的意思。你的想法不會被評分。','Help AI understand your idea. Your imagination is not graded.')}</p>${btn('interpret','理解我的圖畫','Understand my drawing','side-action',jobs.has('interpret')?'disabled':'')}${busyBox('interpret')}<p class="help">${plain('每個故事最多 3 次理解請求','Up to 3 interpretation requests per story')} · ${state.counts.interpret}/3</p></aside></div><div class="back-row">${textBtn('home','← 選擇其他故事','← Choose another story')}${pet('你來想像，我們一起練說。','You imagine. We practise together.')}</div>`;}
function pictures(){return `<div class="picture-grid"><div class="picture-box"><figure><img src="${esc(state.drawing)}" alt="${plain('我的原畫','My original drawing')}"><figcaption>${bi('我的原畫','My original drawing')}</figcaption></figure></div><div class="picture-box">${state.illustration?`<figure><img src="${esc(state.illustration)}" alt="${plain('根據確認意思生成的 AI 插圖','AI illustration based on the confirmed meaning')}"><figcaption>${bi(state.demo?'示範插圖':'AI 插圖',state.demo?'Demo illustration':'AI illustration')}</figcaption></figure>`:`<div class="picture-placeholder"><div><span class="empty-icon">✧</span>${bi(jobs.has('image')?'正在為故事添上色彩……':state.confirmed?'插圖暫時不可用，可先用原畫練習':'插圖會在確認意思後生成',jobs.has('image')?'Bringing your story to life…':state.confirmed?'Illustration unavailable. Practise with your original drawing.':'Your illustration comes after confirming the meaning')}</div></div>`}</div></div>`;}
function storyView(){return `${heading('02','把想像變成中文','Bring your idea into words','先確認意思，再讓故事發聲。','Check the meaning first. This is still your story.')}
  <div class="workspace"><section class="panel">${pictures()}${busyBox('image')}${state.confirmed?`<div class="button-row breathing-room">${btn('redraw','重新生成插圖','Redraw illustration','secondary small',jobs.has('image')||state.demo||state.counts.image>=3?'disabled':'')}<span class="help">${state.counts.image}/3</span></div>`:''}<div class="interpretation-box"><h3>${bi('這是你的意思嗎？','Is this what you meant?')}</h3><p class="help">${bi(state.interpretation.zh,state.interpretation.en)}</p>${state.interpretation.questionZh||state.interpretation.questionEn?`<div class="prompt-box">${bi(state.interpretation.questionZh,state.interpretation.questionEn)}</div>`:''}<label for="meaning" class="field-label">${bi('確認或修改故事意思','Confirm or correct the story meaning')}</label><textarea id="meaning" maxlength="700">${esc(state.meaning)}</textarea><p class="help">${bi('可用中文或英文修改。AI 插圖會保留你的原意。','You can edit in Chinese or English. The illustration should preserve your idea.')}</p>${btn('generate',state.confirmed?'更新句子和插圖':'是，生成插圖和句子',state.confirmed?'Update sentences & illustration':'Yes, create illustration & sentences','breathing-room',jobs.has('story')?'disabled':'')}${busyBox('story')}</div></section>
  <aside class="panel"><span class="eyebrow">WORDS FOR YOUR WORLD</span><h3>${bi('你的故事，三句中文','Your story in three sentences')}</h3><p class="help">${bi('先看看中文、拼音和意思，再選一句練說。','Explore the Chinese, Pinyin and meaning. Choose a sentence to practise.')}</p>${state.sentences.length?`<div class="sentence-list">${state.sentences.map((s,i)=>`<button class="sentence-card" data-practice="${i}"><span class="number">0${i+1}</span><span><span class="pinyin">${esc(s.pinyin)}</span><span class="hanzi" lang="zh-Hans">${esc(s.chinese)}</span><span class="meaning" lang="en">${esc(s.english)}</span></span><span class="arrow" aria-hidden="true">↗</span></button>`).join('')}</div><div class="breathing-room">${btn('speak','開始練說','Start speaking','full-width')}</div>`:`<div class="status-box">${bi('確認左邊的故事意思，AI 就會為你寫出簡單句子。','Confirm your story on the left. AI will create simple sentences for you.')}</div>`}</aside></div><div class="back-row">${textBtn('back-draw','← 返回畫畫','← Back to drawing')}${state.sentences.length?textBtn('speak','前往練說 →','Go to speaking →'):''}</div>`;}
const labelStatus=s=>s==='clear'?plain('聽起來清楚','Sounds clear'):s==='practice'?plain('建議練習','Practise'):plain('無法確定','Uncertain');
function feedbackView(){
  const history=state.feedback[state.index]??[];const last=history.at(-1);if(!last)return'';
  const f=last.result;
  return `<section class="feedback-section"><h3>${bi(state.demo?'示範建議（並非分析你的錄音）':'這次的 AI 練習建議',state.demo?'Sample suggestions (not your recording)':'AI suggestions for this attempt')}</h3><p class="feedback-disclaimer">${bi('這不是正式發音評分。AI 可能聽錯；不確定時，先聽示範再重試。','This is not a pronunciation score. AI can mishear; listen and retry when uncertain.')}</p><div class="heard">${bi('AI 聽到的內容','What AI heard')}<p lang="zh-Hans">${esc(f.heard||plain('未能確定','Could not determine'))}</p></div><p class="help">${bi(f.summary.zh,f.summary.en)}</p><div class="token-feedback">${f.words.map(w=>`<button class="token ${w.status}" data-word="${w.index}" aria-label="${esc(`${w.text} · ${labelStatus(w.status)}`)}"><small>${esc(w.pinyin)}</small><strong lang="zh-Hans">${esc(w.text)}</strong><small>${esc(labelStatus(w.status))}</small></button>`).join('')}</div><div class="legend"><span><i></i>${plain('聽起來清楚','Sounds clear')}</span><span><i class="amber"></i>${plain('建議練習','Suggested practice')}</span><span><i class="grey"></i>${plain('無法確定','Uncertain')}</span></div>${f.hints.map(h=>`<div class="hint"><p>${bi(h.zh,h.en)}</p><button class="button secondary small" data-word="${h.index}">▶ ${plain('聽示範','Listen')}</button></div>`).join('')}${history.length>1?`<details class="breathing-room"><summary>${plain('比較兩次練習','Compare your attempts')}</summary><div class="comparison">${[history[0],last].map((a,i)=>`<div><small>${plain(i?'最近一次':'第一次',i?'Latest attempt':'First attempt')}</small>${bi(a.result.summary.zh,a.result.summary.en)}</div>`).join('')}</div><p class="help">${bi('兩次建議供你比較，不代表已驗證的進步。','Compare these suggestions; a changed result does not prove improvement.')}</p></details>`:''}<div class="button-row breathing-room">${btn('retry','再練一次','Practise again','secondary')}${btn('next-sentence',state.index===2?'完成並回顧':'下一句',state.index===2?'Finish & review':'Next sentence')}</div></section>`;
}
function speakView(){const s=state.sentences[state.index];return `${heading('03',state.retell?'看圖，再說一次':'讓你的故事發聲',state.retell?'Tell it in your own words':'Give your story a voice','先聽一句，再試著自己說。','Listen first. Then give it a try on your own.')}
  <div class="practice-layout"><aside><img class="practice-picture" src="${esc(state.illustration??state.drawing)}" alt="${plain('我的故事圖畫','My story picture')}">${promptBox()}<div class="breathing-room">${pet('慢慢來，練習本身就很有意思。','Take your time. Every attempt is part of the story.')}</div></aside>
  <section class="panel practice-panel"><p class="sentence-count">${state.retell?'YOUR OWN WORDS':`SENTENCE 0${state.index+1} / 03`}</p>${state.retell?`<h2>${bi('看看圖畫，你想說甚麼？','Look at your picture. What would you say?')}</h2><p class="help">${bi('自由重述只供錄音和自我回聽，不會與原句比較或評分。','Record and listen to your own retelling. It is not scored against the script.')}</p><div class="prompt-box">${plain('提示詞','Keywords')}: ${state.prompt.words.map(esc).join(' · ')}</div>`:`<div class="toggles"><label><input type="checkbox" id="show-pinyin" ${state.pinyin?'checked':''}>${plain('顯示拼音','Show Pinyin')}</label><label><input type="checkbox" id="show-english" ${state.english?'checked':''}>${plain('顯示英文意思','Show English meaning')}</label></div><div class="ruby-line" lang="zh-Hans">${s.tokens.map(t=>`<ruby>${esc(t.text)}${state.pinyin&&t.pinyin?`<rt>${esc(t.pinyin)}</rt>`:''}</ruby>`).join('')}</div>${state.english?`<p class="practice-meaning" lang="en">${esc(s.english)}</p>`:''}<div class="button-row audio-actions">${btn('listen','▶ 聽示範','▶ Listen to the model','secondary',state.recording||state.recordStarting?'disabled':'')}</div>`}
  <p id="audio-source" class="audio-source" role="status">${esc(state.source)}</p><div class="record-area"><div class="button-row record-tools">${btn(state.recording?'stop-record':'record',state.recording?'■ 停止錄音':'● 開始錄音',state.recording?'■ Stop recording':'● Start recording',`record ${state.recording?'recording':''}`,state.recordStarting?'disabled':'')}${state.recording?'<span class="recording-time" id="record-timer">00:00</span>':`<span class="help">${plain('最長 15 秒','Up to 15 seconds')}</span>`}</div><p class="help">${bi(state.recordStarting?'正在等候麥克風權限……':'請先停止示範語音，再錄下你自己的聲音。',state.recordStarting?'Waiting for microphone permission…':'Record your own voice after the model audio stops.')}</p>${state.clipURL?`<div class="record-tools"><label class="help">${plain('我的錄音','My recording')}</label><audio id="recorded-audio" controls src="${esc(state.clipURL)}"></audio><p class="help">${state.clipDuration.toFixed(1)}s ${state.silent?`· ${plain('錄音可能太安靜，建議重錄。','This may be too quiet. Try rerecording.')}`:''}</p></div>${!state.retell?btn('analyse','取得 AI 建議','Get AI suggestions','breathing-room',jobs.has('feedback')||state.recording?'disabled':''):''}`:''}${state.demo&&!state.retell?`<div class="breathing-room">${btn('sample-feedback','查看示範建議','View sample suggestions','secondary small')}</div>`:''}<p class="help"><label class="upload-label" for="upload-audio">↥ ${plain('或上傳錄音（最長 15 秒）','Or upload a recording (up to 15 seconds)')}</label><input class="file-input" id="upload-audio" type="file" accept="audio/wav,audio/x-wav,audio/mpeg,audio/mp4,audio/webm,audio/ogg,video/webm,video/mp4,.webm,.m4a"></p><div id="record-error" role="status"></div>${busyBox('feedback')}${!state.retell?`<p class="help">${plain('每句最多 3 次分析','Up to 3 analyses per sentence')} · ${state.attempts[state.index]??0}/${CONFIG.maxAttempts}</p>`:''}</div>${state.retell?`<div class="button-row breathing-room">${btn('review','返回回顧','Back to review')}</div>`:feedbackView()}</section></div>
  <div class="back-row">${textBtn('story','← 查看句子','← View sentences')}<div class="button-row">${!state.retell?textBtn('next-sentence',state.index===2?'完成並回顧 →':'跳至下一句 →',state.index===2?'Finish & review →':'Next sentence →'):''}${textBtn('review','回顧活動','Review activity')}</div></div>`;}
function reviewView(){const total=Object.values(state.feedback).reduce((n,a)=>n+a.length,0);return `${heading('04','把這次練習，變成下一步','A little practice. A new beginning.','你的故事還有很多可能。','There is always another way to tell your story.')}
  <div class="review-grid"><section class="panel"><img class="practice-picture" src="${esc(state.illustration??state.drawing)}" alt="${plain('我的故事','My story')}"><div class="sentence-list">${state.sentences.map((s,i)=>`<button class="sentence-card" data-practice="${i}"><span><span class="hanzi" lang="zh-Hans">${esc(s.chinese)}</span><span class="meaning">${esc(s.english)}</span></span><span class="arrow">↗</span></button>`).join('')}</div></section>
  <section class="panel"><span class="eyebrow">YOUR STORY, YOUR VOICE</span><h2>${bi('今天的故事筆記','Your story notes')}</h2><div class="review-stat"><span>${bi('你創作的句子','Sentences in your story')}</span><strong>3</strong></div><div class="review-stat"><span>${bi(state.demo?'示範建議紀錄':'AI 建議紀錄',state.demo?'Sample suggestion records':'AI suggestion records')}</span><strong>${total}</strong></div><p class="help">${bi('次數不是學習成績。試著隱藏完整句子，只看圖畫再說一次。','Attempt counts are not learning scores. Try telling your story with just the picture.')}</p><div class="breathing-room">${btn('retell','看圖，再說一次','Tell it without the script','full-width')}</div><hr><label for="tester">${bi('測試者代號（選填）','Tester nickname (optional)')}</label><input id="tester" maxlength="50" value="${esc(state.tester)}"><label class="review-comments" for="comments">${bi('有甚麼地方好用或需要改善？','What worked, and what could improve?')}</label><textarea id="comments" maxlength="2000" placeholder="${plain('意思是否保留？拼音、錄音和建議是否合適？','Was your meaning preserved? Were Pinyin, recording and suggestions useful?')}">${esc(state.comments)}</textarea><div class="button-row breathing-room">${btn('export','下載測試筆記','Download test notes','secondary')}${btn('home','創作另一個故事','Create another story')}</div><p class="help">${bi('筆記不包含金鑰、圖畫或原始錄音。','Notes exclude the API key, drawings and raw recordings.')}</p></section></div>`;}
function render(){
  saveInputs();drawing=null;renderSteps();
  $('#language').textContent=isEnglishFirst()?'中文優先 / Chinese first':'English first / 英文優先';document.documentElement.lang=isEnglishFirst()?'en':'zh-Hant';
  $('#demo-banner').hidden=!state.demo;$('#demo-banner').textContent=plain('示範模式：插圖和建議為預設資料，並非本次錄音的分析。','DEMO MODE: illustration and suggestions are prepared samples, not an analysis of your recording.');
  $('#view').innerHTML=[welcome,drawView,storyView,speakView,reviewView][state.step]();
  if(state.step===1){
    const canvas=$('#draw-canvas');drawing=new Drawing(canvas,()=>{if(drawing?.canvas===canvas)$('#canvas-hint').hidden=drawing.hasContent;});
    if(state.drawing){const instance=drawing;instance.load(state.drawing,false).catch(()=>{});}
  }
}
function reset(){revision++;cancelJobs();audio.clear();clearClip();state=initial();drawing=null;$('#view').replaceChildren();clearNotice();render();window.scrollTo(0,0);}
async function startStory(id){
  if(state.prompt&&(state.drawing||state.sentences.length)&&!await confirmAction('開始新故事會清除本次作品。繼續嗎？','Starting a new story clears this activity. Continue?'))return;
  reset();state.prompt=STORIES.find(s=>s.id===id);state.step=1;render();
}
async function startDemo(){
  if(state.prompt&&!await confirmAction('示範故事會取代本次作品。繼續嗎？','The demo story will replace this activity. Continue?'))return;
  reset();state.demo=true;state.prompt=STORIES[0];state.drawing='./assets/demo-scene.svg';state.illustration='./assets/demo-scene.svg';state.interpretation={...DEMO.interpretation};state.meaning=DEMO.interpretation.zh;state.confirmed=state.meaning;state.sentences=structuredClone(DEMO.sentences);state.step=2;$('#settings').close();render();
}
function sampleFeedback(){
  const sentence=state.sentences[state.index];const words=sentence.tokens.map((t,index)=>({index,...t,status:index===0?'practice':'uncertain'})).filter(w=>hasLetters(w.text));
  const result={usability:'uncertain',heard:sentence.chinese,summary:{zh:'這是預設範例，不代表 AI 聽過你的錄音。請先聽示範，再練第一個詞。',en:'This is a prepared example, not an analysis of your recording. Listen to the model and practise the first word.'},words,hints:[{index:0,zh:`再聽一次「${sentence.tokens[0].text}」，然後讀完整句子。`,en:`Listen to “${sentence.tokens[0].text}” again, then read the whole sentence.`}]};
  (state.feedback[state.index]??=[]).push({result,mode:'demo',time:new Date().toISOString()});render();
}
async function handleInterpret(){
  saveInputs();if(state.demo){notify('示範模式使用預設資料。請重新開始進入實際模式。','Demo mode uses prepared data. Start over to use live AI.');return;}
  if(!state.drawing){notify('請先畫畫或上傳圖片。','Draw or upload a picture first.',true);return;}
  if(state.counts.interpret>=3){notify('本故事已使用 3 次理解請求。你可修改已取得的意思，或開始新故事。','This story has used 3 interpretation requests. Edit the existing meaning or start a new story.',true);return;}
  invalidateStory();state.counts.interpret++;const picture=state.drawing,caption=state.caption;
  await run('interpret',signal=>interpret(picture,state.prompt,caption,signal),data=>{state.interpretation=data;state.meaning=data.zh;state.step=2;},['正在理解你的圖畫……','Understanding your drawing…']);
}
function handleRedraw(){
  if(state.demo||!state.confirmed||jobs.has('image'))return;
  if(state.counts.image>=3){notify('本故事已達插圖請求上限。你仍可使用原畫。','Illustration limit reached. You can still use your original drawing.',true);return;}
  state.counts.image++;
  return run('image',signal=>redraw(state.drawing,state.confirmed,signal),data=>{state.illustration=data;},['正在生成插圖……你仍可繼續練習。','Creating your illustration… you can continue practising.']);
}
async function generate(){
  saveInputs();if(jobs.has('story'))return;
  if(!state.meaning.trim()){notify('請先確認或填寫故事意思。','Confirm or enter your story meaning first.',true);return;}
  if(state.demo){notify('這是固定示範故事。請重新開始，使用自己的圖畫進行實際生成。','This is a fixed demo story. Start over to generate from your own drawing.');return;}
  if(state.sentences.length&&!await confirmAction('更新故事會清除舊句子和練習建議。繼續嗎？','Updating the story clears the old sentences and suggestions. Continue?'))return;
  const meaning=state.meaning.trim();invalidateStory();state.confirmed=meaning;
  const sentenceJob=run('story',signal=>createStory(meaning,state.prompt,signal),data=>{state.sentences=data;},['正在為你的故事寫三句中文……','Writing three Chinese sentences for your story…']);
  handleRedraw();await sentenceJob;
}
async function play(text){
  if(state.recording||state.recordStarting)return;
  const rev=revision,idx=state.index;$('#recorded-audio')?.pause();
  const show=source=>{if(rev!==revision||state.index!==idx)return;state.source=({generating:plain('正在生成 Gemini 示範語音……','Generating Gemini model audio…'),gemini:plain('Gemini 示範語音','Gemini model audio'),browser:plain('備用：裝置普通話語音','Fallback: device Mandarin voice'),fallback:plain('Gemini 語音不可用，正在尋找裝置語音……','Gemini audio unavailable; looking for a device voice…'),'demo-browser':plain('示範模式：裝置普通話語音','Demo mode: device Mandarin voice'),unavailable:plain('語音播放失敗，請再試。','Audio playback failed. Please retry.')}[source]??'');if($('#audio-source'))$('#audio-source').textContent=state.source;};
  try{await audio.play(text,{demo:state.demo,onSource:show});}catch(e){notify(...errorPair(e),true);}
}
async function record(){
  if(state.recordStarting||state.recording)return;
  audio.stopPlayback();$('#recorded-audio')?.pause();clearClip();state.source='';state.recordStarting=true;const rid=recordId,rev=revision;render();
  try{
    await audio.start({maxSeconds:CONFIG.maxRecordingSeconds,onTime:seconds=>{
      if(recordId!==rid||rev!==revision)return;
      if(!state.recording){state.recording=true;state.recordStarting=false;render();}
      if($('#record-timer'))$('#record-timer').textContent=`00:${String(Math.floor(seconds)).padStart(2,'0')}`;
    },onStop:({blob,duration,silent})=>{
      if(recordId!==rid||rev!==revision)return;
      state.recording=false;state.recordStarting=false;
      if(blob.size<100||duration<.5){notify('錄音太短，請重錄。','The recording was too short. Please try again.',true);render();return;}
      state.clip=blob;state.clipURL=URL.createObjectURL(blob);state.clipDuration=duration;state.silent=silent;render();
    }});
  }catch(e){if(recordId===rid&&rev===revision){state.recording=false;state.recordStarting=false;render();notify(...errorPair(e),true);}}
}
async function analyse(){
  if(state.demo){notify('示範模式不會分析錄音。你可以查看清楚標示的示範建議。','Demo mode does not analyse recordings. Use the labelled sample suggestions.');return;}
  if(!state.clip||state.retell||jobs.has('feedback'))return;
  const index=state.index,attempt=recordId,clip=state.clip;
  if((state.attempts[index]??0)>=CONFIG.maxAttempts){notify('這句已使用 3 次分析。可繼續錄音自我回聽，或練習下一句。','This sentence has used 3 analyses. You can still record and listen, or move to the next sentence.');return;}
  if(state.silent){notify('錄音幾乎沒有聲音。請靠近麥克風重錄，這次不會送出分析。','Almost no sound was detected. Move closer and rerecord; this clip will not be sent for analysis.',true);return;}
  const progress=phase=>{
    if(index!==state.index||attempt!==recordId||!state.status.feedback?.busy)return;
    const labels=phase==='encoding'?['正在準備標準語音格式……','Preparing a standard audio format…']:phase==='fallback'?['主要語音服務暫時繁忙，正在嘗試一次備用模型……','The primary audio service is busy. Trying one fallback model…']:['正在聽你的錄音，整理練習建議……','Listening to your recording and preparing suggestions…'];
    state.status.feedback.zh=labels[0];state.status.feedback.en=labels[1];const box=document.querySelector('[data-job="feedback"]');if(box)box.innerHTML=bi(...labels);
  };
  await run('feedback',signal=>assess(clip,state.sentences[index],signal,progress),data=>{if(index!==state.index||attempt!==recordId)return;state.attempts[index]=(state.attempts[index]??0)+1;(state.feedback[index]??=[]).push({result:data,mode:'live',time:new Date().toISOString()});},['正在準備你的錄音……','Preparing your recording…']);
}
function exportReport(){
  saveInputs();const report={app:'Lingo-Pet Story Studio',version:CONFIG.version,time:new Date().toISOString(),mode:state.demo?'demo':'live',tester:state.tester,prompt:state.prompt?.id,confirmedMeaning:state.confirmed,sentences:state.sentences,attempts:state.feedback,comments:state.comments,notice:'Experimental AI suggestions; not validated pronunciation assessment. No raw media or credentials included.'};
  const blob=new Blob([JSON.stringify(report,null,2)],{type:'application/json'});const url=URL.createObjectURL(blob);const link=document.createElement('a');link.href=url;link.download=`lingo-story-notes-${Date.now()}.json`;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
const actions={
  home:async()=>{if(state.prompt&&!await confirmAction('重新開始會清除本次作品和錄音。繼續嗎？','Starting over clears this activity and recording. Continue?'))return;reset();},
  demo:startDemo,interpret:handleInterpret,generate,redraw:handleRedraw,
  'back-draw':()=>navigate(1),story:()=>navigate(2),speak:()=>{state.retell=false;navigate(3);},
  undo:()=>drawing?.undo(),
  'clear-drawing':async()=>{if(drawing?.hasContent&&await confirmAction('要清除這張圖畫嗎？你仍可使用復原。','Clear this drawing? You can still undo.'))drawing.clear();},
  listen:()=>play(state.sentences[state.index].chinese),record,'stop-record':()=>audio.stopRecording(),analyse,
  retry:()=>{clearClip();state.source='';render();$('#main').focus({preventScroll:true});},
  'sample-feedback':()=>{if(state.demo)sampleFeedback();},
  'next-sentence':()=>{if(state.index>=2){navigate(4);return;}state.index++;state.retell=false;navigate(3);},
  review:()=>navigate(4),retell:()=>{state.retell=true;navigate(3);},export:exportReport,
};
document.addEventListener('click',async event=>{
  const action=event.target.closest('[data-action]');if(action&&!action.disabled){try{await actions[action.dataset.action]?.();}catch(e){notify(...errorPair(e),true);}return;}
  const story=event.target.closest('[data-story]');if(story){await startStory(story.dataset.story);return;}
  const step=event.target.closest('[data-step]');if(step&&!step.disabled){if(Number(step.dataset.step)===0&&state.prompt){await actions.home();}else navigate(Number(step.dataset.step));return;}
  const practice=event.target.closest('[data-practice]');if(practice){state.index=Number(practice.dataset.practice);state.retell=false;navigate(3);return;}
  const word=event.target.closest('[data-word]');if(word){const token=state.sentences[state.index].tokens[Number(word.dataset.word)];if(token)play(token.text);return;}
  const color=event.target.closest('[data-color]');if(color&&drawing){drawing.color=color.dataset.color;drawing.erase=false;document.querySelectorAll('[data-color]').forEach(b=>{b.classList.toggle('selected',b===color);b.setAttribute('aria-pressed',b===color?'true':'false');});selectTool('brush');return;}
  const tool=event.target.closest('[data-tool]');if(tool&&drawing){drawing.erase=tool.dataset.tool==='eraser';selectTool(tool.dataset.tool);}
});
function selectTool(name){document.querySelectorAll('[data-tool]').forEach(b=>{b.classList.toggle('selected',b.dataset.tool===name);b.setAttribute('aria-pressed',b.dataset.tool===name?'true':'false');});}
document.addEventListener('input',event=>{
  if(event.target.id==='brush-size'&&drawing)drawing.size=Number(event.target.value);
  if(event.target.id==='show-pinyin'){state.pinyin=event.target.checked;render();}
  if(event.target.id==='show-english'){state.english=event.target.checked;render();}
});
document.addEventListener('change',async event=>{if(event.target.id==='upload'&&event.target.files[0]){try{await drawing.upload(event.target.files[0]);}catch(e){notify(...errorPair(e),true);}event.target.value='';}});
document.addEventListener('change',async event=>{
  if(event.target.id!=='upload-audio'||!event.target.files[0])return;
  const file=event.target.files[0];event.target.value='';
  if(!isAudioUpload(file)){notify('請選擇 5 MB 以內的 WAV、MP3、MP4、WebM 或 OGG 錄音。','Choose a WAV, MP3, MP4, WebM or OGG recording under 5 MB.',true);return;}
  audio.stopPlayback();clearClip();const rid=recordId,rev=revision,url=URL.createObjectURL(file),media=new Audio();
  try{
    const duration=await new Promise((resolve,reject)=>{const timeout=setTimeout(()=>reject(new Error('audio')),10000);media.onloadedmetadata=()=>{clearTimeout(timeout);resolve(media.duration);};media.onerror=()=>{clearTimeout(timeout);reject(new Error('audio'));};media.src=url;});
    if(!Number.isFinite(duration)||duration<.5||duration>15.2){notify('錄音長度必須介乎 0.5 至 15 秒。','Choose a recording between 0.5 and 15 seconds.',true);return;}
    if(rid!==recordId||rev!==revision)return;
    state.clip=file;state.clipURL=URL.createObjectURL(file);state.clipDuration=duration;state.silent=false;render();
  }catch{notify('未能讀取錄音。請嘗試 WAV 或 MP3。','Could not read this recording. Try WAV or MP3.',true);}
  finally{media.removeAttribute('src');media.load();URL.revokeObjectURL(url);}
});
document.addEventListener('play',event=>{if(event.target.id==='recorded-audio')audio.stopPlayback();},true);
$('#language').addEventListener('click',()=>{saveInputs();if(state.recording||state.recordStarting)clearClip();toggleLanguage();clearNotice();render();});
$('#new-story').addEventListener('click',actions.home);
$('#settings-open').addEventListener('click',()=>{for(const id of ['text','audio','image','tts'])$(`#${id}-model`).value=CONFIG[`${id}Model`];$('#connection-result').textContent='';$('#settings').showModal();});
$('#save-settings').addEventListener('click',()=>{saveInputs();for(const id of ['text','audio','image','tts']){const v=$(`#${id}-model`).value.trim();if(v&&!/^[a-zA-Z0-9._-]+$/.test(v)){$('#connection-result').textContent=plain('模型名稱格式不正確。','Invalid model identifier.');return;}}revision++;cancelJobs();audio.clear();clearClip();for(const id of ['text','audio','image','tts']){const v=$(`#${id}-model`).value.trim();if(v)CONFIG[`${id}Model`]=v;}$('#settings').close();render();notify('設定已套用於這個分頁。','Settings applied to this tab.');});
$('#connection').addEventListener('click',async()=>{const button=$('#connection');button.disabled=true;$('#connection-result').textContent=plain('正在檢查連線……','Checking connection…');try{const models=await checkConnection();const configured=['text','audio','image','tts'].map(id=>({id,model:$(`#${id}-model`).value.trim()}));$('#connection-result').textContent=plain('金鑰連線成功。模型清單不保證生成配額。','Key connected. Model listing does not guarantee generation quota.')+' '+configured.map(x=>`${x.id}: ${models.includes(x.model)?'✓':'?'} ${x.model}`).join(' · ');}catch(e){$('#connection-result').textContent=plain(...errorPair(e));}finally{button.disabled=false;}});
$('#demo-start').addEventListener('click',startDemo);
setInterval(()=>{document.querySelectorAll('.elapsed').forEach(el=>el.textContent=` · ${Math.floor((Date.now()-Number(el.dataset.start))/1000)}s`);},1000);
window.addEventListener('beforeunload',event=>{if(state.prompt&&(state.drawing||drawing?.hasContent)){event.preventDefault();event.returnValue='';}});
render();
