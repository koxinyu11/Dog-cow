import test from 'node:test';
import assert from 'node:assert/strict';
import { boundedCalendarFetch } from '../../dist-electron/src/main/calendar-network.js';
const url='https://raw.githubusercontent.com/NateScarlet/holiday-cn/master/2026.json';
test('only known public year URLs can be requested',async()=>{
 let called=false;const request=boundedCalendarFetch(async()=>{called=true;return new Response('{}');});
 await assert.rejects(request('https://example.com/private'));assert.equal(called,false);
 assert.deepEqual(await (await request(url)).json(),{});
});
test('declared and streamed oversized years are rejected before JSON parsing',async()=>{
 const declared=boundedCalendarFetch(async()=>new Response('{}',{headers:{'content-length':'1048577'}}));
 await assert.rejects(declared(url),/大小限制/);
 const streamed=boundedCalendarFetch(async()=>new Response(new Uint8Array(1048577)));
 await assert.rejects(streamed(url),/大小限制/);
});
