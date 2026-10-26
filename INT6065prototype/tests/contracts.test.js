import test from 'node:test';
import assert from 'node:assert/strict';
import { validateSentences,normalizeFeedback,pcmToWav } from '../gemini.js';
import { DEMO } from '../content.js';
import { escapeHTML } from '../i18n.js';

test('word tokens concatenate exactly; preserve punctuation and multi-character words',()=>{
  assert.equal(validateSentences(DEMO)[1].tokens[2].text,'小猫');
  const bad=structuredClone(DEMO);bad.sentences[0].tokens[0].text='猫';
  assert.throws(()=>validateSentences(bad),/alignment/);
});
test('do not accept missing Pinyin or partially formed sentences',()=>{
  const bad=structuredClone(DEMO);bad.sentences[0].tokens[0].pinyin='';
  assert.throws(()=>validateSentences(bad),/alignment/);
  assert.throws(()=>validateSentences({sentences:[]}),/format/);
});
test('unknown, duplicate and misaligned feedback cannot mark a word clear',()=>{
  const result=normalizeFeedback({usability:'usable',words:[{index:0,text:'wrong',status:'clear'},{index:1,text:'饿',status:'clear'},{index:1,text:'饿',status:'practice'}],hints:[]},DEMO.sentences[0]);
  assert.ok(result.words.every(w=>w.status==='uncertain'));
});
test('unusable or uncertain audio overrides positive word suggestions',()=>{
  for(const usability of ['uncertain','unusable']){
    const result=normalizeFeedback({usability,words:[{index:0,text:'小猫',status:'clear'}]},DEMO.sentences[0]);
    assert.ok(result.words.every(w=>w.status==='uncertain'));
  }
});
test('word identity includes token position; punctuation never receives feedback',()=>{
  const result=normalizeFeedback({usability:'usable',words:[{index:0,text:'小猫',status:'clear'},{index:3,text:'。',status:'practice'}],hints:[{index:99,zh:'bad',en:'bad'},{index:0,zh:'再聽',en:'Listen'}]},DEMO.sentences[0]);
  assert.equal(result.words.length,3);assert.equal(result.words[0].status,'clear');assert.equal(result.hints.length,1);
});
test('PCM becomes a valid mono WAV with the correct sample rate',async()=>{
  const bytes=new Uint8Array([0,0,1,0]);const wav=pcmToWav(bytes,24000);const buffer=await wav.arrayBuffer();const view=new DataView(buffer);
  assert.equal(wav.type,'audio/wav');assert.equal(buffer.byteLength,48);assert.equal(view.getUint32(24,true),24000);assert.equal(view.getUint32(40,true),4);
  assert.equal(new TextDecoder().decode(new Uint8Array(buffer,0,4)),'RIFF');
});
test('model text cannot inject executable markup into bilingual output',()=>{
  assert.equal(escapeHTML('<img src=x onerror="bad()">'),'&lt;img src=x onerror=&quot;bad()&quot;&gt;');
});
