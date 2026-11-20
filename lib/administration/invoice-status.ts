export const invoiceStatuses=['draft','review','approved','issued','paid','void'] as const
export const invoiceStatusLabels={
 nl:{draft:'Concept',review:'Ter controle',approved:'Goedgekeurd',issued:'Uitgereikt',paid:'Betaald',void:'Geannuleerd'},
 fr:{draft:'Brouillon',review:'À vérifier',approved:'Approuvé',issued:'Émis',paid:'Payé',void:'Annulé'},
 en:{draft:'Draft',review:'In review',approved:'Approved',issued:'Issued',paid:'Paid',void:'Void'},
 de:{draft:'Entwurf',review:'In Prüfung',approved:'Genehmigt',issued:'Ausgestellt',paid:'Bezahlt',void:'Storniert'},
} as const
export function isClosedInvoice(status:string):boolean{
 return status==='paid'||status==='void'
}
export function isOverdueInvoice(status:string,dueDate:string|null,today:string):boolean{
 return (status==='approved'||status==='issued')&&dueDate!==null&&dueDate!==''&&dueDate<today
}
