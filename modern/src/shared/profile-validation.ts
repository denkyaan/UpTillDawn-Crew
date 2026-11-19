export type ProfileInput={
 fullName:string;phone:string;dateOfBirth:string;address:string;
 nationalRegister:string;iban:string;preferredWorkplace:string;
 hasPhoto:boolean;isAdmin:boolean
}
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
export function normalizedIban(value:string):string{
 return value.replace(/\s/g,"").toUpperCase()
}
export function validIban(value:string):boolean{
 const iban=normalizedIban(value)
 if(!/^[A-Z]{2}[0-9]{2}[A-Z0-9]{11,30}$/.test(iban)||iban.length>34)return false
 const rearranged=iban.slice(4)+iban.slice(0,4)
 let mod=0
 for(const char of rearranged){
  const part=char>="A"&&char<="Z"?String(char.charCodeAt(0)-55):char
  for(const digit of part)mod=(mod*10+Number(digit))%97
 }
 return mod===1
}
function dateIsValid(value:string,now:Date):boolean{
 if(!/^\d{4}-\d{2}-\d{2}$/.test(value))return false
 const date=new Date(value+"T00:00:00Z")
 if(!Number.isFinite(date.getTime())||date.toISOString().slice(0,10)!==value)return false
 const today=new Date(Date.UTC(now.getUTCFullYear(),now.getUTCMonth(),now.getUTCDate()))
 const earliest=new Date(today);earliest.setUTCFullYear(earliest.getUTCFullYear()-120)
 return date<=today&&date>=earliest
}
export function validateProfileInput(input:ProfileInput,now:Date=new Date()){
 const fullName=input.fullName.trim().replace(/\s+/g," ")
 const phone=input.phone.trim()
 const address=input.address.trim()
 const nationalRegister=input.nationalRegister.trim()
 const iban=normalizedIban(input.iban)
 const dateOfBirth=input.dateOfBirth.trim()
 if(fullName.length>200||fullName.split(" ").filter(Boolean).length<2)throw new Error("invalid_full_name")
 if(!phone||phone.length>40)throw new Error("invalid_phone")
 if(!dateIsValid(dateOfBirth,now))throw new Error("invalid_dob")
 if(!input.hasPhoto)throw new Error("profile_photo_required")
 if(!input.isAdmin){
  if(!address||address.length>500)throw new Error("invalid_address")
  if(!nationalRegister||nationalRegister.length>32)throw new Error("invalid_national_register")
  if(!validIban(iban))throw new Error("invalid_iban")
  if(!UUID.test(input.preferredWorkplace))throw new Error("invalid_workplace_preference")
 }
 return {fullName,phone,dateOfBirth,address:input.isAdmin?"":address,
  nationalRegister:input.isAdmin?"":nationalRegister,iban:input.isAdmin?"":iban,
  preferredWorkplace:input.isAdmin?null:input.preferredWorkplace}
}
export function validPhotoSignature(mime:string,bytes:Uint8Array):boolean{
 if(mime==="image/jpeg")return bytes.length>=3&&bytes[0]===0xff&&bytes[1]===0xd8&&bytes[2]===0xff
 if(mime==="image/png")return bytes.length>=24&&[137,80,78,71,13,10,26,10].every((n,i)=>bytes[i]===n)
  &&String.fromCharCode(...bytes.slice(12,16))==="IHDR"
 if(mime==="image/webp")return bytes.length>=16
  &&String.fromCharCode(...bytes.slice(0,4))==="RIFF"
  &&String.fromCharCode(...bytes.slice(8,12))==="WEBP"
 return false
}
