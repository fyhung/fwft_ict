let englishFirst = false;
try { englishFirst = localStorage.getItem('lingo-ui') === 'en'; } catch {}
export const escapeHTML = (v) => String(v ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function isEnglishFirst(){return englishFirst;}
export function toggleLanguage(){englishFirst=!englishFirst;try{localStorage.setItem('lingo-ui',englishFirst?'en':'zh');}catch{}return englishFirst;}
export function bi(zh,en,inline=false){
  const a=englishFirst?en:zh,b=englishFirst?zh:en;
  return `<span class="${inline?'inline-bi':'bi'}"><span lang="${englishFirst?'en':'zh-Hant'}">${escapeHTML(a)}</span><span class="translation" lang="${englishFirst?'zh-Hant':'en'}">${escapeHTML(b)}</span></span>`;
}
export function plain(zh,en){return englishFirst?`${en} / ${zh}`:`${zh} / ${en}`;}
