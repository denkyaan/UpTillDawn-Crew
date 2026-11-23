// Small dependency-free XLSX (Office Open XML ZIP store) writer for Workers Free.
// No ExcelJS, Node streams, external provider or executable spreadsheet formulas.
// Explicit byte and row budgets prevent workbooks exhausting a 128 MB Worker.
export type Cell=string|number|Date|null|undefined|{value:string|number|Date|null|undefined;style?:0|1|2|3}
export type Sheet={name:string;rows:Cell[][];widths?:number[];boldRows?:number[];freezeHeader?:boolean;autoFilter?:string}
const encoder=new TextEncoder()
const MAX_BYTES=24*1024*1024
const MAX_ROWS=16000
const xmlStart='<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
const ns='http://schemas.openxmlformats.org/spreadsheetml/2006/main'
const escapeXml=(value:string)=>value.replace(/[&<>"'\u0000-\u001f]/g,char=>{
 if(char==='&')return '&amp;'
 if(char==='<')return '&lt;'
 if(char==='>')return '&gt;'
 if(char==='"')return '&quot;'
 if(char==="'")return '&apos;'
 return char==='\t'||char==='\n'||char==='\r'?char:''
})
function column(n:number){let out='';for(n++;n>0;n=Math.floor((n-1)/26))out=String.fromCharCode(65+(n-1)%26)+out;return out}
function cellXml(cell:Cell,reference:string,header:boolean):string{
 if(cell===null||cell===undefined)return ''
 const wrapped=typeof cell==='object'&&!(cell instanceof Date)&&'value' in cell
 const value=wrapped?cell.value:cell,style=wrapped?cell.style:(header?3:0)
 if(value===null||value===undefined)return ''
 const attr=style?' s="'+style+'"':''
 if(value instanceof Date){
  const time=value.getTime()
  if(!Number.isFinite(time))throw Error('invalid_workbook_date')
  const number=time/86400000+25569
  return '<c r="'+reference+'" s="'+(style||2)+'"><v>'+number+'</v></c>'
 }
 if(typeof value==='number'){
  if(!Number.isFinite(value))throw Error('invalid_workbook_number')
  return '<c r="'+reference+'"'+attr+'><v>'+value+'</v></c>'
 }
 if(value.length>32767)throw Error('excel_cell_too_long')
 // Preserve the existing legacy formula-injection guard even though inline
 // strings do not generate formula nodes.
 const text=/^[=+\-@]/.test(value)?"'"+value:value
 return '<c r="'+reference+'" t="inlineStr"'+attr+'><is><t xml:space="preserve">'+escapeXml(text)+'</t></is></c>'
}
function worksheet(sheet:Sheet){
 if(sheet.rows.length>MAX_ROWS||sheet.rows.some(row=>row.length>160))throw Error('workbook_too_large')
 const cols=sheet.widths?.length?'<cols>'+sheet.widths.map((width,i)=>
  '<col min="'+(i+1)+'" max="'+(i+1)+'" width="'+Math.max(5,Math.min(80,width))+'" customWidth="1"/>').join('')+'</cols>':''
 const views=sheet.freezeHeader?'<sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>':
  '<sheetViews><sheetView workbookViewId="0"/></sheetViews>'
 let rows='',total=0
 for(let i=0;i<sheet.rows.length;i++){
  const row=sheet.rows[i],header=sheet.boldRows?.includes(i+1)??false
  const cells=row.map((c,j)=>cellXml(c,column(j)+(i+1),header)).join('')
  rows+='<row r="'+(i+1)+'">'+cells+'</row>'
  total+=cells.length
  if(total>MAX_BYTES/2)throw Error('workbook_too_large')
 }
 const filter=sheet.autoFilter?'<autoFilter ref="'+escapeXml(sheet.autoFilter)+'"/>':''
 return xmlStart+'<worksheet xmlns="'+ns+'">'+views+cols+'<sheetData>'+rows+'</sheetData>'+filter+'</worksheet>'
}
const styles=xmlStart+'<styleSheet xmlns="'+ns+'">'+
 '<numFmts count="2"><numFmt numFmtId="164" formatCode="&quot;€&quot; #,##0.00"/><numFmt numFmtId="165" formatCode="yyyy-mm-dd hh:mm"/></numFmts>'+
 '<fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts>'+
 '<fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills>'+
 '<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>'+
 '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>'+
 '<cellXfs count="4"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>'+
 '<xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>'+
 '<xf numFmtId="165" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>'+
 '<xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/></cellXfs>'+
 '<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>'
