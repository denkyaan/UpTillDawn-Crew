import {mkdir,writeFile} from 'node:fs/promises'
import {preparePeppol} from '../lib/administration/peppol.ts'
import {peppolSamples} from '../tests/fixtures/peppol-input.mjs'
const target='test-results/peppol-xml'
await mkdir(target,{recursive:true})
for(const [name,input] of Object.entries(peppolSamples())){
 const {xml,issues}=preparePeppol(input)
 if(!xml)throw Error(name+': '+JSON.stringify(issues))
 await writeFile(target+'/'+name+'.xml',xml)
}
const valid=preparePeppol(peppolSamples()['invoice-standard']).xml
await writeFile(target+'/negative-reference.xml',valid.replace(/<cbc:BuyerReference>.*?<\/cbc:BuyerReference>/,''))
await writeFile(target+'/negative-totals.xml',valid.replace('<cbc:TaxExclusiveAmount currencyID="EUR">20.00','<cbc:TaxExclusiveAmount currencyID="EUR">21.00'))
await writeFile(target+'/negative-schema.xml',valid.replace('<cbc:IssueDate>2026-10-30','<cbc:IssueDate>invalid-date'))
console.log('Prepared official-rule validation fixtures')
