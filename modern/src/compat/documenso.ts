import {invokeOriginalRead} from '../original/transport'
export function checkSigningConnection(){return invokeOriginalRead('signing-connection',[])}
export function signingDispatchEnabled(){return false}
