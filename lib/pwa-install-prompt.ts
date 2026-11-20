export const PWA_INSTALL_PROMPT_PENDING_KEY='upt-pwa-install-prompt-pending'
export const PWA_INSTALL_PROMPT_EVENT='uptilldawn-pwa-install-prompt-requested'

export function queuePwaInstallPrompt(){
  if(typeof window==='undefined')return
  window.localStorage.setItem(PWA_INSTALL_PROMPT_PENDING_KEY,'1')
  window.localStorage.removeItem('upt-pwa-install-dismissed')
  window.dispatchEvent(new Event(PWA_INSTALL_PROMPT_EVENT))
}

export function clearQueuedPwaInstallPrompt(){
  if(typeof window==='undefined')return
  window.localStorage.removeItem(PWA_INSTALL_PROMPT_PENDING_KEY)
}
