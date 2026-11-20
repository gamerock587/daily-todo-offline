const {contextBridge,ipcRenderer}=require('electron');
const sends=new Set(['set-ignore-mouse','start-widget-drag','stop-widget-drag']);
const receives=new Set(['widget-drag-point','hide-widget','show-widget','show-widget-center']);
contextBridge.exposeInMainWorld('desktop',{
 send:(channel,value)=>{if(sends.has(channel))ipcRenderer.send(channel,value);},
 invoke:channel=>channel==='get-display-layout'?ipcRenderer.invoke(channel):Promise.reject(new Error('Unsupported channel')),
 on:(channel,handler)=>{if(receives.has(channel))ipcRenderer.on(channel,(_,value)=>handler(null,value));},
 readClipboard:()=>ipcRenderer.invoke('clipboard-read'),
 writeClipboard:text=>ipcRenderer.invoke('clipboard-write',text)
});
