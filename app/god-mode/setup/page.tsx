import { redirect } from 'next/navigation'

export const dynamic='force-dynamic'

export default function GodModeSetupPage(){
  // There is no standalone God Mode credential flow.
  // Sign in through the maker account and choose God Mode in Maker Mode.
  redirect('/login/admin')
}
