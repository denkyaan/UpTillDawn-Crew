import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import ts from 'typescript'
import {translateCrewExtraUi} from '../lib/ui-translation-catalog-crew-extra.ts'

const component=readFileSync('components/crew/chat-client.tsx','utf8')
const rawCatalog=readFileSync('lib/ui-translation-catalog-crew-extra.ts','utf8')

test('all visible chat interaction labels use the active application language',()=>{
 const labels=["Chatmedia","Document openen","Er zijn momenteel geen beschikbare chats.","Tik om van chat te wisselen","Gesprekken","Nieuwe privéchat","Kies iemand om een privéchat te starten.","Zoek persoon…","Nog geen berichten in deze chat.","Bericht verwijderd door beheerder","Origineel","Vertalen…","Vertaal","Modereer","Bestand toevoegen","Typ een bericht…","Enter = nieuwe regel · verzenden gebeurt met de knop.","Reden voor moderatie (wordt geaudit):","Chat automatisch vertalen"]
 for(const label of labels){
  const escaped=label.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')
  assert.match(component,new RegExp('translateRuntimeUi\\([\\s\\S]{0,130}[\\x27\\x22]'+escaped+'[\\x27\\x22]'),'expected live language translation call for '+label)
 }
 assert.match(component,/translateRuntimeUi\\(label as string,uiLocale\\)/)
 assert.match(component,/translateRuntimeUi\\(status,uiLocale\\)/)
 assert.match(component,/locale=\\{uiLocale\\}/)
 const sf=ts.createSourceFile('chat-client.tsx',component,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX)
 assert.equal(sf.parseDiagnostics.length,0,'chat must remain valid TSX')
})
test('chat operation copy has distinct French, English and German translations',()=>{
 const labels=["Chatmedia","Document openen","Er zijn momenteel geen beschikbare chats.","Tik om van chat te wisselen","Gesprekken","Nog geen berichten in deze chat.","Origineel","Vertalen…","Vertaal","Modereer","Bestand toevoegen","Typ een bericht…","Enter = nieuwe regel · verzenden gebeurt met de knop.","Reden voor moderatie (wordt geaudit):","Bericht verwijderd door beheerder","Bericht gemodereerd.","Moderatie mislukt.","Bestand verzonden.","Bestand is lokaal bewaard en wordt verzonden zodra je online bent.","Het lokaal bewaarde bestand bevat geen leesbare gegevens meer. Verwijder deze wachtrij-upload en selecteer het originele bestand opnieuw.","Je sessie is gewijzigd. Meld opnieuw aan voordat je het bestand opnieuw verzendt.","Bericht kon niet worden bewaard.","Privéchat kon niet worden gestart.","Privéchat kon niet worden verwijderd.","Bestand kon niet naar de server worden verzonden: "]
 for(const label of labels){
  assert.ok(rawCatalog.includes(JSON.stringify(label)+':'),'missing dictionary entry: '+label)
  const values=['fr','en','de'].map(locale=>translateCrewExtraUi(label,locale))
  values.forEach((value,i)=>assert.notEqual(value,label,'untranslated '+label+' in '+['fr','en','de'][i]))
  assert.equal(new Set(values).size,3,'duplicate translations for '+label)
 }
})