const crcTable=new Uint32Array(256)
for(let i=0;i<256;i++){let crc=i;for(let j=0;j<8;j++)crc=(crc&1)?(0xedb88320^(crc>>>1)):(crc>>>1);crcTable[i]=crc>>>0}
function crc32(bytes:Uint8Array){let crc=0xffffffff;for(const x of bytes)crc=crcTable[(crc^x)&255]^(crc>>>8);return (crc^0xffffffff)>>>0}
const u16=(view:DataView,at:number,v:number)=>view.setUint16(at,v,true)
const u32=(view:DataView,at:number,v:number)=>view.setUint32(at,v>>>0,true)
function zip(files:{name:string;data:string}[]){
 const entries=files.map(f=>({name:encoder.encode(f.name),data:encoder.encode(f.data)}))
 if(entries.length>65535)throw Error('workbook_too_large')
 const local=entries.reduce((n,x)=>n+30+x.name.length+x.data.length,0)
 const central=entries.reduce((n,x)=>n+46+x.name.length,0)
 if(local+central+22>MAX_BYTES)throw Error('workbook_too_large')
 const out=new Uint8Array(local+central+22),view=new DataView(out.buffer)
 let cursor=0
 const records:{name:Uint8Array;data:Uint8Array;offset:number;crc:number}[]=[]
 for(const e of entries){
  const offset=cursor,crc=crc32(e.data)
  u32(view,cursor,0x04034b50);u16(view,cursor+4,20);u16(view,cursor+6,0x0800)
  u16(view,cursor+8,0);u16(view,cursor+10,0);u16(view,cursor+12,0)
  u32(view,cursor+14,crc);u32(view,cursor+18,e.data.length);u32(view,cursor+22,e.data.length)
  u16(view,cursor+26,e.name.length);u16(view,cursor+28,0)
  cursor+=30;out.set(e.name,cursor);cursor+=e.name.length
  out.set(e.data,cursor);cursor+=e.data.length
  records.push({...e,offset,crc})
 }
 const centralOffset=cursor
 for(const e of records){
  u32(view,cursor,0x02014b50);u16(view,cursor+4,20);u16(view,cursor+6,20)
  u16(view,cursor+8,0x0800);u16(view,cursor+10,0);u16(view,cursor+12,0);u16(view,cursor+14,0)
  u32(view,cursor+16,e.crc);u32(view,cursor+20,e.data.length);u32(view,cursor+24,e.data.length)
  u16(view,cursor+28,e.name.length);u16(view,cursor+30,0);u16(view,cursor+32,0)
  u16(view,cursor+34,0);u16(view,cursor+36,0);u32(view,cursor+38,0);u32(view,cursor+42,e.offset)
  cursor+=46;out.set(e.name,cursor);cursor+=e.name.length
 }
 u32(view,cursor,0x06054b50);u16(view,cursor+4,0);u16(view,cursor+6,0)
 u16(view,cursor+8,records.length);u16(view,cursor+10,records.length)
 u32(view,cursor+12,cursor-centralOffset);u32(view,cursor+16,centralOffset);u16(view,cursor+20,0)
 return out
}
export function buildXlsx(sheets:Sheet[]):Uint8Array{
 if(!sheets.length||sheets.length>5||sheets.some(s=>!s.name||s.name.length>31||/[\[\]*?:/\\]/.test(s.name)))
  throw Error('invalid_worksheet')
 const wb=xmlStart+'<workbook xmlns="'+ns+'" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>'+
  sheets.map((s,i)=>'<sheet name="'+escapeXml(s.name)+'" sheetId="'+(i+1)+'" r:id="rId'+(i+1)+'"/>').join('')+'</sheets></workbook>'
 const rels=xmlStart+'<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'+
  sheets.map((_,i)=>'<Relationship Id="rId'+(i+1)+'" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet'+(i+1)+'.xml"/>').join('')+
  '<Relationship Id="rId'+(sheets.length+1)+'" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>'
 const content=xmlStart+'<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'+
  '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/>'+
  '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>'+
  '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>'+
  sheets.map((_,i)=>'<Override PartName="/xl/worksheets/sheet'+(i+1)+'.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>').join('')+
  '</Types>'
 const rootRels=xmlStart+'<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>'
 return zip([
  {name:'[Content_Types].xml',data:content},
  {name:'_rels/.rels',data:rootRels},
  {name:'xl/workbook.xml',data:wb},
  {name:'xl/_rels/workbook.xml.rels',data:rels},
  {name:'xl/styles.xml',data:styles},
  ...sheets.map((sheet,i)=>({name:'xl/worksheets/sheet'+(i+1)+'.xml',data:worksheet(sheet)}))
 ])
}
