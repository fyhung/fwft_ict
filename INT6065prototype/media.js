// Keep original recordings for playback; submit predictable mono 16 kHz WAV to AI.
export class AudioInputError extends Error {
  constructor(code){super(code);this.code=code;}
}
export function isAudioUpload(file){
  const type=String(file.type??'').split(';')[0].toLowerCase();
  return file.size>0&&file.size<=5*1024*1024&&(/^audio\/(wav|wave|x-wav|mpeg|mp3|mp4|m4a|x-m4a|webm|ogg|opus)$/.test(type)||['video/webm','video/mp4'].includes(type)||(!type&&/\.(wav|mp3|m4a|mp4|webm|ogg)$/i.test(file.name??'')));
}
export function pcmToWav(bytes,rate=24000){
  const buffer=new ArrayBuffer(44+bytes.length),view=new DataView(buffer);
  const ascii=(offset,s)=>{for(let i=0;i<s.length;i++)view.setUint8(offset+i,s.charCodeAt(i));};
  ascii(0,'RIFF');view.setUint32(4,36+bytes.length,true);ascii(8,'WAVE');ascii(12,'fmt ');view.setUint32(16,16,true);view.setUint16(20,1,true);view.setUint16(22,1,true);view.setUint32(24,rate,true);view.setUint32(28,rate*2,true);view.setUint16(32,2,true);view.setUint16(34,16,true);ascii(36,'data');view.setUint32(40,bytes.length,true);new Uint8Array(buffer,44).set(bytes);return new Blob([buffer],{type:'audio/wav'});
}
export function encodeMonoWav(channels,rate,targetRate=16000){
  if(!channels.length||!channels[0].length||!Number.isFinite(rate)||rate<=0)throw new AudioInputError('audio-format');
  const length=channels[0].length;
  if(length/rate>15.3)throw new AudioInputError('audio-length');
  const mono=new Float32Array(length);
  for(const channel of channels){if(channel.length!==length)throw new AudioInputError('audio-format');for(let i=0;i<length;i++)mono[i]+=channel[i]/channels.length;}
  const outputLength=Math.max(1,Math.round(length*targetRate/rate));
  const bytes=new Uint8Array(outputLength*2),view=new DataView(bytes.buffer),step=rate/targetRate;
  for(let i=0;i<outputLength;i++){
    // Average the source interval for downsampling; interpolate when upsampling.
    const from=i*step,to=Math.min(length,(i+1)*step);let value=0;
    if(step>=1){let weight=0;for(let p=Math.floor(from);p<Math.ceil(to)&&p<length;p++){const w=Math.max(0,Math.min(to,p+1)-Math.max(from,p));value+=mono[p]*w;weight+=w;}value=weight?value/weight:0;}
    else{const a=Math.min(length-1,Math.floor(from)),b=Math.min(length-1,a+1),fraction=from-a;value=mono[a]*(1-fraction)+mono[b]*fraction;}
    value=Math.max(-1,Math.min(1,Number.isFinite(value)?value:0));view.setInt16(i*2,Math.round(value*(value<0?32768:32767)),true);
  }
  return pcmToWav(bytes,targetRate);
}
function readPcm(bytes){
  if(bytes.length<44)return null;
  const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
  const four=offset=>String.fromCharCode(...bytes.subarray(offset,offset+4));
  if(four(0)!=='RIFF'||four(8)!=='WAVE')return null;
  let format,content;
  for(let p=12;p+8<=bytes.length;){const id=four(p),size=view.getUint32(p+4,true),start=p+8;if(start+size>bytes.length)return null;if(id==='fmt '&&size>=16)format={encoding:view.getUint16(start,true),channels:view.getUint16(start+2,true),rate:view.getUint32(start+4,true),bits:view.getUint16(start+14,true)};if(id==='data')content={start,size};p=start+size+(size%2);}
  if(!format||!content||format.encoding!==1||format.bits!==16||format.channels<1||format.channels>8)return null;
  const frames=Math.floor(content.size/(format.channels*2)),channels=Array.from({length:format.channels},()=>new Float32Array(frames));
  for(let i=0;i<frames;i++)for(let ch=0;ch<format.channels;ch++)channels[ch][i]=view.getInt16(content.start+(i*format.channels+ch)*2,true)/32768;
  return {channels,rate:format.rate};
}
export async function prepareAudio(blob,{signal,contextFactory}={}){
  if(signal?.aborted)throw new DOMException('Cancelled','AbortError');
  if(!blob?.size||blob.size>5*1024*1024)throw new AudioInputError('audio-format');
  const buffer=await blob.arrayBuffer(),pcm=readPcm(new Uint8Array(buffer));
  if(pcm)return encodeMonoWav(pcm.channels,pcm.rate);
  const Factory=globalThis.OfflineAudioContext??globalThis.webkitOfflineAudioContext;
  if(!contextFactory&&!Factory)throw new AudioInputError('audio-format');
  let context,timer;
  try{
    context=contextFactory?contextFactory():new Factory(1,1,16000);
    const decoded=await Promise.race([context.decodeAudioData(buffer.slice(0)),new Promise((_,reject)=>{timer=setTimeout(()=>reject(new AudioInputError('audio-format')),15000);})]);
    if(signal?.aborted)throw new DOMException('Cancelled','AbortError');
    return encodeMonoWav(Array.from({length:decoded.numberOfChannels},(_,i)=>decoded.getChannelData(i)),decoded.sampleRate);
  }catch(e){if(e.name==='AbortError'||e instanceof AudioInputError)throw e;throw new AudioInputError('audio-format');}
  finally{clearTimeout(timer);context?.close?.().catch(()=>{});}
}
