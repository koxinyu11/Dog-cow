import { createTransfer, parseTransfer, beginRestore, finishRestore, RESTORE_KEY, MAX_TRANSFER_BYTES } from '../../../src/migration/transfer.js';

export function mountTransferExport(container) {
  const section = document.createElement('section');
  const title = document.createElement('h3');
  title.textContent = '旧版数据迁移';
  const help = document.createElement('p');
  help.textContent = '在原来使用的环境中导出任务、首页、工资与实际时间；新版校验后导入。兼容迁移包也可恢复到这里。文件含个人数据，请妥善保存。';
  const button = document.createElement('button');button.type = 'button';button.textContent = '导出迁移包';
  const status = document.createElement('p');status.setAttribute('role', 'status');
  const choose = document.createElement('input');choose.type = 'file';choose.accept = '.json';choose.setAttribute('aria-label','选择恢复迁移包');
  const preview = document.createElement('p');
  const confirm = document.createElement('button');confirm.type = 'button';confirm.textContent = '确认备份并恢复';confirm.disabled = true;
  const rollback = document.createElement('button');rollback.type = 'button';rollback.textContent = '从恢复记录还原原数据';
  const resume = document.createElement('button');resume.type = 'button';resume.textContent = '继续未完成的恢复';
  const reload = document.createElement('button');reload.type = 'button';reload.textContent = '重新载入当前数据';reload.onclick=()=>location.reload();
  section.append(title,help,button,status,choose,preview,confirm,rollback,resume,reload);container.append(section);
  let candidate = null;
  const pending = () => {try{return localStorage.getItem(RESTORE_KEY)!==null;}catch{return true;}};
  const sync = () => {rollback.hidden=resume.hidden=!pending();};sync();
  const pauseWriters = () => {
    window.__dogCowRestorePending = true;
    window.dispatchEvent(new Event('dogcow:before-restore'));
    for(const control of document.querySelectorAll('button,input,select,textarea'))if(!section.contains(control))control.disabled=true;
    for(const control of document.querySelectorAll('[contenteditable]'))control.contentEditable='false';
  };
  const showResult = event => {button.disabled = false;status.textContent = event.detail === 'saved' ? '迁移包已保存，当前数据保持不变。' : event.detail === 'canceled' ? '已取消导出。' : '文件未保存，请检查权限或空间后重试。';};
  window.addEventListener('dogcow:export-result',showResult);
  button.addEventListener('click',async()=>{
    button.disabled=true;status.textContent='正在读取原始键值并生成校验…';
    try{
      const bridge=window.webkit?.messageHandlers?.dogCowDataExport;
      const pack=await createTransfer(localStorage,{engine:bridge?'wkwebview':'browser',appVersion:'2.8.0'});
      const text=JSON.stringify(pack,null,2);
      if(bridge){bridge.postMessage(text);status.textContent='请选择保存位置；完成后显示结果。';}
      else{const url=URL.createObjectURL(new Blob([text],{type:'application/json'}));const link=document.createElement('a');link.href=url;link.download='dogcow-transfer.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);button.disabled=false;status.textContent='已交给浏览器下载，请确认文件保存。原始数据保持不变。';}
    }catch{button.disabled=false;status.textContent='无法生成迁移包，原始数据未修改。请检查本机存储与加密能力后重试。';}
  });
  choose.addEventListener('change',async()=>{
    candidate=null;confirm.disabled=true;const file=choose.files[0];if(!file)return;
    try{if(file.size>MAX_TRANSFER_BYTES)throw Error('迁移文件超过20MiB。');const result=await parseTransfer(await file.text());candidate=result.pack.values;preview.textContent=`任务 ${result.preview.counts.tasks} 项，请假 ${result.preview.counts.leaves} 项，考勤 ${result.preview.counts.attendanceDays} 天。确认会替换当前记录，先生成原键值恢复日志。`;confirm.disabled=false;}catch(error){preview.textContent=error.message||'无法校验文件，未写入。';}
  });
  confirm.addEventListener('click',()=>{if(!candidate)return;pauseWriters();try{beginRestore(localStorage,candidate);location.reload();}catch{status.textContent='恢复未完成，普通保存已暂停。可继续恢复、还原原数据，或重新载入；原恢复记录保留。';sync();}});
  for(const [control,direction] of [[rollback,'before'],[resume,'target']])control.addEventListener('click',()=>{pauseWriters();try{finishRestore(localStorage,direction);location.reload();}catch{status.textContent='恢复失败，原恢复记录保留。请保留本机数据后重试。';sync();}});
}
