import test from 'node:test';
import assert from 'node:assert/strict';
import { AudioStudio } from '../audio.js';

function installMicrophone(getUserMedia){
  const descriptor=Object.getOwnPropertyDescriptor(globalThis,'navigator');
  const previous=globalThis.MediaRecorder;
  Object.defineProperty(globalThis,'navigator',{value:{mediaDevices:{getUserMedia}},configurable:true});
  class Recorder {
    static isTypeSupported(type){return type==='audio/webm;codecs=opus';}
    constructor(){this.state='inactive';this.mimeType='audio/webm;codecs=opus';}
    start(){this.state='recording';}
    stop(){this.state='inactive';this.ondataavailable({data:new Blob(['test recording'],{type:this.mimeType})});this.onstop();}
  }
  globalThis.MediaRecorder=Recorder;
  return()=>{if(descriptor)Object.defineProperty(globalThis,'navigator',descriptor);else delete globalThis.navigator;if(previous)globalThis.MediaRecorder=previous;else delete globalThis.MediaRecorder;};
}
test('a microphone grant arriving after navigation is immediately released',async()=>{
  let grant,stopped=0,called=false;
  const restore=installMicrophone(()=>new Promise(resolve=>{grant=resolve;}));
  const studio=new AudioStudio();
  try{
    const pending=studio.start({maxSeconds:15,onTime:()=>{},onStop:()=>{called=true;}});
    studio.cancelRecording();grant({getTracks:()=>[{stop:()=>stopped++}]});await pending;
    assert.equal(stopped,1);assert.equal(called,false);assert.equal(studio.recorder,null);
  }finally{studio.cancelRecording();restore();}
});
test('stopping a recording releases the microphone and retains the actual MIME type',async()=>{
  let stopped=0,result;
  const restore=installMicrophone(async()=>({getTracks:()=>[{stop:()=>stopped++}]}));
  const studio=new AudioStudio();
  try{
    await studio.start({maxSeconds:15,onTime:()=>{},onStop:r=>{result=r;}});studio.stopRecording();
    assert.equal(stopped,1);assert.equal(result.blob.type,'audio/webm;codecs=opus');assert.ok(result.blob.size>0);
  }finally{studio.cancelRecording();restore();}
});
