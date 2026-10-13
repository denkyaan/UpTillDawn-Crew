import {ROLE_EXERCISES} from "./role-exercise-plan"
import type {TourRole} from "@/lib/tour-training"

export type TrainingExerciseResult={id:string;completedAt:string;verified:boolean;attempts:number;error?:string}
export type TrainingQuestion={id:string;participantId:string;role:TourRole;message:string;status:"open"|"answered"|"closed";answer?:string}
export type TrainingRecord={participantId:string;role:TourRole;results:Record<string,TrainingExerciseResult>;questions:TrainingQuestion[];updatedAt:string}
export const requiredExerciseIds=(role:TourRole)=>Object.entries(ROLE_EXERCISES[role]).flatMap(([module,ids])=>ids.map(id=>module+":"+id))
export const trainingReport=(record:TrainingRecord)=>{
 const required=requiredExerciseIds(record.role)
 const completed=required.filter(id=>record.results[id]?.verified===true)
 const pending=required.filter(id=>record.results[id]?.verified!==true)
 const failed=required.filter(id=>record.results[id]?.error)
 return {participantId:record.participantId,role:record.role,total:required.length,completed:completed.length,pending,failed,questions:record.questions.filter(q=>q.status==="open").length,canFinish:pending.length===0}
}
export const resumeExercise=(record:TrainingRecord)=>trainingReport(record).pending[0]??null
export const resetTrainingModule=(record:TrainingRecord,module:string):TrainingRecord=>{
 if(!(module in ROLE_EXERCISES[record.role]))throw Error("Module not permitted for role")
 const results={...record.results}
 for(const id of ROLE_EXERCISES[record.role][module])delete results[module+":"+id]
 return {...record,results,updatedAt:new Date().toISOString()}
}
export const markExerciseVerified=(record:TrainingRecord,id:string,verified:boolean,error?:string):TrainingRecord=>{
 if(!requiredExerciseIds(record.role).includes(id))throw Error("Exercise not permitted for role")
 const prior=record.results[id]
 return {...record,results:{...record.results,[id]:{id,verified,completedAt:verified?new Date().toISOString():"",attempts:(prior?.attempts??0)+1,...(error?{error}:{})}},updatedAt:new Date().toISOString()}
}
