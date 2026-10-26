import { generateSpeech } from './gemini.js';
export class AudioStudio {
  constructor(){this.cache=new Map();this.player=null;this.stream=null;this.recorder=null;this.epoch=0;this.context=null;this.playEpoch=0;}
  stopPlayback(){this.playEpoch++;if(this.player){this.player.pause();this.player=null;}globalThis.speechSynthesis?.cancel();}
  clear(){this.stopPlayback();this.cancelRecording();for(const url of this.cache.values())URL.revokeObjectURL(url);this.cache.clear();}
  async play(text,{demo=false,onSource=()=>{},signal}={}){
    this.stopPlayback();const epoch=this.playEpoch;
    if(!demo){
      try{
        let url=this.cache.get(text);
        if(!url){onSource('generating');const blob=await generateSpeech(text,signal);if(epoch!==this.playEpoch||signal?.aborted)return;url=URL.createObjectURL(blob);this.cache.set(text,url);}
        if(epoch!==this.playEpoch)return;
        this.player=new Audio(url);await this.player.play();onSource('gemini');return;
      }catch(e){if(epoch!==this.playEpoch||signal?.aborted)return;onSource('fallback');}
    }
    if(!globalThis.speechSynthesis)throw new Error('voice');
    let voices=speechSynthesis.getVoices();
    if(!voices.length)voices=await new Promise(resolve=>{const done=()=>{clearTimeout(timer);speechSynthesis.removeEventListener('voiceschanged',done);resolve(speechSynthesis.getVoices());};const timer=setTimeout(done,1200);speechSynthesis.addEventListener('voiceschanged',done,{once:true});});
    if(epoch!==this.playEpoch||signal?.aborted)return;
    const voice=voices.find(v=>/^zh[-_]CN/i.test(v.lang))??voices.find(v=>/^zh[-_]TW/i.test(v.lang));
    if(!voice)throw new Error('voice');
    const utterance=new SpeechSynthesisUtterance(text);utterance.voice=voice;utterance.lang=voice.lang;utterance.rate=.82;utterance.onerror=()=>onSource('unavailable');speechSynthesis.speak(utterance);onSource(demo?'demo-browser':'browser');
  }
  async start({maxSeconds,onTime,onStop}){
    if(this.recorder?.state==='recording')return;
    this.stopPlayback();this.cancelRecording();const epoch=this.epoch;
    if(!navigator.mediaDevices?.getUserMedia||!globalThis.MediaRecorder)throw new Error('unsupported');
    const stream=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true},video:false});
    if(this.epoch!==epoch){stream.getTracks().forEach(t=>t.stop());return;}
    this.stream=stream;
    const mime=['audio/webm;codecs=opus','audio/webm','audio/mp4','audio/ogg;codecs=opus'].find(t=>MediaRecorder.isTypeSupported(t));
    try{this.recorder=new MediaRecorder(stream,mime?{mimeType:mime}:{});}catch(e){stream.getTracks().forEach(t=>t.stop());this.stream=null;throw e;}
    const recorder=this.recorder,chunks=[];let maxLevel=0;
    this.analyser=null;
    try{this.context=new AudioContext();this.source=this.context.createMediaStreamSource(stream);this.analyser=this.context.createAnalyser();this.analyser.fftSize=256;this.source.connect(this.analyser);}catch{}
    const started=Date.now(),context=this.context,analyser=this.analyser;
    recorder.ondataavailable=e=>{if(e.data.size)chunks.push(e.data);};
    recorder.onstop=()=>{
      clearInterval(timer);clearTimeout(cap);stream.getTracks().forEach(t=>t.stop());context?.close().catch(()=>{});if(this.context===context)this.context=null;if(this.stream===stream)this.stream=null;
      const blob=new Blob(chunks,{type:recorder.mimeType||chunks[0]?.type||'audio/webm'});
      if(this.epoch===epoch)onStop({blob,duration:(Date.now()-started)/1000,silent:!!analyser&&maxLevel<.003});
    };
    recorder.start();onTime(0);
    const timer=setInterval(()=>{const seconds=(Date.now()-started)/1000;if(analyser){const samples=new Uint8Array(analyser.fftSize);analyser.getByteTimeDomainData(samples);const rms=Math.sqrt(samples.reduce((a,v)=>a+((v-128)/128)**2,0)/samples.length);maxLevel=Math.max(maxLevel,rms);}onTime(seconds);},150);
    const cap=setTimeout(()=>this.stopRecording(),maxSeconds*1000);this.timer=timer;this.cap=cap;
  }
  stopRecording(){if(this.recorder?.state==='recording')this.recorder.stop();}
  cancelRecording(){this.epoch++;clearInterval(this.timer);clearTimeout(this.cap);if(this.recorder?.state==='recording')this.recorder.stop();this.stream?.getTracks().forEach(t=>t.stop());this.stream=null;this.context?.close().catch(()=>{});this.context=null;}
}
