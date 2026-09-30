export const UPLOAD_LIMITS={image:10*1024*1024,video:50*1024*1024,document:20*1024*1024} as const

const allowed=new Map<string,{ext:string;kind:'image'|'video'|'document'}>([
 ['image/jpeg',{ext:'jpg',kind:'image'}],['image/png',{ext:'png',kind:'image'}],['image/webp',{ext:'webp',kind:'image'}],
 ['video/mp4',{ext:'mp4',kind:'video'}],['video/webm',{ext:'webm',kind:'video'}],['video/quicktime',{ext:'mov',kind:'video'}],
 ['application/pdf',{ext:'pdf',kind:'document'}],['text/plain',{ext:'txt',kind:'document'}],['text/csv',{ext:'csv',kind:'document'}],
 ['application/vnd.openxmlformats-officedocument.wordprocessingml.document',{ext:'docx',kind:'document'}],
 ['application/vnd.openxmlformats-officedocument.presentationml.presentation',{ext:'pptx',kind:'document'}],
 ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',{ext:'xlsx',kind:'document'}],
])

const executableExtensions=/\.(?:exe|dll|com|scr|msi|msp|bat|cmd|ps1|vbs|vbe|js|jse|wsf|wsh|hta|jar|apk|app|dmg|pkg|deb|rpm|sh|bash|zsh|py|rb|php|pl|cgi)(?:\.|$)/i
const doubleExtension=/\.(?:pdf|jpe?g|png|webp|docx?|xlsx?|pptx?|txt|csv)\.(?:exe|dll|com|scr|bat|cmd|js|vbs|ps1|sh)$/i

export type UploadSecurityResult={mime:string;extension:string;kind:'image'|'video'|'document';size:number}

function starts(bytes:Uint8Array,signature:number[],offset=0){return signature.every((value,index)=>bytes[offset+index]===value)}
function ascii(bytes:Uint8Array,start:number,end:number){return String.fromCharCode(...bytes.slice(start,end))}
function signatureMatches(mime:string,bytes:Uint8Array){
 if(mime==='image/jpeg')return starts(bytes,[0xff,0xd8,0xff])
 if(mime==='image/png')return starts(bytes,[0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a])
 if(mime==='image/webp')return ascii(bytes,0,4)==='RIFF'&&ascii(bytes,8,12)==='WEBP'
 if(mime==='application/pdf')return ascii(bytes,0,5)==='%PDF-'
 if(mime.includes('openxmlformats-officedocument'))return starts(bytes,[0x50,0x4b,0x03,0x04])||starts(bytes,[0x50,0x4b,0x05,0x06])||starts(bytes,[0x50,0x4b,0x07,0x08])
 if(mime==='video/webm')return starts(bytes,[0x1a,0x45,0xdf,0xa3])
 if(mime==='video/mp4'||mime==='video/quicktime')return ascii(bytes,4,8)==='ftyp'
 if(mime==='text/plain'||mime==='text/csv')return !bytes.slice(0,512).some(value=>value===0)
 return false
}

export function safeUploadName(name:string){
 const normalized=name.normalize('NFKC').replace(/[\u0000-\u001f\u007f]/g,'').replace(/[\\/]/g,'_').trim()
 return (normalized||'bestand').slice(0,180)
}

export async function validateUploadSecurity(file:File,{allowDocuments=true}:{allowDocuments?:boolean}={}):Promise<UploadSecurityResult>{
 const entry=allowed.get(file.type)
 if(!entry)throw new Error('Dit bestandstype wordt niet ondersteund.')
 const name=safeUploadName(file.name)
 if(executableExtensions.test(name)||doubleExtension.test(name))throw new Error('Dit bestand is om veiligheidsredenen geblokkeerd.')
 if(!allowDocuments&&entry.kind==='document')throw new Error('Gebruik hier alleen foto of video.')
 if(file.size<=0||file.size>UPLOAD_LIMITS[entry.kind])throw new Error(entry.kind==='video'?'De video mag maximaal 50 MB zijn.':entry.kind==='image'?'De afbeelding mag maximaal 10 MB zijn.':'Het document mag maximaal 20 MB zijn.')
 const head=new Uint8Array(await file.slice(0,4096).arrayBuffer())
 if(!signatureMatches(file.type,head))throw new Error('De inhoud van het bestand komt niet overeen met het bestandstype.')
 return {mime:file.type,extension:entry.ext,kind:entry.kind,size:file.size}
}
