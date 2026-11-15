/**
 * RLS-preserving, bounded Supabase Storage requests for directory photos.
 * A single createSignedUrls request replaces N per-person createSignedUrl calls.
 * No public bucket fallback, no cached token reuse, no cross-directory signing.
 */
export type DirectoryPhotoMember={id:string;profile_photo_url?:string|null}
export type SignedPhotoRow={path:string|null;signedUrl:string;error:string|null}
export type SignedPhotoBatch={data:SignedPhotoRow[]|null;error:unknown}
export type BatchSigner=(paths:string[],expiresIn:number)=>Promise<SignedPhotoBatch>

export async function signedDirectoryPhotoUrls(
 members:readonly DirectoryPhotoMember[],
 signMany:BatchSigner,
):Promise<Record<string,string>>{
 const idsByPath=new Map<string,string[]>()
 for(const member of members){
  const path=member.profile_photo_url
  if(!path)continue
  const ids=idsByPath.get(path)
  if(ids)ids.push(member.id)
  else idsByPath.set(path,[member.id])
 }
 const signedByUser:Record<string,string>={}
 const paths=[...idsByPath.keys()]
 // Bound batch size to avoid large response bodies, while keeping every
 // authorized directory member eligible for the same private photo.
 for(let i=0;i<paths.length;i+=100){
  let batch:SignedPhotoBatch
  try{batch=await signMany(paths.slice(i,i+100),3600)}
  catch{continue}
  if(batch.error||!batch.data)continue
  for(const row of batch.data){
   if(row.error||!row.path||!row.signedUrl)continue
   for(const id of idsByPath.get(row.path)||[])signedByUser[id]=row.signedUrl
  }
 }
 return signedByUser
}
