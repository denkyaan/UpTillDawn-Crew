"use client"

import type {ButtonHTMLAttributes,ReactNode} from "react"
import {useFormStatus} from "react-dom"

export function PendingSubmitButton({
  children,
  pendingLabel="BEZIG…",
  ...props
}:ButtonHTMLAttributes<HTMLButtonElement>&{children:ReactNode;pendingLabel?:ReactNode}){
  const {pending}=useFormStatus()
  return <button {...props} type={props.type||"submit"} disabled={Boolean(props.disabled)||pending} aria-busy={pending}>
    {pending?pendingLabel:children}
  </button>
}
