import {invokeOriginalRead} from '../original/transport'
export const getArtistSigningDispatchPreflight=(input:unknown)=>invokeOriginalRead('artist-signing-preflight',[input])
