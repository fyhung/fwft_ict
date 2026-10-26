import test from 'node:test';
import assert from 'node:assert/strict';
import {encodeMonoWav,prepareAudio,isAudioUpload} from '../media.js';
import {withAudioFallback,providerError,ServiceError} from '../gemini.js';

test('stereo PCM is downmixed and resampled to 16 kHz mono WAV',async()=>{
  const channels=[new Float32Array(48000).fill(.75),new Float32Array(48000).fill(-.25)];
  const blob=encodeMonoWav(channels,48000);const view=new DataView(await blob.arrayBuffer());
  assert.equal(blob.type,'audio/wav');assert.equal(view.getUint16(22,true),1);assert.equal(view.getUint32(24,true),16000);assert.equal(view.getUint32(40,true),32000);assert.ok(Math.abs(view.getInt16(44,true)-8192)<=1);
});
test('browser WebM is decoded before submission, not relabelled as WAV',async()=>{
  let decoded=false;
  const blob=await prepareAudio(new Blob(['compressed webm data'],{type:'audio/webm;codecs=opus'}),{contextFactory:()=>({decodeAudioData:async buffer=>{decoded=true;assert.equal(buffer.byteLength,20);return {numberOfChannels:1,sampleRate:48000,getChannelData:()=>new Float32Array(48000).fill(.2)};}})});
  assert.equal(decoded,true);assert.equal(blob.type,'audio/wav');assert.equal((await blob.arrayBuffer()).byteLength,32044);
});
test('audio-only WebM uploads labelled video/webm by the browser are accepted',()=>{
  assert.equal(isAudioUpload({type:'video/webm',size:20000,name:'recording.webm'}),true);
  assert.equal(isAudioUpload({type:'',size:20000,name:'recording.webm'}),true);
  assert.equal(isAudioUpload({type:'text/html',size:20000,name:'recording.webm'}),false);
  assert.equal(isAudioUpload({type:'video/webm',size:6*1024*1024}),false);
});
test('PCM WAV also follows the same standard path',async()=>{
  const original=encodeMonoWav([new Float32Array(24000).fill(.2)],24000,24000);
  const prepared=await prepareAudio(original);const view=new DataView(await prepared.arrayBuffer());
  assert.equal(view.getUint32(24,true),16000);assert.equal(view.getUint32(40,true),32000);
});
test('long or undecodable audio is rejected before an API request',async()=>{
  assert.throws(()=>encodeMonoWav([new Float32Array(16000*16)],16000),/audio-length/);
  await assert.rejects(()=>prepareAudio(new Blob(['bad audio']),{contextFactory:()=>({decodeAudioData:async()=>{throw new Error('bad');}})}),/audio-format/);
});
test('temporary 503 uses exactly one fallback and reports the model used',async()=>{
  const calls=[],progress=[];
  const result=await withAudioFallback(async model=>{calls.push(model);if(model==='primary')throw new ServiceError('service',503);return {heard:'你好'};},{models:['primary','backup','third'],onProgress:p=>progress.push(p)});
  assert.deepEqual(calls,['primary','backup']);assert.deepEqual(progress,['fallback']);assert.equal(result.model,'backup');assert.equal(result.usedFallback,true);
});
test('quota/auth/input failures do not trigger a model fallback',async()=>{
  for(const status of [400,401,403,429]){let calls=0;await assert.rejects(()=>withAudioFallback(async()=>{calls++;throw new ServiceError('failure',status);},{models:['a','b']}));assert.equal(calls,1);}
});
test('cancellation prevents the fallback request',async()=>{
  const controller=new AbortController();let calls=0;
  await assert.rejects(()=>withAudioFallback(async()=>{calls++;controller.abort();throw new ServiceError('service',503);},{models:['a','b'],signal:controller.signal}));assert.equal(calls,1);
});
test('zero allowance is distinct from a temporary quota limit; raw details stay private',()=>{
  const error=providerError(429,{error:{message:'Quota exceeded, limit: 0, account private-account'}},'image-model');
  assert.equal(error.code,'quota-disabled');assert.equal(error.model,'image-model');assert.ok(!JSON.stringify(error).includes('private-account'));
  assert.equal(providerError(429,{error:{message:'Try again later'}}).code,'quota');
});
