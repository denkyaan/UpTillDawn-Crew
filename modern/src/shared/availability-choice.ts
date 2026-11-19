// The event availability selector can be disabled after the registration
// deadline, so never infer the answer from FormData's missing select entry.
// The server still independently enforces registration and cancellation rules.
export type ChosenAvailability="can"|"cannot"
export function submissionChoice(
 selected:ChosenAvailability,
 registrationOpen:boolean,
 existingMemberMayWithdraw:boolean,
):ChosenAvailability{
 if(!registrationOpen){
  if(!existingMemberMayWithdraw)throw new Error("event_registration_closed")
  return "cannot"
 }
 if(selected!=="can"&&selected!=="cannot")throw new Error("invalid_availability_choice")
 return selected
}
