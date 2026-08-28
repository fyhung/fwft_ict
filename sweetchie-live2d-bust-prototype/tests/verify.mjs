import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"..");
const htmlPath=path.join(root,"sweetchie-bust.html");
const html=fs.readFileSync(htmlPath,"utf8");
const failures=[];
const expect=(value,message)=>{if(!value)failures.push(message)};
expect(html.includes("data:image/png;base64,"),"atlas must be embedded");
expect(!html.includes("__BUST_ATLAS__"),"asset placeholder must be replaced");
expect(!/(?:src|href)=["']https?:/i.test(html),"standalone HTML must not load external resources");
expect(!/\bfetch\s*\(/.test(html),"standalone HTML must not fetch at runtime");
expect((html.match(/data-expression=/g)||[]).length===3,"three expression buttons must exist");
expect(html.includes("talkSmall:2")&&html.includes("talkWide:3"),"talking mouth states must exist");
const script=html.match(/<script>([\s\S]*?)<\/script>/)?.[1];
expect(Boolean(script),"inline engine must exist");
if(script){try{new Function(script)}catch(error){failures.push(`inline engine must parse: ${error.message}`)}}
if(failures.length){console.error(failures.map(item=>`FAIL: ${item}`).join("\n"));process.exit(1)}
console.log("PASS: Sweetchie bust prototype verified");
