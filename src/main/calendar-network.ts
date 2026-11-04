const MAX_YEAR_BYTES=1024*1024;
const allowed=/^https:\/\/(?:raw\.githubusercontent\.com\/NateScarlet\/holiday-cn\/master|cdn\.jsdelivr\.net\/gh\/NateScarlet\/holiday-cn@master)\/[1-9]\d{3}\.json$/;
/** Calendar networking is a fixed public-data capability, never an arbitrary URL proxy. */
export function boundedCalendarFetch(fetchImpl:typeof fetch=globalThis.fetch):typeof fetch {
  return async(input,options)=>{
    const url=String(input);
    if(!allowed.test(url))throw Error('调休日历来源不受信任。');
    const response=await fetchImpl(input,options);
    if(!response.ok)return response;
    const declared=Number(response.headers.get('content-length'));
    if(Number.isFinite(declared)&&declared>MAX_YEAR_BYTES){await response.body?.cancel();throw Error('年度日历超过大小限制。');}
    const reader=response.body?.getReader();
    if(!reader)throw Error('年度日历响应为空。');
    const chunks:Buffer[]=[];let size=0;
    try{while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>MAX_YEAR_BYTES){await reader.cancel();throw Error('年度日历超过大小限制。');}chunks.push(Buffer.from(value));}}
    finally{reader.releaseLock();}
    return new Response(Buffer.concat(chunks),{status:response.status,headers:{'content-type':'application/json'}});
  };
}
